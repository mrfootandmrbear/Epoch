import {
  BufferAttribute,
  Color,
  ConeGeometry,
  DataTexture,
  FloatType,
  Group,
  InstancedMesh,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  Matrix4,
  PlaneGeometry,
  RedFormat,
  RGBAFormat,
  RingGeometry,
  Scene,
  SphereGeometry,
  Quaternion,
  Vector3,
} from "three/webgpu";
import { resolveLanding, type LandingOutcome } from "./outcome-resolver";
import { createDrifterFounderHistory, populationTraitDistance, type LineageChange } from "./lineage-history";
import { lineageSeed, type PopulationIdentity } from "./population-archetypes";
import type { PopulationTraits } from "./population-traits";
import { POPULATION_TRAIT_BOUNDS } from "./population-traits";
import {
  createCreatureExpressionSpike,
  setCreatureExpressionAt,
  type CreatureExpressionSample,
} from "./creature-expression-spike";
import { resolveTerrainHistory, withGrazingPressure, withReefDeposition, withVegetationProtection } from "./terrain-history";
import { createVegetationRenderer } from "./vegetation-renderer";
import { createSeagrassRenderer } from "./seagrass-renderer";
import { createCoralRenderer } from "./coral-renderer";
import { reefHazeColor } from "./coral-material";
import { createMarineSnow } from "./marine-snow";
import { buildCurrentField, type CurrentField } from "./ocean-currents";
import { resolveReef, type ReefOutcome } from "./reef-succession";
import { createReefWaterUniforms, type ReefWaterUniforms } from "./reef-water";
import { createFreshwaterRenderer } from "./freshwater-renderer";
import { createTerrainMaterial, type TerrainMaterial } from "./terrain-material";
import { packTerrainMaterialState } from "./terrain-material-state";
import { createTerrainDetailRenderer } from "./terrain-detail-renderer";
import { createStreamRenderer } from "./stream-renderer";
import { resolveFreshwaterField } from "./freshwater-basins";
import { captureWorldSnapshot, type WorldSnapshot } from "./world-snapshot";
import { createInitialWorldState, validateWorldHistory } from "./world-history";
import { packEnvironmentField, resolveEnvironmentField } from "./environment";
import type { MarineLineageChange } from "./marine-lineage";
import { findTerrainPath, isWalkable } from "./animal-navigation";
import { approachHeading, deriveHerdBehavior, type HerdBehavior } from "./herd-behavior";
import { sampleCoat } from "./coat-variation";
import {
  DEFAULT_CLIMATE,
  SEA_LEVEL,
  type ClimateForces,
} from "./climate";
import { RENDER_SCALE, creaturePoseInterval } from "./render-scale";
import { resolveVolcanicAccretion } from "./volcanism";
import type { VolcanicOutput } from "./volcanism";
import { createFishRenderer } from "./fish-renderer";
import {
  applyHeightBrush,
  applyCliffStroke,
  applyLevelBrush,
  captureTerrainEditSnapshot,
  restoreTerrainEditSnapshot,
  TerrainEditHistory,
  type TerrainBrushSettings,
} from "./terrain-edit";

const TERRAIN_SIZE = RENDER_SCALE.islandExtent;
const TERRAIN_HALF = TERRAIN_SIZE / 2;
const TERRAIN_SEGMENTS = 180;
const TERRAIN_SIDE = TERRAIN_SEGMENTS + 1;
const TERRAIN_STEP = TERRAIN_SIZE / TERRAIN_SEGMENTS;

function hash(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function terrainHeight(x: number, z: number): number {
  const d = Math.hypot(x * 0.92, z * 1.08);
  const island = Math.max(0, 1 - Math.pow(d / 165, 2.25));
  const ridge = 20 * Math.exp(-Math.pow((x + 24 + z * 0.16) / 38, 2));
  const highlands = 13 * Math.sin(x * 0.038 + z * 0.016) + 7 * Math.sin(z * 0.071);
  const weathering = 3.5 * Math.sin(x * 0.17) * Math.cos(z * 0.13);
  const river = 9 * Math.exp(-Math.pow((x - 18 - 16 * Math.sin(z * 0.025)) / 10, 2));
  return island * (7 + ridge + highlands * island + weathering) - river * island - 3.2;
}

function formedTerrainColor(height: number, x: number, z: number): Color {
  const variation = (hash(Math.floor(x / 8), Math.floor(z / 8)) - 0.5) * 0.08;
  if (height < 0.8) return new Color(0.5 + variation, 0.41 + variation, 0.25);
  if (height < 18) return new Color(0.39 + variation, 0.31 + variation, 0.2);
  return new Color(0.31 + variation, 0.3 + variation, 0.27 + variation);
}

function makeTerrain(
  stateTexture: DataTexture,
  volcanicTexture: DataTexture,
  environmentTexture: DataTexture,
  water: ReefWaterUniforms,
): Mesh<PlaneGeometry, TerrainMaterial> {
  const geometry = new PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const color = new Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = terrainHeight(x, z);
    positions.setY(i, y);
    color.copy(formedTerrainColor(y, x, z));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const terrain = new Mesh(
    geometry,
    createTerrainMaterial({
      stateTexture,
      volcanicTexture,
      environmentTexture,
      terrainExtent: TERRAIN_SIZE,
      seaLevel: SEA_LEVEL[DEFAULT_CLIMATE.seaLevel],
      water,
    }),
  );
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  return terrain;
}

function makeVolcanicTexture(): DataTexture {
  const result = new DataTexture(
    new Float32Array(TERRAIN_SIDE * TERRAIN_SIDE * 4), TERRAIN_SIDE, TERRAIN_SIDE, RGBAFormat, FloatType,
  );
  result.minFilter = LinearFilter;
  result.magFilter = LinearFilter;
  result.needsUpdate = true;
  return result;
}

function makeEnvironmentTexture(): DataTexture {
  const result = new DataTexture(
    new Float32Array(TERRAIN_SIDE * TERRAIN_SIDE * 4), TERRAIN_SIDE, TERRAIN_SIDE, RGBAFormat, FloatType,
  );
  result.minFilter = LinearFilter;
  result.magFilter = LinearFilter;
  result.needsUpdate = true;
  return result;
}

function makeTerrainStateTexture(): DataTexture {
  const result = new DataTexture(
    new Float32Array(TERRAIN_SIDE * TERRAIN_SIDE * 4),
    TERRAIN_SIDE,
    TERRAIN_SIDE,
    RGBAFormat,
    FloatType,
  );
  result.minFilter = LinearFilter;
  result.magFilter = LinearFilter;
  result.needsUpdate = true;
  return result;
}

function makeHeightTexture(terrain: Mesh): DataTexture {
  const positions = terrain.geometry.attributes.position;
  const data = new Float32Array(positions.count);
  for (let i = 0; i < positions.count; i++) data[i] = positions.getY(i);
  const side = Math.round(Math.sqrt(positions.count));
  const result = new DataTexture(data, side, side, RedFormat, FloatType);
  result.minFilter = LinearFilter;
  result.magFilter = LinearFilter;
  result.needsUpdate = true;
  return result;
}

function makeOceanMaskTexture(): DataTexture {
  const result = new DataTexture(
    new Float32Array(TERRAIN_SIDE * TERRAIN_SIDE),
    TERRAIN_SIDE,
    TERRAIN_SIDE,
    RedFormat,
    FloatType,
  );
  result.minFilter = LinearFilter;
  result.magFilter = LinearFilter;
  result.needsUpdate = true;
  return result;
}

function makeWetShore(terrain: Mesh): Mesh {
  const geometry = terrain.geometry.clone();
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(
    geometry.attributes.position.count * 4,
  ), 4));
  const material = new MeshStandardMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.78,
    roughness: 0.3,
    metalness: 0.04,
    depthWrite: false,
  });
  const result = new Mesh(geometry, material);
  result.renderOrder = 2;
  result.receiveShadow = true;
  return result;
}

/**
 * Interim target herd size. The declared range is 50–200 individuals per
 * population (`docs/DOC-ALIGNMENT-PLAN.md`, open decision 9); 96 sits low in
 * that band with headroom. Instance count does not change the draw count —
 * one `InstancedMesh` still renders each lineage — so the cost that matters
 * is CPU steering and morph upload, both bounded below.
 */
const HERD_INSTANCE_COUNT = 96;

/**
 * A* over the coarse nav grid is far too expensive to run for every animal on
 * the frame a herd is placed or a jump resolves. Requests are spread across
 * frames instead; an animal without a path simply grazes in place until its
 * turn comes, which is invisible at herd scale.
 */
const PATHS_PER_FRAME = 3;

/** Repartition creature LOD at least this often even from a still camera. */
const LOD_REPARTITION_FRAMES = 120;

interface AnimalNavigationState {
  path: Vector3[];
  waypoint: number;
  journey: number;
}

interface AnimalInstanceState {
  readonly position: Vector3;
  rotationY: number;
  visible: boolean;
  walkPhase: number;
  /**
   * Frames between walk-cycle morph writes for this animal: 1 near, higher at
   * mid distance, and 0 once it is far enough that the pose is frozen.
   */
  poseInterval: number;
}

interface LineageRenderState {
  readonly id: string;
  readonly seed: number;
  readonly herd: InstancedMesh;
  readonly animals: readonly AnimalInstanceState[];
  readonly navigation: readonly AnimalNavigationState[];
  readonly previousSiteMarker: Mesh;
  /** Movement read off this lineage's trait means; replaced whenever they change. */
  behavior: HerdBehavior;
}

function createLineageRenderState(
  scene: Group,
  id: string,
  identity: PopulationIdentity,
): LineageRenderState {
  const seed = lineageSeed(identity, id);
  const animals = Array.from({ length: HERD_INSTANCE_COUNT }, (_, index): AnimalInstanceState => ({
    position: new Vector3(),
    rotationY: 0,
    visible: false,
    walkPhase: hash(index, seed + 171),
    poseInterval: 1,
  }));
  const emptySample: CreatureExpressionSample = {
    shape: [0.5, 0.5, 0.5, 0.5, 0.5],
    coatWarmth: 0.5,
    coatLightness: 0.5,
    walkPhase: 0,
  };
  const herd = createCreatureExpressionSpike(animals.map(() => emptySample));
  herd.name = `grazer-herd:${id}`;
  scene.add(herd);
  const markerColor = new Color().setHSL(hash(seed, 503), 0.3, 0.54);
  const previousSiteMarker = new Mesh(
    new RingGeometry(2.6, 3.4, 28),
    new MeshStandardMaterial({
      color: markerColor,
      emissive: markerColor,
      emissiveIntensity: 0.35,
      roughness: 0.7,
    }),
  );
  previousSiteMarker.rotation.x = -Math.PI / 2;
  previousSiteMarker.visible = false;
  previousSiteMarker.receiveShadow = true;
  scene.add(previousSiteMarker);
  return {
    id,
    seed,
    herd,
    animals,
    navigation: animals.map(() => ({ path: [], waypoint: 0, journey: 0 })),
    previousSiteMarker,
    // Mid-range means until the lineage resolves its own.
    behavior: deriveHerdBehavior({
      bodyMass: 1, legLength: 1, footWidth: 1, insulation: 0.5,
      coatLightness: 0.5, coatWarmth: 0.5, hornLength: 1,
    }),
  };
}

const herdMatrix = new Matrix4();
const herdRotation = new Quaternion();
const herdScale = new Vector3(0.9, 0.9, 0.9);
const herdHidden = new Vector3(0, 0, 0);
const HERD_UP = new Vector3(0, 1, 0);

/** The accepted marsh-grazer's showcase means. */
const SHOWCASE_GRAZER_TRAITS: PopulationTraits = {
  bodyMass: 1.08,
  legLength: 1.05,
  footWidth: 1.04,
  insulation: 0.42,
  coatLightness: 0.48,
  coatWarmth: 0.58,
  hornLength: 0.92,
};

/** Light, long-legged, bare-coated: fast, wide-spread, loose-holding. */
const CONTRAST_NIMBLE_TRAITS: PopulationTraits = {
  bodyMass: 0.78,
  legLength: 1.36,
  footWidth: 0.7,
  insulation: 0.04,
  coatLightness: 0.72,
  coatWarmth: 0.78,
  hornLength: 1.4,
};

/** Heavy, short-legged, deeply insulated: slow, wide-turning, tightly packed. */
const CONTRAST_BULKY_TRAITS: PopulationTraits = {
  bodyMass: 1.37,
  legLength: 0.73,
  footWidth: 1.32,
  insulation: 0.96,
  coatLightness: 0.2,
  coatWarmth: 0.14,
  hornLength: 0.54,
};

function normalizedTrait(key: keyof PopulationTraits, value: number): number {
  const bounds = POPULATION_TRAIT_BOUNDS[key];
  return Math.max(0, Math.min(1, (value - bounds.min) / (bounds.max - bounds.min)));
}

function expressionSample(
  traits: PopulationTraits,
  index: number,
  seed: number,
  walkPhase: number,
): CreatureExpressionSample {
  const variation = (channel: number) => (hash(index * 13 + channel, seed + channel * 31) - 0.5) * 0.16;
  const value = (key: keyof PopulationTraits, channel: number) => (
    Math.max(0, Math.min(1, normalizedTrait(key, traits[key]) + variation(channel)))
  );
  // Shape keeps its narrow band: per-axis trait variance is a simulation
  // question the wildlife roadmap has not answered. Coat colour is already
  // documented as phenotype the renderer may sample, so it carries the
  // site-specific spread that stops a herd reading as clones.
  const coat = sampleCoat(
    normalizedTrait("coatWarmth", traits.coatWarmth),
    normalizedTrait("coatLightness", traits.coatLightness),
    index,
    seed,
  );
  return {
    shape: [
      value("bodyMass", 0),
      value("legLength", 1),
      value("footWidth", 2),
      value("insulation", 3),
      value("hornLength", 4),
    ],
    coatWarmth: coat.warmth,
    coatLightness: coat.lightness,
    walkPhase,
  };
}

function syncHerdMatrices(renderer: LineageRenderState): void {
  // Hidden animals collapse to zero scale, but trailing hidden slots need not
  // be submitted at all: abundance fills the herd from index zero upward, so
  // trimming `count` keeps a sparse population off the vertex pipeline.
  let drawn = 0;
  renderer.animals.forEach((animal, index) => {
    const scale = animal.visible ? herdScale : herdHidden;
    if (animal.visible) drawn = index + 1;
    herdRotation.setFromAxisAngle(HERD_UP, animal.rotationY);
    herdMatrix.compose(animal.position, herdRotation, scale);
    renderer.herd.setMatrixAt(index, herdMatrix);
  });
  renderer.herd.count = drawn;
  renderer.herd.instanceMatrix.needsUpdate = true;
  renderer.herd.computeBoundingSphere();
}

function addAerialAnimals(scene: Group): Group[] {
  const plumage = new MeshStandardMaterial({ color: 0xf2ead8, roughness: 0.62 });
  return Array.from({ length: 12 }, (_, index) => {
    const bird = new Group();
    const body = new Mesh(new SphereGeometry(0.55, 10, 7), plumage);
    body.scale.set(1.45, 0.55, 0.5);
    bird.add(body);
    for (const side of [-1, 1]) {
      const wing = new Mesh(new ConeGeometry(0.42, 2.2, 3), plumage);
      wing.rotation.z = side * Math.PI / 2;
      wing.position.x = side * 1.05;
      wing.userData.wing = true;
      wing.userData.side = side;
      bird.add(wing);
    }
    bird.userData.index = index;
    bird.visible = false;
    scene.add(bird);
    return bird;
  });
}

export interface WorldExperience {
  terrain: Mesh;
  terrainHeightTexture: DataTexture;
  oceanMaskTexture: DataTexture;
  beginSculpt: () => void;
  sculpt: (point: Vector3, direction: 1 | -1, settings: Readonly<TerrainBrushSettings>) => void;
  level: (point: Vector3, settings: Readonly<TerrainBrushSettings>) => void;
  cliff: (start: Vector3, end: Vector3, settings: Readonly<TerrainBrushSettings>) => void;
  placeHotSpot: (point: Vector3, output: VolcanicOutput) => void;
  setVolcanicOutput: (output: VolcanicOutput) => void;
  finishSculpt: () => void;
  undoSculpt: () => boolean;
  redoSculpt: () => boolean;
  sculptHistory: () => Readonly<{ canUndo: boolean; canRedo: boolean }>;
  introduceDistantDrifter: (currentAge: number) => boolean;
  showcaseGrazerHerd: () => void;
  showcaseHerdContrast: () => void;
  showcaseFish: () => void;
  advance: (years: number, totalYears: number, climate: ClimateForces) => LineageReport;
  /**
   * Track the sky the ocean renderer is already using, so the submerged
   * materials light and haze from the same sun rather than drifting out of
   * agreement with the water above them.
   */
  setAtmosphere: (sunDirection: Vector3, sunColor: Color) => void;
  update: (elapsed: number, viewPosition?: Readonly<Vector3>) => void;
}

export interface LineageReport {
  changes: readonly LineageChange[];
  marineChanges: readonly MarineLineageChange[];
  traitDistance?: number;
}

export function createLandingState(scene: Scene): WorldExperience {
  const terrainStateTexture = makeTerrainStateTexture();
  const volcanicTexture = makeVolcanicTexture();
  const environmentTexture = makeEnvironmentTexture();
  // Created before the terrain because the seabed reads the same submerged
  // state the reef standing on it does.
  const reefWater = createReefWaterUniforms(SEA_LEVEL[DEFAULT_CLIMATE.seaLevel]);
  const terrain = makeTerrain(terrainStateTexture, volcanicTexture, environmentTexture, reefWater);
  scene.add(terrain);
  const terrainDetails = createTerrainDetailRenderer(scene);
  const terrainHeightTexture = makeHeightTexture(terrain);
  const oceanMaskTexture = makeOceanMaskTexture();
  const wetShore = makeWetShore(terrain);
  scene.add(wetShore);
  const life = new Group();
  life.visible = false;
  const vegetation = createVegetationRenderer(life);
  const seagrass = createSeagrassRenderer(life);
  const reef = createCoralRenderer(life, new Vector3(0.4, 0.72, 0.3).normalize(), reefWater);
  const marineSnow = createMarineSnow(life, reef.water);
  const reefHaze = new Color();
  const lineageRenderers = new Map<string, LineageRenderState>();
  const freshwater = createFreshwaterRenderer(life);
  const streams = createStreamRenderer(life);
  const fish = createFishRenderer(life);
  const aerialAnimals = addAerialAnimals(life);
  scene.add(life);
  let revealed = false;
  let activeClimate: ClimateForces = { ...DEFAULT_CLIMATE };
  let lastElapsed = 0;
  let lastSnowElapsed = 0;
  let frameIndex = 0;
  const lastLodViewPosition = new Vector3(Number.POSITIVE_INFINITY, 0, 0);
  let terrainDirty = false;
  let terrainStateDirty = false;
  const terrainEditHistory = new TerrainEditHistory();
  let sculptCheckpointed = false;
  const terrainPositions = terrain.geometry.attributes.position;
  const initialHeights = new Float32Array(terrainPositions.count);
  for (let i = 0; i < terrainPositions.count; i++) initialHeights[i] = terrainPositions.getY(i);
  // Coastal animals recruit from the sea and birds arrive under their own
  // power. Non-flying terrestrial animals require an over-water drifter.
  const initialWorld = createInitialWorldState(initialHeights, TERRAIN_SIDE, TERRAIN_SIZE);
  let worldHistory = initialWorld.history;

  function syncTerrainMaterialState(): void {
    packTerrainMaterialState(
      worldHistory.terrain,
      terrainStateTexture.image.data as Float32Array,
    );
    terrainStateTexture.needsUpdate = true;
    const volcanicData = volcanicTexture.image.data as Float32Array;
    for (let index = 0; index < worldHistory.terrain.basalt.length; index++) {
      volcanicData[index * 4] = worldHistory.terrain.basalt[index]!;
      volcanicData[index * 4 + 1] = worldHistory.terrain.ash[index]!;
      volcanicData[index * 4 + 2] = worldHistory.terrain.carbonate[index]!;
      volcanicData[index * 4 + 3] = worldHistory.terrain.substrateAge[index]!;
    }
    volcanicTexture.needsUpdate = true;
    packEnvironmentField(
      resolveEnvironmentField(worldHistory.terrain, activeClimate),
      environmentTexture.image.data as Float32Array,
    );
    environmentTexture.needsUpdate = true;
    terrain.material.setSeaLevel(SEA_LEVEL[activeClimate.seaLevel]);
  }
  syncTerrainMaterialState();

  function heightAt(x: number, z: number): number {
    const gx = Math.max(0, Math.min(TERRAIN_SEGMENTS, (x + TERRAIN_HALF) / TERRAIN_STEP));
    const gz = Math.max(0, Math.min(TERRAIN_SEGMENTS, (z + TERRAIN_HALF) / TERRAIN_STEP));
    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const x1 = Math.min(TERRAIN_SEGMENTS, x0 + 1);
    const z1 = Math.min(TERRAIN_SEGMENTS, z0 + 1);
    const tx = gx - x0;
    const tz = gz - z0;
    const a = worldHistory.terrain.elevations[z0 * TERRAIN_SIDE + x0]!;
    const b = worldHistory.terrain.elevations[z0 * TERRAIN_SIDE + x1]!;
    const c = worldHistory.terrain.elevations[z1 * TERRAIN_SIDE + x0]!;
    const d = worldHistory.terrain.elevations[z1 * TERRAIN_SIDE + x1]!;
    return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * tz;
  }

  /**
   * Creature counterpart to the vegetation renderer's `updateLod`: repartition
   * only when the camera has actually moved, then let each animal keep its
   * band until the next repartition.
   *
   * Vegetation swaps geometry between bands. A herd cannot -- one instanced
   * draw per lineage is the accepted arrangement, and splitting it by distance
   * would cost the draw count that arrangement exists to protect. What degrades
   * instead is how often per-instance trait expression is resampled, which is
   * the per-frame cost creatures have and trees do not.
   */
  function updateCreatureLod(viewPosition: Readonly<Vector3>): void {
    // Unlike trees, animals cross band boundaries under their own power, so a
    // still camera cannot be taken as proof that nothing has changed. A slow
    // heartbeat repartitions anyway.
    const moved = lastLodViewPosition.distanceTo(viewPosition) >= RENDER_SCALE.lod.creatureRepartition;
    if (!moved && frameIndex % LOD_REPARTITION_FRAMES !== 0) return;
    lastLodViewPosition.copy(viewPosition);
    for (const renderer of lineageRenderers.values()) {
      for (const animal of renderer.animals) {
        animal.poseInterval = creaturePoseInterval(Math.hypot(
          animal.position.x - viewPosition.x,
          animal.position.z - viewPosition.z,
        ));
      }
    }
  }

  function syncTerrainDetails(): void {
    terrainDetails.update(worldHistory.terrain, heightAt, SEA_LEVEL[activeClimate.seaLevel]);
    streams.setTerrain(worldHistory.terrain, SEA_LEVEL[activeClimate.seaLevel]);
  }
  syncTerrainDetails();

  function forageAt(x: number, z: number): number {
    const gx = Math.max(0, Math.min(TERRAIN_SEGMENTS, (x + TERRAIN_HALF) / TERRAIN_STEP));
    const gz = Math.max(0, Math.min(TERRAIN_SEGMENTS, (z + TERRAIN_HALF) / TERRAIN_STEP));
    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const x1 = Math.min(TERRAIN_SEGMENTS, x0 + 1);
    const z1 = Math.min(TERRAIN_SEGMENTS, z0 + 1);
    const tx = gx - x0;
    const tz = gz - z0;
    const field = worldHistory.terrain.forage;
    const a = field[z0 * TERRAIN_SIDE + x0]!;
    const b = field[z0 * TERRAIN_SIDE + x1]!;
    const c = field[z1 * TERRAIN_SIDE + x0]!;
    const d = field[z1 * TERRAIN_SIDE + x1]!;
    return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * tz;
  }

  function terrainFieldAt(field: Float32Array, x: number, z: number): number {
    const gx = Math.max(0, Math.min(TERRAIN_SEGMENTS, (x + TERRAIN_HALF) / TERRAIN_STEP));
    const gz = Math.max(0, Math.min(TERRAIN_SEGMENTS, (z + TERRAIN_HALF) / TERRAIN_STEP));
    const x0 = Math.floor(gx); const z0 = Math.floor(gz);
    const x1 = Math.min(TERRAIN_SEGMENTS, x0 + 1); const z1 = Math.min(TERRAIN_SEGMENTS, z0 + 1);
    const tx = gx - x0; const tz = gz - z0;
    const a = field[z0 * TERRAIN_SIDE + x0]!; const b = field[z0 * TERRAIN_SIDE + x1]!;
    const c = field[z1 * TERRAIN_SIDE + x0]!; const d = field[z1 * TERRAIN_SIDE + x1]!;
    return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * tz;
  }

  let currentOutcome: LandingOutcome | undefined;

  function currentSnapshot(totalYears = 0) {
    return captureWorldSnapshot(
      heightAt, totalYears, activeClimate, TERRAIN_SIDE, TERRAIN_SIZE, forageAt,
      (x, z) => terrainFieldAt(worldHistory.terrain.nutrients, x, z),
      (x, z) => terrainFieldAt(worldHistory.terrain.runoff, x, z),
      worldHistory.terrain.marineNutrients,
      (x, z) => terrainFieldAt(worldHistory.terrain.basalt, x, z),
      (x, z) => terrainFieldAt(worldHistory.terrain.substrateAge, x, z),
      (x, z) => terrainFieldAt(worldHistory.terrain.sediment, x, z),
      (x, z) => terrainFieldAt(worldHistory.terrain.carbonate, x, z),
    );
  }

  let currentField: CurrentField | undefined;

  /**
   * Solve the prevailing current and resolve the reef standing in it.
   *
   * Order matters: the flow field is an input to where coral can live, not a
   * decoration applied afterwards, so it is solved from the same immutable
   * snapshot the rest of the landing resolves from. The marine snow then
   * drifts on that identical field, which is why the particulate thickens in
   * the same lee where the massive corals are.
   */
  function refreshReef(snapshot: WorldSnapshot, jumpYears = snapshot.totalYears): ReefOutcome {
    const seaLevel = SEA_LEVEL[activeClimate.seaLevel];
    currentField = buildCurrentField(snapshot, activeClimate);
    const outcome = resolveReef(snapshot, currentField, activeClimate, {
      previousHistory: worldHistory.reef,
      jumpYears,
    });
    reef.setReef(outcome.colonies);
    reef.setSeaLevel(seaLevel);
    marineSnow.setField(currentField, heightAt, seaLevel);
    return outcome;
  }

  function refreshFreshwater(totalYears = 0): void {
    const field = resolveFreshwaterField(
      currentSnapshot(totalYears),
      SEA_LEVEL[activeClimate.seaLevel],
      activeClimate.rainfall,
    );
    freshwater.setField(field);
    if (currentOutcome) {
      currentOutcome.freshwaterField = field;
      currentOutcome.freshwater = field.basins;
    }
  }

  function rendererFor(id: string, identity: PopulationIdentity): LineageRenderState {
    const existing = lineageRenderers.get(id);
    if (existing) return existing;
    const created = createLineageRenderState(life, id, identity);
    lineageRenderers.set(id, created);
    return created;
  }

  /**
   * Seats one showcase herd on the ground around a point. A phyllotaxis
   * scatter spreads it evenly without the read of a grid, and stays
   * deterministic so the fixed captures are reproducible.
   */
  function placeShowcaseHerd(
    id: string,
    traits: PopulationTraits,
    centerX: number,
    centerZ: number,
    spread = 26,
  ): void {
    const renderer = rendererFor(id, "sheltered-grazer");
    renderer.behavior = deriveHerdBehavior(traits);
    renderer.animals.forEach((animal, index) => {
      const radial = Math.sqrt((index + 0.5) / renderer.animals.length) * spread;
      const angle = index * 2.399963;
      const x = centerX + Math.cos(angle) * radial + (hash(index, renderer.seed + 311) - 0.5) * 3.4;
      const z = centerZ + Math.sin(angle) * radial + (hash(index, renderer.seed + 407) - 0.5) * 3.4;
      animal.position.set(x, heightAt(x, z), z);
      animal.rotationY = -0.55 + hash(index, renderer.seed + 204) * 0.45;
      animal.visible = isWalkable(heightAt, x, z, activeClimate);
      setCreatureExpressionAt(
        renderer.herd,
        index,
        expressionSample(traits, index, renderer.seed, animal.walkPhase),
      );
      const navigation = renderer.navigation[index]!;
      // Routes are requested lazily under the per-frame budget; pathing
      // ninety-six animals in one call would stall the frame.
      navigation.path = [];
      navigation.waypoint = 0;
      navigation.journey = 0;
    });
    if (renderer.herd.morphTexture) renderer.herd.morphTexture.needsUpdate = true;
    if (renderer.herd.instanceColor) renderer.herd.instanceColor.needsUpdate = true;
    syncHerdMatrices(renderer);
    // The herd has moved wholesale, so its LOD bands are stale whatever the
    // camera did. Same reason the vegetation renderer invalidates on setTrees.
    lastLodViewPosition.set(Number.POSITIVE_INFINITY, 0, 0);
  }

  function syncShoreSurface(): void {
    const source = terrain.geometry.attributes.position;
    const wetPositions = wetShore.geometry.attributes.position;
    const wetColors = wetShore.geometry.attributes.color;
    const heightData = terrainHeightTexture.image.data as Float32Array;
    const sea = SEA_LEVEL[activeClimate.seaLevel];
    for (let i = 0; i < source.count; i++) {
      const x = source.getX(i);
      const y = source.getY(i);
      const z = source.getZ(i);
      // Sink the finite terrain texture into deep water before its edge so
      // the depth fade never reveals the square simulation domain.
      const edgeDistance = 190 - Math.max(Math.abs(x), Math.abs(z));
      const edgeDrop = Math.max(0, Math.min(1, (42 - edgeDistance) / 42));
      heightData[i] = y - edgeDrop * edgeDrop * 38;
      wetPositions.setXYZ(i, x, y + 0.045, z);
      const wetness = Math.max(0, Math.min(1, 1 - Math.abs(y - (sea + 0.75)) / 1.15));
      wetColors.setXYZW(i, 0.16, 0.12, 0.075, wetness * wetness);
    }
    // Flood from the boundary so enclosed depressions remain freshwater
    // instead of receiving the same displaced surface as the open ocean.
    const oceanData = oceanMaskTexture.image.data as Float32Array;
    oceanData.fill(0);
    const queue = new Int32Array(TERRAIN_SIDE * TERRAIN_SIDE);
    let head = 0;
    let tail = 0;
    const visit = (index: number): void => {
      if (oceanData[index] !== 0 || heightData[index]! > sea) return;
      oceanData[index] = 1;
      queue[tail++] = index;
    };
    for (let i = 0; i < TERRAIN_SIDE; i++) {
      visit(i);
      visit((TERRAIN_SIDE - 1) * TERRAIN_SIDE + i);
      visit(i * TERRAIN_SIDE);
      visit(i * TERRAIN_SIDE + TERRAIN_SIDE - 1);
    }
    while (head < tail) {
      const index = queue[head++]!;
      const x = index % TERRAIN_SIDE;
      const z = Math.floor(index / TERRAIN_SIDE);
      if (x > 0) visit(index - 1);
      if (x < TERRAIN_SIDE - 1) visit(index + 1);
      if (z > 0) visit(index - TERRAIN_SIDE);
      if (z < TERRAIN_SIDE - 1) visit(index + TERRAIN_SIDE);
    }
    terrainHeightTexture.needsUpdate = true;
    oceanMaskTexture.needsUpdate = true;
    wetPositions.needsUpdate = true;
    wetColors.needsUpdate = true;
    wetShore.geometry.computeVertexNormals();
  }

  syncShoreSurface();

  function flushTerrainChanges(): void {
    if (!terrainDirty) return;
    terrainDirty = false;
    const positions = terrain.geometry.attributes.position;
    const colors = terrain.geometry.attributes.color;
    positions.needsUpdate = true;
    colors.needsUpdate = true;
    terrain.geometry.computeVertexNormals();
    terrain.geometry.computeBoundingSphere();
    syncShoreSurface();
    if (terrainStateDirty) {
      terrainStateDirty = false;
      syncTerrainMaterialState();
    }
    if (revealed) groundLife();
  }

  function groundLife(): void {
    if (currentOutcome) {
      vegetation.setTrees(currentOutcome.trees, heightAt, SEA_LEVEL[activeClimate.seaLevel]);
      seagrass.setMeadow(currentOutcome.seagrass, heightAt);
    }
    for (const renderer of lineageRenderers.values()) {
      const habitatVisible = currentOutcome?.populations.some(
        (population) => population.id === renderer.id && population.visible,
      ) ?? false;
      renderer.animals.forEach((animal, index) => {
        animal.position.y = heightAt(animal.position.x, animal.position.z);
        const walkable = isWalkable(heightAt, animal.position.x, animal.position.z, activeClimate);
        animal.visible = habitatVisible && walkable;
        if (!walkable) {
          renderer.navigation[index]!.path = [];
          renderer.navigation[index]!.waypoint = 0;
        }
      });
      syncHerdMatrices(renderer);
    }
    refreshFreshwater();
    lineageRenderers.forEach(({ previousSiteMarker: marker }) => {
      if (marker.visible) marker.position.y = heightAt(marker.position.x, marker.position.z) + 0.18;
    });
  }

  function syncTerrainGeometryFromHistory(): void {
    const positions = terrain.geometry.attributes.position;
    const colors = terrain.geometry.attributes.color;
    const color = new Color();
    for (let i = 0; i < positions.count; i++) {
      const y = worldHistory.terrain.elevations[i]!;
      positions.setY(i, y);
      color.copy(formedTerrainColor(y, positions.getX(i), positions.getZ(i)));
      colors.setXYZ(i, color.r, color.g, color.b);
    }
    terrainStateDirty = true;
    terrainDirty = true;
  }

  function sculpt(point: Vector3, direction: 1 | -1, settings: Readonly<TerrainBrushSettings>): void {
    if (!sculptCheckpointed) {
      terrainEditHistory.checkpoint(captureTerrainEditSnapshot(worldHistory.terrain));
      sculptCheckpointed = true;
    }
    if (!applyHeightBrush(worldHistory.terrain, point.x, point.z, direction, settings)) return;
    syncTerrainGeometryFromHistory();
  }

  function checkpointSculpt(): void {
    if (sculptCheckpointed) return;
    terrainEditHistory.checkpoint(captureTerrainEditSnapshot(worldHistory.terrain));
    sculptCheckpointed = true;
  }

  return {
    terrain,
    terrainHeightTexture,
    oceanMaskTexture,
    beginSculpt() {
      sculptCheckpointed = false;
    },
    sculpt,
    level(point, settings) {
      checkpointSculpt();
      if (!applyLevelBrush(worldHistory.terrain, point.x, point.z, settings)) return;
      syncTerrainGeometryFromHistory();
    },
    cliff(start, end, settings) {
      if (Math.hypot(end.x - start.x, end.z - start.z) < 1) return;
      checkpointSculpt();
      if (!applyCliffStroke(worldHistory.terrain, start.x, start.z, end.x, end.z, {
        radius: settings.radius,
        height: settings.strength,
      })) return;
      syncTerrainGeometryFromHistory();
    },
    placeHotSpot(point: Vector3, output: VolcanicOutput) {
      const margin = 72;
      worldHistory = {
        ...worldHistory,
        hotSpots: [{
          id: "island-vent",
          x: Math.max(-TERRAIN_HALF + margin, Math.min(TERRAIN_HALF - margin, point.x)),
          z: Math.max(-TERRAIN_HALF + margin, Math.min(TERRAIN_HALF - margin, point.z)),
          output,
        }],
      };
    },
    setVolcanicOutput(output: VolcanicOutput) {
      worldHistory = {
        ...worldHistory,
        hotSpots: worldHistory.hotSpots.map((hotSpot) => ({ ...hotSpot, output })),
      };
    },
    finishSculpt() {
      flushTerrainChanges();
      syncTerrainDetails();
      sculptCheckpointed = false;
    },
    undoSculpt() {
      const snapshot = terrainEditHistory.undo(captureTerrainEditSnapshot(worldHistory.terrain));
      if (!snapshot) return false;
      restoreTerrainEditSnapshot(worldHistory.terrain, snapshot);
      syncTerrainGeometryFromHistory();
      flushTerrainChanges();
      syncTerrainDetails();
      return true;
    },
    redoSculpt() {
      const snapshot = terrainEditHistory.redo(captureTerrainEditSnapshot(worldHistory.terrain));
      if (!snapshot) return false;
      restoreTerrainEditSnapshot(worldHistory.terrain, snapshot);
      syncTerrainGeometryFromHistory();
      flushTerrainChanges();
      syncTerrainDetails();
      return true;
    },
    sculptHistory() {
      return { canUndo: terrainEditHistory.canUndo, canRedo: terrainEditHistory.canRedo };
    },
    introduceDistantDrifter(currentAge: number) {
      if (worldHistory.lineages.lineages.some((lineage) => lineage.status !== "extinct")) return false;
      const founders = createDrifterFounderHistory(currentAge, worldHistory.lineages.lineages.length);
      worldHistory = {
        ...worldHistory,
        lineages: {
          lineages: [...worldHistory.lineages.lineages, ...founders.lineages],
        },
      };
      return true;
    },
    showcaseGrazerHerd() {
      placeShowcaseHerd("candidate-grazer-showcase", SHOWCASE_GRAZER_TRAITS, 17, 9);
    },
    showcaseHerdContrast() {
      // The rung-6 and rung-7 fixture: two populations at opposite trait means
      // on the same ground, seated close enough that one near camera reaches
      // both coats and one mid camera judges both gaits.
      placeShowcaseHerd("contrast-nimble-showcase", CONTRAST_NIMBLE_TRAITS, 6, 16, 11);
      placeShowcaseHerd("contrast-bulky-showcase", CONTRAST_BULKY_TRAITS, 30, 0, 11);
    },
    showcaseFish() {
      const traits = {
        bodySize: 0.68,
        streamlining: 0.44,
        depthPreference: 0.58,
        thermalTolerance: 0.74,
        maneuverability: 0.82,
        depthControl: 0.7,
        propulsionPlan: "tail" as const,
      };
      const samples = Array.from({ length: 8 }, (_, index) => ({
        x: 104 + Math.cos(index * 2.399) * (1.8 + index * 0.52),
        y: -5.2 + (index % 3) * 0.32,
        z: 116 + Math.sin(index * 2.399) * (1.8 + index * 0.52),
        heading: index * 2.399,
        scale: 1,
      }));
      fish.setPopulation({
        id: "coastal-forager:showcase",
        status: "active",
        visible: true,
        site: { x: 104, y: -5.2, z: 116, band: "midwater", habitat: {} as never },
        traits,
        abundance: 0.8,
        energy: 0.72,
      }, samples);
    },
    advance(years: number, totalYears: number, climate: ClimateForces) {
      revealed = true;
      activeClimate = { ...climate };
      // A jump transforms more terrain-history fields than a sculpt snapshot
      // owns, so pre-jump undo entries must never be applied to a landing.
      terrainEditHistory.clear();
      validateWorldHistory(worldHistory);
      worldHistory = {
        ...worldHistory,
        terrain: resolveTerrainHistory(
          resolveVolcanicAccretion(worldHistory.terrain, worldHistory.hotSpots, years),
          years,
          climate,
        ),
      };
      const positions = terrain.geometry.attributes.position;
      const colors = terrain.geometry.attributes.color;
      const color = new Color();
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const y = worldHistory.terrain.elevations[i]!;
        positions.setY(i, y);
        color.copy(formedTerrainColor(y, x, z));
        colors.setXYZ(i, color.r, color.g, color.b);
      }
      colors.needsUpdate = true;
      positions.needsUpdate = true;
      terrain.geometry.computeVertexNormals();
      syncShoreSurface();
      life.visible = true;
      const snapshot = currentSnapshot(totalYears);
      const reefOutcome = refreshReef(snapshot, years);
      const resolution = resolveLanding(snapshot, worldHistory.lineages, years, worldHistory.marineLineages, reefOutcome.habitat);
      const { outcome } = resolution;
      currentOutcome = outcome;
      freshwater.setField(outcome.freshwaterField);
      const protectedTerrain = withVegetationProtection(worldHistory.terrain, outcome.trees);
      worldHistory = {
        ...worldHistory,
        terrain: withReefDeposition(
          withGrazingPressure(protectedTerrain, outcome.populations, years),
          reefOutcome.sites,
          years,
        ),
        lineages: resolution.nextHistory,
        marineLineages: resolution.nextMarineHistory,
        reef: reefOutcome.history,
      };
      syncTerrainMaterialState();
      syncTerrainDetails();
      validateWorldHistory(worldHistory);
      vegetation.setTrees(outcome.trees, heightAt, SEA_LEVEL[activeClimate.seaLevel]);
      seagrass.setMeadow(outcome.seagrass, heightAt);
      // Sites are about to be reseated, so every animal's LOD band is stale.
      lastLodViewPosition.set(Number.POSITIVE_INFINITY, 0, 0);
      for (const renderer of lineageRenderers.values()) {
        if (!outcome.populations.some((lineage) => lineage.id === renderer.id)) {
          renderer.animals.forEach((animal) => { animal.visible = false; });
          syncHerdMatrices(renderer);
          renderer.previousSiteMarker.visible = false;
        }
      }
      outcome.populations.forEach((lineage) => {
        const renderer = rendererFor(lineage.id, lineage.identity);
        const site = lineage.site;
        if (!site || !lineage.traits) {
          renderer.animals.forEach((animal) => { animal.visible = false; });
          syncHerdMatrices(renderer);
          renderer.previousSiteMarker.visible = false;
          return;
        }
        renderer.behavior = deriveHerdBehavior(lineage.traits);
        const visibleAnimals = Math.max(1, Math.ceil((lineage.abundance ?? 0.34) * renderer.animals.length));
        // The site footprint grows with the number actually present, so a
        // sparse population still reads as a loose band and a full herd is not
        // crammed into the radius that seven animals used to occupy.
        const siteRadius = 5 + Math.sqrt(visibleAnimals) * 2.4;
        renderer.animals.forEach((animal, herdIndex) => {
          const angle = herdIndex * 2.399963 + hash(herdIndex, renderer.seed + 92) * 0.6;
          const radial = Math.sqrt((herdIndex + 0.5) / Math.max(1, visibleAnimals)) * siteRadius;
          const radius = 4 + radial + hash(herdIndex, renderer.seed + 103) * 2.5;
          const x = site.x + Math.cos(angle) * radius;
          const z = site.z + Math.sin(angle) * radius;
          animal.position.set(x, heightAt(x, z), z);
          animal.visible = lineage.visible && herdIndex < visibleAnimals;
          animal.rotationY = angle + Math.PI;
          setCreatureExpressionAt(
            renderer.herd,
            herdIndex,
            expressionSample(lineage.traits!, herdIndex, renderer.seed, animal.walkPhase),
          );
          const state = renderer.navigation[herdIndex]!;
          state.path = [];
          state.waypoint = 0;
          state.journey = 0;
        });
        if (renderer.herd.morphTexture) renderer.herd.morphTexture.needsUpdate = true;
        if (renderer.herd.instanceColor) renderer.herd.instanceColor.needsUpdate = true;
        syncHerdMatrices(renderer);
        const marker = renderer.previousSiteMarker;
        const previous = lineage.previousSite;
        marker.visible = lineage.visible && previous !== undefined && lineage.site !== undefined
          && Math.hypot(lineage.site.x - previous.x, lineage.site.z - previous.z) > 0.25;
        if (!marker.visible || !previous) return;
        marker.position.set(previous.x, heightAt(previous.x, previous.z) + 0.18, previous.z);
      });
      fish.setPopulation(outcome.marinePopulations.find((population) => population.visible), outcome.coastalAnimals);
      aerialAnimals.forEach((bird, index) => {
        bird.visible = outcome.aerial.visible;
        bird.userData.phase = (index / aerialAnimals.length) * Math.PI * 2;
        bird.scale.setScalar(0.78 + hash(index, 241) * 0.2);
      });
      const [first, second] = worldHistory.lineages.lineages;
      return {
        changes: resolution.changes,
        marineChanges: resolution.marineChanges,
        traitDistance: first?.traits && second?.traits
          ? populationTraitDistance(first.traits, second.traits)
          : undefined,
      };
    },
    setAtmosphere(sunDirection: Vector3, sunColor: Color) {
      reef.setLighting(sunDirection, sunColor, reefHazeColor(reefHaze, sunColor));
    },
    update(elapsed: number, viewPosition?: Readonly<Vector3>) {
      streams.update(elapsed);
      if (viewPosition) {
        vegetation.updateLod(viewPosition);
        seagrass.update(elapsed, viewPosition);
        updateCreatureLod(viewPosition);
        reef.update(elapsed, viewPosition);
        // Snow drifts on its own clock: it has to keep moving during the jump
        // transition, when the herds are frozen and `revealed` is still false.
        marineSnow.update(elapsed - lastSnowElapsed, viewPosition);
        lastSnowElapsed = elapsed;
      }
      flushTerrainChanges();
      if (!revealed) return;
      const delta = Math.min(0.05, Math.max(0, elapsed - lastElapsed));
      lastElapsed = elapsed;
      frameIndex++;
      lineageRenderers.forEach((renderer) => {
        // The herd centroid is one property of the whole group, so it is
        // resolved once per frame rather than rebuilt inside every animal.
        let centerX = 0;
        let centerZ = 0;
        let visibleCount = 0;
        for (const other of renderer.animals) {
          if (!other.visible) continue;
          centerX += other.position.x;
          centerZ += other.position.z;
          visibleCount++;
        }
        if (visibleCount > 0) {
          centerX /= visibleCount;
          centerZ /= visibleCount;
        }
        let pathBudget = PATHS_PER_FRAME;
        const behavior = renderer.behavior;
        // The morph texture is one upload for the whole herd, so it is only
        // worth re-sending if some animal in it actually re-posed this frame.
        let posesWritten = false;
        renderer.animals.forEach((animal, index) => {
        if (!animal.visible) return;
        const state = renderer.navigation[index]!;
        if (state.waypoint >= state.path.length) {
          if (pathBudget <= 0) return;
          pathBudget--;
          state.journey++;
          let destination: Vector3 | undefined;
          for (let attempt = 0; attempt < 10 && !destination; attempt++) {
            const angle = hash(index + state.journey * 17, renderer.seed + attempt) * Math.PI * 2;
            const radius = 18 + hash(index + attempt, state.journey + 44) * 35;
            const x = animal.position.x + Math.cos(angle) * radius;
            const z = animal.position.z + Math.sin(angle) * radius;
            if (Math.hypot(x, z) < 148 && isWalkable(heightAt, x, z, activeClimate)) {
              destination = new Vector3(x, heightAt(x, z), z);
            }
          }
          state.path = destination
            ? findTerrainPath(heightAt, animal.position, destination, activeClimate)
            : [];
          state.waypoint = 0;
        }
        const target = state.path[state.waypoint];
        if (!target) return;
        if (!isWalkable(heightAt, target.x, target.z, activeClimate)) {
          state.path = [];
          state.waypoint = 0;
          return;
        }
        let dx = target.x - animal.position.x;
        let dz = target.z - animal.position.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 1.4) {
          state.waypoint++;
          return;
        }
        if (visibleCount > 1) {
          const centerDistance = Math.hypot(centerX - animal.position.x, centerZ - animal.position.z);
          if (centerDistance > behavior.cohesionRadius) {
            dx += (centerX - animal.position.x) * behavior.cohesionStrength;
            dz += (centerZ - animal.position.z) * behavior.cohesionStrength;
          }
          for (const other of renderer.animals) {
            if (!other.visible || other === animal) continue;
            const awayX = animal.position.x - other.position.x;
            const awayZ = animal.position.z - other.position.z;
            const spacing = Math.hypot(awayX, awayZ);
            if (spacing > 0 && spacing < behavior.spacing) {
              dx += (awayX / spacing) * (behavior.spacing - spacing) * 0.7;
              dz += (awayZ / spacing) * (behavior.spacing - spacing) * 0.7;
            }
          }
        }
        const steeredDistance = Math.hypot(dx, dz);
        if (steeredDistance < 0.001) return;
        // Individuals vary slightly around the population's pace so a herd of
        // one mean does not move in lockstep.
        const speed = behavior.strideSpeed * (0.92 + (index % 3) * 0.055);
        // Heading is rate-limited and the animal travels along where it is
        // actually pointing, not along the raw steer vector. That is what makes
        // turn radius visible: a heavy, long-legged herd swings wide out of a
        // course change while a light one pivots almost in place.
        animal.rotationY = approachHeading(
          animal.rotationY,
          Math.atan2(-dz, dx),
          behavior.turnRate * delta,
        );
        const headingX = Math.cos(animal.rotationY);
        const headingZ = -Math.sin(animal.rotationY);
        const step = Math.min(distance, speed * delta);
        const nextX = animal.position.x + headingX * step;
        const nextZ = animal.position.z + headingZ * step;
        if (!isWalkable(heightAt, nextX, nextZ, activeClimate)) {
          state.path = [];
          state.waypoint = 0;
          return;
        }
        animal.position.x = nextX;
        animal.position.z = nextZ;
        animal.position.y = heightAt(animal.position.x, animal.position.z);
        animal.position.y += Math.sin(elapsed * 7 + index) * 0.035;
        // The phase keeps advancing even when the pose is not written, so an
        // animal that comes back into range resumes mid-stride rather than
        // snapping to wherever it was frozen.
        animal.walkPhase = (animal.walkPhase
          + delta * behavior.strideCadence * (0.9 + speed * 0.08)) % 1;
        const interval = animal.poseInterval;
        if (interval === 0 || (frameIndex + index) % interval !== 0) return;
        const morphData = renderer.herd.morphTexture?.source.data.data;
        if (morphData) {
          const stride = 8;
          const phase = animal.walkPhase;
          morphData[index * stride + 6] = phase < 0.5 ? 1 - phase * 2 : 0;
          morphData[index * stride + 7] = phase >= 0.5 ? phase * 2 - 1 : 0;
          posesWritten = true;
        }
        });
        syncHerdMatrices(renderer);
        if (posesWritten && renderer.herd.morphTexture) {
          renderer.herd.morphTexture.needsUpdate = true;
        }
      });
      fish.update(elapsed);
      if (currentOutcome?.aerial.visible) {
        aerialAnimals.forEach((bird, index) => {
          const phase = (bird.userData.phase as number) + elapsed * (0.13 + (index % 4) * 0.012);
          const radius = currentOutcome!.aerial.radius * (0.72 + hash(index, 257) * 0.48);
          bird.position.x = currentOutcome!.aerial.x + Math.cos(phase) * radius;
          bird.position.z = currentOutcome!.aerial.z + Math.sin(phase) * radius;
          bird.position.y = currentOutcome!.aerial.altitude + Math.sin(phase * 2.3) * 4 + index * 0.22;
          bird.rotation.y = -phase;
          bird.children.forEach((child) => {
            if (!child.userData.wing) return;
            const side = child.userData.side as number;
            child.rotation.z = side * (Math.PI / 2 + Math.sin(elapsed * 5.2 + index) * 0.24);
          });
        });
      }
    },
  };
}
