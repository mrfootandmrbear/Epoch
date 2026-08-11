import { describe, expect, it } from "vitest";
import {
  POPULATION_ARCHETYPES,
  isPopulationIdentity,
  lineageSeed,
  populationArchetype,
} from "./population-archetypes";

describe("population archetypes", () => {
  it("recognizes exactly the registered archetype keys", () => {
    for (const identity of Object.keys(POPULATION_ARCHETYPES)) {
      expect(isPopulationIdentity(identity)).toBe(true);
    }
    expect(isPopulationIdentity("unknown-grazer")).toBe(false);
    expect(isPopulationIdentity(null)).toBe(false);
  });

  it("preserves founding-lineage sampling seeds", () => {
    expect(lineageSeed("sheltered-grazer", "sheltered-grazer:0")).toBe(401);
    expect(lineageSeed("ridge-grazer", "ridge-grazer:0")).toBe(409);
  });

  it("gives descendants stable, distinct sampling seeds", () => {
    const first = lineageSeed("ridge-grazer", "ridge-grazer:1");
    expect(first).toBe(lineageSeed("ridge-grazer", "ridge-grazer:1"));
    expect(first).not.toBe(lineageSeed("ridge-grazer", "ridge-grazer:2"));
    expect(first).not.toBe(populationArchetype("ridge-grazer").seed);
  });
});
