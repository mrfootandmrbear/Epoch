import { Color, Node } from "three/webgpu";
import {
  Fn,
  clamp,
  color,
  dot,
  float,
  floor,
  fract,
  mix,
  positionWorldDirection,
  pow,
  sin,
  smoothstep,
  uniform,
  vec2,
} from "three/tsl";
import type { AtmosphereState } from "./atmosphere";

export interface AtmosphereBackground {
  readonly node: Node<"vec3">;
  update(state: AtmosphereState, elapsed: number): void;
}

/**
 * Directional sky treatment shared by every camera. Unlike a screen-space
 * gradient, the sun and cloud field remain attached to the world as the
 * player orbits, while the dome itself remains effectively infinitely far.
 */
export function createAtmosphereBackground(initial: AtmosphereState): AtmosphereBackground {
  const horizonColor = uniform(initial.fogColor.clone().offsetHSL(0, 0.02, 0.035));
  const zenithColor = uniform(initial.ambientColor.clone().offsetHSL(0.015, 0.12, -0.12));
  const sunColor = uniform(initial.sunColor.clone());
  const sunDirection = uniform(initial.sunDirection.clone());
  const cloudCoverage = uniform(initial.cloudCoverage);
  const cloudDensity = uniform(initial.cloudDensity);
  const cloudTime = uniform(0);

  const hash = Fn(([p]: [Node<"vec2">]) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453123)));
  const noise = Fn(([p]: [Node<"vec2">]) => {
    const cell = floor(p).toVar();
    const local = fract(p).toVar();
    const blend = local.mul(local).mul(float(3).sub(local.mul(2)));
    const a = hash(cell);
    const b = hash(cell.add(vec2(1, 0)));
    const c = hash(cell.add(vec2(0, 1)));
    const d = hash(cell.add(vec2(1, 1)));
    return mix(mix(a, b, blend.x), mix(c, d, blend.x), blend.y);
  });

  const direction = positionWorldDirection.normalize();
  const skyHeight = clamp(direction.y.mul(1.15).add(0.04), 0, 1);
  const baseSky = mix(horizonColor, zenithColor, pow(skyHeight, 0.62));

  // Project the upper hemisphere onto a stable world-space cloud sheet.
  // Two drifting octaves avoid a repeating screen-space overlay while the
  // horizon masks the projection singularity and keeps low haze restrained.
  const cloudUv = direction.xz.div(direction.y.add(0.22)).mul(3.1);
  const drift = vec2(cloudTime.mul(0.0075), cloudTime.mul(-0.0032));
  const coarse = noise(cloudUv.add(drift));
  const fine = noise(cloudUv.mul(2.17).add(drift.mul(-1.7)));
  const wisps = noise(cloudUv.mul(4.83).add(drift.mul(2.6)));
  const cloudField = coarse.mul(0.48).add(fine.mul(0.34)).add(wisps.mul(0.18));
  const cloudThreshold = float(0.78).sub(cloudCoverage.mul(0.5));
  const cloudShape = smoothstep(cloudThreshold, cloudThreshold.add(0.18), cloudField);
  const cloudAltitude = smoothstep(0.025, 0.16, direction.y)
    .mul(float(1).sub(smoothstep(0.78, 0.98, direction.y)));
  const cloudOpacity = cloudShape.mul(cloudAltitude).mul(cloudDensity);
  const cloudLight = color(new Color(0xe8eef0));
  const cloudShade = color(new Color(0x879aa3));
  const cloudSunlight = clamp(direction.y.mul(0.8).add(0.35), 0, 1)
    .mul(float(1).sub(cloudDensity.mul(0.72)));
  const cloudColor = mix(cloudShade, cloudLight, cloudSunlight);
  const cloudedSky = mix(baseSky, cloudColor, cloudOpacity.mul(0.82));

  // About half a degree wide, matching the apparent solar diameter. A soft
  // aureole remains visible at dawn but storm clouds can substantially veil it.
  const sunAlignment = dot(direction, sunDirection);
  const sunDisc = smoothstep(0.99991, 0.999975, sunAlignment);
  const sunGlow = pow(clamp(sunAlignment, 0, 1), 420).mul(0.34);
  const sunVisibility = float(1).sub(cloudOpacity.mul(0.82));
  const node = mix(
    cloudedSky,
    sunColor,
    clamp(sunDisc.add(sunGlow).mul(sunVisibility), 0, 1),
  );

  return {
    node,
    update(state, elapsed) {
      horizonColor.value.copy(state.fogColor).offsetHSL(0, 0.02, 0.035);
      zenithColor.value.copy(state.ambientColor).offsetHSL(0.015, 0.12, -0.12);
      sunColor.value.copy(state.sunColor);
      sunDirection.value.copy(state.sunDirection);
      cloudCoverage.value = state.cloudCoverage;
      cloudDensity.value = state.cloudDensity;
      cloudTime.value = elapsed;
    },
  };
}
