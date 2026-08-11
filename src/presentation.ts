import { MathUtils, PerspectiveCamera, Vector3 } from "three/webgpu";
import type { OrbitControls } from "three/addons/controls/OrbitControls.js";

export const GOLDEN_SHOTS = {
  "whole-island": { position: [155, 78, 178], target: [0, 14, 0] },
  "ridge-silhouette": { position: [-118, 38, 154], target: [-18, 27, -8] },
  shoreline: { position: [82, 7, 119], target: [26, 3, 20] },
  "wave-height": { position: [121, 4.8, 148], target: [28, 3.2, 24] },
  "forest-interior": { position: [-54, 9, 18], target: [-24, 10, -12] },
  herd: { position: [48, 9, 48], target: [17, 5, 9] },
  dawn: { position: [142, 43, -126], target: [0, 15, 0] },
  storm: { position: [-150, 58, -132], target: [0, 12, 0] },
} as const;

export type GoldenShotName = keyof typeof GOLDEN_SHOTS;

export function isGoldenShotName(value: string | null): value is GoldenShotName {
  return value !== null && value in GOLDEN_SHOTS;
}

const shotNames = Object.keys(GOLDEN_SHOTS) as GoldenShotName[];
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
      readShot(shotNames[0], position, target);
      readShot(shotNames[1], nextPosition, nextTarget);
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
        segmentIndex = (segmentIndex + 1) % shotNames.length;
        segmentStart = elapsed;
        readShot(shotNames[segmentIndex], position, target);
        readShot(shotNames[(segmentIndex + 1) % shotNames.length], nextPosition, nextTarget);
      }
      const rawProgress = MathUtils.clamp((elapsed - segmentStart) / segmentDuration, 0, 1);
      const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
      camera.position.lerpVectors(position, nextPosition, progress);
      controls.target.lerpVectors(target, nextTarget, progress);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
    },
  };
}
