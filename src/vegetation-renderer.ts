import {
  Color,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { TreeOutcome, VegetationGuild } from "./outcome-resolver";

const MAX_TREES_PER_GUILD = 420;
const UP = new Vector3(0, 1, 0);

interface VegetationBatch {
  trunk: InstancedMesh;
  crown: InstancedMesh;
}

export interface VegetationRenderer {
  setTrees: (trees: readonly TreeOutcome[], heightAt: (x: number, z: number) => number, seaLevel: number) => void;
}

function instanced(geometry: BufferGeometry, material: MeshStandardMaterial): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, MAX_TREES_PER_GUILD);
  mesh.count = 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function crownGeometry(guild: VegetationGuild): BufferGeometry {
  const parts: BufferGeometry[] = [];
  if (guild === "conifer") {
    for (let layer = 0; layer < 3; layer++) {
      const cone = new ConeGeometry(1 - layer * 0.2, 0.48, 8);
      cone.translate(0, 0.2 + layer * 0.18, 0);
      parts.push(cone);
    }
  } else {
    const offsets = guild === "windswept"
      ? [[0.05, 0.42, 0], [0.48, 0.5, 0.06], [0.9, 0.43, -0.08]]
      : [[-0.25, 0.48, 0], [0.24, 0.57, 0.08], [0, 0.7, -0.12]];
    offsets.forEach(([x, y, z], index) => {
      const sphere = new SphereGeometry(1, 9, 6);
      sphere.scale(index === 1 ? 0.78 : 0.66, guild === "windswept" ? 0.34 : 0.52, index === 1 ? 0.74 : 0.62);
      sphere.translate(x, y, z);
      parts.push(sphere);
    });
  }
  return mergeGeometries(parts, false)!;
}

function makeBatch(scene: Group, guild: VegetationGuild): VegetationBatch {
  const bark = new MeshStandardMaterial({
    color: guild === "windswept" ? 0x554537 : 0x513724,
    roughness: 0.96,
  });
  const foliage = new MeshStandardMaterial({
    color: guild === "conifer" ? 0x173e2b : guild === "windswept" ? 0x53663a : 0x285d35,
    roughness: 0.84,
  });
  const trunk = instanced(new CylinderGeometry(0.5, 0.72, 1, 7), bark);
  const crown = instanced(crownGeometry(guild), foliage);
  scene.add(trunk, crown);
  return { trunk, crown };
}

export function createVegetationRenderer(scene: Group): VegetationRenderer {
  const batches: Record<VegetationGuild, VegetationBatch> = {
    broadleaf: makeBatch(scene, "broadleaf"),
    conifer: makeBatch(scene, "conifer"),
    windswept: makeBatch(scene, "windswept"),
  };
  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const position = new Vector3();
  const scale = new Vector3();
  const color = new Color();

  function setPart(
    mesh: InstancedMesh,
    index: number,
    tree: TreeOutcome,
    y: number,
    localX: number,
    localY: number,
    localZ: number,
    sx: number,
    sy: number,
    sz: number,
  ): void {
    const cosine = Math.cos(tree.rotation);
    const sine = Math.sin(tree.rotation);
    position.set(
      tree.x + localX * cosine - localZ * sine,
      y + localY,
      tree.z + localX * sine + localZ * cosine,
    );
    rotation.setFromAxisAngle(UP, tree.rotation);
    scale.set(sx, sy, sz);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);
  }

  return {
    setTrees(trees, heightAt, seaLevel) {
      const counts: Record<VegetationGuild, number> = { broadleaf: 0, conifer: 0, windswept: 0 };
      for (const tree of trees) {
        const { morphology } = tree;
        const batch = batches[morphology.guild];
        const index = counts[morphology.guild]++;
        const ground = heightAt(tree.x, tree.z);
        const visible = ground >= seaLevel + 0.8;
        const height = visible ? tree.scale * morphology.height : 0;
        const width = visible ? tree.scale * morphology.crownWidth : 0;
        const depth = visible ? tree.scale * morphology.crownDepth : 0;
        const trunkWidth = visible ? tree.scale * morphology.trunkWidth : 0;
        const lean = morphology.lean * height;
        setPart(batch.trunk, index, tree, ground, lean * 0.18, height * 0.42, 0, trunkWidth, height * 0.84, trunkWidth);

        setPart(batch.crown, index, tree, ground, lean, height * 0.38, 0, width, height, depth);
        color.setHSL(morphology.foliageHue, morphology.foliageSaturation, morphology.foliageLightness);
        batch.crown.setColorAt(index, color);
      }

      for (const [guild, batch] of Object.entries(batches) as Array<[VegetationGuild, VegetationBatch]>) {
        batch.trunk.count = counts[guild];
        batch.trunk.instanceMatrix.needsUpdate = true;
        batch.crown.count = counts[guild];
        batch.crown.instanceMatrix.needsUpdate = true;
        if (batch.crown.instanceColor) batch.crown.instanceColor.needsUpdate = true;
      }
    },
  };
}
