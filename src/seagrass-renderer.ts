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
import { float, fract, instanceIndex, normalWorld, positionLocal, sin, smoothstep, uniform, varyingProperty, vec3 } from "three/tsl";
import type { SeagrassOutcome } from "./outcome-resolver";
import {
  causticLight,
  createReefWaterUniforms,
  downwelling,
  opticalPath,
  waterHaze,
  waterTransmission,
  type ReefWaterUniforms,
} from "./reef-water";
import { seagrassGeometry, type SeagrassGeometryLevel } from "./seagrass-geometry-assets";
import { RENDER_SCALE } from "./render-scale";

/**
 * Instance capacity for one seagrass LOD band. Matches the resolver's per-area
 * meadow cap on the 2,000 m world; see `RENDER_SCALE.islandLandRadius`.
 */
const MAX_TUFTS = 8000;
const NEAR_DISTANCE = RENDER_SCALE.lod.seagrassNear;
const LOD_REPARTITION_DISTANCE = RENDER_SCALE.lod.seagrassRepartition;
const UP = new Vector3(0, 1, 0);

export interface SeagrassRenderer {
  readonly water: ReefWaterUniforms;
  setMeadow: (seagrass: readonly SeagrassOutcome[], heightAt: (x: number, z: number) => number) => void;
  update: (elapsed: number, viewPosition: Readonly<Vector3>) => void;
}

export function createSeagrassRenderer(scene: Group, sharedWater?: ReefWaterUniforms): SeagrassRenderer {
  const water = sharedWater ?? createReefWaterUniforms();
  const sceneTime = uniform(0);
  const material = new MeshStandardNodeMaterial({
    color: 0xffffff,
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
  const path = opticalPath(water.seaLevel);
  const haze = waterHaze(path);
  const light = downwelling(water.seaLevel);
  const transmission = waterTransmission(path);
  const caustic = causticLight(water.time, water.seaLevel, normalWorld.y, water.causticStrength);
  const albedo = varyingProperty("vec3", "vInstanceColor");
  material.colorNode = albedo.mul(light).mul(float(1).add(caustic))
    .mul(transmission).mul(float(1).sub(haze));
  material.emissiveNode = water.hazeColor.mul(haze).mul(light);

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
    water,
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
