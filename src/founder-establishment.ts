import { TRAIT_ADAPTATION_RATE_CEILING, traitAdaptationRate } from "./lineage-history";
import type { FounderEnvironmentFit } from "./founder-profile";

export interface FounderEstablishmentState {
  readonly energy: number;
  readonly abundance: number;
  readonly feedingAdaptation: number;
}

export interface FounderEstablishmentResult extends FounderEstablishmentState {
  readonly intake: number;
  readonly status: "not-established" | "active" | "extinct";
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

const FOUNDER_BREAK_EVEN_INTAKE = 0.4;
const FOUNDER_ENERGY_BASELINE = 0.38;
const INTAKE_WEIGHT = 0.55;
const ENERGY_WEIGHT = 0.15;

/**
 * Width of the contested "marginal" band around break-even, expressed in
 * intake units.
 *
 * This is the single tuning knob for the owner's three-band design
 * (`docs/TANGLED-BANK-BUILD-PLAN.md`, WU-A1 "Resolved design decision"). It
 * is applied once, to the founder's *net food surplus* — intake vs.
 * break-even, plus the energy budget's own echo of that same surplus folded
 * in at its usual relative weight (`ENERGY_WEIGHT` / `INTAKE_WEIGHT`) so the
 * two don't disagree about what "marginal" means. A founder whose net
 * surplus falls inside this margin is *genuinely* contested: surplus inside
 * the band is dropped to zero, so abundance holds roughly flat instead of
 * one signal or the other snapping the outcome, and only the (still
 * unmargined) energy term's own small drift decides — so some marginal
 * founders establish and others don't, for reasons that trace to their
 * specific fit, not to a coin flip. Outside the margin the outcome is not
 * close: comfortably above it establishes, comfortably below it fails fast.
 *
 * Started wide on purpose, per the design decision, so band 2 is legible
 * while the mechanic is being designed. Narrow this — and only this — with
 * evidence from real play; do not add a second margin anywhere else in this
 * function.
 */
export const FOUNDER_MARGIN_BAND_WIDTH = 0.08;

/** Zero out a net-surplus gap that falls inside the marginal band. */
function marginalizedSurplus(gap: number): number {
  if (gap > FOUNDER_MARGIN_BAND_WIDTH) return gap - FOUNDER_MARGIN_BAND_WIDTH;
  if (gap < -FOUNDER_MARGIN_BAND_WIDTH) return gap + FOUNDER_MARGIN_BAND_WIDTH;
  return 0;
}

/** Resolve a small founder cohort against food actually present at its site. */
export function resolveFounderEstablishment(
  previous: Readonly<FounderEstablishmentState>,
  environment: Readonly<FounderEnvironmentFit>,
  jumpYears: number,
): FounderEstablishmentResult {
  const duration = clamp01(Math.log10(Math.max(1, jumpYears) + 1) / 6);
  // Founders adapt their feeding behaviour to what a site actually offers,
  // which is a faster process than the genetic trait blending
  // `traitAdaptationRate` otherwise paces out over many jumps
  // (`blendPopulationTraits` in outcome-resolver.ts, untouched here). Reusing
  // the same curve but normalizing it to its own ceiling means a single
  // sufficiently long jump can carry a founder to full behavioural
  // adaptation, while a short jump still makes zero progress exactly as the
  // shared curve intends — established-population trait blending calls
  // `traitAdaptationRate` directly and never sees this normalization.
  const adaptation = clamp01(
    previous.feedingAdaptation
    + (1 - previous.feedingAdaptation) * (traitAdaptationRate(jumpYears) / TRAIT_ADAPTATION_RATE_CEILING),
  );
  const foodQuality = clamp01(environment.foodAvailability);
  const intake = foodQuality * (0.25 + adaptation * 0.75) * clamp01(environment.climateFit);
  const maintenance = 0.38 * Math.max(0.75, environment.metabolicCost);
  const energy = clamp01(previous.energy + (intake - maintenance) * duration * 0.9);
  const intakeGap = intake - FOUNDER_BREAK_EVEN_INTAKE;
  const energyGap = energy - FOUNDER_ENERGY_BASELINE;
  const netSurplus = marginalizedSurplus(intakeGap + energyGap * (ENERGY_WEIGHT / INTAKE_WEIGHT));
  const abundance = clamp01(previous.abundance + netSurplus * INTAKE_WEIGHT * duration);
  const extinct = energy < 0.06 || abundance < 0.004;
  const established = !extinct && intake >= 0.42 && energy >= 0.44 && abundance >= 0.05;
  return {
    energy: extinct ? 0 : energy,
    abundance: extinct ? 0 : abundance,
    feedingAdaptation: adaptation,
    intake,
    status: extinct ? "extinct" : established ? "active" : "not-established",
  };
}
