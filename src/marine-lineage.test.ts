import { describe, expect, it } from "vitest";
import type { ClimateForces } from "./climate";
import { createMarineLineageHistory, resolveMarineLineages } from "./marine-lineage";
import { captureWorldSnapshot } from "./world-snapshot";

const mild: ClimateForces = { rainfall: "temperate", temperature: "mild", wind: "calm", seaLevel: "present" };
const island = (x: number, z: number): number => 20 - Math.hypot(x, z) * 0.2;

describe("persistent marine lineage", () => {
  it("persists identity, site, traits, energy, and abundance across jumps", () => {
    const first = resolveMarineLineages(
      captureWorldSnapshot(island, 1_000, mild), createMarineLineageHistory(), 1_000,
    );
    const second = resolveMarineLineages(
      captureWorldSnapshot(island, 2_000, mild), first.history, 1_000,
    );
    const lineage = second.history.lineages[0]!;
    expect(lineage.id).toBe("coastal-forager:0");
    expect(lineage.status).toBe("active");
    expect(lineage.site).toBeDefined();
    expect(lineage.traits?.propulsionPlan).toBe("tail");
    expect(lineage.energy).toBeGreaterThan(0);
    expect(lineage.abundance).toBeGreaterThan(0);
  });

  it("moves and adapts after sea level and temperature change", () => {
    const cold: ClimateForces = { ...mild, temperature: "cold" };
    const first = resolveMarineLineages(
      captureWorldSnapshot(island, 1_000, cold), createMarineLineageHistory(), 1_000,
    );
    const changed: ClimateForces = { ...mild, temperature: "warm", seaLevel: "high" };
    const second = resolveMarineLineages(
      captureWorldSnapshot(island, 11_000, changed), first.history, 10_000,
    );
    const before = first.history.lineages[0]!;
    const after = second.history.lineages[0]!;
    expect(second.changes[0]!.moved).toBeGreaterThan(1);
    expect(after.traits!.thermalTolerance).toBeGreaterThan(before.traits!.thermalTolerance);
    expect(after.site).not.toEqual(before.site);
  });

  it("goes extinct when no marine food habitat remains", () => {
    const established = resolveMarineLineages(
      captureWorldSnapshot(island, 1_000, mild), createMarineLineageHistory(), 1_000,
    );
    const dryWorld = captureWorldSnapshot(() => 20, 1_001_000, mild);
    const starved = resolveMarineLineages(dryWorld, established.history, 1_000_000);
    expect(starved.history.lineages[0]!.status).toBe("extinct");
    expect(starved.outcomes[0]!.visible).toBe(false);
    expect(starved.changes[0]!.event).toBe("extinct");
  });

  it("replays identical semantic state for identical inputs", () => {
    const run = () => resolveMarineLineages(
      captureWorldSnapshot(island, 10_000, mild), createMarineLineageHistory(), 10_000,
    );
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});
