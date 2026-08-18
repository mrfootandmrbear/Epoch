# WU-M3 — Coastal sea-lion haul-out occupancy

> **Class:** Task. **Authority:** Below `docs/EXECUTION.md`. **Answers:** what this session implements. **Finish:** the Done when list, then stop.

**Model:** local Agent (pixels). Cloud/CI cannot pass the visual gate.
**Size:** large. **Depends on:** WU-M2. **Blocks:** WU-M4.
**Owner visual verdict required.**

Parked water-life program: M1 crab → M2 marine iguana → **M3 sea lion** → M4 urchin → M5 upwelling bird. Do not start this brief in the same session as another family.

---

Work Unit: WU-M3 — Coastal sea-lion haul-out occupancy

**Read first:** `PRODUCT.md`, `docs/EXECUTION.md` item 6, `docs/OCEAN-COLONIZATION-AND-DOMAIN-TRANSITIONS.md` (island-associated residents vs pelagic visitors), `.agents/skills/generate-ecosystem-asset/SKILL.md`, then these files only:

- `src/outcome-resolver.ts` (`marineEnergy.preyAvailability`, aerial/coastal seating patterns from M1–M2)
- `src/landing-state.ts` (life group, occupancy marks)
- `src/marine-lineage.ts` (existing forager — sea lions eat this productivity; do not replace it)
- `assets/ecosystem/epoch-intertidal-crab/` and `assets/ecosystem/epoch-marine-iguana/` (do not overwrite)

Do not explore beyond them. Do not start M4–M5. Do not add a fur-seal family in this unit.

## Why this exists

Splash crabs and marine iguanas occupy the lava. Beaches and surf still have no large mammal silhouette. Sea lions are the Galápagos beach occupancy: they haul out in numbers and hunt the schooling productivity the coastal forager already stands for. Fur seal is a later west-upwelling rocky specialist, not a second package here.

## Design decision this unit implements

**One family: Galápagos sea lion** (`Zalophus wollebaeki`). Package id `epoch-sea-lion`.

- Island-associated resident with beach haul-out plus surf samples — not a whale-shark-style visitor and not a Darwin/Wolf spectacle.
- Scale ~1.5–2.5 m. Overview should read occupied beaches; mid should read barrel body, dog head, external ears, flippers. Idle on sand/rock; locomotion is haul + swim, not a land-iguana walk.
- Bounded traits: mass/condition (upwelling / `preyAvailability`), male sagittal crest, haul-out vs water time. Fur-seal = later discrete “rocky nocturnal west” variant or a later brief, not this task.
- Few large bodies, not a crab-density carpet. Simulation must not import meshes.

## Goal

A reviewer can see sea lions on beaches and in the surf at overview and mid, and can tell them from marine iguanas on lava.

## Tasks

1. Author `assets/ecosystem/epoch-sea-lion/` through the asset skill gates to `candidate`. Do not self-accept.
2. Seat haul-out samples on sand or low rock above sea level facing productive water; optional surf samples in the shallows. Do not sit them on M1 crab ledges as a default.
3. Abundance tracks `preyAvailability` / shoreline subsidy. Warm-starved landings should thin the haul-out, not spawn a second species.
4. Run `npm run asset:check -- assets/ecosystem/epoch-sea-lion`.

## Done when

- Beaches on a productive coastal landing read as haul-outs at overview; mid shows sea-lion bodies, not generic blobs.
- Crabs, marine iguanas, and coastal-forager fish remain distinct.
- Orthographic previews plus landing showcase exist; `idle` and locomotion required.
- `npm test`, `npx tsc --noEmit`, and `npm run build` pass.
- Package stage is `candidate` with empty `acceptance.verdict`.

## Explicitly not the goal

Fur seal as a second family, hammerheads, dolphins, turtles, penguin, urchin, or replacing generic aerial birds.

## Hard constraints

- Simulation must not import meshes.
- Do not edit existing `GOLDEN_SHOTS` or existing capture sets. Add a haul-out shot if needed.
- Do not claim fps. Owner look on real WebGPU.

**End with:** test, typecheck, build, asset check, capture URLs, and an EXECUTION note that sea-lion occupancy is at candidate (not accepted).

**This unit needs an owner visual verdict.** One question: "Do these read as Galápagos sea lions hauling out on beaches, not iguanas and not fur seals?"
