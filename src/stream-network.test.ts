import { describe, expect, it } from "vitest";
import {
  classifyReach,
  MAX_STREAM_SEGMENTS,
  MIN_CATCHMENT_CELLS,
  MIN_VISIBLE_DISCHARGE,
  resolveStreamSegments,
} from "./stream-network";

function terrain(side: number, elevationAt: (x: number, z: number) => number) {
  const elevations = new Float32Array(side * side);
  const runoff = new Float32Array(side * side);
  for (let z = 0; z < side; z++) for (let x = 0; x < side; x++) elevations[z * side + x] = elevationAt(x, z);
  return { side, extent: side - 1, elevations, runoff };
}

// A conical island large enough to exercise real accumulation, merges and a
// genuine coastline, without the narrative complexity of the presentation
// terrain generator used elsewhere. Deterministic, no external dependency.
const ISLAND_SIDE = 61;
function conicalIsland(bumpy = false) {
  const field = terrain(ISLAND_SIDE, (x, z) => {
    const cx = x - ISLAND_SIDE / 2;
    const cz = z - ISLAND_SIDE / 2;
    const d = Math.hypot(cx, cz);
    const cone = Math.max(0, 26 - d * 0.85);
    const ridges = bumpy ? 1.8 * Math.sin(cx * 0.35) * Math.cos(cz * 0.28) : 0;
    return cone + ridges - 4;
  });
  for (let z = 0; z < ISLAND_SIDE; z++) {
    for (let x = 0; x < ISLAND_SIDE; x++) {
      const index = z * ISLAND_SIDE + x;
      // Uniform, moderate runoff — accumulation alone (not a contrived runoff
      // spike) is what has to produce the network here.
      if (field.elevations[index]! > 0) field.runoff[index] = 0.4;
    }
  }
  return field;
}

describe("resolveStreamSegments", () => {
  it("traces strict downhill reaches with continuous physical distance", () => {
    const field = terrain(7, (x, z) => 12 - z - Math.abs(x - 3) * 0.1);
    field.runoff[2 * field.side + 3] = 0.8;
    const segments = resolveStreamSegments(field, 3, { minCatchmentCells: 1 });
    expect(segments.length).toBeGreaterThan(1);
    expect(segments[0]!.from).toBe(2 * field.side + 3);
    expect(segments.every((segment) => segment.drop >= 0)).toBe(true);
    expect(segments.every((segment) => segment.fromDistance > segment.toDistance)).toBe(true);
    expect(segments.every((segment) => (
      Math.abs(segment.fromDistance - segment.toDistance - segment.length) < 1e-4
    ))).toBe(true);
  });

  it("does not create streams without meaningful runoff", () => {
    expect(resolveStreamSegments(terrain(5, () => 10), 0)).toEqual([]);
  });

  it("chooses the steepest grade rather than the lowest diagonal endpoint", () => {
    // A carved corridor genuinely reaching the boundary, so the flood
    // discovers these cells at their true elevation rather than filling them
    // to the level of the surrounding (much higher) plateau.
    const field = terrain(7, () => 20);
    const source = 3 * field.side + 3;
    field.runoff[source] = 0.9;
    field.elevations[source] = 10;
    field.elevations[3 * field.side + 4] = 8.9; // cardinal, grade 1.1
    field.elevations[4 * field.side + 4] = 8.6; // diagonal, grade 0.99
    field.elevations[5 * field.side + 4] = 8.3;
    field.elevations[6 * field.side + 4] = 8.0; // reaches the boundary row
    const [first] = resolveStreamSegments(field, 0, { minCatchmentCells: 1 });
    expect(first?.to).toBe(3 * field.side + 4);
  });

  it("breaks exact grade ties deterministically by the lowest cell index", () => {
    const field = terrain(7, () => 20);
    const source = 3 * field.side + 3;
    field.runoff[source] = 0.9;
    field.elevations[source] = 10;
    // East (index 25) and south (index 31) both drop by 1 over length 1 — an
    // exact tie. Each corridor keeps descending to the boundary, purely
    // horizontally/vertically so as not to open a diagonal shortcut back to
    // the source, and neither gets filled to the surrounding plateau's level.
    field.elevations[3 * field.side + 4] = 9; // east, index 25
    field.elevations[3 * field.side + 5] = 8.5;
    field.elevations[3 * field.side + 6] = 8; // reaches the east boundary column
    field.elevations[4 * field.side + 3] = 9; // south, index 31
    field.elevations[5 * field.side + 3] = 8.5;
    field.elevations[6 * field.side + 3] = 8; // reaches the south boundary row
    const [first] = resolveStreamSegments(field, 0, { minCatchmentCells: 1 });
    expect(first?.to).toBe(3 * field.side + 4); // index 25, the smaller of the two
  });

  it("merges converging tributaries into one shared downstream reach instead of overlapping ribbons", () => {
    // Two hand-carved tributaries that each have exactly one eligible
    // downhill neighbor at every step, forced together at (4,4) and sharing
    // one trunk on to a boundary cell that is genuinely below sea level.
    const side = 9;
    const field = terrain(side, () => 50);
    const set = (x: number, z: number, elevation: number) => { field.elevations[z * side + x] = elevation; };
    set(2, 2, 15); // source A
    set(6, 2, 15); // source B
    set(3, 3, 10); // A's only eligible step
    set(5, 3, 10); // B's only eligible step
    set(4, 4, 5); // shared confluence
    set(4, 5, 2);
    set(4, 6, -1);
    set(4, 7, -3);
    set(4, 8, -5); // boundary row, below sea level: the true ocean
    const sourceA = 2 * side + 2;
    const sourceB = 2 * side + 6;
    field.runoff[sourceA] = 0.7;
    field.runoff[sourceB] = 0.8;
    const segments = resolveStreamSegments(field, 0, { minCatchmentCells: 1 });
    const byFrom = new Map(segments.map((s) => [s.from, s] as const));

    // Both tributaries must actually reach a shared cell rather than running
    // to the coast as two independent, never-touching threads.
    let a = sourceA;
    const aPath = new Set<number>([a]);
    while (byFrom.has(a)) { a = byFrom.get(a)!.to; aPath.add(a); }
    let b = sourceB;
    const bPath: number[] = [b];
    while (byFrom.has(b)) { b = byFrom.get(b)!.to; bPath.push(b); }
    const confluence = bPath.find((cell) => aPath.has(cell));
    expect(confluence).toBeDefined();

    // Downstream of the confluence there is exactly one continuing segment,
    // not two independent reaches occupying the same ground.
    const outgoingAtConfluence = segments.filter((s) => s.from === confluence);
    expect(outgoingAtConfluence.length).toBeLessThanOrEqual(1);

    // And the merged discharge is at least as large as either tributary's own.
    const sourceASegment = byFrom.get(sourceA)!;
    const sourceBSegment = byFrom.get(sourceB)!;
    if (outgoingAtConfluence.length === 1) {
      expect(outgoingAtConfluence[0]!.discharge).toBeGreaterThanOrEqual(
        Math.max(sourceASegment.discharge, sourceBSegment.discharge) - 1e-6,
      );
    }
  });

  it("keeps discharge non-decreasing along every downstream chain", () => {
    const field = conicalIsland(true);
    const segments = resolveStreamSegments(field, 0);
    const byFrom = new Map(segments.map((s) => [s.from, s] as const));
    let checked = 0;
    for (const segment of segments) {
      const next = byFrom.get(segment.to);
      if (!next) continue;
      checked++;
      expect(next.discharge).toBeGreaterThanOrEqual(segment.discharge - 1e-6);
    }
    // The island fixture is large enough that this assertion is not vacuous.
    expect(checked).toBeGreaterThan(10);
  });

  it("produces identical output for identical input (deterministic ordering)", () => {
    const field = conicalIsland(true);
    const first = resolveStreamSegments(field, 0);
    const second = resolveStreamSegments(field, 0);
    expect(second).toEqual(first);
  });

  it("terminates every network at the ocean, never mid-slope", () => {
    // A perfectly smooth radial cone has no reason for D8 paths to converge —
    // real catchments need the bumpy variant to gather enough area to
    // channelize at the production threshold at all.
    const field = conicalIsland(true);
    const segments = resolveStreamSegments(field, 0);
    expect(segments.length).toBeGreaterThan(0);
    const byFrom = new Map(segments.map((s) => [s.from, s] as const));
    const sinks = new Set<number>();
    for (const segment of segments) if (!byFrom.has(segment.to)) sinks.add(segment.to);
    expect(sinks.size).toBeGreaterThan(0);
    for (const sink of sinks) expect(field.elevations[sink]!).toBeLessThanOrEqual(0.15);
  });

  it("never produces a cycle", () => {
    const field = conicalIsland(true);
    const segments = resolveStreamSegments(field, 0);
    const byFrom = new Map(segments.map((s) => [s.from, s] as const));
    for (const start of byFrom.keys()) {
      const seen = new Set<number>();
      let cursor = start;
      let guard = 0;
      while (byFrom.has(cursor)) {
        expect(seen.has(cursor)).toBe(false);
        seen.add(cursor);
        cursor = byFrom.get(cursor)!.to;
        guard++;
        expect(guard).toBeLessThan(ISLAND_SIDE * ISLAND_SIDE);
      }
    }
  });

  it("routes across a perfectly flat plateau without fabricating uphill flow or a cycle", () => {
    // A flat plateau (10) draining, at its one low edge, toward the sea.
    const side = 9;
    const field = terrain(side, (_x, z) => (z === side - 1 ? -1 : 10));
    for (let z = 0; z < side - 1; z++) {
      for (let x = 0; x < side; x++) field.runoff[z * side + x] = 0.3;
    }
    const segments = resolveStreamSegments(field, 0, { minCatchmentCells: 3 });
    expect(segments.length).toBeGreaterThan(0);
    // No fabricated uphill flow: a flat reach reports a flat drop.
    expect(segments.every((s) => s.drop >= 0)).toBe(true);
    // No cycle: following receivers from any segment terminates.
    const byFrom = new Map(segments.map((s) => [s.from, s] as const));
    for (const start of byFrom.keys()) {
      const seen = new Set<number>();
      let cursor = start;
      while (byFrom.has(cursor)) {
        expect(seen.has(cursor)).toBe(false);
        seen.add(cursor);
        cursor = byFrom.get(cursor)!.to;
      }
    }
  });

  it("routes flow around a local depression instead of pooling it into a fabricated uphill reach", () => {
    // A bowl-shaped pit sits partway down an otherwise monotonic slope to the
    // sea. Priority-flood filling must route through/around it without ever
    // reporting negative drop or stalling the network at the pit.
    const side = 15;
    const field = terrain(side, (x, z) => {
      const base = 20 - z * 1.5; // dips below sea level at the far boundary row
      const dx = x - 7;
      const dz = z - 7;
      const pit = Math.max(0, 3 - Math.hypot(dx, dz)) * 2.5;
      return base - pit;
    });
    for (let z = 0; z < side; z++) for (let x = 0; x < side; x++) {
      const index = z * side + x;
      if (field.elevations[index]! > 0) field.runoff[index] = 0.5;
    }
    const segments = resolveStreamSegments(field, 0, { minCatchmentCells: 2 });
    expect(segments.length).toBeGreaterThan(0);
    expect(segments.every((s) => s.drop >= 0)).toBe(true);
    const byFrom = new Map(segments.map((s) => [s.from, s] as const));
    // At least one traced chain reaches the coast rather than dying at the pit.
    let reachedSea = false;
    for (const start of byFrom.keys()) {
      let cursor = start;
      let guard = 0;
      while (byFrom.has(cursor) && guard < side * side) { cursor = byFrom.get(cursor)!.to; guard++; }
      if (field.elevations[cursor]! <= 0.15) reachedSea = true;
    }
    expect(reachedSea).toBe(true);
  });

  it("terminates in an enclosed depression instead of fabricating an uphill escape", () => {
    const side = 9;
    const field = terrain(side, (x, z) => 20 + Math.hypot(x - 4, z - 4));
    field.elevations[4 * side + 4] = 2;
    for (let i = 0; i < field.runoff.length; i++) field.runoff[i] = 0.5;
    const segments = resolveStreamSegments(field, -10, { minCatchmentCells: 1 });
    const pit = 4 * side + 4;
    expect(segments.some((segment) => segment.to === pit)).toBe(true);
    expect(segments.some((segment) => segment.from === pit)).toBe(false);
    expect(segments.every((segment) => segment.drop >= 0)).toBe(true);
  });

  it("is stable across cardinal- and diagonal-dominant slope orientations", () => {
    // Two islands identical up to a 90-degree rotation must both resolve to
    // fully connected, cycle-free, sea-terminating networks — routing quality
    // should not depend on whether the dominant slope runs cardinal or
    // diagonal to the grid.
    const straight = terrain(21, (_x, z) => 15 - z * 1.5);
    const diagonal = terrain(21, (x, z) => 15 - (x + z) * 1.06);
    for (const field of [straight, diagonal]) {
      for (let i = 0; i < field.runoff.length; i++) {
        if (field.elevations[i]! > 0) field.runoff[i] = 0.35;
      }
      const segments = resolveStreamSegments(field, 0, { minCatchmentCells: 3 });
      expect(segments.length).toBeGreaterThan(0);
      expect(segments.every((s) => s.drop >= 0)).toBe(true);
      const byFrom = new Map(segments.map((s) => [s.from, s] as const));
      for (const start of byFrom.keys()) {
        const seen = new Set<number>();
        let cursor = start;
        while (byFrom.has(cursor)) {
          expect(seen.has(cursor)).toBe(false);
          seen.add(cursor);
          cursor = byFrom.get(cursor)!.to;
        }
        expect(field.elevations[cursor]!).toBeLessThanOrEqual(0.15);
      }
    }
  });

  it("keeps the network bounded regardless of how much terrain qualifies", () => {
    const field = conicalIsland(true);
    const segments = resolveStreamSegments(field, 0);
    expect(segments.length).toBeLessThanOrEqual(MAX_STREAM_SEGMENTS);

    const capped = resolveStreamSegments(field, 0, { maxSegments: 12 });
    expect(capped.length).toBeLessThanOrEqual(12);
    // Trimming to the largest catchments must not orphan a kept reach: every
    // kept cell's receiver is either the outlet or also present as a `from`.
    const fullFrom = new Set(segments.map((s) => s.from));
    const cappedFrom = new Set(capped.map((s) => s.from));
    for (const segment of capped) {
      // If the full network continues from this receiver, the capped network
      // must retain that downstream edge as well.
      if (fullFrom.has(segment.to)) expect(cappedFrom.has(segment.to)).toBe(true);
    }
    expect(capped.length).toBeGreaterThan(0);
  });

  it("gates channelization on catchment area, not on a single cell's own runoff", () => {
    // A lone high-runoff cell with nothing upstream must not channelize on
    // its own — this is the exact defect that produced arbitrary hillside
    // "spitting" in the sparse-source resolver.
    const field = terrain(9, (_x, z) => 10 - z);
    field.runoff[4 * field.side + 4] = 1;
    expect(resolveStreamSegments(field, -5, { minCatchmentCells: MIN_CATCHMENT_CELLS })).toEqual([]);
    // The same cell, with default production-scale settings, also stays dry.
    expect(resolveStreamSegments(field, -5)).toEqual([]);
  });

  it("classifies every emitted reach the same way the renderers do", () => {
    const field = conicalIsland(true);
    const segments = resolveStreamSegments(field, 0);
    for (const segment of segments) {
      expect(segment.discharge).toBeGreaterThanOrEqual(MIN_VISIBLE_DISCHARGE);
      expect(classifyReach(segment)).not.toBe("dry");
    }
  });

  it("feeds a retained basin but emits no channel across or out of it", () => {
    const side = 11;
    const field = terrain(side, (_x, z) => 20 - z * 2);
    for (let i = 0; i < field.runoff.length; i++) field.runoff[i] = 0.5;
    const surface = new Float32Array(side * side);
    surface.fill(Number.NaN);
    const basin = 6 * side + 5;
    surface[basin] = field.elevations[basin]! + 1;
    const segments = resolveStreamSegments(field, 0, {
      minCatchmentCells: 2,
      retainedWaterSurface: surface,
    });
    expect(segments.some((segment) => segment.to === basin)).toBe(true);
    expect(segments.some((segment) => segment.from === basin)).toBe(false);
  });
});
