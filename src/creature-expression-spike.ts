import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
} from "three/webgpu";
import source from "../assets/ecosystem/example-marsh-grazer/source/marsh-grazer.geometry.json";

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

export function createMarshGrazerGeometry(): BufferGeometry {
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
  const geometry = createMarshGrazerGeometry();
  const material = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 });
  const result = new InstancedMesh(geometry, material, samples.length);
  const probe = new Mesh(geometry, material);
  const matrix = new Matrix4();
  const coat = new Color();

  samples.forEach((sample, index) => {
    matrix.makeTranslation(index * 4.2, 0, 0);
    result.setMatrixAt(index, matrix);
    probe.morphTargetInfluences!.fill(0);
    sample.shape.forEach((value, channel) => {
      probe.morphTargetInfluences![channel] = clamp01(value);
    });
    const phase = ((sample.walkPhase % 1) + 1) % 1;
    probe.morphTargetInfluences![5] = phase < 0.5 ? 1 - phase * 2 : 0;
    probe.morphTargetInfluences![6] = phase >= 0.5 ? phase * 2 - 1 : 0;
    result.setMorphAt(index, probe);
    coat.setHSL(
      0.075 - clamp01(sample.coatWarmth) * 0.035,
      0.24 + clamp01(sample.coatWarmth) * 0.24,
      0.25 + clamp01(sample.coatLightness) * 0.28,
    );
    result.setColorAt(index, coat);
  });

  result.instanceMatrix.needsUpdate = true;
  if (result.instanceColor) result.instanceColor.needsUpdate = true;
  if (result.morphTexture) result.morphTexture.needsUpdate = true;
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

export function setCreatureExpressionAt(
  herd: InstancedMesh,
  index: number,
  sample: CreatureExpressionSample,
): void {
  const probe = new Mesh(herd.geometry, herd.material);
  probe.morphTargetInfluences!.fill(0);
  sample.shape.forEach((value, channel) => {
    probe.morphTargetInfluences![channel] = clamp01(value);
  });
  const phase = ((sample.walkPhase % 1) + 1) % 1;
  probe.morphTargetInfluences![5] = phase < 0.5 ? 1 - phase * 2 : 0;
  probe.morphTargetInfluences![6] = phase >= 0.5 ? phase * 2 - 1 : 0;
  herd.setMorphAt(index, probe);
  const coat = new Color().setHSL(
    0.075 - clamp01(sample.coatWarmth) * 0.035,
    0.24 + clamp01(sample.coatWarmth) * 0.24,
    0.25 + clamp01(sample.coatLightness) * 0.28,
  );
  herd.setColorAt(index, coat);
}
