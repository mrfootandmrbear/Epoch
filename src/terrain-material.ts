import { MeshStandardNodeMaterial, Node } from "three/webgpu";
import {
  Fn,
  cameraPosition,
  dot,
  float,
  floor,
  fract,
  mix,
  positionWorld,
  sin,
  smoothstep,
  vec2,
  vertexColor,
} from "three/tsl";

/** World-space terrain detail: authored vertex color remains the semantic
 * climate/slope layer; these octaves only restore stable material scale. */
export function createTerrainMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ roughness: 0.91, metalness: 0 });

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

  const worldUv = positionWorld.xz;
  const macro = noise(worldUv.mul(0.035));
  const medium = noise(worldUv.mul(0.18));
  const grain = noise(worldUv.mul(0.72));
  const distance = cameraPosition.sub(positionWorld).length();
  const grainFade = float(1).sub(smoothstep(45, 150, distance));
  const mediumFade = float(1).sub(smoothstep(130, 420, distance));
  const detail = macro.sub(0.5).mul(0.07)
    .add(medium.sub(0.5).mul(0.055).mul(mediumFade))
    .add(grain.sub(0.5).mul(0.035).mul(grainFade));

  const base = vertexColor();
  material.colorNode = base.mul(detail.add(1));
  material.roughnessNode = float(0.82).add(grain.mul(0.14).mul(grainFade));
  return material;
}
