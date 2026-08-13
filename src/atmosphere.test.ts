import { describe, expect, it } from "vitest";
import { CYCLE_SECONDS, resolveHeightFog, sampleAtmosphere } from "./atmosphere";

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

  it("cycles continuously on a twelve-minute clock", () => {
    // Pinned to a literal: comparing against CYCLE_SECONDS is true by
    // construction for any value the constant happens to hold.
    expect(CYCLE_SECONDS).toBe(720);
    const first = sampleAtmosphere(15);
    const repeated = sampleAtmosphere(15 + 720);
    expect(first.sunDirection.distanceTo(repeated.sunDirection)).toBeLessThan(1e-10);
  });
});

describe("solar path", () => {
  const samples = Array.from({ length: 240 }, (_, index) => (
    sampleAtmosphere((index / 240) * CYCLE_SECONDS).sunDirection
  ));
  // Azimuth measured clockwise from north, with north at -z and east at +x.
  const compass = (direction: { x: number; z: number }): number => (
    (Math.atan2(direction.x, -direction.z) * 180 / Math.PI + 360) % 360
  );

  it("rises in the east and sets in the west", () => {
    const climbing = samples.filter((direction, index) => (
      direction.y > 0.08 && index > 0 && direction.y > samples[index - 1]!.y
    ));
    const falling = samples.filter((direction, index) => (
      direction.y > 0.08 && index > 0 && direction.y < samples[index - 1]!.y
    ));
    // 180 is due south — the meridian itself, which belongs to both halves.
    expect(climbing.every((direction) => compass(direction) <= 180)).toBe(true);
    expect(falling.every((direction) => compass(direction) >= 180)).toBe(true);
  });

  it("reaches a high noon instead of a permanent 45-degree ceiling", () => {
    const peak = Math.max(...samples.map((direction) => direction.y));
    expect(Math.asin(peak) * 180 / Math.PI).toBeGreaterThan(60);
  });

  it("passes properly below the horizon at night rather than skimming it", () => {
    const lowest = Math.min(...samples.map((direction) => direction.y));
    expect(Math.asin(lowest) * 180 / Math.PI).toBeLessThan(-30);
  });

  it("keeps the night short enough to stay playable", () => {
    const night = samples.filter((direction) => direction.y <= 0).length / samples.length;
    expect(night).toBeGreaterThan(0.1);
    expect(night).toBeLessThan(0.3);
  });

  it("is already well above the horizon by the time it bears due east", () => {
    // The assertion that actually separates an arc from a compass loop. The
    // old cycle drove azimuth and altitude from one phase, which put the sun
    // exactly on the horizon at due east; a tilted arc is climbing by then.
    const dueEast = samples.reduce((best, direction) => (
      Math.abs(compass(direction) - 90) < Math.abs(compass(best) - 90) ? direction : best
    ));
    expect(Math.asin(dueEast.y) * 180 / Math.PI).toBeGreaterThan(25);
  });

  it("never changes speed abruptly, including at sunrise and sunset", () => {
    // Stretching daylight across more of the clock than its share of the arc
    // is what keeps night short, but splicing two linear ramps to do it makes
    // the sun jump to a new speed the instant it touches the horizon.
    const steps = samples.map((direction, index) => (
      direction.angleTo(samples[(index + 1) % samples.length]!)
    ));
    steps.forEach((step, index) => {
      const previous = steps[(index - 1 + steps.length) % steps.length]!;
      expect(step / previous).toBeLessThan(1.15);
    });
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
