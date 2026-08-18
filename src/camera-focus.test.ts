import { describe, expect, it } from "vitest";
import { Vector3 } from "three/webgpu";
import {
  ABOVE_WATER_MAX_POLAR,
  cameraSubmergence,
  flyRigFloorLift,
  flyRigSpeed,
  flyRigTranslation,
  flyTargetFromHit,
  flyTargetHalfZoom,
  flyTargetHeight,
  flyTargetLineageInspection,
  inspectionHeightOffset,
  LINEAGE_INSPECTION_DISTANCE,
  LINEAGE_INSPECTION_HEIGHT,
  polarLimitForDepth,
  SEABED_CLEARANCE_METERS,
  SUBMERGED_MAX_POLAR,
  smoothstep,
  UNDERWATER_ENTRY_DISTANCE,
  WATERLINE_BAND_METERS,
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

  it("keeps a submerged double-click on the seabed instead of snapping to sea level", () => {
    const camera = new Vector3(100, 40, 100);
    const target = new Vector3(0, 10, 0);
    const hit = new Vector3(40, -4.5, 50);
    const { toTarget } = flyTargetHalfZoom(camera, target, hit, 3, 0);
    expect(toTarget.y).toBeCloseTo(-4.5 + SEABED_CLEARANCE_METERS);
    expect(toTarget.y).toBeLessThan(0);
  });

  it("enters the water column on a submerged hit instead of half-zooming from overview", () => {
    const camera = new Vector3(560, 250, 640);
    const target = new Vector3(0, 22, 0);
    const hit = new Vector3(280, -4.5, 313);
    const entered = flyTargetFromHit(camera, target, hit, 3, 0);
    const half = flyTargetHalfZoom(camera, target, hit, 3, 0);
    expect(entered.toPos.y).toBeLessThan(0);
    expect(entered.toTarget.y).toBeLessThan(0);
    expect(entered.toPos.y).toBeGreaterThan(hit.y);
    expect(entered.toPos.distanceTo(entered.toTarget)).toBeCloseTo(UNDERWATER_ENTRY_DISTANCE, 0);
    expect(half.toPos.y).toBeGreaterThan(100);
  });

  it("keeps land double-click as half-zoom", () => {
    const camera = new Vector3(100, 40, 100);
    const target = new Vector3(0, 10, 0);
    const hit = new Vector3(0, 8, 0);
    const fromHit = flyTargetFromHit(camera, target, hit, 3, 0);
    const half = flyTargetHalfZoom(camera, target, hit, 3, 0);
    expect(fromHit.toTarget.y).toBe(half.toTarget.y);
    expect(fromHit.toPos.distanceTo(fromHit.toTarget)).toBeCloseTo(half.toPos.distanceTo(half.toTarget));
  });

  it("flies the rig along the look direction and strafes horizontally", () => {
    const forward = flyRigTranslation(0, 0, -1, 1, 0, 1, 0, 10);
    expect(forward.x).toBeCloseTo(0);
    expect(forward.y).toBeCloseTo(0);
    expect(forward.z).toBeCloseTo(-10);
    const dive = flyRigTranslation(0, -1, 0, 1, 0, 1, 0, 8);
    expect(dive.y).toBeCloseTo(-8);
    const strafe = flyRigTranslation(0, 0, -1, 1, 0, 0, 1, 5);
    expect(strafe.x).toBeCloseTo(5);
    expect(strafe.y).toBeCloseTo(0);
  });

  it("lifts the rig off the seabed and scales fly speed with framing distance", () => {
    expect(flyRigFloorLift(10, 0)).toBe(0);
    expect(flyRigFloorLift(-4, -4.5)).toBeCloseTo(SEABED_CLEARANCE_METERS - 0.5);
    expect(flyRigSpeed(0)).toBe(16);
    expect(flyRigSpeed(800)).toBeLessThanOrEqual(140);
    expect(flyRigSpeed(800)).toBeGreaterThan(flyRigSpeed(40));
  });

  it("does not change above-water double-click height at y ≥ 0", () => {
    expect(flyTargetHeight(8, 0)).toBe(8);
    expect(flyTargetHeight(0, 0)).toBe(0);
    const camera = new Vector3(100, 40, 100);
    const target = new Vector3(0, 10, 0);
    const hit = new Vector3(0, 8, 0);
    expect(flyTargetHalfZoom(camera, target, hit, 3, 0).toTarget.y).toBe(8);
  });

  it("keeps a submerged lineage inspection below the surface", () => {
    const camera = new Vector3(10, 50, 10);
    const site = { x: 0, y: -10, z: 0 };
    const { toPos, toTarget } = flyTargetLineageInspection(camera, site, LINEAGE_INSPECTION_DISTANCE, 3, 0);
    expect(toTarget.y).toBe(-10);
    expect(toPos.y).toBeLessThan(0);
    expect(toPos.y).toBeCloseTo(-10 + inspectionHeightOffset(-10, 0));
    expect(toPos.y).toBeLessThanOrEqual(0 - SEABED_CLEARANCE_METERS);
  });

  it("does not lift a shallow marine bookmark through the surface", () => {
    expect(inspectionHeightOffset(-1.2, 0)).toBeLessThan(LINEAGE_INSPECTION_HEIGHT);
    const camera = new Vector3(40, 20, 40);
    const site = { x: 0, y: -1.2, z: 0 };
    const { toPos } = flyTargetLineageInspection(camera, site, LINEAGE_INSPECTION_DISTANCE, 3, 0);
    expect(toPos.y).toBeLessThan(0);
  });

  it("keeps terrestrial lineage inspection height at +11", () => {
    expect(inspectionHeightOffset(5, 0)).toBe(LINEAGE_INSPECTION_HEIGHT);
  });

  it("opens the polar limit only when submerged and leaves the above-water cone unchanged", () => {
    expect(polarLimitForDepth(20, 0)).toBe(ABOVE_WATER_MAX_POLAR);
    expect(polarLimitForDepth(WATERLINE_BAND_METERS, 0)).toBe(ABOVE_WATER_MAX_POLAR);
    expect(polarLimitForDepth(-20, 0)).toBe(SUBMERGED_MAX_POLAR);
    expect(polarLimitForDepth(-WATERLINE_BAND_METERS, 0)).toBe(SUBMERGED_MAX_POLAR);
    const mid = polarLimitForDepth(0, 0);
    expect(mid).toBeGreaterThan(ABOVE_WATER_MAX_POLAR);
    expect(mid).toBeLessThan(SUBMERGED_MAX_POLAR);
  });

  it("interpolates polar limit and submergence across the waterline without a step", () => {
    const samples = [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2].map((y) => polarLimitForDepth(y, 0));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!).toBeLessThanOrEqual(samples[i - 1]! + 1e-9);
    }
    expect(cameraSubmergence(0.8, 0)).toBe(0);
    expect(cameraSubmergence(-0.8, 0)).toBe(1);
    expect(cameraSubmergence(0, 0)).toBeCloseTo(0.5);
  });

  it("tracks a non-zero sea-level regime", () => {
    expect(polarLimitForDepth(5, 3)).toBe(ABOVE_WATER_MAX_POLAR);
    expect(flyTargetHeight(1, 3)).toBeCloseTo(1 + SEABED_CLEARANCE_METERS);
    expect(inspectionHeightOffset(1, 3)).toBeLessThan(LINEAGE_INSPECTION_HEIGHT);
    expect(cameraSubmergence(3, 3)).toBeCloseTo(0.5);
  });
});
