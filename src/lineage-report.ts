import type { LineageChange } from "./lineage-history";
import type { PopulationOutcome } from "./outcome-resolver";
import { populationArchetype } from "./population-archetypes";
import { POPULATION_TRAIT_KEYS, type PopulationTraits } from "./population-traits";

const TRAIT_LABELS = {
  bodyMass: "mass",
  legLength: "legs",
  footWidth: "feet",
  insulation: "insulation",
  coatLightness: "coat lightness",
  coatWarmth: "coat warmth",
  hornLength: "crest",
} as const satisfies Record<keyof PopulationTraits, string>;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(3)}`;
}

function habitatLabel(change: LineageChange, island?: string): string | undefined {
  const habitat = change.habitat;
  const climate = habitat
    ? `${habitat.moisture > 0.68 ? "wet" : habitat.moisture < 0.35 ? "dry" : "temperate"} · ${
      habitat.slope > 0.7 ? "steep" : habitat.exposure > 0.58 ? "exposed" : "sheltered"
    }`
    : undefined;
  if (island && climate) return `${island} · ${climate}`;
  return island ?? climate;
}

function eventLabel(change: LineageChange): string {
  if (change.event === "speciated") {
    const isolation = change.isolation;
    if (isolation) {
      const year = `Year ${Math.round(isolation.isolatedSinceYear).toLocaleString()}`;
      return isolation.basis === "vicariance"
        ? `new branch · land bridge drowned · ${year}`
        : `new branch · reached a separate island · ${year}`;
    }
    return `new branch · ${change.moved.toFixed(0)}m isolated`;
  }
  if (change.status === "extinct") return "extinct";
  if (change.status === "not-established") return "not established";
  if (change.event === "established") return "established";
  if (change.event === "reanchored") return `re-anchored · ${change.moved.toFixed(0)}m`;
  return `moved · ${change.moved.toFixed(0)}m`;
}

function strongestTraits(change: LineageChange): string {
  const ranked = POPULATION_TRAIT_KEYS.flatMap((key) => {
    const trait = change.traits?.[key];
    return trait ? [{ key, delta: trait.after - trait.before }] : [];
  }).sort((first, second) => Math.abs(second.delta) - Math.abs(first.delta)).slice(0, 3);
  if (ranked.length === 0) return "";
  return `<div class="lineage-traits">${ranked.map(({ key, delta }) => (
    `<span>${TRAIT_LABELS[key]} ${signed(delta)}</span>`
  )).join("")}</div>`;
}

function populationState(change: LineageChange): string {
  if (!change.abundance || !change.energy) return "";
  const abundance = Math.round(change.abundance.after * 100);
  const energy = Math.round(change.energy.after * 100);
  return `<div class="lineage-population"><span>population ${abundance}%</span><span>energy ${energy}%</span></div>`;
}

/**
 * Synthetic `${identity}:0` slots from `createLineageHistory` stay out of the
 * report until a raft actually seeds them. Identity names are not hardcoded —
 * a new founder family should not reappear as a vacant row.
 */
function isVacantRootSlot(change: LineageChange): boolean {
  if (change.parentId || change.event) return false;
  if (change.status !== "not-established") return false;
  if (change.abundance || change.energy || change.habitat || change.traits) return false;
  return change.id === `${change.identity}:0`;
}

export function shouldShowLineageChange(change: LineageChange): boolean {
  return !isVacantRootSlot(change);
}

function syntheticLineageChange(population: PopulationOutcome): LineageChange {
  return {
    id: population.id,
    identity: population.identity,
    previousStatus: population.status,
    status: population.status,
    moved: 0,
    ...(population.status === "active" ? { event: "established" as const } : {}),
  };
}

export function populationDisplayName(change: LineageChange, changes: readonly LineageChange[]): string {
  const archetype = populationArchetype(change.identity);
  if (change.parentId) return `Descendant ${change.id.split("/").at(-1)}`;
  const identityRoots = changes.filter((entry) => !entry.parentId && entry.identity === change.identity);
  const featuredRoot = identityRoots.find((entry) => entry.status === "active")
    ?? identityRoots.find((entry) => entry.event === "established");
  if (featuredRoot?.id === change.id) return archetype.label;
  const ordinal = change.id.split(":")[1]?.split("/")[0];
  return ordinal && ordinal !== "0" ? `${archetype.label} ${ordinal}` : `${archetype.label} (vacant)`;
}

function lineageDepth(change: LineageChange, byId: ReadonlyMap<string, LineageChange>): number {
  let depth = 0;
  let parentId = change.parentId;
  const visited = new Set<string>([change.id]);
  while (parentId && byId.has(parentId) && !visited.has(parentId)) {
    visited.add(parentId);
    depth++;
    parentId = byId.get(parentId)?.parentId;
  }
  return depth;
}

export interface LineageFocusSite {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly island?: string;
}

export type LineageGotoSites = ReadonlyMap<string, LineageFocusSite>;

function isLineageGoto(
  change: LineageChange,
  gotoSites?: LineageGotoSites,
  populations?: readonly PopulationOutcome[],
): boolean {
  if (gotoSites?.has(change.id)) return true;
  const population = populations?.find((entry) => entry.id === change.id);
  return population?.status === "active" && population.visible && population.site !== undefined;
}

function lineageNodeAttrs(
  change: LineageChange,
  gotoSites?: LineageGotoSites,
  populations?: readonly PopulationOutcome[],
): string {
  const attrs = [`data-lineage-id="${escapeHtml(change.id)}"`];
  if (isLineageGoto(change, gotoSites, populations)) {
    attrs.push('role="button"', 'tabindex="0"');
  }
  return attrs.join(" ");
}

export function buildLineageReportHtml(
  changes: readonly LineageChange[],
  traitDistance?: number,
  gotoSites?: LineageGotoSites,
  populations?: readonly PopulationOutcome[],
): string {
  const visible = changes.filter(shouldShowLineageChange);
  const visibleIds = new Set(visible.map((change) => change.id));
  for (const population of populations ?? []) {
    if (population.status !== "active" || !population.visible || visibleIds.has(population.id)) continue;
    visible.push(syntheticLineageChange(population));
    visibleIds.add(population.id);
  }
  const byId = new Map(visible.map((change) => [change.id, change]));
  const roots = visible.filter((change) => !change.parentId || !byId.has(change.parentId));
  const children = new Map<string, LineageChange[]>();
  for (const change of visible) {
    if (!change.parentId || !byId.has(change.parentId)) continue;
    const siblings = children.get(change.parentId) ?? [];
    siblings.push(change);
    children.set(change.parentId, siblings);
  }
  const ordered: LineageChange[] = [];
  const visit = (change: LineageChange): void => {
    ordered.push(change);
    children.get(change.id)?.forEach(visit);
  };
  roots.forEach(visit);

  const rows = ordered.map((change) => {
    const name = populationDisplayName(change, visible);
    const habitat = habitatLabel(change, gotoSites?.get(change.id)?.island);
    const depth = lineageDepth(change, byId);
    const gotoClass = isLineageGoto(change, gotoSites, populations) ? " lineage-node-goto" : "";
    return `<section class="lineage-node ${escapeHtml(change.status)}${gotoClass}" ${lineageNodeAttrs(change, gotoSites, populations)} style="--depth:${depth}">`
      + `<div class="lineage-heading"><strong>${escapeHtml(name)}</strong>`
      + `<span class="lineage-event ${escapeHtml(change.event ?? change.status)}">${escapeHtml(eventLabel(change))}</span></div>`
      + `<span class="lineage-id">${escapeHtml(change.id)}</span>`
      + (habitat ? `<span class="lineage-habitat">${escapeHtml(habitat)}</span>` : "")
      + populationState(change)
      + strongestTraits(change)
      + `</section>`;
  }).join("");
  const divergence = traitDistance === undefined ? "" : (
    `<footer>founder trait distance <strong>${traitDistance.toFixed(3)}</strong></footer>`
  );
  const canFly = ordered.some((change) => isLineageGoto(change, gotoSites, populations));
  const heading = canFly
    ? `<header><span>Lineage history</span><strong>click to view</strong></header>`
    : `<header><span>Lineage history</span><strong>${visible.length} branches</strong></header>`;
  return `${heading}${rows}${divergence}`;
}
