import type { ClimateForces } from "./climate";
import { migrationRadius, traitAdaptationRate, type LineageStatus, type TraitChange } from "./lineage-history";
import { sampleEcosystem, type EcosystemSample } from "./outcome-resolver";
import { snapshotHeightAt, snapshotNutrientsAt, snapshotRunoffAt, type WorldSnapshot } from "./world-snapshot";
import { buildWaterVolume, reachableWaterNodes, type WaterBand, type WaterNode } from "./water-volume";

export interface MarineTraits {
  readonly bodySize: number;
  readonly streamlining: number;
  readonly depthPreference: number;
  readonly thermalTolerance: number;
  readonly maneuverability: number;
  readonly depthControl: number;
  readonly propulsionPlan: "tail";
}

export const MARINE_TRAIT_KEYS = [
  "bodySize", "streamlining", "depthPreference", "thermalTolerance", "maneuverability", "depthControl",
] as const satisfies readonly (keyof MarineTraits)[];

export interface MarineLineageState {
  readonly id: string;
  readonly originAge: number;
  readonly status: LineageStatus;
  readonly originDomain: "ocean" | "terrestrial-transition";
  readonly ancestorLineageId?: string;
  readonly site?: Readonly<{ x: number; z: number; band: WaterBand }>;
  readonly traits?: Readonly<MarineTraits>;
  readonly abundance?: number;
  readonly energy?: number;
}

export interface MarineLineageHistory {
  readonly lineages: readonly MarineLineageState[];
}

export interface MarineLineageChange {
  readonly id: string;
  readonly previousStatus: LineageStatus;
  readonly status: LineageStatus;
  readonly moved: number;
  readonly event?: "established" | "migrated" | "reanchored" | "extinct";
  readonly habitat?: Readonly<MarineHabitat>;
  readonly traits?: Partial<Readonly<Record<(typeof MARINE_TRAIT_KEYS)[number], TraitChange>>>;
  readonly abundance?: TraitChange;
  readonly energy?: TraitChange;
}

export interface MarineHabitat extends EcosystemSample {
  readonly depth: number;
  readonly temperature: number;
  readonly waveCost: number;
  readonly food: number;
  readonly band: WaterBand;
  readonly waterY: number;
  readonly light: number;
  readonly structuralComplexity: number;
}

export interface MarinePopulationOutcome {
  readonly id: string;
  readonly status: LineageStatus;
  readonly visible: boolean;
  readonly previousSite?: Readonly<{ x: number; z: number }>;
  readonly site?: Readonly<{ x: number; y: number; z: number; band: WaterBand; habitat: MarineHabitat }>;
  readonly traits?: Readonly<MarineTraits>;
  readonly abundance?: number;
  readonly energy?: number;
}

export function createMarineLineageHistory(): MarineLineageHistory {
  return { lineages: [{ id: "coastal-forager:0", originAge: 0, status: "not-established", originDomain: "ocean" }] };
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function sampleMarine(snapshot: WorldSnapshot, node: WaterNode): MarineHabitat {
  const climate = snapshot.climate as ClimateForces;
  const ecosystem = sampleEcosystem(
    (sampleX, sampleZ) => snapshotHeightAt(snapshot, sampleX, sampleZ), node.x, node.z, climate,
    undefined,
    (sampleX, sampleZ) => snapshotNutrientsAt(snapshot, sampleX, sampleZ),
    (sampleX, sampleZ) => snapshotRunoffAt(snapshot, sampleX, sampleZ),
  );
  const depth = node.columnDepth;
  const temperature = climate.temperature === "cold" ? 0.2 : climate.temperature === "mild" ? 0.55 : 0.85;
  const waveCost = clamp01(ecosystem.exposure * 0.72 + Math.max(0, 2.5 - depth) * 0.08);
  const structuralComplexity = clamp01(ecosystem.slope * 0.75 + (node.band === "benthic" ? 0.28 : 0));
  const food = clamp01(ecosystem.coastalProductivity * 0.78 + (snapshot.marineNutrients ?? 0.2) * 0.22);
  return { ...ecosystem, depth, temperature, waveCost, food,
    band: node.band, waterY: node.y, light: node.light, structuralComplexity };
}

function score(habitat: MarineHabitat, inherited?: Readonly<MarineTraits>): number {
  const depthPreference = inherited?.depthPreference ?? 0.42;
  const thermalTolerance = inherited?.thermalTolerance ?? 0.58;
  const depthMatch = 1 - Math.min(1, Math.abs(habitat.depth / 9 - depthPreference));
  const thermalMatch = 1 - Math.abs(habitat.temperature - thermalTolerance);
  const structureBenefit = habitat.structuralComplexity * (inherited?.maneuverability ?? 0.5) * 0.42;
  const structureCost = habitat.structuralComplexity * (inherited?.streamlining ?? 0.5) * 0.24;
  return habitat.food * 1.65 + depthMatch * 0.55 + thermalMatch * 0.38
    + structureBenefit - structureCost - habitat.waveCost * (1 - (inherited?.streamlining ?? 0.5)) * 0.72;
}

function targetTraits(habitat: MarineHabitat): MarineTraits {
  return {
    bodySize: clamp01(0.28 + habitat.food * 0.55),
    streamlining: clamp01(0.38 + habitat.waveCost * 0.52),
    depthPreference: clamp01(habitat.depth / 9),
    thermalTolerance: clamp01(habitat.temperature),
    maneuverability: clamp01(0.3 + habitat.structuralComplexity * 0.62),
    depthControl: clamp01(0.32 + (habitat.band === "midwater" ? 0.52 : habitat.band === "benthic" ? 0.28 : 0.18)),
    propulsionPlan: "tail",
  };
}

function blendTraits(before: Readonly<MarineTraits>, after: Readonly<MarineTraits>, rate: number): MarineTraits {
  const blend = (key: (typeof MARINE_TRAIT_KEYS)[number]) => before[key] + (after[key] - before[key]) * rate;
  return {
    bodySize: blend("bodySize"),
    streamlining: blend("streamlining"),
    depthPreference: blend("depthPreference"),
    thermalTolerance: blend("thermalTolerance"),
    maneuverability: blend("maneuverability"),
    depthControl: blend("depthControl"),
    propulsionPlan: before.propulsionPlan,
  };
}

function traitChanges(before: Readonly<MarineTraits> | undefined, after: Readonly<MarineTraits>) {
  if (!before) return undefined;
  return Object.fromEntries(MARINE_TRAIT_KEYS.map((key) => [key, { before: before[key], after: after[key] }])) as MarineLineageChange["traits"];
}

function candidates(snapshot: WorldSnapshot, previous: MarineLineageState, jumpYears: number): Array<Readonly<{ node: WaterNode; habitat: MarineHabitat; score: number }>> {
  const volume = buildWaterVolume(snapshot);
  const bodySize = previous.traits?.bodySize ?? 0.4;
  const nodes = reachableWaterNodes(
    volume,
    previous.site,
    bodySize,
    previous.status === "active" ? migrationRadius(jumpYears) : snapshot.extent * 2,
  );
  return nodes.map((node) => ({ node, habitat: sampleMarine(snapshot, node), score: 0 }))
    .filter(({ habitat }) => habitat.food >= 0.12)
    .map((candidate) => ({ ...candidate, score: score(candidate.habitat, previous.traits) }))
    .sort((a, b) => b.score - a.score);
}

export function resolveMarineLineages(
  snapshot: WorldSnapshot,
  previousHistory: MarineLineageHistory,
  jumpYears: number,
): Readonly<{ history: MarineLineageHistory; outcomes: readonly MarinePopulationOutcome[]; changes: readonly MarineLineageChange[] }> {
  const resolved = previousHistory.lineages.map((previous): Readonly<{ next: MarineLineageState; outcome: MarinePopulationOutcome; change: MarineLineageChange }> => {
    if (previous.status === "extinct" || snapshot.totalYears < 100) {
      return { next: previous, outcome: { id: previous.id, status: previous.status, visible: false } as MarinePopulationOutcome,
        change: { id: previous.id, previousStatus: previous.status, status: previous.status, moved: 0 } as MarineLineageChange };
    }
    const best = candidates(snapshot, previous, jumpYears)[0];
    if (!best) {
      const next = { ...previous, status: "extinct" as const };
      return { next, outcome: { id: previous.id, status: "extinct" as const, visible: false },
        change: { id: previous.id, previousStatus: previous.status, status: "extinct" as const, moved: 0, event: "extinct" as const } };
    }
    const target = targetTraits(best.habitat);
    const traits = previous.traits ? blendTraits(previous.traits, target, traitAdaptationRate(jumpYears)) : target;
    const beforeEnergy = previous.energy ?? 0.58;
    const beforeAbundance = previous.abundance ?? 0.3;
    const duration = clamp01(Math.log10(jumpYears + 1) / 6);
    const bodyCost = traits.bodySize * 0.18;
    const mismatchCost = Math.abs(traits.depthPreference - best.habitat.depth / 9) * 0.3
      + Math.abs(traits.thermalTolerance - best.habitat.temperature) * 0.24;
    const net = best.habitat.food - best.habitat.waveCost * (1 - traits.streamlining) * 0.36 - bodyCost - mismatchCost;
    const energy = clamp01(beforeEnergy + (net - 0.08) * duration);
    const abundance = clamp01(beforeAbundance + (net * 0.72 + (energy - 0.42) * 0.18) * duration);
    const extinct = previous.status === "active" && energy < 0.07 && abundance < 0.025;
    const moved = previous.site ? Math.hypot(best.node.x - previous.site.x, best.node.z - previous.site.z) : 0;
    const next: MarineLineageState = { ...previous, status: extinct ? "extinct" : "active",
      site: { x: best.node.x, z: best.node.z, band: best.node.band }, traits, energy, abundance };
    const event: MarineLineageChange["event"] = extinct
      ? "extinct"
      : previous.status === "not-established" ? "established" : "migrated";
    return {
      next,
      outcome: { id: previous.id, status: next.status, visible: !extinct, previousSite: previous.site,
        site: { x: best.node.x, y: best.node.y, z: best.node.z, band: best.node.band, habitat: best.habitat }, traits, energy, abundance },
      change: { id: previous.id, previousStatus: previous.status, status: next.status, moved,
        event,
        habitat: best.habitat, traits: traitChanges(previous.traits, traits),
        abundance: { before: beforeAbundance, after: abundance }, energy: { before: beforeEnergy, after: energy } },
    };
  });
  return { history: { lineages: resolved.map(({ next }) => next) }, outcomes: resolved.map(({ outcome }) => outcome), changes: resolved.map(({ change }) => change) };
}

export function validateMarineLineageHistory(value: unknown): asserts value is MarineLineageHistory {
  if (!value || typeof value !== "object" || !Array.isArray((value as MarineLineageHistory).lineages)) throw new TypeError("world history marine lineages must be an array");
  const ids = new Set<string>();
  for (const [index, lineage] of (value as MarineLineageHistory).lineages.entries()) {
    const context = `world history marine lineages[${index}]`;
    if (typeof lineage.id !== "string" || !lineage.id) throw new TypeError(`${context}.id must be non-empty`);
    if (ids.has(lineage.id)) throw new RangeError(`${context}.id duplicates ${lineage.id}`);
    ids.add(lineage.id);
    if (!Number.isFinite(lineage.originAge) || lineage.originAge < 0) throw new RangeError(`${context}.originAge must be non-negative and finite`);
    if (!["not-established", "active", "extinct"].includes(lineage.status)) throw new RangeError(`${context}.status is not recognized`);
    if (lineage.originDomain !== "ocean" && lineage.originDomain !== "terrestrial-transition") throw new RangeError(`${context}.originDomain is not recognized`);
    if (lineage.ancestorLineageId !== undefined && (lineage.originDomain !== "terrestrial-transition" || !lineage.ancestorLineageId)) {
      throw new RangeError(`${context}.ancestorLineageId requires a terrestrial transition`);
    }
    if (lineage.site && (!Number.isFinite(lineage.site.x) || !Number.isFinite(lineage.site.z))) throw new RangeError(`${context}.site coordinates must be finite`);
    for (const field of ["energy", "abundance"] as const) {
      const entry = lineage[field];
      if (entry !== undefined && (!Number.isFinite(entry) || entry < 0 || entry > 1)) throw new RangeError(`${context}.${field} must be within [0, 1]`);
    }
    if (lineage.traits && (lineage.traits.propulsionPlan !== "tail" || MARINE_TRAIT_KEYS.some((key) => !Number.isFinite(lineage.traits![key]) || lineage.traits![key] < 0 || lineage.traits![key] > 1))) {
      throw new RangeError(`${context}.traits are invalid`);
    }
  }
}
