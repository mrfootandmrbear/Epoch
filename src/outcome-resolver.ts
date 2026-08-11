import {
  RAINFALL,
  SEA_LEVEL,
  TEMPERATURE,
  WIND,
  type ClimateForces,
} from "./climate";
import { snapshotHeightAt, type WorldSnapshot } from "./world-snapshot";
import {
  derivePopulationTraits,
  type PopulationIdentity,
  type PopulationTraits,
} from "./population-traits";

export interface HabitatSample {
  elevation: number;
  slope: number;
  moisture: number;
  exposure: number;
}

export interface EcosystemSample extends HabitatSample {
  drainage: number;
  coastalProductivity: number;
  nesting: number;
  lift: number;
}

export interface TreeOutcome {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
}

export interface PopulationOutcome {
  identity: PopulationIdentity;
  x: number;
  y: number;
  z: number;
  visible: boolean;
  habitat: EcosystemSample;
  traits: PopulationTraits;
}

export interface CoastalAnimalOutcome {
  x: number;
  z: number;
  heading: number;
  scale: number;
}

export interface FreshwaterOutcome {
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface AerialPopulationOutcome {
  x: number;
  z: number;
  altitude: number;
  radius: number;
  visible: boolean;
}

export interface LandingOutcome {
  trees: TreeOutcome[];
  populations: [PopulationOutcome, PopulationOutcome];
  freshwater: FreshwaterOutcome[];
  coastalAnimals: CoastalAnimalOutcome[];
  aerial: AerialPopulationOutcome;
}

type HeightAt = (x: number, z: number) => number;

function hash(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function sampleHabitat(
  heightAt: HeightAt,
  x: number,
  z: number,
  climate?: ClimateForces,
): HabitatSample {
  const step = 5;
  const elevation = heightAt(x, z);
  const east = heightAt(x + step, z);
  const west = heightAt(x - step, z);
  const north = heightAt(x, z + step);
  const south = heightAt(x, z - step);
  const dx = (east - west) / (step * 2);
  const dz = (north - south) / (step * 2);
  const slope = Math.hypot(dx, dz);
  const concavity = (east + west + north + south) * 0.25 - elevation;
  const rain = climate ? RAINFALL[climate.rainfall] : RAINFALL.temperate;
  const wind = climate ? WIND[climate.wind] : WIND.westerly;
  const windward = climate && wind.x !== 0 ? clamp01(0.5 + dx * wind.x * 0.32) : 0.5;
  const moisture = clamp01(
    0.48 + rain.moisture + (12 - elevation) / 30 + concavity * 0.12 - slope * 0.28
      + (windward - 0.5) * 0.18,
  );
  const exposure = clamp01((0.18 + elevation / 38 + slope * 0.42) * wind.exposure);
  return { elevation, slope, moisture, exposure };
}

export function sampleEcosystem(
  heightAt: HeightAt,
  x: number,
  z: number,
  climate: ClimateForces,
): EcosystemSample {
  const habitat = sampleHabitat(heightAt, x, z, climate);
  const step = 5;
  const localMean = (
    heightAt(x + step, z) + heightAt(x - step, z)
    + heightAt(x, z + step) + heightAt(x, z - step)
  ) * 0.25;
  const concavity = localMean - habitat.elevation;
  const sea = SEA_LEVEL[climate.seaLevel];
  const depth = sea - habitat.elevation;
  const rain = RAINFALL[climate.rainfall];
  const drainage = habitat.elevation > sea
    ? clamp01(habitat.moisture * 0.72 + Math.max(0, concavity) * 0.2 + habitat.slope * 0.12)
    : 0;
  const shallow = depth > 0 ? clamp01(1 - Math.abs(depth - 3) / 5) : 0;
  const coastalProductivity = shallow
    * clamp01(0.62 + rain.moisture * 0.9)
    * clamp01(1 - habitat.exposure * 0.32);
  const nesting = habitat.elevation > sea + 2
    ? clamp01(habitat.moisture * 0.45 + habitat.exposure * 0.3 + drainage * 0.35)
    : 0;
  const lift = habitat.elevation > sea
    ? clamp01(habitat.exposure * 0.65 + habitat.slope * 0.55) * WIND[climate.wind].exposure
    : 0;
  return { ...habitat, drainage, coastalProductivity, nesting, lift };
}

function populationSite(
  heightAt: HeightAt,
  identity: PopulationIdentity,
  climate: ClimateForces,
  deepTime: number,
  avoid?: PopulationOutcome,
): PopulationOutcome {
  const preference = identity === "sheltered-grazer" ? "sheltered" : "rugged";
  let best = { x: 0, y: heightAt(0, 0), z: 0, score: -Infinity };
  for (let i = 0; i < 320; i++) {
    const angle = hash(i, 71) * Math.PI * 2;
    const radius = Math.sqrt(hash(i, 83)) * 135;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const ecosystem = sampleEcosystem(heightAt, x, z, climate);
    if (ecosystem.elevation < SEA_LEVEL[climate.seaLevel] + 2) continue;
    let score = preference === "sheltered"
      ? ecosystem.moisture * (1.7 + deepTime * 0.35) + ecosystem.drainage * 0.45
        - ecosystem.slope * 0.9 - ecosystem.exposure * (0.25 + deepTime * 0.2)
      : ecosystem.exposure * (1.25 + deepTime * 0.45)
        + ecosystem.slope * (0.8 + deepTime * 0.3) - ecosystem.moisture * 0.3;
    if (avoid) score += Math.min(1, Math.hypot(x - avoid.x, z - avoid.z) / 75) * 1.35;
    if (score > best.score) best = { x, y: ecosystem.elevation, z, score };
  }
  const habitat = sampleEcosystem(heightAt, best.x, best.z, climate);
  return {
    identity,
    x: best.x,
    y: best.y,
    z: best.z,
    visible: false,
    habitat,
    traits: derivePopulationTraits(identity, habitat, climate),
  };
}

export function resolveLanding(snapshot: WorldSnapshot): LandingOutcome {
  const heightAt = (x: number, z: number) => snapshotHeightAt(snapshot, x, z);
  const { climate, totalYears } = snapshot;
  const trees: TreeOutcome[] = [];
  const succession = clamp01(Math.log10(Math.max(1, totalYears)) / 3);
  const deepTime = clamp01((Math.log10(Math.max(1, totalYears)) - 3) / 3);
  const growth = TEMPERATURE[climate.temperature].growth;
  const seaLevel = SEA_LEVEL[climate.seaLevel];
  const treeLine = climate.temperature === "cold" ? 24 : climate.temperature === "mild" ? 38 : 46;
  for (let i = 0; i < 1400 && trees.length < 420; i++) {
    const angle = hash(i, 4) * Math.PI * 2;
    const radius = Math.sqrt(hash(i, 9)) * 150;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const ecosystem = sampleEcosystem(heightAt, x, z, climate as ClimateForces);
    if (ecosystem.elevation < seaLevel + 2 || ecosystem.elevation > treeLine || ecosystem.slope > 1.15) continue;
    const suitability = (
      clamp01(1 - Math.abs(ecosystem.moisture - 0.66) * 1.55) * 0.8
      + ecosystem.drainage * 0.2
    ) * clamp01(1 - ecosystem.exposure * 0.48) * succession * growth;
    if (hash(i, 47) < deepTime * 0.2 || hash(i, 28) > suitability * (0.88 - deepTime * 0.08)) continue;
    trees.push({
      x,
      y: ecosystem.elevation,
      z,
      scale: (0.62 + hash(i, 18) * 1.5) * (0.55 + succession * 0.45)
        * (1 + deepTime * (0.18 + hash(i, 61) * 0.28)),
      rotation: hash(i, 31) * Math.PI * 2,
    });
  }

  const sheltered = populationSite(heightAt, "sheltered-grazer", climate as ClimateForces, deepTime);
  const rugged = populationSite(heightAt, "ridge-grazer", climate as ClimateForces, deepTime, sheltered);
  sheltered.visible = totalYears >= 100;
  rugged.visible = totalYears >= 1000;

  const coastalCandidates: Array<CoastalAnimalOutcome & { score: number }> = [];
  const freshwaterCandidates: Array<FreshwaterOutcome & { score: number }> = [];
  let aerialBest = { x: 0, z: 0, altitude: 22, radius: 24, visible: false, score: -Infinity };
  for (let i = 0; i < 900; i++) {
    const angle = hash(i, 141) * Math.PI * 2;
    const radius = Math.sqrt(hash(i, 157)) * 148;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const ecosystem = sampleEcosystem(heightAt, x, z, climate as ClimateForces);
    if (ecosystem.coastalProductivity > 0.28) {
      coastalCandidates.push({
        x,
        z,
        heading: hash(i, 173) * Math.PI * 2,
        scale: 0.75 + ecosystem.coastalProductivity * 0.7,
        score: ecosystem.coastalProductivity + hash(i, 181) * 0.12,
      });
    }
    if (ecosystem.drainage > 0.68 && ecosystem.elevation > seaLevel + 1.2) {
      freshwaterCandidates.push({
        x,
        y: ecosystem.elevation,
        z,
        radius: 2.4 + ecosystem.drainage * 4.2,
        score: ecosystem.drainage * 1.3 - ecosystem.slope * 0.55 - ecosystem.exposure * 0.2,
      });
    }
    const nearbyCoast = ecosystem.elevation > seaLevel + 1
      ? Math.max(
        sampleEcosystem(heightAt, x + 22, z, climate as ClimateForces).coastalProductivity,
        sampleEcosystem(heightAt, x - 22, z, climate as ClimateForces).coastalProductivity,
        sampleEcosystem(heightAt, x, z + 22, climate as ClimateForces).coastalProductivity,
        sampleEcosystem(heightAt, x, z - 22, climate as ClimateForces).coastalProductivity,
      )
      : 0;
    const aerialScore = ecosystem.nesting * 0.9 + ecosystem.lift * 0.55 + nearbyCoast * 0.85;
    if (aerialScore > aerialBest.score) {
      aerialBest = {
        x,
        z,
        altitude: 28 + ecosystem.lift * 22,
        radius: 27 + nearbyCoast * 30,
        visible: totalYears >= 25,
        score: aerialScore,
      };
    }
  }
  coastalCandidates.sort((a, b) => b.score - a.score);
  freshwaterCandidates.sort((a, b) => b.score - a.score);
  const freshwater: FreshwaterOutcome[] = [];
  for (const { score: _score, ...pool } of freshwaterCandidates) {
    if (freshwater.some((other) => Math.hypot(pool.x - other.x, pool.z - other.z) < 24)) continue;
    freshwater.push(pool);
    if (freshwater.length >= (climate.rainfall === "wet" ? 5 : climate.rainfall === "temperate" ? 3 : 1)) break;
  }
  const coastalAnimals = coastalCandidates.slice(0, totalYears >= 100 ? 10 : 0).map(({ score: _score, ...animal }) => animal);
  const { score: _aerialScore, ...aerial } = aerialBest;
  const freshwaterEdges = trees.filter((tree) => !freshwater.some((pool) => (
    Math.hypot(tree.x - pool.x, tree.z - pool.z) < pool.radius + 3
  )));
  return {
    trees: freshwaterEdges,
    populations: [sheltered, rugged],
    freshwater,
    coastalAnimals,
    aerial,
  };
}
