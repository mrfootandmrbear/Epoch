import type { Node } from "three/webgpu";
import {
  Fn,
  abs,
  faceDirection,
  normalView,
  positionView,
  vec2,
} from "three/tsl";

/**
 * Perturb a procedural surface without requiring UV-addressable bump textures.
 *
 * Shared by the terrain and creature materials: both layer a height field over
 * geometry that is authoritative for other reasons and cannot carry a baked
 * normal map.
 */
export const proceduralBump = Fn(([height, strength]: [Node<"float">, Node<"float">]) => {
  const sigmaX = positionView.dFdx().normalize();
  const sigmaY = positionView.dFdy().normalize();
  const heightDerivative = vec2(height.dFdx(), height.dFdy()).mul(strength);
  const r1 = sigmaY.cross(normalView);
  const r2 = normalView.cross(sigmaX);
  const determinant = sigmaX.dot(r1).mul(faceDirection);
  const gradient = determinant.sign().mul(heightDerivative.x.mul(r1).add(heightDerivative.y.mul(r2)));
  return abs(determinant).mul(normalView).sub(gradient).normalize();
});
