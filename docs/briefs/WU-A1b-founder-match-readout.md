# WU-A1b — Founder match readout

**Model:** Haiku · **Size:** small · **Depends on:** WU-A1 (must land first)

---

Work Unit: WU-A1b — Founder match readout in the drifter panel

**Read first:** `CLAUDE.md`, `docs/polish/MAP.md`, the "Resolved design
decision" in `docs/TANGLED-BANK-BUILD-PLAN.md`, and these files:
`src/founder-profile.ts`, `src/landing-state.ts` (only the `WorldExperience`
interface around line 460 and `forageAt` / `currentSnapshot` around lines
663–700), `src/main.ts` (only the drifter block, lines ~82–90 and ~715–745),
and `index.html` (only the drifter markup, lines ~728–751).
Do not explore beyond them.

## Why this exists

The player picks a founder from three dropdowns and only learns whether the
pick was right after a jump, with no reason given. Under the three-band design
decision, a losing pick has to feel like a misread, not a dice roll. The fix is
to make the island's condition **readable before the launch**, the way *Niche*
shows habitat requirements beside an animal's stats.

## Goal

Before launch, the drifter panel states what this island currently offers, what
the selected founder needs, and a plain-language verdict.

## Required shape

Keep the simulation/rendering seam (`AGENTS.md`). Three pieces:

1. **`src/founder-match.ts`** — a new, pure, renderer-independent module. One
   exported function taking a small habitat summary (forage, moisture,
   elevation band, vegetation presence) plus `FounderChoices`, returning the
   readout text. No DOM, no Three.js imports, no randomness.
2. **A small read-only accessor on `WorldExperience`** in `landing-state.ts`
   returning that habitat summary for the site a drifter would arrive at.
   `currentSnapshot` and `forageAt` are currently internal — expose a summary,
   **not** the whole snapshot.
3. **Wiring in `main.ts`** — recompute and write the text into `#drifter-preview`
   whenever any of `#drifter-food` / `#drifter-size` / `#drifter-climate`
   changes. There is already an `updateDrifterPreview()` at ~line 725 and a
   change listener loop at ~line 729; extend those rather than adding a new
   path.

## Wording rules — the load-bearing part of this unit

- **Describe the island. Do not forecast the founder.**
  Good: *"Sparse forage, wet highlands; an arid grazer will struggle here."*
  Bad: *"68% chance of establishment."* Bad: *"This founder will fail."*
- **Never state a probability, a score, or a predicted outcome.** A number
  destroys the surprise that makes the marginal band worth playing.
- **Not a tutorial.** No modal, no onboarding prose, no multi-paragraph
  explainer. It is a diagnostic line in a panel that already exists.
- Keep the existing sentence *"Exact anatomy will be generated when the raft is
  launched."* — it sets the right expectation.

## Done when

- Changing any of the three dropdowns changes the verdict text.
- Changing the island (sculpt, or jump so vegetation and forage move) changes
  the verdict text for the same founder choice.
- `founder-match.ts` has unit tests covering: a well-matched pairing, an
  absurd mismatch, and a marginal case.
- A grep of the module finds no percentage sign, no "chance", no "will
  survive"/"will fail" phrasing.
- The readout stays hidden under `body.capture-mode` like the rest of the UI,
  and no fixed capture camera changes.

**Do not touch:** `founder-establishment.ts` or any tuning WU-A1 landed. Any
renderer file. `presentation.ts` `GOLDEN_SHOTS`. The single-raft guard in
`landing-state.ts` (that is WU-A2). Do not add a new panel — use
`#drifter-preview`.

**End with:** `npm run test`, `npx tsc --noEmit`, `npm run build`, and a
`docs/polish/LOG.md` entry quoting three example readouts the module produces.

Do not claim any owner verdict; say "ready for owner verdict".
