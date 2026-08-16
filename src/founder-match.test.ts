import { describe, it, expect } from "vitest";
import { founderMatchReadout, type HabitatSummary } from "./founder-match";
import type { FounderChoices } from "./founder-profile";
import { DEFAULT_CLIMATE } from "./climate";

describe("founderMatchReadout", () => {
  /**
   * Well-matched pairing: a founder well-suited to the island.
   * A small grazer from temperate climate on a temperate lowland with moderate forage.
   */
  it("describes a well-matched founder and island", () => {
    const habitat: HabitatSummary = {
      forageLevel: 0.7,
      moisture: 0.5,
      elevationBand: "lowland",
      hasVegetation: true,
      climate: DEFAULT_CLIMATE, // temperate-seasonal
    };
    const choices: FounderChoices = {
      foodSource: "ground-plants",
      size: "small",
      originClimate: "temperate-seasonal", // matching the island
    };
    const readout = founderMatchReadout(habitat, choices);

    // Should describe the island
    expect(readout).toContain("abundant");
    expect(readout).toContain("temperate");

    // Should describe the founder
    expect(readout).toContain("grazer");
    expect(readout).toContain("small");

    // Should give a positive verdict without predicting certain outcomes
    expect(readout).toMatch(/thrive|do well/);
    expect(readout).not.toMatch(/chance|probability|%|will fail|will die|survive/i);
  });

  /**
   * Absurd mismatch: a predator on a sparse, arid island from temperate climate.
   */
  it("describes an absurd mismatch", () => {
    const habitat: HabitatSummary = {
      forageLevel: 0.2,
      moisture: 0.1,
      elevationBand: "lowland",
      hasVegetation: false,
      climate: DEFAULT_CLIMATE,
    };
    const choices: FounderChoices = {
      foodSource: "animal-prey",
      size: "large",
      originClimate: "cold-wet",
    };
    const readout = founderMatchReadout(habitat, choices);

    // Should describe the island
    expect(readout).toContain("sparse");
    expect(readout).toContain("arid");

    // Should describe the founder
    expect(readout).toContain("predator");
    expect(readout).toContain("large");

    // Should give a negative verdict without predicting
    expect(readout).toContain("struggle");
    expect(readout).not.toMatch(/chance|probability|%|will fail|will die/i);
  });

  /**
   * Marginal case: mixed forage founder on moderate island.
   */
  it("describes a marginal founder-island match", () => {
    const habitat: HabitatSummary = {
      forageLevel: 0.4,
      moisture: 0.5,
      elevationBand: "highland",
      hasVegetation: true,
      climate: DEFAULT_CLIMATE,
    };
    const choices: FounderChoices = {
      foodSource: "mixed",
      size: "small",
      originClimate: "temperate-seasonal",
    };
    const readout = founderMatchReadout(habitat, choices);

    // Should describe the island
    expect(readout).toContain("moderate");
    expect(readout).toContain("temperate");
    expect(readout).toContain("highland");

    // Should describe the founder
    expect(readout).toContain("omnivore");
    expect(readout).toContain("small");

    // Should give a middle verdict without predicting
    expect(readout).toMatch(/struggle|do well/);
    expect(readout).not.toMatch(/chance|probability|%|will fail|will die|survive/i);
  });

  /**
   * Verify wording rules: no probabilities, no predictions, island-focused.
   */
  it("never uses forbidden wording patterns", () => {
    const habitat: HabitatSummary = {
      forageLevel: 0.6,
      moisture: 0.6,
      elevationBand: "lowland",
      hasVegetation: true,
      climate: DEFAULT_CLIMATE,
    };
    const choices: FounderChoices = {
      foodSource: "ground-plants",
      size: "medium",
      originClimate: "temperate-seasonal",
    };
    const readout = founderMatchReadout(habitat, choices);

    // Should not contain forbidden patterns
    expect(readout).not.toMatch(/%/);
    expect(readout).not.toMatch(/chance/i);
    expect(readout).not.toMatch(/probability/i);
    expect(readout).not.toMatch(/will fail/i);
    expect(readout).not.toMatch(/will succeed/i);
    expect(readout).not.toMatch(/will survive/i);
    expect(readout).not.toMatch(/\d{1,3}\s*%/);
  });

  /**
   * Browser on a richly vegetated island (high moisture supports woody plants).
   * Using a temperate browser to match the island climate.
   */
  it("describes a browser on a well-stocked island", () => {
    const habitat: HabitatSummary = {
      forageLevel: 0.85,
      moisture: 0.8,
      elevationBand: "highland",
      hasVegetation: true,
      climate: DEFAULT_CLIMATE, // temperate
    };
    const choices: FounderChoices = {
      foodSource: "woody-plants",
      size: "medium",
      originClimate: "temperate-seasonal", // matching the island
    };
    const readout = founderMatchReadout(habitat, choices);

    expect(readout).toContain("abundant");
    expect(readout).toContain("browser");
    expect(readout).toContain("medium");
    expect(readout).toMatch(/thrive|do well/);
    expect(readout).not.toMatch(/chance|probability|%/i);
  });
});
