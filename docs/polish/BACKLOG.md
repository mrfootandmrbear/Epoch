# Backlog

> **Updated:** 2026-08-12 (Phase 0).
> Ranked by **impact ÷ (cost × risk)**. Impact 1–5 = how much a new player
> notices in the first 60 seconds. Cost 1–5 = token/session cost to fix
> properly *including evidence and review*. Risk 1–3 = chance of breaking
> something that currently works.
>
> **This list is incomplete by design.** Phase 0 only recorded blockers found
> while establishing the baseline. The full hostile-reviewer audit across all
> polish domains is Phase 1 and has not been run yet.

## P0 — blockers

### P0-1 · `npm install` fails on a clean clone
**Impact 5 · Cost 1 · Risk 1 · Score 5.00 · Status: OPEN**

`package-lock.json` contains an entry with no `version` field:
`node_modules/rollup/node_modules/@rollup/rollup-android-arm-eabi` →
`{"dev":true,"optional":true}`. npm 10.9.7's arborist calls `semver.gte()` on
that missing version inside `canDedupe`, throwing `TypeError: Invalid Version:`
before anything installs.

- **Repro:** `rm -rf node_modules && npm install` → `npm error Invalid Version:`
- **Workaround in use:** `npm install --no-package-lock --no-save`
- **Hypothesis:** regenerating the lockfile on current npm fixes it; the entry
  is a corrupt optional-platform-dep record, not a real dependency.
- **Care:** regeneration is a large diff. Verify the resulting tree still pins
  `@dgreenheck/ez-tree` to commit `dcf309b` and that `three` stays 0.185.1.

### ~~P0-2 · Black screen on Chromium 141+~~ — **RETRACTED, was a harness artifact**
**Status: WITHDRAWN 2026-08-12. Not a product defect. Do not act on it.**

Phase 0 originally filed this as a P0 after all nine WebGPU captures came back
black with `Failed to execute 'createView' on 'GPUTexture': ... not of type
'GPUTextureComponentSwizzle'`. **That conclusion was wrong**, and the record is
kept here so no future session re-files it.

What actually happened: the capture script passed `--enable-unsafe-webgpu`.
That flag exposes experimental WebGPU IDL members that a shipping browser does
not. In WebIDL, *unknown dictionary members are silently ignored* — so three
0.185.1 setting `swizzle = 'rgba'` (a string where the experimental spec wants a
`GPUTextureComponentSwizzle` dictionary) is inert in a normal browser and only
becomes a hard type error once the flag turns the member on.

- **Owner report:** WebGPU works locally on the pushed commit.
- **Confirmed by test:** re-running capture *without* `--enable-unsafe-webgpu`
  exposes no WebGPU at all in this sandbox — it falls back to WebGL2. The only
  WebGPU reachable here is the flagged, non-representative one.
- **Therefore:** the real WebGPU path is **not testable in this environment**,
  and Phase 0 had no basis for calling it broken. The flag is now opt-in
  (`--unsafe-webgpu`) and should stay off.
- `evidence/artifact-unsafe-webgpu-flag/` is retained as evidence *of the
  harness misconfiguration*, not of a product defect — renamed from
  `baseline-webgpu-blackscreen/` so it cannot be mistaken for a real finding.

**Residual watch item (low priority, not currently affecting players).** three
0.185.1's `swizzle = 'rgba'` is still the wrong type against the draft spec, so
it would become a genuine break if/when Chrome ships `texture-component-swizzle`
to stable. Nothing to do now; three 0.185.1 is the latest published release. Re-
test if a future Chrome stable starts throwing on `createView`.

## P1 — evidence infrastructure

### P1-1 · Fauna is unreachable by automated capture
**Impact 3 · Cost 2 · Risk 1 · Score 1.50 · Status: OPEN**

Terrestrial grazers arrive only via **Distant Drifter**, which delivers an
energy-limited founder cohort that must survive a *further* jump to establish.
Capture mode clicks nothing and calls `landingState.advance()` exactly once, so
no capture can contain land animals — the `herd` golden camera in
`src/presentation.ts` is currently unreachable.

- **Consequence:** creature embodiment, trait variation, animation, secondary
  motion and herd legibility cannot be visually evaluated at all. THESIS §5
  names "a small population rendered with visible trait variation" as part of
  the validation spike, so this blocks evidence for a load-bearing requirement.
- **Hypothesis:** a capture parameter (e.g. `&drifter=established`) that
  introduces a drifter and then advances a second interval makes the state
  reachable deterministically.
- **Care:** must go through the same resolver the player's click does — a
  capture path that fabricates a herd directly would produce evidence of
  something the game never actually shows. Keep the seed and jump durations
  fixed so the shot stays a valid A/B basis.

## Phase 1 — not yet run

The hostile-reviewer audit across art direction, geometry, materials, lighting,
shadows, image quality, VFX, animation, secondary motion, physics, collision,
game feel, camera, environmental life, UI/HUD, and micro-polish has **not** been
performed. Candidate defects noticed incidentally while capturing the baseline
are parked in `BASELINE.md` under "Unaudited observations" — they are
observations, not triaged backlog items, and several may be artifacts of the
WebGL2 fallback rather than real defects. Re-check them against WebGPU evidence
captured on the owner's machine before treating any of them as real.
