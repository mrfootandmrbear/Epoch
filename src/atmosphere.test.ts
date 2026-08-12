import { describe, expect, it } from "vitest";
import { resolveHeightFog, sampleAtmosphere } from "./atmosphere";

describe("atmosphere", () => {
  it("makes dawn warmer and dimmer than day", () => {
    const dawn = sampleAtmosphere(0, "dawn");
    const day = sampleAtmosphere(0, "day");
    expect(dawn.sunColor.r).toBeGreaterThan(dawn.sunColor.b);
    expect(dawn.sunIntensity).toBeLessThan(day.sunIntensity);
    expect(dawn.exposure).toBeLessThan(day.exposure);
    expect(dawn.fogColor.r / dawn.fogColor.b).toBeGreaterThan(day.fogColor.r / day.fogColor.b);
  });

  it("makes storms darker without moving the sun below the world", () => {
    const storm = sampleAtmosphere(0, "storm");
    const day = sampleAtmosphere(0, "day");
    expect(storm.sunIntensity).toBeLessThan(day.sunIntensity);
    expect(storm.exposure).toBeLessThan(day.exposure);
    expect(storm.fogColor.getHex()).not.toBe(day.fogColor.getHex());
    expect(storm.sunDirection.length()).toBeCloseTo(1);
  });

  it("cycles continuously on an eight-minute clock", () => {
    const first = sampleAtmosphere(15);
    const repeated = sampleAtmosphere(15 + 8 * 60);
    expect(first.sunDirection.distanceTo(repeated.sunDirection)).toBeLessThan(1e-10);
  });
});

describe("resolveHeightFog", () => {
  it("holds more low atmosphere in wet cold calm climates", () => {
    const inversion = resolveHeightFog({ rainfall: "wet", temperature: "cold", wind: "calm", seaLevel: "present" });
    const clear = resolveHeightFog({ rainfall: "arid", temperature: "warm", wind: "westerly", seaLevel: "present" });
    expect(inversion.density).toBeGreaterThan(clear.density * 5);
    expect(inversion.ceiling).toBeGreaterThan(clear.ceiling);
  });

  it("lets wind disperse an otherwise identical fog field", () => {
    const calm = resolveHeightFog({ rainfall: "temperate", temperature: "mild", wind: "calm", seaLevel: "present" });
    const windy = resolveHeightFog({ rainfall: "temperate", temperature: "mild", wind: "easterly", seaLevel: "present" });
    expect(calm.density).toBeGreaterThan(windy.density);
    expect(calm.ceiling).toBe(windy.ceiling);
  });
});
