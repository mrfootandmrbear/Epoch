import type { ClimateForces } from "./climate";
import type { VolcanicOutput } from "./volcanism";

export const ENVIRONMENT_FIXTURES = {
  "cold-wet-calm-present": {
    climate: { rainfall: "wet", temperature: "cold", wind: "calm", seaLevel: "present" },
    years: 10_000,
  },
  "cold-arid-exposed-low": {
    climate: { rainfall: "arid", temperature: "cold", wind: "westerly", seaLevel: "low" },
    years: 10_000,
  },
  "mild-temperate-exposed-present": {
    climate: { rainfall: "temperate", temperature: "mild", wind: "easterly", seaLevel: "present" },
    years: 10_000,
  },
  "warm-wet-calm-high": {
    climate: { rainfall: "wet", temperature: "warm", wind: "calm", seaLevel: "high" },
    years: 10_000,
  },
  "warm-arid-volcanic": {
    climate: { rainfall: "arid", temperature: "warm", wind: "westerly", seaLevel: "present" },
    years: 1_000,
    volcano: "active",
    hotSpot: { x: 0, z: 0 },
  },
  "mature-warm-reef": {
    climate: { rainfall: "temperate", temperature: "warm", wind: "easterly", seaLevel: "present" },
    years: 100_000,
    volcano: "active",
    // On the inner edge of the reviewed reef shelf: close enough for basalt
    // to enter the paired cameras, far enough that the outer reef survives.
    hotSpot: { x: 60, z: 70 },
  },
} as const satisfies Record<string, {
  climate: ClimateForces;
  years: number;
  volcano?: VolcanicOutput;
  hotSpot?: Readonly<{ x: number; z: number }>;
}>;

export type EnvironmentFixtureName = keyof typeof ENVIRONMENT_FIXTURES;

export function isEnvironmentFixtureName(value: string | null): value is EnvironmentFixtureName {
  return value !== null && value in ENVIRONMENT_FIXTURES;
}
