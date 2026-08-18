# WU-4b — Proof populations on the islands that produced them

> **Class:** Task. **Authority:** Below `docs/EXECUTION.md`. **Answers:** what this session implements. **Finish:** the Done when list, then stop.

**Model:** local Agent. **Size:** medium. **Depends on:** WU-4a candidate wired into the landing renderer. **Blocks:** WU-4c, WU-5.

---

Work Unit: WU-4b — Proof populations on the islands that produced them

**Read first:** `docs/EXECUTION.md` items 3–4, `docs/briefs/WU-4a-founder-family.md` (do not redo it), then these files only:

- `src/landing-state.ts` (herd placement, `advance`, showcase vs live lineages)
- `src/outcome-resolver.ts` (where populations stand after a jump)
- `src/island-geography.ts` (`islandAt`)
- `scripts/founding-split-readout.ts` / gene-flow readout (confirm sites, do not retune forage)
- `src/presentation.ts` and `scripts/capture.mjs` (**add** cameras only)

Do not explore beyond them. Do not author a new asset family.

## Why this exists

Item 3 already defines three fixtures on one persisted world. Capture historically could not show land animals; that path is unblocked (`jumps=2` established, `jumps=3` speciated). The renderer still tends to seat showcase herds rather than the lineages the landing actually resolved — so the proof can be true in the readout and false on screen.

## Goal

Overview and mid cameras of the three proof fixtures show the living populations on the islands and at the abundances the resolver named, using the WU-4a family.

## Required shape

- Go through the same `advance` / `resolveLanding` path a player click uses. No fabricated herds for pretty captures.
- Honor `islandAt` / land connections: parent and branch must not share a beach if the readout says they are on separate islands.
- Abundance drives visible count; do not pack 96 animals into an 11 m radius (already a known false read).
- Raft founders remain the same family; do not revive marsh-grazer on the raft.

## Done when

These URLs (or equivalent documented in EXECUTION) show the named state without console errors on real WebGPU:

- Established — `?founders=drifter&plume=active&years=1000000&jumps=2`
- Speciated — same with `jumps=3` (two populations, separate islands)
- Diversified — `jumps=5` (three living populations across two islands)

A reviewer can match on-screen herds to the lineage report (which island, roughly how many) without being told the mapping in chat.

## Explicitly not the goal

Silhouette/coat divergence polish (WU-4c). Resolver retunes. New fauna. Editing existing golden shots.

**End with:** `npm test`, `npx tsc --noEmit`, `npm run build`, added proof cameras if needed, EXECUTION note that item 4 placement is ready for owner look.

**Owner question:** "On each fixture, are the herds on the islands the lineage report names?"
