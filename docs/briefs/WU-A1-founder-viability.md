# WU-A1 — Make founder viability discriminate on choice × world

**Model:** Sonnet · **Size:** medium–large · **Depends on:** WU-0 (helpful, not blocking)

---

Work Unit: WU-A1 — Make founder viability discriminate on choice × world

**Read first:** `CLAUDE.md`, `docs/polish/MAP.md`,
`docs/TANGLED-BANK-BUILD-PLAN.md` (the WU-A1 section and its "Resolved design
decision"), the 2026-08-15 "Correction: the founding split does not establish"
entry at the tail of `docs/polish/LOG.md`, and these source files:
`src/founder-establishment.ts`, `src/founder-profile.ts`,
`scripts/founding-split-readout.ts`, and the founder path through
`src/outcome-resolver.ts`.
Do not explore beyond them. Do not touch the renderer.

## Background you must not re-derive

On 2026-08-15 a sweep found **all 60 `FounderChoices` combinations** (4 food
sources × 3 sizes × 5 origin climates) go extinct on a single 1,000,000-year
jump from year 0, and that no jump-length strategy threads it: a 1-year jump
makes literally zero adaptation progress (`traitAdaptationRate(1) === 0`
exactly), and any jump long enough to move adaptation costs more abundance
than the founder's starting 0.018 can absorb, because intake stays under the
~0.4 break-even until adaptation has climbed higher than one such jump raises
it.

**This is not an investigation.** The owner has answered it: drifters are
*meant* to fail when the player's pick does not suit the island. The defect is
that the outcome does not vary with the player's choice — a uniform 60-of-60
extinction makes the choice decorative.

**Do not** re-run the "is this intended?" question. Do not read the retracted
entry above the correction as evidence of anything.

## The design decision this unit implements

Three bands:

1. **Well-matched** — establishes, then adapts.
2. **Marginal** — contested; adaptation genuinely races abundance decay and
   either can win. **Most founder choices on most islands should land here.**
3. **Absurd mismatch** — fails fast and legibly.

Bands 1 and 3 exist to make band 2 mean something.

**Two hard constraints on how you implement it:**

- **The width of band 2 must be a single named tuning parameter.** Not a
  dozen adjusted margins scattered through the file. It has to be narrowable
  later with confidence. Start it **wide** — generous, close to "everything has
  a chance" — so the mechanic is legible while it is being designed.
- **Adaptation must become reachable within a jump.** If a founder's fate is
  fixed at the moment of choice, band 2 does not exist and the drifter is a
  lottery ticket. `traitAdaptationRate` is currently not reachable and fixing
  that is in scope.

## Goal

Founder outcome varies with the match between the player's choice and the
island's actual state, for a reason that can be named.

## Tasks

1. **Build the matrix first, before changing any tuning.** Run all 60
   `FounderChoices` against at least three deliberately different island
   states — bare young volcanic, wet vegetated highland, arid lowland —
   through `scripts/founding-split-readout.ts`. Record for each cell: outcome,
   intake vs. break-even, adaptation rate vs. abundance decay. This is the
   before-evidence and it is not optional.

   **Sampler warning:** `captureWorldSnapshot` called without
   forage/nutrient/runoff/basalt sampler functions silently defaults forage to
   a constant 1 everywhere. That bug produced a false "the founder thrives"
   result on 2026-08-15. Confirm the script samples real terrain fields
   (matching `currentSnapshot()`'s bilinear sampling) before trusting a single
   number out of it.

2. Fix `traitAdaptationRate` so adaptation can move meaningfully inside a
   single jump without destabilising already-established populations.

3. Introduce the single named band-2 width parameter and tune until the matrix
   spreads across all three bands.

4. Re-run the matrix and record the after-evidence.

## Done when

- On at least one island state, a **well-matched founder establishes** and a
  **deliberately mismatched founder fails**, reproducibly, through the same
  resolver a player's click uses — not through a capture-only path.
- Each failure is attributable to a **named mismatch** — food source, size
  band, or origin climate against that site's forage, moisture, or elevation —
  not to a global margin that moved.
- Most cells in the matrix land in band 2.
- Regression tests pin **both** a success and a matched failure.
- Established populations that already exist are not destabilised by the
  adaptation-rate change; existing tests still pass unchanged.

## Explicitly not the goal

Making founders survive. A founder that survives everything is the same defect
with the sign flipped. If your tuning removes failures, you have gone wrong.

## Stop and report instead of pushing through, if

- `traitAdaptationRate` cannot be made reachable without destabilising
  established populations. That is a structural finding about
  `founder-establishment.ts` and it needs the owner, not a wider band.
- Band 2 will not stay a single parameter. Report rather than scattering
  margins.

Report the numbers in both cases. Do not widen the band until failures
disappear.

**Do not touch:** any renderer file, `distant-drifter-renderer.ts`, the capture
harness, `presentation.ts` `GOLDEN_SHOTS`, or the drifter UI panel (that is
WU-A1b). Do not remove the single-raft guard in `landing-state.ts` (that is
WU-A2).

**End with:** `npm run test`, `npx tsc --noEmit`, `npm run build`, and a
`docs/polish/LOG.md` entry carrying the before/after matrix summary and the
name of the band-2 parameter.

Do not claim any owner verdict; say "ready for owner verdict".
