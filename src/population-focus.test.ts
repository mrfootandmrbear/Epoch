import { describe, expect, it } from "vitest";
import { visibleHerdCentroid } from "./population-focus";

describe("population focus", () => {
  it("returns the centroid of visible herd samples only", () => {
    const centroid = visibleHerdCentroid([
      { visible: true, position: { x: 0, y: 5, z: 0 } },
      { visible: true, position: { x: 10, y: 7, z: 0 } },
      { visible: false, position: { x: 100, y: 0, z: 100 } },
    ]);
    expect(centroid).toEqual({ x: 5, y: 6, z: 0 });
  });

  it("returns undefined when no samples are visible", () => {
    expect(visibleHerdCentroid([
      { visible: false, position: { x: 1, y: 2, z: 3 } },
    ])).toBeUndefined();
  });
});
