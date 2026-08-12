import {
  RAINFALL,
  SEA_LEVEL,
  TEMPERATURE,
  WIND,
  type ClimateForces,
} from "./climate";
import { snapshotForageAt, snapshotHeightAt, snapshotNutrientsAt, snapshotRunoffAt, type WorldSnapshot } from "./world-snapshot";
import { resolveFreshwaterField, type FreshwaterField } from "./freshwater-basins";
import { lineageSeed, populationArchetype } from "./population-archetypes";
import {
  assertPopulationTraits,
  derivePopulationTraits,
  type PopulationIdentity,
  type PopulationTraits,
} from "./population-traits";
import {
  blendPopulationTraits,
  createLineageHistory,
  migrationRadius,
  populationTraitChanges,
  populationTraitDistance,
  traitAdaptationRate,
  type LineageChange,
  type LineageHistory,
  type LineageState,
  type LineageStatus,
} from "./lineage-history";
import { createMarineLineageHistory, resolveMarineLineages, type MarineLineageChange, type MarineLineageHistory, type MarinePopulationOutcome } from "./marine-lineage";
import { resolveFounderEstablishment } from "./founder-establishment";

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
  forage: number;
  nutrients: number;
  runoff: number;
}

export interface TreeOutcome {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  morphology: VegetationMorphology;
}

export type VegetationGuild = "broadleaf" | "conifer" | "windswept" | "mangrove";

export interface VegetationMorphology {
  guild: VegetationGuild;
  height: number;
  crownWidth: number;
  crownDepth: number;
  trunkWidth: number;
  lean: number;
  foliageHue: number;
  foliageSaturation: number;
  foliageLightness: number;
}

export interface PopulationOutcome {
  id: string;
  identity: PopulationIdentity;
  status: LineageStatus;
  visible: boolean;
  previousSite?: Readonly<{ x: number; z: number }>;
  site?: {
    x: number;
    y: number;
    z: number;
    habitat: EcosystemSample;
  };
  traits?: PopulationTraits;
  abundance?: number;
  energy?: number;
}

export interface CoastalAnimalOutcome {
  x: number;
  y: number;
  z: number;
  heading: number;
  scale: number;
}

export interface SeagrassOutcome {
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  height: number;
  spread: number;
  hue: number;
  saturation: number;
  lightness: number;
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

export interface MarineEnergyExchange {
  readonly primaryProductivity: number;
  readonly nurseryCapacity: number;
  readonly preyAvailability: number;
  readonly shorelineSubsidy: number;
}

export interface LandingOutcome {
  trees: TreeOutcome[];
  seagrass: SeagrassOutcome[];
  populations: readonly PopulationOutcome[];
  freshwater: FreshwaterOutcome[];
  freshwaterField: FreshwaterField;
  coastalAnimals: CoastalAnimalOutcome[];
  marinePopulations: readonly MarinePopulationOutcome[];
  marineEnergy: MarineEnergyExchange;
  aerial: AerialPopulationOutcome;
}

export interface LandingResolution {
  outcome: LandingOutcome;
  nextHistory: LineageHistory;
  changes: readonly LineageChange[];
  nextMarineHistory: MarineLineageHistory;
  marineChanges: readonly MarineLineageChange[];
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
  forageAt: HeightAt = () => 1,
  nutrientsAt: HeightAt = () => 0.5,
  runoffAt: HeightAt = () => 0,
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
  const nutrients = clamp01(nutrientsAt(x, z));
  const runoff = clamp01(runoffAt(x, z));
  return {
    ...habitat,
    drainage: clamp01(drainage + runoff * 0.28),
    coastalProductivity: clamp01(coastalProductivity * (0.68 + nutrients * 0.22 + runoff * 0.1)),
    nesting,
    lift,
    forage: clamp01(forageAt(x, z)),
    nutrients,
    runoff,
  };
}

interface ScoredSite {
  x: number;
  y: number;
  z: number;
  habitat: EcosystemSample;
  score: number;
  reanchored?: boolean;
}

const SPECIATION_COOLDOWN_YEARS = 100_000;
const SPECIATION_MIN_DISTANCE = 45;
const SPECIATION_MIN_TRAIT_DISTANCE = 0.025;

function separationBonus(x: number, z: number, occupied: readonly ScoredSite[]): number {
  if (occupied.length === 0) return 0;
  const nearest = Math.min(...occupied.map((site) => Math.hypot(x - site.x, z - site.z)));
  return Math.min(1, nearest / 75) * 1.35;
}

function siteScore(
  habitat: EcosystemSample,
  identity: PopulationIdentity,
  deepTime: number,
): number {
  const { niche } = populationArchetype(identity);
  return habitat.moisture * (niche.moisture + deepTime * niche.moistureDeepTime)
    + habitat.drainage * niche.drainage
    + habitat.slope * (niche.slope + deepTime * niche.slopeDeepTime)
    + habitat.exposure * (niche.exposure + deepTime * niche.exposureDeepTime)
    + habitat.forage * 1.4;
}

function isViableSite(habitat: EcosystemSample, climate: ClimateForces): boolean {
  return habitat.elevation >= SEA_LEVEL[climate.seaLevel] + 2 && habitat.slope < 1.35;
}

function foundingSite(
  heightAt: HeightAt,
  forageAt: HeightAt,
  identity: PopulationIdentity,
  climate: ClimateForces,
  deepTime: number,
  extent: number,
  occupied: readonly ScoredSite[] = [],
): ScoredSite | undefined {
  let best: ScoredSite | undefined;
  const worldRadius = extent / 2 - 5;
  for (let i = 0; i < 320; i++) {
    const angle = hash(i, 71) * Math.PI * 2;
    const radius = Math.sqrt(hash(i, 83)) * worldRadius;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const habitat = sampleEcosystem(heightAt, x, z, climate, forageAt);
    if (!isViableSite(habitat, climate)) continue;
    let score = siteScore(habitat, identity, deepTime);
    score += separationBonus(x, z, occupied);
    if (!best || score > best.score) best = { x, y: habitat.elevation, z, habitat, score };
  }
  return best;
}

function migratedSite(
  heightAt: HeightAt,
  forageAt: HeightAt,
  lineage: LineageState,
  climate: ClimateForces,
  deepTime: number,
  jumpYears: number,
  extent: number,
  occupied: readonly ScoredSite[] = [],
): ScoredSite | undefined {
  if (!lineage.site) return undefined;
  const origin = lineage.site;
  const originHabitat = sampleEcosystem(heightAt, origin.x, origin.z, climate, forageAt);
  const originValid = isViableSite(originHabitat, climate);
  const normalRadius = migrationRadius(jumpYears);
  const maximumRadius = originValid ? normalRadius : extent;
  const samplingSeed = lineageSeed(lineage.identity, lineage.id);
  let best: ScoredSite | undefined;

  for (let i = -1; i < 480; i++) {
    const angle = i < 0 ? 0 : hash(i, samplingSeed) * Math.PI * 2;
    const radius = i < 0 ? 0 : Math.sqrt(hash(i, 421)) * maximumRadius;
    const x = origin.x + Math.cos(angle) * radius;
    const z = origin.z + Math.sin(angle) * radius;
    const sampleBoundary = extent / 2 - 5;
    if (Math.abs(x) > sampleBoundary || Math.abs(z) > sampleBoundary) continue;
    const habitat = sampleEcosystem(heightAt, x, z, climate, forageAt);
    if (!isViableSite(habitat, climate)) continue;
    const displacement = Math.hypot(x - origin.x, z - origin.z);
    const score = siteScore(habitat, lineage.identity, deepTime)
      + separationBonus(x, z, occupied)
      - (displacement / Math.max(1, maximumRadius)) * 0.04;
    if (!best || score > best.score) best = { x, y: habitat.elevation, z, habitat, score };
  }
  return best ? { ...best, reanchored: !originValid } : undefined;
}

function resolveLineage(
  snapshot: WorldSnapshot,
  previous: LineageState,
  jumpYears: number,
  deepTime: number,
  occupied: readonly ScoredSite[] = [],
): { outcome: PopulationOutcome; next: LineageState; change: LineageChange; scored?: ScoredSite } {
  const heightAt = (x: number, z: number) => snapshotHeightAt(snapshot, x, z);
  const forageAt = (x: number, z: number) => snapshotForageAt(snapshot, x, z);
  const emergenceAge = populationArchetype(previous.identity).emergenceAge;
  if (previous.status === "extinct" || snapshot.totalYears < emergenceAge) {
    const status = previous.status;
    return {
      outcome: { id: previous.id, identity: previous.identity, status, visible: false },
      next: previous,
      change: {
        id: previous.id,
        parentId: previous.parentId,
        identity: previous.identity,
        previousStatus: previous.status,
        status,
        moved: 0,
      },
    };
  }

  const scored = previous.status === "active" || previous.site
    ? migratedSite(
      heightAt,
      forageAt,
      previous,
      snapshot.climate as ClimateForces,
      deepTime,
      jumpYears,
      snapshot.extent,
      occupied,
    )
    : foundingSite(
      heightAt,
      forageAt,
      previous.identity,
      snapshot.climate as ClimateForces,
      deepTime,
      snapshot.extent,
      occupied,
    );
  if (!scored) {
    const next: LineageState = { ...previous, status: "extinct" };
    return {
      outcome: { id: previous.id, identity: previous.identity, status: "extinct", visible: false },
      next,
      change: {
        id: previous.id,
        parentId: previous.parentId,
        identity: previous.identity,
        previousStatus: previous.status,
        status: "extinct",
        moved: 0,
        event: "extinct",
      },
    };
  }

  const target = derivePopulationTraits(previous.identity, scored.habitat, snapshot.climate);
  if (import.meta.env.DEV) {
    if (previous.traits) assertPopulationTraits(previous.traits, `lineage ${previous.id} inherited traits`);
    assertPopulationTraits(target, `lineage ${previous.id} target traits`);
  }
  const traits = previous.status === "active" && previous.traits
    ? blendPopulationTraits(previous.traits, target, traitAdaptationRate(jumpYears))
    : target;
  if (import.meta.env.DEV) assertPopulationTraits(traits, `lineage ${previous.id} resolved traits`);
  const moved = previous.site ? Math.hypot(scored.x - previous.site.x, scored.z - previous.site.z) : 0;
  const duration = clamp01(Math.log10(Math.max(1, jumpYears) + 1) / 6);
  const founder = previous.status === "not-established";
  const beforeEnergy = previous.energy ?? (founder ? 0.38 : 0.62);
  const beforeAbundance = previous.abundance ?? (founder ? 0.012 : 0.34);
  const intake = scored.habitat.forage * (0.75 + scored.habitat.moisture * 0.25);
  const founderResolution = founder ? resolveFounderEstablishment({
    energy: beforeEnergy,
    abundance: beforeAbundance,
    feedingAdaptation: previous.feedingAdaptation ?? 0.28,
  }, scored.habitat.forage, scored.habitat.moisture, jumpYears) : undefined;
  const energy = founderResolution?.energy ?? clamp01(beforeEnergy + (intake - 0.48) * duration * 0.9);
  const abundance = founderResolution?.abundance ?? clamp01(beforeAbundance + (
    (intake - 0.52) * 0.8 + (energy - 0.45) * 0.15
  ) * duration);
  const status = founderResolution?.status
    ?? (abundance < 0.025 && energy < 0.08 ? "extinct" : "active");
  const starved = status === "extinct";
  const next: LineageState = {
    ...previous,
    identity: previous.identity,
    status,
    site: { x: scored.x, z: scored.z },
    traits,
    abundance,
    energy,
    feedingAdaptation: founderResolution?.feedingAdaptation ?? previous.feedingAdaptation ?? 1,
  };
  return {
    outcome: {
      id: previous.id,
      identity: previous.identity,
      status,
      visible: !starved,
      previousSite: previous.site,
      site: { x: scored.x, y: scored.y, z: scored.z, habitat: scored.habitat },
      traits,
      abundance,
      energy,
    },
    next,
    scored,
    change: {
      id: previous.id,
      parentId: previous.parentId,
      identity: previous.identity,
      previousStatus: previous.status,
      status,
      moved,
      reanchored: scored.reanchored,
      event: starved ? "extinct"
        : previous.status !== "active" && status === "active" ? "established"
          : previous.status === "active" && scored.reanchored ? "reanchored"
            : previous.status === "active" ? "migrated"
              : undefined,
      habitat: scored.habitat,
      traits: populationTraitChanges(previous.traits, traits),
      abundance: { before: beforeAbundance, after: abundance },
      energy: { before: beforeEnergy, after: energy },
    },
  };
}

function nextChildId(parent: LineageState, history: LineageHistory): string {
  const ordinal = history.lineages.filter((lineage) => lineage.parentId === parent.id).length + 1;
  return `${parent.id}/${ordinal}`;
}

function resolveSpeciation(
  snapshot: WorldSnapshot,
  history: LineageHistory,
  resolved: readonly ReturnType<typeof resolveLineage>[],
  jumpYears: number,
  deepTime: number,
): ReturnType<typeof resolveLineage> | undefined {
  if (jumpYears < SPECIATION_COOLDOWN_YEARS) return undefined;
  const parentResolution = resolved.find(({ next }) => (
    next.status === "active"
    && next.traits !== undefined
    && snapshot.totalYears - next.originAge >= SPECIATION_COOLDOWN_YEARS
    && !history.lineages.some((lineage) => lineage.parentId === next.id)
  ));
  if (!parentResolution?.next.site || !parentResolution.next.traits) return undefined;

  const heightAt = (x: number, z: number) => snapshotHeightAt(snapshot, x, z);
  const forageAt = (x: number, z: number) => snapshotForageAt(snapshot, x, z);
  const occupied = resolved.flatMap(({ scored }) => scored ? [scored] : []);
  const alternate = foundingSite(
    heightAt,
    forageAt,
    parentResolution.next.identity,
    snapshot.climate as ClimateForces,
    deepTime,
    snapshot.extent,
    occupied,
  );
  if (!alternate) return undefined;
  const siteDistance = Math.hypot(
    alternate.x - parentResolution.next.site.x,
    alternate.z - parentResolution.next.site.z,
  );
  if (siteDistance < SPECIATION_MIN_DISTANCE) return undefined;

  const target = derivePopulationTraits(
    parentResolution.next.identity,
    alternate.habitat,
    snapshot.climate,
  );
  const traits = blendPopulationTraits(
    parentResolution.next.traits,
    target,
    traitAdaptationRate(jumpYears),
  );
  if (populationTraitDistance(parentResolution.next.traits, traits) < SPECIATION_MIN_TRAIT_DISTANCE) {
    return undefined;
  }

  const child: LineageState = {
    id: nextChildId(parentResolution.next, history),
    parentId: parentResolution.next.id,
    originAge: snapshot.totalYears,
    generation: parentResolution.next.generation + 1,
    identity: parentResolution.next.identity,
    status: "active",
    site: { x: alternate.x, z: alternate.z },
    traits,
    abundance: Math.max(0.12, (parentResolution.next.abundance ?? 0.34) * 0.42),
    energy: parentResolution.next.energy ?? 0.62,
  };
  return {
    outcome: {
      id: child.id,
      identity: child.identity,
      status: "active",
      visible: true,
      previousSite: parentResolution.next.site,
      site: { x: alternate.x, y: alternate.y, z: alternate.z, habitat: alternate.habitat },
      traits,
      abundance: child.abundance,
      energy: child.energy,
    },
    next: child,
    scored: alternate,
    change: {
      id: child.id,
      parentId: child.parentId,
      identity: child.identity,
      previousStatus: "not-established",
      status: "active",
      moved: siteDistance,
      event: "speciated",
      habitat: alternate.habitat,
      traits: populationTraitChanges(parentResolution.next.traits, traits),
      abundance: { before: 0, after: child.abundance ?? 0 },
      energy: { before: 0, after: child.energy ?? 0 },
    },
  };
}

export function resolveLanding(
  snapshot: WorldSnapshot,
  previousHistory: LineageHistory = createLineageHistory(),
  jumpYears = snapshot.totalYears,
  previousMarineHistory: MarineLineageHistory = createMarineLineageHistory(),
): LandingResolution {
  const heightAt = (x: number, z: number) => snapshotHeightAt(snapshot, x, z);
  const forageAt = (x: number, z: number) => snapshotForageAt(snapshot, x, z);
  const nutrientsAt = (x: number, z: number) => snapshotNutrientsAt(snapshot, x, z);
  const runoffAt = (x: number, z: number) => snapshotRunoffAt(snapshot, x, z);
  const { climate, totalYears } = snapshot;
  const trees: TreeOutcome[] = [];
  const seagrass: SeagrassOutcome[] = [];
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
    const ecosystem = sampleEcosystem(heightAt, x, z, climate as ClimateForces, forageAt, nutrientsAt, runoffAt);
    if (ecosystem.elevation < seaLevel + 2 || ecosystem.elevation > treeLine || ecosystem.slope > 1.15) continue;
    const suitability = (
      clamp01(1 - Math.abs(ecosystem.moisture - 0.66) * 1.55) * 0.8
      + ecosystem.drainage * 0.2
    ) * clamp01(1 - ecosystem.exposure * 0.48) * succession * growth
      * (0.22 + ecosystem.forage * 0.58 + ecosystem.nutrients * 0.2);
    if (hash(i, 47) < deepTime * 0.2 || hash(i, 28) > suitability * (0.88 - deepTime * 0.08)) continue;
    trees.push({
      x,
      y: ecosystem.elevation,
      z,
      scale: (0.62 + hash(i, 18) * 1.5) * (0.55 + succession * 0.45)
        * (1 + deepTime * (0.18 + hash(i, 61) * 0.28)),
      rotation: hash(i, 31) * Math.PI * 2,
      morphology: (() => {
        const coldOrHigh = climate.temperature === "cold" || ecosystem.elevation > treeLine * 0.68;
        const windswept = ecosystem.exposure > 0.58 || ecosystem.slope > 0.72;
        const guild: VegetationGuild = windswept ? "windswept" : coldOrHigh ? "conifer" : "broadleaf";
        const windSign = WIND[climate.wind].x === 0 ? 0 : -WIND[climate.wind].x;
        return {
          guild,
          height: guild === "windswept" ? 3.6 : guild === "conifer" ? 6.8 : 5.4,
          crownWidth: guild === "windswept" ? 1.7 : guild === "conifer" ? 1.25 : 1.75,
          crownDepth: guild === "windswept" ? 0.72 : guild === "conifer" ? 1.15 : 1.5,
          trunkWidth: 0.16 + ecosystem.exposure * 0.08,
          lean: guild === "windswept" ? windSign * (0.2 + ecosystem.exposure * 0.22) : windSign * 0.035,
          foliageHue: guild === "conifer" ? 0.39 : 0.29 + ecosystem.moisture * 0.055,
          foliageSaturation: 0.34 + ecosystem.moisture * 0.28,
          foliageLightness: 0.19 + (1 - ecosystem.moisture) * 0.12 + hash(i, 67) * 0.035,
        };
      })(),
    });
  }

  if (totalYears >= 25) {
    for (let i = 0; i < 3600 && seagrass.length < 900; i++) {
      const angle = hash(i, 811) * Math.PI * 2;
      const radius = Math.sqrt(hash(i, 823)) * 152;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const ecosystem = sampleEcosystem(heightAt, x, z, climate as ClimateForces, forageAt);
      if (ecosystem.coastalProductivity < 0.28 || ecosystem.slope > 0.5 || ecosystem.exposure > 0.7) continue;
      const suitability = ecosystem.coastalProductivity
        * clamp01(1 - ecosystem.slope * 1.4)
        * clamp01(1 - ecosystem.exposure * 0.45)
        * succession;
      if (hash(i, 839) > suitability * 1.18) continue;
      seagrass.push({
        x,
        y: ecosystem.elevation,
        z,
        rotation: hash(i, 853) * Math.PI * 2,
        scale: 1.05 + hash(i, 857) * 0.55,
        height: 0.48 + ecosystem.coastalProductivity * 0.78,
        spread: 1.05 + clamp01(1 - ecosystem.slope * 1.7) * 0.85,
        hue: 0.275 + ecosystem.coastalProductivity * 0.055,
        saturation: 0.48 + ecosystem.coastalProductivity * 0.2,
        lightness: 0.23 + ecosystem.coastalProductivity * 0.1,
      });
    }
  }

  // Mangroves occupy saltwater intertidal ground, not freshwater basin
  // edges. Basin filtering below removes any candidate that overlaps an
  // enclosed freshwater pool after the shared hydrology pass resolves.
  if (climate.temperature === "warm" && climate.rainfall !== "arid" && totalYears >= 100) {
    for (let i = 0; i < 900 && trees.length < 490; i++) {
      const angle = hash(i, 701) * Math.PI * 2;
      const radius = Math.sqrt(hash(i, 709)) * 152;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const ecosystem = sampleEcosystem(heightAt, x, z, climate as ClimateForces, forageAt);
      const intertidal = ecosystem.elevation >= seaLevel - 0.75 && ecosystem.elevation <= seaLevel + 1.35;
      if (!intertidal || ecosystem.slope > 0.58 || ecosystem.exposure > 0.78) continue;
      const suitability = clamp01(0.52 + ecosystem.moisture * 0.34 - ecosystem.exposure * 0.26)
        * succession * growth;
      if (hash(i, 719) > suitability * 0.58) continue;
      const windSign = WIND[climate.wind].x === 0 ? 0 : -WIND[climate.wind].x;
      trees.push({
        x,
        y: ecosystem.elevation,
        z,
        scale: (0.58 + hash(i, 727) * 0.82) * (0.65 + succession * 0.35),
        rotation: hash(i, 733) * Math.PI * 2,
        morphology: {
          guild: "mangrove",
          height: 4.5,
          crownWidth: 1.65,
          crownDepth: 1.5,
          trunkWidth: 0.22,
          lean: windSign * ecosystem.exposure * 0.1,
          foliageHue: 0.32 + ecosystem.moisture * 0.025,
          foliageSaturation: 0.48 + ecosystem.moisture * 0.12,
          foliageLightness: 0.23 + hash(i, 739) * 0.055,
        },
      });
    }
  }

  const lineageResolutions: Array<ReturnType<typeof resolveLineage>> = [];
  for (const lineage of previousHistory.lineages) {
    lineageResolutions.push(resolveLineage(
      snapshot,
      lineage,
      jumpYears,
      deepTime,
      lineageResolutions.flatMap(({ scored }) => scored ? [scored] : []),
    ));
  }
  const speciation = resolveSpeciation(
    snapshot,
    previousHistory,
    lineageResolutions,
    jumpYears,
    deepTime,
  );
  if (speciation) lineageResolutions.push(speciation);

  const marineResolution = resolveMarineLineages(snapshot, previousMarineHistory, jumpYears);
  const marineAbundance = marineResolution.outcomes.reduce((sum, population) => sum + (population.abundance ?? 0), 0)
    / Math.max(1, marineResolution.outcomes.length);

  let aerialBest = { x: 0, z: 0, altitude: 22, radius: 24, visible: false, score: -Infinity };
  let coastalEnergy = 0;
  let coastalSamples = 0;
  for (let i = 0; i < 900; i++) {
    const angle = hash(i, 141) * Math.PI * 2;
    const radius = Math.sqrt(hash(i, 157)) * 148;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const ecosystem = sampleEcosystem(heightAt, x, z, climate as ClimateForces);
    if (ecosystem.elevation < seaLevel) {
      coastalEnergy += ecosystem.coastalProductivity;
      coastalSamples++;
    }
    const nearbyCoast = ecosystem.elevation > seaLevel + 1
      ? Math.max(
        sampleEcosystem(heightAt, x + 22, z, climate as ClimateForces).coastalProductivity,
        sampleEcosystem(heightAt, x - 22, z, climate as ClimateForces).coastalProductivity,
        sampleEcosystem(heightAt, x, z + 22, climate as ClimateForces).coastalProductivity,
        sampleEcosystem(heightAt, x, z - 22, climate as ClimateForces).coastalProductivity,
      )
      : 0;
    const aerialScore = ecosystem.nesting * 0.9 + ecosystem.lift * 0.55
      + nearbyCoast * 0.62 + marineAbundance * 0.34;
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
  const freshwaterField = resolveFreshwaterField(snapshot, seaLevel, climate.rainfall);
  const freshwater = freshwaterField.basins;
  const saltwaterSeagrass = seagrass.filter((tuft) => !freshwater.some((pool) => (
    Math.hypot(tuft.x - pool.x, tuft.z - pool.z) < pool.radius + 2
  )));
  const marine = marineResolution.outcomes.find((population) => population.visible && population.site);
  const coastalAnimals = marine?.site
    ? Array.from({ length: Math.max(1, Math.ceil((marine.abundance ?? 0.3) * 10)) }, (_, index) => ({
      x: marine.site!.x + Math.cos(index * 2.399) * (2 + index * 0.65),
      y: marine.site!.y,
      z: marine.site!.z + Math.sin(index * 2.399) * (2 + index * 0.65),
      heading: index * 2.399,
      scale: 0.72 + (marine.traits?.bodySize ?? 0.5) * 0.72,
    }))
    : [];
  const { score: _aerialScore, ...aerial } = aerialBest;
  const inheritedMarineNutrients = snapshot.marineNutrients ?? 0.2;
  const primaryProductivity = clamp01(
    coastalEnergy / Math.max(1, coastalSamples) * 0.78 + inheritedMarineNutrients * 0.22,
  );
  const nurseryCapacity = clamp01(primaryProductivity * 0.55 + saltwaterSeagrass.length / 900 * 0.45);
  const preyAvailability = clamp01(primaryProductivity * 0.42 + nurseryCapacity * 0.28 + marineAbundance * 0.3);
  const marineEnergy: MarineEnergyExchange = {
    primaryProductivity,
    nurseryCapacity,
    preyAvailability,
    // This is available to future shoreline scavengers, nesting colonies,
    // and nutrient transport. Grazers do not consume it directly.
    shorelineSubsidy: clamp01(preyAvailability * 0.24 + primaryProductivity * 0.12),
  };
  const freshwaterEdges = trees.filter((tree) => !freshwater.some((pool) => (
    Math.hypot(tree.x - pool.x, tree.z - pool.z) < pool.radius + 3
  )));
  return {
    outcome: {
      trees: freshwaterEdges,
      seagrass: saltwaterSeagrass,
      populations: lineageResolutions.map((resolution) => resolution.outcome),
      freshwater,
      freshwaterField,
      coastalAnimals,
      marinePopulations: marineResolution.outcomes,
      marineEnergy,
      aerial,
    },
    nextHistory: {
      lineages: lineageResolutions.map((resolution) => resolution.next),
    },
    changes: lineageResolutions.map((resolution) => resolution.change),
    nextMarineHistory: marineResolution.history,
    marineChanges: marineResolution.changes,
  };
}
