import { describe, expect, it } from "vitest";
import { DEFAULT_CLIMATE } from "./climate";
import { createTerrainHistory, resolveTerrainHistory } from "./terrain-history";
import { resolveVolcanicAccretion, type HotSpot } from "./volcanism";

const SIDE = 9;
const CENTER = 4 * SIDE + 4;
const VENT: HotSpot = { id: "chronosequence-vent", x: 0, z: 0, output: "active" };

function freshFlow() {
  return resolveVolcanicAccretion(
    createTerrainHistory(new Float32Array(SIDE * SIDE).fill(3), SIDE, 180),
    [VENT],
    1_000,
  );
}

describe("volcanic surface chronosequence", () => {
  it("turns extinct fresh rock into older soil-bearing ground", () => {
    const fresh = freshFlow();
    const century = resolveTerrainHistory(fresh, 100, { ...DEFAULT_CLIMATE, rainfall: "wet" });
    const millennium = resolveTerrainHistory(fresh, 1_000, { ...DEFAULT_CLIMATE, rainfall: "wet" });
    expect(fresh.surfaceAgeYears[CENTER]).toBeLessThan(1);
    expect(century.surfaceAgeYears[CENTER]).toBe(100);
    expect(millennium.surfaceAgeYears[CENTER]).toBe(1_000);
    expect(millennium.basalt[CENTER]).toBeLessThan(century.basalt[CENTER]!);
    expect(millennium.soilDevelopment[CENTER]).toBeGreaterThan(century.soilDevelopment[CENTER]!);
    expect(millennium.forage[CENTER]).toBeGreaterThan(century.forage[CENTER]!);
  });

  it("recovers wet lava substantially faster than arid lava", () => {
    const fresh = freshFlow();
    const wet = resolveTerrainHistory(fresh, 1_000, { ...DEFAULT_CLIMATE, rainfall: "wet" });
    const arid = resolveTerrainHistory(fresh, 1_000, { ...DEFAULT_CLIMATE, rainfall: "arid" });
    expect(wet.basalt[CENTER]).toBeLessThan(arid.basalt[CENTER]!);
    expect(wet.soilDevelopment[CENTER]).toBeGreaterThan(arid.soilDevelopment[CENTER]!);
    expect(wet.forage[CENTER]).toBeGreaterThan(arid.forage[CENTER]!);
  });
});
