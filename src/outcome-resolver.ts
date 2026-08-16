import {
  RAINFALL,
  SEA_LEVEL,
  TEMPERATURE,
  WIND,
  type ClimateForces,
} from "./climate";
import { snapshotBasaltAt, snapshotForageAt, snapshotHeightAt, snapshotNutrientsAt, snapshotRunoffAt, type WorldSnapshot } from "./world-snapshot";
import { resolveFreshwaterField, type FreshwaterField } from "./freshwater-basins";
import { lineageSeed, populationArchetype } from "./population-archetypes";
import {
  assertPopulationTraits,
  derivePopulationTraits,
  POPULATION_TRAIT_KEYS,
  type PopulationIdentity,
  type PopulationTraits,
} from "./population-traits";
import {
  blendPopulationTraits,
  createLineageHistory,
  driftPopulationTraits,
  GENE_FLOW_RATE,
  meanPopulationTraits,
  migrationRadius,
  populationTraitChanges,
  populationTraitDistance,
  traitAdaptationRate,
  type LineageChange,
  type LineageHistory,
  type LineageOrigin,
  type LineageState,
  type LineageStatus,
} from "./lineage-history";
import {
  islandAt,
  isolatedSinceYear,
  nearestIslandId,
  saddleBetween,
  type IslandGeography,
  type SeaLevelHistory,
} from "./island-geography";
import { createMarineLineageHistory, resolveMarineLineages, type MarineLineageChange, type MarineLineageHistory, type MarinePopulationOutcome } from "./marine-lineage";
import { FOUNDER_MARGIN_BAND_WIDTH, resolveFounderEstablishment } from "./founder-establishment";
import { founderEnvironmentFit, type FoodAffinities, type FounderProfile } from "./founder-profile";
import { resolveLocalEnvironmentSample } from "./environment";
import { RENDER_SCALE } from "./render-scale";

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

export interface ReefEcosystemSignal {
  readonly shelter: number;
  readonly productivity: number;
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

/**
 * Disc radius, in metres, that the scatter loops below were authored against —
 * the old 165 m island plus a little shore margin.
 */
const AUTHORED_SCATTER_RADIUS = 150;

export function sampleHabitat(
  heightAt: HeightAt,
  x: number,
  z: number,
  climate?: ClimateForces,
  runoff = 0,
): HabitatSample {
  const step = 5;
  const elevation = heightAt(x, z);
  const east = heightAt(x + step, z);
  const west = heightAt(x - step, z);
  const north = heightAt(x, z + step);
  const south = heightAt(x, z - step);
  const dx = (east - west) / (step * 2);
  const dz = (north - south) / (step * 2);
  const concavity = (east + west + north + south) * 0.25 - elevation;
  const local = resolveLocalEnvironmentSample(
    elevation,
    dx,
    dz,
    concavity,
    runoff,
    climate ?? {
      rainfall: "temperate", temperature: "mild", wind: "westerly", seaLevel: "present",
    },
  );
  return { elevation, slope: local.slope, moisture: local.moisture, exposure: local.exposure };
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
  const runoff = clamp01(runoffAt(x, z));
  const habitat = sampleHabitat(heightAt, x, z, climate, runoff);
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
    ? resolveLocalEnvironmentSample(
      habitat.elevation,
      (heightAt(x + step, z) - heightAt(x - step, z)) / (step * 2),
      (heightAt(x, z + step) - heightAt(x, z - step)) / (step * 2),
      concavity,
      runoff,
      climate,
    ).drainage
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
  return {
    ...habitat,
    drainage,
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

/**
 * A branch reaching a *separate, never-connected* island crossed open water — a
 * rare dispersal that only reads as plausible over a long epoch. Vicariance (a
 * land bridge drowning under a population that spanned it) needs no such gate:
 * the drowning is itself the trigger and only happens across deep time. This is
 * a property of the *epoch length*, not a per-lineage maturation clock — the
 * distinction the objective draws when it forbids "an arbitrary elapsed-time
 * threshold" for branching.
 */
const DISPERSAL_MIN_JUMP_YEARS = 1_000;

function separationBonus(x: number, z: number, occupied: readonly ScoredSite[]): number {
  if (occupied.length === 0) return 0;
  const nearest = Math.min(...occupied.map((site) => Math.hypot(x - site.x, z - site.z)));
  return Math.min(1, nearest / 75) * 1.35;
}

/** An already-active population's site and abundance, read for forage contest only — not its full lineage state. */
interface IncumbentPresence {
  readonly x: number;
  readonly z: number;
  readonly abundance: number;
}

const CONTEST_RADIUS = 60;
const CONTEST_STRENGTH = 0.82;

/**
 * How much of a site's raw forage a newly arriving raft founder can actually
 * reach once nearby established populations are already eating there.
 *
 * WU-A2: `docs/TANGLED-BANK.md`'s "into a living ecosystem" scenario needs a
 * raft's establishment odds to visibly worsen on an occupied island. Rather
 * than a bespoke displacement rule, this shrinks the *input* to WU-A1's
 * existing three-band establishment logic (`founder-establishment.ts`) —
 * less reachable food pushes the same intake/energy math toward the
 * marginal band and then the failing one, exactly as a genuinely poor site
 * would. Pressure from each incumbent falls off linearly to zero at
 * `CONTEST_RADIUS` and scales with how abundant that incumbent already is;
 * it never removes all forage (`CONTEST_STRENGTH` < 1), so a contested
 * arrival can still land in the marginal band instead of being auto-failed.
 */
function contestedForageAt(
  x: number,
  z: number,
  rawForage: number,
  incumbents: readonly IncumbentPresence[],
): number {
  if (incumbents.length === 0) return rawForage;
  let pressure = 0;
  for (const incumbent of incumbents) {
    const distance = Math.hypot(x - incumbent.x, z - incumbent.z);
    if (distance >= CONTEST_RADIUS) continue;
    pressure += incumbent.abundance * (1 - distance / CONTEST_RADIUS);
  }
  return rawForage * (1 - Math.min(1, pressure) * CONTEST_STRENGTH);
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
  geography: IslandGeography | undefined,
  occupied: readonly ScoredSite[] = [],
): ScoredSite | undefined {
  if (!lineage.site) return undefined;
  const origin = lineage.site;
  const originHabitat = sampleEcosystem(heightAt, origin.x, origin.z, climate, forageAt);
  const originValid = isViableSite(originHabitat, climate);
  const normalRadius = migrationRadius(jumpYears);
  const maximumRadius = originValid ? normalRadius : extent;
  const samplingSeed = lineageSeed(lineage.identity, lineage.id);
  // A migrated site must be reachable by land from wherever the population
  // actually stands. Without this, the wide reanchor search below (or simply a
  // migration radius that outreaches a narrow strait) lets a population "swim"
  // to a different island every jump, silently corrupting the island-membership
  // reading gene flow and isolation branching are built on. `undefined` means no
  // geography was supplied (the legacy synthetic-fixture path) and disables the
  // check entirely; `null` means geography was supplied but no reachable land
  // exists at all, which must reject every candidate rather than fall back to
  // an unrestricted search.
  const homeIsland = geography ? nearestIslandId(geography, origin.x, origin.z) : undefined;
  let best: ScoredSite | undefined;

  for (let i = -1; i < 480; i++) {
    const angle = i < 0 ? 0 : hash(i, samplingSeed) * Math.PI * 2;
    const radius = i < 0 ? 0 : Math.sqrt(hash(i, 421)) * maximumRadius;
    const x = origin.x + Math.cos(angle) * radius;
    const z = origin.z + Math.sin(angle) * radius;
    const sampleBoundary = extent / 2 - 5;
    if (Math.abs(x) > sampleBoundary || Math.abs(z) > sampleBoundary) continue;
    if (homeIsland !== undefined && (homeIsland === null || islandAt(geography!, x, z) !== homeIsland)) continue;
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
  geography: IslandGeography | undefined,
  occupied: readonly ScoredSite[] = [],
  incumbents: readonly IncumbentPresence[] = [],
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
      geography,
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
  if (import.meta.env?.DEV) {
    if (previous.traits) assertPopulationTraits(previous.traits, `lineage ${previous.id} inherited traits`);
    assertPopulationTraits(target, `lineage ${previous.id} target traits`);
  }
  const traits = previous.status === "active" && previous.traits
    ? blendPopulationTraits(previous.traits, target, traitAdaptationRate(jumpYears))
    : previous.status === "not-established" && previous.founder && previous.traits
      ? previous.traits
      : target;
  if (import.meta.env?.DEV) assertPopulationTraits(traits, `lineage ${previous.id} resolved traits`);
  const moved = previous.site ? Math.hypot(scored.x - previous.site.x, scored.z - previous.site.z) : 0;
  const duration = clamp01(Math.log10(Math.max(1, jumpYears) + 1) / 6);
  const founder = previous.status === "not-established";
  const beforeEnergy = previous.energy ?? (founder ? 0.38 : 0.62);
  const beforeAbundance = previous.abundance ?? (founder ? 0.012 : 0.34);
  const intake = scored.habitat.forage * (0.75 + scored.habitat.moisture * 0.25);
  // A raft founder reads what is already being eaten at and around its
  // landing site, not just the raw forage field (WU-A2, `foundingSite`
  // already nudges the site search away from occupied ground via
  // `separationBonus`, but the *established* founders it does land near
  // still have to be felt in the food budget). Established populations do
  // not re-read this each jump — the existing per-jump abundance track
  // already carries their own history of competition.
  const foundingForage = founder ? contestedForageAt(scored.x, scored.z, scored.habitat.forage, incumbents) : scored.habitat.forage;
  const founderFit = previous.founder
    ? founderEnvironmentFit(
      previous.founder,
      foundingForage,
      scored.habitat.moisture,
      snapshot.climate,
      scored.habitat.coastalProductivity,
      previous.foodAffinities,
    )
    : { foodAvailability: foundingForage * (0.82 + scored.habitat.moisture * 0.18), climateFit: 1, metabolicCost: 1 };
  const founderResolution = founder ? resolveFounderEstablishment({
    energy: beforeEnergy,
    abundance: beforeAbundance,
    feedingAdaptation: previous.feedingAdaptation ?? 0.28,
  }, founderFit, jumpYears) : undefined;
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
    rootId: parentResolution.next.rootId,
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

/**
 * A founding-site search restricted to islands *other* than the parent's.
 *
 * `foundingSite` returns the single best site anywhere, which on a multi-island
 * world is usually still on the parent's own island — the same ground, not a
 * separate one. A branch is an allopatric event: it needs the best site that is
 * genuinely across water, so this loop rejects every candidate that resolves to
 * the parent's island or to one the parent has already colonized.
 */
function isolatedFoundingSite(
  heightAt: HeightAt,
  forageAt: HeightAt,
  identity: PopulationIdentity,
  climate: ClimateForces,
  deepTime: number,
  extent: number,
  geography: IslandGeography,
  parentIsland: string,
  forbiddenIslands: ReadonlySet<string>,
  occupied: readonly ScoredSite[],
): (ScoredSite & { island: string }) | undefined {
  let best: (ScoredSite & { island: string }) | undefined;
  const worldRadius = extent / 2 - 5;
  for (let i = 0; i < 320; i++) {
    const angle = hash(i, 71) * Math.PI * 2;
    const radius = Math.sqrt(hash(i, 83)) * worldRadius;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const island = islandAt(geography, x, z);
    if (island === null || island === parentIsland || forbiddenIslands.has(island)) continue;
    const habitat = sampleEcosystem(heightAt, x, z, climate, forageAt);
    if (!isViableSite(habitat, climate)) continue;
    const score = siteScore(habitat, identity, deepTime) + separationBonus(x, z, occupied);
    if (!best || score > best.score) best = { x, y: habitat.elevation, z, habitat, score, island };
  }
  return best;
}

/**
 * Classify why a population on `parentIsland` and a founding site on
 * `childIsland` can no longer interbreed, and date it — the recorded cause a
 * later reveal reads instead of "some threshold elapsed".
 *
 * `isolatedFromId` is filled by the caller; everything else is a fact about the
 * geology and the sea-level record.
 */
function resolveIsolationBasis(
  geography: IslandGeography,
  seaLevelHistory: SeaLevelHistory | undefined,
  parentIsland: string,
  childIsland: string,
  parentOriginAge: number,
  totalYears: number,
  jumpYears: number,
): Omit<LineageOrigin, "isolatedFromId"> | undefined {
  const from = geography.islands.find((island) => island.id === parentIsland);
  const to = geography.islands.find((island) => island.id === childIsland);
  // Vicariance: a col between a shield on each island carried a land connection
  // within the parent's life and has since drowned. Prefer the most recently
  // lost bridge — the last time the two ranges were actually one.
  if (seaLevelHistory && from && to) {
    let best: { year: number; x: number; z: number } | undefined;
    for (const a of from.shieldIds) {
      for (const b of to.shieldIds) {
        const saddle = saddleBetween(geography, a, b);
        if (!saddle) continue;
        const year = isolatedSinceYear(seaLevelHistory, saddle.elevation);
        if (year === null || year < parentOriginAge) continue;
        if (!best || year > best.year) best = { year, x: saddle.x, z: saddle.z };
      }
    }
    if (best) {
      return { isolatedSinceYear: best.year, basis: "vicariance", bridgeX: best.x, bridgeZ: best.z };
    }
  }
  // Dispersal: no bridge to lose, so the branch crossed open water — only
  // credible over a long epoch, and dated to the crossing itself.
  if (jumpYears >= DISPERSAL_MIN_JUMP_YEARS) {
    return { isolatedSinceYear: totalYears, basis: "dispersal" };
  }
  return undefined;
}

/**
 * Branch a lineage when geography — not elapsed time — isolates part of it.
 *
 * This replaces the maturation-cooldown speciation on the shipping path: a
 * branch appears only when a viable founding site exists on a *different*
 * island than the parent, and that separation has a recorded cause (a drowned
 * land bridge, or an over-water crossing). A single-island world therefore
 * never branches, which is the correct allopatric reading; a growing
 * archipelago radiates one island per deep-time jump.
 *
 * The daughter inherits the parent's traits (path dependence), blends toward
 * its new island's habitat (authored selection), and carries a founder-effect
 * bottleneck in both trait means and abundance.
 */
function resolveIsolationSpeciation(
  snapshot: WorldSnapshot,
  history: LineageHistory,
  resolved: readonly ReturnType<typeof resolveLineage>[],
  jumpYears: number,
  deepTime: number,
  geography: IslandGeography,
  seaLevelHistory: SeaLevelHistory | undefined,
): ReturnType<typeof resolveLineage> | undefined {
  const heightAt = (x: number, z: number) => snapshotHeightAt(snapshot, x, z);
  const forageAt = (x: number, z: number) => snapshotForageAt(snapshot, x, z);
  const occupied = resolved.flatMap(({ scored }) => (scored ? [scored] : []));

  for (const parentResolution of resolved) {
    const parent = parentResolution.next;
    if (parent.status !== "active" || !parent.traits || !parent.site) continue;
    const parentIsland = islandAt(geography, parent.site.x, parent.site.z);
    if (parentIsland === null) continue;

    // Islands this parent's descendants already hold: do not re-colonize them,
    // so a parent radiates to a new island each jump rather than piling onto one.
    const forbidden = new Set<string>();
    for (const { next } of resolved) {
      if (next.parentId === parent.id && next.status === "active" && next.site) {
        const island = islandAt(geography, next.site.x, next.site.z);
        if (island) forbidden.add(island);
      }
    }

    const alternate = isolatedFoundingSite(
      heightAt, forageAt, parent.identity, snapshot.climate as ClimateForces,
      deepTime, snapshot.extent, geography, parentIsland, forbidden, occupied,
    );
    if (!alternate) continue;

    const basis = resolveIsolationBasis(
      geography, seaLevelHistory, parentIsland, alternate.island,
      parent.originAge, snapshot.totalYears, jumpYears,
    );
    if (!basis) continue;
    const origin: LineageOrigin = { ...basis, isolatedFromId: parent.id };

    const childId = nextChildId(parent, history);
    const target = derivePopulationTraits(parent.identity, alternate.habitat, snapshot.climate);
    const blended = blendPopulationTraits(parent.traits, target, traitAdaptationRate(jumpYears));
    // A one-time founder-effect sample: the colonists are not the parent mean.
    const traits = driftPopulationTraits(
      blended,
      lineageSeed(parent.identity, childId) ^ (origin.isolatedSinceYear >>> 0),
      1,
    );
    if (populationTraitDistance(parent.traits, traits) < SPECIATION_MIN_TRAIT_DISTANCE) continue;

    const child: LineageState = {
      id: childId,
      parentId: parent.id,
      originAge: origin.isolatedSinceYear,
      generation: parent.generation + 1,
      identity: parent.identity,
      status: "active",
      rootId: parent.rootId,
      site: { x: alternate.x, z: alternate.z },
      traits,
      abundance: Math.max(0.12, (parent.abundance ?? 0.34) * 0.42),
      energy: parent.energy ?? 0.62,
      origin,
    };
    const siteDistance = Math.hypot(alternate.x - parent.site.x, alternate.z - parent.site.z);
    return {
      outcome: {
        id: child.id,
        identity: child.identity,
        status: "active",
        visible: true,
        previousSite: parent.site,
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
        traits: populationTraitChanges(parent.traits, traits),
        abundance: { before: 0, after: child.abundance ?? 0 },
        energy: { before: 0, after: child.energy ?? 0 },
        isolation: origin,
      },
    };
  }
  return undefined;
}

/** Rebuild a resolution with new trait means, keeping the pre-jump `before` values. */
function withResolvedTraits(
  resolution: ReturnType<typeof resolveLineage>,
  traits: PopulationTraits,
  changePatch: Partial<LineageChange>,
): ReturnType<typeof resolveLineage> {
  const prior = resolution.change.traits;
  const rebuiltTraits = prior
    ? (Object.fromEntries(POPULATION_TRAIT_KEYS.map((key) => [
        key,
        { before: prior[key]?.before ?? traits[key], after: traits[key] },
      ])) as LineageChange["traits"])
    : resolution.change.traits;
  return {
    ...resolution,
    next: { ...resolution.next, traits },
    outcome: { ...resolution.outcome, traits },
    change: { ...resolution.change, ...changePatch, traits: rebuiltTraits },
  };
}

/**
 * Gene flow and drift, read off island membership — the consumer the emergent
 * grouping in `island-geography.ts` was built for.
 *
 * - **Gene flow.** Two active populations of one identity that share an island
 *   interbreed, so each jump pulls their means toward the shared island centroid.
 *   This is what keeps a lineage that never split, or one whose bridge reformed,
 *   from reading as two — divergence needs *isolation*, not just distance.
 * - **Drift.** A population isolated from its relatives (alone on its island
 *   while the same identity persists elsewhere) drifts neutrally, so two ranges
 *   diverge even in identical habitat rather than resolving to one mean.
 *
 * Both are deterministic; capture mode forbids real randomness. Mutates nothing —
 * it rewrites entries of the resolution array in place with updated copies.
 */
function applyIslandGeneFlow(
  resolved: Array<ReturnType<typeof resolveLineage>>,
  geography: IslandGeography,
  jumpYears: number,
  totalYears: number,
): void {
  const duration = clamp01(Math.log10(Math.max(1, jumpYears) + 1) / 6);
  if (duration <= 0) return;

  const active = resolved.flatMap((resolution, index) => {
    const state = resolution.next;
    if (state.status !== "active" || !state.traits || !state.site) return [];
    const island = islandAt(geography, state.site.x, state.site.z);
    if (island === null) return [];
    return [{ index, island, identity: state.identity, rootId: state.rootId, traits: state.traits }];
  });
  if (active.length === 0) return;

  // Which islands each identity occupies — an identity spanning more than one is
  // the definition of an isolated pair, and so of where drift applies. Root is
  // deliberately excluded from this map: it answers "does this identity persist
  // elsewhere", which is a question about the identity as a whole, not about
  // which raft it descends from.
  const islandsByIdentity = new Map<PopulationIdentity, Set<string>>();
  // WU-A2: the blend key includes `rootId` — two rafts of the same identity
  // sharing an island are "interacting but ancestrally separate"
  // (`docs/TANGLED-BANK.md`), never one interbreeding population. Lineages
  // without a recorded root (the legacy synthetic fixtures `createLineageHistory`
  // still produces) all share the `undefined` key, so their existing
  // same-island gene flow is unchanged.
  const groups = new Map<string, typeof active>();
  for (const member of active) {
    const spread = islandsByIdentity.get(member.identity) ?? new Set<string>();
    spread.add(member.island);
    islandsByIdentity.set(member.identity, spread);
    const key = `${member.island}|${member.identity}|${member.rootId ?? "unrooted"}`;
    const group = groups.get(key) ?? [];
    group.push(member);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    if (group.length >= 2) {
      // Gene flow: blend every member toward the island/identity mean.
      const mean = meanPopulationTraits(group.map((member) => member.traits));
      const rate = GENE_FLOW_RATE * duration;
      for (const member of group) {
        const blended = blendPopulationTraits(member.traits, mean, rate);
        const closed = populationTraitDistance(member.traits, blended);
        resolved[member.index] = withResolvedTraits(resolved[member.index]!, blended, { geneFlow: closed });
      }
    } else {
      // A lone member. It drifts only if it is genuinely isolated from a relative.
      const member = group[0]!;
      const isolated = (islandsByIdentity.get(member.identity)?.size ?? 0) > 1;
      if (!isolated) continue;
      const state = resolved[member.index]!.next;
      const drifted = driftPopulationTraits(
        member.traits,
        lineageSeed(member.identity, state.id) ^ (Math.floor(totalYears) >>> 0),
        duration,
      );
      resolved[member.index] = withResolvedTraits(resolved[member.index]!, drifted, {});
    }
  }
}

/**
 * Estimate a population's food intake at a given site the same way
 * `resolveFounderEstablishment`'s own intake formula does
 * (`foodQuality * (0.25 + adaptation * 0.75) * climateFit`), without running
 * the full establishment resolution and without touching any stored
 * energy/abundance. Used only to *compare* two populations' fitness at one
 * shared site — never to resolve either of them.
 */
function estimatedIntakeAt(
  founder: Readonly<FounderProfile> | undefined,
  affinities: Readonly<FoodAffinities> | undefined,
  adaptation: number,
  habitat: Readonly<EcosystemSample>,
  climate: ClimateForces,
  forageOverride?: number,
): number {
  const forage = forageOverride ?? habitat.forage;
  if (!founder) {
    // No recorded founder profile (a legacy non-raft baseline lineage): fall
    // back to the same generic, food-source-agnostic formula the established
    // path already uses for such lineages.
    return clamp01(forage) * (0.75 + habitat.moisture * 0.25);
  }
  const fit = founderEnvironmentFit(founder, forage, habitat.moisture, climate, habitat.coastalProductivity, affinities);
  return clamp01(fit.foodAvailability) * (0.25 + clamp01(adaptation) * 0.75) * clamp01(fit.climateFit);
}

/** Contest radius for the rare displacement outcome: tighter than `CONTEST_RADIUS` because this compares two populations that would be sharing essentially the same ground, not merely nearby. */
const DISPLACEMENT_RADIUS = 40;

/**
 * Must clear WU-A1's own marginal band by a full band width in both
 * directions — the arrival has to be decisively better fed at the shared
 * site, not just nudged ahead of an incumbent already near the establishment
 * threshold.
 */
const DISPLACEMENT_MARGIN = FOUNDER_MARGIN_BAND_WIDTH * 2;

/**
 * Rarely, a raft that has just established lands so much better-suited to a
 * site than a nearby incumbent of a different root that it displaces it —
 * `docs/TANGLED-BANK.md`'s third named arrival outcome, alongside failure and
 * a marginal niche. This is not a coin flip: it is a direct, deterministic
 * comparison of two intake estimates at the same site, both derived the same
 * way `resolveFounderEstablishment`'s own intake is. The loser simply goes
 * extinct — exactly how starvation already ends a lineage — so two roots are
 * never merged by this; it is competitive exclusion, not hybridization
 * (`docs/TANGLED-BANK.md`'s reconnection mechanics are a different unit,
 * WU-B2, and do not apply here).
 */
function applyRaftArrivalDisplacement(
  resolved: Array<ReturnType<typeof resolveLineage>>,
  climate: ClimateForces,
): void {
  for (const resolution of resolved) {
    if (resolution.change.event !== "established") continue;
    const arrival = resolution.next;
    const arrivalHabitat = resolution.outcome.site?.habitat;
    if (!arrival.site || !arrivalHabitat) continue;

    let victimIndex = -1;
    let victimDistance = Infinity;
    for (let index = 0; index < resolved.length; index++) {
      const candidate = resolved[index]!.next;
      if (candidate === arrival || candidate.status !== "active" || !candidate.site) continue;
      if (candidate.rootId !== undefined && arrival.rootId !== undefined && candidate.rootId === arrival.rootId) continue;
      const distance = Math.hypot(candidate.site.x - arrival.site.x, candidate.site.z - arrival.site.z);
      if (distance < DISPLACEMENT_RADIUS && distance < victimDistance) {
        victimDistance = distance;
        victimIndex = index;
      }
    }
    if (victimIndex < 0) continue;
    const victim = resolved[victimIndex]!.next;

    const arrivalIntake = estimatedIntakeAt(
      arrival.founder, arrival.foodAffinities, arrival.feedingAdaptation ?? 1, arrivalHabitat, climate,
    );
    // The incumbent's fitness at the arrival's own site, uncontested by the
    // arrival itself — "how well would this incumbent do here on its own
    // merits", the fair baseline to compare the arrival's fitness against.
    const victimIntake = estimatedIntakeAt(
      victim.founder, victim.foodAffinities, victim.feedingAdaptation ?? 1, arrivalHabitat, climate,
    );
    if (arrivalIntake - victimIntake <= DISPLACEMENT_MARGIN) continue;

    resolved[victimIndex] = {
      ...resolved[victimIndex]!,
      next: { ...victim, status: "extinct", energy: 0, abundance: 0 },
      outcome: { ...resolved[victimIndex]!.outcome, status: "extinct", visible: false },
      change: { ...resolved[victimIndex]!.change, status: "extinct", event: "extinct" },
    };
  }
}

export function resolveLanding(
  snapshot: WorldSnapshot,
  previousHistory: LineageHistory = createLineageHistory(),
  jumpYears = snapshot.totalYears,
  previousMarineHistory: MarineLineageHistory = createMarineLineageHistory(),
  reef: ReefEcosystemSignal = { shelter: 0, productivity: 0 },
  geography?: IslandGeography,
  seaLevelHistory?: SeaLevelHistory,
): LandingResolution {
  const heightAt = (x: number, z: number) => snapshotHeightAt(snapshot, x, z);
  const forageAt = (x: number, z: number) => snapshotForageAt(snapshot, x, z);
  const nutrientsAt = (x: number, z: number) => snapshotNutrientsAt(snapshot, x, z);
  const runoffAt = (x: number, z: number) => snapshotRunoffAt(snapshot, x, z);
  const basaltAt = (x: number, z: number) => snapshotBasaltAt(snapshot, x, z);
  const { climate, totalYears } = snapshot;
  const trees: TreeOutcome[] = [];
  const seagrass: SeagrassOutcome[] = [];
  // Scatter over the land the world actually has, and carry the authored
  // *density* rather than the authored *count*. These loops were written
  // against a 165 m island: keeping their 150 m disc on the 2,000 m world
  // would pile every tree into the middle third of the map, and keeping their
  // 420-tree cap over seven times the land would read as a bare island.
  const scatterRadius = RENDER_SCALE.islandLandRadius;
  const densityScale = Math.pow(scatterRadius / AUTHORED_SCATTER_RADIUS, 2);
  const perArea = (authored: number) => Math.round(authored * densityScale);
  const succession = clamp01(Math.log10(Math.max(1, totalYears)) / 3);
  const deepTime = clamp01((Math.log10(Math.max(1, totalYears)) - 3) / 3);
  const growth = TEMPERATURE[climate.temperature].growth;
  const seaLevel = SEA_LEVEL[climate.seaLevel];
  const treeLine = climate.temperature === "cold" ? 24 : climate.temperature === "mild" ? 38 : 46;
  const canopyCandidates = perArea(1400);
  const canopyCap = perArea(420);
  for (let i = 0; i < canopyCandidates && trees.length < canopyCap; i++) {
    const angle = hash(i, 4) * Math.PI * 2;
    const radius = Math.sqrt(hash(i, 9)) * scatterRadius;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const ecosystem = sampleEcosystem(heightAt, x, z, climate as ClimateForces, forageAt, nutrientsAt, runoffAt);
    if (basaltAt(x, z) > 0.42) continue;
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
    for (let i = 0; i < perArea(3600) && seagrass.length < perArea(900); i++) {
      const angle = hash(i, 811) * Math.PI * 2;
      const radius = Math.sqrt(hash(i, 823)) * scatterRadius;
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
    const mangroveCap = canopyCap + perArea(70);
    for (let i = 0; i < perArea(900) && trees.length < mangroveCap; i++) {
      const angle = hash(i, 701) * Math.PI * 2;
      const radius = Math.sqrt(hash(i, 709)) * scatterRadius;
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
    // Rafts are appended to the end of `previousHistory.lineages`
    // (`introduceDistantDrifter` in `landing-state.ts`), so every
    // already-established incumbent this jump has already been resolved
    // into `lineageResolutions` by the time a founder further down the list
    // is reached — this is exactly the "what's already being eaten here"
    // read `contestedForageAt` needs.
    const incumbents: IncumbentPresence[] = lineageResolutions.flatMap(({ next }) => (
      next.status === "active" && next.site ? [{ x: next.site.x, z: next.site.z, abundance: next.abundance ?? 0 }] : []
    ));
    lineageResolutions.push(resolveLineage(
      snapshot,
      lineage,
      jumpYears,
      deepTime,
      geography,
      lineageResolutions.flatMap(({ scored }) => scored ? [scored] : []),
      incumbents,
    ));
  }
  // With the world's geography in hand, branching is driven by island
  // isolation and gene flow reads island membership. Without it (synthetic unit
  // fixtures with no archipelago) the legacy distance-and-maturation path runs,
  // so those tests and the determinism baseline are undisturbed.
  const speciation = geography
    ? resolveIsolationSpeciation(
      snapshot, previousHistory, lineageResolutions, jumpYears, deepTime, geography, seaLevelHistory,
    )
    : resolveSpeciation(snapshot, previousHistory, lineageResolutions, jumpYears, deepTime);
  if (speciation) lineageResolutions.push(speciation);
  if (geography) applyIslandGeneFlow(lineageResolutions, geography, jumpYears, snapshot.totalYears);
  applyRaftArrivalDisplacement(lineageResolutions, snapshot.climate as ClimateForces);

  const marineResolution = resolveMarineLineages(snapshot, previousMarineHistory, jumpYears);
  const marineAbundance = marineResolution.outcomes.reduce((sum, population) => sum + (population.abundance ?? 0), 0)
    / Math.max(1, marineResolution.outcomes.length);

  let aerialBest = { x: 0, z: 0, altitude: 22, radius: 24, visible: false, score: -Infinity };
  let coastalEnergy = 0;
  let coastalSamples = 0;
  for (let i = 0; i < perArea(900); i++) {
    const angle = hash(i, 141) * Math.PI * 2;
    const radius = Math.sqrt(hash(i, 157)) * scatterRadius;
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
  const reefProductivity = clamp01(reef.productivity);
  const reefShelter = clamp01(reef.shelter);
  const primaryProductivityWithReef = clamp01(primaryProductivity * 0.82 + reefProductivity * 0.18);
  const nurseryCapacity = clamp01(primaryProductivityWithReef * 0.42 + saltwaterSeagrass.length / 900 * 0.33 + reefShelter * 0.25);
  const preyAvailability = clamp01(primaryProductivity * 0.42 + nurseryCapacity * 0.28 + marineAbundance * 0.3);
  const marineEnergy: MarineEnergyExchange = {
    primaryProductivity: primaryProductivityWithReef,
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
