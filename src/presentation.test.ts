import { describe, expect, it } from "vitest";
import { GOLDEN_SHOTS, SCREENSAVER_SHOTS, isGoldenShotName, screensaverCameraHeight } from "./presentation";

describe("golden shots", () => {
  it("provides the canonical visual review set", () => {
    expect(Object.keys(GOLDEN_SHOTS)).toEqual([
      // Pre-resize cameras. Retained unedited as the comparison basis for
      // every capture taken before the 2 km world; see the note in
      // `presentation.ts` about why they must not be A/B'd against new ones.
      "whole-island",
      "ridge-silhouette",
      "shoreline",
      "wave-height",
      "seagrass-meadow",
      "reef",
      "fish",
      "reef-above",
      "forest-interior",
      "herd",
      "herd-contrast",
      "coat-detail",
      "dawn",
      "storm",
      // The 2 km world.
      "w2k-whole-island",
      "w2k-shield-profile",
      "w2k-saddle",
      "w2k-shoreline",
      "w2k-reef-above",
      "w2k-dawn",
      "w2k-storm",
      // The multi-shield chain.
      "w2k-chain",
      "w2k-chain-saddle",
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

describe("screensaver camera", () => {
  it("omits submerged and interior review shots from automatic travel", () => {
    expect(SCREENSAVER_SHOTS).not.toContain("reef");
    expect(SCREENSAVER_SHOTS).not.toContain("fish");
    expect(SCREENSAVER_SHOTS).not.toContain("forest-interior");
  });

  it("arches between shots and never drops below terrain clearance", () => {
    expect(screensaverCameraHeight(10, 12, 0.5)).toBeGreaterThan(40);
    expect(screensaverCameraHeight(10, 80, 0.5)).toBe(88);
    expect(screensaverCameraHeight(30, 0, 0)).toBe(30);
  });
});
