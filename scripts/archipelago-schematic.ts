/**
 * Draws the archipelago's crust-frame layout across the deep-time ladder as a
 * plain SVG, so the shield spacing and drift rate can be judged by eye before
 * any of it reaches the renderer.
 *
 * This is a simulation readout, not a rendering path — it reads only
 * `archipelago-history.ts` and writes a file.
 *
 *   node scripts/archipelago-schematic.ts [outputPath]
 */
import { writeFileSync } from "node:fs";
import {
  advanceArchipelago,
  createArchipelagoHistory,
  hotspotCrustPosition,
  shieldStage,
  DEFAULT_DRIFT_RATE,
  type ArchipelagoHistory,
} from "../src/archipelago-history.ts";

/** Matches the shield radius `resolveVolcanicAccretion` builds in `volcanism.ts`. */
const SHIELD_RADIUS = 68;
/** `RENDER_SCALE.islandExtent` — the playable terrain grid. */
const ISLAND_EXTENT = 380;

/** Filled in by `render` once the whole sequence is known, so every panel shares one scale. */
const VIEW = { minX: -400, minZ: -280, size: 560 };
const PANEL = 300;
const GAP = 26;
const LABEL = 34;
const COLUMNS = 3;

const STAGE_FILL: Record<string, string> = {
  nascent: "#d1603d",
  "shield-building": "#c08a3e",
  waning: "#6f7f6a",
  extinct: "#5a6472",
};

function toPanelX(worldX: number): number {
  return ((worldX - VIEW.minX) / VIEW.size) * PANEL;
}

function toPanelZ(worldZ: number): number {
  return ((worldZ - VIEW.minZ) / VIEW.size) * PANEL;
}

function scale(meters: number): number {
  return (meters / VIEW.size) * PANEL;
}

function panel(history: ArchipelagoHistory, caption: string, elapsed: number, index: number): string {
  const parts: string[] = [];
  parts.push(`<rect x="0" y="0" width="${PANEL}" height="${PANEL}" fill="#0f1a24" stroke="#2b3a48"/>`);

  // Playable terrain grid, so it is obvious when the chain outgrows it.
  const gridX = toPanelX(-ISLAND_EXTENT / 2);
  const gridZ = toPanelZ(-ISLAND_EXTENT / 2);
  parts.push(
    `<rect x="${gridX.toFixed(1)}" y="${gridZ.toFixed(1)}" width="${scale(ISLAND_EXTENT).toFixed(1)}" ` +
    `height="${scale(ISLAND_EXTENT).toFixed(1)}" fill="#14283a" stroke="#3d5a72" stroke-dasharray="4 3"/>`,
  );

  for (const shield of history.shields) {
    const cx = toPanelX(shield.crustX);
    const cz = toPanelZ(shield.crustZ);
    const stage = shieldStage(history, shield);
    const fill = STAGE_FILL[stage] ?? "#5a6472";
    const opacity = (0.22 + shield.construction * 0.55).toFixed(2);
    parts.push(
      `<circle cx="${cx.toFixed(1)}" cy="${cz.toFixed(1)}" r="${scale(SHIELD_RADIUS).toFixed(1)}" ` +
      `fill="${fill}" fill-opacity="${opacity}" stroke="${fill}" stroke-width="1.2"/>`,
    );
    parts.push(
      `<text x="${cx.toFixed(1)}" y="${(cz + 3.5).toFixed(1)}" fill="#e8eef4" font-size="9" ` +
      `font-family="ui-monospace,monospace" text-anchor="middle">${shield.id.replace("shield-", "S")}</text>`,
    );
  }

  // The hotspot, drawn where it currently sits in the crust frame.
  const hotspot = hotspotCrustPosition(history);
  const hx = toPanelX(hotspot.x);
  const hz = toPanelZ(hotspot.z);
  parts.push(
    `<circle cx="${hx.toFixed(1)}" cy="${hz.toFixed(1)}" r="5.5" fill="none" stroke="#ff6b4a" stroke-width="2"/>` +
    `<line x1="${(hx - 8).toFixed(1)}" y1="${hz.toFixed(1)}" x2="${(hx + 8).toFixed(1)}" y2="${hz.toFixed(1)}" stroke="#ff6b4a" stroke-width="1.4"/>` +
    `<line x1="${hx.toFixed(1)}" y1="${(hz - 8).toFixed(1)}" x2="${hx.toFixed(1)}" y2="${(hz + 8).toFixed(1)}" stroke="#ff6b4a" stroke-width="1.4"/>`,
  );

  const drift = `${(history.crustOffset).toFixed(1)} m`;
  parts.push(
    `<text x="8" y="${PANEL - 20}" fill="#8fa6b8" font-size="10" font-family="ui-monospace,monospace">` +
    `crust travelled ${drift}</text>`,
    `<text x="8" y="${PANEL - 8}" fill="#8fa6b8" font-size="10" font-family="ui-monospace,monospace">` +
    `${history.shields.length} shield${history.shields.length === 1 ? "" : "s"}</text>`,
  );

  const header =
    `<text x="0" y="-20" fill="#e8eef4" font-size="14" font-family="ui-sans-serif,system-ui" font-weight="600">${caption}</text>` +
    `<text x="0" y="-7" fill="#7d93a6" font-size="10" font-family="ui-monospace,monospace">total ${Math.round(elapsed).toLocaleString()} yr</text>`;

  // Clip to the panel: a chain that has outgrown the view must not bleed into
  // its neighbours and be misread as that panel's own shields.
  return header + `<g clip-path="url(#panel-clip-${index})">${parts.join("")}</g>`;
}

interface Rung {
  readonly caption: string;
  readonly jump: number;
}

const RUNGS: readonly Rung[] = [
  { caption: "World start", jump: 0 },
  { caption: "+ 1,000 years", jump: 1_000 },
  { caption: "+ 100,000 years", jump: 100_000 },
  { caption: "+ 1,000,000 years", jump: 1_000_000 },
  { caption: "+ 1,000,000 more", jump: 1_000_000 },
  { caption: "+ 1,000,000 more", jump: 1_000_000 },
];

/** Resolve every panel's state first, so all panels can share one fitted scale. */
function resolveSequence(): { history: ArchipelagoHistory; caption: string; elapsed: number }[] {
  let history = advanceArchipelago(createArchipelagoHistory(), 1, 0);
  let elapsed = 1;
  return RUNGS.map((rung) => {
    if (rung.jump > 0) {
      history = advanceArchipelago(history, rung.jump, elapsed);
      elapsed += rung.jump;
    }
    return { history, caption: rung.caption, elapsed };
  });
}

function fitView(states: readonly { history: ArchipelagoHistory }[]): void {
  // Always include the playable grid, so the chain can be read against it.
  let minX = -ISLAND_EXTENT / 2;
  let maxX = ISLAND_EXTENT / 2;
  let minZ = -ISLAND_EXTENT / 2;
  let maxZ = ISLAND_EXTENT / 2;
  for (const { history } of states) {
    for (const shield of history.shields) {
      minX = Math.min(minX, shield.crustX - SHIELD_RADIUS);
      maxX = Math.max(maxX, shield.crustX + SHIELD_RADIUS);
      minZ = Math.min(minZ, shield.crustZ - SHIELD_RADIUS);
      maxZ = Math.max(maxZ, shield.crustZ + SHIELD_RADIUS);
    }
  }
  const size = Math.max(maxX - minX, maxZ - minZ) * 1.08;
  VIEW.size = size;
  VIEW.minX = (minX + maxX) / 2 - size / 2;
  VIEW.minZ = (minZ + maxZ) / 2 - size / 2;
}

function render(): string {
  const states = resolveSequence();
  fitView(states);

  const panels: string[] = [];
  const clips: string[] = [];
  states.forEach((state, index) => {
    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const x = column * (PANEL + GAP);
    const y = row * (PANEL + GAP + LABEL) + LABEL;
    clips.push(`<clipPath id="panel-clip-${index}"><rect x="0" y="0" width="${PANEL}" height="${PANEL}"/></clipPath>`);
    panels.push(
      `<g transform="translate(${x},${y})">${panel(state.history, state.caption, state.elapsed, index)}</g>`,
    );
  });

  const rows = Math.ceil(RUNGS.length / COLUMNS);
  const width = COLUMNS * PANEL + (COLUMNS - 1) * GAP;
  const height = rows * (PANEL + GAP + LABEL) + LABEL + 46;

  const legend =
    `<text x="0" y="${height - 26}" fill="#8fa6b8" font-size="11" font-family="ui-sans-serif,system-ui">` +
    `Top-down, crust frame. Dashed box = 380 m playable terrain grid. ` +
    `Circles = shields at ${SHIELD_RADIUS} m radius, brighter = more constructed. ` +
    `Cross = hotspot (fixed in mantle, so it migrates through this frame).</text>` +
    `<text x="0" y="${height - 10}" fill="#8fa6b8" font-size="11" font-family="ui-sans-serif,system-ui">` +
    `Orange = nascent · amber = shield-building · green-grey = waning · slate = extinct. ` +
    `Drift ${DEFAULT_DRIFT_RATE} m/yr.</text>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="#080e14"/>` +
    panels.join("") +
    legend +
    `</svg>`
  );
}

const output = process.argv[2] ?? "archipelago-schematic.svg";
writeFileSync(output, render());
console.log(`wrote ${output}`);
