# WU-M1 — Intertidal crab occupancy on splash lava

> **Class:** Task. **Authority:** Below `docs/EXECUTION.md`. **Answers:** what this session implements. **Finish:** the Done when list, then stop.

**Model:** local Agent (pixels). Cloud/CI cannot pass the visual gate.
**Size:** medium. **Depends on:** WU-7 owner look. **Blocks:** WU-M2.
**Owner visual verdict required.**

Parked water-life program (one family per session): **M1 crab** → M2 marine iguana → M3 sea lion → M4 urchin → M5 upwelling bird.

---

Work Unit: WU-M1 — Intertidal crab occupancy on splash lava

**Read first:** `PRODUCT.md`, `docs/EXECUTION.md` item 6, `docs/OCEAN-COLONIZATION-AND-DOMAIN-TRANSITIONS.md` (crab as first resident; guild occupancy before a catalogue), `.agents/skills/generate-ecosystem-asset/SKILL.md`, then these files only:

- `src/outcome-resolver.ts` (`coastalAnimals`, `MarineEnergyExchange.shorelineSubsidy`, `sampleEcosystem`)
- `src/fish-renderer.ts` / `src/fish-renderer.test.ts` (`setPopulation` currently instances fish from `coastalAnimals`)
- `src/landing-state.ts` (fish wiring around `outcome.coastalAnimals`)
- `src/environment.ts` (`intertidal` habitat label)
- `assets/ecosystem/epoch-coastal-forager/` (do not replace)

Do not explore beyond them. Do not start M2–M5, water-surface polish, or a second fish family.

## Why this exists

The shoreline the player looks at first is black lava with no splash life. `coastalAnimals` is not crabs: the resolver emits extra positions around the marine-forager site, and the fish renderer instances them as more fish. `shorelineSubsidy` is already computed and unused by a consumer. The ocean-colonization contract names a coastal crab/scavenger as the first island-associated resident.

## Design decision this unit implements

**One family: rocky-shore crab** (`Grapsus grapsus` / Sally Lightfoot as referent). Package id `epoch-intertidal-crab`.

- Guild occupancy, not a full lineage history. Abundance and energy from `shorelineSubsidy` and `coastalProductivity`. No new fish traits. No gene-flow exam.
- Seat samples on **wet lava within ~1 m of sea level**, high coastal productivity, not water-volume nodes and not the marine-forager site.
- Stop feeding `coastalAnimals` into the fish renderer. Fish keep sampling from the marine population / water column. Crab seats are a distinct outcome field (rename or split `coastalAnimals`; do not leave crabs in the water as extra fish).
- Bounded visible traits: body size, adult redness vs juvenile cryptic, wetness/agility. Ghost crab and mangrove fiddler are later families, not this rig.
- New renderer for small instanced crabs. Simulation must not import meshes.

## Goal

A reviewer who knows Galápagos rocky shores can see bright crabs on black splash lava at shoreline mid, and can tell them from the existing coastal-forager fish.

## Tasks

1. Author `assets/ecosystem/epoch-intertidal-crab/` through the asset skill gates: brief → source → preview → candidate. Stop at candidate; do not self-accept. Foxel is preferred; a deterministic topology generator is allowed only if InstancedMesh morphs require it (same justification as the land iguana).
2. Resolve intertidal seats from terrain + sea level + `coastalProductivity` / `shorelineSubsidy`. Deterministic tests for: seats on lava not open water; count tracks subsidy; fish samples no longer equal crab seats.
3. Wire a crab renderer in landing-state. Decouple `fish.setPopulation` from crab seats so the forager still appears when crabs do.
4. Run `npm run asset:check -- assets/ecosystem/epoch-intertidal-crab`.

## Done when

- Shoreline mid on a coastal landing shows crabs on wet rock, not extra fish clones at the forager site.
- Fish still render from the marine lineage in the water column.
- Orthographic previews (`front`, `side`, `top`, `game-distance`) plus one landing showcase exist on the package.
- `npm test`, `npx tsc --noEmit`, and `npm run build` pass.
- Package stage is `candidate` with empty `acceptance.verdict`.

## Explicitly not the goal

Marine iguana, sea lion, urchin, penguin, ghost/fiddler crabs, FFT/water polish, a second fusiform fish, persistent crab lineage ancestry, or reef-edge “more” as surface composition.

## Hard constraints

- Simulation must not import meshes. Do not add renderer types to resolvers.
- Do not edit existing `GOLDEN_SHOTS` or existing capture sets. Add a shoreline-crab shot if owner evidence is needed.
- Do not claim fps. Ask for an owner still-frame and motion look on real WebGPU.
- One world unit is one metre. Carapace is centimetre-scale (~0.05–0.08 m); do not inflate crabs to read at overview.

**End with:** test, typecheck, build, asset check, capture URLs for the owner, and a short `docs/EXECUTION.md` note that splash-crab occupancy is at candidate (not accepted).

**This unit needs an owner visual verdict.** One question: "Do these read as Sally Lightfoot crabs on Galápagos splash lava, distinct from the coastal fish?"
