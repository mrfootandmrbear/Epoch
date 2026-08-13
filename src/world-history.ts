import { createLineageHistory, type LineageHistory, type LineageState } from "./lineage-history";
import { assertPopulationTraits, type PopulationTraits } from "./population-traits";
import { isPopulationIdentity } from "./population-archetypes";
import { createTerrainHistory, type TerrainHistory } from "./terrain-history";
import { createMarineLineageHistory, validateMarineLineageHistory, type MarineLineageHistory } from "./marine-lineage";
import { VOLCANIC_OUTPUTS, type HotSpot } from "./volcanism";
import { createReefHistory, type ReefHistory } from "./reef-succession";
import { CORAL_GUILDS } from "./reef-succession";

export const WORLD_HISTORY_VERSION = 6 as const;

export interface WorldHistory {
  readonly version: typeof WORLD_HISTORY_VERSION;
  readonly terrain: TerrainHistory;
  readonly lineages: LineageHistory;
  readonly marineLineages: MarineLineageHistory;
  readonly reef: ReefHistory;
  readonly hotSpots: readonly HotSpot[];
}

export function createWorldHistory(
  elevations: Float32Array,
  side: number,
  extent: number,
  includeTerrestrialFounders = true,
): WorldHistory {
  return {
    version: WORLD_HISTORY_VERSION,
    terrain: createTerrainHistory(elevations, side, extent),
    lineages: includeTerrestrialFounders ? createLineageHistory() : { lineages: [] },
    marineLineages: createMarineLineageHistory(),
    reef: createReefHistory(),
    hotSpots: [],
  };
}

function requireRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) throw new TypeError(`${context} must be an object`);
  return value as Record<string, unknown>;
}

function validateFloat32Field(
  value: unknown,
  expectedLength: number,
  context: string,
  unitInterval = false,
): asserts value is Float32Array {
  if (!(value instanceof Float32Array)) throw new TypeError(`${context} must be a Float32Array`);
  if (value.length !== expectedLength) {
    throw new RangeError(`${context} length must be ${expectedLength}, received ${value.length}`);
  }
  for (let index = 0; index < value.length; index++) {
    const entry = value[index]!;
    if (!Number.isFinite(entry) || (unitInterval && (entry < 0 || entry > 1))) {
      const range = unitInterval ? "finite and within [0, 1]" : "finite";
      throw new RangeError(`${context}[${index}] must be ${range}, received ${entry}`);
    }
  }
}

function validateLineage(value: unknown, ids: Set<string>, index: number): LineageState {
  const context = `world history lineages[${index}]`;
  const lineage = requireRecord(value, context);
  if (typeof lineage.id !== "string" || lineage.id.length === 0) throw new TypeError(`${context}.id must be a non-empty string`);
  if (ids.has(lineage.id)) throw new RangeError(`${context}.id duplicates ${lineage.id}`);
  ids.add(lineage.id);
  if (lineage.parentId !== undefined && typeof lineage.parentId !== "string") {
    throw new TypeError(`${context}.parentId must be a string when present`);
  }
  if (!Number.isFinite(lineage.originAge) || (lineage.originAge as number) < 0) {
    throw new RangeError(`${context}.originAge must be a non-negative finite number`);
  }
  if (!Number.isInteger(lineage.generation) || (lineage.generation as number) < 0) {
    throw new RangeError(`${context}.generation must be a non-negative integer`);
  }
  if (!isPopulationIdentity(lineage.identity)) {
    throw new RangeError(`${context}.identity is not recognized`);
  }
  if (lineage.status !== "not-established" && lineage.status !== "active" && lineage.status !== "extinct") {
    throw new RangeError(`${context}.status is not recognized`);
  }
  if (lineage.site !== undefined) {
    const site = requireRecord(lineage.site, `${context}.site`);
    if (!Number.isFinite(site.x) || !Number.isFinite(site.z)) {
      throw new RangeError(`${context}.site coordinates must be finite`);
    }
  }
  if (lineage.traits !== undefined) {
    assertPopulationTraits(lineage.traits as Readonly<PopulationTraits>, `${context}.traits`);
  }
  for (const field of ["abundance", "energy", "feedingAdaptation"] as const) {
    const entry = lineage[field];
    if (entry !== undefined && (!Number.isFinite(entry) || (entry as number) < 0 || (entry as number) > 1)) {
      throw new RangeError(`${context}.${field} must be finite and within [0, 1]`);
    }
  }
  return lineage as unknown as LineageState;
}

export function validateWorldHistory(value: unknown): asserts value is WorldHistory {
  const history = requireRecord(value, "world history");
  if (history.version !== WORLD_HISTORY_VERSION) {
    throw new RangeError(`world history version must be ${WORLD_HISTORY_VERSION}, received ${String(history.version)}`);
  }

  const terrain = requireRecord(history.terrain, "world history terrain");
  if (!Number.isInteger(terrain.side) || (terrain.side as number) < 2) {
    throw new RangeError("world history terrain.side must be an integer of at least 2");
  }
  if (!Number.isFinite(terrain.extent) || (terrain.extent as number) <= 0) {
    throw new RangeError("world history terrain.extent must be a positive finite number");
  }
  const expectedLength = (terrain.side as number) ** 2;
  validateFloat32Field(terrain.elevations, expectedLength, "world history terrain.elevations");
  validateFloat32Field(terrain.disturbance, expectedLength, "world history terrain.disturbance", true);
  validateFloat32Field(terrain.vegetationProtection, expectedLength, "world history terrain.vegetationProtection", true);
  validateFloat32Field(terrain.forage, expectedLength, "world history terrain.forage", true);
  validateFloat32Field(terrain.nutrients, expectedLength, "world history terrain.nutrients", true);
  validateFloat32Field(terrain.runoff, expectedLength, "world history terrain.runoff", true);
  validateFloat32Field(terrain.basalt, expectedLength, "world history terrain.basalt", true);
  validateFloat32Field(terrain.ash, expectedLength, "world history terrain.ash", true);
  validateFloat32Field(terrain.volcanicLoad, expectedLength, "world history terrain.volcanicLoad", true);
  if (!Number.isFinite(terrain.marineNutrients) || (terrain.marineNutrients as number) < 0 || (terrain.marineNutrients as number) > 1) {
    throw new RangeError("world history terrain.marineNutrients must be finite and within [0, 1]");
  }

  const lineageHistory = requireRecord(history.lineages, "world history lineage history");
  if (!Array.isArray(lineageHistory.lineages)) throw new TypeError("world history lineages must be an array");
  const ids = new Set<string>();
  const validated = lineageHistory.lineages.map((lineage, index) => validateLineage(lineage, ids, index));
  for (const [index, lineage] of validated.entries()) {
    if (lineage.parentId !== undefined && !ids.has(lineage.parentId)) {
      throw new RangeError(`world history lineages[${index}].parentId references missing ${lineage.parentId}`);
    }
  }
  validateMarineLineageHistory(history.marineLineages);
  const reef = requireRecord(history.reef, "world history reef");
  if (!Array.isArray(reef.sites)) throw new TypeError("world history reef.sites must be an array");
  const reefIds = new Set<string>();
  reef.sites.forEach((value, index) => {
    const site = requireRecord(value, `world history reef.sites[${index}]`);
    if (typeof site.id !== "string" || site.id.length === 0) throw new TypeError(`world history reef.sites[${index}].id must be a non-empty string`);
    if (reefIds.has(site.id)) throw new RangeError(`world history reef.sites[${index}].id duplicates ${site.id}`);
    reefIds.add(site.id);
    if (!Number.isFinite(site.x) || !Number.isFinite(site.z)) throw new RangeError(`world history reef.sites[${index}] coordinates must be finite`);
    for (const field of ["livingCover", "framework", "deadFramework", "pioneerCover", "stress"] as const) {
      const entry = site[field];
      if (!Number.isFinite(entry) || (entry as number) < 0 || (entry as number) > 1) {
        throw new RangeError(`world history reef.sites[${index}].${field} must be finite and within [0, 1]`);
      }
    }
    const composition = requireRecord(site.composition, `world history reef.sites[${index}].composition`);
    for (const guild of CORAL_GUILDS) {
      if (!Number.isFinite(composition[guild]) || (composition[guild] as number) < 0 || (composition[guild] as number) > 1) {
        throw new RangeError(`world history reef.sites[${index}].composition.${guild} must be finite and within [0, 1]`);
      }
    }
  });
  if (!Array.isArray(history.hotSpots)) throw new TypeError("world history hotSpots must be an array");
  const hotSpotIds = new Set<string>();
  history.hotSpots.forEach((value, index) => {
    const hotSpot = requireRecord(value, `world history hotSpots[${index}]`);
    if (typeof hotSpot.id !== "string" || hotSpot.id.length === 0) throw new TypeError(`world history hotSpots[${index}].id must be a non-empty string`);
    if (hotSpotIds.has(hotSpot.id)) throw new RangeError(`world history hotSpots[${index}].id duplicates ${hotSpot.id}`);
    hotSpotIds.add(hotSpot.id);
    if (!Number.isFinite(hotSpot.x) || !Number.isFinite(hotSpot.z)) throw new RangeError(`world history hotSpots[${index}] coordinates must be finite`);
    if (!VOLCANIC_OUTPUTS.includes(hotSpot.output as HotSpot["output"])) throw new RangeError(`world history hotSpots[${index}].output is not recognized`);
  });
  const terrestrialIds = new Set(validated.map((lineage) => lineage.id));
  for (const [index, marine] of history.marineLineages.lineages.entries()) {
    if (marine.originDomain === "terrestrial-transition"
      && (!marine.ancestorLineageId || !terrestrialIds.has(marine.ancestorLineageId))) {
      throw new RangeError(`world history marine lineages[${index}].ancestorLineageId references missing terrestrial lineage`);
    }
  }
}
