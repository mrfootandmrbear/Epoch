import { describe, expect, it } from "vitest";
import { GOLDEN_SHOTS, isGoldenShotName } from "./presentation";

describe("golden shots", () => {
  it("provides the canonical visual review set", () => {
    expect(Object.keys(GOLDEN_SHOTS)).toEqual([
      "whole-island",
      "ridge-silhouette",
      "shoreline",
      "wave-height",
      "seagrass-meadow",
      "forest-interior",
      "herd",
      "herd-contrast",
      "dawn",
      "storm",
    ]);
  });

  it("validates capture query names", () => {
    expect(isGoldenShotName("shoreline")).toBe(true);
    expect(isGoldenShotName("not-a-shot")).toBe(false);
    expect(isGoldenShotName(null)).toBe(false);
  });

  it("keeps every shot finite and distinct from its target", () => {
    for (const shot of Object.values(GOLDEN_SHOTS)) {
      expect([...shot.position, ...shot.target].every(Number.isFinite)).toBe(true);
      expect(shot.position).not.toEqual(shot.target);
    }
  });
});
