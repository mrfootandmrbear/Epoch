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
  reflector,
  sin,
  smoothstep,
  sub,
  texture,
  time,
  transformNormalToView,
  varying,
  vec2,
  vec3,
} from "three/tsl";
import { FFTOcean, sampleBilinearFloat } from "./fft-ocean";

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
  { angleDeg: 100, amplitude: 0.25, wavelength: 7, speed: 2.2 },
  { angleDeg: 205, amplitude: 0.18, wavelength: 5, speed: 2.7 },
  { angleDeg: 33, amplitude: 0.12, wavelength: 3.6, speed: 3.1 },
];
const MAX_CHOP_HEIGHT = CHOP_LAYERS.reduce((sum, layer) => sum + layer.amplitude, 0);

export interface FFTWaterOptions {
  size?: number;
  segments?: number;
  sunDirection: Vector3;
  sunColor?: Color;
  terrainHeightTexture: DataTexture;
  terrainSize?: number;
}

export function createFFTOceanMesh(ocean: FFTOcean, options: FFTWaterOptions): Mesh {
  const size = options.size ?? 1400;
  const segments = options.segments ?? 300;
  const sunColorNode = color(options.sunColor ?? new Color(0xfff2d9));
  const sunDir = options.sunDirection.clone().normalize();
  const n = ocean.size;
  const patch = ocean.patchSize;
  const terrainSize = options.terrainSize ?? 380;

  const geometry = new PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const material = new NodeMaterial();
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
      const phase = x.mul(kx).add(z.mul(kz)).add(time.mul(omega));
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
  const wave = swell.add(chop).toVar("wave");
  material.positionNode = positionLocal.add(vec3(0, wave.x, 0));

  const vWave = varying(wave, "vWave");
  const waveNormal = normalize(vec3(vWave.y.negate(), 1.0, vWave.z.negate()));
  material.normalNode = transformNormalToView(waveNormal);

  const deepColor = color(new Color(0x041c26));
  const shallowColor = color(new Color(0x1c6b78));
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

    value.addAssign(noise2(freq.add(vec2(time.mul(0.6), time.mul(-0.4)))).mul(amp));
    freq.mulAssign(2.17);
    amp.mulAssign(0.55);
    value.addAssign(noise2(freq.add(vec2(time.mul(-0.9), time.mul(0.5)))).mul(amp));
    freq.mulAssign(2.31);
    amp.mulAssign(0.55);
    value.addAssign(noise2(freq.add(vec2(time.mul(1.3), time.mul(0.8)))).mul(amp));
    freq.mulAssign(2.05);
    amp.mulAssign(0.55);
    value.addAssign(noise2(freq.add(vec2(time.mul(-1.6), time.mul(-1.1)))).mul(amp));

    return value;
  });

  material.colorNode = Fn(() => {
    const eyeDir = normalize(cameraPosition.sub(positionWorld));

    const viewDist = length(cameraPosition.sub(positionWorld));
    const distFade = smoothstep(60.0, 260.0, viewDist);
    const shadingNormal = normalize(mix(waveNormal, vec3(0, 1, 0), distFade.mul(0.9)));

    const distortion = vec2(vWave.y, vWave.z).mul(0.6).mul(float(1.0).sub(distFade.mul(0.85)));
    const mirror = reflector({ resolutionScale: 0.5 });
    mirror.target.rotateX(-Math.PI / 2);
    mirror.uvNode = mirror.uvNode!.add(distortion);
    mesh.add(mirror.target);

    const cosTheta = clamp(dot(shadingNormal, eyeDir), 0, 1);
    const fresnel = pow(float(1.0).sub(cosTheta), 5.0).mul(0.96).add(0.04);

    const diffuse = max(dot(shadingNormal, vec3(sunDir.x, sunDir.y, sunDir.z)), 0.0);
    const baseWater = mix(
      deepColor,
      shallowColor,
      clamp(shallowFactor.mul(0.88).add(diffuse.mul(0.16)), 0, 1),
    );

    const reflectDir = normalize(reflect(vec3(sunDir.x, sunDir.y, sunDir.z).negate(), shadingNormal));
    const specular = pow(max(dot(eyeDir, reflectDir), 0.0), 200).mul(sunColorNode).mul(3.0);

    const albedo = mix(baseWater, mirror.rgb, fresnel).add(specular);

    // High sea state: turbulence is the actual foam *shape* (a threshold on
    // just 3-4 clean sine layers reads as a repeating interference lattice
    // no matter how it's post-processed — tried that first, kept the
    // polka-dot grid at any distance). Chop crest/slope only biases *where*
    // foam is more likely, it doesn't draw the pattern itself.
    const turb = foamTurbulence(vec2(positionWorld.x.mul(0.018), positionWorld.z.mul(0.072)));
    const chopSlope = vec2(chop.y, chop.z).length();
    const waveActivity = clamp(
      chop.x.div(MAX_CHOP_HEIGHT * 0.4).add(chopSlope.mul(1.2)),
      0,
      1.0,
    );
    const foamMask = smoothstep(0.76, 0.98, turb.add(waveActivity.mul(0.28)));
    const openWaterFoam = foamMask.mul(0.58).mul(float(1.0).sub(distFade));

    // A broken, moving ribbon where the displaced water surface meets land.
    const intersectionBand = smoothstep(0.03, 0.2, waterDepth)
      .mul(float(1).sub(smoothstep(0.2, 0.95, waterDepth)))
      .mul(insideTerrain);
    const shorePulse = sin(time.mul(1.35).add(positionWorld.x.mul(0.045)).add(positionWorld.z.mul(0.03)))
      .mul(0.16).add(0.58);
    const shoreBreakup = smoothstep(0.58, 0.88, turb.add(shorePulse));
    const shoreFoam = intersectionBand.mul(shoreBreakup).mul(0.86)
      .mul(float(1).sub(distFade.mul(0.55)));
    const foamFactor = max(openWaterFoam, shoreFoam);

    return mix(albedo, foamColor, foamFactor);
  })();

  return mesh;
}
