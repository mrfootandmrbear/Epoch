# WU-M2 — Marine iguana family (sister to the land founder)

> **Class:** Task. **Authority:** Below `docs/EXECUTION.md`. **Answers:** what this session implements. **Finish:** the Done when list, then stop.

**Model:** local Agent (pixels). Cloud/CI cannot pass the visual gate.
**Size:** large. **Depends on:** WU-M1. **Blocks:** WU-M3.
**Owner visual verdict required.**

Parked water-life program: M1 crab → **M2 marine iguana** → M3 sea lion → M4 urchin → M5 upwelling bird. Do not start this brief in the same session as another family.

---

Work Unit: WU-M2 — Marine iguana family

**Read first:** `PRODUCT.md`, `docs/EXECUTION.md` item 6, `.agents/skills/generate-ecosystem-asset/SKILL.md`, then these files only:

- `assets/ecosystem/galapagos-land-iguana/` (sister grammar to *match visually*, not overwrite)
- `src/marine-lineage.ts` (`originDomain: "terrestrial-transition"`, `ancestorLineageId`)
- `src/world-history.ts` (cross-domain marine ancestry validation)
- `src/outcome-resolver.ts` / `src/landing-state.ts` (how M1 seated splash life; land-iguana herd path)
- `src/population-traits.ts` / `src/creature-expression-spike.ts` (land founder channels — do not retune them)

Do not explore beyond them. Do not start M3–M5. Do not replace the land-iguana package.

## Why this exists

The land founder is an accepted Galápagos land iguana. The water half of that inheritance — the only seagoing lizard — is missing. Splash crabs (M1) occupy color on lava; they are not the large shoreline grazer. `originDomain: "terrestrial-transition"` already exists on marine lineage state and is unused as a visible family.

## Design decision this unit implements

**One family: marine iguana** (`Amblyrhynchus cristatus`). Package id `epoch-marine-iguana`.

- New package. Shared crest / dewlap / blunt-head grammar with `galapagos-land-iguana`, **ochre is not the marine palette**. Marine charcoal, white salt face, **laterally flattened swim tail**. Not a recolor of the land export.
- Scale ~0.4–1.4 m (island dwarfs vs productive-coast giants). Idle and walk on lava; swim in the shallows. Do not rotate the land-iguana walk cycle into water.
- Use `terrestrial-transition` origin and record `ancestorLineageId` when a marine branch is tied to terrestrial history. Do not invent a second land family or overwrite land-iguana morphs, palette, or proof herds.
- Bounded traits: tail flatness, body size (island area / coastal productivity), darkness, dive/thermal. One upwelling axis: cold-productive vs warm-starved. No year-by-year ENSO.
- Populations persist; rendered bodies are landing samples. Simulation must not import meshes.

## Goal

A reviewer can tell marine iguana from land iguana at shoreline mid, still read them as one iguana ancestry, and see flattened tails and dark hide as the water adaptation.

## Tasks

1. Author `assets/ecosystem/epoch-marine-iguana/` through the asset skill gates to `candidate`. Do not self-accept.
2. Seat basking samples on splash lava (same intertidal band as M1 crabs, larger bodies, fewer instances). Optional shallow-water graze samples below the waterline — not midwater fish sites.
3. If a persistent marine lineage is required for the transition record, keep it a bounded second marine family; do not replace `coastal-forager:0`.
4. Run `npm run asset:check -- assets/ecosystem/epoch-marine-iguana`.

## Done when

- Shoreline mid shows dark flattened-tail iguanas on lava, distinct from land-iguana herds inland and from M1 crabs.
- Land-iguana proof path is unchanged.
- Orthographic previews plus landing showcase exist; `idle` and `walk` required; `swim` required if underwater samples are shown.
- `npm test`, `npx tsc --noEmit`, and `npm run build` pass.
- Package stage is `candidate` with empty `acceptance.verdict`.

## Explicitly not the goal

Sea lion, urchin, penguin, retuning land-iguana traits, a fantasy swim-dragon, or treating marine iguana as extra coastal-forager fish.

## Hard constraints

- Simulation must not import meshes.
- Do not edit existing `GOLDEN_SHOTS` or existing capture sets. Add a marine-iguana shot if needed.
- Do not claim fps. Owner look on real WebGPU.
- Do not mark the package accepted without an owner verdict.

**End with:** test, typecheck, build, asset check, capture URLs, and an EXECUTION note that the marine-iguana family is at candidate (not accepted).

**This unit needs an owner visual verdict.** One question: "Do these read as Galápagos marine iguanas — sister to the land founder, flattened swim tail, not a recolor?"
