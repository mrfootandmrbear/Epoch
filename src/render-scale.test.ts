import { describe, expect, it } from "vitest";
import { creaturePoseInterval, projectedHeightFraction, RENDER_SCALE } from "./render-scale";

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

describe("creature pose LOD", () => {
  const { creaturePoseNear, creaturePoseFar } = RENDER_SCALE.lod;

  it("samples the walk cycle every frame up close", () => {
    expect(creaturePoseInterval(0)).toBe(1);
    expect(creaturePoseInterval(creaturePoseNear)).toBe(1);
  });

  it("thins sampling at mid distance and freezes it beyond the far band", () => {
    expect(creaturePoseInterval(creaturePoseNear + 1)).toBe(3);
    expect(creaturePoseInterval(creaturePoseFar)).toBe(3);
    expect(creaturePoseInterval(creaturePoseFar + 1)).toBe(0);
  });

  it("never thins a walk cycle that is still large on screen", () => {
    // Legs are roughly half the animal, so a dropped step shows while the body
    // still covers a percent or so of frame height. The full-rate band has to
    // reach at least that far out.
    expect(
      projectedHeightFraction(RENDER_SCALE.grazerShoulderHeight, creaturePoseNear, 55),
    ).toBeGreaterThan(0.01);
  });

  it("degrades in order, never sampling further animals more often", () => {
    let previous = 1;
    for (let distance = 0; distance <= creaturePoseFar; distance += 10) {
      const interval = creaturePoseInterval(distance);
      expect(interval).toBeGreaterThanOrEqual(previous);
      previous = interval;
    }
    expect(creaturePoseInterval(creaturePoseFar * 2)).toBe(0);
  });
});
