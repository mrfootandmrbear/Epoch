import { describe, expect, it } from "vitest";
import { resolveStreamSegments } from "./stream-network";

function terrain(side: number, elevationAt: (x: number, z: number) => number) {
  const elevations = new Float32Array(side * side);
  const runoff = new Float32Array(side * side);
  for (let z = 0; z < side; z++) for (let x = 0; x < side; x++) elevations[z * side + x] = elevationAt(x, z);
  return { side, extent: side - 1, elevations, runoff };
}

describe("resolveStreamSegments", () => {
  it("traces strict downhill reaches with continuous physical distance", () => {
    const field = terrain(7, (x, z) => 12 - z - Math.abs(x - 3) * 0.1);
    field.runoff[2 * field.side + 3] = 0.8;
    const segments = resolveStreamSegments(field, 3, 1);
    expect(segments.length).toBeGreaterThan(1);
    expect(segments[0]!.from).toBe(2 * field.side + 3);
    expect(segments.every((segment) => segment.drop > 0)).toBe(true);
    expect(segments.every((segment) => segment.fromDistance > segment.toDistance)).toBe(true);
    expect(segments.every((segment) => segment.fromDistance - segment.toDistance === segment.length)).toBe(true);
  });

  it("does not walk across flats", () => {
    const field = terrain(7, () => 10);
    field.runoff[3 * field.side + 3] = 0.9;
    expect(resolveStreamSegments(field, 0, 1)).toEqual([]);
  });

  it("chooses the steepest grade rather than the lowest diagonal endpoint", () => {
    const field = terrain(7, () => 20);
    const source = 3 * field.side + 3;
    field.runoff[source] = 0.9;
    field.elevations[source] = 10;
    field.elevations[3 * field.side + 4] = 8.9; // cardinal grade 1.1
    field.elevations[4 * field.side + 4] = 8.6; // diagonal grade 0.99
    const [first] = resolveStreamSegments(field, 0, 1);
    expect(first?.to).toBe(3 * field.side + 4);
  });

  it("accumulates discharge where source paths merge", () => {
    const field = terrain(11, (x, z) => 30 - z * 2 + Math.abs(x - 5) * 0.6);
    field.runoff[2 * field.side + 3] = 0.7;
    field.runoff[2 * field.side + 7] = 0.8;
    const segments = resolveStreamSegments(field, 0, 2);
    expect(Math.max(...segments.map((segment) => segment.discharge))).toBeGreaterThan(0.8);
  });

  it("does not create streams without meaningful runoff", () => {
    expect(resolveStreamSegments(terrain(5, () => 10), 0)).toEqual([]);
  });
});
