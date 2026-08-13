/** Canonical physical scale for every landing renderer. One world unit is one metre. */
export const RENDER_SCALE = Object.freeze({
  metersPerWorldUnit: 1,
  islandExtent: 380,
  oceanExtent: 1400,
  oceanPatch: 500,
  typicalTreeHeight: 6,
  grazerShoulderHeight: 2.1,
  seagrassHeight: Object.freeze({ min: 0.35, max: 1.4 }),
  swellAmplitudeScale: 0.22,
  lod: Object.freeze({
    treeNear: 92,
    seagrassNear: 72,
    treeRepartition: 8,
    seagrassRepartition: 6,
    // Inside this the walk cycle is sampled every frame. A grazer stands about
    // 2.1 m, so at 130 m it still covers a few percent of frame height and a
    // dropped step would be noticed.
    creaturePoseNear: 130,
    // Past this a leg is under a pixel of travel per frame; the pose morph is
    // frozen entirely and the herd's morph texture stops being re-uploaded.
    creaturePoseFar: 300,
    creatureRepartition: 10,
  }),
});

export function projectedHeightFraction(heightMeters: number, distanceMeters: number, verticalFovDegrees: number): number {
  const visibleHeight = 2 * distanceMeters * Math.tan((verticalFovDegrees * Math.PI) / 360);
  return heightMeters / Math.max(Number.EPSILON, visibleHeight);
}

/**
 * Frames between walk-cycle morph writes for an animal at this distance.
 * Zero means the pose is frozen and its herd's morph texture need not be
 * re-uploaded on its account at all.
 */
export function creaturePoseInterval(distanceMeters: number): number {
  if (distanceMeters > RENDER_SCALE.lod.creaturePoseFar) return 0;
  return distanceMeters > RENDER_SCALE.lod.creaturePoseNear ? 3 : 1;
}
