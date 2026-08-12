import { describe, expect, it } from "vitest";
import { writeStreamRibbonGeometry } from "./stream-renderer";
import type { StreamSegment } from "./stream-network";

describe("writeStreamRibbonGeometry", () => {
  it("winds stream ribbons upward with continuous metre coordinates", () => {
    const terrain = { side: 2, extent: 2, elevations: new Float32Array([1, 0, 1, 0]) };
    const segment: StreamSegment = {
      from: 0, to: 1, discharge: 0.8, drop: 1, length: 2,
      fromDistance: 12, toDistance: 10,
    };
    const positions = new Float32Array(72);
    const normals = new Float32Array(72);
    const uvs = new Float32Array(48);
    const count = writeStreamRibbonGeometry(terrain, [segment], positions, normals, uvs);
    expect(count).toBe(24);
    for (let vertex = 0; vertex < count; vertex++) expect(normals[vertex * 3 + 1]).toBeGreaterThan(0);
    expect(uvs[1]).toBe(12);
    expect(uvs[(count - 1) * 2 + 1]).toBe(10);
  });
});
