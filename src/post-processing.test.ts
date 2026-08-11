import { describe, expect, it } from "vitest";
import {
  COLOR_TREATMENTS,
  colorTreatmentFor,
  readPostProcessingOptions,
} from "./post-processing";

describe("post-processing configuration", () => {
  it("enables restrained post effects but leaves GTAO opt-in", () => {
    expect(readPostProcessingOptions(new URLSearchParams())).toEqual({
      enabled: true,
      gtao: false,
    });
    expect(readPostProcessingOptions(new URLSearchParams("gtao=1"))).toEqual({
      enabled: true,
      gtao: true,
    });
    expect(readPostProcessingOptions(new URLSearchParams("post=0&gtao=1"))).toEqual({
      enabled: false,
      gtao: true,
    });
  });

  it("keeps day neutral, dawn warm, and storm cool with lower contrast", () => {
    expect(COLOR_TREATMENTS.day.tint[0]).toBeCloseTo(COLOR_TREATMENTS.day.tint[2], 2);
    expect(COLOR_TREATMENTS.dawn.tint[0]).toBeGreaterThan(COLOR_TREATMENTS.dawn.tint[2]);
    expect(COLOR_TREATMENTS.storm.tint[2]).toBeGreaterThan(COLOR_TREATMENTS.storm.tint[0]);
    expect(COLOR_TREATMENTS.storm.contrast).toBeLessThan(COLOR_TREATMENTS.day.contrast);
    expect(COLOR_TREATMENTS.storm.saturation).toBeLessThan(COLOR_TREATMENTS.day.saturation);
    expect(colorTreatmentFor("cycle")).toBe(COLOR_TREATMENTS.day);
  });
});
