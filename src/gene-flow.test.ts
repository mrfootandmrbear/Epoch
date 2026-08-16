import { describe, expect, it } from "vitest";
import type { ClimateForces } from "./climate";
import {
  driftPopulationTraits,
  meanPopulationTraits,
  populationTraitDistance,
  type LineageHistory,
  type LineageState,
} from "./lineage-history";
import { resolveIslandGeography, createSeaLevelHistory, recordSeaLevel } from "./island-geography";
import { POPULATION_TRAIT_BOUNDS, POPULATION_TRAIT_KEYS, type PopulationTraits } from "./population-traits";
import { resolveLanding } from "./outcome-resolver";
import { captureWorldSnapshot } from "./world-snapshot";

/**
 * These exercise the population *consumer* of island geography: the resolver
 * reads which land component a population stands on, homogenizes interbreeding
 * neighbours, and branches a lineage only when geography — not elapsed time —
 * isolates part of it. Every case threads a geography into `resolveLanding`;
 * the geography-free legacy path is covered by `determinism.test.ts`.
 */

const PRESENT: Readonly<ClimateForces> = {
  rainfall: "temperate", temperature: "mild", wind: "westerly", seaLevel: "present",
};
const HIGH: Readonly<ClimateForces> = { ...PRESENT, seaLevel: "high" };

// Peaks sit far enough apart that a full million-year migration reach (~368 m,
// keyed to the real 2 km world) cannot carry a population across the water
// between them — so a lineage genuinely stays put unless it *branches* across.
const PEAK = 450;

/** Two mirror-image cones, deep water between them: two islands at any tested stand. */
function twoIslands(x: number, z: number): number {
  const cone = (peakX: number) => 40 - 0.4 * Math.hypot(x - peakX, z);
  return Math.max(cone(-PEAK), cone(PEAK), -50);
}

/** One cone at the origin: a single island, so no allopatric split is possible. */
function oneIsland(x: number, z: number): number {
  return Math.max(40 - 0.35 * Math.hypot(x, z), -50);
}

/**
 * Two cones joined by an isthmus that sags to +2 m at the origin and rises
 * toward each cone. Land at the present stand (one island); at the high stand
 * the sag drowns first, so the two ranges part along the origin — a bridge to
 * lose, with a well-defined col to record.
 */
function bridgedIslands(x: number, z: number): number {
  const cone = (peakX: number) => 40 - 0.4 * Math.hypot(x - peakX, z);
  const isthmus = Math.abs(x) < PEAK && Math.abs(z) < 12 ? 2 + Math.abs(x) / 200 : -50;
  return Math.max(cone(-PEAK), cone(PEAK), isthmus, -50);
}

function sampledGrid(heightAt: (x: number, z: number) => number, side: number, extent: number) {
  const elevations = new Float32Array(side * side);
  for (let z = 0; z < side; z++) {
    for (let x = 0; x < side; x++) {
      elevations[z * side + x] = heightAt((x / (side - 1) - 0.5) * extent, (z / (side - 1) - 0.5) * extent);
    }
  }
  return { side, extent, elevations };
}

function shield(id: string, crustX: number, crustZ: number) {
  return { id, birthYear: 0, crustX, crustZ, construction: 1, dormantYears: 0 };
}

const NIMBLE: PopulationTraits = {
  bodyMass: 0.8, legLength: 1.3, footWidth: 0.7, insulation: 0.15,
  coatLightness: 0.78, coatWarmth: 0.2, hornLength: 1.32,
};
const BULKY: PopulationTraits = {
  bodyMass: 1.35, legLength: 0.75, footWidth: 1.3, insulation: 0.85,
  coatLightness: 0.2, coatWarmth: 0.85, hornLength: 0.55,
};

function grazer(id: string, site: { x: number; z: number }, traits: PopulationTraits): LineageState {
  return {
    id, originAge: 0, generation: 0, identity: "sheltered-grazer", status: "active",
    site, traits, abundance: 0.5, energy: 0.72, feedingAdaptation: 1,
  };
}

const SIDE = 141;
const EXTENT = 1_200;
const CONE_A = { x: -PEAK, z: 0 };
const CONE_B = { x: PEAK, z: 0 };

function resolveWith(
  heightAt: (x: number, z: number) => number,
  lineages: readonly LineageState[],
  climate: Readonly<ClimateForces>,
  totalYears: number,
  jumpYears: number,
  options: {
    side?: number;
    shields?: ReturnType<typeof shield>[];
    seaLevelHistory?: ReturnType<typeof createSeaLevelHistory>;
  } = {},
) {
  const side = options.side ?? SIDE;
  const seaLevel = { low: -2, present: 0, high: 3 }[climate.seaLevel];
  const snapshot = captureWorldSnapshot(heightAt, totalYears, climate, side, EXTENT);
  const geography = resolveIslandGeography(
    sampledGrid(heightAt, side, EXTENT), seaLevel, options.shields ?? [],
  );
  const history: LineageHistory = { lineages: [...lineages] };
  return resolveLanding(snapshot, history, jumpYears, undefined, undefined, geography, options.seaLevelHistory);
}

describe("gene flow reads island membership", () => {
  it("pulls two interbreeding neighbours on one island toward a shared mean", () => {
    const inheritedApart = populationTraitDistance(NIMBLE, BULKY);
    const together = resolveWith(
      twoIslands,
      [grazer("sheltered-grazer:0", { x: -PEAK - 12, z: 0 }, NIMBLE), grazer("sheltered-grazer:1", { x: -PEAK + 12, z: 0 }, BULKY)],
      PRESENT, 100_000, 999,
    );
    const a = together.nextHistory.lineages.find((l) => l.id === "sheltered-grazer:0")!;
    const b = together.nextHistory.lineages.find((l) => l.id === "sheltered-grazer:1")!;

    // Both survived on the same island (cone A) and interbred.
    expect(a.status).toBe("active");
    expect(b.status).toBe("active");
    // Gene flow closed the gap relative to what they inherited...
    expect(populationTraitDistance(a.traits!, b.traits!)).toBeLessThan(inheritedApart);
    // ...and it was recorded on both changes as a positive amount closed.
    for (const id of ["sheltered-grazer:0", "sheltered-grazer:1"]) {
      const change = together.changes.find((c) => c.id === id)!;
      expect(change.geneFlow).toBeGreaterThan(0);
    }
  });

  it("does not homogenize the same pair once a water gap separates them", () => {
    const together = resolveWith(
      twoIslands,
      [grazer("sheltered-grazer:0", { x: -PEAK - 12, z: 0 }, NIMBLE), grazer("sheltered-grazer:1", { x: -PEAK + 12, z: 0 }, BULKY)],
      PRESENT, 100_000, 999,
    );
    const apart = resolveWith(
      twoIslands,
      [grazer("sheltered-grazer:0", CONE_A, NIMBLE), grazer("sheltered-grazer:1", CONE_B, BULKY)],
      PRESENT, 100_000, 999,
    );
    const distance = (r: typeof together) => populationTraitDistance(
      r.nextHistory.lineages.find((l) => l.id === "sheltered-grazer:0")!.traits!,
      r.nextHistory.lineages.find((l) => l.id === "sheltered-grazer:1")!.traits!,
    );

    // Separated, they diverge more than the interbreeding pair — isolation, not
    // distance alone, is what lets two populations stay apart.
    expect(distance(apart)).toBeGreaterThan(distance(together));
    // And no gene flow is recorded for a population with no island neighbour.
    for (const id of ["sheltered-grazer:0", "sheltered-grazer:1"]) {
      expect(apart.changes.find((c) => c.id === id)!.geneFlow).toBeUndefined();
    }
  });
});

describe("branching is driven by isolation, not elapsed time", () => {
  it("never branches on a single-island world, however deep the jump", () => {
    const resolution = resolveWith(
      oneIsland,
      [grazer("sheltered-grazer:0", { x: 0, z: 0 }, NIMBLE)],
      PRESENT, 5_000_000, 1_000_000,
    );
    expect(resolution.nextHistory.lineages.every((l) => l.parentId === undefined)).toBe(true);
  });

  it("branches to a separate island when the epoch is long enough to cross water", () => {
    const resolution = resolveWith(
      twoIslands,
      [grazer("sheltered-grazer:0", CONE_A, NIMBLE)],
      PRESENT, 1_001_000, 1_000_000,
    );
    const child = resolution.nextHistory.lineages.find((l) => l.parentId !== undefined);

    expect(child).toBeDefined();
    expect(child).toMatchObject({ parentId: "sheltered-grazer:0", generation: 1, status: "active" });
    // The branch stands on a different island than the parent.
    const parent = resolution.nextHistory.lineages.find((l) => l.id === "sheltered-grazer:0")!;
    expect(Math.sign(child!.site!.x)).not.toBe(Math.sign(parent.site!.x));
    // Ancestry names the recorded cause: a water crossing with no bridge to lose.
    expect(child!.origin).toMatchObject({ isolatedFromId: "sheltered-grazer:0", basis: "dispersal" });
    const change = resolution.changes.find((c) => c.id === child!.id)!;
    expect(change).toMatchObject({ event: "speciated", isolation: { basis: "dispersal" } });
  });

  it("does not cross water on a jump too short for a dispersal to be credible", () => {
    const resolution = resolveWith(
      twoIslands,
      [grazer("sheltered-grazer:0", CONE_A, NIMBLE)],
      PRESENT, 1_100, 100,
    );
    expect(resolution.nextHistory.lineages.every((l) => l.parentId === undefined)).toBe(true);
  });

  it("dates a vicariant split to the year its land bridge drowned", () => {
    // Present stand: one island across a +2 m isthmus. High stand: two islands.
    let seaLevelHistory = createSeaLevelHistory();
    seaLevelHistory = recordSeaLevel(seaLevelHistory, 0, 1_000, 0);        // connected
    seaLevelHistory = recordSeaLevel(seaLevelHistory, 1_000, 1_000_000, 3); // bridge drowns at 1,000

    const resolution = resolveWith(
      bridgedIslands,
      [grazer("sheltered-grazer:0", CONE_A, NIMBLE)],
      HIGH, 1_001_000, 1_000_000,
      {
        shields: [shield("shield-0", -PEAK, 0), shield("shield-1", PEAK, 0)],
        seaLevelHistory,
      },
    );
    const child = resolution.nextHistory.lineages.find((l) => l.parentId !== undefined);

    expect(child?.origin).toMatchObject({ basis: "vicariance", isolatedSinceYear: 1_000 });
    // The lost bridge is recorded at the origin sag it drowned along.
    expect(Math.abs(child!.origin!.bridgeX ?? 999)).toBeLessThan(60);
    expect(Math.abs(child!.origin!.bridgeZ ?? 999)).toBeLessThan(20);
    expect(resolution.changes.find((c) => c.id === child!.id)!.isolation?.basis).toBe("vicariance");
  });
});

describe("drift and shared-mean helpers", () => {
  it("drifts deterministically, keeps traits in bounds, and moves them off the parent", () => {
    const first = driftPopulationTraits(NIMBLE, 12_345, 1);
    const second = driftPopulationTraits(NIMBLE, 12_345, 1);
    const other = driftPopulationTraits(NIMBLE, 67_890, 1);

    expect(first).toEqual(second); // same seed, same drift — capture mode is deterministic
    expect(populationTraitDistance(first, other)).toBeGreaterThan(0); // different seeds diverge
    expect(populationTraitDistance(first, NIMBLE)).toBeGreaterThan(0); // drift actually moved it
    for (const key of POPULATION_TRAIT_KEYS) {
      expect(first[key]).toBeGreaterThanOrEqual(POPULATION_TRAIT_BOUNDS[key].min);
      expect(first[key]).toBeLessThanOrEqual(POPULATION_TRAIT_BOUNDS[key].max);
    }
  });

  it("does not perturb traits when the drift dose is zero", () => {
    expect(driftPopulationTraits(BULKY, 42, 0)).toEqual(BULKY);
  });

  it("averages a set of populations into their trait-space centroid", () => {
    const mean = meanPopulationTraits([NIMBLE, BULKY]);
    for (const key of POPULATION_TRAIT_KEYS) {
      expect(mean[key]).toBeCloseTo((NIMBLE[key] + BULKY[key]) / 2, 6);
    }
  });
});

describe("the geography path stays deterministic", () => {
  it("resolves byte-identical lineage state for identical inputs", () => {
    const run = () => resolveWith(
      twoIslands,
      [grazer("sheltered-grazer:0", CONE_A, NIMBLE), grazer("ridge-grazer:0", CONE_B, BULKY)],
      PRESENT, 1_001_000, 1_000_000,
    ).nextHistory.lineages;
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});
