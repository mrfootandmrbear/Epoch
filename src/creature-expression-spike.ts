import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
} from "three/webgpu";
import source from "../assets/ecosystem/galapagos-land-iguana/source/land-iguana.geometry.json";
import { COAT_DETAIL_ATTRIBUTE, createFounderHideMaterial } from "./creature-material";

export const GRAZER_SHAPE_CHANNELS = [
  "bodyMass",
  "legLength",
  "footWidth",
  "insulation",
  "hornLength",
] as const;
export const GRAZER_POSE_CHANNELS = ["walkA", "walkB"] as const;
export const GRAZER_MORPH_CHANNELS = [...GRAZER_SHAPE_CHANNELS, ...GRAZER_POSE_CHANNELS] as const;

export interface CreatureExpressionSample {
  readonly shape: readonly [number, number, number, number, number];
  readonly coatWarmth: number;
  readonly coatLightness: number;
  readonly walkPhase: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function createLandIguanaGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(source.positions, 3));
  geometry.setIndex(source.indices);
  geometry.morphAttributes.position = GRAZER_MORPH_CHANNELS.map(
    (channel) => new Float32BufferAttribute(source.morphTargets[channel], 3),
  );
  geometry.morphTargetsRelative = source.morphTargetsRelative;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createCreatureExpressionSpike(
  samples: readonly CreatureExpressionSample[],
): InstancedMesh {
  const geometry = createLandIguanaGeometry();
  const material = createFounderHideMaterial();
  // The hide material reads insulation per instance, which the morph texture
  // cannot supply to a fragment shader. One instanced attribute carries the
  // trait and a stable per-animal seed alongside it.
  geometry.setAttribute(
    COAT_DETAIL_ATTRIBUTE,
    new InstancedBufferAttribute(new Float32Array(samples.length * 2), 2),
  );
  const result = new InstancedMesh(geometry, material, samples.length);
  const probe = new Mesh(geometry, material);
  const matrix = new Matrix4();
  const coat = new Color();

  samples.forEach((sample, index) => {
    setCoatDetailAt(result, index, sample);
    matrix.makeTranslation(index * 1.6, 0, 0);
    result.setMatrixAt(index, matrix);
    probe.morphTargetInfluences!.fill(0);
    sample.shape.forEach((value, channel) => {
      probe.morphTargetInfluences![channel] = clamp01(value);
    });
    const phase = ((sample.walkPhase % 1) + 1) % 1;
    probe.morphTargetInfluences![5] = phase < 0.5 ? 1 - phase * 2 : 0;
    probe.morphTargetInfluences![6] = phase >= 0.5 ? phase * 2 - 1 : 0;
    result.setMorphAt(index, probe);
    result.setColorAt(index, coatColorFor(sample, coat));
  });

  result.instanceMatrix.needsUpdate = true;
  if (result.instanceColor) result.instanceColor.needsUpdate = true;
  if (result.morphTexture) result.morphTexture.needsUpdate = true;
  geometry.getAttribute(COAT_DETAIL_ATTRIBUTE).needsUpdate = true;
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

/**
 * Writes the insulation the hide shader reads, plus a stable seed that keeps
 * one animal's scales from being a pixel-exact copy of its neighbour's.
 * Insulation is shape channel 3, the same value the bulk morph uses, so
 * surface and silhouette never disagree about how thick the hide is.
 */
function setCoatDetailAt(
  herd: InstancedMesh,
  index: number,
  sample: CreatureExpressionSample,
): void {
  const detail = herd.geometry.getAttribute(COAT_DETAIL_ATTRIBUTE);
  if (!detail) return;
  detail.setXY(index, clamp01(sample.shape[3]), (index * 0.6180339887) % 1);
  detail.needsUpdate = true;
}

/**
 * `setMorphAt` needs a `Mesh` to read influences from. Allocating one per call
 * was free for a seven-animal herd and is not at herd scale, so each herd keeps
 * a single reusable probe.
 */
const morphProbes = new WeakMap<InstancedMesh, Mesh>();

function probeFor(herd: InstancedMesh): Mesh {
  const existing = morphProbes.get(herd);
  if (existing) return existing;
  const created = new Mesh(herd.geometry, herd.material);
  morphProbes.set(herd, created);
  return created;
}

export function setCreatureExpressionAt(
  herd: InstancedMesh,
  index: number,
  sample: CreatureExpressionSample,
): void {
  setCoatDetailAt(herd, index, sample);
  const probe = probeFor(herd);
  probe.morphTargetInfluences!.fill(0);
  sample.shape.forEach((value, channel) => {
    probe.morphTargetInfluences![channel] = clamp01(value);
  });
  const phase = ((sample.walkPhase % 1) + 1) % 1;
  probe.morphTargetInfluences![5] = phase < 0.5 ? 1 - phase * 2 : 0;
  probe.morphTargetInfluences![6] = phase >= 0.5 ? phase * 2 - 1 : 0;
  herd.setMorphAt(index, probe);
  herd.setColorAt(index, coatColorFor(sample, coatColor));
}

const coatColor = new Color();

/**
 * Ochre-to-gold family albedo. Warmth pulls toward saturated saffron; lightness
 * walks the same hue from dark chocolate to pale Conolophus yellow.
 */
function coatColorFor(sample: CreatureExpressionSample, out: Color): Color {
  const warmth = clamp01(sample.coatWarmth);
  return out.setHSL(
    0.105 - warmth * 0.028,
    0.32 + warmth * 0.38,
    0.24 + clamp01(sample.coatLightness) * 0.40,
  );
}
