import type { PopulationIdentity, PopulationTraits } from "./population-traits";

export type LineageStatus = "not-established" | "active" | "extinct";

export interface LineageState {
  readonly identity: PopulationIdentity;
  readonly status: LineageStatus;
  readonly site?: Readonly<{ x: number; z: number }>;
  readonly traits?: Readonly<PopulationTraits>;
}

export interface LineageHistory {
  readonly lineages: readonly [LineageState, LineageState];
}

export interface TraitChange {
  readonly before: number;
  readonly after: number;
}

export interface LineageChange {
  readonly identity: PopulationIdentity;
  readonly previousStatus: LineageStatus;
  readonly status: LineageStatus;
  readonly moved: number;
  readonly reanchored?: boolean;
  readonly bodyMass?: TraitChange;
  readonly insulation?: TraitChange;
}

export function createLineageHistory(): LineageHistory {
  return {
    lineages: [
      { identity: "sheltered-grazer", status: "not-established" },
      { identity: "ridge-grazer", status: "not-established" },
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
  return {
    bodyMass: blend(inherited.bodyMass, target.bodyMass),
    legLength: blend(inherited.legLength, target.legLength),
    footWidth: blend(inherited.footWidth, target.footWidth),
    insulation: blend(inherited.insulation, target.insulation),
    coatLightness: blend(inherited.coatLightness, target.coatLightness),
    coatWarmth: blend(inherited.coatWarmth, target.coatWarmth),
    hornLength: blend(inherited.hornLength, target.hornLength),
  };
}

export function populationTraitDistance(
  first: Readonly<PopulationTraits>,
  second: Readonly<PopulationTraits>,
): number {
  const keys: Array<keyof PopulationTraits> = [
    "bodyMass", "legLength", "footWidth", "insulation",
    "coatLightness", "coatWarmth", "hornLength",
  ];
  return Math.hypot(...keys.map((key) => first[key] - second[key]));
}
