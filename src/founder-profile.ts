import type { ClimateForces } from "./climate";
import { clampPopulationTraits, type PopulationTraits } from "./population-traits";

export const FOUNDER_FOOD_SOURCES = ["ground-plants", "woody-plants", "animal-prey", "mixed"] as const;
export type FounderFoodSource = typeof FOUNDER_FOOD_SOURCES[number];

export const FOUNDER_SIZE_BANDS = ["small", "medium", "large"] as const;
export type FounderSizeBand = typeof FOUNDER_SIZE_BANDS[number];

export const FOUNDER_ORIGIN_CLIMATES = [
  "cold-open",
  "cold-wet",
  "temperate-seasonal",
  "hot-dry",
  "hot-wet",
] as const;
export type FounderOriginClimate = typeof FOUNDER_ORIGIN_CLIMATES[number];

export interface FounderChoices {
  readonly foodSource: FounderFoodSource;
  readonly size: FounderSizeBand;
  readonly originClimate: FounderOriginClimate;
}

export interface FounderProfile extends FounderChoices {
  readonly generationSeed: number;
}

export interface FoodAffinities {
  readonly groundPlants: number;
  readonly woodyPlants: number;
  readonly animalPrey: number;
  readonly marineForage: number;
}

export const DEFAULT_FOUNDER_CHOICES: FounderChoices = {
  foodSource: "ground-plants",
  size: "medium",
  originClimate: "temperate-seasonal",
};

export function isFounderFoodSource(value: unknown): value is FounderFoodSource {
  return FOUNDER_FOOD_SOURCES.includes(value as FounderFoodSource);
}

export function isFounderSizeBand(value: unknown): value is FounderSizeBand {
  return FOUNDER_SIZE_BANDS.includes(value as FounderSizeBand);
}

export function isFounderOriginClimate(value: unknown): value is FounderOriginClimate {
  return FOUNDER_ORIGIN_CLIMATES.includes(value as FounderOriginClimate);
}

function hashFounder(choices: Readonly<FounderChoices>, originAge: number, ordinal: number): number {
  const text = `${choices.foodSource}|${choices.size}|${choices.originClimate}|${originAge}|${ordinal}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function random(seed: number, salt: number): number {
  let value = (seed + Math.imul(salt + 1, 0x9e3779b9)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return (value >>> 0) / 0x1_0000_0000;
}

export function createFounderProfile(
  choices: Readonly<FounderChoices>,
  originAge: number,
  ordinal: number,
  generationSeed = hashFounder(choices, originAge, ordinal),
): FounderProfile {
  return { ...choices, generationSeed: generationSeed >>> 0 };
}

const SIZE_MASS: Record<FounderSizeBand, number> = { small: 0.8, medium: 1.02, large: 1.32 };
const ORIGIN: Record<FounderOriginClimate, Readonly<{
  insulation: number;
  lightness: number;
  warmth: number;
  wetFeet: number;
}>> = {
  "cold-open": { insulation: 0.9, lightness: 0.72, warmth: 0.58, wetFeet: 0.12 },
  "cold-wet": { insulation: 0.82, lightness: 0.5, warmth: 0.42, wetFeet: 0.82 },
  "temperate-seasonal": { insulation: 0.48, lightness: 0.48, warmth: 0.56, wetFeet: 0.42 },
  "hot-dry": { insulation: 0.12, lightness: 0.78, warmth: 0.72, wetFeet: 0.06 },
  "hot-wet": { insulation: 0.08, lightness: 0.3, warmth: 0.34, wetFeet: 0.72 },
};

/** Generate the founder phenotype once. Later habitat selection acts on this inherited starting point. */
export function founderTraits(profile: Readonly<FounderProfile>): PopulationTraits {
  const origin = ORIGIN[profile.originClimate];
  const jitter = (salt: number, span: number) => (random(profile.generationSeed, salt) - 0.5) * span;
  const browsingReach = profile.foodSource === "woody-plants" ? 0.16 : 0;
  const pursuit = profile.foodSource === "animal-prey" ? 0.2 : 0;
  const defense = profile.foodSource === "animal-prey" ? -0.08 : 0.08;
  return clampPopulationTraits({
    bodyMass: SIZE_MASS[profile.size] + jitter(0, 0.1),
    legLength: 0.92 + browsingReach + pursuit + jitter(1, 0.18),
    footWidth: 0.76 + origin.wetFeet * 0.42 + jitter(2, 0.14),
    insulation: origin.insulation + jitter(3, 0.12),
    coatLightness: origin.lightness + jitter(4, 0.16),
    coatWarmth: origin.warmth + jitter(5, 0.16),
    hornLength: 0.88 + defense + jitter(6, 0.24),
  });
}

const ORIGIN_POINT: Record<FounderOriginClimate, Readonly<{ temperature: number; moisture: number }>> = {
  "cold-open": { temperature: 0, moisture: 0.25 },
  "cold-wet": { temperature: 0, moisture: 1 },
  "temperate-seasonal": { temperature: 0.5, moisture: 0.5 },
  "hot-dry": { temperature: 1, moisture: 0 },
  "hot-wet": { temperature: 1, moisture: 1 },
};

export interface FounderEnvironmentFit {
  readonly foodAvailability: number;
  readonly climateFit: number;
  readonly metabolicCost: number;
}

/** Dominant specialization plus small standing capacities that can support rare later transitions. */
export function founderFoodAffinities(profile: Readonly<FounderProfile>): FoodAffinities {
  const latent = 0.025 + random(profile.generationSeed, 9) * 0.025;
  if (profile.foodSource === "ground-plants") {
    return { groundPlants: 0.92, woodyPlants: 0.2, animalPrey: latent, marineForage: latent };
  }
  if (profile.foodSource === "woody-plants") {
    return { groundPlants: 0.2, woodyPlants: 0.92, animalPrey: latent, marineForage: latent };
  }
  if (profile.foodSource === "animal-prey") {
    return { groundPlants: latent, woodyPlants: latent, animalPrey: 0.92, marineForage: 0.06 + latent };
  }
  return { groundPlants: 0.62, woodyPlants: 0.62, animalPrey: 0.18, marineForage: 0.14 };
}

/** Coarse founder fitness inputs. Animal prey deliberately remains unavailable until a real prey field exists. */
export function founderEnvironmentFit(
  profile: Readonly<FounderProfile>,
  localForage: number,
  habitatMoisture: number,
  destination: Readonly<ClimateForces>,
  coastalProductivity = 0,
  affinities: Readonly<FoodAffinities> = founderFoodAffinities(profile),
): FounderEnvironmentFit {
  const forage = Math.min(1, Math.max(0, localForage));
  const moisture = Math.min(1, Math.max(0, habitatMoisture));
  const ground = forage * (0.82 + moisture * 0.18);
  const woody = forage * (0.38 + moisture * 0.54);
  // Terrestrial prey is deliberately zero until a real prey lineage contributes it.
  // Coastal productivity is a genuine existing ecosystem signal and leaves a slim
  // path toward shoreline/sea foraging for founders carrying latent affinity.
  const foodAvailability = Math.min(1, Math.max(
    ground * affinities.groundPlants,
    woody * affinities.woodyPlants,
    Math.min(1, Math.max(0, coastalProductivity)) * affinities.marineForage,
  ));

  const origin = ORIGIN_POINT[profile.originClimate];
  const destinationTemperature = destination.temperature === "cold" ? 0
    : destination.temperature === "mild" ? 0.5 : 1;
  const destinationMoisture = destination.rainfall === "arid" ? 0
    : destination.rainfall === "temperate" ? 0.5 : 1;
  const mismatch = Math.hypot(
    destinationTemperature - origin.temperature,
    (destinationMoisture - origin.moisture) * 0.65,
  );
  const climateFit = Math.min(1, Math.max(0.18, 1 - mismatch * 0.58));
  const metabolicCost = profile.size === "small" ? 0.9 : profile.size === "large" ? 1.18 : 1;
  return { foodAvailability, climateFit, metabolicCost };
}

export function founderProfileLabel(profile: Readonly<FounderProfile>): string {
  const food = profile.foodSource.replace("-", " ");
  const climate = profile.originClimate.replace("-", " ");
  return `${profile.size} ${food} feeder from a ${climate} climate`;
}
