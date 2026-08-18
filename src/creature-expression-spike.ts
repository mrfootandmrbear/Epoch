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
import { sampleCoat } from "./coat-variation";
import { COAT_DETAIL_ATTRIBUTE, createFlatHideMaterial, createFounderHideMaterial } from "./creature-material";
import { POPULATION_TRAIT_BOUNDS, type PopulationTraits } from "./population-traits";

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

/**
 * Isolation on the proof fixtures moves means by ~0.03–0.10 of each trait
 * range. Mapping that 1:1 onto morph weights leaves parent and branch as
 * clones. Gain around the founder-ish pivot stretches those deltas onto the
 * shared rig without inventing a second mesh.
 */
export const TRAIT_EXPRESSION_GAIN = 2.75;
export const TRAIT_EXPRESSION_PIVOT = 0.45;
const SHAPE_JITTER = 0.05;

export function normalizePopulationTrait(key: keyof PopulationTraits, value: number): number {
  const bounds = POPULATION_TRAIT_BOUNDS[key];
  return Math.max(0, Math.min(1, (value - bounds.min) / (bounds.max - bounds.min)));
}

export function stylizeTraitChannel(
  normalized: number,
  gain = TRAIT_EXPRESSION_GAIN,
  pivot = TRAIT_EXPRESSION_PIVOT,
): number {
  return clamp01(pivot + (clamp01(normalized) - pivot) * gain);
}

function hash(seed: number, salt: number): number {
  let value = (seed + Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}

/**
 * Landing and raft founders share this mapping so a specialist reads the same
 * whether it is standing on its island or arriving as a cohort.
 */
export function expressionFromPopulationTraits(
  traits: PopulationTraits,
  index: number,
  seed: number,
  walkPhase: number,
): CreatureExpressionSample {
  const variation = (channel: number) => (hash(index * 13 + channel, seed + channel * 31) - 0.5) * SHAPE_JITTER;
  const value = (key: keyof PopulationTraits, channel: number) => (
    clamp01(stylizeTraitChannel(normalizePopulationTrait(key, traits[key])) + variation(channel))
  );
  const coat = sampleCoat(
    stylizeTraitChannel(normalizePopulationTrait("coatWarmth", traits.coatWarmth)),
    stylizeTraitChannel(normalizePopulationTrait("coatLightness", traits.coatLightness)),
    index,
    seed,
  );
  return {
    shape: [
      value("bodyMass", 0),
      value("legLength", 1),
      value("footWidth", 2),
      value("insulation", 3),
      value("hornLength", 4),
    ],
    coatWarmth: coat.warmth,
    coatLightness: coat.lightness,
    walkPhase,
  };
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
  options?: { readonly flatHide?: boolean },
): InstancedMesh {
  const geometry = createLandIguanaGeometry();
  const material = options?.flatHide ? createFlatHideMaterial() : createFounderHideMaterial();
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
    matrix.makeTranslation(index * 2.0, 0, 0);
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
 * Ochre family albedo, stretched so habitat warmth reads at mid distance:
 * cold/wet pulls drab olive-brown; arid warmth saturates toward saffron gold.
 * Lightness stays on the same hue, chocolate to pale Conolophus yellow.
 */
function coatColorFor(sample: CreatureExpressionSample, out: Color): Color {
  const warmth = clamp01(sample.coatWarmth);
  return out.setHSL(
    0.118 - warmth * 0.055,
    0.18 + warmth * 0.62,
    0.16 + clamp01(sample.coatLightness) * 0.46,
  );
}
