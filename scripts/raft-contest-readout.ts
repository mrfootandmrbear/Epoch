/**
 * WU-A2 evidence script — the same `DEFAULT_FOUNDER_CHOICES` founder, run
 * through the real `resolveLanding` pipeline (`outcome-resolver.ts`'s founder
 * path, via `contestedForageAt`), landing on the same small island in two
 * scenarios that differ only in whether an incumbent population already
 * holds it:
 *
 *   - **bare**  — no prior population. The founder's `foundingSite` search
 *     and `resolveFounderEstablishment` run against the raw forage field.
 *   - **saturated** — a first raft (identical choices) already landed one
 *     jump earlier and established with moderate abundance. The second raft
 *     lands nearby (a small island leaves nowhere far enough to fully evade
 *     `separationBonus`'s push, matching the "into a living ecosystem"
 *     scenario `docs/TANGLED-BANK.md` names) and has to read what that
 *     incumbent is already eating.
 *
 * The island is deliberately uniform (flat disc, constant forage) so the
 * *only* difference in the founder's food budget between the two runs is
 * `contestedForageAt`'s pressure term — not some accident of where the site
 * search happened to land. Forage is swept across a range that straddles the
 * establishment threshold so the effect is visible as a status flip, not
 * just a smaller number.
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/raft-contest-readout.ts
 */

import { captureWorldSnapshot } from "../src/world-snapshot";
import { resolveIslandGeography } from "../src/island-geography";
import { resolveLanding } from "../src/outcome-resolver";
import { createDrifterFounderHistory } from "../src/lineage-history";
import { DEFAULT_FOUNDER_CHOICES } from "../src/founder-profile";
import type { LineageHistory } from "../src/lineage-history";
import type { ClimateForces } from "../src/climate";

const PRESENT: ClimateForces = { rainfall: "temperate", temperature: "mild", wind: "westerly", seaLevel: "present" };
const JUMP_YEARS = 1_000_000;
const SIDE = 151;
const EXTENT = 300;
const ISLAND_RADIUS = 25;

/** A small, uniform, flat island: constant elevation inside `ISLAND_RADIUS`, ocean outside. */
function smallUniformIsland(x: number, z: number): number {
  return Math.hypot(x, z) < ISLAND_RADIUS ? 10 : -50;
}

function sampledGrid(heightAt: (x: number, z: number) => number, side: number, extent: number) {
  const elevations = new Float32Array(side * side);
  for (let z = 0; z < side; z++) {
    for (let x = 0; x < side; x++) {
      elevations[z * side + x] = heightAt((x / (side - 1) - 0.5) * extent, (z / (side - 1) - 0.5) * extent);
    }
  }
  return { side, extent, elevations };
}

function runBare(forage: number) {
  const forageAt = () => forage;
  const snapshot = captureWorldSnapshot(smallUniformIsland, JUMP_YEARS, PRESENT, SIDE, EXTENT, forageAt);
  const geography = resolveIslandGeography(sampledGrid(smallUniformIsland, SIDE, EXTENT), 0, []);
  const history: LineageHistory = { lineages: [...createDrifterFounderHistory(0, 0, DEFAULT_FOUNDER_CHOICES).lineages] };
  const resolution = resolveLanding(snapshot, history, JUMP_YEARS, undefined, undefined, geography);
  return resolution.nextHistory.lineages[0]!;
}

function runSaturated(forage: number) {
  const forageAt = () => forage;
  const snapshot = captureWorldSnapshot(smallUniformIsland, JUMP_YEARS, PRESENT, SIDE, EXTENT, forageAt);
  const geography = resolveIslandGeography(sampledGrid(smallUniformIsland, SIDE, EXTENT), 0, []);

  // First raft, one jump earlier, establishes on the bare island.
  const firstRaftHistory: LineageHistory = { lineages: [...createDrifterFounderHistory(0, 0, DEFAULT_FOUNDER_CHOICES).lineages] };
  const afterFirstRaft = resolveLanding(snapshot, firstRaftHistory, JUMP_YEARS, undefined, undefined, geography);
  const incumbent = afterFirstRaft.nextHistory.lineages[0]!;

  // Second raft, identical choices, launched into the now-occupied island.
  const secondRaftHistory: LineageHistory = {
    lineages: [incumbent, ...createDrifterFounderHistory(JUMP_YEARS, 1, DEFAULT_FOUNDER_CHOICES).lineages],
  };
  const resolution = resolveLanding(snapshot, secondRaftHistory, JUMP_YEARS, undefined, undefined, geography);
  return {
    incumbent: resolution.nextHistory.lineages.find((l) => l.id === "sheltered-grazer:0")!,
    arrival: resolution.nextHistory.lineages.find((l) => l.id === "sheltered-grazer:1")!,
  };
}

console.log(`Small uniform island (radius ${ISLAND_RADIUS} m), same DEFAULT_FOUNDER_CHOICES founder, ${JUMP_YEARS.toLocaleString()}-year jump.\n`);
console.log(["forage", "bare status", "bare abundance", "saturated status", "saturated abundance", "incumbent abundance"].join("\t"));

for (const forage of [0.50, 0.55, 0.58, 0.60, 0.62, 0.65, 0.70, 0.80, 0.90]) {
  const bare = runBare(forage);
  const { incumbent, arrival } = runSaturated(forage);
  console.log([
    forage.toFixed(2),
    bare.status,
    (bare.abundance ?? 0).toFixed(4),
    arrival.status,
    (arrival.abundance ?? 0).toFixed(4),
    (incumbent.abundance ?? 0).toFixed(4),
  ].join("\t"));
}

console.log("\n--- headline comparison (forage = 0.62) ---");
const bareHeadline = runBare(0.62);
const satHeadline = runSaturated(0.62);
console.log(`bare island:      status=${bareHeadline.status}  abundance=${(bareHeadline.abundance ?? 0).toFixed(4)}  energy=${(bareHeadline.energy ?? 0).toFixed(4)}`);
console.log(`saturated island: status=${satHeadline.arrival.status}  abundance=${(satHeadline.arrival.abundance ?? 0).toFixed(4)}  energy=${(satHeadline.arrival.energy ?? 0).toFixed(4)}  (incumbent abundance=${(satHeadline.incumbent.abundance ?? 0).toFixed(4)})`);
