import { describe, expect, it } from "vitest";
import { Vector3 } from "three/webgpu";
import {
  flyTargetHalfZoom,
  flyTargetLineageInspection,
  LINEAGE_INSPECTION_DISTANCE,
  smoothstep,
} from "./camera-focus";

describe("camera focus", () => {
  it("eases with a smoothstep curve", () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5);
  });

  it("closes half the remaining distance on terrain double-click", () => {
    const camera = new Vector3(100, 40, 100);
    const target = new Vector3(0, 10, 0);
    const hit = new Vector3(0, 8, 0);
    const { toTarget, toPos } = flyTargetHalfZoom(camera, target, hit, 3);
    expect(toTarget.x).toBe(0);
    expect(toTarget.y).toBe(8);
    expect(toPos.distanceTo(toTarget)).toBeCloseTo(camera.distanceTo(target) * 0.5, 0);
  });

  it("respects minimum distance on double-click zoom", () => {
    const camera = new Vector3(4, 2, 0);
    const target = new Vector3(0, 0, 0);
    const hit = new Vector3(0, 0, 0);
    const { toPos, toTarget } = flyTargetHalfZoom(camera, target, hit, 3);
    expect(toPos.distanceTo(toTarget)).toBeGreaterThanOrEqual(3);
  });

  it("preserves horizontal azimuth for lineage inspection", () => {
    const camera = new Vector3(10, 50, 10);
    const site = { x: 0, y: 5, z: 0 };
    const { toTarget, toPos } = flyTargetLineageInspection(camera, site);
    expect(toTarget.x).toBe(0);
    expect(toTarget.y).toBe(5);
    expect(toTarget.z).toBe(0);
    const horizontal = toPos.clone().sub(toTarget);
    horizontal.y = 0;
    const expected = camera.clone().sub(toTarget);
    expected.y = 0;
    expected.normalize();
    expect(horizontal.length()).toBeCloseTo(LINEAGE_INSPECTION_DISTANCE, 0);
    expect(horizontal.clone().normalize().dot(expected)).toBeCloseTo(1, 5);
    expect(toPos.y).toBe(site.y + 11);
  });

  it("uses a default azimuth when the camera sits directly above the site", () => {
    const camera = new Vector3(0, 120, 0);
    const site = { x: 0, y: 4, z: 0 };
    const { toPos, toTarget } = flyTargetLineageInspection(camera, site);
    const horizontal = toPos.clone().sub(toTarget);
    horizontal.y = 0;
    expect(horizontal.length()).toBeCloseTo(LINEAGE_INSPECTION_DISTANCE, 0);
  });
});
