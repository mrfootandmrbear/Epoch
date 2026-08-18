# WU-4b2 — Overview occupancy and iguana-scale herds

> **Class:** Task. **Authority:** Below `docs/EXECUTION.md`. **Answers:** what this session implements. **Finish:** the Done when list, then stop.

**Model:** local Agent (pixels). **Size:** medium. **Depends on:** WU-4b owner look. **Blocks:** WU-4c.

**Owner visual verdict required** (overview occupancy and mid herd mass).

---

Work Unit: WU-4b2 — Overview occupancy and iguana-scale herds

**Read first:** `docs/EXECUTION.md` item 4 (WU-4b note and the 2026-08-18 size agreement), then these files only:

- `src/herd-behavior.ts` / `src/herd-placement.ts` (spacing, layout radius)
- `src/landing-state.ts` (herd seating, instance scale, creature LOD comments)
- `src/render-scale.ts` (`grazerShoulderHeight` is leftover grazer language; do not drive iguana cameras from it)
- `src/presentation.ts` (**add** cameras only)
- `src/main.ts` / `src/camera-focus.ts` (inspection fly stays; do not replace it)

Do not explore beyond them. Do not author a new asset family. Do not enlarge the mesh. Do not reopen world scale.

## Why this exists

WU-4b seats real lineages, but a metre-true land iguana (~1.2 m, 0.26 m hip) is a few pixels on the 2 km overview. Mid cameras still use grazer-era 3–6.6 m spacing, so the group reads as pepper. WU-4c cannot judge a habitat split until overview has a truthful occupancy read and mid has a herd, not specks.

Owner agreement 2026-08-18: keep metre-true bodies; overview is occupancy; inspection is the 38 m lineage fly; near-camera fps stays a separate diagnostic.

## Goal

Overview proof cameras show which islands are inhabited. Mid cameras show a clustered iguana herd. Clicking a living lineage still flies to inspection distance.

## Required shape

- Occupancy is presentation. Simulation still owns site, `islandAt`, abundance, and identity.
- One cheap mark per living lineage (centroid or equivalent), not a per-animal impostor and not a giant mesh.
- `deriveHerdBehavior` spacing and cohesion must fit a ~1.2 m body (about 1.5–2.5 m neighbour distance). Do not change resolver abundance.
- Drop or document the extra `herdScale` 0.9 squash in `landing-state.ts` so package `scaleMeters` 0.9–1.5 is what the player sees.
- Existing `GOLDEN_SHOTS` stay unedited. Add cameras if overview occupancy needs a named shot.

## Done when

These URLs (same fixtures as WU-4b) show inhabited islands at overview without readable individual silhouettes, and a herd mass at mid:

- Established — `?founders=drifter&plume=active&years=1000000&jumps=2`
- Speciated — same with `jumps=3`
- Diversified — `jumps=5`

`npm test`, `npx tsc --noEmit`, and `npm run build` pass.

## Explicitly not the goal

Enlarging the iguana. Shrinking the 2 km world. WU-4c trait/silhouette split. Guess-tuning hide, morph, or LOD for the zoom-fps defect. WebGPU impostor architecture beyond one cheap mark per lineage.

**End with:** EXECUTION note that occupancy and mid herd mass are ready for owner look.

**Owner questions (only these):**

1. From overview, can you tell which islands the lineage report says are inhabited?
2. At mid, does each living lineage read as a herd rather than scattered specks?
