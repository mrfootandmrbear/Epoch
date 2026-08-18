import { describe, expect, it } from "vitest";
import { DEFAULT_CLIMATE } from "./climate";
import {
  landingReplayFromQuery,
  replayLandingHistory,
  TEST_WORLD_FIXTURES,
  testWorldFixture,
} from "./playable-worlds";
import { DEFAULT_STARTING_WORLD_ID } from "./starting-world-presets";

describe("playable worlds", () => {
  it("pins proof URLs without world= to weathered-island and DEFAULT_CLIMATE", () => {
    const recipe = landingReplayFromQuery(
      new URLSearchParams("founders=drifter&plume=active&years=1000000&jumps=2"),
    );
    expect(recipe.presetId).toBe("weathered-island");
    expect(recipe.jumps).toBe(2);
    expect(recipe.years).toBe(1_000_000);
    expect(recipe.climate).toEqual(DEFAULT_CLIMATE);
    expect(recipe.placeOriginPlume).toBe("active");
  });

  it("maps world=young-volcano onto the volcano recipe", () => {
    const recipe = landingReplayFromQuery(
      new URLSearchParams("founders=drifter&world=young-volcano&years=1000000&jumps=3"),
    );
    expect(recipe.presetId).toBe("young-volcano");
    expect(recipe.jumps).toBe(3);
    expect(recipe.placeOriginPlume).toBeUndefined();
    expect(recipe.climate.rainfall).toBe("wet");
    expect(recipe.climate.temperature).toBe("warm");
    expect(recipe.climate.wind).toBe("easterly");
  });

  it("names the three inhabited proof landings", () => {
    expect(TEST_WORLD_FIXTURES.map((fixture) => fixture.id)).toEqual([
      "established",
      "speciated",
      "diversified",
    ]);
    expect(testWorldFixture("established")?.jumps).toBe(2);
    expect(testWorldFixture("speciated")?.jumps).toBe(3);
    expect(testWorldFixture("diversified")?.jumps).toBe(5);
    for (const fixture of TEST_WORLD_FIXTURES) {
      expect(fixture.presetId).toBe("weathered-island");
      expect(fixture.climate).toEqual(DEFAULT_CLIMATE);
      expect(fixture.placeOriginPlume).toBe("active");
    }
  });

  it("records that young-volcano does not establish the default founder (do not retune here)", () => {
    const jumps = replayLandingHistory({
      id: "volcano-probe",
      name: "Young volcano probe",
      description: "",
      presetId: DEFAULT_STARTING_WORLD_ID,
      jumps: 5,
      years: 1_000_000,
      climate: { rainfall: "wet", temperature: "warm", wind: "easterly", seaLevel: "present" },
    });
    expect(jumps.map((entry) => entry.living)).toEqual([0, 0, 0, 0, 0]);
  }, 60_000);

  it("produces the proof living-lineage counts on the inhabited test fixtures", () => {
    const diversified = testWorldFixture("diversified")!;
    const jumps = replayLandingHistory(diversified);
    const livingAt = (jump: number) => jumps.find((entry) => entry.jump === jump)?.living;
    expect(livingAt(2)).toBe(1);
    expect(livingAt(3)).toBe(2);
    expect(livingAt(5)).toBe(3);
  }, 60_000);
});
