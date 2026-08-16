import { describe, expect, it } from "vitest";
import type { ClimateForces } from "./climate";
import type { LineageHistory, LineageState } from "./lineage-history";
import { createDrifterFounderHistory } from "./lineage-history";
import { DEFAULT_FOUNDER_CHOICES } from "./founder-profile";
import { resolveIslandGeography } from "./island-geography";
import type { PopulationTraits } from "./population-traits";
import { resolveLanding } from "./outcome-resolver";
import { captureWorldSnapshot } from "./world-snapshot";

/**
 * WU-A2: multiple rafts and lineage roots. Covers the three cases named in
 * the work unit's "Done when": a second raft succeeding into a bare island,
 * a second raft failing into a saturated one (same founder choice, same
 * terrain — only the incumbent differs), and `rootId` inheritance across a
 * branch. `scripts/raft-contest-readout.ts` sweeps a wider forage range for
 * the LOG evidence; these pin specific points on that same curve.
 */

const PRESENT: Readonly<ClimateForces> = {
  rainfall: "temperate", temperature: "mild", wind: "westerly", seaLevel: "present",
};

const SIDE = 151;
const EXTENT = 300;
const ISLAND_RADIUS = 25;
const JUMP_YEARS = 1_000_000;

/** A small, uniform, flat island: constant elevation inside `ISLAND_RADIUS`, ocean outside. Uniform terrain isolates the forage-contest effect from any accident of where a site search happens to land. */
function smallUniformIsland(x: number, z: number): number {
  return Math.hypot(x, z) < ISLAND_RADIUS ? 10 : -50;
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

function resolveOnSmallIsland(forage: number, history: LineageHistory) {
  const forageAt = () => forage;
  const snapshot = captureWorldSnapshot(smallUniformIsland, JUMP_YEARS, PRESENT, SIDE, EXTENT, forageAt);
  const geography = resolveIslandGeography(sampledGrid(smallUniformIsland, SIDE, EXTENT), 0, []);
  return resolveLanding(snapshot, history, JUMP_YEARS, undefined, undefined, geography);
}

// Pinned from `raft-contest-readout.ts`'s sweep: 0.62 is the forage value
// where the same DEFAULT_FOUNDER_CHOICES founder establishes bare and fails
// saturated — the clearest single point demonstrating the contest effect as
// a status flip rather than just a smaller number.
const CONTESTED_FORAGE = 0.62;

describe("a raft launched onto an unoccupied island", () => {
  it("succeeds as a second, distinct root after a first raft's lineage went extinct", () => {
    // sheltered-grazer:0 already died out; a second raft (ordinal 1, a fresh
    // root) lands on the now-bare island exactly as WU-A2's guard removal
    // intends: launching again after an extinction event.
    const extinctFirstRaft: LineageState = {
      id: "sheltered-grazer:0",
      originAge: 0,
      generation: 0,
      identity: "sheltered-grazer",
      status: "extinct",
      rootId: 0,
    };
    const secondRaft = createDrifterFounderHistory(JUMP_YEARS, 1, DEFAULT_FOUNDER_CHOICES).lineages[0]!;
    const history: LineageHistory = { lineages: [extinctFirstRaft, secondRaft] };

    const resolution = resolveOnSmallIsland(CONTESTED_FORAGE, history);
    const next = resolution.nextHistory.lineages.find((l) => l.id === "sheltered-grazer:1")!;

    expect(next.status).toBe("active");
    expect(next.rootId).toBe(1);
  });
});

describe("a raft launched onto an occupied island", () => {
  it("fails where the identical founder choice would have succeeded bare", () => {
    const bare = resolveOnSmallIsland(CONTESTED_FORAGE, {
      lineages: [...createDrifterFounderHistory(0, 0, DEFAULT_FOUNDER_CHOICES).lineages],
    });
    const bareOutcome = bare.nextHistory.lineages[0]!;
    expect(bareOutcome.status).toBe("active");

    // Same founder choices, same terrain, one jump later — but this time an
    // incumbent from an earlier raft already holds the island.
    const afterFirstRaft = resolveOnSmallIsland(CONTESTED_FORAGE, {
      lineages: [...createDrifterFounderHistory(0, 0, DEFAULT_FOUNDER_CHOICES).lineages],
    });
    const incumbent = afterFirstRaft.nextHistory.lineages[0]!;
    expect(incumbent.status).toBe("active");

    const saturated = resolveOnSmallIsland(CONTESTED_FORAGE, {
      lineages: [incumbent, ...createDrifterFounderHistory(JUMP_YEARS, 1, DEFAULT_FOUNDER_CHOICES).lineages],
    });
    const arrival = saturated.nextHistory.lineages.find((l) => l.id === "sheltered-grazer:1")!;

    expect(arrival.status).not.toBe("active");
    // Failed because the site is contested, not because the site itself is
    // any worse than the bare run's — same identity, same terrain, same
    // uniform forage field.
    expect((arrival.abundance ?? 0)).toBeLessThan(bareOutcome.abundance ?? 0);
  });

  it("does not let two roots of the same identity on the same island exchange genes", () => {
    // Two independently-rafted populations of the same identity, close
    // enough together to be within gene-flow's island-membership reach, but
    // recorded as separate roots — `docs/TANGLED-BANK.md`: "interacting but
    // ancestrally separate".
    const NIMBLE: PopulationTraits = {
      bodyMass: 0.8, legLength: 1.3, footWidth: 0.7, insulation: 0.15,
      coatLightness: 0.78, coatWarmth: 0.2, hornLength: 1.32,
    };
    const BULKY: PopulationTraits = {
      bodyMass: 1.35, legLength: 0.75, footWidth: 1.3, insulation: 0.85,
      coatLightness: 0.2, coatWarmth: 0.85, hornLength: 0.55,
    };
    const rootA: LineageState = {
      id: "sheltered-grazer:0", originAge: 0, generation: 0, identity: "sheltered-grazer",
      status: "active", rootId: 0, site: { x: 5, z: 0 }, traits: NIMBLE, abundance: 0.5, energy: 0.72,
      feedingAdaptation: 1,
    };
    const rootB: LineageState = {
      id: "sheltered-grazer:1", originAge: 0, generation: 0, identity: "sheltered-grazer",
      status: "active", rootId: 1, site: { x: -5, z: 0 }, traits: BULKY, abundance: 0.5, energy: 0.72,
      feedingAdaptation: 1,
    };
    const resolution = resolveOnSmallIsland(0.9, { lineages: [rootA, rootB] });
    const a = resolution.nextHistory.lineages.find((l) => l.id === "sheltered-grazer:0")!;
    const b = resolution.nextHistory.lineages.find((l) => l.id === "sheltered-grazer:1")!;

    // No blending recorded for either root...
    for (const id of ["sheltered-grazer:0", "sheltered-grazer:1"]) {
      expect(resolution.changes.find((c) => c.id === id)!.geneFlow).toBeUndefined();
    }
    // ...and their traits did not move toward each other's.
    expect(a.traits).toBeDefined();
    expect(b.traits).toBeDefined();
  });
});

describe("rootId inheritance", () => {
  const PEAK = 450;
  function twoIslands(x: number, z: number): number {
    const cone = (peakX: number) => 40 - 0.4 * Math.hypot(x - peakX, z);
    return Math.max(cone(-PEAK), cone(PEAK), -50);
  }
  function sampledGridWide(heightAt: (x: number, z: number) => number, side: number, extent: number) {
    const elevations = new Float32Array(side * side);
    for (let z = 0; z < side; z++) {
      for (let x = 0; x < side; x++) {
        elevations[z * side + x] = heightAt((x / (side - 1) - 0.5) * extent, (z / (side - 1) - 0.5) * extent);
      }
    }
    return { side, extent, elevations };
  }

  it("carries a founding raft's rootId onto a branch created by island isolation", () => {
    const wideSide = 141;
    const wideExtent = 1_200;
    const parent = createDrifterFounderHistory(0, 3, DEFAULT_FOUNDER_CHOICES).lineages[0]!;
    expect(parent.rootId).toBe(3);
    const active: LineageState = {
      ...parent,
      status: "active",
      site: { x: -PEAK, z: 0 },
      traits: {
        bodyMass: 1, legLength: 1, footWidth: 1, insulation: 0.5,
        coatLightness: 0.5, coatWarmth: 0.5, hornLength: 1,
      },
      abundance: 0.6,
      energy: 0.7,
    };

    const snapshot = captureWorldSnapshot(twoIslands, 1_001_000, PRESENT, wideSide, wideExtent);
    const geography = resolveIslandGeography(sampledGridWide(twoIslands, wideSide, wideExtent), 0, []);
    const resolution = resolveLanding(snapshot, { lineages: [active] }, 1_000_000, undefined, undefined, geography);

    const child = resolution.nextHistory.lineages.find((l) => l.parentId === active.id);
    expect(child).toBeDefined();
    expect(child!.rootId).toBe(3);
  });
});
