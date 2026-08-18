import { DEFAULT_CLIMATE, SEA_LEVEL, type ClimateForces } from "./climate";
import { DEFAULT_FOUNDER_CHOICES } from "./founder-profile";
import { createDrifterFounderHistory } from "./lineage-history";
import { resolveIslandGeography } from "./island-geography";
import { resolveLanding } from "./outcome-resolver";
import { RENDER_SCALE } from "./render-scale";
import {
  DEFAULT_STARTING_WORLD_ID,
  startingVentForPreset,
  startingWorldPreset,
  type StartingWorldPresetId,
} from "./starting-world-presets";
import { applyCoastalForageFloor, resolveTerrainHistory, type TerrainHistory } from "./terrain-history";
import { createWorldHistory, seedStartingPlume, withRecordedSeaLevel } from "./world-history";
import { captureWorldSnapshot } from "./world-snapshot";
import { advanceArchipelago, resolveShieldVents } from "./archipelago-history";
import { isPlumeVigor, resolveVolcanicAccretion, type PlumeVigor } from "./volcanism";

export const PROOF_REPLAY_YEARS = 1_000_000;
export const PROOF_REPLAY_PRESET_ID: StartingWorldPresetId = "weathered-island";

export type TestWorldId = "established" | "speciated" | "diversified";

export interface LandingReplay {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly presetId: StartingWorldPresetId;
  readonly jumps: number;
  readonly years: number;
  readonly climate: ClimateForces;
  /** After reset, drop an active plume at the origin — the pinned proof-URL recipe. */
  readonly placeOriginPlume?: PlumeVigor;
}

const YOUNG_VOLCANO = startingWorldPreset(DEFAULT_STARTING_WORLD_ID);

function proofLanding(
  id: TestWorldId,
  name: string,
  description: string,
  jumps: number,
): LandingReplay {
  return {
    id,
    name,
    description,
    presetId: PROOF_REPLAY_PRESET_ID,
    jumps,
    years: PROOF_REPLAY_YEARS,
    climate: { ...DEFAULT_CLIMATE },
    placeOriginPlume: "active",
  };
}

export const TEST_WORLD_FIXTURES: readonly LandingReplay[] = [
  proofLanding(
    "established",
    "Established — Year 2M",
    "Proof landing: the founder is established on the main island.",
    2,
  ),
  proofLanding(
    "speciated",
    "Speciated — Year 3M",
    "Proof landing: a branch has crossed to a new volcanic island.",
    3,
  ),
  proofLanding(
    "diversified",
    "Diversified — Year 5M",
    "Proof landing: three living populations across the chain.",
    5,
  ),
];

export function testWorldFixture(id: string): LandingReplay | undefined {
  return TEST_WORLD_FIXTURES.find((fixture) => fixture.id === id);
}

/**
 * Map a `?founders=drifter&jumps=` URL onto a replay recipe.
 *
 * No `world=` keeps the accepted proof path: weathered island, origin plume,
 * `DEFAULT_CLIMATE`. `world=young-volcano` uses the player default's land,
 * authored plume, and climate so capture and the Test worlds picker can share
 * a URL later.
 */
export function landingReplayFromQuery(params: URLSearchParams): LandingReplay {
  const years = Number(params.get("years") ?? PROOF_REPLAY_YEARS) || PROOF_REPLAY_YEARS;
  const jumps = Math.max(1, Math.min(16, Number(params.get("jumps") ?? 1)));
  const world = params.get("world");
  if (world === DEFAULT_STARTING_WORLD_ID) {
    return {
      id: "query-volcano",
      name: "Volcano query replay",
      description: "",
      presetId: DEFAULT_STARTING_WORLD_ID,
      jumps,
      years,
      climate: { ...YOUNG_VOLCANO.climate },
    };
  }
  const plume = params.get("plume");
  return {
    id: "query-proof",
    name: "Proof query replay",
    description: "",
    presetId: PROOF_REPLAY_PRESET_ID,
    jumps,
    years,
    climate: { ...DEFAULT_CLIMATE },
    placeOriginPlume: isPlumeVigor(plume) ? plume : "active",
  };
}

export interface LandingReplayJump {
  readonly jump: number;
  readonly totalYears: number;
  readonly living: number;
}

const SIDE = RENDER_SCALE.terrainSegments + 1;
const EXTENT = RENDER_SCALE.islandExtent;
const STEP = EXTENT / (SIDE - 1);
const HALF = EXTENT / 2;

function bilinear(field: Float32Array, x: number, z: number): number {
  const gx = Math.max(0, Math.min(SIDE - 1, (x + HALF) / STEP));
  const gz = Math.max(0, Math.min(SIDE - 1, (z + HALF) / STEP));
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const x1 = Math.min(SIDE - 1, x0 + 1);
  const z1 = Math.min(SIDE - 1, z0 + 1);
  const tx = gx - x0;
  const tz = gz - z0;
  const a = field[z0 * SIDE + x0]!;
  const b = field[z0 * SIDE + x1]!;
  const c = field[z1 * SIDE + x0]!;
  const d = field[z1 * SIDE + x1]!;
  return a + (b - a) * tx + ((c + (d - c) * tx) - (a + (b - a) * tx)) * tz;
}

/**
 * Renderer-independent replay of a landing recipe, sampling the same terrain
 * fields `landing-state` feeds `captureWorldSnapshot`. Used to confirm the
 * Test worlds fixtures still produce living lineages without retuning the
 * resolver.
 */
export function replayLandingHistory(recipe: LandingReplay): LandingReplayJump[] {
  const preset = startingWorldPreset(recipe.presetId);
  const elevations = new Float32Array(SIDE * SIDE);
  for (let z = 0; z < SIDE; z++) {
    for (let x = 0; x < SIDE; x++) {
      elevations[z * SIDE + x] = preset.heightAt(x * STEP - HALF, z * STEP - HALF);
    }
  }
  let history = createWorldHistory(elevations, SIDE, EXTENT, false, startingVentForPreset(preset));
  const heightAt = (x: number, z: number) => bilinear(history.terrain.elevations, x, z);

  if (recipe.placeOriginPlume) {
    const seaLevel0 = SEA_LEVEL[recipe.climate.seaLevel];
    const built = heightAt(0, 0) > seaLevel0;
    history = {
      ...history,
      archipelago: seedStartingPlume({
        x: 0,
        z: 0,
        driftX: 1,
        driftZ: 0,
        vigor: recipe.placeOriginPlume,
        built,
      }),
    };
  }

  const founders = createDrifterFounderHistory(0, 0, DEFAULT_FOUNDER_CHOICES);
  history = {
    ...history,
    lineages: { lineages: [...history.lineages.lineages, ...founders.lineages] },
  };

  const jumps: LandingReplayJump[] = [];
  let totalYears = 0;
  for (let jump = 1; jump <= recipe.jumps; jump++) {
    const before = totalYears;
    totalYears += recipe.years;
    const climate = recipe.climate;
    const seaLevel = SEA_LEVEL[climate.seaLevel];
    const archipelago = advanceArchipelago(history.archipelago, recipe.years, before);
    history = withRecordedSeaLevel(
      {
        ...history,
        terrain: applyCoastalForageFloor(
          resolveVolcanicAccretion(
            resolveTerrainHistory(history.terrain, recipe.years, climate),
            resolveShieldVents(archipelago, history.archipelago),
            recipe.years,
            archipelago.plume,
          ),
          seaLevel,
        ),
        archipelago,
      },
      before,
      recipe.years,
      climate,
    );
    const t: TerrainHistory = history.terrain;
    const snapshot = captureWorldSnapshot(
      heightAt,
      totalYears,
      climate,
      SIDE,
      EXTENT,
      (x, z) => bilinear(t.forage, x, z),
      (x, z) => bilinear(t.nutrients, x, z),
      (x, z) => bilinear(t.runoff, x, z),
      t.marineNutrients,
      (x, z) => bilinear(t.basalt, x, z),
      (x, z) => bilinear(t.substrateAge, x, z),
      (x, z) => bilinear(t.sediment, x, z),
      (x, z) => bilinear(t.carbonate, x, z),
    );
    const geography = resolveIslandGeography(
      { side: SIDE, extent: EXTENT, elevations: history.terrain.elevations },
      seaLevel,
      history.archipelago.shields,
    );
    const resolution = resolveLanding(
      snapshot,
      history.lineages,
      recipe.years,
      history.marineLineages,
      undefined,
      geography,
      history.seaLevelHistory,
    );
    history = {
      ...history,
      lineages: resolution.nextHistory,
      marineLineages: resolution.nextMarineHistory,
    };
    jumps.push({
      jump,
      totalYears,
      living: resolution.nextHistory.lineages.filter((lineage) => lineage.status === "active").length,
    });
  }
  return jumps;
}
