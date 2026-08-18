import { Vector3 } from "three/webgpu";

export const CAMERA_EASE_MS = 600;

/** Mid-inspection distance for lineage bookmarks — matches proof mid cameras. */
export const LINEAGE_INSPECTION_DISTANCE = 38;

export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export interface CameraFlyTarget {
  readonly toTarget: Vector3;
  readonly toPos: Vector3;
}

/** Double-click: close half remaining distance toward terrain hit. */
export function flyTargetHalfZoom(
  cameraPosition: Vector3,
  controlsTarget: Vector3,
  hitPoint: Vector3,
  minDistance: number,
): CameraFlyTarget {
  const toTarget = hitPoint.clone();
  toTarget.y = Math.max(hitPoint.y, 0);
  const direction = cameraPosition.clone().sub(toTarget).normalize();
  const currentDist = cameraPosition.distanceTo(controlsTarget);
  const toPos = toTarget.clone().addScaledVector(direction, Math.max(currentDist * 0.5, minDistance));
  return { toTarget, toPos };
}

/**
 * Lineage bookmark: fly to a fixed mid distance from the population site,
 * preserving horizontal azimuth from the current camera.
 */
export function flyTargetLineageInspection(
  cameraPosition: Vector3,
  site: Readonly<{ x: number; y: number; z: number }>,
  inspectionDistance = LINEAGE_INSPECTION_DISTANCE,
  minDistance = 3,
): CameraFlyTarget {
  const toTarget = new Vector3(site.x, site.y, site.z);
  const horizontal = cameraPosition.clone().sub(toTarget);
  horizontal.y = 0;
  if (horizontal.lengthSq() < 1) {
    horizontal.set(28, 0, 29).normalize();
  } else {
    horizontal.normalize();
  }
  const toPos = toTarget.clone().addScaledVector(horizontal, inspectionDistance);
  toPos.y = site.y + 11;
  if (toPos.distanceTo(toTarget) < minDistance) {
    toPos.copy(toTarget).addScaledVector(horizontal, minDistance);
    toPos.y = site.y + 11;
  }
  return { toTarget, toPos };
}
