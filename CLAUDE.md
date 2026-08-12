# Epoch — invariants for every session

Auto-loaded context. This holds only what must survive a context reset. Product
direction is `THESIS.md`; repo navigation is `docs/polish/MAP.md`; current work
state is `docs/polish/BACKLOG.md` + `SCORECARD.md` + `LOG.md`.

## Session opening ritual

Read `docs/polish/BACKLOG.md`, `docs/polish/SCORECARD.md`, and the tail of
`docs/polish/LOG.md`. **Do not re-explore the repository** — that is what
`MAP.md` is for. One Work Unit per session; never end mid-Work-Unit.

## Art-direction bible

Derived from `THESIS.md` §6. THESIS wins any conflict.

- **Stylized is allowed; arbitrary is not.** Simplify forms, exaggerate
  silhouettes, use authored color and proportion — but every stylization must
  make *plausible adaptation* or *change across a jump* more legible. Beauty
  that obscures what an epoch did to the island is a defect.
- **No fantasy variants.** Creatures are populations that evolved in response to
  *this* island. Limb proportions read terrain; feet read substrate and
  inundation; insulation and body mass read climate; coloration reads habitat;
  feeding structures read niche. A player should be able to look at a descendant
  and reasonably guess where and how it lives.
- **Descendants must stay visibly related.** Shared base rig and shared palette,
  even as island pressures pull silhouettes apart.
- **Water/atmosphere reference bar:** Three.js Water Pro — FFT waves, Fresnel,
  subsurface scattering, caustics, real-time foam, dynamic sky. This is a
  concrete target, not a mood board.
- **Restraint is polish.** "AAA" never means "more effects." Every effect needs
  a stated purpose; effects soup is a defect.
- **Legibility of deep time is the point.** The four epoch rungs (1 / 1k / 100k
  / 1M years) must remain visually distinguishable. Any change that flattens
  the difference between rungs is a regression regardless of how good one frame
  looks.

## Technical invariants

- **Renderer: `WebGPURenderer` + TSL.** This is a committed decision, not a
  default. THESIS §6 states the visual bar means matching that pipeline, *not*
  approximating the look on classic WebGL2. The WebGL2 fallback is a safety net
  and an evidence workaround — **never** a target to tune against.
- **Target platform:** modern Chromium desktop. Safari is knowingly unsupported.
- **One world unit is one metre** (`src/render-scale.ts`). This contract anchors
  island and ocean extents, organism sizes, wave amplitude, camera distances,
  and LOD thresholds. Do not break it locally to make one shot look better.
- **Simulation state stays separate from rendering** (`AGENTS.md`). The resolver
  and lineage models must not learn about meshes, materials, or cameras.
- **Deep-time jumps resolve a landing snapshot directly**, not year-by-year.
  Keep them fast and deterministic.
- **Capture mode must stay deterministic:** fixed seed `0xe90c4`, frozen sim
  time, forced `day` atmosphere, fixed cameras, UI hidden. Evidence is
  worthless if this drifts.

## Performance target

Documented in `docs/polish/BASELINE.md`. Headline: **60 fps at 1080p on the
WebGPU backend on modern Chromium desktop**, measured in a foreground tab.
Automated headless FPS readings are *not* valid perf evidence — `requestAnimation
Frame` is throttled for headless/unfocused tabs and the sandbox has no real GPU.
Check every visual change against the target; a visual gain that costs frame
rate is not a gain.

## Commands

```bash
npm install --no-package-lock --no-save   # plain `npm install` is broken, see BACKLOG P0-1
npm run dev                                # Vite, port 5173
npm run test                               # Vitest, 28 files / 94 tests
npx tsc --noEmit                           # typecheck
node scripts/capture.mjs --set baseline --webgl   # contact sheet evidence
```

`--webgl` is currently mandatory for usable captures (BACKLOG P0-2). Drop it the
moment the WebGPU path renders, and recapture the baseline on WebGPU.

## Do not touch / ownership

- `THESIS.md`, `RENDERER-ROADMAP.md`, `WILDLIFE-ROADMAP.md`, `HABITAT_REVIEW.md`
  are **owner-authored canonical trackers**. `docs/polish/` may reference them
  and prepare evidence for them; it may not mark their gates satisfied.
- **The project uses an owner-verdict gate:** a renderer capability is not
  "Built" until automated checks pass *and* a human records a visual verdict.
  Polish work cannot self-certify through that gate. Say "ready for owner
  verdict," never "accepted."
- Generated asset runtime JSON under `assets/ecosystem/*/runtime/` is build
  output — regenerate via the `asset:*` scripts, do not hand-edit.
- Existing golden shot definitions in `src/presentation.ts` and shot sets in
  `scripts/capture.mjs` are the comparison basis for all prior evidence.
  Add new entries; do not edit existing ones.
