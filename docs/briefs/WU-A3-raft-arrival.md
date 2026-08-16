# WU-A3 — The raft arrives as a moment

**Model:** Sonnet · **Size:** medium · **Depends on:** nothing (independent of A1/A2)
**Owner visual verdict required.** Closes backlog LW-5.

---

Work Unit: WU-A3 — The raft arrives as a moment

**Read first:** `CLAUDE.md`, `docs/polish/MAP.md`, the LW-5 entry in
`docs/polish/BACKLOG.md`, the art-direction bible in `CLAUDE.md`, and these
files: `src/distant-drifter-renderer.ts` (whole file — it is small),
`src/main.ts` (the drifter block ~lines 82–90 and ~715–745, and the camera
controls setup ~lines 174–180), `src/reveal.ts` (for the existing jump-reveal
treatments — match their vocabulary, do not invent a new one).
Do not explore beyond them.

## Why this exists

Owner request, 2026-08-16: the player should **see the raft arrive**, in the
spirit of the existing reveal. This is the moment the player's founder choice
gets tested, so it carries real weight — but today it is nearly invisible.

The raft itself already models correctly: logs, greenery, three founders,
seated outside the island footprint, kept clear of the default south-east
camera approach (`distant-drifter-renderer.ts`, `reveal(profile, seaLevel)`).
**This is framing and beat work, not modelling. Do not rebuild the raft.**

## Verify LW-5's stated cause before fixing it

LW-5 says the raft "sits as a distant speck at world `(92, sea, 86)` and the
zoom clamps well back, so the founder cohort never resolves."

**Part of that may be wrong.** `controls.minDistance` is `1.25` — the player
can zoom very close indeed. So the defect is more likely default framing,
attention, and the absence of any beat than a clamp. Confirm what actually
prevents the cohort from reading before you change anything, and correct LW-5
in your log entry if its stated cause does not hold. Note also that the raft's
world position was authored against the pre-2026-08-15 380 m world; the world
is now 2,000 m, so check whether `(92, sea, 86)` is still where it belongs.

## Goal

Launching a raft produces an arrival the player watches and can read the
founders from, then hands cleanly back to gameplay framing.

## Required shape

- A **beat**, not a cutscene: approach, a framing that brings the founder
  cohort to readable scale, and a return to the player's prior camera. Keep it
  short.
- **Match `reveal.ts`'s existing vocabulary.** The game already has a reveal
  language for jumps; the arrival should feel like it belongs to the same game,
  not like a second system.
- **The player keeps control, or gets it back promptly and predictably.** Per
  the project's camera direction, do not disable controls outright — this
  codebase deliberately keeps the camera live rather than toggling
  `controls.enabled`.
- **Restraint is polish** (`CLAUDE.md` art bible). No new effects beyond what
  the moment needs. Every added element must serve reading the founders.

## Done when

- Launching a raft in the live app produces an arrival the player can watch,
  in which the three founders resolve at readable scale.
- Screenshots captured for the owner: the arrival at its readable moment, and
  the hand-back to gameplay framing.
- LW-5's stated cause is either confirmed or corrected in the log entry.
- No console errors or warnings on the real WebGPU backend.

## Hard constraints

- **Must be inert under `body.capture-mode`.** Capture mode is deterministic —
  fixed seed `0xe90c4`, frozen sim time, forced `day` atmosphere, fixed
  cameras, UI hidden. An arrival beat that moves a fixed camera invalidates
  every prior capture. Verify by running a capture set and confirming the
  images are unchanged.
- **Do not edit existing `GOLDEN_SHOTS` in `presentation.ts` or existing shot
  sets in `scripts/capture.mjs`.** Add new entries if you need them; editing
  existing ones invalidates all prior evidence.
- Do not claim an fps figure. The browser pane throttles `requestAnimationFrame`
  — report draw counts or describe the motion, never a frame rate.

**Do not touch:** `founder-establishment.ts` or any WU-A1 tuning. The
single-raft guard (WU-A2). The drifter panel readout (WU-A1b). Simulation
state of any kind — this unit is presentation only.

**End with:** `npm run test`, `npx tsc --noEmit`, `npm run build`, a capture
set run confirming no existing shot moved, and a `docs/polish/LOG.md` entry.

**This unit needs an owner visual verdict.** Say "ready for owner verdict" and
attach the screenshots; do not mark LW-5 accepted yourself.
