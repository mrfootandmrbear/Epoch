import { describe, expect, it } from "vitest";
import {
  intertidalCrabCount,
  marineShoalSamples,
  resolveLanding,
} from "./outcome-resolver";
import { captureWorldSnapshot } from "./world-snapshot";

const lavaShore = {
  rainfall: "temperate" as const,
  temperature: "warm" as const,
  wind: "easterly" as const,
  seaLevel: "present" as const,
};

function splashCone(x: number, z: number): number {
  return 7 - Math.hypot(x, z) * 0.09;
}

function lavaSnapshot(marineNutrients: number) {
  return captureWorldSnapshot(
    splashCone,
    10_000,
    lavaShore,
    96,
    300,
    () => 1,
    () => 0.5,
    () => 0,
    marineNutrients,
    () => 0.9,
  );
}

describe("intertidal crab occupancy", () => {
  it("seats crabs on wet lava, not open water", () => {
    const result = resolveLanding(lavaSnapshot(0.7), { lineages: [] }, 10_000);
    expect(result.outcome.intertidalCrabs.length).toBeGreaterThan(0);
    expect(result.outcome.intertidalCrabs.every((crab) => crab.y >= 0 && crab.y <= 1)).toBe(true);
    expect(result.outcome.intertidalCrabs.every((crab) => splashCone(crab.x, crab.z) >= 0)).toBe(true);
  });

  it("tracks shoreline subsidy in visible count", () => {
    const rich = resolveLanding(lavaSnapshot(0.85), { lineages: [] }, 10_000);
    const poor = resolveLanding(lavaSnapshot(0.05), { lineages: [] }, 10_000);
    expect(rich.outcome.marineEnergy.shorelineSubsidy)
      .toBeGreaterThan(poor.outcome.marineEnergy.shorelineSubsidy);
    expect(rich.outcome.intertidalCrabs.length).toBeGreaterThan(poor.outcome.intertidalCrabs.length);
    expect(rich.outcome.intertidalCrabs.length)
      .toBe(intertidalCrabCount(rich.outcome.marineEnergy.shorelineSubsidy));
  });

  it("keeps fish shoal samples off crab seats", () => {
    const result = resolveLanding(lavaSnapshot(0.7), { lineages: [] }, 10_000);
    const marine = result.outcome.marinePopulations.find((population) => population.visible);
    expect(marine).toBeDefined();
    const shoal = marineShoalSamples(marine!);
    expect(shoal.length).toBeGreaterThan(0);
    expect(result.outcome.intertidalCrabs.length).toBeGreaterThan(0);
    for (const crab of result.outcome.intertidalCrabs) {
      expect(shoal.some((fish) => fish.x === crab.x && fish.z === crab.z)).toBe(false);
      expect(crab.y).toBeGreaterThanOrEqual(0);
    }
    expect(shoal.every((fish) => fish.y < 0)).toBe(true);
  });

  it("clusters occupancy on one splash patch instead of ringing the whole island", () => {
    const result = resolveLanding(lavaSnapshot(0.7), { lineages: [] }, 10_000);
    const crabs = result.outcome.intertidalCrabs;
    expect(crabs.length).toBeGreaterThan(3);
    const span = Math.max(
      ...crabs.map((crab) => Math.max(
        ...crabs.map((other) => Math.hypot(crab.x - other.x, crab.z - other.z)),
      )),
    );
    expect(span).toBeLessThan(12);
  });

  it("does not seat crabs in open water even when subsidy is high", () => {
    const drowned = captureWorldSnapshot(
      () => -12,
      10_000,
      lavaShore,
      48,
      120,
      () => 1,
      () => 0.5,
      () => 0,
      0.9,
      () => 1,
    );
    const result = resolveLanding(drowned, { lineages: [] }, 10_000);
    expect(result.outcome.intertidalCrabs).toEqual([]);
  });
});
