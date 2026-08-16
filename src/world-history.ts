import { createLineageHistory, type LineageHistory, type LineageState } from "./lineage-history";
import { assertPopulationTraits, type PopulationTraits } from "./population-traits";
import { isPopulationIdentity } from "./population-archetypes";
import { createTerrainHistory, type TerrainHistory } from "./terrain-history";
import { createMarineLineageHistory, validateMarineLineageHistory, type MarineLineageHistory } from "./marine-lineage";
import type { PlumeVigor } from "./volcanism";
import { createReefHistory, type ReefHistory } from "./reef-succession";
import { CORAL_GUILDS } from "./reef-succession";
import { DEFAULT_CLIMATE, SEA_LEVEL, type ClimateForces } from "./climate";
import { isFounderFoodSource, isFounderOriginClimate, isFounderSizeBand } from "./founder-profile";
import {
  createArchipelagoHistory,
  validateArchipelagoHistory,
  type ArchipelagoHistory,
} from "./archipelago-history";
import {
  createSeaLevelHistory,
  recordSeaLevel,
  validateSeaLevelHistory,
  type SeaLevelHistory,
} from "./island-geography";

/**
 * Bumped to 11 on 2026-08-16 (WU-A2) when `LineageState.rootId` was added.
 * Multiple rafts can now land on the same world, and `rootId` is what keeps
 * their descendants distinct roots in the bank instead of merging into one
 * tree — see `lineage-history.ts`. The field is optional (legacy synthetic
 * fixtures omit it and are treated as one shared root), so no migration is
 * needed for the shape of existing readers; the bump is a record of the
 * schema change, not a hard break.
 *
 * Bumped to 10 on 2026-08-15 when `hotSpots` was retired. Accretion now runs off
 * the archipelago shield chain, so the plume's position, drift bearing and vigor
 * all live in `archipelago`, and a parallel authored vent list had no remaining
 * owner — keeping it would have been two records able to disagree about where
 * the volcano is.
 */
export const WORLD_HISTORY_VERSION = 11 as const;

export interface WorldHistory {
  readonly version: typeof WORLD_HISTORY_VERSION;
  readonly terrain: TerrainHistory;
  readonly lineages: LineageHistory;
  readonly marineLineages: MarineLineageHistory;
  readonly reef: ReefHistory;
  /**
   * The hotspot chain this world's islands belong to. Shield zero is the
   * authored starting island, so the archipelago record is continuous with the
   * land the player begins on rather than starting empty beside it.
   */
  readonly archipelago: ArchipelagoHistory;
  /**
   * Every stand the world has been resolved at. Paired with a saddle elevation
   * from `island-geography.ts` this dates the loss of a land connection, which
   * is what population isolation is keyed to.
   */
  readonly seaLevelHistory: SeaLevelHistory;
}

/**
 * The plume the world is formed around, in terrain world coordinates.
 *
 * The player fixes all of this before the first jump — where the hotspot sits
 * and which way the crust carries its shields — and thereafter holds only
 * `vigor`. Presets supply their own as a starting point.
 */
export interface StartingVent {
  readonly x: number;
  readonly z: number;
  /** Drift bearing. Normalized on construction; defaults to +x. */
  readonly driftX?: number;
  readonly driftZ?: number;
  readonly vigor?: PlumeVigor;
  /**
   * Whether this vent's edifice is already drawn into the heightfield. True for
   * a preset's authored island; false when the player drops the plume onto open
   * water, where there is no shield yet and the chain has to build one.
   */
  readonly built?: boolean;
}

/**
 * Seat the authored island in the hotspot record as shield zero.
 *
 * Two properties matter. The hotspot is placed *on* the vent, so the starting
 * island is the one currently over the plume and the chain grows from it rather
 * than beside it. And a shield over an edifice the preset already drew is seeded
 * at full construction — recording it as unbuilt would have the next jump grow
 * land the player can already see, and now that accretion scales its target by
 * `construction` that would be visible as the island inflating on jump one.
 *
 * A vent dropped on open water is the mirror case: nothing is drawn there yet,
 * so it starts at construction 0 and the chain genuinely builds it.
 *
 * A world with no vent at all (the weathered and drowned presets, until the
 * player places one) still gets an archipelago, just an empty one, so the field
 * is never optional downstream.
 */
export function seedStartingPlume(vent?: StartingVent): ArchipelagoHistory {
  const history = createArchipelagoHistory({
    hotspotX: vent?.x ?? 0,
    hotspotZ: vent?.z ?? 0,
    driftX: vent?.driftX,
    driftZ: vent?.driftZ,
    plume: vent?.vigor,
  });
  if (!vent) return history;
  return {
    ...history,
    nextShieldSerial: 1,
    shields: [
      {
        id: "shield-0",
        birthYear: 0,
        crustX: vent.x,
        crustZ: vent.z,
        construction: vent.built === false ? 0 : 1,
        dormantYears: 0,
      },
    ],
  };
}

export interface InitialWorldState {
  readonly totalYears: 0;
  readonly climate: Readonly<ClimateForces>;
  readonly history: WorldHistory;
}

export function createWorldHistory(
  elevations: Float32Array,
  side: number,
  extent: number,
  includeTerrestrialFounders = true,
  vent?: StartingVent,
): WorldHistory {
  return {
    version: WORLD_HISTORY_VERSION,
    terrain: createTerrainHistory(elevations, side, extent),
    lineages: includeTerrestrialFounders ? createLineageHistory() : { lineages: [] },
    marineLineages: createMarineLineageHistory(),
    reef: createReefHistory(),
    archipelago: seedStartingPlume(vent),
    seaLevelHistory: createSeaLevelHistory(),
  };
}

/** The authored geological world that exists before any epoch is resolved. */
export function createInitialWorldState(
  elevations: Float32Array,
  side: number,
  extent: number,
  vent?: StartingVent,
): InitialWorldState {
  return {
    totalYears: 0,
    climate: Object.freeze({ ...DEFAULT_CLIMATE }),
    history: createWorldHistory(elevations, side, extent, false, vent),
  };
}

/**
 * Record the stand a resolved jump was held at.
 *
 * Kept here rather than at the call site so the sea-level record cannot fall
 * out of step with the jump that produced it: every advance that changes the
 * world passes through one function.
 */
export function withRecordedSeaLevel(
  history: WorldHistory,
  totalYearsBefore: number,
  jumpYears: number,
  climate: Readonly<ClimateForces>,
): WorldHistory {
  return {
    ...history,
    seaLevelHistory: recordSeaLevel(
      history.seaLevelHistory,
      totalYearsBefore,
      jumpYears,
      SEA_LEVEL[climate.seaLevel],
    ),
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
  if (lineage.rootId !== undefined && (!Number.isInteger(lineage.rootId) || (lineage.rootId as number) < 0)) {
    throw new RangeError(`${context}.rootId must be a non-negative integer when present`);
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
  if (lineage.founder !== undefined) {
    const founder = requireRecord(lineage.founder, `${context}.founder`);
    if (!isFounderFoodSource(founder.foodSource)) throw new RangeError(`${context}.founder.foodSource is not recognized`);
    if (!isFounderSizeBand(founder.size)) throw new RangeError(`${context}.founder.size is not recognized`);
    if (!isFounderOriginClimate(founder.originClimate)) throw new RangeError(`${context}.founder.originClimate is not recognized`);
    if (!Number.isInteger(founder.generationSeed) || (founder.generationSeed as number) < 0) {
      throw new RangeError(`${context}.founder.generationSeed must be a non-negative integer`);
    }
  }
  if (lineage.foodAffinities !== undefined) {
    const affinities = requireRecord(lineage.foodAffinities, `${context}.foodAffinities`);
    for (const field of ["groundPlants", "woodyPlants", "animalPrey", "marineForage"] as const) {
      const entry = affinities[field];
      if (!Number.isFinite(entry) || (entry as number) < 0 || (entry as number) > 1) {
        throw new RangeError(`${context}.foodAffinities.${field} must be finite and within [0, 1]`);
      }
    }
  }
  for (const field of ["abundance", "energy", "feedingAdaptation"] as const) {
    const entry = lineage[field];
    if (entry !== undefined && (!Number.isFinite(entry) || (entry as number) < 0 || (entry as number) > 1)) {
      throw new RangeError(`${context}.${field} must be finite and within [0, 1]`);
    }
  }
  if (lineage.origin !== undefined) {
    const origin = requireRecord(lineage.origin, `${context}.origin`);
    if (typeof origin.isolatedFromId !== "string" || origin.isolatedFromId.length === 0) {
      throw new TypeError(`${context}.origin.isolatedFromId must be a non-empty string`);
    }
    if (!Number.isFinite(origin.isolatedSinceYear) || (origin.isolatedSinceYear as number) < 0) {
      throw new RangeError(`${context}.origin.isolatedSinceYear must be a non-negative finite number`);
    }
    if (origin.basis !== "vicariance" && origin.basis !== "dispersal") {
      throw new RangeError(`${context}.origin.basis is not recognized`);
    }
    for (const field of ["bridgeX", "bridgeZ"] as const) {
      if (origin[field] !== undefined && !Number.isFinite(origin[field])) {
        throw new RangeError(`${context}.origin.${field} must be finite when present`);
      }
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
  validateFloat32Field(terrain.substrateAge, expectedLength, "world history terrain.substrateAge", true);
  validateFloat32Field(terrain.surfaceAgeYears, expectedLength, "world history terrain.surfaceAgeYears");
  validateFloat32Field(terrain.soilDevelopment, expectedLength, "world history terrain.soilDevelopment", true);
  validateFloat32Field(terrain.sediment, expectedLength, "world history terrain.sediment", true);
  validateFloat32Field(terrain.carbonate, expectedLength, "world history terrain.carbonate", true);
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
  validateArchipelagoHistory(history.archipelago);
  validateSeaLevelHistory(history.seaLevelHistory);

  const terrestrialIds = new Set(validated.map((lineage) => lineage.id));
  for (const [index, marine] of history.marineLineages.lineages.entries()) {
    if (marine.originDomain === "terrestrial-transition"
      && (!marine.ancestorLineageId || !terrestrialIds.has(marine.ancestorLineageId))) {
      throw new RangeError(`world history marine lineages[${index}].ancestorLineageId references missing terrestrial lineage`);
    }
  }
}
