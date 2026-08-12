import {
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  FloatType,
  Group,
  LinearFilter,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RedFormat,
  RingGeometry,
  Scene,
  SphereGeometry,
  Vector3,
} from "three/webgpu";
import { resolveLanding, type LandingOutcome } from "./outcome-resolver";
import { createLineageHistory, populationTraitDistance, type LineageChange } from "./lineage-history";
import { lineageSeed, type PopulationIdentity } from "./population-archetypes";
import type { PopulationTraits } from "./population-traits";
import { resolveTerrainHistory, withGrazingPressure, withVegetationProtection } from "./terrain-history";
import { createVegetationRenderer } from "./vegetation-renderer";
import { createSeagrassRenderer } from "./seagrass-renderer";
import { createFreshwaterRenderer } from "./freshwater-renderer";
import { createTerrainMaterial } from "./terrain-material";
import { resolveFreshwaterField } from "./freshwater-basins";
import { captureWorldSnapshot } from "./world-snapshot";
import { createWorldHistory, validateWorldHistory } from "./world-history";
import type { MarineLineageChange } from "./marine-lineage";
import { findTerrainPath, isWalkable } from "./animal-navigation";
import {
  DEFAULT_CLIMATE,
  RAINFALL,
  SEA_LEVEL,
  type ClimateForces,
} from "./climate";

const TERRAIN_SIZE = 380;
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

function terrainColor(
  height: number,
  x: number,
  z: number,
  climate: ClimateForces,
  disturbance = 0,
  slope = 0,
): Color {
  const variation = (hash(Math.floor(x / 8), Math.floor(z / 8)) - 0.5) * 0.07;
  const seaLevel = SEA_LEVEL[climate.seaLevel];
  const wetness = RAINFALL[climate.rainfall].moisture;
  const cold = climate.temperature === "cold";
  if (height < seaLevel + 0.8) return new Color(0.46 + variation, 0.38 + variation, 0.23);
  if (cold && height > 16) return new Color(0.72 + variation, 0.76 + variation, 0.72 + variation);
  const base = height < 8 ? new Color(
    0.19 - wetness * 0.12 + variation + disturbance * 0.2,
    0.32 + wetness * 0.2 + variation - disturbance * 0.12,
    0.14 - disturbance * 0.04,
  ) : height < 24 ? new Color(
    0.12 - wetness * 0.08 + variation + disturbance * 0.19,
    0.25 + wetness * 0.2 + variation - disturbance * 0.1,
    0.1,
  ) : new Color(0.27 + variation + disturbance * 0.12, 0.28 + variation - disturbance * 0.08, 0.22);
  const rockExposure = Math.min(0.78, Math.max(0, (slope - 0.28) / 0.52) + disturbance * 0.22);
  return base.lerp(new Color(0x716b5d).offsetHSL(0, 0, variation), rockExposure);
}

function terrainSlope(elevations: Float32Array, index: number): number {
  const x = index % TERRAIN_SIDE;
  const z = Math.floor(index / TERRAIN_SIDE);
  if (x === 0 || z === 0 || x === TERRAIN_SIDE - 1 || z === TERRAIN_SIDE - 1) return 0;
  const dx = (elevations[index + 1]! - elevations[index - 1]!) / (TERRAIN_STEP * 2);
  const dz = (elevations[index + TERRAIN_SIDE]! - elevations[index - TERRAIN_SIDE]!) / (TERRAIN_STEP * 2);
  return Math.hypot(dx, dz);
}

function formedTerrainColor(height: number, x: number, z: number): Color {
  const variation = (hash(Math.floor(x / 8), Math.floor(z / 8)) - 0.5) * 0.08;
  if (height < 0.8) return new Color(0.5 + variation, 0.41 + variation, 0.25);
  if (height < 18) return new Color(0.39 + variation, 0.31 + variation, 0.2);
  return new Color(0.31 + variation, 0.3 + variation, 0.27 + variation);
}

function makeTerrain(): Mesh {
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
    createTerrainMaterial(),
  );
  terrain.castShadow = true;
  terrain.receiveShadow = true;
  return terrain;
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

function makeGrazer(): Group {
  const animal = new Group();
  const material = new MeshStandardMaterial({ color: 0x9b7955, roughness: 0.82 });
  const dark = new MeshStandardMaterial({ color: 0x241b18, roughness: 1 });
  const body = new Mesh(new SphereGeometry(1, 12, 8), material);
  body.name = "body";
  const head = new Mesh(new SphereGeometry(0.55, 10, 7), material);
  head.name = "head";
  animal.add(body, head);
  for (const z of [-0.55, 0.55]) {
    for (const x of [-0.85, 0.75]) {
      const leg = new Mesh(new CylinderGeometry(0.1, 0.13, 1.5, 5), dark);
      leg.name = "leg";
      leg.userData.baseX = x;
      leg.userData.side = z;
      animal.add(leg);
    }
  }
  for (const z of [-0.32, 0.32]) {
    const horn = new Mesh(new ConeGeometry(0.11, 1, 6), dark);
    horn.name = "horn";
    horn.userData.side = z;
    horn.rotation.z = -0.55;
    animal.add(horn);
  }
  animal.traverse((child) => {
    if (child instanceof Mesh) child.castShadow = true;
  });
  return animal;
}

/** The sole seam between semantic population traits and today's primitive rig. */
function applyGrazerTraits(animal: Group, traits: PopulationTraits): void {
  const body = animal.getObjectByName("body") as Mesh;
  const head = animal.getObjectByName("head") as Mesh;
  const bodyLength = 1.36 + traits.bodyMass * 0.2;
  const bodyHeight = 0.62 + traits.bodyMass * 0.19 + traits.insulation * 0.12;
  const bodyWidth = 0.58 + traits.bodyMass * 0.13 + traits.insulation * 0.09;
  const legHeight = 1.5 * traits.legLength;
  const bodyY = legHeight + bodyHeight * 0.82;
  const coat = new Color().setHSL(
    0.075 - traits.coatWarmth * 0.035,
    0.24 + traits.coatWarmth * 0.24,
    0.25 + traits.coatLightness * 0.28,
  );

  (body.material as MeshStandardMaterial).color.copy(coat);
  body.scale.set(bodyLength, bodyHeight, bodyWidth);
  body.position.y = bodyY;
  head.scale.set(0.92 + traits.bodyMass * 0.08, 0.76 + traits.insulation * 0.12, 0.78 + traits.footWidth * 0.04);
  head.position.set(bodyLength + 0.5, bodyY + bodyHeight * 0.38, 0);

  animal.children.forEach((child) => {
    if (!(child instanceof Mesh)) return;
    if (child.name === "leg") {
      const baseX = child.userData.baseX as number;
      const side = child.userData.side as number;
      child.scale.set(traits.footWidth, traits.legLength, traits.footWidth);
      child.position.set(baseX * bodyLength / 1.45, legHeight / 2, side * bodyWidth / 0.72);
    } else if (child.name === "horn") {
      const side = child.userData.side as number;
      child.scale.set(0.85 + traits.hornLength * 0.12, traits.hornLength, 0.85 + traits.hornLength * 0.12);
      child.position.set(bodyLength + 0.78, bodyY + bodyHeight * 0.9, side);
    }
  });
}

interface AnimalNavigationState {
  path: Vector3[];
  waypoint: number;
  journey: number;
}

interface LineageRenderState {
  readonly id: string;
  readonly seed: number;
  readonly animals: readonly Group[];
  readonly navigation: readonly AnimalNavigationState[];
  readonly previousSiteMarker: Mesh;
}

function createLineageRenderState(
  scene: Group,
  id: string,
  identity: PopulationIdentity,
): LineageRenderState {
  const seed = lineageSeed(identity, id);
  const animals = Array.from({ length: 7 }, (_, herdIndex) => {
    const animal = makeGrazer();
    animal.visible = false;
    animal.scale.setScalar(0.9);
    animal.userData.lineageId = id;
    animal.userData.herdIndex = herdIndex;
    scene.add(animal);
    return animal;
  });
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
    animals,
    navigation: animals.map(() => ({ path: [], waypoint: 0, journey: 0 })),
    previousSiteMarker,
  };
}

function addCoastalSwimmers(scene: Group): Group[] {
  const skin = new MeshStandardMaterial({ color: 0x79a8ad, roughness: 0.42 });
  return Array.from({ length: 10 }, (_, index) => {
    const swimmer = new Group();
    const body = new Mesh(new SphereGeometry(1, 14, 8), skin);
    body.scale.set(1.9, 0.48, 0.62);
    const dorsal = new Mesh(new ConeGeometry(0.28, 0.9, 5), skin);
    dorsal.position.set(-0.1, 0.52, 0);
    const tail = new Mesh(new ConeGeometry(0.42, 0.9, 4), skin);
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -2;
    swimmer.add(body, dorsal, tail);
    swimmer.userData.index = index;
    swimmer.visible = false;
    scene.add(swimmer);
    return swimmer;
  });
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
  sculpt: (point: Vector3, direction: 1 | -1) => void;
  introduceDistantDrifter: (currentAge: number) => boolean;
  advance: (years: number, totalYears: number, climate: ClimateForces) => LineageReport;
  update: (elapsed: number, viewPosition?: Readonly<Vector3>) => void;
}

export interface LineageReport {
  changes: readonly LineageChange[];
  marineChanges: readonly MarineLineageChange[];
  traitDistance?: number;
}

export function createLandingState(scene: Scene): WorldExperience {
  const terrain = makeTerrain();
  scene.add(terrain);
  const terrainHeightTexture = makeHeightTexture(terrain);
  const oceanMaskTexture = makeOceanMaskTexture();
  const wetShore = makeWetShore(terrain);
  scene.add(wetShore);
  const life = new Group();
  life.visible = false;
  const vegetation = createVegetationRenderer(life);
  const seagrass = createSeagrassRenderer(life);
  const lineageRenderers = new Map<string, LineageRenderState>();
  const freshwater = createFreshwaterRenderer(life);
  const coastalAnimals = addCoastalSwimmers(life);
  const aerialAnimals = addAerialAnimals(life);
  scene.add(life);
  let revealed = false;
  let activeClimate: ClimateForces = { ...DEFAULT_CLIMATE };
  let lastElapsed = 0;
  let terrainDirty = false;
  const terrainPositions = terrain.geometry.attributes.position;
  const initialHeights = new Float32Array(terrainPositions.count);
  for (let i = 0; i < terrainPositions.count; i++) initialHeights[i] = terrainPositions.getY(i);
  // Coastal animals recruit from the sea and birds arrive under their own
  // power. Non-flying terrestrial animals require an over-water drifter.
  let worldHistory = createWorldHistory(initialHeights, TERRAIN_SIDE, TERRAIN_SIZE, false);

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
    );
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
    }
    refreshFreshwater();
    lineageRenderers.forEach(({ previousSiteMarker: marker }) => {
      if (marker.visible) marker.position.y = heightAt(marker.position.x, marker.position.z) + 0.18;
    });
  }

  function sculpt(point: Vector3, direction: 1 | -1): void {
    const positions = terrain.geometry.attributes.position;
    const colors = terrain.geometry.attributes.color;
    const radius = 18;
    const affectedRadius = radius + 2 * TERRAIN_STEP;
    const color = new Color();
    const minX = Math.max(0, Math.floor((point.x - affectedRadius + TERRAIN_HALF) / TERRAIN_STEP));
    const maxX = Math.min(TERRAIN_SEGMENTS, Math.ceil((point.x + affectedRadius + TERRAIN_HALF) / TERRAIN_STEP));
    const minZ = Math.max(0, Math.floor((point.z - affectedRadius + TERRAIN_HALF) / TERRAIN_STEP));
    const maxZ = Math.min(TERRAIN_SEGMENTS, Math.ceil((point.z + affectedRadius + TERRAIN_HALF) / TERRAIN_STEP));
    for (let gz = minZ; gz <= maxZ; gz++) {
      for (let gx = minX; gx <= maxX; gx++) {
        const i = gz * TERRAIN_SIDE + gx;
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const distance = Math.hypot(x - point.x, z - point.z);
        if (distance >= affectedRadius) continue;
        if (distance < radius) {
          worldHistory.terrain.elevations[i] = Math.max(
            -5,
            worldHistory.terrain.elevations[i]! + direction * 1.25 * Math.pow(1 - distance / radius, 2),
          );
          worldHistory.terrain.disturbance[i] = 1;
          worldHistory.terrain.vegetationProtection[i] = 0;
        }
        const y = heightAt(x, z);
        positions.setY(i, y);
        color.copy(revealed
          ? terrainColor(y, x, z, activeClimate, worldHistory.terrain.disturbance[i])
          : formedTerrainColor(y, x, z));
        colors.setXYZ(i, color.r, color.g, color.b);
      }
    }
    terrainDirty = true;
  }

  return {
    terrain,
    terrainHeightTexture,
    oceanMaskTexture,
    sculpt,
    introduceDistantDrifter(currentAge: number) {
      if (worldHistory.lineages.lineages.length > 0) return false;
      const founders = createLineageHistory();
      worldHistory = {
        ...worldHistory,
        lineages: {
          lineages: founders.lineages.map((lineage) => ({ ...lineage, originAge: currentAge })),
        },
      };
      return true;
    },
    advance(years: number, totalYears: number, climate: ClimateForces) {
      revealed = true;
      activeClimate = { ...climate };
      validateWorldHistory(worldHistory);
      worldHistory = {
        ...worldHistory,
        terrain: resolveTerrainHistory(worldHistory.terrain, years, climate),
      };
      const positions = terrain.geometry.attributes.position;
      const colors = terrain.geometry.attributes.color;
      const color = new Color();
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const y = worldHistory.terrain.elevations[i]!;
        positions.setY(i, y);
        color.copy(terrainColor(
          y, x, z, climate, worldHistory.terrain.disturbance[i],
          terrainSlope(worldHistory.terrain.elevations, i),
        ));
        colors.setXYZ(i, color.r, color.g, color.b);
      }
      colors.needsUpdate = true;
      positions.needsUpdate = true;
      terrain.geometry.computeVertexNormals();
      syncShoreSurface();
      life.visible = true;
      const snapshot = currentSnapshot(totalYears);
      const resolution = resolveLanding(snapshot, worldHistory.lineages, years, worldHistory.marineLineages);
      const { outcome } = resolution;
      currentOutcome = outcome;
      freshwater.setField(outcome.freshwaterField);
      const protectedTerrain = withVegetationProtection(worldHistory.terrain, outcome.trees);
      worldHistory = {
        ...worldHistory,
        terrain: withGrazingPressure(protectedTerrain, outcome.populations, years),
        lineages: resolution.nextHistory,
        marineLineages: resolution.nextMarineHistory,
      };
      validateWorldHistory(worldHistory);
      vegetation.setTrees(outcome.trees, heightAt, SEA_LEVEL[activeClimate.seaLevel]);
      seagrass.setMeadow(outcome.seagrass, heightAt);
      for (const renderer of lineageRenderers.values()) {
        if (!outcome.populations.some((lineage) => lineage.id === renderer.id)) {
          renderer.animals.forEach((animal) => { animal.visible = false; });
          renderer.previousSiteMarker.visible = false;
        }
      }
      outcome.populations.forEach((lineage) => {
        const renderer = rendererFor(lineage.id, lineage.identity);
        const site = lineage.site;
        if (!site || !lineage.traits) {
          renderer.animals.forEach((animal) => { animal.visible = false; });
          renderer.previousSiteMarker.visible = false;
          return;
        }
        const visibleAnimals = Math.max(1, Math.ceil((lineage.abundance ?? 0.34) * renderer.animals.length));
        renderer.animals.forEach((animal, herdIndex) => {
          applyGrazerTraits(animal, lineage.traits!);
          const angle = hash(herdIndex, renderer.seed + 92) * Math.PI * 2;
          const radius = 4 + hash(herdIndex, renderer.seed + 103) * 13;
          const x = site.x + Math.cos(angle) * radius;
          const z = site.z + Math.sin(angle) * radius;
          animal.position.set(x, heightAt(x, z), z);
          animal.visible = lineage.visible && herdIndex < visibleAnimals;
          animal.scale.setScalar(0.9);
          const state = renderer.navigation[herdIndex]!;
          state.path = [];
          state.waypoint = 0;
          state.journey = 0;
        });
        const marker = renderer.previousSiteMarker;
        const previous = lineage.previousSite;
        marker.visible = lineage.visible && previous !== undefined && lineage.site !== undefined
          && Math.hypot(lineage.site.x - previous.x, lineage.site.z - previous.z) > 0.25;
        if (!marker.visible || !previous) return;
        marker.position.set(previous.x, heightAt(previous.x, previous.z) + 0.18, previous.z);
      });
      coastalAnimals.forEach((animal, index) => {
        const resolved = outcome.coastalAnimals[index];
        animal.visible = resolved !== undefined;
        if (!resolved) return;
        animal.userData.baseX = resolved.x;
        animal.userData.baseZ = resolved.z;
        animal.userData.baseY = resolved.y;
        animal.position.set(resolved.x, resolved.y, resolved.z);
        animal.rotation.y = resolved.heading;
        animal.scale.setScalar(resolved.scale);
      });
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
    update(elapsed: number, viewPosition?: Readonly<Vector3>) {
      if (viewPosition) {
        vegetation.updateLod(viewPosition);
        seagrass.update(elapsed, viewPosition);
      }
      flushTerrainChanges();
      if (!revealed) return;
      const delta = Math.min(0.05, Math.max(0, elapsed - lastElapsed));
      lastElapsed = elapsed;
      lineageRenderers.forEach((renderer) => renderer.animals.forEach((animal, index) => {
        if (!animal.visible) return;
        const state = renderer.navigation[index]!;
        if (state.waypoint >= state.path.length) {
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
        const herdMates = renderer.animals.filter((other) => other.visible && other !== animal);
        if (herdMates.length) {
          const centerX = herdMates.reduce((sum, other) => sum + other.position.x, 0) / herdMates.length;
          const centerZ = herdMates.reduce((sum, other) => sum + other.position.z, 0) / herdMates.length;
          const centerDistance = Math.hypot(centerX - animal.position.x, centerZ - animal.position.z);
          if (centerDistance > 17) {
            dx += (centerX - animal.position.x) * 0.22;
            dz += (centerZ - animal.position.z) * 0.22;
          }
          for (const other of herdMates) {
            const awayX = animal.position.x - other.position.x;
            const awayZ = animal.position.z - other.position.z;
            const spacing = Math.hypot(awayX, awayZ);
            if (spacing > 0 && spacing < 4.5) {
              dx += (awayX / spacing) * (4.5 - spacing) * 0.7;
              dz += (awayZ / spacing) * (4.5 - spacing) * 0.7;
            }
          }
        }
        const steeredDistance = Math.hypot(dx, dz);
        if (steeredDistance < 0.001) return;
        const speed = 2.4 + (index % 3) * 0.18;
        const step = Math.min(distance, speed * delta);
        const nextX = animal.position.x + (dx / steeredDistance) * step;
        const nextZ = animal.position.z + (dz / steeredDistance) * step;
        if (!isWalkable(heightAt, nextX, nextZ, activeClimate)) {
          state.path = [];
          state.waypoint = 0;
          return;
        }
        animal.position.x = nextX;
        animal.position.z = nextZ;
        animal.position.y = heightAt(animal.position.x, animal.position.z);
        animal.rotation.y = Math.atan2(-dz, dx);
        animal.position.y += Math.sin(elapsed * 7 + index) * 0.035;
      }));
      coastalAnimals.forEach((animal, index) => {
        if (!animal.visible) return;
        const phase = elapsed * (0.22 + (index % 3) * 0.035) + index * 1.7;
        const baseX = animal.userData.baseX as number;
        const baseZ = animal.userData.baseZ as number;
        const baseY = animal.userData.baseY as number;
        animal.position.x = baseX + Math.cos(phase) * 3.2;
        animal.position.z = baseZ + Math.sin(phase) * 2.1;
        animal.position.y = baseY + Math.sin(phase * 2) * 0.18;
        animal.rotation.y = -phase;
      });
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
