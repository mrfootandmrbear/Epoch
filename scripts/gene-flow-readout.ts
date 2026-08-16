/**
 * Renderer-independent readout of the population consumer of island geography.
 *
 * Runs the shipping jump pipeline at the real 2 km extent — advance the
 * archipelago, accrete terrain, record the stand, resolve island geography,
 * then resolve the landing *with* that geography — and prints what the lineages
 * do: which island each stands on, when gene flow homogenizes neighbours, and
 * when a branch is cut loose by isolation (and why). This is the sequence
 * behind `docs/EXECUTION.md` order-of-work item 2.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/gene-flow-readout.ts
 *   node --import ./scripts/ts-resolve.mjs scripts/gene-flow-readout.ts hyperactive 6
 */

import { advanceArchipelago, resolveShieldVents } from "../src/archipelago-history";
import { SEA_LEVEL, type ClimateForces } from "../src/climate";
import { islandAt, resolveIslandGeography } from "../src/island-geography";
import { RENDER_SCALE } from "../src/render-scale";
import { startingWorldPreset } from "../src/starting-world-presets";
import { resolveTerrainHistory } from "../src/terrain-history";
import { createWorldHistory, withRecordedSeaLevel } from "../src/world-history";
import { isPlumeVigor, resolveVolcanicAccretion, type PlumeVigor } from "../src/volcanism";
import { captureWorldSnapshot } from "../src/world-snapshot";
import { resolveLanding } from "../src/outcome-resolver";

const requested = process.argv[2];
const vigor: PlumeVigor = isPlumeVigor(requested) ? requested : "active";

const SIDE = 401;
const EXTENT = RENDER_SCALE.islandExtent;
const JUMPS = Number(process.argv[3] ?? 5);
const JUMP_YEARS = 1_000_000;

// A gently rising then falling sea, so a land bridge has a chance to drown and a
// vicariant split has a chance to be dated, not just a dispersal to a new island.
const climates: ClimateForces[] = [
  { rainfall: "wet", temperature: "warm", wind: "easterly", seaLevel: "present" },
  { rainfall: "wet", temperature: "warm", wind: "easterly", seaLevel: "high" },
  { rainfall: "temperate", temperature: "mild", wind: "westerly", seaLevel: "high" },
  { rainfall: "temperate", temperature: "mild", wind: "westerly", seaLevel: "present" },
  { rainfall: "wet", temperature: "warm", wind: "easterly", seaLevel: "high" },
  { rainfall: "temperate", temperature: "mild", wind: "westerly", seaLevel: "present" },
];

const preset = startingWorldPreset("young-volcano");
const elevations = new Float32Array(SIDE * SIDE);
const step = EXTENT / (SIDE - 1);
const half = EXTENT / 2;
for (let z = 0; z < SIDE; z++) {
  for (let x = 0; x < SIDE; x++) {
    elevations[z * SIDE + x] = preset.heightAt(x * step - half, z * step - half);
  }
}

let history = createWorldHistory(elevations, SIDE, EXTENT, true, { ...preset.plume!, vigor });

function nearestHeight(x: number, z: number): number {
  const clamp = (v: number) => Math.min(SIDE - 1, Math.max(0, Math.round((v + half) / step)));
  return history.terrain.elevations[clamp(z) * SIDE + clamp(x)]!;
}

console.log(`plume: ${vigor} · ${SIDE}² grid over ${EXTENT} m · ${JUMPS} × ${JUMP_YEARS.toLocaleString()} yr`);

let totalYears = 0;
for (let jump = 1; jump <= JUMPS; jump++) {
  const before = totalYears;
  totalYears += JUMP_YEARS;
  const climate = climates[(jump - 1) % climates.length]!;
  const seaLevel = SEA_LEVEL[climate.seaLevel];

  const archipelago = advanceArchipelago(history.archipelago, JUMP_YEARS, before);
  history = withRecordedSeaLevel(
    {
      ...history,
      terrain: resolveVolcanicAccretion(
        resolveTerrainHistory(history.terrain, JUMP_YEARS, climate),
        resolveShieldVents(archipelago, history.archipelago),
        JUMP_YEARS,
        archipelago.plume,
      ),
      archipelago,
    },
    before,
    JUMP_YEARS,
    climate,
  );

  const snapshot = captureWorldSnapshot(nearestHeight, totalYears, climate, SIDE, EXTENT);
  const geography = resolveIslandGeography(
    { side: SIDE, extent: EXTENT, elevations: history.terrain.elevations },
    seaLevel,
    history.archipelago.shields,
  );
  const resolution = resolveLanding(
    snapshot, history.lineages, JUMP_YEARS, history.marineLineages, undefined, geography, history.seaLevelHistory,
  );
  history = { ...history, lineages: resolution.nextHistory, marineLineages: resolution.nextMarineHistory };

  const islands = geography.islands
    .map((i) => `${i.id}[${i.shieldIds.join(",") || "—"}] ${(i.areaSquareMetres / 1e6).toFixed(3)} km²`)
    .join("  ");
  console.log(`\nafter jump ${jump} (${totalYears.toLocaleString()} yr · ${climate.seaLevel} sea)`);
  console.log(`  islands  ${islands || "none"}`);
  for (const lineage of resolution.nextHistory.lineages) {
    if (lineage.status === "not-established") continue;
    const island = lineage.site ? islandAt(geography, lineage.site.x, lineage.site.z) ?? "water" : "—";
    const change = resolution.changes.find((c) => c.id === lineage.id);
    const tags = [
      `on ${island}`,
      change?.event ? change.event : lineage.status,
      lineage.origin ? `isolated by ${lineage.origin.basis} @ ${lineage.origin.isolatedSinceYear.toLocaleString()} yr` : "",
      change?.geneFlow ? `gene-flow −${change.geneFlow.toFixed(3)}` : "",
    ].filter(Boolean).join(" · ");
    console.log(`  ${lineage.id.padEnd(22)} ${tags}`);
  }
}
