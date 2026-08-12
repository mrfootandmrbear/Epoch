import { describe, expect, it } from "vitest";
import { projectedHeightFraction, RENDER_SCALE } from "./render-scale";

describe("render scale", () => {
  it("keeps all landing measurements in metres", () => {
    expect(RENDER_SCALE.metersPerWorldUnit).toBe(1);
    expect(RENDER_SCALE.oceanExtent).toBeGreaterThan(RENDER_SCALE.islandExtent * 3);
    expect(RENDER_SCALE.seagrassHeight.max).toBeLessThan(RENDER_SCALE.grazerShoulderHeight);
    expect(RENDER_SCALE.grazerShoulderHeight).toBeLessThan(RENDER_SCALE.typicalTreeHeight);
  });

  it("keeps near LODs above a gameplay-scale projected-size floor", () => {
    expect(projectedHeightFraction(RENDER_SCALE.typicalTreeHeight, RENDER_SCALE.lod.treeNear, 55)).toBeGreaterThan(0.05);
    expect(projectedHeightFraction(RENDER_SCALE.seagrassHeight.max, RENDER_SCALE.lod.seagrassNear, 55)).toBeGreaterThan(0.015);
  });
});
