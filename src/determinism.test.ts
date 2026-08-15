import { describe, expect, it } from "vitest";
import type { ClimateForces } from "./climate";
import { createLineageHistory, type LineageHistory } from "./lineage-history";
import { POPULATION_TRAIT_KEYS } from "./population-traits";
import { resolveLanding } from "./outcome-resolver";
import { captureWorldSnapshot } from "./world-snapshot";
import { AUTHORED_SCALE, RENDER_SCALE } from "./render-scale";

/**
 * The baseline runs at the world's real proportions.
 *
 * It used to use `captureWorldSnapshot`'s defaults — a 300 m extent with a
 * 145 m island — which is why it passed unchanged straight through the 2 km
 * resize: a determinism baseline taken at proportions the game never runs at
 * cannot notice a world-scale change. The grid is deliberately coarser than
 * the shipping 401² so four jumps stay fast; it is the *extent* that has to be
 * honest here, not the cell size.
 */
const FIXTURE_GRID = 201;
const FIXTURE_EXTENT = RENDER_SCALE.islandExtent;

const TERRAIN_SEED = 194_211;

const jumpSequence: ReadonlyArray<Readonly<{
  years: number;
  climate: Readonly<ClimateForces>;
}>> = [
  {
    years: 100,
    climate: { rainfall: "temperate", temperature: "mild", wind: "westerly", seaLevel: "present" },
  },
  {
    years: 1_000,
    climate: { rainfall: "wet", temperature: "warm", wind: "easterly", seaLevel: "high" },
  },
  {
    years: 25_000,
    climate: { rainfall: "arid", temperature: "cold", wind: "calm", seaLevel: "low" },
  },
  {
    years: 1_000_000,
    climate: { rainfall: "temperate", temperature: "mild", wind: "westerly", seaLevel: "present" },
  },
];

function seededNoise(x: number, z: number): number {
  const value = Math.sin(x * 0.071 + z * 0.113 + TERRAIN_SEED * 0.001) * 43_758.5453;
  return value - Math.floor(value);
}

function fixedHeightfield(x: number, z: number): number {
  const radius = Math.hypot(x, z);
  const island = 34 * Math.max(0, 1 - radius / (145 * AUTHORED_SCALE));
  const ridges = Math.sin(x * 0.045 / AUTHORED_SCALE) * 5 + Math.cos(z * 0.038 / AUTHORED_SCALE) * 4;
  const detail = (seededNoise(Math.floor(x / (6 * AUTHORED_SCALE)), Math.floor(z / (6 * AUTHORED_SCALE))) - 0.5) * 3;
  return island + ridges + detail - 5;
}

type JumpState = Readonly<{ totalYears: number; lineages: LineageHistory["lineages"] }>;

function runJumpSequence(): readonly JumpState[] {
  let totalYears = 0;
  let history: LineageHistory = createLineageHistory();
  const semanticState: Array<Readonly<{ totalYears: number; lineages: LineageHistory["lineages"] }>> = [];

  for (const jump of jumpSequence) {
    totalYears += jump.years;
    const snapshot = captureWorldSnapshot(
      fixedHeightfield, totalYears, jump.climate, FIXTURE_GRID, FIXTURE_EXTENT,
    );
    const resolution = resolveLanding(snapshot, history, jump.years);
    history = resolution.nextHistory;
    semanticState.push({ totalYears, lineages: history.lineages });
  }

  return semanticState;
}

function ecologicalProjection(states: readonly JumpState[]): unknown {
  return states.map(({ totalYears, lineages }) => ({
    totalYears,
    lineages: lineages.map(({ identity, status, site, traits }) => ({
      identity,
      status,
      ...(site ? { site } : {}),
      ...(traits ? { traits } : {}),
    })),
  }));
}

describe("epoch jump determinism", () => {
  it("resolves byte-identical semantic state for identical inputs", () => {
    expect(JSON.stringify(runJumpSequence())).toBe(JSON.stringify(runJumpSequence()));
  });

  it("preserves the committed ecological baseline", () => {
    expect(ecologicalProjection(runJumpSequence())).toMatchSnapshot();
  });

  it("retains stable root identity metadata across jumps", () => {
    for (const { lineages } of runJumpSequence()) {
      const roots = lineages.filter((lineage) => lineage.parentId === undefined);
      expect(roots.map((lineage) => lineage.id)).toEqual([
        "sheltered-grazer:0",
        "ridge-grazer:0",
      ]);
      for (const lineage of roots) {
        expect(lineage.originAge).toBe(0);
        expect(lineage.generation).toBe(0);
      }
    }
  });

  it("resolves an ordered lineage array beyond the two founding roots", () => {
    const roots = createLineageHistory().lineages;
    const history: LineageHistory = {
      lineages: [
        ...roots,
        {
          ...roots[1]!,
          id: "ridge-grazer:1",
          parentId: "ridge-grazer:0",
          originAge: 1_000,
          generation: 1,
        },
      ],
    };
    const climate = jumpSequence[1]!.climate;
    const snapshot = captureWorldSnapshot(fixedHeightfield, 1_100, climate);
    const resolution = resolveLanding(snapshot, history, 1_000);

    expect(resolution.nextHistory.lineages.map((lineage) => lineage.id)).toEqual([
      "sheltered-grazer:0",
      "ridge-grazer:0",
      "ridge-grazer:1",
    ]);
    expect(resolution.outcome.populations).toHaveLength(3);
    expect(resolution.changes).toHaveLength(3);
  });

  it("branches mature isolated lineages during a deep-time jump", () => {
    let history = createLineageHistory();
    const foundingClimate = jumpSequence[1]!.climate;
    history = resolveLanding(
      captureWorldSnapshot(fixedHeightfield, 1_100, foundingClimate),
      history,
      1_100,
    ).nextHistory;

    const deepClimate = jumpSequence[3]!.climate;
    const resolution = resolveLanding(
      captureWorldSnapshot(fixedHeightfield, 1_001_100, deepClimate),
      history,
      1_000_000,
    );
    const child = resolution.nextHistory.lineages.find((lineage) => lineage.parentId !== undefined);

    expect(child).toMatchObject({
      originAge: 1_001_100,
      generation: 1,
      status: "active",
    });
    const childChange = resolution.changes.find((change) => change.id === child?.id);
    expect(childChange).toMatchObject({
      parentId: child?.parentId,
      event: "speciated",
      previousStatus: "not-established",
      status: "active",
    });
    expect(Object.keys(childChange?.traits ?? {})).toEqual(POPULATION_TRAIT_KEYS);
    expect(childChange?.habitat).toBeDefined();
    const parent = resolution.nextHistory.lineages.find((lineage) => lineage.id === child?.parentId);
    expect(Math.hypot(
      child!.site!.x - parent!.site!.x,
      child!.site!.z - parent!.site!.z,
    )).toBeGreaterThanOrEqual(45);
  });

  it("does not branch before the maturation cooldown", () => {
    let history = createLineageHistory();
    const climate = jumpSequence[1]!.climate;
    history = resolveLanding(
      captureWorldSnapshot(fixedHeightfield, 1_100, climate),
      history,
      1_100,
    ).nextHistory;
    const resolution = resolveLanding(
      captureWorldSnapshot(fixedHeightfield, 101_099, climate),
      history,
      99_999,
    );

    expect(resolution.nextHistory.lineages.every((lineage) => lineage.parentId === undefined)).toBe(true);
  });

  it("does not branch the same parent repeatedly", () => {
    let history = createLineageHistory();
    const climate = jumpSequence[3]!.climate;
    history = resolveLanding(
      captureWorldSnapshot(fixedHeightfield, 1_000, climate),
      history,
      1_000,
    ).nextHistory;
    history = resolveLanding(
      captureWorldSnapshot(fixedHeightfield, 1_001_000, climate),
      history,
      1_000_000,
    ).nextHistory;
    const parentId = history.lineages.find((lineage) => lineage.parentId)?.parentId;
    expect(parentId).toBeDefined();

    const next = resolveLanding(
      captureWorldSnapshot(fixedHeightfield, 2_001_000, climate),
      history,
      1_000_000,
    ).nextHistory;
    expect(next.lineages.filter((lineage) => lineage.parentId === parentId)).toHaveLength(1);
  });
});
