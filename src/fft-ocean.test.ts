import { describe, expect, it } from "vitest";
import { createSeededRandom, deriveCascades } from "./fft-ocean";

describe("FFT ocean seed", () => {
  it("repeats the spectrum random sequence for golden captures", () => {
    const first = createSeededRandom(0xe90c4);
    const second = createSeededRandom(0xe90c4);
    expect(Array.from({ length: 16 }, first)).toEqual(Array.from({ length: 16 }, second));
  });

  it("keeps distinct seeds distinct", () => {
    expect(createSeededRandom(1)()).not.toBe(createSeededRandom(2)());
  });
});

describe("FFT ocean cascade bands", () => {
  const patches = [500, 40, 8];

  it("partitions the spectrum with no gap and no overlap", () => {
    const cascades = deriveCascades(patches);
    expect(cascades).toHaveLength(3);
    // Every wavenumber belongs to exactly one cascade: each band starts
    // where the previous one ended. Overlap would count that energy twice
    // and the sea would read over-rough.
    for (let i = 1; i < cascades.length; i++) {
      expect(cascades[i].kMin).toBe(cascades[i - 1].kMax);
    }
  });

  it("covers the whole spectrum from zero to unbounded", () => {
    const cascades = deriveCascades(patches);
    expect(cascades[0].kMin).toBe(0);
    expect(cascades[cascades.length - 1].kMax).toBe(Number.POSITIVE_INFINITY);
  });

  it("orders bands so longer patches carry lower wavenumbers", () => {
    const cascades = deriveCascades(patches);
    for (const cascade of cascades) {
      expect(cascade.kMax).toBeGreaterThan(cascade.kMin);
    }
    expect(cascades[0].kMax).toBeLessThan(cascades[1].kMax);
  });

  it("degenerates to a single full-spectrum band", () => {
    expect(deriveCascades([500])).toEqual([
      { patchSize: 500, kMin: 0, kMax: Number.POSITIVE_INFINITY },
    ]);
  });
});
