import { describe, expect, it } from "vitest";
import { STARTING_WORLD_PRESETS, startingWorldPreset } from "./starting-world-presets";

describe("starting world presets", () => {
  it("provides distinct, finite terrain over the playable domain", () => {
    const signatures = STARTING_WORLD_PRESETS.map((preset) =>
      [-160, -80, 0, 80, 160].flatMap((x) => [-160, -40, 40, 160].map((z) => preset.heightAt(x, z))),
    );
    signatures.flat().forEach((height) => expect(Number.isFinite(height)).toBe(true));
    expect(new Set(signatures.map((values) => values.map((value) => value.toFixed(3)).join(","))).size)
      .toBe(STARTING_WORLD_PRESETS.length);
  });

  it("falls back to the canonical weathered island", () => {
    expect(startingWorldPreset("unknown").id).toBe("weathered-island");
  });
});
