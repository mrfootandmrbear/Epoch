# Backlog

> **Updated:** 2026-08-13 (Phase 1, live-world slice).
> Ranked by **impact ÷ (cost × risk)**. Impact 1–5 = how much a new player
> notices in the first 60 seconds. Cost 1–5 = token/session cost to fix
> properly *including evidence and review*. Risk 1–3 = chance of breaking
> something that currently works.
>
> **This list is incomplete by design.** Phase 0 recorded only baseline
> blockers. Phase 1 has now audited the **live world** (fish, drifter, water,
> herds, coral, lighting) on the real WebGPU backend — see the `LW-#` items
> below. The remaining polish domains (geometry, textures, image quality,
> physics/collision, UI/HUD, micro-polish) are **still un-audited**.

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

## Phase 1 — live-world visual audit (WU-001, 2026-08-13)

A hostile-reviewer pass across the six live-world subsystems the owner named —
**fish, drifter, water, herds, coral, lighting** — driven through the
deterministic capture URLs on the **real WebGPU backend** in the browser pane.
This is stronger evidence than the Phase 0 scorecard, which was taken on the
WebGL2 fallback THESIS §6 rules out.

**Two caveats bound everything below.**

1. **Frozen frame.** The pane throttles `requestAnimationFrame`, so every shot is
   a still at `time=42`. This pass judged composition, colour, form, materials
   and lighting. It did **not** judge motion — swim, gait, water/foam animation,
   drifter bob, secondary motion — or fps. Items flagged "(still-frame read)"
   may soften once motion runs on the owner's machine.
2. **Owner-verdict gate.** These are prepared observations, not accepted
   defects. None self-certifies through the gate in `CLAUDE.md`.

Domains **not** covered by this slice: geometry, textures, image quality,
physics/collision, UI/HUD, micro-polish. Still un-audited.

### Ranked by impact ÷ (cost × risk)

| ID | Finding | Impact | Cost | Risk | Score |
|---|---|:--:|:--:|:--:|:--:|
| LW-1 | Fish camouflaged into near-invisibility | 3 | 1 | 1 | **3.00** |
| LW-2 | Plate/encrusting corals read as flat cutouts | 3 | 2 | 1 | **1.50** |
| LW-3 | Foam reads as artifacts | 3 | 2 | 1 | **1.50** |
| LW-4 | Cascade/whitewater reads as white scratches, clips terrain | 4 | 2 | 2 | **1.00** |
| LW-5 | Drifter arrival undersold (framing) | 2 | 2 | 1 | **1.00** |
| LW-6 | Lighting undifferentiated across dawn/day/storm | 4 | 3 | 2 | **0.67** |
| LW-7 | Ocean cannot express a rough sea | 4 | 4 | 2 | **0.50** |
| LW-8 | Herd within-population uniformity + flat coats | 2 | 3 | 2 | **0.33** |

> **Raw-impact note.** LW-4 is the single highest-*visibility* eyesore (it is in
> nearly every wide framing); its mid-pack score reflects cost and risk, not how
> much it hurts. If a slice optimises for "make the world stop looking broken,"
> LW-4 leads. If it optimises for score, LW-1 leads.

### Recommended slice sequence

- **Slice A — cheap legibility wins (one WU).** LW-1 + LW-3, and LW-2 if
  capacity holds. All low-cost, low-risk, each independently visible. Best
  return per session.
- **Slice B — the whitewater anchor (one WU).** LW-4 on its own: it is the
  freshest system and the drape/clipping needs care, so it earns a dedicated
  unit with before/after evidence.
- **Slice C — lighting intent (one WU).** LW-6. Touches grading globally; keep
  it isolated so a regression is easy to bisect.
- **Slice D — sea-state (one larger WU, or split).** LW-7. Needs a new
  wind/storm tier plus amplitude/foam tuning verified against the "gelatinous"
  failure mode. The biggest gap against the water reference bar and the biggest
  unit; do not fold it into another slice.
- **Deferred cosmetic:** LW-5, LW-8. Real but low first-60s impact; park until
  the above land.

### LW-1 · Fish are camouflaged into near-invisibility
**Impact 3 · Cost 1 · Risk 1 · Score 3.00 · Status: OPEN**

The `fish` hero camera (`?shot=fish&fixture=mature-warm-reef&fish=candidate`)
shows almost nothing. Three compounding causes in `fish-renderer.ts`:

- **Colour matches the medium.** `color.setHSL(0.51 - warmth*0.18, …)` at
  `fish-renderer.ts:156` resolves the showcase traits to ≈`HSL(0.39, 0.38, 0.52)`
  — a muted green-cyan sitting on top of the teal water column, so the fish
  read as water.
- **Sparse and small.** `showcaseFish` places 8 fish (`landing-state.ts:988`) at
  ≈0.9 m each; at the ~11 m camera distance they never mass into a shoal.

- **Hypothesis:** push hue off the water band and lift lightness/contrast; a
  small count/size bump helps but colour is the load-bearing fix.
- **Care:** the 0.35–1.4 m manifest contract in `fish-renderer.ts:124` is real;
  keep body length inside it.

### LW-2 · Plate/encrusting corals read as flat cutouts
**Impact 3 · Cost 2 · Risk 1 · Score 1.50 · Status: OPEN**

In the `reef` shot the branching and massive corals read well, but the thin
pink/purple encrusting plates float above the sand as flat billboards — paper
cutouts rather than crusts fused to the substrate. Owner art bible: stylised is
fine, arbitrary is not; a flat plate does not read as a living form.

- **Repro:** `?shot=reef&fixture=mature-warm-reef` — the flat plates lower-centre.
- **Hypothesis:** give the encrusting morph thickness and seat it onto terrain
  normals in `coral-geometry-assets.ts` / `coral-renderer.ts`.

### LW-3 · Foam reads as artifacts
**Impact 3 · Cost 2 · Risk 1 · Score 1.50 · Status: OPEN**

A heavy continuous bright-white band rings the entire shoreline, and detached
white foam blobs sit in open water with nothing generating them (clearest in
`?shot=dawn`). Both read as decals, not aerated water. Matches the Phase 0
scorecard VFX note (foam = "detached open-water patches that read as artifacts").

- **Hypothesis:** break the shoreline band's uniformity and gate open-water foam
  on wave steepness rather than a static mask.

### LW-4 · Cascade/whitewater reads as white scratches and clips terrain
**Impact 4 · Cost 2 · Risk 2 · Score 1.00 · Status: OPEN**

The highest-visibility eyesore — present on the volcano flanks
(`?shot=reef-above&fixture=mature-warm-reef`), on slopes in the wide island
shots, and worst up close at the contrast-herd pond, where the stream renders as
a flat translucent sheet clipping **through** the terrain rather than running on
it. The code already names the failure mode: `cascade-renderer.ts:371` comments
that white "reads as a snow patch rather than a pool," and `foamColor 0xeef9ff`
(`cascade-renderer.ts:297`) is winning the whitewater mix.

- **Repro:** `?shot=coat-detail&herd=contrast` — the pale ribbon into the pond.
- **Freshness:** this is the newest system (commit `2d22874`, "Salvage
  cascade/whitewater renderer onto current terrain"), so it is the least tuned.
- **Hypothesis:** two problems, not one — (a) the whitewater factor is too high
  so the creek colour never shows; (b) the cascade geometry does not drape to
  the terrain surface. Fix both; a colour-only fix leaves the clipping.
- **Care:** dedicated WU with before/after evidence — do not fold into a slice.

### LW-5 · Drifter arrival is undersold
**Impact 2 · Cost 2 · Risk 1 · Score 1.00 · Status: OPEN**

The raft models correctly (logs + greenery + 3 founders,
`distant-drifter-renderer.ts`), but at the default gameplay camera it sits as a
distant speck at world `(92, sea, 86)` and the zoom clamps well back, so the
founder cohort — the whole point of the moment — never resolves. A framing gap,
not a defect.

- **Repro:** live app → Arrival → Distant Drifter; the raft is a speck at SE.
- **Hypothesis:** a brief camera push-in on reveal, or a nearer clamp while the
  drifter is active, so the arrival reads as an event.

### LW-6 · Lighting is undifferentiated across dawn / day / storm
**Impact 4 · Cost 3 · Risk 2 · Score 0.67 · Status: OPEN**

Confirms the Phase 0 scorecard on real WebGPU: `?shot=dawn`, default day, and
`?shot=storm` all resolve to the same hazy mid-tone. Dawn's warm tint reaches
only the sky and the birds, never the terrain or water; storm merely dims the
sky. This flattens the epoch-rung and time-of-day legibility THESIS treats as
load-bearing.

- **Hypothesis:** per-profile grading and key-light colour/contrast in
  `atmosphere-renderer.ts` / `post-processing.ts`, reaching the ground plane and
  water, not just the sky dome.
- **Care:** grading is global; isolate the WU so a regression bisects cleanly.

### LW-7 · The ocean cannot express a rough sea
**Impact 4 · Cost 4 · Risk 2 · Score 0.50 · Status: OPEN**

Water is roughly half of most frames and is always glassy — including the
`storm` shot, which only swaps the sky profile. The cause is systemic, not a
shot:

- Only three wind regimes exist — `calm` (4 m/s), `westerly`/`easterly`
  (18 m/s) — with **no storm/gale tier** (`climate.ts:33`).
- Swell is deliberately damped to `swellAmplitudeScale: 0.22`
  (`render-scale.ts:10`) to avoid a "gelatinous" low-frequency heightfield
  (`main.ts:695` comment).

The result contradicts the owner's confirmed water reference (storm chop, foam
streaks, swell + chop together) and the Water-Pro bar in THESIS §6.

- **Hypothesis:** add a storm wind tier and let sea-state drive amplitude/foam,
  re-tuning the 0.22 damp upward for higher winds without reintroducing jelly at
  island scale.
- **Care:** the 0.22 damp exists for a reason; changing it needs evidence across
  calm→storm, not a single shot. Biggest unit here; may split.

### LW-8 · Herd within-population uniformity + flat coats
**Impact 2 · Cost 3 · Risk 2 · Score 0.33 · Status: OPEN (partly still-frame)**

**First, the strength this qualifies:** cross-population trait divergence reads
clearly — `?shot=coat-detail&herd=contrast` shows the nimble population (tall,
long-legged, long-horned, light) unmistakably apart from the bulky one (low,
heavy, hornless, dark). That is the art-bible requirement met; **do not
regress it.**

The weaknesses are within a single population:

- **Uniform pose (still-frame read).** Every animal in one population holds an
  identical stance. Pose is time-driven, so live desync will soften this — re-
  judge in motion before investing.
- **Flat matte coats.** No pattern or close-range coat structure, and feet are
  simple points that do not "read substrate" per the art bible. Real, but low
  first-60s impact.

- **Care:** confirm the pose complaint against a moving capture on the owner's
  machine before treating it as real; it may be mostly the frozen frame.
