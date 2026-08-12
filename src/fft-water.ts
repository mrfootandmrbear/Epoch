import { Color, DataTexture, Mesh, Node, NodeMaterial, PlaneGeometry, Vector3 } from "three/webgpu";
import {
  Fn,
  cameraPosition,
  clamp,
  color,
  cos,
  dot,
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
import type { AtmosphereState } from "./atmosphere";

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

  const geometry = new PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const material = new NodeMaterial();
  // The water must participate in transparent composition for the shallow
  // seabed to read through it. Depth writing is disabled so submerged life
  // can still be drawn behind the surface; Fresnel and depth below keep open
  // water visually solid.
  material.transparent = true;
  material.depthWrite = false;
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
      h.addAssign(sin(phase).mul(layer.amplitude).mul(layerFade));
      dHdx.addAssign(cos(phase).mul(layer.amplitude * kx).mul(layerFade));
      dHdz.addAssign(cos(phase).mul(layer.amplitude * kz).mul(layerFade));
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
  const wave = swell.add(chop).mul(oceanMask).toVar("wave");
  // A small horizontal displacement keeps crests directional. Pure vertical
  // heightfield motion makes broad swells expand and contract like gelatin.
  material.positionNode = positionLocal.add(vec3(wave.y.mul(-0.12), wave.x, wave.z.mul(-0.12)));

  const vWave = varying(wave, "vWave");
  const waveNormal = normalize(vec3(vWave.y.negate(), 1.0, vWave.z.negate()));
  material.normalNode = transformNormalToView(waveNormal);

  const deepColor = color(new Color(0x041c26));
  const shallowColor = color(new Color(0x1c6b78));
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
  const surfaceFresnel = pow(
    float(1.0).sub(clamp(dot(waveNormal, surfaceEyeDir), 0, 1)),
    5.0,
  ).mul(0.96).add(0.04);
  // At a near-vertical view, productive shallows transmit enough light for
  // terrain and future benthic flora to remain legible. At grazing angles,
  // Fresnel reflection restores an opaque water silhouette. The fade reaches
  // fully opaque water before the coastal-productivity depth band ends.
  const shallowTransmission = shallowFactor.mul(float(1).sub(surfaceFresnel));
  material.opacityNode = oceanMask.mul(float(1).sub(shallowTransmission.mul(0.62)));

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

  material.colorNode = Fn(() => {
    const eyeDir = surfaceEyeDir;

    const viewDist = length(cameraPosition.sub(positionWorld));
    const distFade = smoothstep(60.0, 260.0, viewDist);
    const shadingNormal = normalize(mix(waveNormal, vec3(0, 1, 0), distFade.mul(0.9)));

    const cosTheta = clamp(dot(shadingNormal, eyeDir), 0, 1);
    const fresnel = pow(float(1.0).sub(cosTheta), 5.0).mul(0.96).add(0.04);

    const diffuse = max(dot(shadingNormal, sunDir), 0.0);
    const baseWater = mix(
      deepColor,
      shallowColor,
      clamp(shallowFactor.mul(0.88).add(diffuse.mul(0.16)), 0, 1),
    );

    const sunReflectDir = normalize(reflect(sunDir.negate(), shadingNormal));
    // A broader, energy-limited sun path reads as reflected light near the
    // surface instead of isolated white discs at shoreline camera height.
    const specularStrength = mix(float(0.58), float(1.45), distFade);
    const specular = pow(max(dot(eyeDir, sunReflectDir), 0.0), 112)
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
    const albedo = mix(baseWater, reflectedSky, fresnel.mul(0.86)).add(specular);

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
    const foamFactor = shoreFoam;

    return mix(albedo, foamColor, foamFactor);
  })();

  const updateAtmosphere = (state: AtmosphereState) => {
    sunColorNode.value.copy(state.sunColor);
    horizonColor.value.copy(state.fogColor).offsetHSL(0, 0.01, 0.025);
    zenithColor.value.set(0x4f8fb5).lerp(state.ambientColor, 0.28).offsetHSL(0, 0.04, -0.08);
  };
  updateAtmosphere(options.atmosphere);

  return Object.assign(mesh, { updateAtmosphere });
}
