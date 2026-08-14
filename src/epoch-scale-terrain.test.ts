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

function totalElevationChange(before: Float32Array, after: Float32Array): number {
  return after.reduce((sum, elevation, index) => sum + Math.abs(elevation - before[index]!), 0);
}

function maximumRunoff(history: ReturnType<typeof createTerrainHistory>): number {
  return Math.max(...history.runoff);
}

function valleyIsland(side = 41): Float32Array {
  const elevations = new Float32Array(side * side);
  const center = (side - 1) / 2;
  for (let z = 0; z < side; z++) {
    for (let x = 0; x < side; x++) {
      const downstreamSlope = (side - 1 - z) * 0.34;
      const valleyWall = Math.abs(x - center) * 0.48;
      elevations[z * side + x] = -2 + downstreamSlope + valleyWall;
    }
  }
  return elevations;
}

describe("epoch-scale terrain milestone", () => {
  it("reserves landscape-scale change for the deep-time jump ladder", () => {
    expect(geomorphicDuration(1).deepTime).toBe(0);
    expect(geomorphicDuration(1_000).deepTime).toBe(0);
    expect(geomorphicDuration(100_000).deepTime).toBeGreaterThan(0.4);
    expect(geomorphicDuration(100_000).deepTime).toBeLessThan(0.5);
    expect(geomorphicDuration(1_000_000).deepTime).toBe(1);
  });

  it("gives every canonical rung a stronger automatic terrain response", () => {
    const initial = fixedIsland();
    const history = createTerrainHistory(initial, 41, 380);
    const oneYear = resolveTerrainHistory(history, 1, DEFAULT_CLIMATE);
    const thousandYears = resolveTerrainHistory(history, 1_000, DEFAULT_CLIMATE);
    const hundredThousandYears = resolveTerrainHistory(history, 100_000, DEFAULT_CLIMATE);
    const millionYears = resolveTerrainHistory(history, 1_000_000, DEFAULT_CLIMATE);

    // The first rung earns its reveal through fresh drainage even though a
    // single rainy year must not remodel the island wholesale.
    expect(maximumRunoff(oneYear)).toBeGreaterThan(0.1);
    expect(changedCells(initial, oneYear.elevations, 0.5)).toBe(0);
    expect(totalElevationChange(initial, thousandYears.elevations))
      .toBeGreaterThan(totalElevationChange(initial, oneYear.elevations) * 2);
    expect(totalElevationChange(initial, hundredThousandYears.elevations))
      .toBeGreaterThan(totalElevationChange(initial, thousandYears.elevations) * 2);
    expect(totalElevationChange(initial, millionYears.elevations))
      .toBeGreaterThan(totalElevationChange(initial, hundredThousandYears.elevations) * 1.2);
    expect(changedCells(initial, millionYears.elevations, 0.5)).toBeGreaterThan(150);
    expect(landCells(millionYears.elevations)).toBeLessThan(landCells(oneYear.elevations));
  });

  it("keeps the final deep-time rung stronger than the 100k landing", () => {
    const initial = fixedIsland();
    const history = createTerrainHistory(initial, 41, 380);
    const hundredThousand = resolveTerrainHistory(history, 100_000, DEFAULT_CLIMATE);
    const million = resolveTerrainHistory(history, 1_000_000, DEFAULT_CLIMATE);
    expect(totalElevationChange(initial, million.elevations))
      .toBeGreaterThan(totalElevationChange(initial, hundredThousand.elevations) * 1.2);
    expect(landCells(million.elevations)).toBeLessThan(landCells(hundredThousand.elevations));
  });

  it("keeps recording history across successive deep-time clicks", () => {
    const initial = fixedIsland();
    const first = resolveTerrainHistory(
      createTerrainHistory(initial, 41, 380),
      100_000,
      DEFAULT_CLIMATE,
    );
    const second = resolveTerrainHistory(first, 100_000, DEFAULT_CLIMATE);
    const third = resolveTerrainHistory(second, 100_000, DEFAULT_CLIMATE);

    const firstChange = totalElevationChange(initial, first.elevations);
    const secondChange = totalElevationChange(initial, second.elevations);
    const thirdChange = totalElevationChange(initial, third.elevations);
    expect(secondChange).toBeGreaterThan(firstChange * 1.35);
    expect(thirdChange).toBeGreaterThan(secondChange * 1.15);
    expect(landCells(third.elevations)).toBeLessThan(landCells(first.elevations));
  });

  it("lets wet climates carve more coherent relief than arid climates", () => {
    const initial = fixedIsland();
    const history = createTerrainHistory(initial, 41, 380);
    const wet = resolveTerrainHistory(history, 100_000, { ...DEFAULT_CLIMATE, rainfall: "wet" });
    const arid = resolveTerrainHistory(history, 100_000, { ...DEFAULT_CLIMATE, rainfall: "arid" });

    expect(totalElevationChange(initial, wet.elevations))
      .toBeGreaterThan(totalElevationChange(initial, arid.elevations) * 1.35);
    expect(wet.sediment.reduce((sum, value) => sum + value, 0))
      .toBeGreaterThan(arid.sediment.reduce((sum, value) => sum + value, 0));
  });

  it("concentrates rain-driven incision in a connected valley instead of lowering every slope evenly", () => {
    const side = 41;
    const center = (side - 1) / 2;
    const initial = valleyIsland(side);
    const wet = resolveTerrainHistory(
      createTerrainHistory(initial, side, 380),
      100_000,
      { ...DEFAULT_CLIMATE, rainfall: "wet" },
    );
    let channelLowering = 0;
    let shoulderLowering = 0;
    let samples = 0;
    for (let z = 5; z < side - 5; z++) {
      const channel = z * side + center;
      const shoulder = z * side + center + 7;
      channelLowering += initial[channel]! - wet.elevations[channel]!;
      shoulderLowering += initial[shoulder]! - wet.elevations[shoulder]!;
      samples++;
    }

    expect(channelLowering / samples).toBeGreaterThan(shoulderLowering / samples + 0.2);
  });
});
