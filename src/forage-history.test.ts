import { describe, expect, it } from "vitest";
import { DEFAULT_CLIMATE } from "./climate";
import { createTerrainHistory, resolveTerrainHistory, withGrazingPressure } from "./terrain-history";

function centerIndex(side: number): number {
  const center = Math.floor(side / 2);
  return center * side + center;
}

describe("persistent forage history", () => {
  it("depletes forage locally around abundant grazers", () => {
    const history = createTerrainHistory(new Float32Array(25), 5, 100);
    const next = withGrazingPressure(history, [{ site: { x: 0, z: 0 }, abundance: 0.9 }], 1_000_000);

    expect(next.forage[centerIndex(5)]).toBeLessThan(history.forage[centerIndex(5)]!);
    expect(next.forage[0]).toBe(history.forage[0]);
    expect(history.forage[centerIndex(5)]).toBeCloseTo(0.62);
  });

  it("regrows depleted forage toward climate-limited potential", () => {
    const history = createTerrainHistory(new Float32Array(25), 5, 100);
    const depleted = history.forage.slice();
    depleted[centerIndex(5)] = 0.05;
    const next = resolveTerrainHistory({ ...history, forage: depleted }, 1_000_000, DEFAULT_CLIMATE);

    expect(next.forage[centerIndex(5)]).toBeGreaterThan(0.05);
    expect(next.forage[centerIndex(5)]).toBeLessThanOrEqual(1);
  });
});
