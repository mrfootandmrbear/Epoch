import type { ClimateForces } from "./climate";

export type PopulationIdentity = "sheltered-grazer" | "ridge-grazer";

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

export interface PopulationHabitat {
  slope: number;
  moisture: number;
  exposure: number;
  drainage: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function derivePopulationTraits(
  identity: PopulationIdentity,
  habitat: PopulationHabitat,
  climate: Readonly<ClimateForces>,
): PopulationTraits {
  const cold = climate.temperature === "cold" ? 1 : climate.temperature === "mild" ? 0.45 : 0;
  const wetGround = clamp01(habitat.moisture * 0.7 + habitat.drainage * 0.45);
  const ruggedness = clamp01(habitat.slope * 0.9 + habitat.exposure * 0.65);
  const sheltered = identity === "sheltered-grazer" ? 1 : 0;

  return {
    bodyMass: 0.88 + cold * 0.24 + sheltered * wetGround * 0.16 + ruggedness * 0.05,
    legLength: 0.84 + ruggedness * 0.34 + wetGround * 0.13,
    footWidth: 0.78 + wetGround * 0.42 + ruggedness * 0.08,
    insulation: clamp01(cold * 0.72 + habitat.exposure * 0.34),
    coatLightness: clamp01(0.38 + habitat.exposure * 0.3 - habitat.moisture * 0.17 + cold * 0.12),
    coatWarmth: clamp01(0.72 - habitat.moisture * 0.42 - cold * 0.24),
    hornLength: 0.72 + ruggedness * 0.58 - sheltered * wetGround * 0.12,
  };
}
