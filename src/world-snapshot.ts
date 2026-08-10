import type { ClimateForces } from "./climate";

export interface WorldSnapshot {
  readonly gridSize: number;
  readonly extent: number;
  readonly elevations: Float32Array;
  readonly climate: Readonly<ClimateForces>;
  readonly totalYears: number;
}

type HeightAt = (x: number, z: number) => number;

/** Capture the editable world once so every ecosystem resolves from identical terrain. */
export function captureWorldSnapshot(
  heightAt: HeightAt,
  totalYears: number,
  climate: ClimateForces,
  gridSize = 96,
  extent = 300,
): WorldSnapshot {
  const elevations = new Float32Array(gridSize * gridSize);
  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      const worldX = (x / (gridSize - 1) - 0.5) * extent;
      const worldZ = (z / (gridSize - 1) - 0.5) * extent;
      elevations[z * gridSize + x] = heightAt(worldX, worldZ);
    }
  }
  return {
    gridSize,
    extent,
    elevations,
    climate: Object.freeze({ ...climate }),
    totalYears,
  };
}

export function snapshotHeightAt(snapshot: WorldSnapshot, x: number, z: number): number {
  const max = snapshot.gridSize - 1;
  const gx = Math.max(0, Math.min(max, (x / snapshot.extent + 0.5) * max));
  const gz = Math.max(0, Math.min(max, (z / snapshot.extent + 0.5) * max));
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const x1 = Math.min(max, x0 + 1);
  const z1 = Math.min(max, z0 + 1);
  const tx = gx - x0;
  const tz = gz - z0;
  const a = snapshot.elevations[z0 * snapshot.gridSize + x0]!;
  const b = snapshot.elevations[z0 * snapshot.gridSize + x1]!;
  const c = snapshot.elevations[z1 * snapshot.gridSize + x0]!;
  const d = snapshot.elevations[z1 * snapshot.gridSize + x1]!;
  const north = a + (b - a) * tx;
  const south = c + (d - c) * tx;
  return north + (south - north) * tz;
}
