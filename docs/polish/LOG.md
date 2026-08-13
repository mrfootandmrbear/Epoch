# Work log

One entry per Work Unit: hypothesis, change, verdict. Newest last.

---

## WU-000 · Phase 0 baseline (2026-08-12)

**Hypothesis.** None — Phase 0 is measurement, not change. Goal: establish
`MAP.md`, `BASELINE.md`, a starting scorecard, and a deterministic capture
harness, then stop without fixing anything.

**Change.** No gameplay, simulation, or rendering code was modified. Added
`scripts/capture.mjs` (capture infrastructure), `CLAUDE.md`, and `docs/polish/`.
`package.json` and `package-lock.json` are deliberately untouched — the
playwright dependency needed for capture was installed with `--no-save` rather
than committed, because committing it requires first fixing the broken lockfile
(P0-1), which is a change and therefore out of Phase 0 scope.

**Findings.**
- 28 test files / 94 tests pass. `npx tsc --noEmit` clean.
- `npm install` fails on a clean clone — corrupt `package-lock.json` entry
  (P0-1).
- ~~**The WebGPU render path produces a black screen on Chromium 141.**~~
  **[RETRACTED — see WU-000b below. This was a harness artifact, not a defect.]**
  three 0.185.1 passes `swizzle: 'rgba'` (string) where current Chromium requires a
  `GPUTextureComponentSwizzle` dictionary; every `GPUTexture.createView()`
  throws (P0-2). Confirmed by capture, not by code reading: all nine WebGPU
  frames are pure black while the FPS counter still reads "WebGPU · 60 fps".
- ~~Forcing the WebGL2 fallback renders the identical scene cleanly, which
  isolates the fault to the WebGPU path.~~ **[RETRACTED — this only ruled out a
  WebGL2 explanation, never the flag-induced one that was actually responsible.]**
  It does remain the usable evidence route in a GPU-less environment.
- The empty `herd` capture was initially mis-recorded as a rendering defect.
  Corrected on owner input: grazers arrive only via Distant Drifter and must
  survive a further jump, so their absence is correct. The real finding is an
  evidence-harness gap (P1-1) — no capture can currently contain fauna.

**Verdict.** Baseline established, but **provisional**. Every visual score was
taken on the WebGL2 fallback, which THESIS §6 explicitly rules out as a target,
so scores must be re-taken on WebGPU after P0-2 clears. No trustworthy
performance number exists from this environment (see `DEFERRED.md`).

**Next.** WU-001 = P0-1 (lockfile). It is nearly free and unblocks committing
the capture dependency.

---

## WU-000b · Correction: P0-2 retracted (2026-08-12)

**What went wrong.** Phase 0 filed a P0 claiming the WebGPU path renders a black
screen on Chromium 141+, based on nine black captures and a `createView`
type error on `swizzle`. The owner reported WebGPU works locally on the pushed
commit, which prompted a retest.

**Root cause of the false finding.** `scripts/capture.mjs` passed
`--enable-unsafe-webgpu`. That flag exposes experimental WebGPU IDL members that
shipping browsers do not. WebIDL silently ignores unknown dictionary members, so
three 0.185.1's incorrect `swizzle = 'rgba'` is inert in a real browser and only
becomes a hard type error once the flag turns the member on. Re-running capture
without the flag showed this sandbox exposes **no WebGPU adapter at all** and
falls back to WebGL2 — so the shipping path was never testable here, and the
"verified not a sandbox artifact" claim in the original entry was unfounded: it
only ruled out a *WebGL2* explanation, not a flag-induced one.

**Change.** `--enable-unsafe-webgpu` is now opt-in (`--unsafe-webgpu`, default
off). P0-2 marked WITHDRAWN with the reasoning retained so it is not re-filed.
Stability rescored 3 → 7 and Polish 3 → 5, both of which had been marked down
for the imaginary black screen; assessed mean 4.1 → 4.6. `CLAUDE.md` now carries
a standing rule: never conclude the renderer is broken from a headless capture.

**Lesson worth keeping.** A capture harness that "succeeds" can still be
measuring a configuration no player has. Flags that force a feature into
existence change what is being tested.

---

## WU-001 · Phase 1 live-world visual audit (2026-08-13)

**Hypothesis.** The live world (fish, drifter, water, herds, coral, lighting) has
never had a hostile-reviewer pass on the real renderer. Drive the deterministic
capture URLs through the **WebGPU** backend in the browser pane and produce a
ranked, actionable slice plan — measurement and planning, no gameplay/render code
changed.

**Change.** No source changed. Added the `LW-1…LW-8` findings and a recommended
slice sequence to `BACKLOG.md`, and retired the "Phase 1 — not yet run"
placeholder. Header dates advanced to 2026-08-13.

**Findings.** Full detail in `BACKLOG.md`. Headline, ranked by
impact ÷ (cost × risk):

- **LW-1 (3.00)** fish colour ≈`HSL(0.39,0.38,0.52)` matches the water column →
  near-invisible in their own hero camera; cheap colour fix.
- **LW-2 / LW-3 (1.50)** flat encrusting corals read as paper cutouts; foam is a
  bright shoreline decal band plus detached open-water blobs.
- **LW-4 (1.00)** the cascade/whitewater renderer (newest system, commit
  `2d22874`) reads as white scratches and clips through terrain — highest raw
  visibility, its own WU.
- **LW-6 (0.67)** dawn/day/storm all resolve to one hazy mid-tone; grading never
  reaches the ground or water.
- **LW-7 (0.50)** systemic flat sea: max wind 18 m/s, no storm tier
  (`climate.ts:33`), swell damped to 0.22 (`render-scale.ts:10`); contradicts the
  owner water reference. Biggest unit.
- **LW-8 (0.33)** herd within-population uniformity + flat coats — but
  **cross-population divergence reads well** (nimble vs bulky); a confirmed
  strength to protect.

**Two evidence caveats.** (1) The pane throttles rAF, so every shot is a still at
`time=42` — motion, gait, foam animation, drifter bob and fps were **not**
judged; the LW-8 pose complaint especially needs a moving capture. (2) Findings
are prepared for the owner-verdict gate, not accepted through it.

**Verdict.** Live-world slice of Phase 1 triaged with WebGPU evidence. Remaining
domains (geometry, textures, image quality, physics/collision, UI/HUD,
micro-polish) still un-audited.

**Next.** Slice A = LW-1 + LW-3 (+ LW-2) — cheap, low-risk legibility wins with
the best return per session. LW-4 and LW-7 each earn a dedicated WU.
