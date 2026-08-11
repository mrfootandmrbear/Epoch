import { describe, expect, it } from "vitest";
import { DEFAULT_CLIMATE, type ClimateForces } from "./climate";
import { buildEpochStory } from "./epoch-story";
import type { LineageChange } from "./lineage-history";
import type { MarineLineageChange } from "./marine-lineage";

const change = (event: LineageChange["event"]): LineageChange => ({
  id: "sheltered-grazer:0",
  identity: "sheltered-grazer",
  previousStatus: event === "established" ? "not-established" : "active",
  status: event === "extinct" ? "extinct" : "active",
  moved: 12,
  event,
});

describe("buildEpochStory", () => {
  it("distinguishes missing terrestrial founders from an empty ecosystem", () => {
    expect(buildEpochStory(0, [], DEFAULT_CLIMATE))
      .toBe("The first epoch brought no terrestrial founders; the coast and sky remained open to arrivals.");
  });

  it("introduces the first landing as an origin rather than a comparison", () => {
    expect(buildEpochStory(0, [change("established"), { ...change("established"), id: "ridge-grazer:0", identity: "ridge-grazer" }], DEFAULT_CLIMATE))
      .toBe("Life took hold: 2 lineages established across the young island.");
  });

  it("frames later landings against the world the player knew", () => {
    const harsh: ClimateForces = { rainfall: "arid", temperature: "warm", wind: "easterly", seaLevel: "high" };
    expect(buildEpochStory(1_000, [change("reanchored"), { ...change("speciated"), id: "sheltered-grazer:0/a", parentId: "sheltered-grazer:0" }], harsh))
      .toBe("Since Year 1,000, heat and aridity reshaped the coast; 1 lineage found new ground, 1 new branch emerged.");
  });

  it("includes marine movement in the later landing summary", () => {
    const marine: MarineLineageChange = {
      id: "coastal-forager:0", previousStatus: "active", status: "active", moved: 38, event: "migrated",
    };
    expect(buildEpochStory(1_000, [], DEFAULT_CLIMATE, [marine]))
      .toBe("Since Year 1,000, mild temperatures and seasonal rain reshaped the coast; 1 marine lineage shifted along the coast.");
  });
});
