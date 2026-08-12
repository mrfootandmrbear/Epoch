# Baseline — Phase 0

**Date:** 2026-08-12 · **Commit:** see `WU-000` in `LOG.md`
**Evidence:** `evidence/baseline/` (WebGL2 fallback, 1600×900, 9 shots)
**Counter-evidence:** `evidence/baseline-webgpu-blackscreen/` (WebGPU, all black)

## Technical inventory

| | |
|---|---|
| Engine / renderer | Three.js 0.185.1, `WebGPURenderer` + TSL, WebGL2 fallback |
| Language / build | TypeScript 5.9, Vite 6, `type: module`, build target `esnext` |
| Tests | Vitest — 28 files / 94 tests, **all passing**; `tsc --noEmit` clean |
| Target platform | Modern Chromium desktop. Safari knowingly unsupported (THESIS §6) |
| Scale contract | 1 world unit = 1 metre (`src/render-scale.ts`) |
| Tone mapping | ACES Filmic, exposure 0.6 |
| Shadows | Single 2048² directional map covering the island |
| Post | TSL grading + restrained bloom; optional full-res GTAO |
| Ocean | Tessendorf/JONSWAP FFT, Fresnel, analytic sky reflection, foam |
| Determinism | Capture mode: seed `0xe90c4`, frozen time, forced `day` profile |

**Gameplay loop:** sculpt bare island (raise / carve / place hot spot) → set
climate forcings (rainfall, temperature, wind, sea level, volcanic output) →
choose jump duration (1 yr … 1 Myr) → reveal transition → landing state →
explore, reshape, jump again. World age accumulates; terrain and lineages
persist across jumps.

**Playable content today:** one procedural island, the full jump ladder, six
reveal treatments, two grazer lineages, one coastal-forager fish lineage,
vegetation guilds (broadleaf / conifer / windswept / mangrove), seagrass,
streams, freshwater basins, and a volcanic lifecycle.

## Two blocking defects

Both are in `BACKLOG.md` with full detail. Summarised because they define what
this baseline is worth:

1. **`npm install` fails on a clean clone** (corrupt `package-lock.json` entry).
2. **The WebGPU path renders nothing on Chromium 141+.** three 0.185.1 passes
   `swizzle: 'rgba'` where Chromium now requires a dictionary; every
   `createView()` throws. All nine WebGPU frames are pure black while the FPS
   counter still reports "WebGPU · 60 fps" — the animation loop runs, only
   rendering fails.

**Consequence for this baseline:** every image below is from the WebGL2
fallback, which THESIS §6 explicitly rules out as a visual target. Post-
processing behaviour in particular may differ. **All visual scores are
provisional and must be re-taken on WebGPU after P0-2 clears.**

## Performance

**No trustworthy number was obtained.** The sandbox rasterises in software
(ANGLE/SwiftShader) and runs headless, where `requestAnimationFrame` is
throttled. Readings: "60 fps" on WebGPU *while drawing nothing*, and 0–1 fps on
the WebGL2 fallback (31–54 s per frame). Neither measures the product. Target is
therefore inherited from THESIS's platform commitment rather than measured:
**60 fps at 1080p, WebGPU, modern Chromium desktop, foreground tab.** See
`DEFERRED.md` — this needs one manual reading on the owner's machine.

## Unaudited observations

Noticed while capturing. **These are observations, not triaged backlog items** —
Phase 1 has not run. Several may be fallback artifacts; re-check on WebGPU.

**Deep-time legibility (load-bearing per THESIS §5)**
- 1 yr → 1 kyr reads clearly (bare rock → vegetated). 1 Myr reads clearly
  (visible coastline retreat, smaller island).
- **1 kyr and 100 kyr are near-indistinguishable at whole-island scale.** The
  middle of the ladder does not communicate 100× more elapsed time. Worth
  raising against `RENDERER-ROADMAP.md`'s current "the four rungs are now
  visually distinguishable" — that page's verdict is still **Candidate**
  awaiting an owner verdict, so this is input to that gate, not a contradiction
  of an accepted claim.

**Ocean**
- The ocean is a **finite plane with hard straight edges** visible in every
  whole-island shot, plus dark wedge "skirts" in the lower corners and a seam
  where the plane ends against the sky. This is the single most immersion-
  breaking element in the set.
- Large white foam patches sit in open water, detached from any shoreline
  (clearest in `08-dawn`, `09-storm`); they read as artifacts, not surf.
- At whole-island distance the surface reads flat and matte — no wave structure.

**Atmosphere / lighting**
- Sky is a flat gradient with no clouds and no visible solar disc in these
  framings.
- `08-dawn` and `09-storm` are barely distinguishable from the default day
  frames. The climate/time-of-day moods are not reading as distinct.
- Overall image is low-contrast and hazy; lighting has no strong directional
  intent.

**Vegetation / environment**
- Trees are an evenly scattered "popcorn" distribution — uniform spacing,
  near-uniform size, no clustering into stands, no undergrowth or ground cover.
- **`06-forest-interior` contains no forest** — two trees on a bare hillside.
- Tree trunks read very dark, near-black.

**Life**
- `07-herd` contains no animals — **this is correct behaviour, not a defect.**
  Non-flying terrestrial animals arrive only via **Distant Drifter**, and a
  drifter delivers an energy-limited founder cohort that must survive a *further*
  jump to establish. Capture mode never clicks the button and advances only once,
  so grazers cannot exist in any current capture.
- **Real finding — evidence-harness gap:** the `herd` golden camera is
  unreachable by automated capture. Fauna therefore cannot be visually evaluated
  at all today, which blocks judging THESIS §5's explicit spike requirement of
  "a small population rendered with visible trait variation." Closing this needs
  a capture path that introduces a drifter and then advances again (e.g. a
  `&drifter=established` parameter) — a code change, so a Work Unit, not Phase 0.
- Birds are flat white slivers.
- Seagrass sprigs in `05-shoreline` appear to sit on the water surface rather
  than below it.

**Terrain / materials**
- Close range (`07-herd`) is featureless and soft — no detail normal reads,
  and low-frequency brown mottling looks like blotching rather than soil.
- No rock faces, cliffs, or exposed strata anywhere; silhouettes are uniformly
  soft and rounded.
- A soft dark diagonal band crosses the lower-centre of `07-herd` — possible
  shadow-map artifact, needs confirming.

**Micro-polish**
- No favicon; the browser's default `/favicon.ico` request 404s on every load.
  It is the only console error in a clean run.

## Starting scorecard

See `SCORECARD.md`. Summary: nothing is inflated, several categories are marked
**unassessed** rather than guessed, and the whole card is provisional pending a
WebGPU recapture.
