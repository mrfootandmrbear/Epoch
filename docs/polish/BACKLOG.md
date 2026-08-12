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

## P0 — blockers (nothing else can be honestly evaluated until these clear)

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

### P0-2 · Black screen on Chromium 141+ — the WebGPU path throws on every `createView`
**Impact 5 · Cost 2 · Risk 2 · Score 1.25 · Status: OPEN**

three 0.185.1's reusable `GPUTextureViewDescriptor` sets `this.swizzle = 'rgba'`
— a **string**. Current Chromium requires `GPUTextureComponentSwizzle`, a
**dictionary**. IDL conversion rejects it on every `GPUTexture.createView()`
call, so the render pipeline never produces a frame.

- **Observed:** `pageerror: Failed to execute 'createView' on 'GPUTexture':
  Failed to read the 'swizzle' property from 'GPUTextureViewDescriptor': The
  provided value is not of type 'GPUTextureComponentSwizzle'.`
- **Evidence:** `evidence/baseline-webgpu-blackscreen/contact-sheet.png` — all
  nine shots pure black, while `#status` still reports "WebGPU · 60 fps"
  (the animation loop runs; only rendering fails).
- **Verified not a sandbox artifact:** hiding `navigator.gpu` forces the WebGL2
  backend and the identical scene renders with zero console errors.
- **Chromium tested:** 141.0.7390.37. **three:** 0.185.1, which is the *latest
  published version* — there is no upstream release to bump to.
- **Severity:** THESIS §6 commits to WebGPU+TSL and states the visual bar means
  matching that pipeline, *not* approximating it on WebGL2. So this is not
  merely a bug — until it clears, **no visual work on this project can be
  honestly evaluated**, because the only images obtainable are from a backend
  THESIS explicitly rules out as a target.
- **Hypothesis:** a narrow startup compatibility shim that removes/normalises
  `swizzle` on three's three reusable descriptor instances restores the WebGPU
  path. Epoch does not use component swizzling, so dropping the property is
  behaviour-neutral.
- **Care:** must be a contained, clearly-commented shim with an upstream-issue
  reference and a removal condition — not a vendored fork of three, and not
  scattered patches. Confirm on the owner's real target browser too; the
  finding here is from headless Chromium 141.

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
WebGL2 fallback rather than real defects. Re-check them on WebGPU after P0-2.
