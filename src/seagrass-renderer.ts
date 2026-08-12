import {
  Color,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardNodeMaterial,
  Quaternion,
  Vector3,
} from "three/webgpu";
import { float, fract, instanceIndex, positionLocal, sin, smoothstep, uniform, vec3 } from "three/tsl";
import type { SeagrassOutcome } from "./outcome-resolver";
import { seagrassGeometry, type SeagrassGeometryLevel } from "./seagrass-geometry-assets";

const MAX_TUFTS = 900;
const NEAR_DISTANCE = 72;
const LOD_REPARTITION_DISTANCE = 6;
const UP = new Vector3(0, 1, 0);

export interface SeagrassRenderer {
  setMeadow: (seagrass: readonly SeagrassOutcome[], heightAt: (x: number, z: number) => number) => void;
  update: (elapsed: number, viewPosition: Readonly<Vector3>) => void;
}

export function createSeagrassRenderer(scene: Group): SeagrassRenderer {
  const sceneTime = uniform(0);
  const material = new MeshStandardNodeMaterial({
    color: 0xffffff,
    emissive: 0x102b18,
    emissiveIntensity: 0.22,
    roughness: 0.88,
    metalness: 0,
    side: DoubleSide,
  });
  const bladeHeight = positionLocal.y;
  const swayProfile = smoothstep(0.08, 1, bladeHeight).mul(smoothstep(0.08, 1, bladeHeight));
  // Each tuft gets a stable phase, preventing the entire meadow from sweeping
  // as one dark sheet. A long primary cycle and weak secondary flutter read as
  // a sheltered current rather than fast wind over terrestrial grass.
  const tuftPhase = fract(sin(float(instanceIndex).mul(12.9898)).mul(43758.5453)).mul(Math.PI * 2);
  const primary = sin(sceneTime.mul(0.42).add(tuftPhase).add(bladeHeight.mul(0.72))).mul(0.105);
  const flutter = sin(sceneTime.mul(0.19).add(tuftPhase.mul(1.7)).sub(bladeHeight.mul(1.35))).mul(0.028);
  const sway = primary.add(flutter).mul(swayProfile);
  material.positionNode = positionLocal.add(vec3(sway, float(0), sway.mul(0.18)));

  function batch(level: SeagrassGeometryLevel): InstancedMesh {
    const mesh = new InstancedMesh(seagrassGeometry(level), material, MAX_TUFTS);
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(MAX_TUFTS * 3).fill(1), 3);
    mesh.count = 0;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  const batches = { near: batch("near"), far: batch("far") };
  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const position = new Vector3();
  const scale = new Vector3();
  const color = new Color();
  const lastViewPosition = new Vector3(Number.POSITIVE_INFINITY, 0, 0);
  let currentMeadow: readonly SeagrassOutcome[] = [];
  let currentHeightAt: (x: number, z: number) => number = () => 0;

  function repartition(viewPosition: Readonly<Vector3>): void {
    const counts = { near: 0, far: 0 };
    for (const tuft of currentMeadow) {
      const distance = Math.hypot(tuft.x - viewPosition.x, tuft.z - viewPosition.z);
      const level = distance < NEAR_DISTANCE ? "near" : "far";
      const mesh = batches[level];
      const index = counts[level]++;
      position.set(tuft.x, currentHeightAt(tuft.x, tuft.z) + 0.025, tuft.z);
      rotation.setFromAxisAngle(UP, tuft.rotation);
      scale.set(tuft.spread * tuft.scale, tuft.height * tuft.scale, tuft.spread * tuft.scale);
      matrix.compose(position, rotation, scale);
      mesh.setMatrixAt(index, matrix);
      color.setHSL(tuft.hue, tuft.saturation, tuft.lightness);
      mesh.setColorAt(index, color);
    }
    for (const level of ["near", "far"] as const) {
      const mesh = batches[level];
      mesh.count = counts[level];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  return {
    setMeadow(seagrass, heightAt) {
      currentMeadow = seagrass;
      currentHeightAt = heightAt;
      lastViewPosition.set(Number.POSITIVE_INFINITY, 0, 0);
    },
    update(elapsed, viewPosition) {
      sceneTime.value = elapsed;
      if (lastViewPosition.distanceTo(viewPosition) < LOD_REPARTITION_DISTANCE) return;
      lastViewPosition.copy(viewPosition);
      repartition(viewPosition);
    },
  };
}
