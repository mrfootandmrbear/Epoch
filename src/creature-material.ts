import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  attribute,
  cameraPosition,
  clamp,
  float,
  mix,
  mx_noise_float,
  positionLocal,
  positionWorld,
  smoothstep,
  vec3,
} from "three/tsl";
import { proceduralBump } from "./procedural-bump";

/**
 * Per-instance coat inputs: `x` is the insulation trait 0..1, `y` is a stable
 * render seed so two animals of the same population do not carry a pixel-exact
 * copy of the same hide.
 */
export const COAT_DETAIL_ATTRIBUTE = "coatDetail";

/**
 * Hip height of the land-iguana founder mesh, metres. Used only to scale hide
 * noise in object space so plates read at the animal's size. This is not a
 * world-scale contract and must not replace `RENDER_SCALE`.
 */
const FOUNDER_HIP_HEIGHT = 0.26;

/**
 * Scaly hide for the Galápagos land-iguana founder. Insulation thickens keratin
 * relief and kills sheen; it does not grow fur. A sleek animal keeps a tighter,
 * slightly satiny hide; a cold-adapted one is rugose and matte.
 */
export function createFounderHideMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.62 });

  const coat = attribute<"vec2">(COAT_DETAIL_ATTRIBUTE, "vec2");
  const insulation = clamp(coat.x, 0, 1);
  const seed = coat.y.mul(37.4);

  const body = positionLocal.mul(1 / FOUNDER_HIP_HEIGHT);
  const plate = mx_noise_float(body.mul(vec3(11, 9, 11)).add(seed));
  const micro = mx_noise_float(body.mul(vec3(22, 18, 22)).add(seed.add(9.1)));

  const distance = cameraPosition.sub(positionWorld).length();
  const microFade = float(1).sub(smoothstep(4, 14, distance));
  const plateFade = float(1).sub(smoothstep(12, 36, distance));

  const scaleHeight = plate.mul(0.4).mul(plateFade)
    .add(micro.mul(0.12).mul(microFade))
    .mul(mix(float(0.22), float(0.65), insulation));
  material.normalNode = proceduralBump(
    scaleHeight,
    float(1.15).mul(mix(float(0.4), float(0.85), insulation)).mul(float(1).sub(smoothstep(28, 72, distance))),
  );

  const depth = plate.mul(0.5).add(0.5);
  material.roughnessNode = clamp(
    mix(float(0.46), float(0.84), insulation).add(depth.mul(0.05).mul(insulation)),
    0.4,
    0.92,
  );

  const shading = float(1).sub(mix(float(0.08), float(0.18), insulation).mul(float(1).sub(depth)));
  material.colorNode = vec3(shading, shading, shading);

  return material;
}
