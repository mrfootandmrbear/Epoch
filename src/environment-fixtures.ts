import type { ClimateForces } from "./climate";
import { AUTHORED_SCALE } from "./render-scale";
import { SHIELD_GEOMETRY, type VolcanicOutput } from "./volcanism";

/**
 * Centre of the reviewed reef shelf, in metres.
 *
 * The shelf was authored at (104, 116) against a 165 m island — just past its
 * shore, on shallow substrate. It is re-seated by the same factor the starting
 * worlds were stretched by, so it lands just past the *new* shore for the same
 * reason. Scaling it by the grid ratio instead would put it 837 m out, in open
 * ocean too deep for a reef, which is exactly what a first attempt did.
 */
export const REEF_REVIEW_SHELF = Object.freeze({
  x: Math.round(104 * AUTHORED_SCALE),
  z: Math.round(116 * AUTHORED_SCALE),
});

/**
 * Where the reef fixture's vent sits, derived rather than typed.
 *
 * The composition that mattered was geometric, not numeric: the vent sat just
 * *outside* its own shield's skirt as seen from the shelf, so fresh basalt
 * reaches the paired cameras while the outer reef stays on old substrate.
 * With the shield radius now 244 m instead of 61 m, a hand-typed offset that
 * used to clear the skirt would sit deep inside it, and `withReefDeposition`
 * would suppress every gram of carbonate under it. Deriving the offset keeps
 * the intent through any future change to shield geometry.
 */
function reefVent(): Readonly<{ x: number; z: number }> {
  const clearance = SHIELD_GEOMETRY.active.radius * 1.06;
  // Inland of the shelf along the shelf's own bearing from the world centre.
  const bearing = Math.atan2(REEF_REVIEW_SHELF.z, REEF_REVIEW_SHELF.x);
  return Object.freeze({
    x: Math.round(REEF_REVIEW_SHELF.x - Math.cos(bearing) * clearance),
    z: Math.round(REEF_REVIEW_SHELF.z - Math.sin(bearing) * clearance),
  });
}

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
    hotSpot: reefVent(),
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
