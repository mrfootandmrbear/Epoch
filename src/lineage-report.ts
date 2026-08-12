import type { LineageChange } from "./lineage-history";
import { populationArchetype } from "./population-archetypes";
import { POPULATION_TRAIT_KEYS, type PopulationTraits } from "./population-traits";

const TRAIT_LABELS = {
  bodyMass: "mass",
  legLength: "legs",
  footWidth: "feet",
  insulation: "insulation",
  coatLightness: "coat lightness",
  coatWarmth: "coat warmth",
  hornLength: "horns",
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

function habitatLabel(change: LineageChange): string | undefined {
  const habitat = change.habitat;
  if (!habitat) return undefined;
  const moisture = habitat.moisture > 0.68 ? "wet" : habitat.moisture < 0.35 ? "dry" : "temperate";
  const terrain = habitat.slope > 0.7 ? "steep" : habitat.exposure > 0.58 ? "exposed" : "sheltered";
  return `${moisture} · ${terrain}`;
}

function eventLabel(change: LineageChange): string {
  if (change.event === "speciated") return `new branch · ${change.moved.toFixed(0)}m isolated`;
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

export function buildLineageReportHtml(
  changes: readonly LineageChange[],
  traitDistance?: number,
): string {
  const byId = new Map(changes.map((change) => [change.id, change]));
  const roots = changes.filter((change) => !change.parentId || !byId.has(change.parentId));
  const children = new Map<string, LineageChange[]>();
  for (const change of changes) {
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
    const archetype = populationArchetype(change.identity);
    const isRoot = change.id === `${change.identity}:0`;
    const name = isRoot ? archetype.label : `Descendant ${change.id.split("/").at(-1)}`;
    const habitat = habitatLabel(change);
    const depth = lineageDepth(change, byId);
    return `<section class="lineage-node ${escapeHtml(change.status)}" style="--depth:${depth}">`
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
  return `<header><span>Lineage history</span><strong>${changes.length} branches</strong></header>${rows}${divergence}`;
}
