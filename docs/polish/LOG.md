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

## WU-001 · Rectangular shallow-water ring around the island (2026-08-13)

**Hypothesis.** Owner-reported: a lighter, unnaturally rectangular patch of
water sits around the island, present since the early adaptation from
Habitat. `fft-water.ts` colors water "shallow" (light `shallowColor`) versus
"deep" (dark `deepColor`) by sampling `terrainHeightTexture` and comparing to
sea level; that texture only covers the 380m terrain-simulation square
(`RENDER_SCALE.islandExtent`), falling back to a hardcoded `-40` outside it.
If the real seabed *inside* that square, away from the island itself, sits
much shallower than `-40`, the whole square would read as false "shallow"
water against correctly dark ocean beyond it — a seam shaped like the
texture's square, not the island's round coastline.

**Change.** Confirmed in `starting-world-presets.ts`: all three starting-world
height functions (`weatheredIsland`, `youngVolcano`, `drownedRidges`) go flat
to a small constant (-3.2 / -4.5 / -5.4) everywhere beyond their island/shelf
falloff radius — only 3-8m below sea level, well inside `fft-water.ts`'s
shallow band (`waterDepth < 10`). That flat plateau covers nearly the entire
380m domain outside the visible landmass. Replaced the flat tail with
`deepenBeyondShelf()`: a radial falloff (matching each preset's own distance
metric) that deepens by up to 22m over a 90m band past the shelf radius, so
the seabed reads properly deep well inside the domain, and the deep/shallow
transition now follows a round radius from the island instead of the square
texture footprint. Land and near-shore shelf heights are untouched — the new
term only kicks in past each preset's existing falloff radius.

**Evidence.** `npx tsc --noEmit` clean; `npm run test` 44 files / 232 tests
pass (this checkout's actual count — `CLAUDE.md`'s "28 files / 94 tests" is
stale). WebGL2-fallback captures (`whole-island` camera, years=1 and
years=1000, before/after) show the near-island water tightening from an
almost-imperceptible blend that ran flat to the frame edge into a visibly
bounded, correctly *round* halo with real contrast against deep water beyond
it — see `01-island-1yr` and `02-island-1kyr` before/after crops from this
session. Per `CLAUDE.md`, WebGL2 evidence is provisional; this needs a real
WebGPU-hardware look to confirm the halo shape and that no new seam appears
at the shelf-to-abyssal transition band.

**Verdict.** Fix applied, tests/typecheck green, WebGL2 evidence supports the
diagnosis and shows the intended shape change. **Ready for owner verdict** —
not scored or marked accepted here. Worth a look at whether `BASELINE.md`'s
"finite plane with hard straight edges" note (written pre-far-water-skirt) was
partly this same bug wearing a different description.

**Correction (same day):** owner checked WU-001 on real WebGPU hardware and
it was worse in a different way — not a rectangle anymore, but a hard-edged
bright disc, "like a floating island." See WU-002.

---

## WU-002 · WU-001's radial fix was too abrupt (2026-08-13)

**Hypothesis.** WU-001 made the seabed deepen radially starting at each
preset's shelf radius, reaching full depth over a nominal 90m band. But
`fft-water.ts`'s shallow/deep blend only reacts within `waterDepth` 0.7–10m,
and the shelf's baseline (-3.2m, i.e. 3.2m deep) already sits inside that
window — so in practice the visible transition collapsed to ~28m of radial
distance before `shallowFactor` saturated at 0. Separately, the 380m
terrain-simulation square only leaves the island's real coastline ~30m of
buffer to the domain edge in the tightest (axis-aligned) direction, per
`RENDER_SCALE.islandExtent`. Widening the *height-based* falloff further
doesn't fit that budget without leaking shallow color past the literal
domain edge in that direction (reintroducing WU-001's rectangle, just with
extra steps) — the two failure modes trade off against each other as long as
softness has to be carried entirely by the sampled depth data.

**Change.** Consulted `.agents/skills/design-webgpu-solutions/SKILL.md`
before touching the TSL shader. Added a second, independent fade in
`fft-water.ts`, driven by plain world-space radius from the island's center
rather than sampled depth — decoupling visual softness from the depth
texture's narrow reactive window entirely. The fade band is sized per-ray
using the square domain's actual distance-to-edge along that direction
(`terrainSize/2 * distFromCenter / max(|x|,|z|)`), so it automatically uses
whatever buffer really exists: as little as ~26m on-axis (162→188, staying
just past the outermost coastline point of any starting-world preset, 158m
for weathered-island), growing toward ~90m+ off-axis and at the corners,
where the square is farther from the island in every direction. This
multiplies into the existing `shallowFactor`, so it softens both color and
opacity/transmission together rather than introducing a second visible seam.
The WU-001 height-side change is kept — it still keeps the real depth data
honest for anything else that reads seabed depth — but is no longer relied
on to carry visual softness by itself.

**Evidence.** `npx tsc --noEmit` and `npm run test` (44 files / 232 tests)
clean. WebGL2 headless crops at the `whole-island`/1yr framing came back
pixel-identical before/after this change — inconclusive, not contradictory:
that framing's visible foreground appears to stay inside the fade's start
radius, so it was never going to show the effect. Per the WebGPU skill and
`CLAUDE.md`, headless/WebGL is diagnostic only; **this needs the owner's live
WebGPU check** (in progress this session) to confirm the edge actually reads
as soft now, not just mathematically wider.

**Verdict.** Candidate, unverified. Do not treat WU-001 or this entry as
resolved until confirmed live.

**Correction (same day):** owner's direction after seeing WU-002 live: the
water depth right at the playable domain's outside edges is the actual
target, and the right default is a *more rapid* seabed decline close to the
island, not a wider soft blend — the player can raise more land if they want
more shallow water. See WU-003.

---

## WU-003 · Steep seabed drop-off instead of a wide blend (2026-08-13)

**Hypothesis.** Owner call: fighting to fit a gradual, wide blend into the
domain's tight edge buffer (WU-002) was the wrong shape of fix. Depth should
fall to genuinely deep water *quickly*, right past each preset's shelf, so
the transition sits close to the coastline where a steep drop reads as
geology (a fringing shelf edge) rather than as a rendering seam sitting in
the middle of open water. This is also just less code: no shader-side fade
needed if the underlying depth data itself is unambiguously deep almost
everywhere beyond the shelf.

**Change.** Reverted WU-002's `fft-water.ts` world-space `shelfFade` entirely
— back to the original `shallowFactor` expression, minus the now-unused
`abs` import. In `starting-world-presets.ts`, tightened `deepenBeyondShelf`'s
falloff band from 90m to 20m and increased the total drop from 22m to 37m
(baseline -3.2/-4.5/-5.4 → roughly -40 across all three presets, matching
`fft-water.ts`'s own out-of-domain fallback depth almost exactly, so the two
don't disagree at the literal domain edge either). Deep water now starts
within ~20m of each preset's shelf radius instead of ~90m out.

**Evidence.** `npx tsc --noEmit` and `npm run test` (44/232) clean. Owner is
checking live on WebGPU hardware this session — headless WebGL captures were
inconclusive for WU-002's version and are not repeated here as authoritative;
per the WebGPU skill, only the live check counts for this class of change.

**Verdict.** Candidate, pending live confirmation.

**Session stopped here at owner's request.** Owner's read: too many rounds of
"here's a change, does this look right?" without me forming and defending my
own judgment from the evidence already in hand — see
`feedback_iterate_dont_defer_visual_judgment` in memory. Status below is the
honest stopping point, not a resolution.

### Where this actually stands

- **`fft-water.ts` is back to the pre-session original** — WU-002's world-space
  `shelfFade` was added, then fully reverted in WU-003; the debug-color swap
  used to diagnose WU-003 was also reverted. `git diff` on this file is empty.
- **`starting-world-presets.ts` still carries WU-001 → WU-003's net change**:
  `deepenBeyondShelf()` now drops each preset's ocean floor to roughly -40m
  within ~20m past its shelf radius, instead of sitting flat at -3.2/-4.5/-5.4m
  all the way to the domain edge. This part is on solid ground — confirmed via
  a debug-color pass (flat magenta/green swapped in for shallow/deep) that the
  wide turquoise apron around the island is the island's own intended slope
  (owner-confirmed: "most islands start with a very shallow area all around
  them... it's the slope of the island"), not the original bug. The original
  literal-rectangle defect (square domain edge visible as a color seam) is
  fixed by this change and not in question.
- **Unresolved:** whether the shelf-to-deep-water color transition itself —
  `shallowColor` (0x008ca7) to `deepColor` (0x041c26), and a bright white rim
  that appears at that boundary in the last real-color screenshot this
  session — reads as a natural reef edge or as an artifact. Last screenshot
  looked plausibly like a real lagoon/reef-crest pattern (turquoise shelf,
  white surf line, dark open ocean) rather than the earlier "floating
  island"/"sunken basin" versions, but this was never confirmed either way
  before the owner ended the session — **do not treat it as accepted.**
- The white rim was not investigated. It could be `openWater()`'s specular/
  Fresnel term catching a consistent wave-normal angle at that radius, actual
  shore-adjacent foam bleeding wider than intended, or something else —
  nobody looked at the shader for it yet.

### Next session should

1. Look at the current real-color state fresh (a live WebGPU screenshot, not
   assumptions from this log) before changing anything.
2. If the white rim reads as wrong, trace it in `fft-water.ts` — likely
   `specular`/`fresnel` in `openWater()` or the `shoreFoam` band — rather than
   touching `starting-world-presets.ts` again; the seabed shape work here is
   probably done.
3. Only then decide whether `shallowColor`/`deepColor` themselves (not their
   spatial falloff, which has now been tuned three different ways) need
   adjusting — e.g. less contrast between them — if the transition still
   reads as a hard edge rather than a reef crest.
4. Get an explicit owner verdict before calling any part of this resolved;
   nothing in WU-001 through WU-003 has one yet.
