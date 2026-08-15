import type { ClimateForces } from "./climate";
import type { PlumeVigor } from "./volcanism";

export const VOLCANIC_LIFECYCLE_PHASES = ["fresh", "recovered", "carved", "drowned"] as const;
export type VolcanicLifecyclePhase = typeof VOLCANIC_LIFECYCLE_PHASES[number];

export interface VolcanicLifecycleStep {
  readonly phase: VolcanicLifecyclePhase;
  readonly years: number;
  readonly vigor: PlumeVigor;
  readonly climate: Readonly<ClimateForces>;
}

/**
 * Fixed cumulative capture sequence for judging one vent through construction,
 * recovery, erosion, and subsidence. Each requested phase replays the prefix so
 * later frames inherit the exact terrain and volcanic load visible earlier.
 *
 * The steps drive the plume rather than a single vent's output, since that is
 * what the player now holds: build hard once, then go quiet and let erosion and
 * subsidence do the rest. The sequence's intent is unchanged.
 */
export const VOLCANIC_LIFECYCLE_STEPS: readonly VolcanicLifecycleStep[] = [
  {
    phase: "fresh",
    years: 1_000,
    vigor: "hyperactive",
    climate: { rainfall: "wet", temperature: "warm", wind: "easterly", seaLevel: "present" },
  },
  {
    phase: "recovered",
    years: 1_000,
    vigor: "dormant",
    climate: { rainfall: "wet", temperature: "warm", wind: "easterly", seaLevel: "present" },
  },
  {
    phase: "carved",
    years: 100_000,
    vigor: "dormant",
    climate: { rainfall: "wet", temperature: "mild", wind: "westerly", seaLevel: "present" },
  },
  {
    phase: "drowned",
    years: 1_000_000,
    vigor: "dormant",
    climate: { rainfall: "wet", temperature: "mild", wind: "westerly", seaLevel: "high" },
  },
] as const;

export function isVolcanicLifecyclePhase(value: string | null): value is VolcanicLifecyclePhase {
  return value !== null && VOLCANIC_LIFECYCLE_PHASES.includes(value as VolcanicLifecyclePhase);
}

export function volcanicLifecyclePrefix(phase: VolcanicLifecyclePhase): readonly VolcanicLifecycleStep[] {
  const end = VOLCANIC_LIFECYCLE_STEPS.findIndex((step) => step.phase === phase);
  return VOLCANIC_LIFECYCLE_STEPS.slice(0, end + 1);
}
