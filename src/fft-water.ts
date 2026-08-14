import { Color, DataTexture, DoubleSide, Mesh, Node, NodeMaterial, PlaneGeometry, RingGeometry, Vector3 } from "three/webgpu";
import {
  Fn,
  cameraPosition,
  clamp,
  color,
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
  vec2,
  vec3,
} from "three/tsl";
import { FFTOcean, sampleBilinearVec4 } from "./fft-ocean";
import type { AtmosphereState } from "./atmosphere";

// The hand-authored wind-chop layers that used to ride on top of a single FFT
// patch are gone: the ocean now synthesizes its own fine scales as cascades
// (see fft-ocean.ts). A small sum of directional sines reads as a wavy-line
// texture rather than as water, which is exactly what the second and third
// cascades exist to replace.

export interface FFTWaterOptions {
  size?: number;
  segments?: number;
  sunDirection: Vector3;
  atmosphere: AtmosphereState;
  terrainHeightTexture: DataTexture;
  oceanMaskTexture: DataTexture;
  terrainSize?: number;
  /**
   * Horizontal displacement gain. Real gravity waves are not vertically
   * symmetric — crests sharpen and troughs broaden because water moves
   * sideways as well as up. This is also what makes whitecaps selectable:
   * with no horizontal displacement the surface never folds, the Jacobian is
   * identically 1, and there is nothing physical for foam to key off.
   */
  choppiness?: number;
  /**
   * How hard the surface must fold before it whitecaps. 0 foams anywhere the
   * mapping compresses at all; higher values restrict foam to the steepest
   * crests.
   */
  foamThreshold?: number;
}

export type FFTWaterMesh = Mesh & {
  updateAtmosphere(state: AtmosphereState): void;
};

export function createFFTOceanMesh(ocean: FFTOcean, options: FFTWaterOptions): FFTWaterMesh {
  const size = options.size ?? 1400;
  const segments = options.segments ?? 300;
  const sunColorNode = uniform(options.atmosphere.sunColor.clone());
  const sunDir = uniform(options.sunDirection);
  const n = ocean.size;
  const patch = ocean.patchSize;
  const terrainSize = options.terrainSize ?? 380;
  const sceneTime = ocean.clock;
  const choppiness = options.choppiness ?? 1.0;
  const foamThreshold = options.foamThreshold ?? 0.35;

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

  // How far a cascade survives before it stops being resolvable geometry.
  // Short cascades must retire with distance or their sub-pixel waves alias
  // into a shimmering wavy-line texture at grazing angles. The longest
  // cascade never fades — it carries the silhouette.
  const cascadeFade = (patchSize: number, distV: Node<"float">) =>
    patchSize >= patch
      ? float(1)
      : float(1).sub(smoothstep(patchSize * 3, patchSize * 9, distV));

  // How much of a cascade the mesh can actually carry as geometry. A band
  // whose waves are shorter than two grid cells cannot be displaced without
  // aliasing — it folds into flat plates the size of the triangles. Its
  // energy belongs in the normals instead, which is the geometry-to-BRDF
  // transition in references/water.md §2.3.
  //
  // This also has to gate the Jacobian. The displacement derivatives scale
  // with wavenumber (dDx/dx = (kx^2/|k|)h), so the shortest cascade produces
  // by far the largest folding terms even though its amplitude is tiny.
  // Ungated, it drives the fold measure negative everywhere and the whole
  // sea whitecaps.
  const cellSize = size / segments;
  const resolvedShare = (patchSize: number) => {
    const dominantWavelength = patchSize / 6;
    return Math.min(1, dominantWavelength / (2 * cellSize));
  };

  // Vertical height plus the horizontal (choppy) displacement, summed over
  // every cascade. Returned as vec3(dispX, height, dispZ) so it drops
  // straight into a position offset.
  const displacementField = Fn(([x, z, distV]: [Node<"float">, Node<"float">, Node<"float">]) => {
    const offset = vec3(0, 0, 0).toVar();

    for (const cascade of ocean.cascades) {
      const u = x.div(cascade.patchSize);
      const v = z.div(cascade.patchSize);
      const fade = cascadeFade(cascade.patchSize, distV).mul(resolvedShare(cascade.patchSize));

      // geometry = (Dx, Dz, Dy, dDy/dx)
      const geometry = sampleBilinearVec4(cascade.geometry, n, u, v);

      offset.addAssign(
        vec3(geometry.x.mul(choppiness), geometry.z, geometry.y.mul(choppiness)).mul(fade),
      );
    }

    return offset;
  });

  // Surface slopes and the folding measure, summed over every cascade.
  // Returns vec3(dSlopeX, dSlopeZ, jacobian).
  //
  // The Jacobian is the determinant of the horizontal displacement mapping,
  //   J = (1 + L*dDx/dx)(1 + L*dDz/dz) - (L*dDx/dz)^2,
  // which drops below 1 exactly where the surface compresses into itself.
  // That is the physical whitecap selector: foam is permitted where water is
  // being crowded together, not where a noise texture happens to be bright.
  const slopeField = Fn(([x, z, distV]: [Node<"float">, Node<"float">, Node<"float">]) => {
    const slopeX = float(0).toVar();
    const slopeZ = float(0).toVar();
    const dxx = float(0).toVar();
    const dzz = float(0).toVar();
    const dxz = float(0).toVar();

    for (const cascade of ocean.cascades) {
      const u = x.div(cascade.patchSize);
      const v = z.div(cascade.patchSize);
      const fade = cascadeFade(cascade.patchSize, distV);

      // geometry = (Dx, Dz, Dy, dDy/dx); fold = (dDy/dz, dDx/dx, dDz/dz, dDx/dz)
      const geometry = sampleBilinearVec4(cascade.geometry, n, u, v);
      const foldTerms = sampleBilinearVec4(cascade.fold, n, u, v);

      // Slopes keep their full weight at every scale — carrying short-wave
      // energy in the shading normal is exactly where it should go once the
      // mesh can no longer displace it. Only the fold terms are gated.
      const folded = fade.mul(resolvedShare(cascade.patchSize));

      slopeX.addAssign(geometry.w.mul(fade));
      slopeZ.addAssign(foldTerms.x.mul(fade));
      dxx.addAssign(foldTerms.y.mul(folded));
      dzz.addAssign(foldTerms.z.mul(folded));
      dxz.addAssign(foldTerms.w.mul(folded));
    }

    const jacobian = float(1)
      .add(dxx.mul(choppiness))
      .mul(float(1).add(dzz.mul(choppiness)))
      .sub(dxz.mul(choppiness).mul(dxz.mul(choppiness)));

    return vec3(slopeX, slopeZ, jacobian);
  });

  const distV = vec2(positionLocal.x, positionLocal.z).sub(cameraPosition.xz).length();
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
  const waveMask = oceanMask.mul(float(1).sub(patchRim)).toVar("waveMask");

  // Horizontal displacement is now the spectrum's own, not a fraction of the
  // slope standing in for one: each cascade contributes -i*(k/|k|)*h, which
  // is what sharpens crests and broadens troughs instead of letting broad
  // swells expand and contract like gelatin.
  const displacement = displacementField(positionLocal.x, positionLocal.z, distV)
    .mul(waveMask)
    .toVar("displacement");
  material.positionNode = positionLocal.add(displacement);

  // Slopes and the fold measure are evaluated PER FRAGMENT, from world
  // position, not carried from the vertex stage.
  //
  // This is the whole reason the cascades are worth having. The mesh has
  // ~4.7 m cells, so anything shorter than that cannot be displaced — its
  // energy has to live in the shading normal instead. But a per-vertex normal
  // is interpolated across those same 4.7 m triangles, which destroys exactly
  // the detail being moved there: the surface goes glassy and the foam smears
  // into soft bands. Sampling the cascades in the fragment stage gives the
  // full spectrum at pixel resolution over coarse geometry, which is the
  // geometry-to-BRDF transition actually working rather than merely stated.
  //
  // Stage budgets: the vertex stage binds 3 storage buffers (one per cascade,
  // geometry only) and the fragment stage 6 (geometry + fold per cascade).
  // Both are inside WebGPU's guaranteed 8.
  const fragDist = vec2(positionWorld.x, positionWorld.z).sub(cameraPosition.xz).length();
  const fragUv = positionWorld.xz.div(terrainSize).add(0.5);
  const fragInsideDomain = smoothstep(0, 0.015, fragUv.x)
    .mul(float(1).sub(smoothstep(0.985, 1, fragUv.x)))
    .mul(smoothstep(0, 0.015, fragUv.y))
    .mul(float(1).sub(smoothstep(0.985, 1, fragUv.y)));
  const fragOceanMask = mix(
    float(1),
    texture(options.oceanMaskTexture, fragUv).r,
    fragInsideDomain,
  );
  const fragRim = smoothstep(size * 0.4, size * 0.47, positionWorld.xz.length());
  const fragWaveMask = fragOceanMask.mul(float(1).sub(fragRim)).toVar("fragWaveMask");

  const slopes = slopeField(positionWorld.x, positionWorld.z, fragDist);
  const slopeXZ = vec2(slopes.x, slopes.y).mul(fragWaveMask).toVar("slopeXZ");
  // The fold measure masks toward 1 (no compression), not toward 0. Toward 0
  // every masked-out fragment would read as maximally folded and the land
  // edge would foam over.
  const foldMeasure = mix(float(1), slopes.z, fragWaveMask).toVar("foldMeasure");
  const waveNormal = normalize(vec3(slopeXZ.x.negate(), 1.0, slopeXZ.y.negate()));
  material.normalNode = transformNormalToView(waveNormal);

  const deepColor = color(new Color(0x041c26));
  const shallowColor = color(new Color(0x008ca7));
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
      aerial: smoothstep(140, 3200, viewDist),
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
    const shorePulse = sin(sceneTime.mul(1.35).add(positionWorld.x.mul(0.045)).add(positionWorld.z.mul(0.03)))
      .mul(0.16).add(0.58);
    const shoreBreakup = smoothstep(0.58, 0.88, turb.add(shorePulse));
    const shoreFoam = intersectionBand.mul(shoreBreakup).mul(0.86)
      .mul(float(1).sub(distFade.mul(0.55)));

    // Whitecaps, selected by how hard the surface folds into itself. The
    // Jacobian picks the crest; turbulence only decides how ragged that
    // crest's edge is. Driving foam from noise alone is what produced the
    // polka-dot open water this replaces — see references/water.md §2.2.
    const crestTurb = foamTurbulence(vec2(positionWorld.x.mul(0.11), positionWorld.z.mul(0.14)));
    const fold = float(1).sub(foldMeasure);
    const whitecap = smoothstep(foamThreshold, foamThreshold + 0.34, fold)
      .mul(smoothstep(0.3, 0.78, crestTurb.add(0.42)))
      .mul(float(1).sub(distFade.mul(0.35)));

    return mix(mix(albedo, foamColor, max(shoreFoam, whitecap)), distantWater, aerial);
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

  const updateAtmosphere = (state: AtmosphereState) => {
    sunColorNode.value.copy(state.sunColor);
    horizonColor.value.copy(state.fogColor).offsetHSL(0, 0.01, 0.025);
    zenithColor.value.set(0x4f8fb5).lerp(state.ambientColor, 0.28).offsetHSL(0, 0.04, -0.08);
  };
  updateAtmosphere(options.atmosphere);

  return Object.assign(mesh, { updateAtmosphere });
}
