# WU-7 — Default volcano world and test landings

> **Class:** Task. **Authority:** Below `docs/EXECUTION.md`. **Answers:** what this session implements. **Finish:** the Done when list, then stop.

**Model:** local Agent. **Size:** medium. **Depends on:** WU-5 visuals recorded. **Blocks:** nothing; owner dispatches next.

---

Work Unit: WU-7 — Default volcano world and test landings

**Read first:** this brief, then these files only:

- `src/starting-world-presets.ts`
- `src/landing-state.ts` (`makeTerrain`, `resetStartingWorld`, `advance`, `placePlume`)
- `src/main.ts` (boot, proof replay, starting-world picker)
- `index.html` (Starting world copy and climate `<option selected>`)
- `src/climate.ts` (`DEFAULT_CLIMATE` — do not change it)

Do not explore beyond them plus the fixture helper this unit adds. Do not retune geology, forage, or founders.

## Why this exists

A fresh session still opens on Weathered island (temperate / mild / westerly, no authored plume). The inhabited work — hotspot chain, herds, proof landings — lives on Young volcano plus `?founders=drifter&jumps=N`. There is no in-shell way to load an inhabited landing.

## Goal

Young volcano is the player’s empty start. A separate Test worlds picker loads Established / Speciated / Diversified on that volcano through the same `advance` path a player jump uses. Existing proof URLs stay pinned to weathered-island + `DEFAULT_CLIMATE` so captures do not silently retune.

## Required shape

- Canonical empty start is `young-volcano`: wet / warm / easterly, active plume already placed.
- Weathered island and Drowned ridges remain other empty starts.
- Do not change `DEFAULT_CLIMATE`.
- Do not mix inhabited landings into `STARTING_WORLD_PRESETS`.
- Test worlds: `resetStartingWorld(young-volcano)`, Distant Drifter, then 2 / 3 / 5 × 1 Myr under the volcano preset’s climate. After load, another jump is allowed.
- Proof URLs without `world=` keep today’s recipe: weathered-island, `placePlume` at the origin, `DEFAULT_CLIMATE`. Optional `world=young-volcano` uses the volcano recipe. Do not rewrite existing `GOLDEN_SHOTS` or `proofGates` queries.

## Done when

- Fresh load (no URL) is Young volcano with matching climate and hotspot.
- Test worlds picker can open Established / Speciated / Diversified with living populations, and the player can jump again from that landing.
- `?founders=drifter&plume=active&years=1000000&jumps=2|3|5` still starts on weathered-island.
- `npm test` and `npx tsc --noEmit` pass.
- If young-volcano test fixtures do not produce the proof’s living-lineage counts (1 / 2 / 3 at jumps 2 / 3 / 5), stop and report. Do not retune the resolver.

## Explicitly not the goal

Causal-exam copy. Water polish. New fauna. Changing `DEFAULT_CLIMATE` or founder choices. Baking herds.

**End with:** EXECUTION note that the player default and test landings are ready for owner look. Say "ready for owner verdict" for pixels; do not call them accepted.
