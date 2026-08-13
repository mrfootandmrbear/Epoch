import { Color, Node } from "three/webgpu";
import {
  clamp,
  dot,
  float,
  mix,
  positionWorldDirection,
  pow,
  smoothstep,
  uniform,
} from "three/tsl";
import type { AtmosphereState } from "./atmosphere";

export interface AtmosphereBackground {
  readonly node: Node<"vec3">;
  update(state: AtmosphereState): void;
}

/**
 * A stable world-space sky. The gradient and solar disc stay attached to the
 * world while the camera orbits; clouds remain intentionally out of scope
 * until the lower atmosphere has passed visual review.
 */
export function createAtmosphereBackground(initial: AtmosphereState): AtmosphereBackground {
  const horizonColor = uniform(new Color(0xb9ced9));
  const zenithColor = uniform(new Color(0x4f8fb5));
  const sunColor = uniform(initial.sunColor.clone());
  const sunDirection = uniform(initial.sunDirection.clone());

  const direction = positionWorldDirection.normalize();
  const skyHeight = clamp(direction.y.mul(1.2).add(0.035), 0, 1);
  const sky = mix(horizonColor, zenithColor, pow(skyHeight, 1.15));
  // Real skies carry a pale, low-contrast band of scattered light hugging the
  // horizon before the gradient deepens. Without it the sea meets a flat wall
  // of colour and the horizon reads as a seam rather than a distance.
  const hazeBand = float(1).sub(smoothstep(0, 0.16, clamp(direction.y, 0, 1)));
  const hazed = mix(sky, horizonColor.mul(1.06), hazeBand.mul(0.62));
  // A flat sea's horizon sits at eye level, but the far-water skirt is a disc
  // of finite radius, so it ends a fraction of a degree lower and leaves a
  // thin wedge of sky beneath the true horizon. Shading that wedge as distant
  // water — the same value the skirt fades to — makes the gap invisible.
  const belowHorizon = smoothstep(0, -0.015, direction.y);
  const seaward = mix(hazed, horizonColor.mul(0.93), belowHorizon);

  const sunAlignment = dot(direction, sunDirection);
  // Below-horizon suns must not paint a disc onto the sky. The sky is drawn
  // behind the far water, but the halo would still bleed above the horizon.
  const sunVisibility = smoothstep(-0.055, 0.035, sunDirection.y);
  // ~0.6 degrees across with a soft limb, against the previous ~1.9 degrees.
  const sunDisc = smoothstep(0.999975, 0.999992, sunAlignment);
  const innerGlow = pow(clamp(sunAlignment, 0, 1), 1400).mul(0.55);
  // A broad forward-scatter halo — the reason the sky brightens around the
  // sun instead of holding an isolated disc on a uniform gradient.
  const mieHalo = pow(clamp(sunAlignment, 0, 1), 22).mul(0.17);
  const solar = clamp(sunDisc.add(innerGlow).add(mieHalo), 0, 1).mul(sunVisibility);
  const node = mix(seaward, sunColor, solar);

  return {
    node,
    update(state) {
      horizonColor.value.copy(state.fogColor).offsetHSL(0, 0.01, 0.025);
      // Preserve a recognizably blue upper sky even when ambient fill is gray.
      zenithColor.value.set(0x4f8fb5).lerp(state.ambientColor, 0.28).offsetHSL(0, 0.04, -0.08);
      sunColor.value.copy(state.sunColor);
      sunDirection.value.copy(state.sunDirection);
    },
  };
}
