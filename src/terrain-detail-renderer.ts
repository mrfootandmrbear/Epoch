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
const MAX_REEF_RUBBLE = 100000;

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
  const reefRubble = new InstancedMesh(
    new IcosahedronGeometry(1, 0),
    new MeshStandardMaterial({ color: 0xffffff, roughness: 0.98, metalness: 0 }),
    MAX_REEF_RUBBLE,
  );
  outcrops.name = "terrain-outcrops";
  scree.name = "terrain-scree";
  reefRubble.name = "reef-rubble";
  for (const mesh of [outcrops, scree, reefRubble]) {
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
      let reefRubbleCount = 0;

      // Mature reef floor is broken carbonate framework, not a smooth plane.
      // Sample independently of coral positions so rubble forms a continuous
      // benthic layer rather than one presentation rock under each colony.
      for (let gz = 1; gz < terrain.side - 1 && reefRubbleCount < MAX_REEF_RUBBLE; gz++) {
        for (let gx = 1; gx < terrain.side - 1 && reefRubbleCount < MAX_REEF_RUBBLE; gx++) {
          const index = gz * terrain.side + gx;
          const carbonate = terrain.carbonate[index]!;
          const basalt = terrain.basalt[index]!;
          const sediment = terrain.sediment[index]!;
          const density = MathUtils.smoothstep(carbonate, 0.001, 0.025)
            * (1 - basalt * 0.9) * (1 - sediment * 0.55);
          if (density < 0.05) continue;
          const baseX = gx * step - half;
          const baseZ = gz * step - half;
          for (let piece = 0; piece < 6 && reefRubbleCount < MAX_REEF_RUBBLE; piece++) {
            if (hash(gx, gz, 200 + piece) > density * 0.98) continue;
            const x = baseX + (hash(gx, gz, 220 + piece) - 0.5) * step * 2.2;
            const z = baseZ + (hash(gx, gz, 240 + piece) - 0.5) * step * 2.2;
            const y = heightAt(x, z);
            const depth = seaLevel - y;
            if (depth < 0.85 || depth > 25) continue;

            const sizeRoll = hash(gx, gz, 260 + piece);
            const size = 0.07 + sizeRoll * sizeRoll * 0.2;
            const slab = hash(gx, gz, 280 + piece);
            transform.position.set(x, y + size * 0.22, z);
            transform.rotation.set(
              hash(gx, gz, 300 + piece) * Math.PI,
              hash(gx, gz, 320 + piece) * Math.PI * 2,
              hash(gx, gz, 340 + piece) * Math.PI,
            );
            transform.scale.set(
              size * (0.65 + hash(gx, gz, 360 + piece) * 1.15),
              size * (0.3 + slab * 0.42),
              size * (0.72 + hash(gx, gz, 380 + piece) * 0.9),
            );
            transform.updateMatrix();
            reefRubble.setMatrixAt(reefRubbleCount, transform.matrix);
            // Dead skeleton, weathered limestone and coralline-coated rubble.
            const tint = hash(gx, gz, 400 + piece);
            color.set(tint > 0.94 ? 0x4b555d : tint > 0.58 ? 0x6f7a82 : 0x92999c)
              .offsetHSL(0, -0.025, (hash(gx, gz, 420 + piece) - 0.5) * 0.07);
            reefRubble.setColorAt(reefRubbleCount, color);
            reefRubbleCount++;
          }
        }
      }

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
      reefRubble.count = reefRubbleCount;
      outcrops.instanceMatrix.needsUpdate = true;
      scree.instanceMatrix.needsUpdate = true;
      reefRubble.instanceMatrix.needsUpdate = true;
      if (outcrops.instanceColor) outcrops.instanceColor.needsUpdate = true;
      if (scree.instanceColor) scree.instanceColor.needsUpdate = true;
      if (reefRubble.instanceColor) reefRubble.instanceColor.needsUpdate = true;
    },
  };
}
