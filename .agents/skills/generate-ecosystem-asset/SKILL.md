---
name: generate-ecosystem-asset
description: Create, extend, or review Epoch ecosystem asset packages for terrestrial animals, fish, birds, plants, and coral. Use when an agent is asked to design, generate, model, rig, animate, export, validate, or integrate a living-world visual asset or evolutionary variant family.
---

# Generate an ecosystem asset

Create one bounded asset family at a time. Keep biological intent, authored source, runtime export, and validation evidence together under `assets/ecosystem/<asset-id>/`.

## Start

1. Read `THESIS.md` sections 4 and 6.
2. Read [references/manifest.md](references/manifest.md).
3. Read exactly one relevant category file:
   - [references/fauna.md](references/fauna.md) for terrestrial animals, fish, or birds.
   - [references/flora-coral.md](references/flora-coral.md) for plants or coral.
4. Copy [assets/asset.json](assets/asset.json) and [assets/morphology.md](assets/morphology.md) into `assets/ecosystem/<asset-id>/`.
5. Set `stage` honestly. Never mark missing work complete.

## Workflow

Advance through these gates in order:

1. `brief`: define role, habitat, real-world referents, silhouette, palette family, scale, required motion, and trait contract.
2. `source`: add editable source files and record the generator/tool plus reproducible source command or procedure.
3. `preview`: add the required orthographic/game-distance previews. Judge the silhouette at gameplay scale.
4. `candidate`: add runtime exports, LODs, animation clips where required, and an in-engine showcase image or clip.
5. `accepted`: record the owner's visual verdict and final validation evidence.

Run `npm run asset:check -- assets/ecosystem/<asset-id>` after every change. Fix all errors. Warnings are acceptable only at `brief`; later stages must be warning-free.

## Invariants

- Tie each morphology choice to a habitat pressure or functional need. Do not invent decorative fantasy variation.
- Preserve family resemblance across evolutionary variants through a shared rig/skeleton, palette, or branching grammar.
- Treat continuous traits as runtime parameters and discrete adaptations as authored variants. Do not assume topology-stable morph targets.
- Keep asset tools build-time-only. Ship runtime exports, not authoring engines.
- Do not modify simulation rules to justify an asset.
- Do not replace an existing asset package or refresh accepted evidence without calling it out.
- Do not create multiple unrelated species in one run.

## Handoff

Report the asset id, current stage, files created, validator result, and the exact remaining gate. If the work needs visual judgment, ask one concrete question while showing the relevant preview.
