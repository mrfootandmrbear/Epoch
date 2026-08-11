import { describe, expect, it } from "vitest";
import { DEFAULT_CLIMATE } from "./climate";
import { createTerrainHistory, geomorphicDuration, resolveTerrainHistory } from "./terrain-history";

function fixedIsland(side = 41): Float32Array {
  const elevations = new Float32Array(side * side);
  const center = (side - 1) / 2;
  for (let z = 0; z < side; z++) {
    for (let x = 0; x < side; x++) {
      const dx = x - center;
      const dz = z - center;
      const radius = Math.hypot(dx * 0.92, dz * 1.08);
      elevations[z * side + x] = 18 - radius * 1.18
        + Math.sin(x * 0.7) * 2.2 + Math.cos(z * 0.43) * 1.4;
    }
  }
  return elevations;
}

function changedCells(before: Float32Array, after: Float32Array, threshold: number): number {
  return before.reduce((count, value, index) => count
    + (value > -5 && Math.abs(value - after[index]!) > threshold ? 1 : 0), 0);
}

function landCells(elevations: Float32Array): number {
  return elevations.reduce((count, elevation) => count + (elevation > 0 ? 1 : 0), 0);
}

describe("epoch-scale terrain milestone", () => {
  it("reserves landscape-scale change for the deep-time jump ladder", () => {
    expect(geomorphicDuration(1).deepTime).toBe(0);
    expect(geomorphicDuration(1_000).deepTime).toBe(0);
    expect(geomorphicDuration(100_000).deepTime).toBeGreaterThan(0.6);
    expect(geomorphicDuration(1_000_000).deepTime).toBe(1);
  });

  it("makes a million-year landing materially different from a one-year landing", () => {
    const initial = fixedIsland();
    const history = createTerrainHistory(initial, 41, 380);
    const oneYear = resolveTerrainHistory(history, 1, DEFAULT_CLIMATE);
    const millionYears = resolveTerrainHistory(history, 1_000_000, DEFAULT_CLIMATE);

    expect(changedCells(initial, oneYear.elevations, 0.5)).toBe(0);
    expect(changedCells(initial, millionYears.elevations, 0.5)).toBeGreaterThan(150);
    expect(landCells(millionYears.elevations)).toBeLessThan(landCells(oneYear.elevations));
  });
});
