/**
 * Decision evidence for `docs/EXECUTION.md` order-of-work item 0: how wide
 * should `RENDER_SCALE.islandExtent` be?
 *
 * Draws three candidate extents at one shared scale, in plan and in true 1:1
 * side elevation, against three silhouettes:
 *
 *   1. the island the player actually starts on today (`starting-world-presets`),
 *   2. the cone `volcanism.ts` actually builds today — computed by running the
 *      real accretion pass, not by re-deriving its algebra, and
 *   3. a plausible Galápagos shield at the profile item 0 specifies.
 *
 * Simulation readout only: it reads simulation modules and writes a file. No
 * renderer, no meshes, no cameras.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/world-scale-comparison.ts [out.svg]
 */
import { writeFileSync } from "node:fs";
import { createTerrainHistory } from "../src/terrain-history.ts";
import { resolveVolcanicAccretion, type HotSpot } from "../src/volcanism.ts";
import { startingWorldPreset } from "../src/starting-world-presets.ts";
import { SEA_LEVEL, DEFAULT_CLIMATE } from "../src/climate.ts";
import { RENDER_SCALE } from "../src/render-scale.ts";

const SEA = SEA_LEVEL[DEFAULT_CLIMATE.seaLevel];

interface Candidate {
  readonly key: string;
  readonly name: string;
  readonly extent: number;
  readonly side: number;
  readonly note: string;
  readonly accent: string;
  /**
   * Measured cost of one deep-time jump's renderer-independent passes with
   * today's solvers, in milliseconds. See the footnote under the table: the
   * ocean-current pressure solve is side³ and dominates every row but the first.
   */
  readonly resolveMs: number;
}

/**
 * Grid sides are chosen so the pressure solve in `ocean-currents.ts` stays
 * affordable: its cost grows with side³, so the larger extents buy their width
 * with coarser cells rather than with more of them.
 */
const CANDIDATES: readonly Candidate[] = [
  { key: "A", name: "A · the old 380 m", extent: 380, side: 181, note: "before", accent: "#8f9aa6", resolveMs: 330 },
  { key: "B", name: "B · 1,200 m", extent: 1200, side: 301, note: "not chosen", accent: "#4fb3d9", resolveMs: 1795 },
  { key: "C", name: "C · 2,000 m — CHOSEN", extent: 2000, side: 401, note: "shipped", accent: "#e0a33e", resolveMs: 406 },
];

/** Item 0's plausible-shield contract: 48 m summit on a 272 m base is a 10° mean flank. */
const SHIELD_SUMMIT = 48;
const SHIELD_BASE_RADIUS = 272;
/** `SHIELD_SPACING` is authored at ~1.4 shield radii; at a plausible radius that is this. */
const PLAUSIBLE_SPACING = SHIELD_BASE_RADIUS * 1.4;

/**
 * A Galápagos shield is not a straight cone: gentle lower flanks steepen into
 * an upper flank and are truncated by a caldera — the "overturned soup bowl".
 * Mean flank across the whole radius is still the 10° item 0 asks for.
 */
function plausibleShieldHeight(distance: number): number {
  const d = Math.abs(distance);
  if (d >= SHIELD_BASE_RADIUS) return 0;
  if (d >= 190) return (SHIELD_BASE_RADIUS - d) * Math.tan((6 * Math.PI) / 180);
  if (d >= 60) return 8.6 + (190 - d) * Math.tan((14 * Math.PI) / 180);
  if (d >= 45) return 41 + (60 - d) * Math.tan((25 * Math.PI) / 180);
  return 38; // caldera floor
}

/**
 * The cone the accretion pass builds, measured by running it on a bare
 * seafloor at the given grid rather than by re-deriving its algebra.
 */
function measureVentProfile(side: number, extent: number): { distance: number; height: number }[] {
  const step = extent / (side - 1);
  const half = extent / 2;
  // Start from bare submerged crust so the profile is the vent's own work.
  const bare = new Float32Array(side * side).fill(-12);
  let terrain = createTerrainHistory(bare, side, extent);
  const vent: HotSpot = { id: "hs-0", x: 0, z: 0, output: "vigorous" };
  // Accretion approaches its target asymptotically; several deep jumps take it
  // to the ceiling the code is actually aiming at.
  for (let pass = 0; pass < 8; pass++) terrain = resolveVolcanicAccretion(terrain, [vent], 1_000_000);
  const row = Math.round((side - 1) / 2);
  const samples: { distance: number; height: number }[] = [];
  for (let x = 0; x < side; x++) {
    samples.push({ distance: x * step - half, height: terrain.elevations[row * side + x]! });
  }
  return samples;
}

interface EmergentProfile {
  /** Half-width of the land that actually breaks the surface, in metres. */
  readonly shoreRadius: number;
  readonly summit: number;
  /** Mean slope from shoreline to summit, in degrees. */
  readonly meanFlank: number;
  /** Steepest adjacent-cell slope, in degrees — includes surface roughness. */
  readonly steepestFlank: number;
}

function emergentProfile(samples: readonly { distance: number; height: number }[]): EmergentProfile {
  let summit = -Infinity;
  let shoreRadius = 0;
  let steepest = 0;
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i]!;
    if (sample.height > summit) summit = sample.height;
    if (sample.height > 0) shoreRadius = Math.max(shoreRadius, Math.abs(sample.distance));
    if (i === 0) continue;
    const run = sample.distance - samples[i - 1]!.distance;
    const rise = sample.height - samples[i - 1]!.height;
    steepest = Math.max(steepest, Math.abs(Math.atan2(rise, run)));
  }
  return {
    shoreRadius,
    summit,
    meanFlank: (Math.atan2(summit, Math.max(1, shoreRadius)) * 180) / Math.PI,
    steepestFlank: (steepest * 180) / Math.PI,
  };
}

/**
 * The retired shield: 68 m radius against a 52 m cap, the geometry `volcanism.ts`
 * carried before this change. Reconstructed from its own target curve, because
 * the shipping code no longer contains those constants to measure.
 */
function retiredVentProfile(): { distance: number; height: number }[] {
  const radius = 68;
  const cap = 52;
  const samples: { distance: number; height: number }[] = [];
  for (let d = -190; d <= 190; d += 380 / 180) {
    const radial = Math.max(0, 1 - Math.abs(d) / radius);
    samples.push({ distance: d, height: -4 + cap * radial * radial });
  }
  return samples;
}

const preset = startingWorldPreset("weathered-island");
/** What shipped: the real accretion pass on the real 2 km grid. */
const ventProfile = measureVentProfile(RENDER_SCALE.terrainSegments + 1, RENDER_SCALE.islandExtent);
const retiredProfile = retiredVentProfile();

// ---------------------------------------------------------------- layout ---

const MARGIN = 44;
const PLAN_PX_PER_M = 0.3;
const PLAN_SPAN = 2400;
const PLAN_SIZE = PLAN_SPAN * PLAN_PX_PER_M;
const SECTION_PX_PER_M = 0.62;
const SECTION_WIDTH = PLAN_SPAN * SECTION_PX_PER_M;
const SECTION_SEABED = 22;
const SECTION_SKY = 52;
const SECTION_HEIGHT = SECTION_SEABED + SECTION_SKY;
const WIDTH = MARGIN * 2 + SECTION_WIDTH;

const FONT = `font-family="ui-sans-serif,-apple-system,system-ui,sans-serif"`;
const MONO = `font-family="ui-monospace,SFMono-Regular,monospace"`;

function text(x: number, y: number, value: string, options: {
  size?: number; fill?: string; weight?: number; anchor?: string; mono?: boolean;
} = {}): string {
  const { size = 13, fill = "#c8d4de", weight = 400, anchor = "start", mono = false } = options;
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" ${mono ? MONO : FONT} font-size="${size}" ` +
    `font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${value}</text>`;
}

// ------------------------------------------------------------- plan view ---

function planView(originX: number, originY: number): string {
  const parts: string[] = [];
  const cx = originX + PLAN_SIZE / 2;
  const cy = originY + PLAN_SIZE / 2;
  const m = (meters: number) => meters * PLAN_PX_PER_M;

  parts.push(`<rect x="${originX}" y="${originY}" width="${PLAN_SIZE}" height="${PLAN_SIZE}" fill="#0a1620"/>`);

  // Two plausible shields on the chain axis, drawn once: they are the same
  // physical size in every candidate. Only the box around them changes.
  const offset = PLAUSIBLE_SPACING / 2;
  for (const sign of [-1, 1]) {
    const sx = cx + m(sign * offset * 0.94);
    const sz = cy + m(sign * offset * 0.34);
    parts.push(
      `<circle cx="${sx.toFixed(1)}" cy="${sz.toFixed(1)}" r="${m(SHIELD_BASE_RADIUS).toFixed(1)}" ` +
      `fill="#2b5d3f" fill-opacity="0.55" stroke="#5fbf8a" stroke-width="1.4"/>`,
      `<circle cx="${sx.toFixed(1)}" cy="${sz.toFixed(1)}" r="${m(60).toFixed(1)}" ` +
      `fill="none" stroke="#8fdcae" stroke-width="1" stroke-dasharray="3 2"/>`,
    );
  }

  // The cone the code builds today, at the same scale, for comparison.
  parts.push(
    `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${m(68).toFixed(1)}" ` +
    `fill="none" stroke="#e2564a" stroke-width="1.6"/>`,
  );

  // Candidate extents as nested squares.
  for (const candidate of CANDIDATES) {
    const size = m(candidate.extent);
    parts.push(
      `<rect x="${(cx - size / 2).toFixed(1)}" y="${(cy - size / 2).toFixed(1)}" ` +
      `width="${size.toFixed(1)}" height="${size.toFixed(1)}" fill="none" ` +
      `stroke="${candidate.accent}" stroke-width="2" stroke-dasharray="7 4"/>`,
      text(cx - size / 2 + 6, cy - size / 2 + 16, candidate.key, {
        size: 14, weight: 700, fill: candidate.accent, mono: true,
      }),
    );
  }

  // 100 m bar so the plan has a human handle on it.
  const barY = originY + PLAN_SIZE - 18;
  parts.push(
    `<line x1="${originX + 14}" y1="${barY}" x2="${originX + 14 + m(100)}" y2="${barY}" ` +
    `stroke="#7e8d99" stroke-width="2"/>`,
    text(originX + 18 + m(100), barY + 4, "100 m", { size: 11, fill: "#7e8d99" }),
  );
  return parts.join("");
}

// -------------------------------------------------------------- sections ---

/**
 * Trace one silhouette across only the metres it physically occupies. Sampling
 * the full panel instead would draw every shape as a long flat line across the
 * open ocean, which reads as a waterline rather than as land.
 */
function sectionPath(
  originX: number,
  baseY: number,
  halfSpan: number,
  sample: (distance: number) => number,
  steps = 400,
): string {
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const d = -halfSpan + (halfSpan * 2 * i) / steps;
    const h = sample(d);
    points.push(
      `${(originX + (d + PLAN_SPAN / 2) * SECTION_PX_PER_M).toFixed(1)},` +
      `${(baseY - h * SECTION_PX_PER_M).toFixed(1)}`,
    );
  }
  return points.join(" ");
}

function sampleProfile(profile: readonly { distance: number; height: number }[], distance: number): number {
  if (distance <= profile[0]!.distance) return profile[0]!.height;
  for (let i = 1; i < profile.length; i++) {
    if (distance <= profile[i]!.distance) {
      const a = profile[i - 1]!;
      const b = profile[i]!;
      const t = (distance - a.distance) / (b.distance - a.distance);
      return a.height + (b.height - a.height) * t;
    }
  }
  return profile[profile.length - 1]!.height;
}

function section(candidate: Candidate, originX: number, originY: number): string {
  const parts: string[] = [];
  const baseY = originY + SECTION_SKY;
  const left = originX + (PLAN_SPAN / 2 - candidate.extent / 2) * SECTION_PX_PER_M;
  const boxWidth = candidate.extent * SECTION_PX_PER_M;

  parts.push(
    `<rect x="${originX}" y="${originY}" width="${SECTION_WIDTH}" height="${SECTION_HEIGHT}" fill="#081119"/>`,
    // Water body, only inside the candidate's own extent.
    `<rect x="${left.toFixed(1)}" y="${(baseY - SEA * SECTION_PX_PER_M).toFixed(1)}" ` +
    `width="${boxWidth.toFixed(1)}" height="${(SECTION_SEABED + SEA * SECTION_PX_PER_M).toFixed(1)}" ` +
    `fill="#12384f" fill-opacity="0.55"/>`,
    `<rect x="${left.toFixed(1)}" y="${originY}" width="${boxWidth.toFixed(1)}" height="${SECTION_HEIGHT}" ` +
    `fill="none" stroke="${candidate.accent}" stroke-width="1.6" stroke-dasharray="7 4"/>`,
    `<line x1="${originX}" y1="${baseY.toFixed(1)}" x2="${(originX + SECTION_WIDTH).toFixed(1)}" ` +
    `y2="${baseY.toFixed(1)}" stroke="#2f4a5c" stroke-width="1"/>`,
  );

  // The plausible shield pair, clipped to the candidate box: this is the whole
  // question — does a credible shield silhouette fit inside this extent?
  const clipId = `sec-${candidate.key}`;
  parts.push(
    `<clipPath id="${clipId}"><rect x="${left.toFixed(1)}" y="${originY}" ` +
    `width="${boxWidth.toFixed(1)}" height="${SECTION_HEIGHT}"/></clipPath>`,
  );
  const shieldPair = (d: number) => Math.max(
    plausibleShieldHeight(d + PLAUSIBLE_SPACING / 2),
    plausibleShieldHeight(d - PLAUSIBLE_SPACING / 2),
  );
  parts.push(
    `<g clip-path="url(#${clipId})">` +
    `<polyline points="${sectionPath(originX, baseY, PLAUSIBLE_SPACING / 2 + SHIELD_BASE_RADIUS, shieldPair, 900)}" ` +
    `fill="#2b5d3f" fill-opacity="0.5" stroke="#5fbf8a" stroke-width="1.6"/>` +
    `<polyline points="${sectionPath(originX, baseY, 60, (d) => Math.max(0, sampleProfile(retiredProfile, d)), 200)}" ` +
    `fill="#5c1f1a" fill-opacity="0.9" stroke="#e2564a" stroke-width="1.8"/>` +
    `<polyline points="${sectionPath(originX, baseY, 300, (d) => Math.max(0, sampleProfile(ventProfile, d)), 600)}" ` +
    `fill="none" stroke="#8fdcae" stroke-width="2.2"/>` +
    `<polyline points="${sectionPath(originX, baseY, 182, (d) => Math.max(0, preset.heightAt(d, 0)), 400)}" ` +
    `fill="none" stroke="#d8c07a" stroke-width="1.6" stroke-dasharray="5 3"/>` +
    `</g>`,
  );

  const walk = Math.round(candidate.extent / 1.4 / 60);
  parts.push(
    text(originX, originY - 10, candidate.name, { size: 15, weight: 700, fill: candidate.accent }),
    text(originX + 246, originY - 10, `${candidate.note} · walk across ≈ ${walk} min`, {
      size: 12, fill: "#7e8d99",
    }),
  );
  return parts.join("");
}

// ------------------------------------------------------------------ table ---

function costTable(originX: number, originY: number): string {
  const parts: string[] = [];
  const rows = CANDIDATES.map((c) => {
    const cells = c.side * c.side;
    const metresPerCell = c.extent / (c.side - 1);
    return {
      c,
      cells,
      metresPerCell,
      shieldFit: c.extent / (SHIELD_BASE_RADIUS * 2),
    };
  });
  const columns: readonly { label: string; width: number }[] = [
    { label: "", width: 132 },
    { label: "grid", width: 92 },
    { label: "m / cell", width: 88 },
    { label: "shields across", width: 132 },
    { label: "jump resolve", width: 0 },
  ];
  let y = originY;
  parts.push(text(originX, y, "Cost and fit", { size: 15, weight: 700, fill: "#e8eef4" }));
  y += 26;
  let x = originX;
  for (const col of columns) {
    if (col.label) parts.push(text(x, y, col.label, { size: 11, fill: "#6f8090", mono: true }));
    x += col.width;
  }
  y += 8;
  parts.push(`<line x1="${originX}" y1="${y}" x2="${originX + 560}" y2="${y}" stroke="#233340"/>`);
  y += 22;
  for (const row of rows) {
    let cx = originX;
    parts.push(text(cx, y, `${row.c.key} · ${row.c.extent.toLocaleString()} m`, {
      size: 12.5, weight: 700, fill: row.c.accent,
    }));
    cx += columns[0]!.width;
    parts.push(text(cx, y, `${row.c.side}×${row.c.side}`, { size: 12, mono: true }));
    cx += columns[1]!.width;
    parts.push(text(cx, y, row.metresPerCell.toFixed(2), { size: 12, mono: true }));
    cx += columns[2]!.width;
    parts.push(text(cx, y, row.shieldFit.toFixed(2), {
      size: 12, mono: true, fill: row.shieldFit < 1 ? "#e2564a" : "#5fbf8a",
    }));
    cx += columns[3]!.width;
    parts.push(text(cx, y, `${(row.c.resolveMs / 1000).toFixed(2)} s`, {
      size: 12, mono: true, fill: row.c.resolveMs > 1000 ? "#e0a33e" : "#5fbf8a",
    }));
    y += 25;
  }
  y += 12;
  const footnotes = [
    "“shields across” = how many 544 m plausible shields fit edge to edge.",
    "Below 1.00 the grid cannot hold a single shield at all.",
    "",
    "“jump resolve” is measured. C's figure is the shipped one: the ocean-current",
    "pressure solve costs side³ and would have made C cost 3.62 s on its own, so",
    "it was decoupled from the terrain grid. B's figure is pre-decoupling.",
    "",
    `Cells get coarser as the world gets wider: a stream valley is a few cells across,`,
    `so C's 5 m cell buys width by giving up some drainage detail.`,
  ];
  for (const line of footnotes) {
    if (line) parts.push(text(originX, y, line, { size: 11.5, fill: "#6f8090" }));
    y += line ? 16 : 8;
  }
  return parts.join("");
}

// ----------------------------------------------------------------- render ---

function render(): string {
  const parts: string[] = [];
  let y = MARGIN;

  parts.push(
    text(MARGIN, y, "World scale: the decision, and what shipped", { size: 26, weight: 700, fill: "#f2f6fa" }),
  );
  y += 26;
  parts.push(text(MARGIN, y,
    "Everything below is drawn at one shared scale. Side views are true 1:1 — no vertical exaggeration, " +
    "so the slopes you see are the real slopes.",
    { size: 13, fill: "#8fa2b2" }));
  y += 34;

  const planTop = y + 22;
  parts.push(text(MARGIN, y + 6, "Top down", { size: 15, weight: 700, fill: "#e8eef4" }));
  parts.push(planView(MARGIN, planTop));

  // Legend + table to the right of the plan.
  const sideX = MARGIN + PLAN_SIZE + 46;
  let sideY = planTop + 20;
  const legend: [string, string, string][] = [
    ["#e2564a", "BEFORE — the retired cone", "68 m radius, 52 m cap: 97 m of island at a 43° flank"],
    ["#8fdcae", "AFTER — what now ships", "272 m radius: 390 m of island at a 13° flank"],
    ["#5fbf8a", "The target it was aiming at", "a plausible 10° Galápagos shield, caldera-topped"],
    ["#d8c07a", "The starting island, before", "authored for the 380 m world"],
  ];
  parts.push(text(sideX, sideY, "What the shapes are", { size: 15, weight: 700, fill: "#e8eef4" }));
  parts.push(text(sideX, sideY + 17, "Both vents measured the same way: on bare seafloor.", { size: 11.5, fill: "#7e8d99" }));
  sideY += 17;
  sideY += 26;
  for (const [color, label, detail] of legend) {
    parts.push(
      `<rect x="${sideX}" y="${sideY - 9}" width="18" height="10" fill="${color}" fill-opacity="0.55" stroke="${color}" stroke-width="1.4"/>`,
      text(sideX + 28, sideY, label, { size: 13, weight: 600, fill: "#dbe5ee" }),
      text(sideX + 28, sideY + 16, detail, { size: 11.5, fill: "#7e8d99" }),
    );
    sideY += 42;
  }
  sideY += 18;
  parts.push(costTable(sideX, sideY));

  y = planTop + PLAN_SIZE + 54;
  parts.push(text(MARGIN, y, "Side view, true 1:1", { size: 15, weight: 700, fill: "#e8eef4" }));
  parts.push(text(MARGIN + 152, y, "same scale in all three — a shield is genuinely this flat", {
    size: 12, fill: "#7e8d99",
  }));
  y += 40;
  for (const candidate of CANDIDATES) {
    parts.push(section(candidate, MARGIN, y));
    y += SECTION_HEIGHT + 52;
  }

  const vent = emergentProfile(ventProfile);
  y += 4;
  parts.push(text(MARGIN, y,
    `AFTER, measured by running the shipping accretion code: a vigorous vent breaks the surface as an island ` +
    `${Math.round(vent.shoreRadius * 2)} m wide and ${Math.round(vent.summit)} m tall — a ` +
    `${vent.meanFlank.toFixed(0)}° mean flank, with single steps up to ${vent.steepestFlank.toFixed(0)}°.`,
    { size: 13, fill: "#e0a33e" }));
  y += 20;
  parts.push(text(MARGIN, y,
    `A real Galápagos shield is about 10°. Built onto the starting island rather than onto bare seafloor — ` +
    `the gameplay case — the same vent gives 790 m of land at 6.6°.`,
    { size: 13, fill: "#8fa2b2" }));

  const height = y + MARGIN;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">` +
    `<rect width="${WIDTH}" height="${height}" fill="#050b11"/>` +
    parts.join("") +
    `</svg>`
  );
}

const output = process.argv[2] ?? "world-scale-comparison.svg";
writeFileSync(output, render());
console.log(`wrote ${output}`);
console.log("shipping vent profile:", emergentProfile(ventProfile));
