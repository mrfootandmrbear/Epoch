import { describe, expect, it } from "vitest";
import { approachHeading, deriveHerdBehavior, herdLayoutRadius, turnRadius } from "./herd-behavior";
import { POPULATION_TRAIT_BOUNDS, type PopulationTraits } from "./population-traits";

const MIDDLE: PopulationTraits = {
  bodyMass: 1,
  legLength: 1,
  footWidth: 1,
  insulation: 0.5,
  coatLightness: 0.5,
  coatWarmth: 0.5,
  hornLength: 1,
};

function withTraits(overrides: Partial<PopulationTraits>): PopulationTraits {
  return { ...MIDDLE, ...overrides };
}

const { bodyMass, legLength, insulation } = POPULATION_TRAIT_BOUNDS;

describe("trait-driven herd behavior", () => {
  it("gives long legs a longer stride than short ones", () => {
    const tall = deriveHerdBehavior(withTraits({ legLength: legLength.max }));
    const short = deriveHerdBehavior(withTraits({ legLength: legLength.min }));
    expect(tall.strideSpeed).toBeGreaterThan(short.strideSpeed);
  });

  it("slows a heavy population relative to a light one", () => {
    const heavy = deriveHerdBehavior(withTraits({ bodyMass: bodyMass.max }));
    const light = deriveHerdBehavior(withTraits({ bodyMass: bodyMass.min }));
    expect(heavy.strideSpeed).toBeLessThan(light.strideSpeed);
  });

  it("turns a heavy long-legged population through a wider radius", () => {
    const bulky = deriveHerdBehavior(withTraits({
      bodyMass: bodyMass.max,
      legLength: legLength.max,
    }));
    const nimble = deriveHerdBehavior(withTraits({
      bodyMass: bodyMass.min,
      legLength: legLength.min,
    }));
    expect(bulky.turnRate).toBeLessThan(nimble.turnRate);
    expect(turnRadius(bulky)).toBeGreaterThan(turnRadius(nimble));
  });

  it("spaces bigger bodies further apart", () => {
    const big = deriveHerdBehavior(withTraits({ bodyMass: bodyMass.max }));
    const small = deriveHerdBehavior(withTraits({ bodyMass: bodyMass.min }));
    expect(big.spacing).toBeGreaterThan(small.spacing);
  });

  it("packs an insulated herd tighter than a bare-coated one", () => {
    const cold = deriveHerdBehavior(withTraits({ insulation: insulation.max }));
    const hot = deriveHerdBehavior(withTraits({ insulation: insulation.min }));
    expect(cold.cohesionRadius).toBeLessThan(hot.cohesionRadius);
    expect(cold.spacing).toBeLessThan(hot.spacing);
    expect(cold.cohesionStrength).toBeGreaterThan(hot.cohesionStrength);
  });

  it("never lets separation push past the distance cohesion pulls back from", () => {
    // Otherwise the two forces cancel in place and the herd reads as jitter.
    for (const mass of [bodyMass.min, 1, bodyMass.max]) {
      for (const coat of [insulation.min, 0.5, insulation.max]) {
        const behavior = deriveHerdBehavior(withTraits({ bodyMass: mass, insulation: coat }));
        expect(behavior.cohesionRadius).toBeGreaterThan(behavior.spacing);
      }
    }
  });

  it("keeps every channel finite and positive across the trait bounds", () => {
    for (const mass of [bodyMass.min, bodyMass.max]) {
      for (const leg of [legLength.min, legLength.max]) {
        for (const coat of [insulation.min, insulation.max]) {
          const behavior = deriveHerdBehavior(withTraits({
            bodyMass: mass, legLength: leg, insulation: coat,
          }));
          for (const [channel, value] of Object.entries(behavior)) {
            expect(Number.isFinite(value), `${channel} finite`).toBe(true);
            expect(value, `${channel} positive`).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("separates two plausible archetypes far enough to read at mid distance", () => {
    // Rung 7 asks that two populations be distinguishable from movement alone.
    // The contrast that matters is the ecological one: a heavy, short-legged,
    // well-insulated cold grazer against a light, long-legged, bare-coated
    // one. A difference under roughly a third would not survive the viewing
    // distance, so the mapping is held to that on every channel.
    const coldHeavy = deriveHerdBehavior(withTraits({
      bodyMass: bodyMass.max, legLength: legLength.min, insulation: insulation.max,
    }));
    const hotLight = deriveHerdBehavior(withTraits({
      bodyMass: bodyMass.min, legLength: legLength.max, insulation: insulation.min,
    }));

    // The light long-legged herd moves faster and holds a much looser group.
    expect(hotLight.strideSpeed / coldHeavy.strideSpeed).toBeGreaterThan(1.35);
    expect(hotLight.cohesionRadius / coldHeavy.cohesionRadius).toBeGreaterThan(1.35);

    // Spacing runs the other way, and should: mass owns how much room a body
    // needs, and it outweighs the tightening insulation contributes. Cluster
    // tightness is carried by cohesion radius, which insulation owns outright.
    expect(coldHeavy.spacing / hotLight.spacing).toBeGreaterThan(1.35);
  });
});

/**
 * Drives one animal through a full course reversal using the same two
 * functions the renderer uses, and reports how far it swings off the start
 * line doing it. This is the arc a viewer actually sees, so it is worth
 * measuring rather than inferring from the parameters.
 */
function reversalArc(traits: PopulationTraits): { width: number; seconds: number } {
  const behavior = deriveHerdBehavior(traits);
  const delta = 1 / 60;
  let heading = 0;
  let x = 0;
  let z = 0;
  let width = 0;
  let steps = 0;
  // Asked to travel due west while currently pointing due east.
  while (Math.abs(heading - Math.PI) > 0.01 && steps < 6000) {
    heading = approachHeading(heading, Math.PI, behavior.turnRate * delta);
    x += Math.cos(heading) * behavior.strideSpeed * delta;
    z += -Math.sin(heading) * behavior.strideSpeed * delta;
    width = Math.max(width, Math.abs(z));
    steps++;
  }
  return { width, seconds: steps * delta };
}

describe("movement a viewer can read", () => {
  it("swings a heavy long-legged herd through a visibly wider arc", () => {
    const bulky = reversalArc(withTraits({
      bodyMass: bodyMass.max, legLength: legLength.max,
    }));
    const nimble = reversalArc(withTraits({
      bodyMass: bodyMass.min, legLength: legLength.min,
    }));

    // Both complete the turn, and the heavy one sweeps far enough wider that
    // the difference survives a mid-distance view.
    expect(bulky.seconds).toBeGreaterThan(nimble.seconds);
    expect(bulky.width / nimble.width).toBeGreaterThan(2);
    // In metres, not ratios: the arcs differ by more than a body length.
    expect(bulky.width - nimble.width).toBeGreaterThan(2);
  });

  it("covers visibly different ground in the same span of time", () => {
    const fast = deriveHerdBehavior(withTraits({
      bodyMass: bodyMass.min, legLength: legLength.max,
    }));
    const slow = deriveHerdBehavior(withTraits({
      bodyMass: bodyMass.max, legLength: legLength.min,
    }));
    // Over ten seconds of open walking the gap is tens of metres, which is
    // plainly visible even when individual animals are small on screen.
    expect((fast.strideSpeed - slow.strideSpeed) * 10).toBeGreaterThan(15);
  });
});

describe("herd layout", () => {
  it("expands a full herd enough to begin outside its separation distance", () => {
    const count = 96;
    const spacing = deriveHerdBehavior(withTraits({
      bodyMass: bodyMass.max,
      insulation: insulation.max,
    })).spacing;
    const radius = herdLayoutRadius(count, spacing, 11);
    const points = Array.from({ length: count }, (_, index) => {
      const radial = Math.sqrt((index + 0.5) / count) * radius;
      const angle = index * 2.399963;
      return { x: Math.cos(angle) * radial, z: Math.sin(angle) * radial };
    });
    let nearest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < points.length; i++) {
      for (let j = 0; j < i; j++) {
        nearest = Math.min(nearest, Math.hypot(points[i]!.x - points[j]!.x, points[i]!.z - points[j]!.z));
      }
    }
    expect(nearest).toBeGreaterThanOrEqual(spacing);
  });

  it("honours a deliberately wider composition", () => {
    expect(herdLayoutRadius(12, 3, 40)).toBe(40);
  });
});

describe("heading approach", () => {
  it("snaps to the target when it is within reach", () => {
    expect(approachHeading(0, 0.1, 0.5)).toBeCloseTo(0.1, 10);
  });

  it("moves only as far as the turn rate allows", () => {
    expect(approachHeading(0, 3, 0.5)).toBeCloseTo(0.5, 10);
    expect(approachHeading(0, -3, 0.5)).toBeCloseTo(-0.5, 10);
  });

  it("takes the short way around the wrap point", () => {
    // Just under +pi to just over -pi is a nudge, not a near-full rotation.
    const next = approachHeading(Math.PI - 0.05, -Math.PI + 0.05, 0.5);
    expect(next).toBeCloseTo(-Math.PI + 0.05, 10);
  });

  it("does not spin the long way for a turn beyond the wrap point", () => {
    const next = approachHeading(Math.PI - 0.1, -Math.PI + 0.9, 0.2);
    // The short way is forward through +pi, so the heading increases.
    expect(next).toBeCloseTo(Math.PI + 0.1, 10);
  });

  it("holds a heading that is already correct", () => {
    expect(approachHeading(1.2, 1.2, 0.3)).toBeCloseTo(1.2, 10);
  });
});
