import { describe, expect, it } from "vitest";
import { sampleAtmosphere } from "./atmosphere";

describe("atmosphere", () => {
  it("makes dawn warmer and dimmer than day", () => {
    const dawn = sampleAtmosphere(0, "dawn");
    const day = sampleAtmosphere(0, "day");
    expect(dawn.sunColor.r).toBeGreaterThan(dawn.sunColor.b);
    expect(dawn.sunIntensity).toBeLessThan(day.sunIntensity);
    expect(dawn.exposure).toBeLessThan(day.exposure);
  });

  it("makes storms darker without moving the sun below the world", () => {
    const storm = sampleAtmosphere(0, "storm");
    const day = sampleAtmosphere(0, "day");
    expect(storm.sunIntensity).toBeLessThan(day.sunIntensity);
    expect(storm.exposure).toBeLessThan(day.exposure);
    expect(storm.sunDirection.length()).toBeCloseTo(1);
  });

  it("cycles continuously on an eight-minute clock", () => {
    const first = sampleAtmosphere(15);
    const repeated = sampleAtmosphere(15 + 8 * 60);
    expect(first.sunDirection.distanceTo(repeated.sunDirection)).toBeLessThan(1e-10);
  });
});
