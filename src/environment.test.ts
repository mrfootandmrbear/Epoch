import { describe, expect, it } from "vitest";
import { DEFAULT_CLIMATE, type ClimateForces } from "./climate";
import {
  FOUNDATIONAL_CLIMATE_IDENTITIES,
  foundationalClimateIdentity,
  resolveEnvironmentField,
} from "./environment";
import { createTerrainHistory, resolveTerrainHistory, withReefDeposition } from "./terrain-history";
import { createInitialWorldState } from "./world-history";
import { resolveVolcanicAccretion } from "./volcanism";
import { ENVIRONMENT_FIXTURES } from "./environment-fixtures";

function terrain(side = 7, elevation: (x: number, z: number) => number = () => 4) {
  const elevations = new Float32Array(side * side);
  for (let z = 0; z < side; z++) for (let x = 0; x < side; x++) {
    elevations[z * side + x] = elevation(x, z);
  }
  return createTerrainHistory(elevations, side, 60);
}

function climate(overrides: Partial<ClimateForces>): ClimateForces {
  return { ...DEFAULT_CLIMATE, ...overrides };
}

describe("environment foundations", () => {
  it("keeps the representative set bounded and seats the reef vent beside its review shelf", () => {
    expect(Object.keys(ENVIRONMENT_FIXTURES)).toHaveLength(6);
    const reef = ENVIRONMENT_FIXTURES["mature-warm-reef"];
    const distanceToReviewShelf = Math.hypot(reef.hotSpot.x - 104, reef.hotSpot.z - 116);
    expect(distanceToReviewShelf).toBeGreaterThan(55);
    expect(distanceToReviewShelf).toBeLessThan(70);

    const side = 65;
    const extent = 320;
    const geological = createTerrainHistory(new Float32Array(side * side).fill(-5), side, extent);
    const volcanic = resolveVolcanicAccretion(
      geological,
      [{ id: "fixture-vent", ...reef.hotSpot, output: reef.volcano }],
      reef.years,
    );
    const combined = withReefDeposition(
      volcanic,
      [{ x: 104, z: 116, framework: 0.9, deadFramework: 0.25, cover: 0.7 }],
      reef.years,
    );
    const step = extent / (side - 1);
    const half = extent / 2;
    let visibleBasalt = false;
    let visibleCarbonate = false;
    for (let z = 0; z < side; z++) for (let x = 0; x < side; x++) {
      const worldX = x * step - half;
      const worldZ = z * step - half;
      if (Math.hypot(worldX - 104, worldZ - 116) > 55) continue;
      const index = z * side + x;
      visibleBasalt ||= combined.basalt[index]! > 0.25;
      visibleCarbonate ||= combined.carbonate[index]! > 0.05;
    }
    expect(visibleBasalt).toBe(true);
    expect(visibleCarbonate).toBe(true);
  });

  it("resolves exactly the nine rainfall × temperature identities", () => {
    const resolved = new Set<string>();
    const fields: Array<ReturnType<typeof resolveEnvironmentField>> = [];
    const elevated = terrain(7, () => 18);
    for (const temperature of ["cold", "mild", "warm"] as const) {
      for (const rainfall of ["arid", "temperate", "wet"] as const) {
        const forces = climate({ temperature, rainfall });
        const field = resolveEnvironmentField(elevated, forces);
        fields.push(field);
        resolved.add(foundationalClimateIdentity(forces));
        expect(field.climateIdentity).toBe(`${temperature}-${rainfall}`);
        for (const values of [field.slope, field.exposure, field.moisture, field.drainage, field.waterDepth, field.sediment, field.frost]) {
          expect([...values].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
        }
        expect(field.habitats).toHaveLength(49);
      }
    }
    expect([...resolved].sort()).toEqual([...FOUNDATIONAL_CLIMATE_IDENTITIES].sort());
    expect(resolved.size).toBe(9);
    const mean = (values: Float32Array) => values.reduce((sum, value) => sum + value, 0) / values.length;
    const byIdentity = new Map(fields.map((field) => [field.climateIdentity, field]));
    expect(mean(byIdentity.get("mild-wet")!.moisture)).toBeGreaterThan(mean(byIdentity.get("mild-temperate")!.moisture));
    expect(mean(byIdentity.get("mild-temperate")!.moisture)).toBeGreaterThan(mean(byIdentity.get("mild-arid")!.moisture));
    expect(mean(byIdentity.get("cold-temperate")!.frost)).toBeGreaterThan(mean(byIdentity.get("mild-temperate")!.frost));
    expect(mean(byIdentity.get("mild-temperate")!.frost)).toBeGreaterThan(mean(byIdentity.get("warm-temperate")!.frost));
  });

  it("resolves wetter foundations as wetter local ground", () => {
    const base = terrain();
    const arid = resolveEnvironmentField(base, climate({ rainfall: "arid" }));
    const wet = resolveEnvironmentField(base, climate({ rainfall: "wet" }));
    expect(wet.moisture[24]).toBeGreaterThan(arid.moisture[24]! + 0.3);
  });

  it("distinguishes calm exposure and mirrors east/west windward slopes", () => {
    const ridge = terrain(7, (x) => x * 2);
    const calm = resolveEnvironmentField(ridge, climate({ wind: "calm" }));
    const west = resolveEnvironmentField(ridge, climate({ wind: "westerly" }));
    const east = resolveEnvironmentField(ridge, climate({ wind: "easterly" }));
    const center = 3 * 7 + 3;
    expect(west.exposure[center]).toBeGreaterThan(calm.exposure[center]!);
    expect(west.moisture[center]).toBeGreaterThan(east.moisture[center]!);

    const mirrored = terrain(7, (x) => (6 - x) * 2);
    const mirroredEast = resolveEnvironmentField(mirrored, climate({ wind: "easterly" }));
    expect(mirroredEast.moisture[center]).toBeCloseTo(west.moisture[center]!, 5);
  });

  it("changes habitat spatially across low, present, and high sea levels", () => {
    const shelf = terrain(7, (x) => x - 2);
    const low = resolveEnvironmentField(shelf, climate({ seaLevel: "low" }));
    const present = resolveEnvironmentField(shelf, climate({ seaLevel: "present" }));
    const high = resolveEnvironmentField(shelf, climate({ seaLevel: "high" }));
    const shallowCells = (field: ReturnType<typeof resolveEnvironmentField>) =>
      field.habitats.filter((habitat) => habitat === "shallow-shelf" || habitat === "reef-shelf").length;
    expect(shallowCells(low)).toBeLessThan(shallowCells(present));
    expect(shallowCells(high)).toBeGreaterThan(shallowCells(present));
  });
});

describe("environment history", () => {
  it("constructs a geological world before the first jump", () => {
    const elevations = new Float32Array(25).fill(3);
    const initial = createInitialWorldState(elevations, 5, 40);
    expect(initial.totalYears).toBe(0);
    expect(initial.history.terrain.substrateAge.every((age) => Math.abs(age - 0.58) < 1e-6)).toBe(true);
    expect(initial.history.terrain.runoff.every((flow) => flow === 0)).toBe(true);
    expect(initial.history.reef.sites).toHaveLength(0);

    const jumped = resolveTerrainHistory(initial.history.terrain, 1_000, climate({ rainfall: "wet" }));
    expect(jumped.runoff.some((flow) => flow > 0)).toBe(true);
    expect(jumped.substrateAge[12]).toBeGreaterThan(initial.history.terrain.substrateAge[12]!);
  });

  it("lets mature reefs accumulate carbonate while fresh basalt suppresses it", () => {
    const base = terrain(9, () => -5);
    const site = [{ x: 0, z: 0, framework: 0.9, deadFramework: 0.3, cover: 0.7 }];
    const mature = withReefDeposition(base, site, 100_000);
    const center = 4 * 9 + 4;
    expect(mature.carbonate[center]).toBeGreaterThan(0.05);

    const basalt = base.basalt.slice();
    basalt[center] = 1;
    const fresh = withReefDeposition({ ...base, basalt }, site, 100_000);
    expect(fresh.carbonate[center]).toBe(0);
  });

  it("lets volcanic resurfacing erase local carbonate without erasing the remote shelf", () => {
    const base = terrain(17, () => -5);
    const carbonate = new Float32Array(base.carbonate.length).fill(0.72);
    const substrateAge = new Float32Array(base.substrateAge.length).fill(0.9);
    const seeded = { ...base, carbonate, substrateAge };
    const resurfaced = resolveVolcanicAccretion(
      seeded,
      [{ id: "review-vent", x: 0, z: 0, output: "active" }],
      1_000,
    );
    const center = 8 * 17 + 8;
    const remote = 0;
    expect(resurfaced.basalt[center]).toBeGreaterThan(0.2);
    expect(resurfaced.carbonate[center]).toBeLessThan(0.2);
    expect(resurfaced.substrateAge[center]).toBeLessThan(0.4);
    expect(resurfaced.carbonate[remote]).toBeCloseTo(0.72, 5);
    expect(resurfaced.substrateAge[remote]).toBeCloseTo(0.9, 5);
  });
});
