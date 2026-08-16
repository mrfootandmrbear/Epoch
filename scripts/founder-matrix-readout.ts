/**
 * WU-A1 evidence script — sweeps all 60 `FounderChoices` (4 food sources ×
 * 3 sizes × 5 origin climates) against three deliberately different island
 * states, through the same `resolveLanding` pipeline a player's click uses
 * (`resolveFounderEstablishment` via `outcome-resolver.ts`'s founder path).
 *
 * This is a sibling to `founding-split-readout.ts`, which that script's own
 * header documents was burned once by `captureWorldSnapshot` silently
 * defaulting forage to a constant 1 when called without sampler functions.
 * This script always passes the real forage/nutrient/runoff/basalt samplers,
 * matching `currentSnapshot()`'s bilinear sampling, so it does not repeat
 * that mistake.
 *
 * Three island states:
 *   - `bare-young-volcanic`  — `young-volcano` preset, founder introduced at
 *     year 0 with no seasoning jump, so the terrain has not yet grown
 *     vegetation.
 *   - `wet-vegetated-highland` — `weathered-island` preset under a wet/mild
 *     climate, seasoned for 300,000 years before the founder lands, so
 *     forage has matured.
 *   - `arid-lowland` — `drowned-ridges` preset (the lowest-relief authored
 *     landform) under an arid/warm climate, seasoned for 200,000 years so
 *     vegetation stays sparse the way an arid climate should leave it.
 *
 * Each cell runs one 1,000,000-year founder jump (matching the sweep that
 * found the original all-60-extinct result) and records intake vs. the 0.4
 * break-even, adaptation reached vs. the founder's starting abundance, and
 * the resulting status.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/founder-matrix-readout.ts
 */

import { resolveVolcanicAccretion, type PlumeVigor } from "../src/volcanism";
import { advanceArchipelago, resolveShieldVents } from "../src/archipelago-history";
import { SEA_LEVEL, type ClimateForces } from "../src/climate";
import { createDrifterFounderHistory, traitAdaptationRate } from "../src/lineage-history";
import {
  FOUNDER_FOOD_SOURCES, FOUNDER_ORIGIN_CLIMATES, FOUNDER_SIZE_BANDS,
  founderEnvironmentFit, founderFoodAffinities, createFounderProfile,
  type FounderChoices,
} from "../src/founder-profile";
import { resolveFounderEstablishment } from "../src/founder-establishment";
import { islandAt, resolveIslandGeography } from "../src/island-geography";
import { RENDER_SCALE } from "../src/render-scale";
import { startingWorldPreset } from "../src/starting-world-presets";
import { resolveTerrainHistory, type TerrainHistory } from "../src/terrain-history";
import { createWorldHistory, seedStartingPlume, withRecordedSeaLevel, type WorldHistory } from "../src/world-history";
import { captureWorldSnapshot } from "../src/world-snapshot";
import { resolveLanding } from "../src/outcome-resolver";

const SIDE = 401;
const EXTENT = RENDER_SCALE.islandExtent;
const step = EXTENT / (SIDE - 1);
const half = EXTENT / 2;
const FOUNDER_JUMP_YEARS = 1_000_000;

function bilinear(field: Float32Array, side: number, x: number, z: number): number {
  const gx = Math.max(0, Math.min(side - 1, (x + half) / step));
  const gz = Math.max(0, Math.min(side - 1, (z + half) / step));
  const x0 = Math.floor(gx), z0 = Math.floor(gz);
  const x1 = Math.min(side - 1, x0 + 1), z1 = Math.min(side - 1, z0 + 1);
  const tx = gx - x0, tz = gz - z0;
  const a = field[z0 * side + x0]!, b = field[z0 * side + x1]!;
  const c = field[z1 * side + x0]!, d = field[z1 * side + x1]!;
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * tz;
}

interface IslandState {
  readonly label: string;
  readonly presetId: "weathered-island" | "young-volcano" | "drowned-ridges";
  readonly climate: ClimateForces;
  readonly seasoningJumps: number;
  readonly seasoningJumpYears: number;
  readonly vigor: PlumeVigor;
}

const ISLAND_STATES: readonly IslandState[] = [
  {
    label: "bare-young-volcanic",
    presetId: "young-volcano",
    climate: { rainfall: "wet", temperature: "warm", wind: "easterly", seaLevel: "present" },
    seasoningJumps: 0,
    seasoningJumpYears: 0,
    vigor: "active",
  },
  {
    label: "wet-vegetated-highland",
    presetId: "weathered-island",
    climate: { rainfall: "wet", temperature: "mild", wind: "westerly", seaLevel: "present" },
    seasoningJumps: 3,
    seasoningJumpYears: 100_000,
    vigor: "active",
  },
  {
    label: "arid-lowland",
    presetId: "drowned-ridges",
    climate: { rainfall: "arid", temperature: "warm", wind: "easterly", seaLevel: "present" },
    seasoningJumps: 2,
    seasoningJumpYears: 100_000,
    vigor: "dormant",
  },
];

function buildIslandHistory(state: IslandState): WorldHistory {
  const preset = startingWorldPreset(state.presetId);
  const elevations = new Float32Array(SIDE * SIDE);
  for (let z = 0; z < SIDE; z++) {
    for (let x = 0; x < SIDE; x++) {
      elevations[z * SIDE + x] = preset.heightAt(x * step - half, z * step - half);
    }
  }
  let history = createWorldHistory(elevations, SIDE, EXTENT, false);
  const heightAt = (x: number, z: number) => bilinear(history.terrain.elevations, SIDE, x, z);
  const seaLevel0 = SEA_LEVEL[state.climate.seaLevel];
  const built = heightAt(0, 0) > seaLevel0;
  history = { ...history, archipelago: seedStartingPlume({ x: 0, z: 0, driftX: 1, driftZ: 0, vigor: state.vigor, built }) };

  let totalYears = 0;
  for (let jump = 0; jump < state.seasoningJumps; jump++) {
    const before = totalYears;
    totalYears += state.seasoningJumpYears;
    const archipelago = advanceArchipelago(history.archipelago, state.seasoningJumpYears, before);
    history = withRecordedSeaLevel(
      {
        ...history,
        terrain: resolveVolcanicAccretion(
          resolveTerrainHistory(history.terrain, state.seasoningJumpYears, state.climate),
          resolveShieldVents(archipelago, history.archipelago),
          state.seasoningJumpYears,
          archipelago.plume,
        ),
        archipelago,
      },
      before,
      state.seasoningJumpYears,
      state.climate,
    );
  }
  return history;
}

interface Cell {
  readonly state: string;
  readonly foodSource: string;
  readonly size: string;
  readonly originClimate: string;
  readonly forage: number;
  readonly moisture: number;
  readonly foodAvailability: number;
  readonly climateFit: number;
  readonly metabolicCost: number;
  readonly intake: number;
  readonly adaptation: number;
  readonly abundanceDelta: number;
  readonly status: string;
}

const cells: Cell[] = [];

for (const state of ISLAND_STATES) {
  const baseHistory = buildIslandHistory(state);
  const totalYearsAtFounding = ISLAND_STATES.find((s) => s === state)!.seasoningJumps * state.seasoningJumpYears;

  for (const foodSource of FOUNDER_FOOD_SOURCES) {
    for (const size of FOUNDER_SIZE_BANDS) {
      for (const originClimate of FOUNDER_ORIGIN_CLIMATES) {
        const choices: FounderChoices = { foodSource, size, originClimate };
        let history: WorldHistory = {
          ...baseHistory,
          lineages: { lineages: [...createDrifterFounderHistory(totalYearsAtFounding, 0, choices).lineages] },
        };

        const before = totalYearsAtFounding;
        const totalYears = before + FOUNDER_JUMP_YEARS;
        const archipelago = advanceArchipelago(history.archipelago, FOUNDER_JUMP_YEARS, before);
        history = withRecordedSeaLevel(
          {
            ...history,
            terrain: resolveVolcanicAccretion(
              resolveTerrainHistory(history.terrain, FOUNDER_JUMP_YEARS, state.climate),
              resolveShieldVents(archipelago, history.archipelago),
              FOUNDER_JUMP_YEARS,
              archipelago.plume,
            ),
            archipelago,
          },
          before,
          FOUNDER_JUMP_YEARS,
          state.climate,
        );

        const t: TerrainHistory = history.terrain;
        const heightAt = (x: number, z: number) => bilinear(history.terrain.elevations, SIDE, x, z);
        const snapshot = captureWorldSnapshot(
          heightAt, totalYears, state.climate, SIDE, EXTENT,
          (x, z) => bilinear(t.forage, SIDE, x, z),
          (x, z) => bilinear(t.nutrients, SIDE, x, z),
          (x, z) => bilinear(t.runoff, SIDE, x, z),
          t.marineNutrients,
          (x, z) => bilinear(t.basalt, SIDE, x, z),
          (x, z) => bilinear(t.substrateAge, SIDE, x, z),
          (x, z) => bilinear(t.sediment, SIDE, x, z),
          (x, z) => bilinear(t.carbonate, SIDE, x, z),
        );
        const geography = resolveIslandGeography(
          { side: SIDE, extent: EXTENT, elevations: history.terrain.elevations },
          SEA_LEVEL[state.climate.seaLevel],
          history.archipelago.shields,
        );
        const resolution = resolveLanding(
          snapshot, history.lineages, FOUNDER_JUMP_YEARS, history.marineLineages, undefined, geography, history.seaLevelHistory,
        );
        const lineage = resolution.nextHistory.lineages[0]!;
        const change = resolution.changes.find((c) => c.id === lineage.id);

        // Recompute the intake/adaptation numbers the same way
        // outcome-resolver.ts's founder path does, for reporting.
        const profile = createFounderProfile(choices, totalYearsAtFounding, 0);
        const affinities = founderFoodAffinities(profile);
        const habitat = change?.habitat;
        const forage = habitat?.forage ?? 0;
        const moisture = habitat?.moisture ?? 0;
        const fit = founderEnvironmentFit(
          profile, forage, moisture, state.climate, habitat?.coastalProductivity ?? 0, affinities,
        );
        const founderResult = resolveFounderEstablishment(
          { energy: 0.38, abundance: 0.018, feedingAdaptation: 0.28 }, fit, FOUNDER_JUMP_YEARS,
        );

        cells.push({
          state: state.label,
          foodSource,
          size,
          originClimate,
          forage,
          moisture,
          foodAvailability: fit.foodAvailability,
          climateFit: fit.climateFit,
          metabolicCost: fit.metabolicCost,
          intake: founderResult.intake,
          adaptation: founderResult.feedingAdaptation,
          abundanceDelta: founderResult.abundance - 0.018,
          status: lineage.status,
        });
      }
    }
  }
}

const header = [
  "state", "foodSource", "size", "originClimate", "forage", "moisture",
  "foodAvail", "climateFit", "metCost", "intake", "adaptation", "abundanceDelta", "status",
].join("\t");
console.log(header);
for (const c of cells) {
  console.log([
    c.state, c.foodSource, c.size, c.originClimate,
    c.forage.toFixed(3), c.moisture.toFixed(3),
    c.foodAvailability.toFixed(3), c.climateFit.toFixed(3), c.metabolicCost.toFixed(2),
    c.intake.toFixed(3), c.adaptation.toFixed(3), c.abundanceDelta.toFixed(4), c.status,
  ].join("\t"));
}

console.log("\n--- summary ---");
const byState = new Map<string, { established: number; notEstablished: number; extinct: number; total: number }>();
for (const c of cells) {
  const bucket = byState.get(c.state) ?? { established: 0, notEstablished: 0, extinct: 0, total: 0 };
  bucket.total++;
  if (c.status === "active") bucket.established++;
  else if (c.status === "not-established") bucket.notEstablished++;
  else bucket.extinct++;
  byState.set(c.state, bucket);
}
for (const [state, bucket] of byState) {
  console.log(`${state}: ${bucket.established} active / ${bucket.notEstablished} not-established / ${bucket.extinct} extinct (of ${bucket.total})`);
}
const overall = { established: 0, notEstablished: 0, extinct: 0, total: 0 };
for (const bucket of byState.values()) {
  overall.established += bucket.established;
  overall.notEstablished += bucket.notEstablished;
  overall.extinct += bucket.extinct;
  overall.total += bucket.total;
}
console.log(`overall: ${overall.established} active / ${overall.notEstablished} not-established / ${overall.extinct} extinct (of ${overall.total})`);
