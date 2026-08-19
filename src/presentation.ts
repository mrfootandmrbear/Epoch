import { MathUtils, PerspectiveCamera, Vector3 } from "three/webgpu";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";

export const GOLDEN_SHOTS = {
  "whole-island": { position: [155, 78, 178], target: [0, 14, 0] },
  "ridge-silhouette": { position: [-118, 38, 154], target: [-18, 27, -8] },
  shoreline: { position: [82, 7, 119], target: [26, 3, 20] },
  "wave-height": { position: [121, 4.8, 148], target: [28, 3.2, 24] },
  "seagrass-meadow": { position: [96, 20, 132], target: [48, -1.5, 62] },
  // Camera under the surface and down among the colonies. Coral cannot be
  // judged from above the water: absorption, subsurface scatter, caustics and
  // the water column are all functions of the path light takes to the eye, and
  // an over-water shot puts almost none of that path in frame.
  reef: { position: [116, -2.2, 128], target: [104, -7.2, 116] },
  fish: { position: [112, -4.0, 124], target: [104, -5.1, 116] },
  "reef-above": { position: [130, 16, 145], target: [104, -3, 116] },
  "forest-interior": { position: [-54, 9, 18], target: [-24, 10, -12] },
  herd: { position: [40, 30, 38], target: [17, 18, 9] },
  // Mid distance, framing both contrast herds at once: the rung-7 judgement is
  // whether two populations read apart from movement alone at this range.
  "herd-contrast": { position: [15, 72, 126], target: [14, 12, 3] },
  // Near enough for coat structure to resolve, which is the rung-6 judgement.
  // The overview and mid rungs alone could never show it.
  "coat-detail": { position: [64, 30, 30], target: [42, 12, -10] },
  dawn: { position: [142, 43, -126], target: [0, 15, 0] },
  storm: { position: [-150, 58, -132], target: [0, 12, 0] },

  // ---------------------------------------------------------------------
  // 2 km world (`w2k-` prefix), added 2026-08-15 with the `islandExtent`
  // change in `docs/EXECUTION.md` order of work item 0.
  //
  // The cameras above are kept exactly as they were because they are the
  // comparison basis for every capture taken before the resize. They are
  // also, as of that change, **no longer meaningful**: each of them frames a
  // volume roughly a fifth of the world across, so on the 2,000 m grid they
  // sit inside the island or stare at open water. Do not A/B a new capture
  // against a pre-resize one taken through them — the subject moved, not the
  // renderer. Use these instead, and treat them as a fresh baseline.
  // ---------------------------------------------------------------------

  /** The island group with sea around it — the regional-cohesion framing. */
  "w2k-whole-island": { position: [560, 250, 640], target: [0, 22, 0] },
  /** Low and seaward: shield profile against the sky, which is the whole point of the resize. */
  "w2k-shield-profile": { position: [1180, 96, 210], target: [-40, 46, 30] },
  /** Across the saddle between two shields, where connectivity is won and lost. */
  "w2k-saddle": { position: [-560, 168, 700], target: [60, 30, 60] },
  /** Just off the beach, at wave height — the shore has to read as walkable ground. */
  "w2k-shoreline": { position: [372, 9, 384], target: [232, 3, 244] },
  /**
   * Over the re-seated review shelf in `environment-fixtures.ts`, at the same
   * short range and down-angle the pre-resize `reef-above` used. Pulling back
   * to a "wide" distance on the 2 km world simply frames the fixture's young
   * basalt shield instead of the reef.
   */
  "w2k-reef-above": { position: [298, 13, 333], target: [280, -6, 313] },
  "w2k-dawn": { position: [760, 230, -680], target: [0, 26, 0] },
  "w2k-storm": { position: [-800, 310, -700], target: [0, 22, 0] },

  // ---------------------------------------------------------------------
  // Multi-shield chain (`w2k-chain-` prefix), added 2026-08-15 when accretion
  // was pointed at the archipelago shield record.
  //
  // The chain marches along -x at z ≈ 11 m, because the terrain grid is the
  // crust frame and the hotspot walks backwards through it. Measured shield
  // positions after three million-year jumps: shield-0 at x = -22, shield-1 at
  // -403, shield-2 at -784. The plume leaves the 2 km grid at x = -1000, which
  // is 2.45 Myr of drift, so these cameras frame the whole producible chain.
  // ---------------------------------------------------------------------

  /** The chain broadside: every island the hotspot has made, oldest at the right. */
  "w2k-chain": { position: [-380, 420, 1150], target: [-380, 6, 11] },
  /**
   * The land bridge between shield-0 and shield-1, at their midpoint. This is
   * the shot the connectivity work exists for: the saddle rises above sea level
   * as the two skirts meet, then erodes back under it.
   */
  "w2k-chain-saddle": { position: [-212, 96, 430], target: [-212, 5, 20] },

  /**
   * Near look at the land-iguana founder showcase (WU-4a). Seated at the
   * candidate herd point (17, 9). Weathered-island ground there is ~20.6 m;
   * camera is ~4 m out at hip height so crest and sprawl read. Added; existing
   * cameras are unedited.
   */
  "proof-founder": { position: [23.5, 21.6, 10.2], target: [17.3, 20.85, 9.1] },

  // ---------------------------------------------------------------------
  // Proof placement (WU-4b). Cameras frame the live lineages
  // `scripts/founding-split-readout.ts` names for
  // `?founders=drifter&plume=active&years=1000000&jumps=N`. Added; existing
  // cameras are unedited. Sites are coastal, so mid shots sit on the landward
  // side and keep water in frame.
  // ---------------------------------------------------------------------

  /** Jump 2: one established founder on island-0, site ≈ (-178, 4, -217). */
  "proof-established-overview": { position: [-90, 92, -28], target: [-160, 6, -170] },
  "proof-established-mid": { position: [-150, 16, -188], target: [-178, 5.5, -217] },
  /**
   * Jump 3: parent on island-0 ≈ (-256, 8, -118), branch on island-1 ≈
   * (-638, 2.5, -72). Overview shows both shields.
   */
  "proof-speciated-overview": { position: [-430, 195, 470], target: [-430, 8, -40] },
  "proof-speciated-parent-mid": { position: [-226, 20, -98], target: [-256, 9, -118] },
  "proof-speciated-branch-mid": { position: [-662, 15, -58], target: [-638, 4, -72] },
  /**
   * Jump 5: parent island-0 east ≈ (150, 10, -92), child island-0 north ≈
   * (-151, 7, 298), branch island-1 ≈ (-688, 3, -42).
   */
  "proof-diversified-overview": { position: [120, 210, 510], target: [-250, 10, 40] },
  "proof-diversified-parent-mid": { position: [182, 22, -74], target: [150, 11, -92] },
  "proof-diversified-branch-mid": { position: [-714, 15, -28], target: [-688, 4.5, -42] },
  "proof-diversified-child-mid": { position: [-123, 20, 318], target: [-151, 8.5, 298] },

  // ---------------------------------------------------------------------
  // Ancestry split (WU-4c). Same targets as the WU-4b mid cameras, pulled in
  // along the mid azimuth to ~5.8 m so crest, feet, and coat read. Added;
  // existing cameras are unedited.
  // ---------------------------------------------------------------------
  "proof-established-near": { position: [-173.97, 6.35, -212.83], target: [-178, 5.5, -217] },
  "proof-speciated-parent-near": { position: [-251.17, 9.85, -114.78], target: [-256, 9, -118] },
  "proof-speciated-branch-near": { position: [-643.01, 4.85, -69.08], target: [-638, 4, -72] },
  "proof-diversified-parent-near": { position: [155.05, 11.85, -89.16], target: [150, 11, -92] },
  "proof-diversified-branch-near": { position: [-693.11, 5.35, -39.25], target: [-688, 4.5, -42] },
  "proof-diversified-child-near": { position: [-146.28, 9.35, 301.37], target: [-151, 8.5, 298] },

  // ---------------------------------------------------------------------
  // Underwater navigation (WU-N1). Added; existing cameras are unedited.
  // Framed on the re-seated review shelf (`w2k-reef-above` target ≈ 280, -6,
  // 313) so the owner look has seabed in frame. Polar of the look-up shot
  // stays inside the submerged 120° cone.
  // ---------------------------------------------------------------------
  /** Shallows, camera ~−3 m, looking along the inner shelf. */
  "w2k-underwater-shallow": { position: [268, -3, 300], target: [252, -4.5, 286] },
  /** Shelf, camera ~−10 m, seaward of the review colonies. */
  "w2k-underwater-shelf": { position: [312, -10, 348], target: [292, -12, 328] },
  /** Slope, camera ~−25 m, looking back toward the shelf. */
  "w2k-underwater-slope": { position: [398, -25, 446], target: [372, -28, 418] },
  /** From the shelf, looking up at the underside of the surface. */
  "w2k-underwater-look-up": { position: [290, -9, 325], target: [280, -1, 313] },

  // ---------------------------------------------------------------------
  // Splash-zone crab occupancy (WU-M1). Added; existing cameras are unedited.
  // Tight shoreline mid/near on the clustered splash patch after a 10 kyr
  // young-volcano landing (~-299, 0.21, 127). Carapace is centimetre-scale;
  // overview cannot judge this family.
  // ---------------------------------------------------------------------
  "w2k-splash-crab-mid": { position: [-304.2, 1.45, 128.8], target: [-298.5, 0.24, 127] },
  "w2k-splash-crab-near": { position: [-300.9, 0.68, 127.9], target: [-298.6, 0.2, 127.1] },
} as const;

export type GoldenShotName = keyof typeof GOLDEN_SHOTS;

export function isGoldenShotName(value: string | null): value is GoldenShotName {
  return value !== null && value in GOLDEN_SHOTS;
}

/** Overview camera for a proof-fixture jump count. Live URLs keep the UI. */
export function proofOverviewShot(jumps: number): GoldenShotName {
  if (jumps >= 5) return "proof-diversified-overview";
  if (jumps >= 3) return "proof-speciated-overview";
  return "proof-established-overview";
}

/**
 * The attract tour. Re-pointed at the `w2k-` cameras when the world widened:
 * the pre-resize framings still exist for evidence comparison, but a tour
 * built from them would fly the player through the inside of the island.
 */
export const SCREENSAVER_SHOTS: readonly GoldenShotName[] = [
  "w2k-whole-island",
  "w2k-shield-profile",
  "w2k-saddle",
  "w2k-shoreline",
  "w2k-reef-above",
  "w2k-dawn",
  "w2k-storm",
];

export function screensaverCameraHeight(
  interpolatedHeight: number,
  terrainHeight: number,
  progress: number,
): number {
  const travelLift = Math.sin(MathUtils.clamp(progress, 0, 1) * Math.PI) * 34;
  return Math.max(interpolatedHeight + travelLift, terrainHeight + 8);
}
const position = new Vector3();
const target = new Vector3();
const nextPosition = new Vector3();
const nextTarget = new Vector3();

function readShot(name: GoldenShotName, outPosition: Vector3, outTarget: Vector3): void {
  const shot = GOLDEN_SHOTS[name];
  outPosition.fromArray(shot.position);
  outTarget.fromArray(shot.target);
}

export interface PresentationController {
  readonly active: boolean;
  setActive: (active: boolean, elapsed?: number) => void;
  applyShot: (name: GoldenShotName) => void;
  update: (elapsed: number) => void;
}

export function createPresentationController(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  onActivityChange: (active: boolean) => void,
  terrainHeightAt?: (x: number, z: number) => number,
): PresentationController {
  let active = false;
  let segmentStart = 0;
  let segmentIndex = 0;
  const segmentDuration = 22;

  function applyShot(name: GoldenShotName): void {
    readShot(name, camera.position, controls.target);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    controls.update();
  }

  function setActive(next: boolean, elapsed = 0): void {
    if (active === next) return;
    active = next;
    controls.enabled = !next;
    segmentStart = elapsed;
    segmentIndex = 0;
    if (next) {
      readShot(SCREENSAVER_SHOTS[0]!, position, target);
      readShot(SCREENSAVER_SHOTS[1]!, nextPosition, nextTarget);
    }
    onActivityChange(next);
  }

  return {
    get active() { return active; },
    setActive,
    applyShot,
    update(elapsed) {
      if (!active) return;
      const segmentElapsed = elapsed - segmentStart;
      if (segmentElapsed >= segmentDuration) {
        segmentIndex = (segmentIndex + 1) % SCREENSAVER_SHOTS.length;
        segmentStart = elapsed;
        readShot(SCREENSAVER_SHOTS[segmentIndex]!, position, target);
        readShot(SCREENSAVER_SHOTS[(segmentIndex + 1) % SCREENSAVER_SHOTS.length]!, nextPosition, nextTarget);
      }
      const rawProgress = MathUtils.clamp((elapsed - segmentStart) / segmentDuration, 0, 1);
      const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
      camera.position.lerpVectors(position, nextPosition, progress);
      const terrainFloor = terrainHeightAt?.(camera.position.x, camera.position.z) ?? -Infinity;
      camera.position.y = screensaverCameraHeight(camera.position.y, terrainFloor, progress);
      controls.target.lerpVectors(target, nextTarget, progress);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
    },
  };
}
