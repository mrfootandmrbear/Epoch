import { describe, expect, it } from "vitest";
import { createTerrainHistory } from "./terrain-history";
import { resolveVolcanicAccretion, SHIELD_GEOMETRY, type HotSpot } from "./volcanism";
import { resolveTerrainHistory } from "./terrain-history";
import { DEFAULT_CLIMATE } from "./climate";

const activeVent: HotSpot = { id: "central-vent", x: 0, z: 0, output: "active" };

/**
 * Bare seafloor at the world's real scale. The extent is what makes the
 * assertions below mean anything: a shield is 244–272 m across, so a fixture
 * narrower than that would have every cell inside every cone.
 */
function seafloor(side = 61) {
  return { side, terrain: createTerrainHistory(new Float32Array(side * side).fill(-40), side, 800) };
}

describe("volcanic accretion", () => {
  it("builds a deterministic submarine shield toward breach", () => {
    const { side, terrain } = seafloor();
    const first = resolveVolcanicAccretion(terrain, [activeVent], 1_000);
    const second = resolveVolcanicAccretion(terrain, [activeVent], 1_000);
    const center = Math.floor(side / 2) * side + Math.floor(side / 2);
    expect(first.elevations[center]).toBeGreaterThan(0);
    expect(first.basalt[center]).toBeGreaterThan(0.8);
    expect(first.elevations).toEqual(second.elevations);
    expect(first.basalt).toEqual(second.basalt);
  });

  it("leaves terrain unchanged without a vent or with an extinct vent", () => {
    const { terrain } = seafloor();
    expect(resolveVolcanicAccretion(terrain, [], 1_000)).toBe(terrain);
    const extinct = resolveVolcanicAccretion(terrain, [{ ...activeVent, output: "extinct" }], 1_000);
    expect(extinct.elevations).toEqual(terrain.elevations);
  });

  it("keeps waning activity local to a late cone", () => {
    const { side, terrain } = seafloor();
    const waning = resolveVolcanicAccretion(terrain, [{ ...activeVent, output: "waning" }], 1_000);
    const center = Math.floor(side / 2) * side + Math.floor(side / 2);
    // Beyond the waning cone's own radius: a late vent must not resurface
    // ground a full shield-building vent would have reached.
    const step = terrain.extent / (terrain.side - 1);
    const shoulder = center + Math.ceil((SHIELD_GEOMETRY.waning.radius * 1.2) / step);
    expect(shoulder % side).toBeGreaterThan(Math.floor(side / 2));
    expect(waning.elevations[center]).toBeGreaterThan(terrain.elevations[center]!);
    expect(waning.elevations[shoulder]).toBe(terrain.elevations[shoulder]);
  });

  it("continues load-driven subsidence after the vent becomes extinct", () => {
    const { side, terrain } = seafloor();
    const built = resolveVolcanicAccretion(terrain, [activeVent], 1_000);
    const center = Math.floor(side / 2) * side + Math.floor(side / 2);
    const drowned = resolveTerrainHistory(built, 1_000_000, DEFAULT_CLIMATE);
    expect(drowned.elevations[center]).toBeLessThan(built.elevations[center]! - 2);
    expect(drowned.volcanicLoad[center]).toBeGreaterThan(0.69);
  });

  it("keeps an active capped edifice fresh while an extinct one weathers", () => {
    const { side, terrain } = seafloor();
    const center = Math.floor(side / 2) * side + Math.floor(side / 2);
    const capped = resolveVolcanicAccretion(terrain, [activeVent], 1_000);
    const weathered = resolveTerrainHistory(capped, 100_000, DEFAULT_CLIMATE);
    const activeAgain = resolveVolcanicAccretion(weathered, [activeVent], 1_000);
    const extinctAgain = resolveVolcanicAccretion(weathered, [{ ...activeVent, output: "extinct" }], 1_000);
    expect(activeAgain.basalt[center]).toBeGreaterThan(weathered.basalt[center]!);
    expect(activeAgain.basalt[center]).toBeGreaterThan(0.42);
    expect(extinctAgain.basalt[center]).toBe(weathered.basalt[center]);
    expect(activeAgain.nutrients[center]).toBeLessThan(weathered.nutrients[center]!);
  });

  it("accumulates load from constructed mass and elapsed output", () => {
    const { side, terrain } = seafloor();
    const center = Math.floor(side / 2) * side + Math.floor(side / 2);
    const oneYear = resolveVolcanicAccretion(terrain, [activeVent], 1);
    const thousandYears = resolveVolcanicAccretion(terrain, [activeVent], 1_000);
    expect(oneYear.volcanicLoad[center]).toBeGreaterThan(0);
    expect(oneYear.volcanicLoad[center]).toBeLessThan(thousandYears.volcanicLoad[center]!);
    expect(thousandYears.volcanicLoad[center]).toBeLessThanOrEqual(1);
  });

  it("does not create unevolving deposits on the grid boundary", () => {
    const { side, terrain } = seafloor();
    const result = resolveVolcanicAccretion(terrain, [{ ...activeVent, x: -90, z: -90 }], 1_000);
    for (let index = 0; index < side; index++) {
      expect(result.basalt[index]).toBe(0);
      expect(result.basalt[(side - 1) * side + index]).toBe(0);
      expect(result.basalt[index * side]).toBe(0);
      expect(result.basalt[index * side + side - 1]).toBe(0);
    }
  });

  it("routes deterministic fresh flows away from an active vent", () => {
    const { side, terrain } = seafloor();
    const result = resolveVolcanicAccretion(terrain, [activeVent], 1_000);
    const center = Math.floor(side / 2) * side + Math.floor(side / 2);
    const freshCells = result.basalt.reduce((count, value, index) => count
      + (value > 0.57 && Math.abs(index - center) > side * 2 ? 1 : 0), 0);
    expect(freshCells).toBeGreaterThan(8);
    expect(result.basalt).toEqual(resolveVolcanicAccretion(terrain, [activeVent], 1_000).basalt);
  });

  it("never lowers tall terrain and records routed mass as load", () => {
    const { side, terrain } = seafloor();
    const center = Math.floor(side / 2) * side + Math.floor(side / 2);
    for (let index = center - side * 3; index <= center + side * 3; index += side) {
      terrain.elevations[index] = 70 - Math.abs(index - center) / side;
    }
    const result = resolveVolcanicAccretion(terrain, [{ ...activeVent, output: "vigorous" }], 1_000);
    for (let index = center - side * 3; index <= center + side * 3; index += side) {
      expect(result.elevations[index]).toBeGreaterThanOrEqual(terrain.elevations[index]!);
    }
    expect(result.volcanicLoad.some((value, index) => value > 0 && result.basalt[index]! > 0.57)).toBe(true);
  });

  it("resolves a constructed island into a lower, smaller extinct remnant", () => {
    const { terrain } = seafloor();
    const built = resolveTerrainHistory(
      resolveVolcanicAccretion(terrain, [{ ...activeVent, output: "vigorous" }], 1_000),
      1_000,
      DEFAULT_CLIMATE,
    );
    const declined = resolveTerrainHistory(built, 1_000_000, DEFAULT_CLIMATE);
    const builtPeak = Math.max(...built.elevations);
    const declinedPeak = Math.max(...declined.elevations);
    const builtLand = built.elevations.reduce((count, elevation) => count + (elevation > 0 ? 1 : 0), 0);
    const declinedLand = declined.elevations.reduce((count, elevation) => count + (elevation > 0 ? 1 : 0), 0);
    expect(builtPeak).toBeGreaterThan(25);
    expect(declinedPeak).toBeLessThan(builtPeak - 2);
    expect(declinedLand).toBeLessThan(builtLand);
  });
});
