/**
 * Renderer-independent readout of the multi-shield accretion seam.
 *
 * Runs the shipping jump pipeline — advance the archipelago, accrete from the
 * shield chain it produces, weather the result — at the real 2 km extent, and
 * prints what the chain does to the terrain. This is the measurement behind the
 * `chain2km` capture set: the images show one landing, this shows the sequence.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/shield-chain-readout.ts
 *   node --import ./scripts/ts-resolve.mjs scripts/shield-chain-readout.ts hyperactive
 */

import { advanceArchipelago, resolveShieldVents, shieldStage } from "../src/archipelago-history";
import { SEA_LEVEL, type ClimateForces } from "../src/climate";
import { cellIndexAt, resolveIslandGeography } from "../src/island-geography";
import { RENDER_SCALE } from "../src/render-scale";
import { startingWorldPreset } from "../src/starting-world-presets";
import { resolveTerrainHistory } from "../src/terrain-history";
import { createWorldHistory } from "../src/world-history";
import { isPlumeVigor, resolveVolcanicAccretion, type PlumeVigor } from "../src/volcanism";

const requested = process.argv[2];
const vigor: PlumeVigor = isPlumeVigor(requested) ? requested : "active";

const SIDE = 401;
const EXTENT = RENDER_SCALE.islandExtent;
const JUMPS = Number(process.argv[3] ?? 4);
const JUMP_YEARS = 1_000_000;

const climate: ClimateForces = {
  rainfall: "wet",
  temperature: "warm",
  wind: "easterly",
  seaLevel: "present",
};
const seaLevel = SEA_LEVEL[climate.seaLevel];

const preset = startingWorldPreset("young-volcano");
const elevations = new Float32Array(SIDE * SIDE);
const step = EXTENT / (SIDE - 1);
const half = EXTENT / 2;
for (let z = 0; z < SIDE; z++) {
  for (let x = 0; x < SIDE; x++) {
    elevations[z * SIDE + x] = preset.heightAt(x * step - half, z * step - half);
  }
}

let history = createWorldHistory(elevations, SIDE, EXTENT, false, {
  ...preset.plume!,
  vigor,
});

function report(label: string): void {
  const geography = resolveIslandGeography(
    { side: SIDE, extent: EXTENT, elevations: history.terrain.elevations },
    seaLevel,
    history.archipelago.shields,
  );
  const islands = geography.islands
    .map((island) => `${island.id}[${island.shieldIds.join(",") || "—"}] `
      + `${(island.areaSquareMetres / 1e6).toFixed(3)} km² summit ${island.summitElevation.toFixed(1)} m`)
    .join("\n      ");
  const stages = history.archipelago.shields
    .map((shield) => {
      const cell = cellIndexAt(shield.crustX, shield.crustZ, SIDE, EXTENT);
      return `${shield.id}:${shieldStage(history.archipelago, shield)}`
        + `@${shield.construction.toFixed(2)}`
        + ` vent ${history.terrain.elevations[cell]!.toFixed(1)}m`;
    })
    .join("  ");
  const saddles = geography.saddles
    .filter((saddle) => saddle.shieldA < saddle.shieldB)
    .map((saddle) => `${saddle.shieldA}/${saddle.shieldB} ${saddle.elevation.toFixed(1)} m`)
    .join("  ");
  console.log(`\n${label}`);
  console.log(`  shields  ${stages}`);
  console.log(`  islands  ${islands || "none"}`);
  console.log(`  saddles  ${saddles || "none"}`);
}

console.log(`plume: ${vigor} · ${SIDE}² grid over ${EXTENT} m · ${JUMPS} × ${JUMP_YEARS.toLocaleString()} yr`);
report("start");

let totalYears = 0;
let accretionMs = 0;
let archipelagoMs = 0;
for (let jump = 1; jump <= JUMPS; jump++) {
  const before = totalYears;
  totalYears += JUMP_YEARS;

  let mark = performance.now();
  const archipelago = advanceArchipelago(history.archipelago, JUMP_YEARS, before);
  archipelagoMs += performance.now() - mark;

  const weathered = resolveTerrainHistory(history.terrain, JUMP_YEARS, climate);
  mark = performance.now();
  const terrain = resolveVolcanicAccretion(
    weathered,
    resolveShieldVents(archipelago, history.archipelago),
    JUMP_YEARS,
    archipelago.plume,
  );
  accretionMs += performance.now() - mark;

  history = { ...history, terrain, archipelago };
  report(`after jump ${jump} (${totalYears.toLocaleString()} yr)`);
}

console.log(`\ncost across ${JUMPS} jumps: accretion ${accretionMs.toFixed(0)} ms `
  + `(${(accretionMs / JUMPS).toFixed(0)} ms/jump), archipelago ${archipelagoMs.toFixed(0)} ms`);
