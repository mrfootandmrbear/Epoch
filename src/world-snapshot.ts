import type { ClimateForces } from "./climate";

export interface WorldSnapshot {
  readonly gridSize: number;
  readonly extent: number;
  readonly elevations: Float32Array;
  readonly forage?: Float32Array;
  readonly nutrients?: Float32Array;
  readonly runoff?: Float32Array;
  readonly basalt?: Float32Array;
  readonly substrateAge?: Float32Array;
  readonly sediment?: Float32Array;
  readonly carbonate?: Float32Array;
  readonly marineNutrients?: number;
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
  forageAt: HeightAt = () => 1,
  nutrientsAt: HeightAt = () => 0.5,
  runoffAt: HeightAt = () => 0,
  marineNutrients = 0.2,
  basaltAt: HeightAt = () => 0,
  substrateAgeAt?: HeightAt,
  sedimentAt: HeightAt = () => 0.08,
  carbonateAt: HeightAt = () => 0,
): WorldSnapshot {
  const elevations = new Float32Array(gridSize * gridSize);
  const forage = new Float32Array(gridSize * gridSize);
  const nutrients = new Float32Array(gridSize * gridSize);
  const runoff = new Float32Array(gridSize * gridSize);
  const basalt = new Float32Array(gridSize * gridSize);
  const substrateAge = new Float32Array(gridSize * gridSize);
  const sediment = new Float32Array(gridSize * gridSize);
  const carbonate = new Float32Array(gridSize * gridSize);
  for (let z = 0; z < gridSize; z++) {
    for (let x = 0; x < gridSize; x++) {
      const worldX = (x / (gridSize - 1) - 0.5) * extent;
      const worldZ = (z / (gridSize - 1) - 0.5) * extent;
      elevations[z * gridSize + x] = heightAt(worldX, worldZ);
      forage[z * gridSize + x] = Math.min(1, Math.max(0, forageAt(worldX, worldZ)));
      nutrients[z * gridSize + x] = Math.min(1, Math.max(0, nutrientsAt(worldX, worldZ)));
      runoff[z * gridSize + x] = Math.min(1, Math.max(0, runoffAt(worldX, worldZ)));
      basalt[z * gridSize + x] = Math.min(1, Math.max(0, basaltAt(worldX, worldZ)));
      const inheritedSubstrateAge = substrateAgeAt
        ? substrateAgeAt(worldX, worldZ)
        : Math.min(1, Math.max(0, Math.log10(Math.max(1, totalYears)) / 5));
      substrateAge[z * gridSize + x] = Math.min(1, Math.max(0, inheritedSubstrateAge));
      sediment[z * gridSize + x] = Math.min(1, Math.max(0, sedimentAt(worldX, worldZ)));
      carbonate[z * gridSize + x] = Math.min(1, Math.max(0, carbonateAt(worldX, worldZ)));
    }
  }
  return {
    gridSize,
    extent,
    elevations,
    forage,
    nutrients,
    runoff,
    basalt,
    substrateAge,
    sediment,
    carbonate,
    marineNutrients: Math.min(1, Math.max(0, marineNutrients)),
    climate: Object.freeze({ ...climate }),
    totalYears,
  };
}

function sampleSnapshotField(snapshot: WorldSnapshot, field: Float32Array, x: number, z: number): number {
  const max = snapshot.gridSize - 1;
  const gx = Math.max(0, Math.min(max, (x / snapshot.extent + 0.5) * max));
  const gz = Math.max(0, Math.min(max, (z / snapshot.extent + 0.5) * max));
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const x1 = Math.min(max, x0 + 1);
  const z1 = Math.min(max, z0 + 1);
  const tx = gx - x0;
  const tz = gz - z0;
  const a = field[z0 * snapshot.gridSize + x0]!;
  const b = field[z0 * snapshot.gridSize + x1]!;
  const c = field[z1 * snapshot.gridSize + x0]!;
  const d = field[z1 * snapshot.gridSize + x1]!;
  const north = a + (b - a) * tx;
  const south = c + (d - c) * tx;
  return north + (south - north) * tz;
}

export function snapshotHeightAt(snapshot: WorldSnapshot, x: number, z: number): number {
  return sampleSnapshotField(snapshot, snapshot.elevations, x, z);
}

export function snapshotForageAt(snapshot: WorldSnapshot, x: number, z: number): number {
  return snapshot.forage ? sampleSnapshotField(snapshot, snapshot.forage, x, z) : 1;
}

export function snapshotNutrientsAt(snapshot: WorldSnapshot, x: number, z: number): number {
  return snapshot.nutrients ? sampleSnapshotField(snapshot, snapshot.nutrients, x, z) : 0.5;
}

export function snapshotRunoffAt(snapshot: WorldSnapshot, x: number, z: number): number {
  return snapshot.runoff ? sampleSnapshotField(snapshot, snapshot.runoff, x, z) : 0;
}

export function snapshotBasaltAt(snapshot: WorldSnapshot, x: number, z: number): number {
  return snapshot.basalt ? sampleSnapshotField(snapshot, snapshot.basalt, x, z) : 0;
}

export function snapshotSubstrateAgeAt(snapshot: WorldSnapshot, x: number, z: number): number {
  return snapshot.substrateAge
    ? sampleSnapshotField(snapshot, snapshot.substrateAge, x, z)
    : Math.min(1, Math.max(0, Math.log10(Math.max(1, snapshot.totalYears)) / 5));
}

export function snapshotSedimentAt(snapshot: WorldSnapshot, x: number, z: number): number {
  return snapshot.sediment ? sampleSnapshotField(snapshot, snapshot.sediment, x, z) : 0.08;
}

export function snapshotCarbonateAt(snapshot: WorldSnapshot, x: number, z: number): number {
  return snapshot.carbonate ? sampleSnapshotField(snapshot, snapshot.carbonate, x, z) : 0;
}
