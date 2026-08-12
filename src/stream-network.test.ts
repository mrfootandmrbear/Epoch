import { describe, expect, it } from "vitest";
import { resolveStreamSegments } from "./stream-network";

describe("resolveStreamSegments", () => {
  it("traces runoff downhill into a connected channel", () => {
    const side = 7;
    const elevations = new Float32Array(side * side);
    const runoff = new Float32Array(side * side);
    for (let z = 0; z < side; z++) for (let x = 0; x < side; x++) {
      elevations[z * side + x] = 12 - z - Math.abs(x - 3) * 0.1;
    }
    runoff[2 * side + 3] = 0.8;
    const segments = resolveStreamSegments({ side, elevations, runoff }, 3, 1);
    expect(segments.length).toBeGreaterThan(1);
    expect(segments[0]!.from).toBe(2 * side + 3);
    expect(segments.every((segment) => segment.drop > 0)).toBe(true);
  });

  it("does not create streams without meaningful runoff", () => {
    expect(resolveStreamSegments({
      side: 5,
      elevations: new Float32Array(25).fill(10),
      runoff: new Float32Array(25),
    }, 0)).toEqual([]);
  });
});
