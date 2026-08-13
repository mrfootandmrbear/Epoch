/**
 * Within-herd coat variation.
 *
 * Two archetypes sharing one mesh made a large herd read as two clusters of
 * clones: every animal at a site carried the population's coat mean plus a
 * variation band too narrow to see. This widens the coat channels and gives
 * each site its own distribution, so one herd can be uniformly drab, another
 * split into a dark and a pale form, another graded from one to the other.
 *
 * No new simulated axis is involved. The sim still stores exactly two coat
 * means and no variance; this is renderer-side sampling around them, the same
 * cosmetic-versus-simulated split the shape channels already observe. Shape
 * stays on its narrow band deliberately -- per-axis trait variance is a
 * simulation question the wildlife roadmap has not answered yet, while coat
 * colour is already documented as phenotype the renderer may sample.
 */

export type CoatDistribution = "uniform" | "bimodal" | "graded";

export interface CoatSample {
  readonly warmth: number;
  readonly lightness: number;
}

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

const DISTRIBUTIONS: readonly CoatDistribution[] = ["uniform", "bimodal", "graded"];

/** Which coat pattern this site's herd carries. Stable for a given seed. */
export function coatDistribution(seed: number): CoatDistribution {
  return DISTRIBUTIONS[Math.floor(hash(seed, 613) * DISTRIBUTIONS.length)]!;
}

/** How wide this site spreads its coats around the population mean. */
export function coatSpread(seed: number): number {
  return 0.16 + hash(seed, 727) * 0.16;
}

/**
 * One animal's coat, sampled around the population means.
 *
 * The population mean is preserved: a bimodal site offsets its two forms in
 * inverse proportion to their shares, so splitting a herd into a dark and a
 * pale form does not quietly darken or lighten the population the simulation
 * resolved. Clamping at the ends of the range is the only thing that can shift
 * it, and only for a mean already sitting against a bound.
 */
export function sampleCoat(
  warmthMean: number,
  lightnessMean: number,
  index: number,
  seed: number,
): CoatSample {
  const spread = coatSpread(seed);
  const distribution = coatDistribution(seed);

  if (distribution === "bimodal") {
    // A site with two coat forms. Shares are seeded, and each form's offset is
    // weighted by the other's share so the herd mean lands on the population's.
    const paleShare = 0.3 + hash(seed, 839) * 0.4;
    const pale = hash(index * 7 + 3, seed + 941) < paleShare;
    const offset = spread * 1.7;
    const lightnessShift = pale ? offset * (1 - paleShare) : -offset * paleShare;
    // Warmth follows the same form but more weakly: the two morphs differ
    // mostly in how dark they are, not in hue.
    const warmthShift = lightnessShift * 0.45;
    const jitter = (channel: number) => (hash(index * 13 + channel, seed + channel * 31) - 0.5) * spread * 0.5;
    return {
      warmth: clamp01(warmthMean + warmthShift + jitter(5)),
      lightness: clamp01(lightnessMean + lightnessShift + jitter(6)),
    };
  }

  if (distribution === "graded") {
    // A cline: the palest animals are also the coolest, which reads as one
    // continuous run of coats rather than a scatter of unrelated ones.
    const position = (hash(index * 11 + 5, seed + 457) - 0.5) * 2;
    return {
      warmth: clamp01(warmthMean - position * spread * 0.8),
      lightness: clamp01(lightnessMean + position * spread),
    };
  }

  const jitter = (channel: number) => (hash(index * 13 + channel, seed + channel * 31) - 0.5) * spread * 2;
  return {
    warmth: clamp01(warmthMean + jitter(5)),
    lightness: clamp01(lightnessMean + jitter(6)),
  };
}
