import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardNodeMaterial,
  Quaternion,
  Vector3,
} from "three/webgpu";
import { float, normalWorld, varyingProperty } from "three/tsl";
import source from "../assets/ecosystem/epoch-coastal-forager/exports/coastal-forager.runtime.json";
import type { MarinePopulationOutcome, MarineTraits } from "./marine-lineage";
import { marineShoalSamples, type CoastalAnimalOutcome } from "./outcome-resolver";
import {
  causticLight,
  createReefWaterUniforms,
  downwelling,
  opticalPath,
  waterHaze,
  waterTransmission,
  type ReefWaterUniforms,
} from "./reef-water";

export const FISH_MORPH_CHANNELS = [
  "bodySize", "streamlining", "maneuverability", "depthControl", "swimLeft", "swimRight",
] as const;

const MAX_FISH = 10;
const up = new Vector3(0, 1, 0);
const matrix = new Matrix4();
const rotation = new Quaternion();
const scale = new Vector3();
const color = new Color();

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export interface FishExpression {
  readonly bodySize: number;
  readonly streamlining: number;
  readonly maneuverability: number;
  readonly depthControl: number;
  readonly thermalTolerance: number;
  readonly energy: number;
}

export function fishExpression(traits: Readonly<MarineTraits>, energy = 0.6): FishExpression {
  return {
    bodySize: clamp01(traits.bodySize),
    streamlining: clamp01(traits.streamlining),
    maneuverability: clamp01(traits.maneuverability),
    depthControl: clamp01(traits.depthControl),
    thermalTolerance: clamp01(traits.thermalTolerance),
    energy: clamp01(energy),
  };
}

export function createCoastalForagerGeometry(): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(source.positions, 3));
  geometry.setIndex(source.indices);
  geometry.morphAttributes.position = FISH_MORPH_CHANNELS.map(
    (channel) => new Float32BufferAttribute(source.morphTargets[channel], 3),
  );
  geometry.morphTargetsRelative = source.morphTargetsRelative;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

interface FishState {
  baseX: number;
  baseY: number;
  baseZ: number;
  heading: number;
  phase: number;
  sampleScale: number;
  visible: boolean;
  expression: FishExpression;
}

export interface FishRenderer {
  readonly mesh: InstancedMesh;
  readonly water: ReefWaterUniforms;
  setPopulation: (population: MarinePopulationOutcome | undefined, samples?: readonly CoastalAnimalOutcome[]) => void;
  update: (elapsed: number) => void;
}

export function createFishRenderer(parent: Group, sharedWater?: ReefWaterUniforms): FishRenderer {
  const geometry = createCoastalForagerGeometry();
  const water = sharedWater ?? createReefWaterUniforms();
  const material = new MeshStandardNodeMaterial({ color: 0xffffff, roughness: 0.48, metalness: 0.04 });
  const path = opticalPath(water.seaLevel);
  const haze = waterHaze(path);
  const light = downwelling(water.seaLevel);
  const transmission = waterTransmission(path);
  const caustic = causticLight(water.time, water.seaLevel, normalWorld.y, water.causticStrength);
  const albedo = varyingProperty("vec3", "vInstanceColor");
  material.colorNode = albedo.mul(light).mul(float(1).add(caustic.mul(1.2)))
    .mul(transmission).mul(float(1).sub(haze));
  material.emissiveNode = water.hazeColor.mul(haze).mul(light);
  const mesh = new InstancedMesh(geometry, material, MAX_FISH);
  const probe = new Mesh(geometry, material);
  const states: FishState[] = Array.from({ length: MAX_FISH }, (_, index) => ({
    baseX: 0, baseY: -2, baseZ: 0, heading: 0, phase: index * 1.37, sampleScale: 1, visible: false,
    expression: { bodySize: 0.5, streamlining: 0.5, maneuverability: 0.5, depthControl: 0.5, thermalTolerance: 0.5, energy: 0.6 },
  }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Three's morph node expects an instanced morph texture only when count > 1;
  // a visible zero-count mesh instead reaches its absent uniform-array path.
  mesh.visible = false;
  parent.add(mesh);

  function setMorph(index: number, expression: FishExpression, swim: number): void {
    probe.morphTargetInfluences!.fill(0);
    probe.morphTargetInfluences![0] = expression.bodySize;
    probe.morphTargetInfluences![1] = expression.streamlining;
    probe.morphTargetInfluences![2] = expression.maneuverability;
    probe.morphTargetInfluences![3] = expression.depthControl;
    probe.morphTargetInfluences![swim >= 0 ? 4 : 5] = Math.abs(swim);
    mesh.setMorphAt(index, probe);
  }

  function sync(elapsed: number): void {
    let count = 0;
    states.forEach((state, index) => {
      if (!state.visible) return;
      count = index + 1;
      const energyCadence = 0.65 + state.expression.energy * 0.85;
      const maneuverCadence = 0.72 + state.expression.maneuverability * 0.44;
      const phase = elapsed * energyCadence * maneuverCadence + state.phase + state.heading;
      const radiusX = 1.25 + state.expression.streamlining * 0.9;
      const radiusZ = 0.95 + state.expression.maneuverability * 0.75;
      const x = state.baseX + Math.cos(phase * 0.42) * radiusX;
      const z = state.baseZ + Math.sin(phase * 0.42) * radiusZ;
      const verticalAmplitude = 0.08 + state.expression.depthControl * 0.34;
      const y = state.baseY + Math.sin(phase * 0.68) * verticalAmplitude;
      const dx = -Math.sin(phase * 0.42) * radiusX;
      const dz = Math.cos(phase * 0.42) * radiusZ;
      rotation.setFromAxisAngle(up, -Math.atan2(dz, dx));
      // The generated source spans about 3.3 units nose-to-tail. Keep the
      // runtime family inside its 0.35–1.4 m manifest contract while allowing
      // body size to remain legible against coral branches.
      const condition = 0.9 + state.expression.energy * 0.1;
      scale.setScalar((0.27 + state.expression.bodySize * 0.1) * condition * state.sampleScale);
      matrix.compose(new Vector3(x, y, z), rotation, scale);
      mesh.setMatrixAt(index, matrix);
      setMorph(index, state.expression, Math.sin(phase * 4.8) * (0.36 + state.expression.streamlining * 0.26));
    });
    mesh.count = count;
    mesh.visible = count > 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.morphTexture) mesh.morphTexture.needsUpdate = true;
    mesh.computeBoundingSphere();
  }

  return {
    mesh,
    water,
    setPopulation(population, samples) {
      const shoal = samples ?? (population ? marineShoalSamples(population) : []);
      const expression = population?.traits ? fishExpression(population.traits, population.energy) : undefined;
      states.forEach((state, index) => {
        const sample = shoal[index];
        state.visible = sample !== undefined && expression !== undefined && population?.visible === true;
        if (!state.visible || !sample || !expression) return;
        state.baseX = sample.x;
        state.baseY = sample.y;
        state.baseZ = sample.z;
        state.heading = sample.heading;
        state.sampleScale = sample.scale;
        state.expression = expression;
        const warmth = expression.thermalTolerance;
        const condition = expression.energy;
        // LW-1: the old hue band (0.33–0.51) sat on top of the teal water
        // column, so the shoal read as water. Coloration reads habitat
        // temperature instead — warm-water reef fish are vivid gold-to-coral,
        // cool-water fish deep blue-violet — and both branches sit off the
        // water band so the population separates from its medium. The split at
        // warmth 0.5 is a real tropical/temperate threshold, not a gradient.
        const hue = warmth >= 0.5
          ? 0.09 - (warmth - 0.5) * 0.16 // 0.09 gold → 0.01 coral-red
          : 0.60 + (0.5 - warmth) * 0.16; // 0.60 blue → 0.68 violet
        color.setHSL(hue, 0.6 + condition * 0.28, 0.44 + condition * 0.16);
        mesh.setColorAt(index, color);
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      sync(0);
    },
    update: sync,
  };
}
