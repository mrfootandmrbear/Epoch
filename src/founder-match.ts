import type { ClimateForces } from "./climate";
import type { FounderChoices, FounderProfile } from "./founder-profile";
import { founderEnvironmentFit, founderFoodAffinities, createFounderProfile } from "./founder-profile";

/**
 * Summary of island habitat conditions at the drifter landing site.
 * Read-only snapshot for the readout to consume.
 */
export interface HabitatSummary {
  readonly forageLevel: number;
  readonly moisture: number;
  readonly elevationBand: "lowland" | "highland";
  readonly hasVegetation: boolean;
  readonly climate: Readonly<ClimateForces>;
}

/**
 * Describe the island's habitat and its match to the selected founder.
 *
 * Returns plain-language text that:
 * - Describes the island's conditions (never forecasts)
 * - Compares the founder's needs to the island
 * - Gives a readable verdict on the match
 * - Never states a probability or predicted outcome
 */
export function founderMatchReadout(
  habitat: Readonly<HabitatSummary>,
  choices: Readonly<FounderChoices>,
): string {
  const forage = Math.max(0, Math.min(1, habitat.forageLevel));
  const moisture = Math.max(0, Math.min(1, habitat.moisture));

  // Describe the island's forage availability
  const forageDesc = forage < 0.35 ? "sparse" : forage < 0.65 ? "moderate" : "abundant";

  // Describe the island's moisture regime
  const moistureDesc = moisture < 0.35 ? "arid" : moisture < 0.65 ? "temperate" : "wet";

  // Describe the island's elevation
  const elevationDesc = habitat.elevationBand === "highland" ? "highlands" : "lowlands";

  // Describe the founder's needs based on choices
  const sizeDesc = choices.size === "small" ? "small" : choices.size === "large" ? "large" : "medium";
  const foodDesc = choices.foodSource === "ground-plants"
    ? "grazer"
    : choices.foodSource === "woody-plants"
      ? "browser"
      : choices.foodSource === "animal-prey"
        ? "predator"
        : "omnivore";

  // Determine origin climate description for the founder
  const originClimateDesc = choices.originClimate === "cold-open"
    ? "cold open"
    : choices.originClimate === "cold-wet"
      ? "cold wet"
      : choices.originClimate === "temperate-seasonal"
        ? "temperate"
        : choices.originClimate === "hot-dry"
          ? "hot dry"
          : "hot wet";

  // Calculate the founder's fit to this environment
  // Use a deterministic seed for the profile since we're just evaluating fit
  const profile: FounderProfile = createFounderProfile(choices, 0, 0, 0);
  const affinities = founderFoodAffinities(profile);
  const fit = founderEnvironmentFit(profile, forage, moisture, habitat.climate, 0, affinities);

  // Build the verdict based on fit components
  let verdict: string;
  const foodFit = fit.foodAvailability;
  const climateFit = fit.climateFit;
  // Combine signals: food and climate fit, adjusted by metabolic cost of size
  const combinedFit = foodFit * climateFit * (choices.size === "small" ? 1.1 : choices.size === "large" ? 0.9 : 1);

  // Describe match quality without stating probabilities or predicting certain outcomes.
  // Reference: "Sparse forage, wet highlands; an arid grazer will struggle here."
  const article = "aeiou".includes(sizeDesc[0]) ? "an" : "a";
  if (combinedFit > 0.7) {
    verdict = `${article} ${sizeDesc} ${foodDesc} from a ${originClimateDesc} climate will thrive here`;
  } else if (combinedFit > 0.55) {
    verdict = `${article} ${sizeDesc} ${foodDesc} from a ${originClimateDesc} climate will do well here`;
  } else if (combinedFit > 0.35) {
    verdict = `${article} ${sizeDesc} ${foodDesc} from a ${originClimateDesc} climate will struggle here`;
  } else {
    verdict = `${article} ${sizeDesc} ${foodDesc} from a ${originClimateDesc} climate will struggle badly here`;
  }

  // Build the full readout
  return `${forageDesc} forage, ${moistureDesc} ${elevationDesc}; ${verdict}.`;
}
