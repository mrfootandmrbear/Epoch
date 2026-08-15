import { describe, expect, it } from "vitest";
import {
  advanceArchipelago,
  resolveShieldVents,
  type ArchipelagoHistory,
} from "./archipelago-history";
import { SEA_LEVEL, type ClimateForces } from "./climate";
import { resolveIslandGeography, saddleBetween } from "./island-geography";
import { RENDER_SCALE } from "./render-scale";
import { startingWorldPreset } from "./starting-world-presets";
import { resolveTerrainHistory, type TerrainHistory } from "./terrain-history";
import { createWorldHistory } from "./world-history";
import { PLUME_VIGOR, resolveVolcanicAccretion, type PlumeVigor } from "./volcanism";

/**
 * The multi-shield accretion seam, exercised through the shipping jump pipeline.
 *
 * This file exists because nothing else covered it. `determinism.test.ts` calls
 * `resolveLanding` on a synthetic heightfield and never touches `WorldHistory`,
 * accretion or the archipelago, so it passed unchanged through the entire change
 * that made the shield chain build terrain — the same blind spot the 2 km resize
 * hit on the scale axis, one axis over. Assertions here are deliberately about
 * *behaviour the player can see* (does a second island appear, does a land
 * bridge form and then erode) rather than exact elevations, so they survive
 * retuning without going quiet.
 */

// Coarser than the shipping 401² so a four-jump sequence stays fast; it is the
// *extent* that has to be honest, not the cell size.
const SIDE = 201;
const EXTENT = RENDER_SCALE.islandExtent;
const JUMP_YEARS = 1_000_000;

const CLIMATE: ClimateForces = {
  rainfall: "wet",
  temperature: "warm",
  wind: "easterly",
  seaLevel: "present",
};
const SEA = SEA_LEVEL[CLIMATE.seaLevel];

function youngVolcanoWorld(vigor: PlumeVigor) {
  const preset = startingWorldPreset("young-volcano");
  const elevations = new Float32Array(SIDE * SIDE);
  const step = EXTENT / (SIDE - 1);
  const half = EXTENT / 2;
  for (let z = 0; z < SIDE; z++) {
    for (let x = 0; x < SIDE; x++) {
      elevations[z * SIDE + x] = preset.heightAt(x * step - half, z * step - half);
    }
  }
  return createWorldHistory(elevations, SIDE, EXTENT, false, { ...preset.plume!, vigor });
}

/** One jump of the shipping pipeline: advance the chain, then accrete from it. */
function jump(
  terrain: TerrainHistory,
  archipelago: ArchipelagoHistory,
  totalYearsBefore: number,
): { terrain: TerrainHistory; archipelago: ArchipelagoHistory } {
  const advanced = advanceArchipelago(archipelago, JUMP_YEARS, totalYearsBefore);
  return {
    archipelago: advanced,
    terrain: resolveVolcanicAccretion(
      resolveTerrainHistory(terrain, JUMP_YEARS, CLIMATE),
      resolveShieldVents(advanced, archipelago),
      JUMP_YEARS,
      advanced.plume,
    ),
  };
}

function run(vigor: PlumeVigor, jumps: number) {
  const world = youngVolcanoWorld(vigor);
  let state = { terrain: world.terrain, archipelago: world.archipelago };
  const frames = [state];
  for (let index = 0; index < jumps; index++) {
    state = jump(state.terrain, state.archipelago, index * JUMP_YEARS);
    frames.push(state);
  }
  return frames.map((frame) => ({
    ...frame,
    geography: resolveIslandGeography(
      { side: SIDE, extent: EXTENT, elevations: frame.terrain.elevations },
      SEA,
      frame.archipelago.shields,
    ),
  }));
}

describe("multi-shield accretion", () => {
  it("builds land at shields the authored vent never reached", () => {
    const frames = run("active", 3);
    // The defect this seam fixes: before accretion was pointed at the shield
    // record, shield-0 was the only land in the world at every jump.
    const later = frames.at(-1)!;
    const shieldsOnLand = [...later.geography.islandOfShield.entries()]
      .filter(([, island]) => island !== null)
      .map(([id]) => id);
    expect(shieldsOnLand.length).toBeGreaterThan(1);
    expect(shieldsOnLand).toContain("shield-1");
  });

  it("raises a shield-pair saddle out of the sea and then erodes it", () => {
    const frames = run("active", 4);
    const saddleAt = (index: number) =>
      saddleBetween(frames[index]!.geography, "shield-0", "shield-1")?.elevation ?? null;

    // Newborn: the two vents are separated by open water, so the col between
    // them is seafloor and they are two habitats.
    expect(saddleAt(1)).toBeLessThan(SEA);
    // Built out: the skirts meet and the pair shares one island.
    const joined = saddleAt(2);
    expect(joined).not.toBeNull();
    expect(joined!).toBeGreaterThan(SEA);
    expect(
      frames[2]!.geography.islands.some((island) =>
        island.shieldIds.includes("shield-0") && island.shieldIds.includes("shield-1")),
    ).toBe(true);
    // And then weathering lowers the bridge — which is what dates a lost
    // connection, and therefore what gene flow will key to.
    expect(saddleAt(3)!).toBeLessThan(joined!);
    expect(saddleAt(4)!).toBeLessThan(saddleAt(3)!);
  });

  it("leaves the starting island alone rather than re-growing it", () => {
    // Shield zero is seeded at construction 1 because the preset already drew
    // its edifice. A jump must not inflate land the player can already see.
    const frames = run("active", 1);
    expect(frames[1]!.geography.islands[0]!.summitElevation)
      .toBeLessThanOrEqual(frames[0]!.geography.islands[0]!.summitElevation + 1);
  });

  it("freezes the chain under a dormant plume while the crust keeps drifting", () => {
    const frames = run("dormant", 3);
    const last = frames.at(-1)!;
    expect(last.archipelago.shields).toHaveLength(1);
    expect(last.archipelago.crustOffset).toBeGreaterThan(0);
    expect(last.geography.islands.every((island) => !island.shieldIds.includes("shield-1"))).toBe(true);
    // Erosion still runs, so the one island shrinks rather than standing still.
    expect(last.geography.totalLandAreaSquareMetres)
      .toBeLessThan(frames[0]!.geography.totalLandAreaSquareMetres);
  });

  it("builds a larger chain under a hyperactive plume than an active one", () => {
    const active = run("active", 3).at(-1)!;
    const hyperactive = run("hyperactive", 3).at(-1)!;
    expect(hyperactive.geography.totalLandAreaSquareMetres)
      .toBeGreaterThan(active.geography.totalLandAreaSquareMetres);
    // Same flank grammar at a bigger size: ejecta scales radius and cap
    // together, so a hyperactive plume must not produce a steeper island.
    expect(PLUME_VIGOR.hyperactive.ejecta).toBeGreaterThan(PLUME_VIGOR.active.ejecta);
  });

  it("treats an active plume as exactly the accepted Galapagos calibration", () => {
    // The owner accepted the 2 km scale against these constants on 2026-08-15;
    // `active` must be identity on both axes or that verdict silently moves.
    expect(PLUME_VIGOR.active).toEqual({ ejecta: 1, frequency: 1 });
  });
});

describe("resolveShieldVents", () => {
  it("erupts a vent at the strongest stage it held during the jump", () => {
    const world = youngVolcanoWorld("active");
    const before = world.archipelago;
    const after = advanceArchipelago(before, JUMP_YEARS, 0);
    // shield-0 begins over the plume and is carried off it within one jump.
    // Sampling only the landing would charge it the slow waning rate for a
    // million years it spent building.
    const landingOnly = resolveShieldVents(after);
    const acrossJump = resolveShieldVents(after, before);
    const outputOf = (vents: readonly { id: string; output: string }[], id: string) =>
      vents.find((vent) => vent.id === id)!.output;
    expect(outputOf(landingOnly, "shield-0")).toBe("waning");
    expect(outputOf(acrossJump, "shield-0")).toBe("active");
  });

  it("carries each shield's construction through as the size of its edifice", () => {
    const world = youngVolcanoWorld("active");
    const after = advanceArchipelago(world.archipelago, JUMP_YEARS, 0);
    for (const vent of resolveShieldVents(after, world.archipelago)) {
      const shield = after.shields.find((candidate) => candidate.id === vent.id)!;
      expect(vent.construction).toBe(shield.construction);
      expect(vent.x).toBe(shield.crustX);
      expect(vent.z).toBe(shield.crustZ);
    }
  });

  it("returns no vents at all while the plume is dormant", () => {
    const world = youngVolcanoWorld("dormant");
    const after = advanceArchipelago(world.archipelago, JUMP_YEARS, 0);
    expect(resolveShieldVents(after, world.archipelago)).toHaveLength(0);
  });
});
