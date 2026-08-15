import { AUTHORED_SCALE } from "./render-scale";
import {
  clampPopulationTraits,
  POPULATION_TRAIT_KEYS,
  type PopulationIdentity,
  type PopulationTraits,
} from "./population-traits";
import {
  createFounderProfile,
  DEFAULT_FOUNDER_CHOICES,
  founderTraits,
  founderFoodAffinities,
  type FoodAffinities,
  type FounderChoices,
  type FounderProfile,
} from "./founder-profile";

export type LineageStatus = "not-established" | "active" | "extinct";

export interface LineageState {
  readonly id: string;
  readonly parentId?: string;
  readonly originAge: number;
  readonly generation: number;
  readonly identity: PopulationIdentity;
  readonly status: LineageStatus;
  readonly site?: Readonly<{ x: number; z: number }>;
  readonly traits?: Readonly<PopulationTraits>;
  readonly abundance?: number;
  readonly energy?: number;
  /** Ability to turn the island's current forage into usable energy. */
  readonly feedingAdaptation?: number;
  /** Immutable choices and generation seed for a Distant Drifter founder. */
  readonly founder?: Readonly<FounderProfile>;
  /** Heritable feeding capacities; the founder choice only determines the dominant starting affinity. */
  readonly foodAffinities?: Readonly<FoodAffinities>;
}

export interface LineageHistory {
  readonly lineages: readonly LineageState[];
}

export interface TraitChange {
  readonly before: number;
  readonly after: number;
}

export type LineageEvent = "established" | "migrated" | "reanchored" | "speciated" | "extinct";

export interface LineageHabitat {
  readonly elevation: number;
  readonly slope: number;
  readonly moisture: number;
  readonly exposure: number;
  readonly drainage: number;
  readonly coastalProductivity: number;
  readonly nesting: number;
  readonly lift: number;
}

export interface LineageChange {
  readonly id: string;
  readonly parentId?: string;
  readonly identity: PopulationIdentity;
  readonly previousStatus: LineageStatus;
  readonly status: LineageStatus;
  readonly moved: number;
  readonly reanchored?: boolean;
  readonly event?: LineageEvent;
  readonly habitat?: LineageHabitat;
  readonly traits?: Partial<Readonly<Record<keyof PopulationTraits, TraitChange>>>;
  readonly abundance?: TraitChange;
  readonly energy?: TraitChange;
}

export function createLineageHistory(): LineageHistory {
  return {
    lineages: [
      {
        id: "sheltered-grazer:0",
        originAge: 0,
        generation: 0,
        identity: "sheltered-grazer",
        status: "not-established",
      },
      {
        id: "ridge-grazer:0",
        originAge: 0,
        generation: 0,
        identity: "ridge-grazer",
        status: "not-established",
      },
    ],
  };
}

/** A rafting event carries one vulnerable cohort, never a ready population. */
export function createDrifterFounderHistory(
  originAge: number,
  ordinal = 0,
  choices: Readonly<FounderChoices> = DEFAULT_FOUNDER_CHOICES,
  generationSeed?: number,
): LineageHistory {
  const founder = createFounderProfile(choices, originAge, ordinal, generationSeed);
  return {
    lineages: [{
      id: `sheltered-grazer:${ordinal}`,
      originAge,
      generation: 0,
      identity: "sheltered-grazer",
      status: "not-established",
      abundance: 0.018,
      energy: 0.38,
      feedingAdaptation: 0.28,
      founder,
      foodAffinities: founderFoodAffinities(founder),
      traits: founderTraits(founder),
    }],
  };
}

/** 100 years = 0.05, 10,000 = 0.40, 1,000,000 = 0.75. */
export function traitAdaptationRate(jumpYears: number): number {
  const logYears = Math.max(0, Math.log10(Math.max(1, jumpYears)));
  return Math.min(0.75, 0.025 * Math.min(logYears, 2) + 0.175 * Math.max(0, logYears - 2));
}

/**
 * How far a population may re-anchor its site in one jump, in metres.
 *
 * The curve is the authored one — on the old 165 m island it read 2 m at a
 * single year, 10 m at a century, 40 m at ten thousand years and 70 m at a
 * million. Those are *fractions of an island*, not absolute distances: 70 m
 * was 42% of the old land radius, and left unscaled on the 2 km world it would
 * be 16%, penning every lineage into a disc too small to track a coastline or
 * a habitat band as it moves. Scaled so the reach stays the same share of the
 * island it always was.
 */
export function migrationRadius(jumpYears: number): number {
  const logYears = Math.max(0, Math.log10(Math.max(1, jumpYears)));
  const authored = logYears <= 2
    ? 2 + logYears * 4
    : Math.min(70, 10 + (logYears - 2) * 15);
  return authored * AUTHORED_SCALE;
}

export function blendPopulationTraits(
  inherited: Readonly<PopulationTraits>,
  target: Readonly<PopulationTraits>,
  rate: number,
): PopulationTraits {
  const blend = (before: number, after: number) => before + (after - before) * rate;
  return clampPopulationTraits({
    bodyMass: blend(inherited.bodyMass, target.bodyMass),
    legLength: blend(inherited.legLength, target.legLength),
    footWidth: blend(inherited.footWidth, target.footWidth),
    insulation: blend(inherited.insulation, target.insulation),
    coatLightness: blend(inherited.coatLightness, target.coatLightness),
    coatWarmth: blend(inherited.coatWarmth, target.coatWarmth),
    hornLength: blend(inherited.hornLength, target.hornLength),
  });
}

export function populationTraitDistance(
  first: Readonly<PopulationTraits>,
  second: Readonly<PopulationTraits>,
): number {
  return Math.hypot(...POPULATION_TRAIT_KEYS.map((key) => first[key] - second[key]));
}

export function populationTraitChanges(
  before: Readonly<PopulationTraits> | undefined,
  after: Readonly<PopulationTraits>,
): Partial<Readonly<Record<keyof PopulationTraits, TraitChange>>> | undefined {
  if (!before) return undefined;
  return Object.fromEntries(POPULATION_TRAIT_KEYS.map((key) => [
    key,
    { before: before[key], after: after[key] },
  ])) as Partial<Readonly<Record<keyof PopulationTraits, TraitChange>>>;
}
