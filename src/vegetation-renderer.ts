import {
  Color,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three/webgpu";
import type { TreeOutcome, VegetationGuild } from "./outcome-resolver";
import { treeGeometry } from "./tree-geometry-assets";

const MAX_TREES_PER_GUILD = 420;
const NEAR_TREE_DISTANCE = 92;
const LOD_REPARTITION_DISTANCE = 8;
const UP = new Vector3(0, 1, 0);

interface VegetationBatch {
  branches: InstancedMesh;
  leaves: InstancedMesh;
}

interface GuildBatches {
  near: VegetationBatch;
  far: VegetationBatch;
}

export interface VegetationRenderer {
  setTrees: (trees: readonly TreeOutcome[], heightAt: (x: number, z: number) => number, seaLevel: number) => void;
  updateLod: (viewPosition: Readonly<Vector3>) => void;
}

function instanced(geometry: ReturnType<typeof treeGeometry>, material: MeshStandardMaterial): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, MAX_TREES_PER_GUILD);
  mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(MAX_TREES_PER_GUILD * 3).fill(1), 3);
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeBatch(
  scene: Group,
  guild: VegetationGuild,
  level: "near" | "far",
  bark: MeshStandardMaterial,
  foliage: MeshStandardMaterial,
): VegetationBatch {
  const branches = instanced(treeGeometry(guild, level, "branches"), bark);
  const leaves = instanced(treeGeometry(guild, level, "leaves"), foliage);
  scene.add(branches, leaves);
  return { branches, leaves };
}

function makeGuildBatches(scene: Group, guild: VegetationGuild): GuildBatches {
  const bark = new MeshStandardMaterial({
    color: guild === "mangrove" ? 0x66503b : guild === "windswept" ? 0x554537 : 0x513724,
    roughness: 0.96,
    flatShading: true,
  });
  const foliage = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.84,
    side: DoubleSide,
    flatShading: true,
  });
  return {
    near: makeBatch(scene, guild, "near", bark, foliage),
    far: makeBatch(scene, guild, "far", bark, foliage),
  };
}

export function createVegetationRenderer(scene: Group): VegetationRenderer {
  const batches: Record<VegetationGuild, GuildBatches> = {
    broadleaf: makeGuildBatches(scene, "broadleaf"),
    conifer: makeGuildBatches(scene, "conifer"),
    windswept: makeGuildBatches(scene, "windswept"),
    mangrove: makeGuildBatches(scene, "mangrove"),
  };
  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const position = new Vector3();
  const scale = new Vector3();
  const color = new Color();
  const lastViewPosition = new Vector3(Number.POSITIVE_INFINITY, 0, 0);
  let currentTrees: readonly TreeOutcome[] = [];
  let currentHeightAt: (x: number, z: number) => number = () => 0;
  let currentSeaLevel = 0;

  function setTreePart(
    mesh: InstancedMesh,
    index: number,
    tree: TreeOutcome,
    ground: number,
    width: number,
    height: number,
    depth: number,
  ): void {
    position.set(tree.x, ground, tree.z);
    rotation.setFromAxisAngle(UP, tree.rotation);
    scale.set(width, height, depth);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
  }

  function renderLods(viewPosition: Readonly<Vector3>): void {
    const counts: Record<VegetationGuild, { near: number; far: number }> = {
      broadleaf: { near: 0, far: 0 },
      conifer: { near: 0, far: 0 },
      windswept: { near: 0, far: 0 },
      mangrove: { near: 0, far: 0 },
    };
    for (const tree of currentTrees) {
      const { morphology } = tree;
      const distance = Math.hypot(tree.x - viewPosition.x, tree.z - viewPosition.z);
      const level = distance < NEAR_TREE_DISTANCE ? "near" : "far";
      const batch = batches[morphology.guild][level];
      const index = counts[morphology.guild][level]++;
      const ground = currentHeightAt(tree.x, tree.z);
      const visible = morphology.guild === "mangrove"
        ? ground >= currentSeaLevel - 0.9 && ground <= currentSeaLevel + 1.5
        : ground >= currentSeaLevel + 0.8;
      const height = visible ? tree.scale * morphology.height * 1.24 : 0;
      const width = visible ? tree.scale * morphology.crownWidth : 0;
      const depth = visible ? tree.scale * morphology.crownDepth : 0;
      const horizontalSpread = morphology.guild === "conifer" ? 1.25 : morphology.guild === "windswept" ? 1.75 : 1.65;
      setTreePart(batch.branches, index, tree, ground, width * horizontalSpread, height, depth * horizontalSpread);
      setTreePart(batch.leaves, index, tree, ground, width * horizontalSpread, height, depth * horizontalSpread);
      color.setHSL(morphology.foliageHue, morphology.foliageSaturation, morphology.foliageLightness);
      batch.leaves.setColorAt(index, color);
    }

    for (const [guild, levels] of Object.entries(batches) as Array<[VegetationGuild, GuildBatches]>) {
      for (const level of ["near", "far"] as const) {
        const batch = levels[level];
        const count = counts[guild][level];
        for (const mesh of [batch.branches, batch.leaves]) {
          mesh.count = count;
          mesh.instanceMatrix.needsUpdate = true;
        }
        if (batch.leaves.instanceColor) batch.leaves.instanceColor.needsUpdate = true;
      }
    }
  }

  return {
    setTrees(trees, heightAt, seaLevel) {
      currentTrees = trees;
      currentHeightAt = heightAt;
      currentSeaLevel = seaLevel;
      lastViewPosition.set(Number.POSITIVE_INFINITY, 0, 0);
    },
    updateLod(viewPosition) {
      if (lastViewPosition.distanceTo(viewPosition) < LOD_REPARTITION_DISTANCE) return;
      lastViewPosition.copy(viewPosition);
      renderLods(viewPosition);
    },
  };
}
