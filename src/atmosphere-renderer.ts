import { Color, Node } from "three/webgpu";
import {
  clamp,
  dot,
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
  const sky = mix(horizonColor, zenithColor, pow(skyHeight, 0.68));
  const sunAlignment = dot(direction, sunDirection);
  const sunDisc = smoothstep(0.99986, 0.99996, sunAlignment);
  const sunGlow = pow(clamp(sunAlignment, 0, 1), 360).mul(0.22);
  const node = mix(sky, sunColor, clamp(sunDisc.add(sunGlow), 0, 1));

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
