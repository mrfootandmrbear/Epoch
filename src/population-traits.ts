import type { ClimateForces } from "./climate";
import { populationArchetype, type PopulationIdentity } from "./population-archetypes";

export type { PopulationIdentity } from "./population-archetypes";

/** Renderer-independent population means. Values are proportions, not mesh transforms. */
export interface PopulationTraits {
  bodyMass: number;
  legLength: number;
  footWidth: number;
  insulation: number;
  coatLightness: number;
  coatWarmth: number;
  hornLength: number;
}

export const POPULATION_TRAIT_BOUNDS = {
  bodyMass: { min: 0.75, max: 1.4 },
  legLength: { min: 0.7, max: 1.4 },
  footWidth: { min: 0.65, max: 1.35 },
  insulation: { min: 0, max: 1 },
  coatLightness: { min: 0, max: 1 },
  coatWarmth: { min: 0, max: 1 },
  hornLength: { min: 0.5, max: 1.45 },
} as const satisfies Record<keyof PopulationTraits, Readonly<{ min: number; max: number }>>;

export const POPULATION_TRAIT_KEYS = Object.freeze(
  Object.keys(POPULATION_TRAIT_BOUNDS) as Array<keyof PopulationTraits>,
);

export interface PopulationHabitat {
  slope: number;
  moisture: number;
  exposure: number;
  drainage: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampTrait(key: keyof PopulationTraits, value: number): number {
  const { min, max } = POPULATION_TRAIT_BOUNDS[key];
  if (Number.isNaN(value) || value === -Infinity) return min;
  if (value === Infinity) return max;
  return Math.min(max, Math.max(min, value));
}

export function clampPopulationTraits(traits: Readonly<PopulationTraits>): PopulationTraits {
  return Object.fromEntries(POPULATION_TRAIT_KEYS.map((key) => (
    [key, clampTrait(key, traits[key])]
  ))) as unknown as PopulationTraits;
}

export function assertPopulationTraits(
  traits: Readonly<PopulationTraits>,
  context = "population traits",
): void {
  for (const key of POPULATION_TRAIT_KEYS) {
    const value = traits[key];
    const { min, max } = POPULATION_TRAIT_BOUNDS[key];
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(`${context}: ${key} must be finite and within [${min}, ${max}], received ${value}`);
    }
  }
}

export function derivePopulationTraits(
  identity: PopulationIdentity,
  habitat: PopulationHabitat,
  climate: Readonly<ClimateForces>,
): PopulationTraits {
  const cold = climate.temperature === "cold" ? 1 : climate.temperature === "mild" ? 0.45 : 0;
  const wetGround = clamp01(habitat.moisture * 0.7 + habitat.drainage * 0.45);
  const ruggedness = clamp01(habitat.slope * 0.9 + habitat.exposure * 0.65);
  const sheltered = populationArchetype(identity).shelteredAffinity;

  return clampPopulationTraits({
    bodyMass: 0.88 + cold * 0.24 + sheltered * wetGround * 0.16 + ruggedness * 0.05,
    legLength: 0.84 + ruggedness * 0.34 + wetGround * 0.13,
    footWidth: 0.78 + wetGround * 0.42 + ruggedness * 0.08,
    insulation: clamp01(cold * 0.72 + habitat.exposure * 0.34),
    coatLightness: clamp01(0.38 + habitat.exposure * 0.3 - habitat.moisture * 0.17 + cold * 0.12),
    coatWarmth: clamp01(0.72 - habitat.moisture * 0.42 - cold * 0.24),
    hornLength: 0.72 + ruggedness * 0.58 - sheltered * wetGround * 0.12,
  });
}
