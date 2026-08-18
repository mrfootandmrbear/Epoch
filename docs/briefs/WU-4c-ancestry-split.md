# WU-4c — Shared ancestry, habitat-shaped split

> **Class:** Task. **Authority:** Below `docs/EXECUTION.md`. **Answers:** what this session implements. **Finish:** the Done when list, then stop.

**Model:** local Agent. **Size:** medium. **Depends on:** WU-4a, WU-4b, and WU-4b2. **Blocks:** WU-5 visual/causal gates for descendant readability.

**Owner visual verdict required** (descendant readability).

---

Work Unit: WU-4c — Shared ancestry, habitat-shaped split

**Read first:** art-direction bible in `CLAUDE.md`, `docs/EXECUTION.md` definition of done (descendants remain visibly related), then:

- `src/creature-expression-spike.ts` / `src/creature-material.ts`
- `src/population-traits.ts` (what isolation already does to means)
- `src/lineage-report.ts` (player-facing trait language)
- Proof mid/near cameras added in WU-4b

Do not explore beyond them. Do not add a second species mesh.

## Why this exists

The causal gate fails if parent and branch look like two unrelated animals, or like clones. The resolver already records opposite adaptation directions (parent toward longer crest / warmer coat; branch on wet volcanic ground toward shorter crest, colder coat, less insulation). That split must read on the WU-4a body at mid and near. Overview occupancy (which islands are inhabited) is WU-4b2, not a silhouette gate.

## Goal

One family. Two (then three) specialists. A reviewer can guess habitat from silhouette and still name them as relatives.

## Required shape

- Same topology and palette family. Divergence only through existing morph and coat channels.
- Stylize to make the habitat pressure obvious: limbs/feet for terrain and substrate, mass/insulation for climate, crest for the `hornLength` axis, coat for habitat.
- Do not invent markings or weapons that the trait contract does not own.
- Lineage report language should match what is visible (crest, not "horns," if WU-4a remapped the expression). A small copy change in `lineage-report.ts` is in scope; resolver math is not.

## Done when

- Mid and near proof cameras show parent vs branch side by side or in matched framings.
- Cross-population split is obvious; within-population clones are not the remaining defect (desync in motion is acceptable; still-frame uniformity is not a reason to add a second mesh).
- Tests, typecheck, and build pass.

## Explicitly not the goal

WU-5 full capture matrix, lighting (LW-6), rough seas (LW-7), extra families.

**End with:** evidence URLs, EXECUTION note that descendant readability is ready for owner verdict.

**Owner questions (only these):**

1. Do they stay one family?
2. Can you tell which habitat each specialist lives in from the body alone?
