import {
  Color,
  DynamicDrawUsage,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  MathUtils,
  MeshStandardMaterial,
  Object3D,
  Scene,
} from "three/webgpu";
import type { TerrainHistory } from "./terrain-history";

const MAX_OUTCROPS = 420;
const MAX_SCREE = 760;

function hash(x: number, z: number, seed: number): number {
  const value = Math.sin(x * 127.1 + z * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

function slopeAt(terrain: TerrainHistory, x: number, z: number): number {
  if (x === 0 || z === 0 || x === terrain.side - 1 || z === terrain.side - 1) return 0;
  const index = z * terrain.side + x;
  const step = terrain.extent / (terrain.side - 1);
  const dx = (terrain.elevations[index + 1]! - terrain.elevations[index - 1]!) / (step * 2);
  const dz = (terrain.elevations[index + terrain.side]! - terrain.elevations[index - terrain.side]!) / (step * 2);
  return Math.hypot(dx, dz);
}

export interface TerrainDetailRenderer {
  update(
    terrain: TerrainHistory,
    heightAt: (x: number, z: number) => number,
    seaLevel: number,
  ): void;
}

/** Deterministic physical punctuation over the simulation heightfield. */
export function createTerrainDetailRenderer(scene: Scene): TerrainDetailRenderer {
  const group = new Group();
  group.name = "terrain-details";
  const outcrops = new InstancedMesh(
    new IcosahedronGeometry(1, 0),
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0 }),
    MAX_OUTCROPS,
  );
  const scree = new InstancedMesh(
    new IcosahedronGeometry(1, 0),
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.97, metalness: 0 }),
    MAX_SCREE,
  );
  for (const mesh of [outcrops, scree]) {
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  scene.add(group);

  const transform = new Object3D();
  const color = new Color();

  return {
    update(terrain, heightAt, seaLevel) {
      const step = terrain.extent / (terrain.side - 1);
      const half = terrain.extent / 2;
      let outcropCount = 0;
      let screeCount = 0;

      // A four-cell stride keeps placement sparse and stable while still
      // sampling every authored landform across the island.
      for (let gz = 2; gz < terrain.side - 2; gz += 4) {
        for (let gx = 2; gx < terrain.side - 2; gx += 4) {
          const index = gz * terrain.side + gx;
          const slope = slopeAt(terrain, gx, gz);
          const disturbance = terrain.disturbance[index]!;
          const protection = terrain.vegetationProtection[index]!;
          const baseX = gx * step - half;
          const baseZ = gz * step - half;
          const jitterX = (hash(gx, gz, 1) - 0.5) * step * 3.2;
          const jitterZ = (hash(gx, gz, 2) - 0.5) * step * 3.2;
          const x = baseX + jitterX;
          const z = baseZ + jitterZ;
          const y = heightAt(x, z);
          if (y <= seaLevel + 0.65) continue;

          const exposure = MathUtils.clamp((slope - 0.32) * 1.35 + disturbance * 0.72 - protection * 0.24, 0, 1);
          const cluster = MathUtils.smoothstep(hash(Math.floor(gx / 12), Math.floor(gz / 12), 100), 0.25, 0.75);
          if (outcropCount < MAX_OUTCROPS && hash(gx, gz, 3) < exposure * cluster * 0.42) {
            const size = 0.42 + hash(gx, gz, 4) * (0.62 + exposure * 0.72);
            transform.position.set(x, y + size * 0.28, z);
            transform.rotation.set(
              hash(gx, gz, 5) * 0.55,
              hash(gx, gz, 6) * Math.PI * 2,
              (hash(gx, gz, 7) - 0.5) * 0.48,
            );
            transform.scale.set(size * (0.8 + hash(gx, gz, 8) * 0.65), size * 0.62, size);
            transform.updateMatrix();
            outcrops.setMatrixAt(outcropCount, transform.matrix);
            color.set(0x807b72).offsetHSL(0, -0.02, (hash(gx, gz, 9) - 0.5) * 0.11);
            outcrops.setColorAt(outcropCount, color);
            outcropCount++;
          }

          const screeChance = MathUtils.clamp((slope - 0.2) * 0.75 + disturbance * 0.5, 0, 0.72) * cluster;
          for (let piece = 0; piece < 2 && screeCount < MAX_SCREE; piece++) {
            if (hash(gx, gz, 20 + piece) >= screeChance * 0.48) continue;
            const sx = x + (hash(gx, gz, 30 + piece) - 0.5) * step * 2.6;
            const sz = z + (hash(gx, gz, 40 + piece) - 0.5) * step * 2.6;
            const sy = heightAt(sx, sz);
            const size = 0.14 + hash(gx, gz, 50 + piece) * 0.38;
            transform.position.set(sx, sy + size * 0.24, sz);
            transform.rotation.set(
              hash(gx, gz, 60 + piece) * Math.PI,
              hash(gx, gz, 70 + piece) * Math.PI * 2,
              hash(gx, gz, 80 + piece) * Math.PI,
            );
            transform.scale.set(size * 1.4, size * 0.7, size);
            transform.updateMatrix();
            scree.setMatrixAt(screeCount, transform.matrix);
            color.set(0x6f6a61).offsetHSL(0, -0.03, (hash(gx, gz, 90 + piece) - 0.5) * 0.1);
            scree.setColorAt(screeCount, color);
            screeCount++;
          }
        }
      }

      outcrops.count = outcropCount;
      scree.count = screeCount;
      outcrops.instanceMatrix.needsUpdate = true;
      scree.instanceMatrix.needsUpdate = true;
      if (outcrops.instanceColor) outcrops.instanceColor.needsUpdate = true;
      if (scree.instanceColor) scree.instanceColor.needsUpdate = true;
    },
  };
}
