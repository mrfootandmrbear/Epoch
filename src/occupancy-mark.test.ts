import { Color } from "three/webgpu";
import { describe, expect, it } from "vitest";
import {
  OCCUPANCY_HIDE_DISTANCE,
  OCCUPANCY_MARK_RADIUS,
  createOccupancyMark,
  occupancyMarkVisible,
  occupancyMarkVisibleAt,
} from "./occupancy-mark";

describe("overview occupancy mark", () => {
  it("stays hidden at mid inspection distance and reads at overview", () => {
    expect(occupancyMarkVisible(38)).toBe(false);
    expect(occupancyMarkVisible(OCCUPANCY_HIDE_DISTANCE - 1)).toBe(false);
    expect(occupancyMarkVisible(OCCUPANCY_HIDE_DISTANCE)).toBe(true);
    expect(occupancyMarkVisible(180)).toBe(true);
    expect(occupancyMarkVisible(540)).toBe(true);
  });

  it("stays visible from an overhead overview, not only from oblique cameras", () => {
    const site = { x: -178, y: 5.5, z: -217 };
    expect(occupancyMarkVisibleAt({ x: site.x, y: site.y + 300, z: site.z }, site)).toBe(true);
    expect(occupancyMarkVisibleAt({ x: site.x + 28, y: site.y + 10.5, z: site.z + 29 }, site)).toBe(false);
    expect(occupancyMarkVisibleAt({ x: -90, y: 92, z: -28 }, site)).toBe(true);
  });

  it("is one cheap disc, not a per-animal impostor or an island-scale mesh", () => {
    expect(OCCUPANCY_MARK_RADIUS).toBeGreaterThan(4);
    expect(OCCUPANCY_MARK_RADIUS).toBeLessThan(40);
    const mark = createOccupancyMark(new Color(0xc4a45a));
    expect(mark.geometry.getAttribute("position").count).toBeLessThan(40);
    expect(mark.visible).toBe(false);
  });
});
