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
import { RENDER_SCALE } from "./render-scale";

/**
 * Per-instance coat inputs: `x` is the insulation trait 0..1, `y` is a stable
 * render seed so two animals of the same population do not carry a pixel-exact
 * copy of the same fur.
 */
export const COAT_DETAIL_ATTRIBUTE = "coatDetail";

/**
 * Insulation used to change body bulk and nothing else, so a sleek animal and
 * a shaggy one differed only in silhouette. This layers coat structure over the
 * accepted mesh instead of adding geometry: shell layers would read well up
 * close but multiply the draw count per lineage, and the accepted herd evidence
 * is a 15-draw frame. A height field costs no draws and no vertices.
 *
 * Following `terrain-material.ts`: procedural fields in a stable object space,
 * banded so each frequency fades out at the distance where it stops resolving.
 */
export function createGrazerCoatMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.82 });

  const coat = attribute<"vec2">(COAT_DETAIL_ATTRIBUTE, "vec2");
  const insulation = clamp(coat.x, 0, 1);
  const seed = coat.y.mul(37.4);

  // Object space keeps the coat anchored to the body, so fur does not swim
  // across the animal as it walks or slide when the shape morphs move.
  const body = positionLocal.mul(1 / RENDER_SCALE.grazerShoulderHeight);
  // Fibres hang, so the vertical frequency is compressed relative to the
  // horizontal: the noise stretches into strands rather than reading as lumps.
  const strandScale = vec3(26, 7, 26);

  const clump = mx_noise_float(body.mul(vec3(5.5, 3.2, 5.5)).add(seed));
  const fibre = mx_noise_float(body.mul(strandScale).add(seed.add(11.3)));
  const guard = mx_noise_float(body.mul(strandScale.mul(2.6)).add(seed.add(28.9)));

  const distance = cameraPosition.sub(positionWorld).length();
  const fibreFade = float(1).sub(smoothstep(26, 78, distance));
  const guardFade = float(1).sub(smoothstep(9, 30, distance));

  // Every band is scaled by insulation, so a sleek animal keeps the smooth
  // hide the accepted asset was judged on and only a shaggy one grows texture.
  const coatHeight = clump.mul(0.55)
    .add(fibre.mul(0.32).mul(fibreFade))
    .add(guard.mul(0.13).mul(guardFade))
    .mul(insulation);
  material.normalNode = proceduralBump(
    coatHeight,
    float(2.1).mul(insulation).mul(float(1).sub(smoothstep(90, 210, distance))),
  );

  // A sleek hide is tight and slightly specular; a deep coat scatters and has
  // no sheen left at all. The per-instance colour multiplies over this, so
  // the accepted coat warmth and lightness still read.
  const depth = clump.mul(0.5).add(0.5);
  material.roughnessNode = clamp(
    mix(float(0.55), float(0.95), insulation).add(depth.mul(0.07).mul(insulation)),
    0.5,
    0.99,
  );

  // Light reaches the base of a deep coat poorly, so troughs darken and tips
  // catch. That self-shadowing is most of what separates fur from a painted-on
  // texture at a distance where the bump itself has already faded out.
  const shading = float(1).sub(insulation.mul(0.3).mul(float(1).sub(depth)));
  material.colorNode = vec3(shading, shading, shading);

  return material;
}
