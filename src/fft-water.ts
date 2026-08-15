import { Color, DataTexture, DoubleSide, Mesh, Node, NodeMaterial, PlaneGeometry, RingGeometry, Vector3 } from "three/webgpu";
import {
  Fn,
  cameraPosition,
  clamp,
  color,
  cos,
  dot,
  faceDirection,
  float,
  floor,
  fract,
  length,
  max,
  mix,
  normalize,
  positionLocal,
  positionWorld,
  pow,
  reflect,
  sin,
  smoothstep,
  sub,
  texture,
  transformNormalToView,
  uniform,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { FFTOcean, sampleBilinearFloat } from "./fft-ocean";
import { RENDER_SCALE } from "./render-scale";
import type { ResolvedAtmosphere, AtmosphereState } from "./atmosphere";
import type { OceanSeaState } from "./ocean-sea-state";

interface ChopLayer {
  angleDeg: number;
  amplitude: number;
  wavelength: number;
  speed: number;
}

// Fine wind-chop riding on top of the FFT swell — the FFT patch alone gives
// one dominant scale (big swell OR fine chop depending on tuning); the
// reference look wants both simultaneously. Cheaper than a second FFT
// cascade, and a reasonable stand-in for now (see THESIS.md §3).
const CHOP_LAYERS: ChopLayer[] = [
  { angleDeg: 100, amplitude: 0.08, wavelength: 7, speed: 2.2 },
  { angleDeg: 205, amplitude: 0.055, wavelength: 5, speed: 2.7 },
  { angleDeg: 33, amplitude: 0.035, wavelength: 3.6, speed: 3.1 },
];
export interface FFTWaterOptions {
  size?: number;
  segments?: number;
  sunDirection: Vector3;
  atmosphere: AtmosphereState;
  terrainHeightTexture: DataTexture;
  oceanMaskTexture: DataTexture;
  terrainSize?: number;
  seaState?: Pick<OceanSeaState, "chopScale" | "crestFoamStrength">;
}

export type FFTWaterMesh = Mesh & {
  updateAtmosphere(state: ResolvedAtmosphere): void;
};

export function createFFTOceanMesh(ocean: FFTOcean, options: FFTWaterOptions): FFTWaterMesh {
  const size = options.size ?? RENDER_SCALE.oceanExtent;
  const segments = options.segments ?? 300;
  const sunColorNode = uniform(options.atmosphere.sunColor.clone());
  const sunDir = uniform(options.sunDirection);
  const n = ocean.size;
  const patch = ocean.patchSize;
  // Divides the world position that samples `terrainHeightTexture` and
  // `oceanMaskTexture`, so it must be the extent those textures actually span.
  // It defaulted to a hardcoded 380 while the caller never passed it, which
  // survived the 2 km resize silently: shoreline foam, shallow transmission and
  // the land mask kept working only within ±190 m of the origin and the rest of
  // the coast fell back to "deep water, no land". Keyed to the contract now, and
  // the caller passes it explicitly as well.
  const terrainSize = options.terrainSize ?? RENDER_SCALE.islandExtent;
  const sceneTime = ocean.clock;
  const chopScale = options.seaState?.chopScale ?? 1;
  const crestFoamStrength = options.seaState?.crestFoamStrength ?? 0;

  const geometry = new PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const material = new NodeMaterial();
  // The water must participate in transparent composition for the shallow
  // seabed to read through it. Depth writing is disabled so submerged life
  // can still be drawn behind the surface; Fresnel and depth below keep open
  // water visually solid.
  material.transparent = true;
  material.depthWrite = false;
  // The reef review camera swims below the surface. A front-sided sheet
  // disappears from there, removing the luminous ceiling that visually says
  // "clear sea" and leaving only the seabed to colour the frame.
  material.side = DoubleSide;
  const mesh = new Mesh(geometry, material);

  const chopField = Fn(([x, z, distV]: [Node<"float">, Node<"float">, Node<"float">]) => {
    const h = float(0).toVar();
    const dHdx = float(0).toVar();
    const dHdz = float(0).toVar();

    for (const layer of CHOP_LAYERS) {
      const rad = (layer.angleDeg * Math.PI) / 180;
      const k = (2 * Math.PI) / layer.wavelength;
      const kx = Math.cos(rad) * k;
      const kz = Math.sin(rad) * k;
      const omega = layer.speed * k;
      // Tighter than checkpoint-1's water.ts: this camera sits much closer
      // to the surface (near-wave-height, per the reference), so the
      // grazing viewing angle compresses many more wave-rows per screen
      // pixel at a given world-space distance, aliasing sooner.
      const fadeStart = layer.wavelength * 5;
      const fadeEnd = layer.wavelength * 13;

      const layerFade = float(1.0).sub(smoothstep(fadeStart, fadeEnd, distV));
      const phase = x.mul(kx).add(z.mul(kz)).add(sceneTime.mul(omega));
      h.addAssign(sin(phase).mul(layer.amplitude * chopScale).mul(layerFade));
      dHdx.addAssign(cos(phase).mul(layer.amplitude * chopScale * kx).mul(layerFade));
      dHdz.addAssign(cos(phase).mul(layer.amplitude * chopScale * kz).mul(layerFade));
    }

    return vec3(h, dHdx, dHdz);
  });

  const swellField = Fn(([x, z]: [Node<"float">, Node<"float">]) => {
    const u = x.div(patch);
    const v = z.div(patch);
    const h = sampleBilinearFloat(ocean.heightBuffer, n, u, v);
    const dHdx = sampleBilinearFloat(ocean.slopeXBuffer, n, u, v);
    const dHdz = sampleBilinearFloat(ocean.slopeZBuffer, n, u, v);
    return vec3(h, dHdx, dHdz);
  });

  const distV = vec2(positionLocal.x, positionLocal.z).sub(cameraPosition.xz).length();
  const swell = swellField(positionLocal.x, positionLocal.z);
  const chop = chopField(positionLocal.x, positionLocal.z, distV);
  const waterUv = positionLocal.xz.div(terrainSize).add(0.5);
  const insideWaterDomain = smoothstep(0, 0.015, waterUv.x)
    .mul(float(1).sub(smoothstep(0.985, 1, waterUv.x)))
    .mul(smoothstep(0, 0.015, waterUv.y))
    .mul(float(1).sub(smoothstep(0.985, 1, waterUv.y)));
  const oceanMask = mix(float(1), texture(options.oceanMaskTexture, waterUv).r, insideWaterDomain);
  // How far out this patch is toward its own rim, in world radius. Waves and
  // wave shading both retire before the rim so the patch meets the far-water
  // skirt as one flat surface, whatever the camera is doing.
  const patchRim = smoothstep(size * 0.40, size * 0.47, positionLocal.xz.length()).toVar("patchRim");
  const wave = swell.add(chop).mul(oceanMask).mul(float(1).sub(patchRim)).toVar("wave");
  // A small horizontal displacement keeps crests directional. Pure vertical
  // heightfield motion makes broad swells expand and contract like gelatin.
  material.positionNode = positionLocal.add(vec3(wave.y.mul(-0.12), wave.x, wave.z.mul(-0.12)));

  const vWave = varying(wave, "vWave");
  const waveNormal = normalize(vec3(vWave.y.negate(), 1.0, vWave.z.negate()));
  material.normalNode = transformNormalToView(waveNormal);

  const deepColor = uniform(new Color(0x041c26));
  const shallowColor = uniform(new Color(0x008ca7));
  const aerialDensity = uniform(1);
  const zenithColor = uniform(new Color(0x4f8fb5));
  const horizonColor = uniform(options.atmosphere.fogColor.clone().offsetHSL(0, 0.01, 0.025));
  const foamColor = color(new Color(0xf3fbff));
  const terrainUv = positionWorld.xz.div(terrainSize).add(0.5);
  const insideTerrain = smoothstep(0, 0.015, terrainUv.x)
    .mul(float(1).sub(smoothstep(0.985, 1, terrainUv.x)))
    .mul(smoothstep(0, 0.015, terrainUv.y))
    .mul(float(1).sub(smoothstep(0.985, 1, terrainUv.y)));
  const sampledTerrain = texture(options.terrainHeightTexture, terrainUv).r;
  const terrainSurface = mix(float(-40), sampledTerrain, insideTerrain);
  const waterDepth = positionWorld.y.sub(terrainSurface);
  const shallowFactor = float(1).sub(smoothstep(0.7, 10, waterDepth)).mul(insideTerrain);
  const surfaceEyeDir = normalize(cameraPosition.sub(positionWorld));
  const facingWaveNormal = waveNormal.mul(faceDirection);
  const frontShare = faceDirection.mul(0.5).add(0.5);
  const surfaceFresnel = pow(
    float(1.0).sub(clamp(dot(facingWaveNormal, surfaceEyeDir), 0, 1)),
    5.0,
  ).mul(0.96).add(0.04);
  // At a near-vertical view, productive shallows transmit enough light for
  // terrain and future benthic flora to remain legible. At grazing angles,
  // Fresnel reflection restores an opaque water silhouette. The fade reaches
  // fully opaque water before the coastal-productivity depth band ends.
  const shallowTransmission = shallowFactor.mul(float(1).sub(surfaceFresnel));
  const surfaceOpacity = oceanMask.mul(float(1).sub(shallowTransmission.mul(0.62)));
  // From below this is a bright, translucent ceiling rather than a mirror of
  // the sky above. Keep enough alpha to reveal the moving wave field without
  // hiding the air-side world beyond it.
  material.opacityNode = mix(oceanMask.mul(0.26), surfaceOpacity, frontShare);

  const hash2 = Fn(([p]: [Node<"vec2">]) => {
    return fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453123));
  });

  const noise2 = Fn(([p]: [Node<"vec2">]) => {
    const i = floor(p).toVar();
    const f = fract(p).toVar();
    const ff = f.mul(f).mul(sub(3.0, f.mul(2.0)));

    const a = hash2(i);
    const b = hash2(i.add(vec2(1.0, 0.0)));
    const c = hash2(i.add(vec2(0.0, 1.0)));
    const d = hash2(i.add(vec2(1.0, 1.0)));

    return mix(mix(a, b, ff.x), mix(c, d, ff.x), ff.y);
  });

  // 4-octave turbulence, each octave independently drifting so the result
  // never repeats on a simple beat period the way a handful of clean sines
  // does. This is the actual foam driver below, not just a breakup mask on
  // top of the wave field — a threshold on 3-4 sine layers reads as a clean
  // interference lattice no matter how much noise you multiply over it.
  const foamTurbulence = Fn(([p]: [Node<"vec2">]) => {
    const value = float(0).toVar();
    const amp = float(0.5).toVar();
    const freq = vec2(p).toVar();

    value.addAssign(noise2(freq.add(vec2(sceneTime.mul(0.6), sceneTime.mul(-0.4)))).mul(amp));
    freq.mulAssign(2.17);
    amp.mulAssign(0.55);
    value.addAssign(noise2(freq.add(vec2(sceneTime.mul(-0.9), sceneTime.mul(0.5)))).mul(amp));
    freq.mulAssign(2.31);
    amp.mulAssign(0.55);
    value.addAssign(noise2(freq.add(vec2(sceneTime.mul(1.3), sceneTime.mul(0.8)))).mul(amp));
    freq.mulAssign(2.05);
    amp.mulAssign(0.55);
    value.addAssign(noise2(freq.add(vec2(sceneTime.mul(-1.6), sceneTime.mul(-1.1)))).mul(amp));

    return value;
  });

  /**
   * Open-water shading shared by the displaced patch and the far-water skirt.
   *
   * Both surfaces must agree wherever they overlap, so the base colour,
   * reflection, sun path, and aerial fade all live here. Only the near patch
   * adds wave normals, shallow seabed transmission, and shore foam.
   */
  const openWater = (
    shadingNormal: Node<"vec3">,
    shallow: Node<"float">,
  ): Readonly<{ albedo: Node<"vec3">; aerial: Node<"float"> }> => {
    const eyeDir = normalize(cameraPosition.sub(positionWorld));
    const cosTheta = clamp(dot(shadingNormal, eyeDir), 0, 1);
    const fresnel = pow(float(1.0).sub(cosTheta), 5.0).mul(0.96).add(0.04);

    const diffuse = max(dot(shadingNormal, sunDir), 0.0);
    const baseWater = mix(
      deepColor,
      shallowColor,
      clamp(shallow.mul(0.88).add(diffuse.mul(0.16)), 0, 1),
    );

    const sunReflectDir = normalize(reflect(sunDir.negate(), shadingNormal));
    // A broader, energy-limited sun path reads as reflected light near the
    // surface instead of isolated white discs at shoreline camera height.
    const viewDist = length(cameraPosition.sub(positionWorld));
    const specularStrength = mix(float(0.58), float(1.45), smoothstep(60.0, 260.0, viewDist));
    // Distant water is shaded flat, so a single tight lobe mirrors the sun as
    // one isolated white ellipse. Real water carries wave slopes far past the
    // point where they can be resolved, scattering that reflection into a
    // broad sun path — the wide second lobe stands in for those slopes.
    const glint = max(dot(eyeDir, sunReflectDir), 0.0);
    const specular = pow(glint, 112).mul(0.82).add(pow(glint, 9).mul(0.08))
      .mul(sunColorNode)
      .mul(specularStrength);

    // A stable analytic atmosphere reflection is preferable to an unbounded
    // planar reflector here: distorted UVs outside the reflector target made
    // black polygons at the island and wave-height cameras, and the extra
    // scene render did not provide useful detail at ocean scale.
    const environmentReflectDir = normalize(reflect(eyeDir.negate(), shadingNormal));
    const reflectedSky = mix(
      horizonColor,
      zenithColor,
      clamp(environmentReflectDir.y.mul(0.75).add(0.25), 0, 1),
    );

    return {
      albedo: mix(
        mix(shallowColor, color(new Color(0x55d4df)), 0.42),
        mix(baseWater, reflectedSky, fresnel.mul(0.86)).add(specular),
        frontShare,
      ),
      // Aerial perspective. Without it the sea holds its near-camera value all
      // the way out and terminates in a hard line; with it the water loses
      // contrast into the sky and the far edge of any finite plane stops
      // being a visible boundary.
      aerial: smoothstep(float(140).div(aerialDensity), float(3200).div(aerialDensity), viewDist),
    };
  };

  // A hair darker than the sky it fades into. That residual difference is the
  // horizon line itself, rather than a geometric edge standing in for one.
  const distantWater = mix(horizonColor, deepColor, float(0.07));

  material.colorNode = Fn(() => {
    const viewDist = length(cameraPosition.sub(positionWorld));
    const distFade = smoothstep(60.0, 260.0, viewDist);
    // Distance flattening alone is measured from the camera, so how flat the
    // patch is at its own rim depends on where the camera is standing — orbit
    // out and wave-shaded water would abut the dead-flat skirt again. The rim
    // term is world-anchored, so the two always agree where they meet.
    const shadingNormal = normalize(mix(
      waveNormal,
      vec3(0, 1, 0),
      max(distFade.mul(0.9), patchRim),
    ));
    const { albedo, aerial } = openWater(shadingNormal, shallowFactor);

    // Turbulence only breaks up the shoreline ribbon below. Thresholding it
    // across open water produces isolated pale blobs that read as polka dots
    // from the island cameras, even when biased toward active wave crests.
    const turb = foamTurbulence(vec2(positionWorld.x.mul(0.018), positionWorld.z.mul(0.072)));

    // A broken, moving ribbon where the displaced water surface meets land.
    const intersectionBand = smoothstep(0.03, 0.2, waterDepth)
      .mul(float(1).sub(smoothstep(0.2, 0.95, waterDepth)))
      .mul(insideTerrain);
    // LW-3: foam is aerated water, so gate it on wave energy rather than on
    // depth alone. vWave.x is the crest height and length(vWave.yz) the local
    // surface slope (steepness); together they mark rising, breaking water.
    // Without this, every shallow patch foams — a solid ring at the true
    // shoreline plus detached blobs over submerged flats that read as decals
    // in open water. Weighting the band by wave energy scallops the ring and
    // starves the flat patches that had nothing generating them.
    const waveEnergy = clamp(
      max(vWave.x.mul(0.85).add(0.2), length(vWave.yz).mul(1.3)),
      0,
      1,
    );
    const shorePulse = sin(sceneTime.mul(1.35).add(positionWorld.x.mul(0.045)).add(positionWorld.z.mul(0.03)))
      .mul(0.16).add(0.5);
    const shoreBreakup = smoothstep(0.55, 0.9, turb.mul(0.6).add(shorePulse).add(waveEnergy.mul(0.5)));
    const shoreFoam = intersectionBand.mul(shoreBreakup).mul(waveEnergy.mul(0.55).add(0.45)).mul(0.86)
      .mul(float(1).sub(distFade.mul(0.55)));

    // Open-water whitecaps belong to steep, positive crests—not to a screen-
    // space noise mask. The FFT slope is a bounded proxy for the Jacobian
    // until horizontal displacement is carried through as its own buffer.
    const crest = smoothstep(0.12, 0.68, vWave.x)
      .mul(smoothstep(0.16, 0.72, length(vWave.yz)));
    const crestBreakup = smoothstep(0.42, 0.82, turb.add(crest.mul(0.5)));
    const crestFoam = crest.mul(crestBreakup).mul(crestFoamStrength)
      .mul(float(1).sub(patchRim)).mul(float(1).sub(distFade.mul(0.35)));

    return mix(mix(albedo, foamColor, max(shoreFoam, crestFoam)), distantWater, aerial);
  })();

  // The far-water skirt. The displaced patch is only 1400m across, so its own
  // edge was serving as the horizon — complete with visible corners. This ring
  // carries the same open-water shading out to where aerial perspective has
  // fully dissolved it into the sky, so the horizon becomes the horizon rather
  // than the end of the simulation domain.
  const farMaterial = new NodeMaterial();
  farMaterial.side = DoubleSide;
  farMaterial.colorNode = Fn(() => {
    const { albedo, aerial } = openWater(vec3(0, 1, 0), float(0));
    return mix(albedo, distantWater, aerial);
  })();
  const farGeometry = new RingGeometry(size * 0.44, 12000, 96, 1);
  farGeometry.rotateX(-Math.PI / 2);
  const farWater = new Mesh(farGeometry, farMaterial);
  // Below the displaced patch so patch fragments in a wave trough are never
  // depth-rejected against it, which would punch holes through to the skirt.
  // The expected deepest trough over a tile is close to 0.4m, so 0.4 was
  // exactly marginal; the skirt is only ever seen through opaque patch water,
  // so extra clearance costs nothing.
  farWater.position.y = -1;
  // Last among the opaque draws, so the island depth-rejects most of this
  // near-screen-filling surface instead of it being shaded and overdrawn.
  farWater.renderOrder = 1;
  farWater.frustumCulled = false;
  mesh.add(farWater);

  const updateAtmosphere = (state: ResolvedAtmosphere) => {
    sunColorNode.value.copy(state.sunColor);
    horizonColor.value.copy(state.fogColor).offsetHSL(0, 0.01, 0.025);
    zenithColor.value.set(0x4f8fb5).lerp(state.ambientColor, 0.28).offsetHSL(0, 0.04, -0.08);
    deepColor.value.set(0x041c26).multiply(state.mood.waterTint);
    shallowColor.value.set(0x008ca7).multiply(state.mood.waterTint);
    aerialDensity.value = state.mood.hazeDensityScale;
  };

  return Object.assign(mesh, { updateAtmosphere });
}
