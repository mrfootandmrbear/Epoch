# Repo map

> **Purpose:** Let a fresh session act without re-exploring the repository.
> **Updated:** 2026-08-12 (Phase 0).
> Re-read this instead of globbing `src/`. If it is stale, fixing it is its own Work Unit.

## What Epoch is

A single-page WebGPU/Three.js deep-time island simulator. The player sculpts a
bare island, sets climate forcings, picks a jump duration (1 year → 1,000,000
years), and watches a reveal transition into a resolved landing state. Design
intent now lives in `PRODUCT.md`; it is the authority on what the game is for.

## Build, run, test

| Task | Command |
|---|---|
| Install | `npm install` — **currently broken on clean clone**, see BACKLOG P0-1. Workaround: `npm install --no-package-lock --no-save` |
| Dev server | `npm run dev` (Vite, port 5173) |
| Build | `npm run build` (`tsc && vite build`) |
| Test | `npm run test` (Vitest, 55 files / 379 tests) |
| Typecheck only | `npx tsc --noEmit` |
| Asset validation | `npm run asset:check -- assets/ecosystem/<asset-id>` |
| **Evidence capture** | `node scripts/capture.mjs --set baseline2km --webgl` — see below |
| Simulation readout scripts | `node --import ./scripts/ts-resolve.mjs scripts/<name>.ts` — the loader lets a script import `src/` with the extensionless specifiers Vite resolves and plain Node does not |

## Capture harness

Two layers, both deterministic:

1. **In-app capture mode** (pre-existing, `src/main.ts`): the URL query
   `?shot=<name>&years=<n>&time=<n>` pins the RNG seed to `0xe90c4`, freezes
   simulation time to `time`, forces the `day` atmosphere profile, applies a
   fixed golden camera, hides all UI (`body.capture-mode`), and sets
   `document.documentElement.dataset.captureReady = "true"` once a frame has
   rendered. `&volcano=vigorous|active|waning|extinct` places a fixed hot spot.
   Golden cameras are declared in `src/presentation.ts` (`GOLDEN_SHOTS`).
2. **`scripts/capture.mjs`** (added Phase 0): drives that mode through headless
   Chromium, writes per-shot PNGs plus a tiled `contact-sheet.png` and a
   `manifest.json` recording backend, timings, and console errors.

```bash
node scripts/capture.mjs --set baseline2km --webgl       # current 9-shot baseline
node scripts/capture.mjs --set baseline --webgl          # pre-2 km, evidence only
node scripts/capture.mjs --set detail --webgl            # volcanic + secondary cameras
node scripts/capture.mjs --set baseline --only 02-island --webgl   # single shot, fast iteration
```

Flags: `--set` (`baseline2km`|`shield2km`|`baseline`|`detail`|`ui`), `--out`, `--width`, `--height`,
`--settle`, `--only <substring>`, `--webgl`, `--port`.

`--webgl` hides `navigator.gpu` to force the WebGL2 backend. It is required for
usable images in GPU-less environments, which cannot reach WebGPU at all. Do not
pass `--unsafe-webgpu` to work around that: it exposes experimental IDL members
a shipping browser lacks and produces failures no real player sees (BACKLOG
P0-2, retracted).

Shot sets are the fixed comparison basis for every A/B. Add a new set rather
than editing an existing one; editing invalidates all prior evidence.

The `baseline`/`detail` sets and the un-prefixed `GOLDEN_SHOTS` predate the 2 km
world and are kept only so pre-resize captures stay readable. **Do not A/B a new
capture against one of them** — they frame roughly a fifth of the current world,
so the subject moved, not the renderer. Use `baseline2km` / `shield2km` and the
`w2k-` cameras.

## Source layout (`src/`, 38 modules + 28 test files, ~7.6k lines)

The codebase holds a deliberate seam: **simulation state is separate from
rendering.** Respect it — `AGENTS.md` calls it out explicitly.

### Entry / composition
- `main.ts` (511) — scene, camera, renderer, controls, UI wiring, render loop,
  capture-mode plumbing. The only place all subsystems meet.
- `index.html` (~530) — all markup *and* all CSS inline, including the HUD,
  `#experience` control panel, `#epoch-card`, `#lineage-panel`, `#jump-veil`.

### Simulation (renderer-independent)
- `landing-state.ts` (896) — largest module; orchestrates the resolved landing.
- `outcome-resolver.ts` (799) — resolves a landing snapshot directly from
  terrain + climate rather than stepping every year (keeps deep time fast).
- `world-snapshot.ts` — one immutable sampled snapshot per jump.
- `climate.ts` — `DEFAULT_CLIMATE`, `SEA_LEVEL`, whole-island forcings.
- `terrain-history.ts` — persistent substrate; erosion accumulates across jumps.
- `volcanism.ts` — hot-spot lifecycle (vigorous → active → waning → extinct).
- `archipelago-history.ts` — fixed mantle hotspot, drifting crust, the shield
  chain it leaves. Knows where shields *are*, deliberately not which share land.
- `island-geography.ts` — that second question, resolved from the heightfield:
  land components above sea level, and the saddle elevation between every shield
  pair, from one descending-elevation join tree. Also holds `SeaLevelHistory`,
  which turns a saddle elevation into the years a land connection existed.
- `stream-network.ts`, `freshwater-basins.ts`, `water-volume.ts` — hydrology.
- `population-traits.ts`, `population-archetypes.ts`, `lineage-history.ts`,
  `marine-lineage.ts`, `founder-establishment.ts`, `animal-navigation.ts` —
  ecology, trait inheritance, dispersal, herd movement.
- `world-history.ts`, `epoch-story.ts` — accumulated narrative across jumps.
- `render-scale.ts` — **one world unit is one metre.** Shared contract anchoring
  island extent, organism size, wave amplitude, camera distance, LOD thresholds.
  **The world is 2,000 m at 401×401 cells (5.0 m/cell) since 2026-08-15**; it was
  380 m at 181×181 before that, so anything written against the old numbers is
  stale. `islandLandRadius` (445 m) is separate from `islandExtent` on purpose —
  scatter over *land* keys to the former, the crust frame to the latter.

### Rendering
- `fft-ocean.ts` (375) + `fft-water.ts` (271) — Tessendorf/JONSWAP FFT ocean.
- `terrain-material.ts`, `terrain-material-state.ts`, `terrain-detail-renderer.ts`
- `vegetation-renderer.ts`, `seagrass-renderer.ts`, `stream-renderer.ts`,
  `freshwater-renderer.ts`, `atmosphere-renderer.ts`
- `post-processing.ts` — TSL grading, bloom, optional GTAO.
- `tree-geometry-assets.ts`, `seagrass-geometry-assets.ts` — load build-time
  generated geometry JSON from `assets/ecosystem/*/runtime/`.

### Presentation
- `presentation.ts` — `GOLDEN_SHOTS` + idle attract-mode camera tour.
- `reveal.ts` — six jump-reveal treatments across three philosophies.
- `lineage-report.ts`, `marine-lineage-report.ts` — HTML for the lineage panel.

## Assets

`assets/ecosystem/<asset-id>/` with `source/` (generators), `runtime/` (JSON
geometry consumed at load), `previews/`. Present: `epoch-canopy-tree`,
`epoch-seagrass-meadow`, `example-marsh-grazer`. Trees come from a pinned
`@dgreenheck/ez-tree` build-time generator; Epoch supplies its own faceted
foliage, materials, instance colors, and LOD batching.

## Retired tracker system

This map records the former tracker system for historical evidence. Current
authority is defined in `docs/README.md`; `docs/polish/` must not claim visual
acceptance:

- `PRODUCT.md` — product direction.
- `docs/ARCHITECTURE.md` — system ownership and boundaries.
- `docs/EXECUTION.md` — current status, sequence, and gates.
- `HABITAT_REVIEW.md` — what the predecessor proved / what to leave behind.
- `AGENTS.md` — asset-family workflow, one agent task per bounded asset family.

Note the project's **owner-verdict gate**: a renderer capability is not "Built"
until automated checks pass *and* a human owner records a visual verdict. Polish
work can prepare evidence for that gate but cannot self-certify through it.
