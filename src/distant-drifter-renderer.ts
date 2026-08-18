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
import { RENDER_SCALE } from "./render-scale";
import type { FounderProfile } from "./founder-profile";
import { founderTraits } from "./founder-profile";
import { createCreatureExpressionSpike, expressionFromPopulationTraits } from "./creature-expression-spike";

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

function founderSample(profile: Readonly<FounderProfile>, index: number) {
  return expressionFromPopulationTraits(
    founderTraits(profile),
    index,
    profile.generationSeed,
    hash(profile.generationSeed, index + 20),
  );
}

// The default camera approaches from the south-east. Keep the reveal in
// clear foreground water instead of behind the arrival panel or island.
//
// The bearing is the authored one; the distance is not. The original (92, 86)
// was open water off a 165 m island, but this file was not touched by the
// 2 km resize, so the same point ended up 7-17 m up the hillside in all three
// starting worlds — a raft rendered at sea level inside a hill. Keyed to the
// land radius now: 1.25x clears every preset's shore into 5-7 m of water,
// which is offshore without being out over the basin drop.
const ARRIVAL_BEARING = new Vector3(92, 0, 86).normalize();
const ARRIVAL_BASE_POSITION = ARRIVAL_BEARING.clone()
  .multiplyScalar(RENDER_SCALE.islandLandRadius * 1.25);

/**
 * World-space point the raft settles at once `reveal` runs, at the given sea
 * level. Exposed so presentation code (the arrival beat in `main.ts`) can
 * frame a camera on the founder cohort without importing the renderer.
 */
export function drifterArrivalPosition(seaLevel: number): Vector3 {
  return new Vector3(ARRIVAL_BASE_POSITION.x, seaLevel + 0.12, ARRIVAL_BASE_POSITION.z);
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
        new Vector3(-1.7 + index * 1.65, 0.14, -0.45 + (index % 2) * 0.92),
        cohortRotation,
        cohortScale,
      );
      cohort.setMatrixAt(index, cohortMatrix);
    }
    cohort.instanceMatrix.needsUpdate = true;
    cohort.computeBoundingSphere();
    group.add(cohort);
    group.position.copy(drifterArrivalPosition(seaLevel));
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
