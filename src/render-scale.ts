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
  }),
});

export function projectedHeightFraction(heightMeters: number, distanceMeters: number, verticalFovDegrees: number): number {
  const visibleHeight = 2 * distanceMeters * Math.tan((verticalFovDegrees * Math.PI) / 360);
  return heightMeters / Math.max(Number.EPSILON, visibleHeight);
}
