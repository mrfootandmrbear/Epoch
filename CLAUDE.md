# Epoch — invariants for every session

Auto-loaded context. This holds only what must survive a context reset. Product
direction is `PRODUCT.md`; system ownership is `docs/ARCHITECTURE.md`; current
priority is `docs/EXECUTION.md`. Dispatch lives in `docs/briefs/`. `THESIS.md`
and `docs/polish/` are historical sources; they do not set priority.

## Session opening ritual

If this chat names a brief, read that file and the contracts it lists. Otherwise
read `docs/EXECUTION.md` only. **Do not re-explore the repository.** One Work
Unit per session; never end mid-Work-Unit. Do not start the next brief in the
same session.

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
- **One Galápagos-inspired world, not a climate catalogue.** Young/old basalt,
  shield calderas, arid lowlands, fog-fed highlands, mangroves, reefs, and cool
  productive upwelling belong to one regional grammar. Do not expand unrelated
  global biomes or fauna. See `docs/GALAPAGOS-HOTSPOT-PLAN.md`.

## Technical invariants

- **Renderer: `WebGPURenderer` + TSL.** This is a committed decision, not a
  default. THESIS §6 states the visual bar means matching that pipeline, *not*
  approximating the look on classic WebGL2. The WebGL2 fallback is a safety net
  and an evidence workaround — **never** a target to tune against.
- **WebGPU works on the owner's machine.** Automated sandboxes generally cannot
  reach it (no GPU), and forcing it there with `--enable-unsafe-webgpu` exposes
  experimental IDL members that produce failures a real player never sees.
  **Never conclude the renderer is broken from a headless capture** — verify
  with the owner first. Phase 0 got this wrong once; see BACKLOG P0-2 (retracted).
- **Target platform:** modern Chromium desktop. Safari is knowingly unsupported.
- **One world unit is one metre** (`src/render-scale.ts`). This contract anchors
  island and ocean extents, organism sizes, wave amplitude, camera distances,
  and LOD thresholds. Do not break it locally to make one shot look better.
- **Simulation state stays separate from rendering** (`AGENTS.md`). The resolver
  and lineage models must not learn about meshes, materials, or cameras.
- **Deep-time jumps resolve a landing snapshot directly**, not year-by-year.
  Keep them fast and deterministic.
- **Deep time couples geology and population evolution.** The hotspot is fixed,
  crust and shields move, emergent island connections change, and populations
  respond through founder effects, variance, gene flow, isolation, selection,
  drift, radiation, reconnection, contraction, and extinction. Do not resume
  generic erosion tuning before the two-shield architecture is authoritative.
- **Capture mode must stay deterministic:** fixed seed `0xe90c4`, frozen sim
  time, forced `day` atmosphere, fixed cameras, UI hidden. Evidence is
  worthless if this drifts.
- **Use the WebGPU design skill for GPU architecture:** read
  `.agents/skills/design-webgpu-solutions/SKILL.md` when inventing, evaluating,
  prototyping, or integrating a WebGPU, `WebGPURenderer`, or TSL rendering or
  compute system. Follow its evidence and bounded-spike workflow instead of
  translating WebGL-era patterns by default.

## Performance target

Documented in `docs/polish/BASELINE.md`. Headline: **60 fps at 1080p on the
WebGPU backend on modern Chromium desktop**, measured in a foreground tab.
Automated headless FPS readings are *not* valid perf evidence — `requestAnimation
Frame` is throttled for headless/unfocused tabs and the sandbox has no real GPU.
Check every visual change against the target; a visual gain that costs frame
rate is not a gain.

## Commands

```bash
npm install --no-package-lock --no-save   # until WU-P0-1 lands; see docs/briefs/WU-P0-1-lockfile.md
npm run dev                                # Vite, port 5173
npm run test                               # Vitest
npx tsc --noEmit                           # typecheck
node scripts/capture.mjs --set baseline --webgl   # contact sheet evidence (fallback backend)
```

`--webgl` is needed for usable captures in GPU-less environments, which is a
limitation of those environments, not of the game. Captured images are therefore
fallback-backend evidence; treat visual scores taken from them as provisional
until confirmed on real WebGPU hardware.

## Do not touch / ownership

- `PRODUCT.md`, `docs/ARCHITECTURE.md`, and `docs/EXECUTION.md` are the
  maintained contracts. Older roadmaps and `docs/polish/` preserve evidence;
  they do not set priority or mark gates satisfied.
- **The project uses an owner-verdict gate:** a renderer capability is not
  "Built" until automated checks pass *and* a human records a visual verdict.
  Polish work cannot self-certify through that gate. Say "ready for owner
  verdict," never "accepted."
- Generated asset runtime JSON under `assets/ecosystem/*/runtime/` is build
  output — regenerate via the `asset:*` scripts, do not hand-edit.
- Existing golden shot definitions in `src/presentation.ts` and shot sets in
  `scripts/capture.mjs` are the comparison basis for all prior evidence.
  Add new entries; do not edit existing ones.
