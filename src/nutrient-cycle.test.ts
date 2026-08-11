import { describe, expect, it } from "vitest";
import { DEFAULT_CLIMATE } from "./climate";
import { resolveLanding } from "./outcome-resolver";
import { createTerrainHistory, resolveTerrainHistory } from "./terrain-history";
import { captureWorldSnapshot } from "./world-snapshot";

function slopingIsland(side = 9): Float32Array {
  const elevations = new Float32Array(side * side);
  const center = (side - 1) / 2;
  for (let z = 0; z < side; z++) {
    for (let x = 0; x < side; x++) {
      elevations[z * side + x] = 13 - Math.hypot(x - center, z - center) * 3.1;
    }
  }
  return elevations;
}

describe("persistent nutrient and runoff exchange", () => {
  it("routes wetter jumps into stronger drainage and a retained marine nutrient pool", () => {
    const elevations = slopingIsland();
    const history = createTerrainHistory(elevations, 9, 180);
    const wet = resolveTerrainHistory(history, 100_000, { ...DEFAULT_CLIMATE, rainfall: "wet" });
    const arid = resolveTerrainHistory(history, 100_000, { ...DEFAULT_CLIMATE, rainfall: "arid" });

    expect(Math.max(...wet.runoff)).toBeGreaterThan(Math.max(...arid.runoff));
    expect(wet.marineNutrients).toBeGreaterThan(arid.marineNutrients);
    expect(wet.nutrients.some((value, index) => value < history.nutrients[index]!)).toBe(true);
  });

  it("lets established vegetation retain nutrients against erosion", () => {
    const bare = createTerrainHistory(slopingIsland(), 9, 180);
    const protectedHistory = {
      ...bare,
      vegetationProtection: new Float32Array(bare.elevations.length).fill(0.9),
    };
    const bareNext = resolveTerrainHistory(bare, 100_000, { ...DEFAULT_CLIMATE, rainfall: "wet" });
    const protectedNext = resolveTerrainHistory(protectedHistory, 100_000, { ...DEFAULT_CLIMATE, rainfall: "wet" });
    const center = 4 * 9 + 4;

    expect(protectedNext.nutrients[center]).toBeGreaterThan(bareNext.nutrients[center]!);
  });

  it("carries land-derived nutrients into marine productivity on the next landing", () => {
    const island = (x: number, z: number) => 18 - Math.hypot(x, z) * 0.2;
    const low = captureWorldSnapshot(island, 10_000, DEFAULT_CLIMATE, 96, 300, undefined, undefined, undefined, 0.05);
    const enriched = captureWorldSnapshot(island, 10_000, DEFAULT_CLIMATE, 96, 300, undefined, undefined, undefined, 0.9);

    expect(resolveLanding(enriched, { lineages: [] }, 10_000).outcome.marineEnergy.primaryProductivity)
      .toBeGreaterThan(resolveLanding(low, { lineages: [] }, 10_000).outcome.marineEnergy.primaryProductivity);
  });
});
