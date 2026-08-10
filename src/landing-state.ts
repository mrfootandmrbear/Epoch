import {
  BufferAttribute,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  FloatType,
  Group,
  InstancedMesh,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RedFormat,
  Scene,
  SphereGeometry,
  Vector3,
} from "three/webgpu";
import { resolveLanding } from "./outcome-resolver";
import { captureWorldSnapshot } from "./world-snapshot";
import { findTerrainPath, isWalkable } from "./animal-navigation";
import {
  DEFAULT_CLIMATE,
  RAINFALL,
  SEA_LEVEL,
  TEMPERATURE,
  type ClimateForces,
} from "./climate";

const UP = new Vector3(0, 1, 0);
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

function terrainColor(height: number, x: number, z: number, climate: ClimateForces): Color {
  const variation = (hash(Math.floor(x / 8), Math.floor(z / 8)) - 0.5) * 0.07;
  const seaLevel = SEA_LEVEL[climate.seaLevel];
  const wetness = RAINFALL[climate.rainfall].moisture;
  const cold = climate.temperature === "cold";
  if (height < seaLevel + 0.8) return new Color(0.46 + variation, 0.38 + variation, 0.23);
  if (cold && height > 16) return new Color(0.72 + variation, 0.76 + variation, 0.72 + variation);
  if (height < 8) return new Color(0.19 - wetness * 0.12 + variation, 0.32 + wetness * 0.2 + variation, 0.14);
  if (height < 24) return new Color(0.12 - wetness * 0.08 + variation, 0.25 + wetness * 0.2 + variation, 0.1);
  return new Color(0.27 + variation, 0.28 + variation, 0.22 + variation);
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
    new MeshStandardMaterial({ vertexColors: true, roughness: 0.91, metalness: 0 }),
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

function addForest(scene: Group): { canopy: InstancedMesh; trunks: InstancedMesh } {
  const canopyGeometry = new ConeGeometry(1, 4.5, 7);
  canopyGeometry.translate(0, 2.8, 0);
  const trunkGeometry = new CylinderGeometry(0.18, 0.28, 2.4, 6);
  trunkGeometry.translate(0, 1.2, 0);
  const canopy = new InstancedMesh(
    canopyGeometry,
    new MeshStandardMaterial({ color: 0x1c512d, roughness: 0.88 }),
    420,
  );
  const trunks = new InstancedMesh(
    trunkGeometry,
    new MeshStandardMaterial({ color: 0x5b3924, roughness: 1 }),
    420,
  );
  canopy.count = 0;
  trunks.count = 0;
  canopy.castShadow = true;
  canopy.receiveShadow = true;
  trunks.castShadow = true;
  scene.add(trunks, canopy);
  return { canopy, trunks };
}

function makeGrazer(color: number, bodyScale: Vector3, hornScale: number): Group {
  const animal = new Group();
  const material = new MeshStandardMaterial({ color, roughness: 0.82 });
  const dark = new MeshStandardMaterial({ color: 0x241b18, roughness: 1 });
  const body = new Mesh(new SphereGeometry(1, 12, 8), material);
  body.scale.copy(bodyScale);
  body.position.y = 1.7;
  const head = new Mesh(new SphereGeometry(0.55, 10, 7), material);
  head.position.set(1.45 * bodyScale.x, 2.0, 0);
  head.scale.set(1, 0.85, 0.85);
  animal.add(body, head);
  for (const z of [-0.55, 0.55]) {
    for (const x of [-0.85, 0.75]) {
      const leg = new Mesh(new CylinderGeometry(0.1, 0.13, 1.5, 5), dark);
      leg.position.set(x, 0.75, z * bodyScale.z);
      animal.add(leg);
    }
  }
  for (const z of [-0.32, 0.32]) {
    const horn = new Mesh(new ConeGeometry(0.11, hornScale, 6), dark);
    horn.rotation.z = -0.55;
    horn.position.set(1.75 * bodyScale.x, 2.55, z);
    animal.add(horn);
  }
  animal.traverse((child) => {
    if (child instanceof Mesh) child.castShadow = true;
  });
  return animal;
}

function addEvolvedHerds(scene: Group): Group[] {
  const animals: Group[] = [];
  const populations = [
    { color: 0xb58a58, scale: new Vector3(1.5, 0.8, 0.72), horns: 0.7, center: [-28, 38] },
    { color: 0x745a46, scale: new Vector3(1.25, 1.05, 0.64), horns: 1.25, center: [42, -12] },
  ] as const;
  for (const [populationIndex, population] of populations.entries()) {
    for (let i = 0; i < 7; i++) {
      const animal = makeGrazer(population.color, population.scale.clone(), population.horns);
      const x = population.center[0] + (hash(i, populationIndex) - 0.5) * 28;
      const z = population.center[1] + (hash(i, populationIndex + 8) - 0.5) * 22;
      animal.position.set(x, terrainHeight(x, z), z);
      animal.rotation.y = hash(i, populationIndex + 20) * Math.PI * 2;
      animal.scale.setScalar(1.65);
      animal.userData.population = populationIndex;
      animal.userData.herdIndex = i;
      scene.add(animal);
      animals.push(animal);
    }
  }
  return animals;
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

function addFreshwaterPools(scene: Group): Mesh[] {
  const material = new MeshStandardMaterial({
    color: 0x397984,
    roughness: 0.22,
    metalness: 0.08,
    transparent: true,
    opacity: 0.88,
  });
  return Array.from({ length: 5 }, () => {
    const pool = new Mesh(new SphereGeometry(1, 24, 8), material);
    pool.visible = false;
    pool.renderOrder = 3;
    scene.add(pool);
    return pool;
  });
}

export interface WorldExperience {
  terrain: Mesh;
  terrainHeightTexture: DataTexture;
  sculpt: (point: Vector3, direction: 1 | -1) => void;
  advance: (years: number, totalYears: number, climate: ClimateForces) => void;
  update: (elapsed: number) => void;
}

export function createLandingState(scene: Scene): WorldExperience {
  const terrain = makeTerrain();
  scene.add(terrain);
  const terrainHeightTexture = makeHeightTexture(terrain);
  const wetShore = makeWetShore(terrain);
  scene.add(wetShore);
  const life = new Group();
  life.visible = false;
  const forest = addForest(life);
  const animals = addEvolvedHerds(life);
  const freshwaterPools = addFreshwaterPools(life);
  const coastalAnimals = addCoastalSwimmers(life);
  const aerialAnimals = addAerialAnimals(life);
  const navigation = animals.map(() => ({ path: [] as Vector3[], waypoint: 0, journey: 0 }));
  scene.add(life);
  let revealed = false;
  let activeClimate: ClimateForces = { ...DEFAULT_CLIMATE };
  let resolvedYears = 0;
  let lastElapsed = 0;
  let terrainDirty = false;
  const terrainPositions = terrain.geometry.attributes.position;
  const formedHeights = new Float32Array(terrainPositions.count);
  for (let i = 0; i < terrainPositions.count; i++) formedHeights[i] = terrainPositions.getY(i);

  function formedHeightAt(x: number, z: number): number {
    const gx = Math.max(0, Math.min(TERRAIN_SEGMENTS, (x + TERRAIN_HALF) / TERRAIN_STEP));
    const gz = Math.max(0, Math.min(TERRAIN_SEGMENTS, (z + TERRAIN_HALF) / TERRAIN_STEP));
    const x0 = Math.floor(gx);
    const z0 = Math.floor(gz);
    const x1 = Math.min(TERRAIN_SEGMENTS, x0 + 1);
    const z1 = Math.min(TERRAIN_SEGMENTS, z0 + 1);
    const tx = gx - x0;
    const tz = gz - z0;
    const a = formedHeights[z0 * TERRAIN_SIDE + x0]!;
    const b = formedHeights[z0 * TERRAIN_SIDE + x1]!;
    const c = formedHeights[z1 * TERRAIN_SIDE + x0]!;
    const d = formedHeights[z1 * TERRAIN_SIDE + x1]!;
    return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * tz;
  }

  function heightAt(x: number, z: number): number {
    const formed = formedHeightAt(x, z);
    const deepTime = Math.min(1, Math.max(0, (Math.log10(Math.max(1, resolvedYears)) - 3) / 3));
    if (deepTime <= 0) return formed;
    const step = 4;
    const neighborhood = (
      formedHeightAt(x + step, z) + formedHeightAt(x - step, z)
      + formedHeightAt(x, z + step) + formedHeightAt(x, z - step)
    ) * 0.25;
    const erosion = RAINFALL[activeClimate.rainfall].erosion;
    const smoothed = formed + (neighborhood - formed) * deepTime * Math.min(0.42, erosion * 0.2);
    const sea = SEA_LEVEL[activeClimate.seaLevel];
    const coastalRetreat = smoothed < sea + 5 ? deepTime * erosion * 1.15 : 0;
    return Math.max(-5, smoothed - coastalRetreat);
  }

  let currentOutcome: ReturnType<typeof resolveLanding> | undefined;

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
    terrainHeightTexture.needsUpdate = true;
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
      const matrix = new Matrix4();
      const rotation = new Quaternion();
      currentOutcome.trees.forEach((tree, index) => {
        rotation.setFromAxisAngle(UP, tree.rotation);
        const y = heightAt(tree.x, tree.z);
        const aboveSea = y >= SEA_LEVEL[activeClimate.seaLevel] + 0.8;
        const scale = aboveSea ? tree.scale : 0;
        matrix.compose(
          new Vector3(tree.x, y, tree.z),
          rotation,
          new Vector3(scale, scale, scale),
        );
        forest.canopy.setMatrixAt(index, matrix);
        forest.trunks.setMatrixAt(index, matrix);
      });
      forest.canopy.instanceMatrix.needsUpdate = true;
      forest.trunks.instanceMatrix.needsUpdate = true;
    }
    animals.forEach((animal, index) => {
      animal.position.y = heightAt(animal.position.x, animal.position.z);
      const population = animal.userData.population as number;
      const habitatVisible = currentOutcome?.populations[population].visible ?? false;
      const walkable = isWalkable(heightAt, animal.position.x, animal.position.z, activeClimate);
      animal.visible = habitatVisible && walkable;
      if (!walkable) {
        navigation[index].path = [];
        navigation[index].waypoint = 0;
      }
    });
    freshwaterPools.forEach((pool, index) => {
      if (!pool.visible || !currentOutcome?.freshwater[index]) return;
      const resolved = currentOutcome.freshwater[index];
      pool.position.y = heightAt(resolved.x, resolved.z) + 0.1;
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
          formedHeights[i] = Math.max(
            -5,
            formedHeights[i]! + direction * 1.25 * Math.pow(1 - distance / radius, 2),
          );
        }
        const y = heightAt(x, z);
        positions.setY(i, y);
        color.copy(revealed ? terrainColor(y, x, z, activeClimate) : formedTerrainColor(y, x, z));
        colors.setXYZ(i, color.r, color.g, color.b);
      }
    }
    terrainDirty = true;
  }

  return {
    terrain,
    terrainHeightTexture,
    sculpt,
    advance(_years: number, totalYears: number, climate: ClimateForces) {
      revealed = true;
      activeClimate = { ...climate };
      resolvedYears = totalYears;
      const positions = terrain.geometry.attributes.position;
      const colors = terrain.geometry.attributes.color;
      const color = new Color();
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const y = heightAt(x, z);
        positions.setY(i, y);
        color.copy(terrainColor(y, x, z, climate));
        colors.setXYZ(i, color.r, color.g, color.b);
      }
      colors.needsUpdate = true;
      positions.needsUpdate = true;
      terrain.geometry.computeVertexNormals();
      syncShoreSurface();
      life.visible = true;
      const snapshot = captureWorldSnapshot(heightAt, totalYears, climate);
      const outcome = resolveLanding(snapshot);
      currentOutcome = outcome;
      const insulation = TEMPERATURE[climate.temperature].insulation;
      const matrix = new Matrix4();
      const rotation = new Quaternion();
      outcome.trees.forEach((tree, index) => {
        rotation.setFromAxisAngle(UP, tree.rotation);
        matrix.compose(
          new Vector3(tree.x, tree.y, tree.z),
          rotation,
          new Vector3(tree.scale, tree.scale, tree.scale),
        );
        forest.canopy.setMatrixAt(index, matrix);
        forest.trunks.setMatrixAt(index, matrix);
      });
      forest.canopy.count = outcome.trees.length;
      forest.trunks.count = outcome.trees.length;
      forest.canopy.instanceMatrix.needsUpdate = true;
      forest.trunks.instanceMatrix.needsUpdate = true;
      animals.forEach((animal, index) => {
        const population = animal.userData.population as number;
        const herdIndex = animal.userData.herdIndex as number;
        const site = outcome.populations[population];
        const angle = hash(herdIndex, population + 92) * Math.PI * 2;
        const radius = 4 + hash(herdIndex, population + 103) * 13;
        const x = site.x + Math.cos(angle) * radius;
        const z = site.z + Math.sin(angle) * radius;
        animal.position.set(x, heightAt(x, z), z);
        animal.visible = site.visible;
        animal.scale.setScalar(1.65 + insulation * 0.32);
        const state = navigation[index];
        state.path = [];
        state.waypoint = 0;
        state.journey = 0;
      });
      coastalAnimals.forEach((animal, index) => {
        const resolved = outcome.coastalAnimals[index];
        animal.visible = resolved !== undefined;
        if (!resolved) return;
        animal.userData.baseX = resolved.x;
        animal.userData.baseZ = resolved.z;
        animal.position.set(resolved.x, SEA_LEVEL[climate.seaLevel] + 0.2, resolved.z);
        animal.rotation.y = resolved.heading;
        animal.scale.setScalar(resolved.scale * 1.45);
      });
      freshwaterPools.forEach((pool, index) => {
        const resolved = outcome.freshwater[index];
        pool.visible = resolved !== undefined;
        if (!resolved) return;
        pool.position.set(resolved.x, resolved.y + 0.13, resolved.z);
        pool.rotation.y = hash(index, 283) * Math.PI;
        pool.scale.set(resolved.radius * 1.35, 0.16, resolved.radius);
      });
      aerialAnimals.forEach((bird, index) => {
        bird.visible = outcome.aerial.visible;
        bird.userData.phase = (index / aerialAnimals.length) * Math.PI * 2;
        bird.scale.setScalar(1.45 + hash(index, 241) * 0.45);
      });
    },
    update(elapsed: number) {
      flushTerrainChanges();
      if (!revealed) return;
      const delta = Math.min(0.05, Math.max(0, elapsed - lastElapsed));
      lastElapsed = elapsed;
      animals.forEach((animal, index) => {
        if (!animal.visible) return;
        const state = navigation[index];
        if (state.waypoint >= state.path.length) {
          state.journey++;
          const population = animal.userData.population as number;
          let destination: Vector3 | undefined;
          for (let attempt = 0; attempt < 10 && !destination; attempt++) {
            const angle = hash(index + state.journey * 17, population * 31 + attempt) * Math.PI * 2;
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
        const population = animal.userData.population as number;
        const herdMates = animals.filter(
          (other) => other.visible && other.userData.population === population && other !== animal,
        );
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
      });
      const sea = SEA_LEVEL[activeClimate.seaLevel];
      coastalAnimals.forEach((animal, index) => {
        if (!animal.visible) return;
        const phase = elapsed * (0.22 + (index % 3) * 0.035) + index * 1.7;
        const baseX = animal.userData.baseX as number;
        const baseZ = animal.userData.baseZ as number;
        animal.position.x = baseX + Math.cos(phase) * 3.2;
        animal.position.z = baseZ + Math.sin(phase) * 2.1;
        animal.position.y = sea + 0.16 + Math.sin(phase * 2) * 0.18;
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
