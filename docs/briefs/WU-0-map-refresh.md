# WU-0 — Refresh the repo map

**Model:** Haiku · **Size:** small · **Depends on:** nothing

---

Work Unit: WU-0 — Refresh `docs/polish/MAP.md`

**Read first:** `CLAUDE.md`, `docs/polish/MAP.md`, `docs/EXECUTION.md`.
Do not explore beyond these plus the directory listings and counts you need to
do the job. Do not read source files in full — file *names* and sizes are what
this unit is about.

**Why this exists:** `MAP.md` is the file every future session reads instead of
re-exploring the repository. It is dated 2026-08-12 and is now wrong — it
claims "38 modules + 28 test files, ~7.6k lines" and "55 files / 379 tests"
while `src/` currently holds far more. A stale map costs every later session
tokens, which is the whole reason this unit is first.

**Goal:** Make `MAP.md` accurate as of today, and add a lineage/population
section it currently lacks.

**Tasks:**

1. Recount and correct: number of modules and test files in `src/`, total line
   count, and the test-file/test counts reported by `npm run test`. Update the
   header line of "Source layout" and the "Test" row of the build table.
2. Correct any module line counts cited in the file that have drifted
   (`main.ts`, `landing-state.ts`, `outcome-resolver.ts`, `fft-ocean.ts`,
   `fft-water.ts`, `presentation.ts` are the ones it names with numbers).
3. Add a new subsection under "Simulation (renderer-independent)" titled
   **"Lineage and population"**, naming what each of these owns in one line
   each:
   - `lineage-history.ts` — lineage records, `LineageOrigin` (why a branch
     happened: vicariance vs. dispersal, dated and located), `LineageEvent`
   - `outcome-resolver.ts` — gene flow, drift, isolation branching, migration
   - `island-geography.ts` — land components, saddles, `SeaLevelHistory`,
     `islandAt`
   - `founder-establishment.ts` / `founder-profile.ts` — Distant Drifter
     founder choices and whether a founder establishes
   - `population-traits.ts` / `population-archetypes.ts` — the trait model
   - `lineage-report.ts` — the text lineage panel (HTML)
4. Add a line to the "Simulation readout scripts" row noting that
   `scripts/founding-split-readout.ts` reproduces founder establishment
   renderer-independently, and that it must be given real terrain sampler
   functions — calling `captureWorldSnapshot` without them silently defaults
   forage to a constant 1 everywhere, which produced a false result on
   2026-08-15 (see `docs/polish/LOG.md`).
5. Update the "Updated:" date at the top.

**Do not touch:** any file under `src/`, `scripts/`, or `assets/`. Any other
document. This unit changes exactly one file.

**Done when:** a fresh session reading only `MAP.md` can name the right file
for a lineage or founder change without globbing `src/`, and every number in
the file matches reality.

**End with:** `npm run test` and `npx tsc --noEmit` (both should be unaffected
— you changed no code), and a short `docs/polish/LOG.md` entry.

Do not claim any owner verdict; say "ready for owner verdict" if a verdict is
relevant at all (it is not for this unit).
