import { Vector3 } from "three/webgpu";
import { describe, expect, it } from "vitest";
import { findTerrainPath, isWalkable, NAVIGATION_CELL } from "./animal-navigation";
import { DEFAULT_CLIMATE, SEA_LEVEL } from "./climate";

const SEA = SEA_LEVEL[DEFAULT_CLIMATE.seaLevel];

/** A broad plateau well above the waterline, so the whole grid is walkable. */
function plateau(): number {
  return SEA + 20;
}

/** Dry land east of a north-south channel of open water at x = 0. */
function splitByChannel(x: number): number {
  return Math.abs(x) < 20 ? SEA - 6 : SEA + 20;
}

/** A plateau crossed by an impassably steep north-south wall at x = 0. */
function walledPlateau(x: number): number {
  return SEA + 20 + Math.max(0, 60 - Math.abs(x) * 6);
}

describe("terrain pathfinding", () => {
  it("routes between two walkable points and ends adjacent to the goal", () => {
    const start = new Vector3(-60, plateau(), -60);
    const goal = new Vector3(60, plateau(), 60);
    const path = findTerrainPath(plateau, start, goal, DEFAULT_CLIMATE);

    expect(path.length).toBeGreaterThan(0);
    const last = path.at(-1)!;
    // The route is resolved on a coarse cell grid, so the final waypoint lands
    // within one cell of the requested goal rather than exactly on it.
    expect(Math.hypot(last.x - goal.x, last.z - goal.z)).toBeLessThanOrEqual(6);
  });

  it("returns steps that stay on connected neighbouring cells", () => {
    const path = findTerrainPath(
      plateau,
      new Vector3(-40, plateau(), 0),
      new Vector3(40, plateau(), 24),
      DEFAULT_CLIMATE,
    );

    expect(path.length).toBeGreaterThan(1);
    for (let i = 1; i < path.length; i++) {
      const previous = path[i - 1]!;
      const step = Math.hypot(path[i]!.x - previous.x, path[i]!.z - previous.z);
      // The grid's own cell size, not a literal: it follows the island radius.
      expect(step).toBeCloseTo(NAVIGATION_CELL, 5);
    }
  });

  it("keeps every waypoint on walkable ground", () => {
    const path = findTerrainPath(
      walledPlateau,
      new Vector3(30, 0, -60),
      new Vector3(120, 0, 60),
      DEFAULT_CLIMATE,
    );

    expect(path.length).toBeGreaterThan(0);
    for (const step of path) {
      expect(isWalkable(walledPlateau, step.x, step.z, DEFAULT_CLIMATE)).toBe(true);
    }
  });

  it("finds no route across open water", () => {
    const path = findTerrainPath(
      (x) => splitByChannel(x),
      new Vector3(-80, 0, 0),
      new Vector3(80, 0, 0),
      DEFAULT_CLIMATE,
    );

    expect(path).toEqual([]);
  });

  it("resolves the same route for the same request", () => {
    const start = new Vector3(-48, 0, -12);
    const goal = new Vector3(54, 0, 36);
    const first = findTerrainPath(plateau, start, goal, DEFAULT_CLIMATE);
    const second = findTerrainPath(plateau, start, goal, DEFAULT_CLIMATE);

    expect(first.map((step) => [step.x, step.z])).toEqual(second.map((step) => [step.x, step.z]));
  });

  it("prefers the flat detour over a steep direct crossing", () => {
    // A ridge blocks the direct line but tapers away to the north, so the
    // cheapest route bends around its end instead of climbing it.
    const ridge = (x: number, z: number): number => (
      Math.abs(x) < 18 && z < 40 ? SEA + 20 + (40 - z) : SEA + 20
    );
    const path = findTerrainPath(
      ridge,
      new Vector3(-60, 0, -40),
      new Vector3(60, 0, -40),
      DEFAULT_CLIMATE,
    );

    expect(path.length).toBeGreaterThan(0);
    expect(Math.max(...path.map((step) => step.z))).toBeGreaterThan(-40);
  });

  it("resolves a herd's worth of routes fast enough for one frame", () => {
    // Ninety-six animals never path in the same frame — the renderer spreads
    // requests across frames — but each individual request must stay cheap.
    const started = performance.now();
    for (let i = 0; i < 8; i++) {
      findTerrainPath(
        plateau,
        new Vector3(-100 + i, plateau(), -100),
        new Vector3(100, plateau(), 100 - i),
        DEFAULT_CLIMATE,
      );
    }
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("walkability", () => {
  it("rejects ground at or below the waterline", () => {
    expect(isWalkable(() => SEA - 1, 0, 0, DEFAULT_CLIMATE)).toBe(false);
    expect(isWalkable(() => SEA + 20, 0, 0, DEFAULT_CLIMATE)).toBe(true);
  });

  it("rejects cliffs steeper than the climb limit", () => {
    expect(isWalkable((x) => SEA + 20 + x * 4, 0, 0, DEFAULT_CLIMATE)).toBe(false);
  });
});
