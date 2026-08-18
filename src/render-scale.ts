/** Canonical physical scale for every landing renderer. One world unit is one metre. */
export const RENDER_SCALE = Object.freeze({
  metersPerWorldUnit: 1,
  /**
   * Width of the playable crust grid, in metres.
   *
   * Raised from the 380 m render-proof-of-concept inheritance on 2026-08-15
   * (`docs/EXECUTION.md` order of work item 0, owner chose option C). 380 m
   * could not contain a single plausible shield: a 48 m summit at the ~10°
   * flank a Galápagos shield actually has needs a 272 m base radius, so the
   * old grid produced a 43° cone instead. At 2,000 m two shields and their
   * saddle fit with open sea around them, and the chain has room for a third
   * to arrive over deep time.
   *
   * Everything below that carries a distance is expressed against this.
   */
  islandExtent: 2000,
  /**
   * Terrain grid resolution. 401×401 over `islandExtent` is 5.0 m per cell.
   *
   * Chosen against the ocean-current pressure solve, whose cost grows with
   * side³ — the width is bought with coarser cells rather than with more of
   * them. `terrain-history.ts` normalizes its geomorphic coefficients against
   * cell size, so this can move without re-tuning erosion by hand.
   */
  terrainSegments: 400,
  /**
   * Radius, in metres, of the land the authored starting worlds actually put
   * on the grid — not the grid's own half-width.
   *
   * The two are deliberately different. `islandExtent` is the whole crust
   * frame, most of which is open sea at 2,000 m; this is the island group
   * inside it. Anything that scatters over *land* — vegetation, coastal
   * sampling, aerial siting — has to be sized against this, or it either
   * clusters in the middle of the map or wastes its candidate budget on water.
   */
  islandLandRadius: 445,
  oceanExtent: 7000,
  oceanPatch: 1000,
  typicalTreeHeight: 6,
  /**
   * Leftover grazer-era shoulder height. Do not drive land-iguana cameras,
   * occupancy marks, or herd spacing from this. The founder hip is ~0.26 m;
   * inspection fly is `LINEAGE_INSPECTION_DISTANCE` (38 m) in camera-focus.
   */
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
    // Coral is small and dense, and it is looked at from close range far more
    // than a tree is. The near band is tighter than the tree band for that
    // reason, not because the geometry is cheaper.
    coralNear: 46,
    coralRepartition: 5,
  }),
});

/**
 * The island radius, in metres, that the pre-2 km world's authored constants
 * were written against — landform terms, site positions, wander bounds,
 * migration reach, the drifter's arrival point.
 */
export const AUTHORED_ISLAND_RADIUS = 165;

/**
 * Factor for re-seating anything authored in the old world's metres.
 *
 * Every one of those constants is a *distance on the island*, so they follow
 * `islandLandRadius`, not `islandExtent` — the grid is mostly open sea and
 * scaling by it would push island-relative things out to the horizon. Several
 * of these were missed in the first pass of the 2 km resize precisely because
 * they were bare numeric literals in files the change never touched; keeping
 * the factor in one exported place is what makes the next resize findable.
 */
export const AUTHORED_SCALE = RENDER_SCALE.islandLandRadius / AUTHORED_ISLAND_RADIUS;

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
