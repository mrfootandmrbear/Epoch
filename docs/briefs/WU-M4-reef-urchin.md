# WU-M4 — Benthic urchin carpet and reef graze pressure

> **Class:** Task. **Authority:** Below `docs/EXECUTION.md`. **Answers:** what this session implements. **Finish:** the Done when list, then stop.

**Model:** local Agent (pixels). Cloud/CI cannot pass the visual gate.
**Size:** medium. **Depends on:** WU-M3. **Blocks:** WU-M5.
**Owner visual verdict required.**

Parked water-life program: M1 crab → M2 marine iguana → M3 sea lion → **M4 urchin** → M5 upwelling bird. Do not start this brief in the same session as another family.

---

Work Unit: WU-M4 — Benthic urchin carpet and reef graze pressure

**Read first:** `PRODUCT.md`, `docs/EXECUTION.md` item 6, `docs/OCEAN-COLONIZATION-AND-DOMAIN-TRANSITIONS.md` (benthic grazers; `grazingPressure`), `.agents/skills/generate-ecosystem-asset/SKILL.md`, then these files only:

- `src/reef-succession.ts` (`habitat.shelter` / `productivity`; colony cover)
- `src/outcome-resolver.ts` (`marineEnergy`, reef signal into landing)
- `src/marine-energy.test.ts` / `src/reef-succession.test.ts`
- `src/water-volume.ts` (`benthic` sites)
- `assets/ecosystem/epoch-reef-builder-family/` (do not replace coral)

Do not explore beyond them. Do not start M5. Do not add hogfish, parrotfish, or a second fish family.

## Why this exists

Coral and seagrass occupy structure; the rock under them is still empty. Pencil and green urchins are the Galápagos benthic grazer: they carpet shallow rock, hide in rubble, and can make barrens. Reef-edge “more” from WU-5 is occupancy and graze, not water-surface polish. The ocean contract’s first pressure loop is crab → **urchin/grazer** → eel; eels wait.

## Design decision this unit implements

**One family: reef urchin** (`Eucidaris galapagensis` pencil urchin as endemic referent; `Lytechinus semituberculatus` as spine-shape / graze-intensity morph). Package id `epoch-pencil-urchin`.

- Guild occupancy on **benthic rock / reef / rubble**, 0.05–0.15 m. Dense instancing, slow or idle motion — not a swimming fish.
- Write a coarse `grazingPressure` (or equivalent named field) consumed by reef succession or `marineEnergy` before it earns extra persistent lineage state. More urchins → more barren/bioerosion risk, less reef volume. Do not invent a new biome.
- Bounded traits: spine thickness (pencil vs needle), graze intensity / barren-making, nocturnal exposure. Green urchin is a morph in this family, not a second package.
- Aggregate guild is enough unless ancestry is required for a later reveal.

## Goal

A reviewer inspecting the reef shelf sees a spiny carpet on rock, and a high-graze landing reads less coral cover than a low-graze landing with the same reef history inputs otherwise held equal.

## Tasks

1. Author `assets/ecosystem/epoch-pencil-urchin/` through the asset skill gates to `candidate`. Do not self-accept.
2. Seat benthic samples on stable shallow substrate from `buildWaterVolume` benthic sites / reef sites — not splash lava (M1) and not midwater.
3. Thread graze pressure into reef cover or `marineEnergy` with deterministic tests. Named producer and named consumer; no unexplained habitat score.
4. Run `npm run asset:check -- assets/ecosystem/epoch-pencil-urchin`.

## Done when

- Shallow reef/rock at mid/near shows an urchin carpet distinct from coral colonies and seagrass.
- Tests show graze pressure changes a reef or marine-energy outcome.
- Orthographic previews plus landing showcase exist.
- `npm test`, `npx tsc --noEmit`, and `npm run build` pass.
- Package stage is `candidate` with empty `acceptance.verdict`.

## Explicitly not the goal

Eels, octopus, parrotfish, water-surface polish, replacing coral, or M5 birds.

## Hard constraints

- Simulation must not import meshes.
- Do not edit existing `GOLDEN_SHOTS` or existing capture sets. Add a reef-urchin shot if needed.
- Do not claim fps. Owner look on real WebGPU.

**End with:** test, typecheck, build, asset check, capture URLs, and an EXECUTION note that the urchin carpet is at candidate (not accepted).

**This unit needs an owner visual verdict.** One question: "Does the reef floor read as a Galápagos urchin carpet, and does heavier graze thin the coral?"
