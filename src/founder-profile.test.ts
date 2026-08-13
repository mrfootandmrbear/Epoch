import { describe, expect, it } from "vitest";
import { DEFAULT_CLIMATE } from "./climate";
import { createFounderProfile, founderEnvironmentFit, founderFoodAffinities, founderTraits } from "./founder-profile";

describe("Distant Drifter founder profile", () => {
  it("reproduces a revealed founder from its committed seed", () => {
    const choices = { foodSource: "woody-plants", size: "large", originClimate: "cold-wet" } as const;
    const first = createFounderProfile(choices, 1_000, 2);
    const restored = createFounderProfile(choices, 1_000, 2, first.generationSeed);
    expect(restored).toEqual(first);
    expect(founderTraits(restored)).toEqual(founderTraits(first));
  });

  it("keeps size bands distinctive while retaining generated variation", () => {
    const common = { foodSource: "ground-plants", originClimate: "temperate-seasonal" } as const;
    const small = founderTraits(createFounderProfile({ ...common, size: "small" }, 0, 0));
    const large = founderTraits(createFounderProfile({ ...common, size: "large" }, 0, 1));
    expect(large.bodyMass).toBeGreaterThan(small.bodyMass);
    expect(large).not.toEqual(small);
  });

  it("gives predators slim plant and shoreline paths without inventing terrestrial prey", () => {
    const predator = createFounderProfile({
      foodSource: "animal-prey", size: "medium", originClimate: "temperate-seasonal",
    }, 0, 0);
    const affinities = founderFoodAffinities(predator);
    expect(affinities.animalPrey).toBeGreaterThan(affinities.groundPlants);
    expect(affinities.groundPlants).toBeGreaterThan(0);
    expect(affinities.marineForage).toBeGreaterThan(0);
    const inland = founderEnvironmentFit(predator, 0, 0.5, DEFAULT_CLIMATE, 0, affinities);
    const coast = founderEnvironmentFit(predator, 0, 0.5, DEFAULT_CLIMATE, 1, affinities);
    expect(inland.foodAvailability).toBe(0);
    expect(coast.foodAvailability).toBeGreaterThan(0);
  });

  it("makes origin climate affect destination fit", () => {
    const cold = createFounderProfile({ foodSource: "ground-plants", size: "medium", originClimate: "cold-open" }, 0, 0);
    const temperate = createFounderProfile({ foodSource: "ground-plants", size: "medium", originClimate: "temperate-seasonal" }, 0, 0);
    expect(founderEnvironmentFit(temperate, 0.8, 0.5, DEFAULT_CLIMATE).climateFit)
      .toBeGreaterThan(founderEnvironmentFit(cold, 0.8, 0.5, DEFAULT_CLIMATE).climateFit);
  });
});
