import { describe, expect, it } from "vitest";
import { deriveHerdBehavior, herdLayoutRadius } from "./herd-behavior";
import {
  seatHerdOnIsland,
  visibleHerdCount,
  type HerdPlacementQuery,
} from "./herd-placement";
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

const CAPACITY = 96;

function straitQuery(): HerdPlacementQuery {
  return {
    islandAt(x) {
      if (x <= -10) return "island-a";
      if (x >= 10) return "island-b";
      return null;
    },
    walkable(x, z) {
      return Math.abs(z) <= 80 && (x <= -10 || x >= 10);
    },
  };
}

describe("visible herd count", () => {
  it("scales drawn animals with abundance instead of filling the cap", () => {
    expect(visibleHerdCount(0.062, CAPACITY)).toBe(6);
    expect(visibleHerdCount(0.12, CAPACITY)).toBe(12);
    expect(visibleHerdCount(0.418, CAPACITY)).toBe(41);
    expect(visibleHerdCount(1, CAPACITY)).toBe(CAPACITY);
  });

  it("does not emit ninety-six animals for a thin established founder", () => {
    expect(visibleHerdCount(0.062, CAPACITY)).toBeLessThan(20);
  });
});

describe("herd seating on islands", () => {
  const spacing = deriveHerdBehavior(MIDDLE).spacing;
  const query = straitQuery();

  it("keeps a coastal parent off the neighbouring island's beach", () => {
    const seats = seatHerdOnIsland({
      siteX: -14,
      siteZ: 0,
      visibleCount: 24,
      capacity: CAPACITY,
      spacing,
      seed: 17,
      homeIsland: "island-a",
      query,
    });
    const drawn = seats.filter((seat) => seat.visible);
    expect(drawn.length).toBeGreaterThan(12);
    for (const seat of drawn) {
      expect(query.islandAt(seat.x, seat.z), `seat ${seat.x.toFixed(1)},${seat.z.toFixed(1)}`).toBe("island-a");
      expect(seat.x).toBeLessThanOrEqual(-10);
    }
  });

  it("seats a branch only on its own island", () => {
    const seats = seatHerdOnIsland({
      siteX: 22,
      siteZ: -4,
      visibleCount: 12,
      capacity: CAPACITY,
      spacing,
      seed: 91,
      homeIsland: "island-b",
      query,
    });
    const drawn = seats.filter((seat) => seat.visible);
    expect(drawn.length).toBe(12);
    for (const seat of drawn) {
      expect(query.islandAt(seat.x, seat.z)).toBe("island-b");
    }
  });

  it("does not pack a full herd into an 11 m radius", () => {
    const count = CAPACITY;
    const bulkySpacing = deriveHerdBehavior({
      ...MIDDLE,
      bodyMass: POPULATION_TRAIT_BOUNDS.bodyMass.max,
    }).spacing;
    const seats = seatHerdOnIsland({
      siteX: -40,
      siteZ: 0,
      visibleCount: count,
      capacity: CAPACITY,
      spacing: bulkySpacing,
      seed: 3,
      homeIsland: "island-a",
      query,
    });
    const drawn = seats.filter((seat) => seat.visible);
    expect(drawn.length).toBe(count);
    const layoutFloor = herdLayoutRadius(count, bulkySpacing);
    expect(layoutFloor).toBeGreaterThan(11);
    let farthest = 0;
    for (const seat of drawn) {
      farthest = Math.max(farthest, Math.hypot(seat.x + 40, seat.z));
    }
    expect(farthest).toBeGreaterThan(11);
  });

  it("hides slots beyond the abundance-driven count", () => {
    const seats = seatHerdOnIsland({
      siteX: -40,
      siteZ: 0,
      visibleCount: 6,
      capacity: CAPACITY,
      spacing,
      seed: 8,
      homeIsland: "island-a",
      query,
    });
    expect(seats.filter((seat) => seat.visible)).toHaveLength(6);
    expect(seats.filter((seat) => !seat.visible)).toHaveLength(CAPACITY - 6);
  });
});
