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
} as const;

export type GoldenShotName = keyof typeof GOLDEN_SHOTS;

export function isGoldenShotName(value: string | null): value is GoldenShotName {
  return value !== null && value in GOLDEN_SHOTS;
}

export const SCREENSAVER_SHOTS: readonly GoldenShotName[] = [
  "whole-island",
  "ridge-silhouette",
  "shoreline",
  "reef-above",
  "herd-contrast",
  "dawn",
  "storm",
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
