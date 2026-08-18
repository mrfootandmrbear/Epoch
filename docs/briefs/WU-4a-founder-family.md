# WU-4a — Galápagos founder family for the proof

> **Class:** Task. **Authority:** Below `docs/EXECUTION.md`. **Answers:** what this session implements. **Finish:** the Done when list, then stop.

**Model:** local Agent (pixels). Cloud/CI cannot pass the visual gate.  
**Size:** large. **Depends on:** EXECUTION items 0–3 (done). **Blocks:** WU-4b, WU-4c, WU-5.  
**Owner visual verdict required.**

---

Work Unit: WU-4a — Galápagos founder family for the proof

**Read first:** `PRODUCT.md` (current product proof), `docs/EXECUTION.md` item 4 and the ecosystem expansion rule, `.agents/skills/generate-ecosystem-asset/SKILL.md`, then these files only:

- `assets/ecosystem/example-marsh-grazer/` (trait-channel contract and accepted draft to *match*, not replace in silence)
- `src/creature-expression-spike.ts`
- `src/creature-material.ts`
- `src/population-traits.ts`
- `src/landing-state.ts` (herd construction around `createLineageRenderState`)
- `src/distant-drifter-renderer.ts` (founders on the raft must stay the same family)

Do not explore beyond them.

## Why this exists

The serialized proof already produces three landings in which a terrestrial founder establishes, then branches across islands. Those populations are still embodied as `example-marsh-grazer` — a capybara/marsh-deer draft. `docs/EXECUTION.md` requires the founder to be a **recognizable present-day Galápagos lineage**, not a generic creature.

The seven sim traits stay: `bodyMass`, `legLength`, `footWidth`, `insulation`, `hornLength`, `coatWarmth`, `coatLightness`. This unit changes what the player *sees*, not how the resolver computes means.

## Design decision this unit implements

**One family: Galápagos land iguana** (`Conolophus` as referent — blunt head, crest, squat herbivore, arid-to-seasonal islands).

- Keep lineage identities (`sheltered-grazer`, `ridge-grazer`) and field names so gene-flow tests stay stable.
- Keep `hornLength` as the sim channel; **express it as a nuchal/dorsal crest**, not mammal horns. Horns on an iguana would be a fantasy variant.
- Shared topology, rig/morph set, and palette family across parent and future branches. Habitat pulls silhouette and coat; ancestry stays obvious.
- New package. Do not overwrite `example-marsh-grazer` or its accepted evidence. Wire the landing and raft renderers at the proof path to the new package; leave the old package on disk.

## Goal

A reviewer who knows Galápagos land iguanas can recognize the founder family at gameplay distance, and can still read the existing trait axes on that body.

## Tasks

1. Author `assets/ecosystem/<new-id>/` through the asset skill gates: brief → source → preview → candidate. Stop at candidate; do not self-accept.
2. Preserve topology-stable morph targets for the five shape channels plus walk pose, so instancing in `creature-expression-spike.ts` keeps working.
3. Map crest height/length to `hornLength`. Map limb, mass, feet, insulation, and coat to the same drivers the marsh-grazer used, with iguana-plausible proportions (still inside a metre-true scale).
4. Point the proof embodiment (`createCreatureExpressionSpike` / landing herds / raft founders) at the new export. Showcase means may be retuned to the new silhouette; do not change resolver trait math.
5. Run `npm run asset:check -- assets/ecosystem/<new-id>`.

## Done when

- The default proof path (`?founders=drifter&plume=active&years=1000000&jumps=2`) shows land-iguana founders, not marsh-grazers.
- Orthographic previews plus one landing showcase exist on the package.
- `hornLength` extremes read as crest, not mammal horns; parent-ready base silhouette is one animal, not two species.
- `npm test`, `npx tsc --noEmit`, and `npm run build` pass.
- Package stage is `candidate` with empty `acceptance.verdict`.

## Explicitly not the goal

Placing the jump-3/jump-5 descendant herds on the correct islands (WU-4b). Lighting, water, extra fauna, renaming sim identities, or inventing a tortoise/sea-lion family.

## Hard constraints

- Simulation must not import meshes. Do not add renderer types to resolvers.
- Do not edit existing `GOLDEN_SHOTS` or existing capture sets. Add a proof-founder shot if you need owner evidence.
- Do not claim fps. Ask for an owner still-frame and motion look on real WebGPU.

**End with:** test, typecheck, build, asset check, capture URLs for the owner, and a short `docs/EXECUTION.md` note that item 4's founder family is at candidate (not accepted).

**This unit needs an owner visual verdict.** One question: "Does this read as a Galápagos land-iguana founder family, with crest—not horns—carrying `hornLength`?"
