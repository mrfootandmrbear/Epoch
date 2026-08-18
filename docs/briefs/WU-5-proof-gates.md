# WU-5 — Proof captures, visual gates, causal gate

> **Class:** Task. **Authority:** Below `docs/EXECUTION.md`. **Answers:** what this session implements. **Finish:** the Done when list, then stop.

**Model:** local Agent. **Size:** medium. **Depends on:** WU-4a, WU-4b, WU-4b2, WU-4c, WU-D1. **Blocks:** item 6 (resume water, extra fauna, lighting only if this proof names a failure).

**Owner visual verdict required** (regional cohesion, reef-edge composition, organism quality, motion). **Owner causal gate required** (separate from pixels). Descendant readability is already accepted (WU-4c) — do not re-ask it.

---

Work Unit: WU-5 — Capture the declared sequence and obtain the remaining gates

**Read first:** `docs/EXECUTION.md` item 5, "Definition of done," and "Recorded owner verdicts," then these files only:

- `scripts/capture.mjs` (add a set; do not edit existing sets)
- `src/presentation.ts` (**add** cameras only if a required framing is missing)
- `scripts/founding-split-readout.ts` (confirm the three fixtures still hold)
- `src/epoch-story.ts` / `src/lineage-report.ts` (player-facing causes — read, do not rewrite unless a readout/UI mismatch is a real bug)

Do not explore beyond them. Do not start LW-6, LW-7, extra fauna, atmosphere identity, or a new asset family.

## Why this exists

Items 0–4 made one inherited hotspot sequence playable: geology, isolation, a land-iguana founder family, occupancy, herds, and a subtle descendant split. None of the remaining visual gates, and not the causal gate, has been recorded against that integrated sequence. Attractive stills cannot close it.

## Goal

One persisted world, three declared landings, captured at overview / reef-edge / mid / near. Automated checks pass. The owner records the four open visual verdicts on real WebGPU and answers the causal questions from the landing alone.

## Required shape

- Same proof world as items 3–4:
  - Established — `?founders=drifter&plume=active&years=1000000&jumps=2`
  - Speciated — `jumps=3`
  - Diversified — `jumps=5`
- Add a new capture set (suggested name `proofGates`) that covers, for that sequence: overview occupancy, reef-edge composition, mid herds, near bodies. Reuse existing proof cameras where they already frame the subject. Do not edit `GOLDEN_SHOTS` or `proofSequence` / `proofPlacement` / `proofAncestry`.
- Headless `--webgl` contact sheets are fallback-backend evidence. Say so. Do not score fps from them. Do not use `--enable-unsafe-webgpu`.
- Capture mode freezes time (`time=42`). Motion is a live WebGPU look on the owner's machine, not a still.
- Confirm fixtures with the readout before asking the owner. If a fixture no longer holds, stop and record the regression in EXECUTION — do not retune forage or branching to "make the sheet pretty."
- The newest shield drawing as a flat dark disc is a known open defect. Do not treat it as a new finding. It fails a visual gate only if the owner says the geology → isolation arc is unreadable because of it.
- Do not reopen the WU-4c split to make it louder unless the causal or visual look shows the sequence failing without it.

## Causal gate protocol

The intended mapping lives in EXECUTION item 3 and the WU-A5 log. **Do not paste it into the owner prompt.** Ask only the questions below. Record their answers and any mistaken inference verbatim.

Player-facing evidence the owner may use: the three live URLs (UI visible — not `?shot=`), the epoch story, the lineage report, and what is on screen. Not this brief, not the readout, not chat spoilers.

## Done when

- `npm test`, `npx tsc --noEmit`, and `npm run build` pass.
- A new contact sheet exists for the integrated sequence (provisional if `--webgl`).
- EXECUTION item 5 names the evidence URLs / sheet path and either records the four visual verdicts plus the causal answers, or records which gate failed and why.
- The session stops. A failed gate becomes the next brief; it is not this session's polish pass.

## Explicitly not the goal

Lighting (LW-6), sea state (LW-7), caldera shape, extra families, lockfile, fps retunes, exaggerating the ancestry split, editing prior golden shots.

**End with:** evidence URLs, capture command used, EXECUTION update. Say "ready for owner verdict" until the owner has answered. Do not mark gates accepted yourself.

**Owner visual questions (only these four; descendant readability is already accepted):**

1. **Regional cohesion.** Does this still read as one Galápagos-inspired hotspot archipelago (young/old shields, arid lowlands, water) rather than unrelated biomes glued together?
2. **Reef-edge composition.** At the reef-edge / shoreline framing, does the meeting of land, water, and shelf make sense for this world?
3. **Organism quality.** At mid and near, is the land-iguana family good enough to carry the proof (silhouette, crest, coat) without looking like a placeholder?
4. **Motion.** In live play (not a frozen capture), does herd motion and water read as the same world, or does motion break the still-frame read?

**Owner causal questions (do not supply answers):**

1. Which habitats are divided, and how can you tell from the landing?
2. Which major adaptations belong to which habitat?
3. In your own words, what is the geology → isolation → adaptation chain that produced this?
