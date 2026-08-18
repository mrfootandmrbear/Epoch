import { Vector3 } from "three/webgpu";

export const CAMERA_EASE_MS = 600;

/** Mid-inspection distance for lineage bookmarks — matches proof mid cameras. */
export const LINEAGE_INSPECTION_DISTANCE = 38;

/** Height above a terrestrial site for lineage inspection — existing framing. */
export const LINEAGE_INSPECTION_HEIGHT = 11;

/**
 * Above-water orbit clamp. 88.2° keeps the camera from seeing under the world.
 * Do not change: existing golden shots assume this cone.
 */
export const ABOVE_WATER_MAX_POLAR = Math.PI * 0.49;

/** Submerged orbit clamp. 120° lets the camera level out and look up at the surface. */
export const SUBMERGED_MAX_POLAR = Math.PI * (120 / 180);

/** Half-width of the waterline blend, metres. Polar and haze interpolate across 2× this. */
export const WATERLINE_BAND_METERS = 0.8;

/** Fly-to keeps this much water above the seabed so the camera is not buried in rock. */
export const SEABED_CLEARANCE_METERS = 1.5;

/** Distance behind an underwater double-click hit. Committed enter, not half-zoom. */
export const UNDERWATER_ENTRY_DISTANCE = 18;

export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function clampedSmoothstep(min: number, max: number, value: number): number {
  if (max <= min) return value >= max ? 1 : 0;
  const x = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return smoothstep(x);
}

/**
 * 0 above the waterline band, 1 fully submerged. Smooth across ±band so a
 * rise-and-break is not a snap in polar limit or haze.
 */
export function cameraSubmergence(
  cameraY: number,
  seaLevel: number,
  band = WATERLINE_BAND_METERS,
): number {
  return 1 - clampedSmoothstep(seaLevel - band, seaLevel + band, cameraY);
}

/** Depth-dependent OrbitControls polar limit. Unchanged at y ≥ seaLevel + band. */
export function polarLimitForDepth(cameraY: number, seaLevel: number): number {
  const t = cameraSubmergence(cameraY, seaLevel);
  return ABOVE_WATER_MAX_POLAR + (SUBMERGED_MAX_POLAR - ABOVE_WATER_MAX_POLAR) * t;
}

/**
 * Fly-to target height: seabed plus clearance when the hit is underwater,
 * otherwise the historical sea-level-0 clamp so above-water framing is unchanged.
 */
export function flyTargetHeight(hitY: number, seaLevel = 0): number {
  if (hitY < seaLevel) return hitY + SEABED_CLEARANCE_METERS;
  return Math.max(hitY, 0);
}

/**
 * Vertical offset from a lineage site to the inspection camera.
 * Terrestrial bookmarks keep +11 m. Submerged bookmarks stay in the column.
 */
export function inspectionHeightOffset(siteY: number, seaLevel = 0): number {
  if (siteY >= seaLevel) return LINEAGE_INSPECTION_HEIGHT;
  const maxRaise = seaLevel - SEABED_CLEARANCE_METERS - siteY;
  return Math.min(LINEAGE_INSPECTION_HEIGHT, Math.max(0, maxRaise));
}

export interface CameraFlyTarget {
  readonly toTarget: Vector3;
  readonly toPos: Vector3;
}

/** Seabed-relative pose for a committed underwater enter. Never below the rock. */
export function underwaterEntryPose(
  seabedY: number,
  seaLevel = 0,
): { readonly targetY: number; readonly cameraY: number } {
  const column = Math.max(0, seaLevel - seabedY);
  const floor = seabedY + Math.min(SEABED_CLEARANCE_METERS, Math.max(0.5, column * 0.3));
  const ceiling = seaLevel - SEABED_CLEARANCE_METERS;
  const targetY = Math.max(seabedY + 0.4, Math.min(floor, ceiling));
  const cameraY = Math.max(seabedY + 0.8, Math.min(Math.max(targetY + 2.5, floor), ceiling));
  return { targetY, cameraY };
}

/**
 * Double-click on water: fly into the column at this hit, looking at the seabed.
 * Half remaining overview distance never reaches the water; this does.
 */
export function flyTargetEnterUnderwater(
  cameraPosition: Vector3,
  hitPoint: Vector3,
  seaLevel = 0,
  minDistance = 3,
): CameraFlyTarget {
  const pose = underwaterEntryPose(hitPoint.y, seaLevel);
  const toTarget = new Vector3(hitPoint.x, pose.targetY, hitPoint.z);
  const horizontal = cameraPosition.clone().sub(toTarget);
  horizontal.y = 0;
  if (horizontal.lengthSq() < 1) {
    horizontal.set(28, 0, 29).normalize();
  } else {
    horizontal.normalize();
  }
  const toPos = toTarget.clone().addScaledVector(horizontal, Math.max(minDistance, UNDERWATER_ENTRY_DISTANCE));
  toPos.y = pose.cameraY;
  return { toTarget, toPos };
}

/** Land keeps Google Earth half-zoom; water is a committed enter. */
export function flyTargetFromHit(
  cameraPosition: Vector3,
  controlsTarget: Vector3,
  hitPoint: Vector3,
  minDistance: number,
  seaLevel = 0,
): CameraFlyTarget {
  if (hitPoint.y < seaLevel) return flyTargetEnterUnderwater(cameraPosition, hitPoint, seaLevel, minDistance);
  return flyTargetHalfZoom(cameraPosition, controlsTarget, hitPoint, minDistance, seaLevel);
}

/** Metres per second. Scales with framing distance so overview and reef both feel usable. */
export function flyRigSpeed(distanceToTarget: number): number {
  return Math.min(140, 16 + Math.max(0, distanceToTarget) * 0.42);
}

/**
 * Translation for one fly frame. Forward follows the look direction (including
 * dive/climb). Strafe stays horizontal so left/right does not change altitude.
 */
export function flyRigTranslation(
  lookX: number,
  lookY: number,
  lookZ: number,
  rightX: number,
  rightZ: number,
  moveForward: number,
  moveRight: number,
  metres: number,
): { readonly x: number; readonly y: number; readonly z: number } {
  const lookLen = Math.hypot(lookX, lookY, lookZ);
  if (lookLen < 1e-8 || metres === 0 || (moveForward === 0 && moveRight === 0)) {
    return { x: 0, y: 0, z: 0 };
  }
  const inv = 1 / lookLen;
  const fx = lookX * inv;
  const fy = lookY * inv;
  const fz = lookZ * inv;
  const rightLen = Math.hypot(rightX, rightZ);
  const rx = rightLen < 1e-8 ? 1 : rightX / rightLen;
  const rz = rightLen < 1e-8 ? 0 : rightZ / rightLen;
  return {
    x: (fx * moveForward + rx * moveRight) * metres,
    y: fy * moveForward * metres,
    z: (fz * moveForward + rz * moveRight) * metres,
  };
}

/** Lift both ends of the rig so the camera is not buried in terrain. */
export function flyRigFloorLift(cameraY: number, floorY: number): number {
  const minY = floorY + SEABED_CLEARANCE_METERS;
  return cameraY < minY ? minY - cameraY : 0;
}

/** Double-click: close half remaining distance toward terrain hit. */
export function flyTargetHalfZoom(
  cameraPosition: Vector3,
  controlsTarget: Vector3,
  hitPoint: Vector3,
  minDistance: number,
  seaLevel = 0,
): CameraFlyTarget {
  const toTarget = hitPoint.clone();
  toTarget.y = flyTargetHeight(hitPoint.y, seaLevel);
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
  seaLevel = 0,
): CameraFlyTarget {
  const toTarget = new Vector3(site.x, site.y, site.z);
  const horizontal = cameraPosition.clone().sub(toTarget);
  horizontal.y = 0;
  if (horizontal.lengthSq() < 1) {
    horizontal.set(28, 0, 29).normalize();
  } else {
    horizontal.normalize();
  }
  const height = inspectionHeightOffset(site.y, seaLevel);
  const toPos = toTarget.clone().addScaledVector(horizontal, inspectionDistance);
  toPos.y = site.y + height;
  if (toPos.distanceTo(toTarget) < minDistance) {
    toPos.copy(toTarget).addScaledVector(horizontal, minDistance);
    toPos.y = site.y + height;
  }
  return { toTarget, toPos };
}
