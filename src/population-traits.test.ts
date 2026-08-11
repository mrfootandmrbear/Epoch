import { describe, expect, it } from "vitest";
import { blendPopulationTraits } from "./lineage-history";
import {
  assertPopulationTraits,
  clampPopulationTraits,
  derivePopulationTraits,
  POPULATION_TRAIT_BOUNDS,
  POPULATION_TRAIT_KEYS,
  type PopulationTraits,
} from "./population-traits";

function traitsAt(value: number): PopulationTraits {
  return Object.fromEntries(POPULATION_TRAIT_KEYS.map((key) => [key, value])) as unknown as PopulationTraits;
}

describe("population trait bounds", () => {
  it("clamps every trait to its declared range", () => {
    const below = clampPopulationTraits(traitsAt(-Infinity));
    const above = clampPopulationTraits(traitsAt(Infinity));

    for (const key of POPULATION_TRAIT_KEYS) {
      expect(below[key]).toBe(POPULATION_TRAIT_BOUNDS[key].min);
      expect(above[key]).toBe(POPULATION_TRAIT_BOUNDS[key].max);
    }
  });

  it("contains invalid inherited blends", () => {
    const blended = blendPopulationTraits(traitsAt(Number.NaN), traitsAt(Infinity), 0.75);
    expect(() => assertPopulationTraits(blended)).not.toThrow();
  });

  it("keeps derived targets valid under extreme habitat inputs", () => {
    for (const identity of ["sheltered-grazer", "ridge-grazer"] as const) {
      const traits = derivePopulationTraits(identity, {
        slope: 100,
        moisture: -100,
        exposure: 100,
        drainage: -100,
      }, {
        rainfall: "arid",
        temperature: "cold",
        wind: "westerly",
        seaLevel: "present",
      });
      expect(() => assertPopulationTraits(traits)).not.toThrow();
    }
  });

  it("reports the invalid trait and context", () => {
    expect(() => assertPopulationTraits({ ...traitsAt(1), bodyMass: 10 }, "test lineage"))
      .toThrow("test lineage: bodyMass must be finite and within [0.75, 1.4], received 10");
  });
});
