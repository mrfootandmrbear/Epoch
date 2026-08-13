import { describe, expect, it } from "vitest";
import {
  coatDistribution,
  coatSpread,
  sampleCoat,
  type CoatDistribution,
} from "./coat-variation";

const HERD = 96;

function herdCoats(warmth: number, lightness: number, seed: number) {
  return Array.from({ length: HERD }, (_, index) => sampleCoat(warmth, lightness, index, seed));
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function spreadOf(values: readonly number[]): number {
  return Math.max(...values) - Math.min(...values);
}

/** Seeds covering each distribution, so no test depends on one lucky seed. */
function seedsFor(distribution: CoatDistribution): number[] {
  const found: number[] = [];
  for (let seed = 0; seed < 400 && found.length < 6; seed++) {
    if (coatDistribution(seed) === distribution) found.push(seed);
  }
  return found;
}

describe("within-herd coat variation", () => {
  it("reaches every distribution across sites", () => {
    const seen = new Set<CoatDistribution>();
    for (let seed = 0; seed < 200; seed++) seen.add(coatDistribution(seed));
    expect([...seen].sort()).toEqual(["bimodal", "graded", "uniform"]);
  });

  it("gives one site the same distribution every time it is asked", () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(coatDistribution(seed)).toBe(coatDistribution(seed));
      expect(coatSpread(seed)).toBe(coatSpread(seed));
    }
  });

  it("resolves the same coat for the same animal at the same site", () => {
    const first = sampleCoat(0.5, 0.5, 17, 91);
    const second = sampleCoat(0.5, 0.5, 17, 91);
    expect(first).toEqual(second);
  });

  it("preserves the population mean the simulation resolved", () => {
    // The renderer samples around the means; it must not move them. Bimodal
    // sites are the case that could: two forms with unequal shares only
    // average back to the mean if each offset is weighted by the other share.
    for (let seed = 0; seed < 120; seed++) {
      const coats = herdCoats(0.5, 0.5, seed);
      expect(mean(coats.map((coat) => coat.warmth)), `warmth seed ${seed}`).toBeCloseTo(0.5, 1);
      expect(mean(coats.map((coat) => coat.lightness)), `lightness seed ${seed}`).toBeCloseTo(0.5, 1);
    }
  });

  it("spreads a herd wide enough to see", () => {
    // The old band was +/-0.08 on lightness, which at this mesh's tonal range
    // is close to invisible across a herd. Every site must beat it clearly.
    for (let seed = 0; seed < 60; seed++) {
      const coats = herdCoats(0.5, 0.5, seed);
      expect(spreadOf(coats.map((coat) => coat.lightness)), `seed ${seed}`).toBeGreaterThan(0.16);
    }
  });

  it("gives different sites visibly different herds from the same means", () => {
    // Two populations that resolved identical coat means should still not look
    // like the same herd twice.
    const spreads = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      spreads.add(Number(spreadOf(herdCoats(0.5, 0.5, seed).map((c) => c.lightness)).toFixed(3)));
    }
    expect(spreads.size).toBeGreaterThan(20);
  });

  it("splits a bimodal site into two separated groups", () => {
    for (const seed of seedsFor("bimodal")) {
      const lightness = herdCoats(0.5, 0.5, seed).map((coat) => coat.lightness).sort((a, b) => a - b);
      const dark = lightness.slice(0, Math.floor(lightness.length / 3));
      const pale = lightness.slice(-Math.floor(lightness.length / 3));
      // The two forms are distinct, not a single continuous cloud.
      expect(mean(pale) - mean(dark), `seed ${seed}`).toBeGreaterThan(0.12);
    }
  });

  it("correlates warmth with lightness on a graded site", () => {
    for (const seed of seedsFor("graded")) {
      const coats = herdCoats(0.5, 0.5, seed);
      const warmth = coats.map((coat) => coat.warmth);
      const lightness = coats.map((coat) => coat.lightness);
      const warmthMean = mean(warmth);
      const lightnessMean = mean(lightness);
      const covariance = mean(
        coats.map((_, i) => (warmth[i]! - warmthMean) * (lightness[i]! - lightnessMean)),
      );
      // A cline: paler animals are cooler, so the two channels move opposite.
      expect(covariance, `seed ${seed}`).toBeLessThan(0);
    }
  });

  it("stays inside the channel range at the ends of the trait bounds", () => {
    for (const [warmth, lightness] of [[0, 0], [1, 1], [0, 1], [1, 0], [0.5, 0.5]] as const) {
      for (let seed = 0; seed < 60; seed++) {
        for (const coat of herdCoats(warmth, lightness, seed)) {
          expect(coat.warmth).toBeGreaterThanOrEqual(0);
          expect(coat.warmth).toBeLessThanOrEqual(1);
          expect(coat.lightness).toBeGreaterThanOrEqual(0);
          expect(coat.lightness).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
