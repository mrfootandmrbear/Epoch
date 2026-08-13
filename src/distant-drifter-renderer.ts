import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three/webgpu";
import type { FounderProfile } from "./founder-profile";
import { founderTraits } from "./founder-profile";
import { POPULATION_TRAIT_BOUNDS, type PopulationTraits } from "./population-traits";
import { createCreatureExpressionSpike, type CreatureExpressionSample } from "./creature-expression-spike";

const COHORT_SIZE = 3;
const UP = new Vector3(0, 1, 0);

function hash(seed: number, salt: number): number {
  let value = (seed + Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}

function normalized(key: keyof PopulationTraits, value: number): number {
  const bounds = POPULATION_TRAIT_BOUNDS[key];
  return Math.max(0, Math.min(1, (value - bounds.min) / (bounds.max - bounds.min)));
}

function founderSample(profile: Readonly<FounderProfile>, index: number): CreatureExpressionSample {
  const traits = founderTraits(profile);
  const variation = (salt: number) => (hash(profile.generationSeed, index * 11 + salt) - 0.5) * 0.1;
  const value = (key: keyof PopulationTraits, salt: number) => Math.max(
    0,
    Math.min(1, normalized(key, traits[key]) + variation(salt)),
  );
  return {
    shape: [
      value("bodyMass", 0),
      value("legLength", 1),
      value("footWidth", 2),
      value("insulation", 3),
      value("hornLength", 4),
    ],
    coatWarmth: value("coatWarmth", 5),
    coatLightness: value("coatLightness", 6),
    walkPhase: hash(profile.generationSeed, index + 20),
  };
}

export interface DistantDrifterRenderer {
  readonly group: Group;
  readonly founderSeed: () => number | undefined;
  reveal: (profile: Readonly<FounderProfile>, seaLevel: number) => void;
  hide: () => void;
  update: (elapsed: number, seaLevel: number) => void;
}

/** A real trait-expressive founder cohort on storm-torn natural debris. */
export function createDistantDrifterRenderer(): DistantDrifterRenderer {
  const group = new Group();
  group.name = "distant-drifter";
  group.visible = false;
  // The reveal sits outside the island footprint and needs to survive the
  // default gameplay camera. This yields an approximately twelve-metre raft.
  group.scale.setScalar(1.8);

  const wood = new MeshStandardMaterial({ color: 0x55422c, roughness: 0.96 });
  const wetWood = new MeshStandardMaterial({ color: 0x302a22, roughness: 0.86 });
  const leaves = new MeshStandardMaterial({ color: 0x3f5934, roughness: 0.93 });
  for (let index = 0; index < 5; index++) {
    const log = new Mesh(new CylinderGeometry(0.22, 0.3, 6.8 - index * 0.38, 7), index % 2 ? wood : wetWood);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (index - 2) * 0.035;
    log.position.set((index - 2) * 0.06, (index % 2) * 0.1, (index - 2) * 0.62);
    log.castShadow = true;
    group.add(log);
  }
  for (let index = 0; index < 7; index++) {
    const leaf = new Mesh(new BoxGeometry(1.45, 0.06, 0.55), leaves);
    leaf.position.set(-2.7 + index * 0.88, 0.34 + (index % 2) * 0.05, -1.05 + (index % 3) * 1.02);
    leaf.rotation.y = -0.45 + index * 0.17;
    leaf.scale.x = 0.72 + hash(17, index) * 0.45;
    leaf.castShadow = true;
    group.add(leaf);
  }

  let cohort: ReturnType<typeof createCreatureExpressionSpike> | undefined;
  let seed: number | undefined;
  // The default camera approaches from the south-east. Keep the reveal in
  // clear foreground water instead of behind the arrival panel or island.
  const basePosition = new Vector3(92, 0, 86);
  const cohortMatrix = new Matrix4();
  const cohortRotation = new Quaternion();
  const cohortScale = new Vector3();

  function reveal(profile: Readonly<FounderProfile>, seaLevel: number): void {
    if (cohort) group.remove(cohort);
    seed = profile.generationSeed;
    cohort = createCreatureExpressionSpike(Array.from(
      { length: COHORT_SIZE },
      (_, index) => founderSample(profile, index),
    ));
    for (let index = 0; index < COHORT_SIZE; index++) {
      cohortRotation.setFromAxisAngle(UP, -0.45 + index * 0.5);
      const scale = profile.size === "small" ? 0.42 : profile.size === "large" ? 0.62 : 0.52;
      cohortScale.setScalar(scale);
      cohortMatrix.compose(
        new Vector3(-1.7 + index * 1.65, 0.42, -0.45 + (index % 2) * 0.92),
        cohortRotation,
        cohortScale,
      );
      cohort.setMatrixAt(index, cohortMatrix);
    }
    cohort.instanceMatrix.needsUpdate = true;
    cohort.computeBoundingSphere();
    group.add(cohort);
    group.position.copy(basePosition);
    group.position.y = seaLevel + 0.12;
    group.visible = true;
  }

  return {
    group,
    founderSeed: () => seed,
    reveal,
    hide() {
      group.visible = false;
      seed = undefined;
    },
    update(elapsed: number, seaLevel: number) {
      if (!group.visible) return;
      group.position.y = seaLevel + 0.12 + Math.sin(elapsed * 0.72) * 0.18;
      group.rotation.z = Math.sin(elapsed * 0.54) * 0.035;
      group.rotation.x = Math.sin(elapsed * 0.41 + 1.2) * 0.025;
      group.rotation.y = -0.18 + Math.sin(elapsed * 0.12) * 0.06;
    },
  };
}
