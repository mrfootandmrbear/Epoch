import { describe, expect, it } from "vitest";
import { GOLDEN_SHOTS, SCREENSAVER_SHOTS, isGoldenShotName, proofOverviewShot, screensaverCameraHeight } from "./presentation";

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
      "proof-founder",
      // WU-4b proof placement. Added after proof-founder; earlier names stay
      // in this order so existing captures keep their comparison basis.
      "proof-established-overview",
      "proof-established-mid",
      "proof-speciated-overview",
      "proof-speciated-parent-mid",
      "proof-speciated-branch-mid",
      "proof-diversified-overview",
      "proof-diversified-parent-mid",
      "proof-diversified-branch-mid",
      "proof-diversified-child-mid",
      // WU-4c near cameras. Added after the WU-4b mids.
      "proof-established-near",
      "proof-speciated-parent-near",
      "proof-speciated-branch-near",
      "proof-diversified-parent-near",
      "proof-diversified-branch-near",
      "proof-diversified-child-near",
      "w2k-underwater-shallow",
      "w2k-underwater-shelf",
      "w2k-underwater-slope",
      "w2k-underwater-look-up",
    ]);
  });

  it("validates capture query names", () => {
    expect(isGoldenShotName("shoreline")).toBe(true);
    expect(isGoldenShotName("proof-speciated-branch-mid")).toBe(true);
    expect(isGoldenShotName("not-a-shot")).toBe(false);
    expect(isGoldenShotName(null)).toBe(false);
  });

  it("frames the proof fixture overview from jump count", () => {
    expect(proofOverviewShot(2)).toBe("proof-established-overview");
    expect(proofOverviewShot(3)).toBe("proof-speciated-overview");
    expect(proofOverviewShot(5)).toBe("proof-diversified-overview");
  });

  it("keeps every shot finite and distinct from its target", () => {
    for (const shot of Object.values(GOLDEN_SHOTS)) {
      expect([...shot.position, ...shot.target].every(Number.isFinite)).toBe(true);
      expect(shot.position).not.toEqual(shot.target);
    }
  });

  it("places the underwater look-up shot inside the submerged polar cone", () => {
    const shot = GOLDEN_SHOTS["w2k-underwater-look-up"];
    const [cx, cy, cz] = shot.position;
    const [tx, ty, tz] = shot.target;
    const dy = cy - ty;
    const dist = Math.hypot(cx - tx, cy - ty, cz - tz);
    const polar = Math.acos(Math.min(1, Math.max(-1, dy / dist)));
    expect(cy).toBeLessThan(0);
    expect(polar).toBeGreaterThan(Math.PI / 2);
    expect(polar).toBeLessThanOrEqual(Math.PI * (120 / 180) + 1e-6);
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
