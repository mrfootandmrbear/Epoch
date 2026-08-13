import { describe, expect, it } from "vitest";
import { createTerrainHistory } from "./terrain-history";
import {
  applyHeightBrush,
  applyCliffStroke,
  applyLevelBrush,
  captureTerrainEditSnapshot,
  restoreTerrainEditSnapshot,
  TerrainEditHistory,
} from "./terrain-edit";

describe("terrain editing", () => {
  it("applies a smooth brush with configurable size and strength", () => {
    const terrain = createTerrainHistory(new Float32Array(9 * 9), 9, 80);
    applyHeightBrush(terrain, 0, 0, 1, { radius: 25, strength: 4 });
    expect(terrain.elevations[4 * 9 + 4]).toBeCloseTo(4);
    expect(terrain.elevations[4 * 9 + 2]).toBeCloseTo(0.16);
    expect(terrain.elevations[0]).toBe(0);
    expect(terrain.disturbance[4 * 9 + 4]).toBe(1);
    expect(terrain.vegetationProtection[4 * 9 + 4]).toBe(0);
  });

  it("clamps carving at the terrain floor", () => {
    const terrain = createTerrainHistory(new Float32Array(25).fill(-54), 5, 40);
    applyHeightBrush(terrain, 0, 0, -1, { radius: 12, strength: 8 });
    expect(terrain.elevations[12]).toBe(-55);
  });

  it("levels relief toward the local mean", () => {
    const heights = new Float32Array(25);
    heights[12] = 10;
    const terrain = createTerrainHistory(heights, 5, 40);
    applyLevelBrush(terrain, 0, 0, { radius: 16, strength: 4 });
    expect(terrain.elevations[12]).toBeLessThan(10);
    expect(terrain.elevations[11]).toBeGreaterThan(0);
  });

  it("raises the left shelf of a directed cliff stroke", () => {
    const terrain = createTerrainHistory(new Float32Array(11 * 11), 11, 100);
    applyCliffStroke(terrain, -30, 0, 30, 0, { radius: 30, height: 8, edgeWidth: 8 });
    const left = terrain.elevations[7 * 11 + 5]!;
    const right = terrain.elevations[3 * 11 + 5]!;
    expect(left).toBeGreaterThan(6);
    expect(right).toBeLessThan(1);
  });

  it("restores complete sculpt state through undo and redo", () => {
    const terrain = createTerrainHistory(new Float32Array(25), 5, 40);
    terrain.vegetationProtection.fill(0.7);
    const history = new TerrainEditHistory(2);
    const before = captureTerrainEditSnapshot(terrain);
    history.checkpoint(before);
    applyHeightBrush(terrain, 0, 0, 1, { radius: 14, strength: 3 });
    const after = captureTerrainEditSnapshot(terrain);

    restoreTerrainEditSnapshot(terrain, history.undo(after)!);
    expect(terrain.elevations).toEqual(before.elevations);
    expect(terrain.vegetationProtection).toEqual(before.vegetationProtection);

    restoreTerrainEditSnapshot(terrain, history.redo(captureTerrainEditSnapshot(terrain))!);
    expect(terrain.elevations).toEqual(after.elevations);
    expect(terrain.disturbance).toEqual(after.disturbance);
  });

  it("can discard history at an epoch boundary", () => {
    const terrain = createTerrainHistory(new Float32Array(25), 5, 40);
    const history = new TerrainEditHistory();
    history.checkpoint(captureTerrainEditSnapshot(terrain));
    history.clear();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
  });
});
