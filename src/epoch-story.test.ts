import { describe, expect, it } from "vitest";
import { DEFAULT_CLIMATE, type ClimateForces } from "./climate";
import { buildEpochStory } from "./epoch-story";
import type { LineageChange } from "./lineage-history";

const change = (event: LineageChange["event"]): LineageChange => ({
  id: "sheltered-grazer:0",
  identity: "sheltered-grazer",
  previousStatus: event === "established" ? "not-established" : "active",
  status: event === "extinct" ? "extinct" : "active",
  moved: 12,
  event,
});

describe("buildEpochStory", () => {
  it("introduces the first landing as an origin rather than a comparison", () => {
    expect(buildEpochStory(0, [change("established"), { ...change("established"), id: "ridge-grazer:0", identity: "ridge-grazer" }], DEFAULT_CLIMATE))
      .toBe("Life took hold: 2 lineages established across the young island.");
  });

  it("frames later landings against the world the player knew", () => {
    const harsh: ClimateForces = { rainfall: "arid", temperature: "warm", wind: "easterly", seaLevel: "high" };
    expect(buildEpochStory(1_000, [change("reanchored"), { ...change("speciated"), id: "sheltered-grazer:0/a", parentId: "sheltered-grazer:0" }], harsh))
      .toBe("Since Year 1,000, heat and aridity reshaped the coast; 1 lineage found new ground, 1 new branch emerged.");
  });
});
