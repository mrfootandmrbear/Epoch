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
- **The WebGPU render path produces a black screen on Chromium 141.** three
  0.185.1 passes `swizzle: 'rgba'` (string) where current Chromium requires a
  `GPUTextureComponentSwizzle` dictionary; every `GPUTexture.createView()`
  throws (P0-2). Confirmed by capture, not by code reading: all nine WebGPU
  frames are pure black while the FPS counter still reads "WebGPU · 60 fps".
- Forcing the WebGL2 fallback renders the identical scene cleanly, which
  isolates the fault to the WebGPU path and provides a temporary evidence route.
- The empty `herd` capture was initially mis-recorded as a rendering defect.
  Corrected on owner input: grazers arrive only via Distant Drifter and must
  survive a further jump, so their absence is correct. The real finding is an
  evidence-harness gap (P1-1) — no capture can currently contain fauna.

**Verdict.** Baseline established, but **provisional**. Every visual score was
taken on the WebGL2 fallback, which THESIS §6 explicitly rules out as a target,
so scores must be re-taken on WebGPU after P0-2 clears. No trustworthy
performance number exists from this environment (see `DEFERRED.md`).

**Next.** WU-001 = P0-1 (lockfile) then P0-2 (swizzle shim), in that order —
P0-1 is nearly free and unblocks committing the capture dependency; P0-2
unblocks all subsequent visual evaluation. Phase 1's hostile-reviewer audit
should not start until the real pipeline renders.
