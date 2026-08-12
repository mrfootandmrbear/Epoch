import { traitAdaptationRate } from "./lineage-history";

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

/** Resolve a small founder cohort against food actually present at its site. */
export function resolveFounderEstablishment(
  previous: Readonly<FounderEstablishmentState>,
  localForage: number,
  habitatMoisture: number,
  jumpYears: number,
): FounderEstablishmentResult {
  const duration = clamp01(Math.log10(Math.max(1, jumpYears) + 1) / 6);
  const adaptation = clamp01(
    previous.feedingAdaptation
    + (1 - previous.feedingAdaptation) * traitAdaptationRate(jumpYears) * 0.65,
  );
  const foodQuality = clamp01(localForage) * (0.82 + clamp01(habitatMoisture) * 0.18);
  const intake = foodQuality * (0.25 + adaptation * 0.75);
  const energy = clamp01(previous.energy + (intake - 0.38) * duration * 0.9);
  const abundance = clamp01(previous.abundance + (
    (intake - 0.4) * 0.55 + (energy - 0.38) * 0.15
  ) * duration);
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
