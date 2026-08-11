import {
  clampPopulationTraits,
  POPULATION_TRAIT_KEYS,
  type PopulationIdentity,
  type PopulationTraits,
} from "./population-traits";

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

/** 100 years = 0.05, 10,000 = 0.40, 1,000,000 = 0.75. */
export function traitAdaptationRate(jumpYears: number): number {
  const logYears = Math.max(0, Math.log10(Math.max(1, jumpYears)));
  return Math.min(0.75, 0.025 * Math.min(logYears, 2) + 0.175 * Math.max(0, logYears - 2));
}

/** 1 year = 2 units, 100 = 10, 10,000 = 40, 1,000,000 = 70. */
export function migrationRadius(jumpYears: number): number {
  const logYears = Math.max(0, Math.log10(Math.max(1, jumpYears)));
  if (logYears <= 2) return 2 + logYears * 4;
  return Math.min(70, 10 + (logYears - 2) * 15);
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
