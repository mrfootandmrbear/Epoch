import { describe, expect, it } from "vitest";
import { createSeededRandom } from "./fft-ocean";

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
