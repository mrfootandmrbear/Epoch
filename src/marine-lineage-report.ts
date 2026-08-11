import { MARINE_TRAIT_KEYS, type MarineLineageChange } from "./marine-lineage";

const LABELS = {
  bodySize: "size",
  streamlining: "streamlining",
  depthPreference: "depth",
  thermalTolerance: "thermal tolerance",
  maneuverability: "maneuverability",
  depthControl: "depth control",
} as const satisfies Record<(typeof MARINE_TRAIT_KEYS)[number], string>;

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
})[character]!);

export function buildMarineLineageReportHtml(changes: readonly MarineLineageChange[]): string {
  if (changes.length === 0) return "";
  const rows = changes.map((change) => {
    const event = change.status === "extinct" ? "extinct"
      : change.event === "established" ? "established"
        : `moved · ${change.moved.toFixed(0)}u`;
    const habitat = change.habitat
      ? `${change.habitat.band} · ${change.habitat.depth.toFixed(1)}u column · food ${Math.round(change.habitat.food * 100)}% · waves ${Math.round(change.habitat.waveCost * 100)}%`
      : undefined;
    const traits = MARINE_TRAIT_KEYS.flatMap((key) => {
      const trait = change.traits?.[key];
      return trait ? [{ key, delta: trait.after - trait.before }] : [];
    }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
    const traitHtml = traits.length ? `<div class="lineage-traits">${traits.map(({ key, delta }) => (
      `<span>${LABELS[key]} ${delta >= 0 ? "+" : ""}${delta.toFixed(3)}</span>`
    )).join("")}</div>` : "";
    const population = change.abundance && change.energy
      ? `<div class="lineage-population"><span>population ${Math.round(change.abundance.after * 100)}%</span><span>energy ${Math.round(change.energy.after * 100)}%</span></div>`
      : "";
    return `<section class="lineage-node ${escapeHtml(change.status)}" style="--depth:0">`
      + `<div class="lineage-heading"><strong>Coastal forager</strong><span class="lineage-event ${escapeHtml(change.event ?? change.status)}">${escapeHtml(event)}</span></div>`
      + `<span class="lineage-id">${escapeHtml(change.id)}</span>`
      + (habitat ? `<span class="lineage-habitat">${escapeHtml(habitat)}</span>` : "")
      + population + traitHtml + `</section>`;
  }).join("");
  return `<header><span>Marine history</span><strong>${changes.length} lineage</strong></header>${rows}`;
}
