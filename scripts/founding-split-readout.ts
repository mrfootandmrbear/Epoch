/**
 * Renderer-independent readout of what `?founders=drifter&plume=active&
 * years=1000000&jumps=N` actually does in main.ts's `start()`: the default
 * weathered-island world, a placed active plume, a Distant Drifter founder
 * introduced at year 0, then N uniform jumps — the same shipping pipeline
 * `gene-flow-readout.ts` exercises, just entered through the Distant Drifter
 * rather than the two always-present starting lineages.
 *
 * **This corrects a same-day mistake, not a hypothesis.** An earlier version
 * of this script (and the `foundingSplit2km` capture set built on its output)
 * called `captureWorldSnapshot` without forage/nutrient/runoff/basalt sampler
 * functions, silently defaulting to a *constant* forage of 1 everywhere. That
 * made the founder look thriving in the readout. Direct `console.log`
 * instrumentation of the real running app (not this script) showed the
 * founder going extinct on jump 1 under the exact same URL — the "branched
 * herd" visible in that session's browser screenshots was misread; nothing
 * was actually alive. This version samples the real fields the way
 * `currentSnapshot()` in `landing-state.ts` does (bilinear over
 * `worldHistory.terrain.forage` etc.), and reproduces the extinction:
 * `founderFit.foodAvailability` at the best site `foundingSite` can find is
 * ~0.49-0.53, well under what `resolveFounderEstablishment` needs, and the
 * founder's starting abundance (0.018) is too thin a buffer to survive the
 * shortfall at any jump length tried — a swept check across all 60
 * `FounderChoices` combinations found none that survive a single
 * 1,000,000-year jump from year 0, and neither does a "ratchet" of many
 * short jumps (a 1-year jump makes zero adaptation progress at all, since
 * `traitAdaptationRate(1) === 0`; anything long enough to move adaptation
 * also costs more abundance than the founder has).
 *
 * **Open question, not resolved here.** Is this the intended difficulty of
 * the Distant Drifter (a founder that fails under most conditions and needs
 * a deliberately prepared site), a genuine balance gap in
 * `founder-establishment.ts`, or a missing warm-up step the real UI expects
 * a player to take that capture mode does not reproduce? Confirming a
 * capture path to an actual established-and-branched population needs that
 * answered first — see `docs/polish/LOG.md`, 2026-08-15 "Correction".
 *
 *   node --import ./scripts/ts-resolve.mjs scripts/founding-split-readout.ts
 */

import { resolveVolcanicAccretion, type PlumeVigor } from "../src/volcanism";
import { advanceArchipelago, resolveShieldVents } from "../src/archipelago-history";
import { DEFAULT_CLIMATE, SEA_LEVEL } from "../src/climate";
import { createDrifterFounderHistory } from "../src/lineage-history";
import { DEFAULT_FOUNDER_CHOICES } from "../src/founder-profile";
import { islandAt, resolveIslandGeography } from "../src/island-geography";
import { RENDER_SCALE } from "../src/render-scale";
import { startingWorldPreset } from "../src/starting-world-presets";
import { resolveTerrainHistory, type TerrainHistory } from "../src/terrain-history";
import { createWorldHistory, seedStartingPlume, withRecordedSeaLevel } from "../src/world-history";
import { captureWorldSnapshot } from "../src/world-snapshot";
import { resolveLanding } from "../src/outcome-resolver";

const SIDE = 401;
const EXTENT = RENDER_SCALE.islandExtent;
const JUMPS = 5;
const JUMP_YEARS = 1_000_000;
const VIGOR: PlumeVigor = "active";

const step = EXTENT / (SIDE - 1);
const half = EXTENT / 2;

/** Bilinear sample, matching `terrainFieldAt` in `landing-state.ts` exactly. */
function bilinear(field: Float32Array, side: number, x: number, z: number): number {
  const gx = Math.max(0, Math.min(side - 1, (x + half) / step));
  const gz = Math.max(0, Math.min(side - 1, (z + half) / step));
  const x0 = Math.floor(gx), z0 = Math.floor(gz);
  const x1 = Math.min(side - 1, x0 + 1), z1 = Math.min(side - 1, z0 + 1);
  const tx = gx - x0, tz = gz - z0;
  const a = field[z0 * side + x0]!, b = field[z0 * side + x1]!;
  const c = field[z1 * side + x0]!, d = field[z1 * side + x1]!;
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * tz;
}

const preset = startingWorldPreset("weathered-island");
const elevations = new Float32Array(SIDE * SIDE);
for (let z = 0; z < SIDE; z++) {
  for (let x = 0; x < SIDE; x++) {
    elevations[z * SIDE + x] = preset.heightAt(x * step - half, z * step - half);
  }
}

let history = createWorldHistory(elevations, SIDE, EXTENT, false);
function heightAt(x: number, z: number): number { return bilinear(history.terrain.elevations, SIDE, x, z); }

// Mirror `landingState.placePlume(new Vector3(0, 0, 0), { x: 1, z: 0 }, "active")`.
const seaLevel0 = SEA_LEVEL[DEFAULT_CLIMATE.seaLevel];
const built = heightAt(0, 0) > seaLevel0;
history = { ...history, archipelago: seedStartingPlume({ x: 0, z: 0, driftX: 1, driftZ: 0, vigor: VIGOR, built }) };
console.log(`placePlume: built=${built} (island height at hotspot = ${heightAt(0, 0).toFixed(1)} m)`);

// Mirror `founders=drifter` → `introduceDistantDrifter(0, DEFAULT_FOUNDER_CHOICES)`.
const founders = createDrifterFounderHistory(0, 0, DEFAULT_FOUNDER_CHOICES);
history = { ...history, lineages: { lineages: [...history.lineages.lineages, ...founders.lineages] } };

console.log(`${SIDE}² grid over ${EXTENT} m · ${JUMPS} × ${JUMP_YEARS.toLocaleString()} yr · climate = present/default\n`);

let totalYears = 0;
for (let jump = 1; jump <= JUMPS; jump++) {
  const before = totalYears;
  totalYears += JUMP_YEARS;
  const climate = DEFAULT_CLIMATE;
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

  const t: TerrainHistory = history.terrain;
  const snapshot = captureWorldSnapshot(
    heightAt, totalYears, climate, SIDE, EXTENT,
    (x, z) => bilinear(t.forage, SIDE, x, z),
    (x, z) => bilinear(t.nutrients, SIDE, x, z),
    (x, z) => bilinear(t.runoff, SIDE, x, z),
    t.marineNutrients,
    (x, z) => bilinear(t.basalt, SIDE, x, z),
    (x, z) => bilinear(t.substrateAge, SIDE, x, z),
    (x, z) => bilinear(t.sediment, SIDE, x, z),
    (x, z) => bilinear(t.carbonate, SIDE, x, z),
  );
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
  console.log(`after jump ${jump} (${totalYears.toLocaleString()} yr)`);
  console.log(`  islands  ${islands || "none"}`);
  for (const lineage of resolution.nextHistory.lineages) {
    const island = lineage.site ? islandAt(geography, lineage.site.x, lineage.site.z) ?? "water" : "—";
    const change = resolution.changes.find((c) => c.id === lineage.id);
    const tags = [
      `status ${lineage.status}`,
      `on ${island}`,
      change?.event ? change.event : "",
      lineage.origin ? `isolated by ${lineage.origin.basis} @ ${lineage.origin.isolatedSinceYear.toLocaleString()} yr` : "",
      `abundance ${(lineage.abundance ?? 0).toFixed(3)}`,
      `energy ${(lineage.energy ?? 0).toFixed(3)}`,
    ].filter(Boolean).join(" · ");
    console.log(`  ${lineage.id.padEnd(22)} ${tags}`);
  }
  console.log("");
  if (resolution.nextHistory.lineages.every((l) => l.status === "extinct")) {
    console.log(">>> every lineage extinct; stopping <<<");
    break;
  }
}
