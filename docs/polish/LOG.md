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

---

## WU-002 · Slice A — cheap legibility wins (2026-08-13)

**Hypothesis.** LW-1 and LW-3 are both low-cost, low-risk, independently visible
legibility fixes. Land them together for the best return per session; pick up
LW-2 only if capacity holds.

**Change.**
- **LW-1 (fish invisible).** `fish-renderer.ts`: replaced the hue band
  `0.51 - warmth*0.18` (which resolved the warm showcase fish to
  `HSL(0.377,0.382,0.525)`, a green-cyan sitting on the teal water column) with
  a habitat-temperature split — warm fish gold→coral (hue 0.09→0.01), cool fish
  blue→violet (0.60→0.68), both off the water band, with saturation and
  lightness lifted. Size base 0.22 → 0.27 (still inside the 0.35–1.4 m manifest
  contract). `landing-state.ts` `showcaseFish` count 8 → 10 in a tighter cluster
  so the population masses into a shoal at the ~11 m hero camera.
- **LW-3 (foam artifacts).** `fft-water.ts`: `shoreFoam` was gated on shallow
  depth alone, so every shallow patch foamed — a solid bright ring at the true
  shoreline plus detached blobs over submerged flats. Added a `waveEnergy` term
  (`vWave.x` crest height + `length(vWave.yz)` surface slope) and folded it into
  the shore-foam weight and breakup threshold, so only rising/breaking water
  foams. Scallops the ring; starves the flat detached patches.
- **LW-2 not taken** — usage ran low; capacity did not hold. Still OPEN.

**Evidence.** `npx tsc --noEmit` clean; 232/232 tests pass. WebGPU browser-pane
still-frame at the `fish` hero shot confirms the fish now read as vivid orange
forms clearly separated from the water (previously near-invisible). Foam not yet
captured before/after; both fixes carry the frozen-frame + owner-verdict caveats.

**Verdict.** Slice A partially delivered (LW-1 + LW-3). Ready for owner verdict;
not self-certified. LW-2 rolls to a later WU.

**Next.** LW-2 (flat encrusting corals) to close Slice A, then Slice B = LW-4
(cascade/whitewater, its own WU with before/after evidence).

---

## WU-003 · Slice A closeout — encrusting coral volume (2026-08-13)

**Hypothesis.** The pink/purple pioneer crusts read as paper cutouts because
their procedural mesh is an open surface whose outer edge reaches zero height,
then the resolver scales the whole form to only 3.5–7.5 cm. Give the form a
closed fused rim and enough low carbonate relief to survive the reef camera.

**Change.**
- `coral-geometry-assets.ts`: rebuilt crustose algae as a closed manifold with
  upward-facing top geometry, an irregular raised lip, vertical fused rim and
  substrate underside. Added a geometry contract test that every edge has two
  faces and both LODs retain real volume.
- `reef-succession.ts`: raised the encrusting height range to 0.16–0.30 m. The
  form remains low relative to its roughly metre-wide radius; a resolver test
  protects that proportion.
- Regenerated the deterministic near/far reef exports. Because an accepted
  asset changed, returned `epoch-reef-builder-family` to `candidate`, retained
  its prior verdict as history, and added a new WebGPU showcase rather than
  overwriting the accepted baseline.

**Evidence.** `npm run asset:check -- assets/ecosystem/epoch-reef-builder-family`
passes; `npx tsc --noEmit` is clean; 44/44 targeted reef/coral tests pass and
234/234 full-suite tests pass after the final proportion adjustment. A
real in-app WebGPU `reef&mature-warm-reef` frame rendered with 15 draws, no
console warnings/errors, and shows raised centers plus shadowed contact rims in
the foreground crusts. The pane's fps reading is not valid performance evidence.

**Verdict.** LW-2 is ready for owner verdict, not self-certified. Slice A is
code-complete; LW-1, LW-2 and LW-3 all remain pending owner visual acceptance.

**Owner feedback and revision.** The volume-only candidate was judged “closer,”
but rejected because real coral grows on rocks and the visible host was still
missing. The crust mesh now includes a deterministic lumpy rock host plus a
per-vertex tissue/substrate mask; `coral-material.ts` shades the exposed shoulder
as rough wet basalt and suppresses tissue scattering there. The living mantle
covers only the crown. This remains one instanced colony geometry (15 total reef
draws) and does not add or alter simulation state. The second real-WebGPU frame
shows the host/tissue boundary clearly in the foreground, with no console
warnings or errors. The revised package passes its validator, TypeScript, and
236/236 full-suite tests. Status remains ready for a fresh owner verdict.

**Second owner feedback and revision.** Coral also clusters across rocks in the
shallows; one patch on one pebble still read as an isolated specimen. The active
candidate now composes each crust colony from three overlapping, differently
proportioned host rocks and three separate living patches. Exposed rock channels
remain visible between patches, all within the same cached instance and the
same 15 reef draws. The higher first pass breached the established topology
budget, so the final cluster uses 12-sided near / 8-sided far hosts; 48/48
targeted coral/reef tests protect the three-patch grammar and closed geometry.
The full suite passes 237/237 with clean TypeScript and asset validation. The
third real-WebGPU frame has no console warnings or errors and is ready for a
fresh owner verdict.

**Reference clarification and structural revision.** The owner supplied the
Wikipedia *Coral reef* photographs to clarify that “cluster” meant multiple
distinct coral growth forms densely sharing one large accumulated reef
framework—not more pink patches and not more rocks. The resolver now records a
`siteId` on every colony and packs colonies within 1.15 m of their site centre.
The renderer creates one compact, multi-lobed framework only for sites holding
at least three colonies, derives its size from existing cover/framework state,
and lifts all guilds at that site onto the same structure. Encrusting geometry
returns to living tissue only; the substrate is site-owned. This adds one shared
instanced framework batch, not one draw per rock. The first WebGPU pass exposed
oversized flat foundations; the final pass tightened their radius, increased
relief, and suppressed sparse-site foundations. The resulting foreground and
left-side outcrops visibly combine encrusting/plating, branching and massive
forms on shared rock. Asset validation and TypeScript are clean; 237/237 tests
pass. Ready for a fresh owner verdict.

**Fourth owner feedback and continuous-reef revision.** The mixed-form grouping
captured the reference's colony diversity, but its repeated site foundations
still read as placed coral boulders rather than reef. The renderer now adds no
foundation geometry at all: its reef remains twelve colony LOD batches, seated
directly on terrain. The existing simulated carbonate-deposition texture is
lifted into a clearly visible, continuous pale shelf in `terrain-material.ts`,
and encrusting colony footprints overlap within each tightly packed community
to form low living pavement. No ecological rule was changed to manufacture the
composition. The new real-WebGPU candidate records that continuous substrate;
the family remains `candidate` pending the owner's visual verdict.

**Fifth owner feedback and scale/fluorescence revision.** The continuous reef
cluster was closer, but needed a clearer range of colony sizes and the
fluorescent response many corals show under the blue-rich portion of ordinary
reef light. `coral-renderer.ts` now applies a deterministic 0.52–1.0
presentation factor within each colony's already-resolved biological envelope,
creating recruits, intermediates and a few dominant adults without changing
simulation state or exceeding its maximum sizes. `coral-material.ts` adds a
health-dependent fluorescent contribution localized by the existing tissue
mottle and strengthened on translucent growth forms; it disappears with
bleaching and remains subordinate to daylight, water transmission and haze.
The real-WebGPU frame has no console warnings or errors. Owner verdict remains
the exact gate.

**Ninth owner feedback and light-grey revision.** The cool coarse structure was
correct but its palette was too dark. Pavement albedo is now lifted to light
cool grey, roughly 58% of rubble selects pale grey, 36% mid blue-grey, and only
the remaining 6% stays dark as a crevice accent. The coarser colour and normal
frequencies are unchanged, and no warm brown returns. The live WebGPU candidate
has no console warnings or errors and awaits owner verdict.

**Tenth owner feedback and shadow-value correction.** The sparse near-black
rubble tier read as cast shadows rather than rock. Its value is lifted to dark
blue-grey (`#4b555d`); pale and mid-grey tiers are unchanged. There are now no
black or near-black reef-rubble albedos.

**Sixth owner feedback and reef-rock seabed revision.** The varied scale and
fluorescence were judged good, but the smooth floor made adjacent colonies read
as coral piled on coral rather than organisms attached to reef rock. The fix is
now wholly in presentation: `terrain-material.ts` displaces the existing
carbonate-deposition field into connected sub-metre pavement and low ledges,
adds coarse weathered carbonate colour/normal breakup, and leaves simulation
elevations untouched. Encrusting footprints returned to their biological radius
so the rock stays visible between colonies instead of being hidden by overlapping
plates. No per-colony or per-site rock props were reintroduced. The real-WebGPU
candidate has no console warnings or errors and awaits owner verdict.

**Reference image and dense-rubble revision.** The owner supplied a reef-floor
photograph showing the missing scale transition explicitly: living colonies
emerge from dense angular carbonate rubble, dead skeleton, coralline-coated
fragments and crevices, not a continuous smooth surface. The earlier shader-only
relief could not supply that geometry frequency. `terrain-detail-renderer.ts`
now adds one deterministic instanced `reef-rubble` batch driven by existing
carbonate, basalt, sediment and depth fields, entirely independently of colony
positions. The first pass repeated sparse meter-class boulders and was rejected
internally; the recorded candidate uses many hand-sized fragments with a
bleached-limestone/coralline palette. A renderer test protects the zero-rubble
bare floor and populated carbonate floor. The live WebGPU frame reports no
warnings or errors; owner verdict remains the gate.

**Seventh owner feedback and carbonate-material revision.** The owner clarified
that rubble could help but was not the primary defect: the base floor still read
as smooth “sand in a Mario game.” `terrain-material.ts` now gives carbonate its
own nonrepeating macro/fragment/grain/fleck colour and normal structure, with a
restrained coralline-film variation. Caustic gain drops specifically over reef
carbonate so broad animated light bands no longer dominate the fixed material.
An attempted cellular fracture treatment produced an obvious checker/cell
pattern in WebGPU and was discarded before evidence was recorded. The retained
candidate uses only irregular multi-scale stone mottling; rubble remains a
secondary one-draw detail layer. The live frame has no warnings or errors and
awaits owner verdict.

**Eighth owner feedback and cool coarse revision.** The multi-scale floor was
judged good enough to refine: make it coarser and remove warm brown rocks, which
read as unfiltered sunlight underwater. Carbonate mottle and fleck frequencies
are now larger, their colour contrast and normal strength are higher, and the
base limestone mix is cool blue-grey. Every `reef-rubble` instance now selects
only dark slate, blue-grey or near-black. The real-WebGPU candidate contains no
warm rubble and reports no console warnings or errors. Owner verdict remains
the exact gate.

**WU-004 — Slice B, cascade and whitewater.** The `coat-detail&herd=contrast`
baseline confirmed a paper-white ruler-straight ribbon with brittle terrain
contact. `writeCascadeGeometry` now resamples height at every vertex's final
normal-shifted x/z footprint and guarantees minimum surface clearance; a
focused test checks every emitted vertex against that contract. Reaches gain a
small deterministic bow between fixed network endpoints, preserving continuity
while breaking straight chords. The water profile is wider and 58% shallower,
the scour band is narrower and more transparent, and foam moved from near-white
to blue-grey with substantially reduced aeration gain. The retained real-WebGPU
candidate reads as teal creek water entering the pond rather than white
scratches, and reports no warnings or errors. Ready for owner verdict.

**Next.** Slice C = LW-6, lighting intent across dawn, day and storm.

**LW-8 — herd individuality and overlap closeout.** The live
`coat-detail&herd=contrast` recheck showed that per-animal gait phases and coat
variation were already working, but exposed a stronger composition failure:
each 96-animal contrast herd was forced into an 11 m radius, making the animals
interpenetrate into a solid wall. Showcase layouts now enforce a deterministic
body-spacing-aware minimum radius, with a focused 96-animal packing test, and
the contrast sites are separated far enough that their expanded footprints do
not overlap. The fixed WebGPU frame retains the nimble/bulky population read,
shows distinct silhouettes and structured coats, and reports no warnings or
errors. Targeted tests pass 29/29, TypeScript/Vite build is clean, and the
accepted marsh-grazer package validates. Ready for owner verdict.

---

## WU-005 · Deep-time automatic transformation revision (2026-08-14)

**Owner verdict.** The canonical deep-time candidate was rejected. After the
1,000-year vegetation transformation, later automatic jumps did not visibly
document continuing erosion, rainfall, deposition, and inherited change.
Successive clicks appeared to settle into ecological stability. Herd review is
deferred because unresolved water presentation dominates the relevant frames.

**Cause.** Vegetation succession reaches its full scalar at 1,000 total years,
while the terrain regression checked only isolated numeric endpoints. Rainfall
was stored as local bounded runoff and erosion was evaluated per cell, so later
change could be broad enough to satisfy the test without forming a readable
connected landform. Mature vegetation suppressed up to 78% of that response.

**Change.** `resolveTerrainHistory` now resolves the jump's local rainfall
first, routes it downhill through a deterministic D8 catchment graph, and uses
accumulated discharge plus catchment area to concentrate incision. Channel flow
retains more erosive authority under mature vegetation than diffuse slope wash;
near-coast outlets deposit a bounded share of transported material. The pass
still resolves the landing directly and uses only inherited simulation state.

**Regression contract.** `epoch-scale-terrain.test.ts` now covers all four
canonical rungs, wet versus arid response, incision concentrated in a connected
valley, and cumulative divergence across three successive 100,000-year clicks.

**Evidence.** Full suite passes 271/271 and `npm run build` is clean. This is a
simulation candidate, not an accepted visual result. The next gate is owner
review on real WebGPU using both the four independent rung captures and an
actual successive-jump sequence.

**Live comparison revision.** The first real-browser four-rung pass still left
100,000 and 1,000,000 years too similar: concentrated drainage remained a
one-cell scratch. The retained candidate reserves more of the deep-time curve
for the final order of magnitude, widens established drainage laterally into
valleys, strengthens million-year channel incision, and makes final-rung coastal
retreat more nonlinear. Two follow-up whole-island comparisons rendered without
warnings or errors. The later rungs now separate more clearly while preserving
the island's identity, but this evidence still awaits the owner's verdict.

**Superseded by product alignment, 2026-08-14.** Owner review concluded that
coefficient tuning could not make the upper rungs both dramatic and grounded.
Epoch now targets one Galápagos-inspired hotspot archipelago with fixed hotspot,
moving crust, multiple shield histories, regional upwelling/elevation climate,
changing island connectivity, and population radiation driven by isolation and
gene flow. The geomorphic code remains exploratory groundwork; its generic
four-rung candidate is no longer awaiting acceptance. The replacement gate is
the serialized two-shield evolutionary proof in
`docs/GALAPAGOS-HOTSPOT-PLAN.md`.

---

## WU-006 · World scale resolved at 2 km (2026-08-15)

**Decision first.** `scripts/world-scale-comparison.ts` drew three candidate
extents at one shared scale, in plan and in true 1:1 side elevation, against
three silhouettes: the island a player actually starts on, the cone
`volcanism.ts` really builds (measured by running the accretion pass, not by
re-deriving its algebra), and a plausible 10° Galápagos shield. The measured
"before" was worse than item 0's estimate: a vigorous vent broke the surface as
an island **97 m wide and 45 m tall — a 43° mean flank**, with single-cell steps
to 75°. The owner chose **option C, 2,000 m**.

**Implemented.** `islandExtent` 380 → 2,000 m, `terrainSegments` 180 → 400
(5.0 m/cell). Shield radii 68/61/19 → 272/244/76 m with the caps unchanged, so
the same summit now stands on a base that can carry it. Two measurements, both
by running the shipping accretion pass, because they answer different questions:
on **bare seafloor** — the like-for-like comparison with the 43°/97 m "before" —
a vigorous vent emerges **390 m wide at a 13.2° mean flank**; on the **starting
island**, which is the gameplay case, the same vent gives a **790 m landmass at
6.6° under a 45.6 m summit**, steepest single cell 28°. Flank
roughness moved from per-cell white noise to a 34 m metric lattice, which is
what produced the old 75° steps. Lava-flow reach is now derived from the shield
radius instead of a cell count.

**Everything keyed to the old extent.** Starting-world landforms are stretched
horizontally only — heights untouched — which is what turns a 13° island into a
5–6° one. Offshore bathymetry gained a shelf break into a −52 m basin; the old
single constant would have made nine tenths of the 2 km world a flat
waist-deep plateau. Vegetation scatter moved off a hardcoded 150 m disc and now
carries authored *density* rather than authored *count*. Camera clamps, default
framing, shadow frustum, ocean extent and sculpt brush radii all follow the
extent. Archipelago drift rate 1e-4 → 4e-4 and spacing 96 → 381 m, both
re-derived from the ratios the 380 m world was tuned to, so residence time over
the hotspot is unchanged and a million-year click still exposes exactly one new
shield.

**Erosion re-checked, not assumed.** The geomorphic coefficients are written in
cell units, so `terrain-history.ts` now normalizes them against cell size.
`gradient` turns an adjacent-cell drop back into a slope; `area` divides the
hillslope diffusion weight, which carries a Laplacian's 1/cellSize². The
drainage catchment and accumulation thresholds are deliberately **not**
area-corrected: the analytic correction looked obviously required and
overshot inland incision by 2.9× at 5 m cells against the same physical island
resolved at 2.11 m, because a D8 network reorganises rather than subdividing.
Leaving it off lands at 0.82×. Measured, not reasoned. New cases in
`epoch-scale-terrain.test.ts` hold land loss within ±15% and the summit within
1 m across a 4.7× change in cell size.

**Cost.** The ocean-current pressure solve is side³ and would have made a
deep-time jump cost 3.6 s on its own. It is now decoupled from the terrain grid
at `CURRENT_FIELD_MAX_SIDE = 161` — it is a basin-scale field every consumer
reads through a world-space bilinear filter — and the wake range follows the
extent instead of a fixed 110 m. A jump's renderer-independent resolve is
**0.41 s** at 401×401, against 0.33 s on the old 380 m world. The overview
frame draws **15 calls** on the real WebGPU backend. No fps claim: the pane
throttles `requestAnimationFrame`.

**`archipelago-history.ts` birth stepping.** The conservative sphere trace
stepped by `SPACING − gap`, which collapses towards zero for a shield sitting
almost exactly one spacing off the drift axis. The number of steps grows with
the spacing being traced, so widening the world took a previously-passing case
past the 8,192 iteration guard. Replaced with the closed-form quadratic: the
hotspot walks a straight line, so "clear of a shield" is "outside a circle" and
the answer is the furthest exit root.

**Evidence.** 317/317 tests pass, `npx tsc --noEmit` and `npm run build` clean.
Live WebGPU frames for the new `w2k-` cameras report no console warnings or
errors. Prior captures are **not** comparable — the existing `GOLDEN_SHOTS` are
retained unedited but frame a fifth of the world; `w2k-` cameras and the
`baseline2km` / `shield2km` sets are a fresh baseline.

**Owner verdict, 2026-08-15: accepted — "the scale is much better."** This
clears order-of-work item 0. The verdict covers world scale and the shield
silhouette; it is not a verdict on the other visual gates. Open items are
recorded under "What the resize left open" in `docs/EXECUTION.md`: no caldera
on the shield, reef-edge composition, and the untouched fog/lighting/sea-state
tuning.

**Independent review pass and four scale misses.** A hostile subagent review of
the diff found four constants authored against the old 380 m world that the
resize had not touched, all of them in files the change never opened — which is
exactly where this class of defect hides. All four are fixed, and the shared
factor now lives in `RENDER_SCALE.AUTHORED_SCALE` so the next resize has one
place to look.

1. **`fft-water.ts` — the ocean shader was still dividing by 380.**
   `terrainSize` defaulted to a hardcoded `380` and `main.ts` never passed it,
   so the UVs that sample the terrain-height and ocean-mask textures were
   wrong everywhere beyond ±190 m of the origin: shoreline foam, shallow-water
   transmission and the land/water mask silently fell back to "deep water, no
   land" across most of the coast. The caller now passes it and the default is
   keyed to the contract.
2. **`animal-navigation.ts` — wildlife could not move.** The A* search box was
   a bare `LIMIT = 150` metres, so every animal beyond 150 m of the origin
   clamped to the same boundary cell and `findTerrainPath` returned an empty
   path. Verified before the fix: two individually-walkable points at (300,300)
   and (340,340) returned a zero-length path. `LIMIT` and `CELL` now follow
   `islandLandRadius` (the box stays ~83 cells across rather than growing with
   the square of the world); `landing-state.ts`'s matching `< 148` wander bound
   follows it too. After the fix, 46 of 47 far-to-far path attempts across
   walkable ground beyond 150 m succeed, the one failure being genuinely across
   water.
3. **`distant-drifter-renderer.ts` — the founder raft arrived inside a hill.**
   Its `basePosition` of (92, 0, 86) was open water off a 165 m island; after
   the stretch it is 7–17 m of solid land in all three starting worlds, with the
   raft still drawn at sea level. The authored bearing is kept; the distance is
   now `islandLandRadius * 1.25`, which clears every preset's shore into 5–7 m
   of water.
4. **`lineage-history.ts` — migration reach was penned in.** `migrationRadius`
   capped at 70 m, which was 42% of the old land radius and would have been
   16% of the new one, leaving populations unable to track a coastline or
   habitat band across the larger island. The authored curve is preserved and
   scaled.

The review separately cleared `nextClearOffset`, `bathymetrySampler` and the
cell-size normalization, the first by running a 50M-year archipelago sequence
and checking pairwise spacing.

**Determinism baseline re-based.** Fixing (4) moved
`determinism.test.ts`'s committed ecological snapshot — and that exposed a
weakness worth naming: the fixture ran at `captureWorldSnapshot`'s 300 m
defaults with a 145 m island, so it passed unchanged straight through the
entire 2 km resize. A determinism baseline taken at proportions the game never
runs at cannot notice a world-scale change. The fixture now uses the real
extent (with a coarser 201² grid so four jumps stay fast) and its snapshot is
recommitted at those proportions. 318/318 tests, `tsc --noEmit` and
`npm run build` clean; the live WebGPU frame reports no console errors in a
fresh tab.

## 2026-08-15 · Emergent island grouping, saddle connectivity, sea-level history

`docs/EXECUTION.md` order-of-work item 1 asked for island grouping, habitat
connectivity and gene-flow boundaries on top of the shield chain that landed in
`5bad7f1`. The shield record knows where every vent *is*; what population
isolation actually needs is which shields currently share land, and — the harder
half — *when a connection was lost*.

**One pass answers both.** `src/island-geography.ts` sorts every cell by
descending elevation and unions each into its already-added neighbours, building
the classic join tree.

- Every cell above sea level is processed before every cell below it, so the
  union-find state at the moment the sweep crosses sea level *is* the set of land
  components. The islands fall out with no second traversal.
- When adding a cell merges two components, that cell's elevation is exactly the
  saddle between them. One number per shield pair therefore describes their
  connectivity at *every* stand, past or future — `connected = saddle > sea`.

That second property is what makes the gene-flow work tractable. A saddle
elevation is a durable fact about the terrain, so pairing it with the new
`SeaLevelHistory` yields the dated spans during which two habitats were one
island, without re-resolving terrain per query. `isolatedSinceYear` reads the
end of the last such span.

Land is joined **orthogonally, not diagonally**. Eight-connectivity creates the
standard grid paradox: two land cells touching at a corner would count as
connected while the two water cells on the other diagonal also connect, so a
lineage could walk a strait a fish could equally swim.

**Shield zero is the authored island.** `WorldHistory` is version 9 and carries
`archipelago` and `seaLevelHistory`; both advance inside `landing-state.advance`
and both validate. The preset's vent seeds `shield-0` at construction 1 —
recording it as unbuilt would have the first jump grow land the player can
already see — with the hotspot placed on it, so the chain grows *from* the
starting island rather than beside it. Presets with no authored vent get an
empty archipelago rather than an absent one, so the field is never optional
downstream.

**Verified against the real 2 km world, not only synthetic terrain.** Four
million-year jumps from `young-volcano`: the chain grows to five shields with
stages progressing vigorous → waning → extinct, and island area erodes 0.304 →
0.140 km² while the summit holds at ~44.6 m.

**And that run exposed the honest gap.** Every saddle resolved to bare seafloor
(−55 m, the basin floor), because accretion is still driven by the static
`hotSpots` vent — the shield chain has no terrain consequence yet. A throwaway
spike pointing `resolveVolcanicAccretion` at the shield record instead produced
the intended behaviour on the first run: shield-0 and shield-1 share one island
across a **+5.3 m saddle**, which erodes to 5.2 then 4.9 m over successive
jumps, while shield-2 emerges as its own island and later drowns. The seam is
proven and the spike was discarded — wiring it changes what the player sees, so
it belongs to the multi-shield accretion gate with its own before/after evidence
and an owner verdict.

**Evidence.** 355/355 tests pass (32 new in `island-geography.test.ts`, 7 new in
`world-history.test.ts`), `npx tsc --noEmit` and `npm run build` clean. No
renderer change, so there is nothing to capture and no visual gate to record.
The existing world-history version assertion now reads
`WORLD_HISTORY_VERSION` instead of a hardcoded 8, so the next bump does not
need a test edit.

## 2026-08-15 · Multi-shield accretion: the chain builds terrain

`docs/EXECUTION.md`'s "Persistent terrain and volcanic change" gate asked for one
substitution: point `resolveVolcanicAccretion` at the archipelago shield record
instead of the static `hotSpots` vent. **The owner reshaped the unit before it
started**, and that turned out to be the more important half.

**What the owner decided.** The volcanic control is no longer a four-way vent
output. At world formation the player fixes *where the hotspot sits and which way
the crust drifts*; both lock for the run. Thereafter they hold one three-way
plume setting — **hyperactive** (lots of ejecta, fast growth), **active**
(regular Galápagos scale), **dormant** (no growth). The old
`vigorous/active/waning/extinct` enum survives internally as the *derived*
per-shield stage, which is a shield's distance from the plume and was never
something a player should have been setting.

`active` is exactly 1 on both mechanical axes, so it reproduces the constants the
owner accepted on 2026-08-15 rather than approximating them; a test asserts that
so the verdict cannot drift silently.

**The naive substitution does not work, and the spike hid why.** Pointing
accretion at the chain and scaling each edifice by the shield's integrated
`construction` produced a chain that never made islands — shield-1 peaked at
0.001 km². Two defects compounding:

1. **Stage was picking the edifice size.** A shield reaches full construction
   only *after* drifting far enough to read as `waning`, whose 76 m table entry
   describes a small lone cone. Every shield was handed a target smaller than the
   island it had just built, growth clamped to zero, and nothing emerged. Stage
   now sets the *rate*; `construction` sets the *size*. Radius and cap scale
   together, so a part-built shield is a low seamount rather than a steep spike
   and the flank angle is identical at every size.
2. **Stage was sampled at the landing.** On a million-year rung a shield crosses
   two whole stages inside one click, so a vent that spent most of the jump
   building over the plume was charged the slow waning rate. `resolveShieldVents`
   now takes the before and after records and erupts each vent at the strongest
   stage it held during the interval.

A waning vent's *activity* still retreats to its summit — it tops up near the
vent but stops extending its skirt — which preserves the locality
`volcanism.test.ts` was already guarding.

**Measured on the real 2 km world**, five 1-Myr jumps from `young-volcano`
(`scripts/shield-chain-readout.ts`): shield-1 is born as a 0.001 km² islet across
a −5.0 m saddle, then shield-0 and shield-1 **merge into one island across a
+5.3 m saddle** which erodes to 5.2 then 4.9 m, while shield-2 emerges as its own
0.031 km² island. That reproduces the previous session's spike figures exactly.
Under `dormant` the chain freezes at the authored island and erodes 0.304 →
0.140 km², which is precisely the old single-vent behaviour — so dormant *is* the
"before" in the A/B. Under `hyperactive` three shields merge into one 0.65 km²
island with 16–19 m saddles.

**Cost is a non-issue and the brief's worry was unfounded.** 4–11 ms per jump
against a ~410 ms resolve, flat across a 20 Myr world, because extinct shields
are skipped before any grid work and geometry bounds the live set to two or
three. No capping or culling needed.

**`hotSpots` is gone.** `WORLD_HISTORY_VERSION` 9 → 10,
`ARCHIPELAGO_HISTORY_VERSION` 1 → 2 (the plume setting is persisted state).
Position, bearing and vigor all live in `archipelago`, so there is no second
record able to disagree about where the volcano is.

**Two limits found, neither blocking, both worth not rediscovering.**

- **The plume leaves the grid after 2.45 Myr.** The terrain heightfield is the
  *crust* frame, so the hotspot walks backwards through it and exits at
  x = −1000 m. Shields born after that sit off-world at −52 m forever. The whole
  geology → isolation arc lands inside that window, so the current objective is
  unaffected, but the chain cannot grow past about three on-grid islands.
- **Terrain accretion is not additive over sub-intervals.** Growth is an
  exponential approach whose rate is capped per jump, so one 3 Myr click and
  three 1 Myr clicks land on different islands — unlike `construction`, which the
  archipelago work deliberately made additive. Captures therefore need the new
  `jumps=` parameter to replay a rung cumulatively.

**The determinism snapshot did not move, and the brief was wrong to expect it
to.** `determinism.test.ts` calls `resolveLanding` on a synthetic heightfield and
never touches `WorldHistory`, accretion or the archipelago, so it is structurally
incapable of seeing this change — the same blind spot the 2 km resize hit on the
scale axis, one axis over. New `src/shield-accretion.test.ts` closes it with 9
tests that run the actual jump pipeline and assert player-visible behaviour (does
a second island appear, does a land bridge form and then erode) rather than
elevations, with the dormant case as a built-in negative control.

**Evidence.** 366/366 tests (11 new), `npx tsc --noEmit` and `npm run build`
clean. New `chain2km` capture set, 10 frames, WebGL fallback backend —
`plume=dormant` versus `plume=active` at the same camera is a like-for-like A/B
of the seam. Golden shots `w2k-chain` and `w2k-chain-saddle` were **added**;
no existing shot or set was edited. Legacy `volcano=` fixtures still run via a
documented mapping, with one honest collapse: `waning` and `active` now resolve
to the same plume, because a shield wanes by drifting rather than by being told
to.

**Not done here.** `resolveIslandGeography` still has no shipping-path caller —
this unit gives the grouping work its *terrain* consumer, so saddles are real
land instead of bare basin floor, but nothing yet reads island membership to
decide gene flow. That is order-of-work item 2. Also worth an eye on real
hardware: in the fallback captures the newest shield reads as a very dark flat
ellipse, which may be fresh-basalt shading working as intended or may not —
per BACKLOG P0-2 that is not a call to make from a headless WebGL frame.

**Ready for owner verdict** on `docs/polish/evidence/chain2km/`. This changes
what the player sees and cannot self-certify.

**Owner verdict, 2026-08-15: passes — "good initial first, it passes."** The
multi-shield accretion gate is cleared. Recorded against the live WebGPU frame
at `?shot=w2k-chain&years=1000000&jumps=3&plume=active`, not only the
fallback-backend `chain2km` contact sheet, so this is a verdict on the target
pipeline rather than on a workaround capture.

**Scope.** The verdict covers the geology reading: a legible chain of islands
from one hotspot, a land bridge that forms between two shields and then erodes,
and three visibly distinct plume settings. It is *not* a verdict on regional
cohesion, reef-edge composition, organism quality, motion, or descendant
readability — those remain unrecorded in "Definition of done". Nor does it clear
the flat dark newest shield, which was present in the frame that passed and is
now filed under "Open defects" in `docs/EXECUTION.md`. The owner's own "initial
first" is preserved verbatim in both places so the qualifier cannot be lost.

## 2026-08-15 · Gene flow: the population consumer of island geography

`docs/EXECUTION.md` order-of-work item 2 asked for the missing half of the
grouping work: a *population* consumer. `island-geography.ts` could already say
which shields share land and when a saddle drowned, but nothing read it — the
lineage resolver still branched on `SPECIATION_COOLDOWN_YEARS`, "an arbitrary
elapsed-time threshold," which the Definition of Done explicitly rules out.

**The seam.** `resolveIslandGeography` gains a point query — `cellIsland` per
cell plus `islandAt(geography, x, z)` — so an arbitrary population *site*, not
just a shield vent, resolves to a land component. `resolveLanding` now takes an
optional `geography` and `seaLevelHistory`; `landing-state.advance` resolves the
geography from the freshly accreted terrain at the landing's stand and threads
both in.

**What reading island membership buys, all gated on geography being present:**

- **Gene flow.** Two active populations of one identity that share an island
  interbreed, so each jump blends their means toward the island centroid
  (`GENE_FLOW_RATE`, scaled by jump duration). This is what makes a reconnection
  read as one population again — divergence needs isolation, not distance.
- **Isolation-driven branching.** `resolveIsolationSpeciation` replaces the
  cooldown on the shipping path. A branch appears only when a viable founding
  site sits on a *different* island than the parent, with a recorded cause:
  **vicariance** (a shared saddle that carried a connection within the parent's
  life and has since drowned, dated by `isolatedSinceYear`) or **dispersal** (an
  over-water crossing, gated on epoch length, not lineage age). A single-island
  world therefore never branches — the correct allopatric reading.
- **Drift and founder effect.** A population isolated from its relatives drifts
  neutrally (`driftPopulationTraits`, deterministic per lineage/year), so two
  ranges diverge even in identical habitat; a branch's founding traits carry a
  one-time bottleneck sample rather than the parent mean.
- **Ancestry.** The branch records `origin { isolatedFromId, isolatedSinceYear,
  basis, bridgeX/Z }`; `lineage-report.ts` and `epoch-story.ts` name the cause
  ("land bridge drowned · Year N" / "reached a separate island") instead of the
  old "45 m isolated".

**Two paths, deliberately.** With no geography (synthetic unit fixtures, the
determinism baseline), the legacy distance-and-cooldown speciation runs
unchanged and no gene flow or drift is applied — so `determinism.test.ts`'s
committed ecological snapshot did not move. The shipping path always supplies
geography.

**Verified on the real 2 km world, not only synthetic terrain.**
`scripts/gene-flow-readout.ts` runs the shipping pipeline (young-volcano,
`active` plume, six 1-Myr jumps under a rising/falling sea) — evidence saved to
`docs/polish/evidence/gene-flow/active-6jump-readout.txt`. The chain grows to
three-plus islands; shield-0 and shield-1 merge under a high stand and split
again; `sheltered-grazer:0/1` branches onto island-2 (isolated by dispersal at
3 Myr), the ridge grazer later radiates too, and when a descendant reconnects
onto island-0 with its parent the run records gene flow closing their gap
(−0.022). Every named mechanic fires end to end.

**Known limitation, pre-existing, not touched here.** `migratedSite` samples
sites within a radius without checking for a walkable land path, so a lineage
can still "migrate" across open water between jumps. It predates this work; the
gene-flow reconnection it produces is plausible, but water-blind migration is a
separate fix. The shipping proof's isolation events are all *dispersal* rather
than *vicariance*, because the ±3 m sea-level swing does not drown the ~5 m
shield-0/shield-1 saddle; the vicariance dating path is covered by the unit test
with a drownable bridge.

**Evidence.** 379/379 tests pass (13 new: 3 in `island-geography.test.ts` for
the point query, 10 in the new `gene-flow.test.ts` covering grouping, gene flow,
isolation-vs-elapsed-time branching, the dispersal gate, vicariance dating,
drift, the shared-mean helper, and determinism of the geography path).
`npx tsc --noEmit` and `npm run build` are clean. No renderer change, so there
is no visual gate to record; the lineage-report/story wording is the only
player-facing surface and its legacy strings are preserved.

**Not done here.** Item 2 also names "path-dependent selection" more fully and
persistent per-lineage *variance* beyond the founder sample; those are present
in bounded form (inherited traits blended toward the new island's habitat, plus
drift) but could deepen if the proof exposes a need. The causal-reveal and
serialized-fixture gates (items 3–5) are untouched.

## 2026-08-15 · Honest isolation: migration and reanchor now require a land path

Item 2's gene-flow work landed with one documented gap: `migratedSite` — the
function that re-anchors an *already-established* lineage's site every jump —
never consulted island geography at all, even though `resolveLanding` already
had `geography` in scope. Ordinary migration, and the wider search a
population makes once its exact site drowns, both picked whichever sampled
candidate scored best inside a search radius, with no check that the
destination was reachable by land from wherever the population actually stood.
A deep-time migration reach (~368 m at a million years) is comparable to the
width of open water between two young shields on this world, so this let a
population silently "swim" to a different island in one ordinary jump — which
would then corrupt the very island-membership reading `applyIslandGeneFlow`
and `resolveIsolationSpeciation` depend on: gene flow could fire for two
populations that never actually shared land, and a branch's declared
"isolated" island could quietly un-isolate the next time it moved.

**The fix.** `island-geography.ts` gains `nearestIslandId`: `islandAt` itself
when the query point is dry land, otherwise the land found by searching
outward in expanding grid rings — a cheap, deterministic proxy for "the ground
this population last stood on" once its exact site has gone under.
`outcome-resolver.ts` threads `geography` into `resolveLineage` and
`migratedSite`, which now resolve the population's home island once
(`nearestIslandId` at its current site) and reject every migration candidate
not on that same island. `undefined` (no geography — the legacy
synthetic-fixture path) disables the check exactly as the rest of item 2
already does; `null` (geography present but no land survives anywhere near the
population) rejects every candidate, which correctly starves the lineage to
extinction rather than falling back to an unrestricted search. Branching
(`isolatedFoundingSite`) already required landing on a *different* island on
purpose — that half of the seam was sound and is untouched.

**Verifying this actually closes the gap, not just plausibly does.** Both new
tests were written to fail against the pre-fix resolver before being confirmed
against the fix. The first attempt at a migration test didn't: two
mirror-symmetric islands within reach of each other don't reproduce the bug,
because the resolver's own small distance penalty already keeps a
population home when both sides score identically, with or without the fix.
Replaced with a tiny, steep home island next to a much better-habitat
neighbour, plus a second case where a population's exact site drowns under
sea-level rise while nearer ground on its own island stays dry. Confirmed by
temporarily reverting `outcome-resolver.ts` alone: both cases then put the
population on the far, unconnected island (`site.x` flips sign); with the fix
restored, both stay on their own island.

**Evidence.** 384/384 tests pass (5 new: 3 in `island-geography.test.ts` for
`nearestIslandId`, 2 in `gene-flow.test.ts` for the migration/reanchor
land-path checks). `npx tsc --noEmit` and `npm run build` are clean. No
renderer change, so there is no visual gate to record.

**Not done here.** This closes the one bug the prior entry named explicitly.
Real pathfinding — a walkable route through the grid, rather than "same land
component at the current stand" — was not needed: `resolveIslandGeography`'s
land components already answer walkability at whatever stand a jump resolved
at, and `nearestIslandId`'s ring search only covers the rarer case of a site
drowning outright.

## 2026-08-15 · Capture can now reach the post-split landing

BACKLOG P1-1 named the gap: terrestrial fauna arrives only through the
Distant Drifter, an energy-limited founder that needs a further jump to
establish, and capture mode advanced exactly once — so no capture could
contain land animals, let alone a speciation event. `w2k-chain`'s owner
verdict proved the *geology* reads; nothing had yet proven the *population*
consumer of that geology (item 2, landed earlier today) was reachable the same
way a player reaches it.

**Turned out to need no application code at all.** `founders=drifter` in
`main.ts` already runs `introduceDistantDrifter` before the jump loop, and
`jumps=`/`plume=` already replay the shield chain the multi-shield accretion
work proved. Composing them —
`?shot=w2k-chain&years=1000000&jumps=3&plume=active&founders=drifter` — was
untried, not unsupported. `scripts/founding-split-readout.ts` (a sibling to
`gene-flow-readout.ts`, entered through the Distant Drifter instead of the two
always-present starting lineages) found the sequence renderer-independently
first: the founder establishes on jump 1, thrives on jump 2, and on jump 3 —
the same jump the third shield emerges — speciates onto it by dispersal.

**Verified through the actual browser, on real WebGPU.** Navigated the app to
that URL in the Browser pane (`backend: WebGPU`, not the fallback): the chain
renders with no console errors, `captureReady` flips true, and orbiting in
close on the new shield shows the branched herd standing on it, exactly where
the sim placed `sheltered-grazer:0/1`. This is the resolver a player's click
uses, not a fabricated capture-only state — the care BACKLOG P1-1 asked for.
The known "flat dark unlit newest shield" defect makes the herd hard to read
at a distance (their pale coats read as faint dots against it), which is a
reason the shield-shading defect matters more than previously scored, not a
new finding.

**Evidence.** Added `foundingSplit2km` to `capture.mjs`'s `SHOT_SETS`,
reusing the existing `w2k-chain`/`w2k-whole-island` cameras rather than
authoring new ones — framing the two descendants well is its own Work Unit.
`node scripts/capture.mjs --set foundingSplit2km --webgl` produces
`docs/polish/evidence/foundingSplit2km/contact-sheet.png` (fallback backend;
the herds are too small to read at contact-sheet scale, which is expected —
this set proves reachability, not legibility). 384/384 tests pass, `npx tsc
--noEmit` and `npm run build` are clean; no simulation code changed.

**Not done here.** This closes BACKLOG P1-1's reachability gap only. Framing
the two descendants for a real evidence pass (order-of-work item 4's golden
cameras), the causal-reveal wording (item 3), and an owner verdict on any of
it are still open. The flat-shaded newest shield is unchanged and still filed
under "Open defects" above.

## 2026-08-15 · Correction: the founding split does not establish

The previous entry's central claim — that `?founders=drifter&plume=active&
years=1000000&jumps=3` reaches a branched population — is **wrong**, found
the same day while starting the next Work Unit (framing golden cameras for
the two descendants).

**What actually happened.** The "verified through the actual browser, on real
WebGPU" paragraph above was a misread: what looked like a branched herd
standing on the new shield was almost certainly the terrain's own rock-scatter
detail objects, not creatures — the shield's flat, unlit shading (a known open
defect) makes small pale shapes on it easy to mistake for animals at a
distance, and no closer, unambiguous confirmation was taken before writing the
verdict up as fact. The renderer-independent script that supposedly confirmed
it first, `founding-split-readout.ts`, had its own bug: it called
`captureWorldSnapshot` without forage/nutrient/runoff/basalt sampler
functions, which silently default to a **constant forage of 1 everywhere** —
nothing like the real terrain's forage field, which sits around 0.55-0.60 at
the best site `foundingSite` can find near the plume. That constant-1 forage
made the founder look thriving in the readout while the real app, sampling
the real field, was starving it to death.

**Caught by direct instrumentation of the real app, not another guess.**
Temporary `console.log`s in `landing-state.ts` and `outcome-resolver.ts`,
read back through `read_console_messages` in a fresh browser tab (stale Vite
state was the first suspect and was ruled out), show the founder's abundance
and energy hitting exactly zero on jump 1, every time, with `event: "extinct"`
— not the "established... thrives... speciates" sequence previously reported.
The instrumentation was removed once the finding was confirmed; the debug
logs never reached a commit.

**How far this goes, checked properly this time.** With the script fixed to
sample real terrain fields (matching `currentSnapshot()`'s bilinear sampling
exactly):
- **No founder choice survives.** A sweep of all 60 `FounderChoices`
  combinations (4 food sources × 3 sizes × 5 origin climates) against a
  single 1,000,000-year jump from year 0 found every one extinct. The best
  case still lands on zero abundance.
- **Pacing doesn't rescue it either.** A 1-year jump makes literally zero
  feeding-adaptation progress (`traitAdaptationRate(1) === 0` exactly), so
  tiny jumps stall forever rather than easing the founder in. Any jump long
  enough to move adaptation (roughly 50-100+ years) already costs more
  abundance than the founder's starting 0.018 can absorb, because `intake`
  stays under the ~0.4 break-even point until adaptation has climbed much
  higher than one such jump can raise it. There is no jump-length strategy
  found that thread this needle on the site `foundingSite` actually picks.

**Open question, not answered here.** Is the Distant Drifter *meant* to fail
under ordinary conditions — a founder that only succeeds with a deliberately
prepared, unusually rich site — or is `founder-establishment.ts`'s
intake/abundance balance tuned tighter than intended? Neither this session nor
the retracted one has evidence either way; it needs someone to check whether
an established founder has ever actually been produced through real play, not
just through capture-mode URLs.

**Reverted.** The `foundingSplit2km` capture set and its evidence directory
are removed — they showed the (real, already-proven-elsewhere) three-island
chain with no population on it, not what their labels claimed.
`scripts/founding-split-readout.ts` is kept, fixed, and repointed at
demonstrating the extinction rather than a false success — see its header.
`docs/EXECUTION.md` item 5's note is corrected to match.

**Evidence.** 384/384 tests pass, `npx tsc --noEmit` and `npm run build` are
clean — nothing in `src/` changed, only the two scripts and this documentation.
Order-of-work item 5 (capture the declared sequence) is open again, blocked on
the founder-establishment question above, which is upstream of any camera or
framing work.

---

## WU-0 · Refresh the repo map (2026-08-16)

**Hypothesis.** None — measurement only. Goal: `MAP.md` is dated 2026-08-12 and
claims "38 modules + 28 test files, ~7.6k lines" and "55 files / 379 tests",
but the repo has grown substantially. A stale map costs every later session
tokens. Fix it and document the lineage/population subsystem it lacks.

**Change.** `docs/polish/MAP.md` only:
- Updated header date to 2026-08-16.
- Corrected source layout counts: now 67 modules + 55 test files, ~21.4k lines
  (was 38 + 28, ~7.6k).
- Updated test count: 55 files / 384 tests (was 379).
- Corrected module line counts for files explicitly named with numbers:
  `main.ts` 951 (was 511), `landing-state.ts` 1480 (was 896),
  `outcome-resolver.ts` 1184 (was 799), `fft-water.ts` 389 (was 271),
  `island-geography.ts` 673 (new).
- Added new subsection "Lineage and population" documenting the modules
  responsible for lineage records, gene flow, island connectivity, founder
  establishment, trait models, and lineage reporting.
- Updated "Simulation readout scripts" row to document
  `scripts/founding-split-readout.ts` and its requirement for real terrain
  sampler functions (see 2026-08-15 correction for why).

**Evidence.** 384/384 tests pass, `npx tsc --noEmit` is clean. No code changes,
only documentation recount and date update.

**Verdict.** `MAP.md` is now accurate as of 2026-08-16. A fresh session reading
it can name the right file for a lineage or founder change without globbing
`src/`.

---

## WU-A1 · Make founder viability discriminate on choice × world (2026-08-16)

The 2026-08-15 "Correction" entry above found all 60 `FounderChoices` extinct
on a single 1,000,000-year jump, with no jump-length strategy threading the
needle. The owner's 2026-08-16 verdict settled the open question the
correction left unanswered: drifters are *meant* to fail on a mismatched
island, but a **uniform** 60-of-60 extinction makes the choice decorative.
This unit implements the three-band design from
`docs/TANGLED-BANK-BUILD-PLAN.md` (well-matched establishes, marginal is
genuinely contested, absurd mismatch fails fast) so founder outcome varies
with choice × island, for a reason that can be named.

**Before-matrix.** `scripts/founder-matrix-readout.ts` (new; a sibling to
`founding-split-readout.ts`, always passing real forage/nutrient/runoff/basalt
samplers so it can't repeat the 2026-08-15 constant-forage bug) swept all 60
`FounderChoices` against three deliberately different island states — a bare
`young-volcano` at year 0, a `weathered-island` seasoned 300k years under a
wet/mild climate, and a low-relief `drowned-ridges` seasoned 200k years under
an arid/warm climate — each through one further 1,000,000-year founder jump,
via the real `resolveLanding` pipeline. Result against the unmodified code:
**180/180 extinct**, confirming the original finding at three times the scale
and across genuinely different terrain, not just one lucky/unlucky site.

**Two changes, both scoped to the founder path only.**

1. **Adaptation reachability** (`founder-establishment.ts`). The prior
   formula scaled `traitAdaptationRate(jumpYears)` by an extra `× 0.65`,
   capping a founder's single-jump adaptation gain at `0.72 × 0.75 × 0.65 ≈
   0.35` above its starting `0.28` — landing at `0.631`, never enough to clear
   even the best-matched site's intake ceiling. Founders now normalize
   `traitAdaptationRate` to its own documented ceiling (extracted as
   `TRAIT_ADAPTATION_RATE_CEILING = 0.75` in `lineage-history.ts`, a pure
   refactor — `traitAdaptationRate`'s output is byte-identical, so
   established-population trait blending via `blendPopulationTraits`, which
   calls the unmodified function directly, is untouched). A founder can now
   reach full behavioural adaptation (`1.0`) within one sufficiently long
   jump, while a 1-year jump still makes exactly zero progress, matching the
   shared curve's own intent. This is deliberately *not* a change to
   `traitAdaptationRate` itself — the reachability fix lives entirely in how
   `founder-establishment.ts` uses the curve, so established populations
   carry zero risk from this unit.
2. **The band-2 width parameter** (`founder-establishment.ts`). New export
   `FOUNDER_MARGIN_BAND_WIDTH = 0.08` (intake units) is the single named
   tuning knob. It zeroes a founder's *net food surplus* — intake vs. the
   0.4 break-even, plus the energy budget's own echo of that surplus folded
   in at its usual relative weight — whenever the surplus falls inside the
   margin, so a marginal founder's abundance holds roughly flat instead of
   being decided outright by either term. Outside the margin the outcome
   isn't close. (First attempt applied the margin to the intake term alone;
   the *unmargined* energy term alone was still crashing near-breakeven
   founders to extinction on the thin 0.018 starting abundance, because
   `energy < 0.38` alone can swing abundance past the 0.004 extinction floor
   even when intake nets to zero pressure. Folding the energy echo into the
   same single margin fixed that without adding a second knob.)

**After-matrix**, same script, same three islands, tuned code: **1 active /
25 not-established (band 2) / 154 extinct** (of 180). Concrete pair on the
*same* island (`young-volcano`, both through `resolveFounderEstablishment`
with the site values the matrix found):
- `ground-plants` / `small` / `temperate-seasonal` origin — food source
  matches the site's actual forage and the origin climate matches the
  destination exactly (`climateFit = 1`): intake `0.502` clears break-even by
  more than the margin → **establishes**.
- `animal-prey` / `large` / `cold-wet` origin — a double, named mismatch: no
  terrestrial prey field exists yet (`foodAvailability = 0.022`, by design —
  see `founder-profile.ts`'s comment) *and* the origin climate is nothing
  like the destination (`climateFit = 0.42`): intake `0.009` → **extinct**.

Every extinction in the after-matrix traces to a named cause visible in the
row — food-source affinity against the site's forage, or origin-climate
mismatch against the destination — not to a margin that moved underneath it.

**Honest gap: "most cells land in band 2" is not fully met.** Overall 25/180
(14%) land in band 2; restricted to the three food sources with any real
affinity path (excluding `animal-prey`, which is a deliberate 0-food-field
absence per `founder-profile.ts`, not a tuning question), it's 25/135 (18%).
The reason is structural, not a tuning miss: the real world's best-site
forage tops out around 0.5–0.6 across all three authored island states (the
matrix's own `forage` column), so the intake ceiling at full adaptation sits
only ~0.1–0.2 above the 0.4 break-even. A margin wide enough to be "most of
the matrix" (tested up to 0.18–0.20) swallows that entire headroom and
band 1 disappears — confirmed empirically by sweeping
`FOUNDER_MARGIN_BAND_WIDTH` from 0.06 to 0.20: band 1 survives only up to
`0.08`, and band 2 density rises with width in the same sweep (17 → 63 of 180
cells from 0.06 → 0.18). `0.08` was chosen to keep the hard requirement (a
reproducible establish/fail pair) rather than sacrifice it for band-2 density.
Widening `FOUNDER_MARGIN_BAND_WIDTH` further, or raising the world's forage
ceiling elsewhere, would each grow band 2 at band 1's expense or require
touching terrain generation — both out of this unit's scope. Flagging for the
owner rather than pushing either through unasked.

**Regression tests** (both new, both pin a success *and* a matched failure
through the real resolver, not a capture-only path):
- `founder-establishment.test.ts` — reachability (`traitAdaptationRate(1)`
  still stalls, `1_000_000` now reaches full adaptation), the matrix's
  well-matched/mismatched pair via `resolveFounderEstablishment` directly,
  and one contested-band pin.
- `population-dynamics.test.ts` — `"lets founder choice alone flip the
  outcome on an identical site"`: same flat site, same forage, same
  1,000,000-year jump, only `FounderChoices` differs, through the actual
  `resolveLanding` path a player's click drives.

**Evidence.** 388/388 tests pass (4 new), `npx tsc --noEmit` and `npm run
build` are clean. `blendPopulationTraits` and every established-population
path are untouched — `traitAdaptationRate`'s output is provably unchanged
(pure constant-extraction refactor), so the existing 384 tests needed no
changes, only additions. No renderer file touched.

**Not done here.** WU-A1b (drifter panel readout) and WU-A2 (multiple rafts)
still depend on this unit as planned. `docs/EXECUTION.md` item 5 (capture the
declared sequence, obtain owner visual verdicts) is unblocked in principle —
a founder can now demonstrably establish through the real resolver — but
capturing that visually is separate work, not attempted here per the "do not
touch the capture harness" scope. Band-2 density is real but thinner than the
design's "most choices, most islands" aspiration; narrowing later needs
either accepting that gap or a follow-up unit scoped to touch the forage
ceiling.

**Ready for owner verdict.**

## WU-A3 · The raft arrives as a moment (2026-08-16)

Closes LW-5. Framing and beat work only — the raft model in
`distant-drifter-renderer.ts` was not touched beyond a pure refactor (below).

**LW-5's stated cause: partially wrong, corrected.** The backlog blamed "the
zoom clamps well back." It doesn't — `controls.minDistance` is `1.25`, so the
player can already zoom in close. The real cause is that nothing ever points
the camera there: the default gameplay camera frames the *whole* 2,000 m
world (`camera.position` at `islandExtent * (0.41, 0.205, 0.47)`, ~1,300 m
from the target), and the raft — a deliberately small, ~12 m cohort seated
just offshore at ~556 m from the island center — is a small feature at the
edge of a very wide frame. It was always in frame, just never worth noticing.
Confirmed by computing both positions from `RENDER_SCALE` rather than
guessing. Also checked the "raft position stale after the 2 km resize"
concern the brief raised: it does not hold — `distant-drifter-renderer.ts`
already keys its offset to `RENDER_SCALE.islandLandRadius` (`1.25×`), which
was fixed in the same commit (`631ac2e`) that widened the world, so the raft
already sits in 5-7 m of clear offshore water on all three starting islands.
No change needed there.

**What shipped.** A short camera beat, playing in `reveal.ts`'s vocabulary
(fixed timings, restrained, no new visual system) rather than a cutscene:

- `distant-drifter-renderer.ts`: pure refactor, no behavior change. Moved the
  arrival-point math (`ARRIVAL_BEARING` / `ARRIVAL_BASE_POSITION`) from a
  closure-local in `createDistantDrifterRenderer` to module scope, and added
  `export function drifterArrivalPosition(seaLevel)` so presentation code can
  compute the raft's world-space point without owning a renderer instance.
  `reveal()` now calls this function instead of duplicating the math — same
  numbers, same raft, same everything else in the file.
- `main.ts`: a new self-contained beat (`playDrifterArrival` /
  `updateArrivalBeat`, ~1400 ms approach, ~1800 ms hold, ~1400 ms return —
  4,600 ms total, inside the same bracket as `reveal.ts`'s treatments) fires
  from the `distant-drifter` click handler once
  `landingState.introduceDistantDrifter` succeeds. It eases the camera to a
  point standing further out along the raft's own offshore bearing, looking
  back at the cohort with the island behind it, holds there, then eases back
  to exactly the camera pose the player had before the click. `controls.enabled`
  is never touched, per the project's camera direction — the beat only writes
  `camera.position` / `controls.target` each frame and skips the controls'
  own `update()` while it runs (same gating `presentation.ts` already uses
  for the screensaver). The existing global `pointerdown` / `wheel` /
  `keydown` / `touchstart` listener (already used to cancel the screensaver
  on input) now also cancels the beat, so grabbing the camera mid-arrival
  hands control back immediately from wherever the camera already was —
  predictable, no snap, no toggle.
- Inertness: `playDrifterArrival` early-returns under `captureMode`, and
  capture mode's own drifter path (`?founders=drifter`) calls
  `landingState.introduceDistantDrifter` directly, never through the click
  handler that starts the beat — so `arrivalBeat` is structurally never set
  during a capture run, not just skipped by a flag check.

**Verified live** (own dev server on port 5199, WebGPU backend per the
status line — this environment did reach real WebGPU, worth flagging since
CLAUDE.md says sandboxes usually can't): clicking Distant Drifter eases the
camera to a shot where all three founders read clearly on the raft with the
island in the background (screenshot captured), holds, then returns exactly
to the pre-click gameplay framing (second screenshot, matches the pre-click
frame). Separately verified the interrupt path: dragging the camera partway
through the beat cancels it immediately and the drag applies normally — no
fighting, no delayed snap. No console errors or warnings in either run.

**Capture-mode evidence.** `node scripts/capture.mjs --set baseline2km
--webgl` ran clean end-to-end with this change in the tree (9/9 shots, no
crash, no timeout on the second attempt — the first attempt hit an
infrastructure timeout unrelated to this change, this sandbox is shared with
another concurrent session's dev server). Did not attempt a stash-based
pixel A/B against pre-change captures: another session was actively editing
files in this same working tree during this unit (`founder-establishment.ts`
et al., WU-A1's own log entry above), and stashing main.ts/
distant-drifter-renderer.ts mid-session risked racing that session's edits.
Relying instead on the structural guarantee above (the beat can't be reached
from any capture-mode code path) plus the clean capture run as an existence
proof. If the owner wants a literal pixel diff, it is safe to run once no
other session is editing this tree.

**Tests / build.** `npm run test` 388/388 (unchanged — presentation-only, no
new test surface), `npx tsc --noEmit` clean, `npm run build` clean.

**Ready for owner verdict.**

---

## WU-A2 · Multiple rafts and lineage roots (2026-08-16)

**Hypothesis.** `landing-state.ts:1093`'s one-line guard
(`if (worldHistory.lineages.lineages.some((lineage) => lineage.status !==
"extinct")) return false;`) blocks every raft after the first, ever. Deleting
it is trivial; the actual unit is what the guard stood in for — an arrival
into an occupied island has to face the incumbents already there, per
`docs/TANGLED-BANK.md`'s "Why multiple rafts matter."

**Change.**
- `lineage-history.ts`: `LineageState.rootId?: number`. Every root a
  `createDrifterFounderHistory` call starts is keyed to the same ordinal that
  already makes its id unique (`sheltered-grazer:${ordinal}`) — no second
  counter invented. `world-history.ts` bumps `WORLD_HISTORY_VERSION` to 11 and
  validates `rootId` when present; it stays optional so the legacy synthetic
  fixtures `createLineageHistory()` still produces (used only as
  `resolveLanding`'s default parameter, never by the live game) need no
  migration.
- `outcome-resolver.ts`:
  - Both branch-creation sites (`resolveSpeciation`, `resolveIsolationSpeciation`)
    now copy `rootId` from parent to child.
  - `applyIslandGeneFlow`'s blend key gained `rootId` (`${island}|${identity}|
    ${rootId ?? "unrooted"}`) — this is the "most likely silent bug" the brief
    flagged, and it was real: two roots of the same identity sharing an island
    would otherwise fall into the same gene-flow group and get blended into one
    interbreeding population, contradicting `docs/TANGLED-BANK.md`'s
    "interacting but ancestrally separate." Lineages without a `rootId` all
    share the `"unrooted"` key, so every existing gene-flow test is byte-for-byte
    unchanged.
  - New `contestedForageAt(x, z, rawForage, incumbents)`: reduces a raft
    founder's forage input by nearby active incumbents' abundance, falling off
    linearly to zero at 60 m and never removing more than 82% of it. This
    feeds *into* WU-A1's existing three-band establishment logic
    (`founder-establishment.ts`) rather than adding a second, bespoke
    contest rule — a saturated site just reads as a worse site. Established
    populations don't re-read this each jump; only founders (`previous.status
    === "not-established"`) do, and only for their own establishment math, not
    for site *selection* (which already has `separationBonus` pushing new
    arrivals away from occupied ground).
  - New `applyRaftArrivalDisplacement`: after gene flow, any raft that just
    established and sits within 40 m of an active incumbent from a different
    root gets compared against it — both intakes estimated the same way
    `resolveFounderEstablishment`'s own intake is, at the arrival's site. The
    incumbent is displaced (flipped to `extinct`, same as starvation) only if
    the arrival clears it by more than two marginal-band widths
    (`FOUNDER_MARGIN_BAND_WIDTH * 2`) — a direct fitness comparison, not a
    coin flip, and rare by construction (needs both proximity and a decisive
    fitness gap).
- `landing-state.ts`: removed the one-raft guard from `introduceDistantDrifter`.
- `main.ts`: the Distant Drifter button and its three selects now re-enable
  unconditionally after every jump resolves (previously only after every
  active lineage went extinct), so the verb is reachable "between jumps" as
  designed. The click handler and its `playDrifterArrival` camera-beat call
  (WU-A3) are untouched.

**Evidence — bare vs. saturated, same founder choice.**
`scripts/raft-contest-readout.ts` runs `DEFAULT_FOUNDER_CHOICES` through the
real `resolveLanding` pipeline on a small (25 m radius), perfectly uniform
island — uniform so the *only* difference between the two runs is the contest
term, not an accident of where the site search happened to land — sweeping
forage from 0.50 to 0.90:

```
forage  bare status       bare abundance  saturated status   saturated abundance  incumbent abundance
0.50    not-established   0.0180          not-established    0.0180               0.0180
0.55    not-established   0.0210          not-established    0.0210               0.0355
0.58    not-established   0.0384          not-established    0.0297               0.0736
0.60    not-established   0.0500          not-established    0.0378               0.0991
0.62    active             0.0615          not-established    0.0484               0.1037
0.65    active             0.0789          active              0.0591               0.1493
0.70    active             0.1078          active              0.0756               0.2254
0.80    active             0.1657          active              0.1040               0.3776
0.90    active             0.2236          active              0.1265               0.5285
```

At forage 0.62 the identical founder choice **establishes bare and fails
saturated** — a status flip, not just a smaller number. At every forage level
the saturated abundance is lower than bare, and the gap widens as the
incumbent's own abundance (and thus its forage pressure) grows. `src/
raft-arrival.test.ts` pins this exact point (0.62) as a regression test.

**Tests.** New `src/raft-arrival.test.ts` (4 tests): a second raft succeeding
into a bare island after the first lineage's extinction (distinct `rootId`);
the bare-vs-saturated status flip above; two same-identity roots on one
island exchanging no gene flow; and `rootId` inheritance across an
isolation-driven branch. `gene-flow.test.ts` (unchanged) still passes,
confirming the `rootId`-aware blend key didn't disturb existing single-root
behaviour. Full suite: `npm run test` 392/392 (388 prior + 4 new).
`npx tsc --noEmit` clean. `npm run build` clean.

**Care items checked.**
- Two roots on one island: covered directly by test and by the blend-key
  design above — no gene flow, no drift added between them either (out of
  scope; `islandsByIdentity` stays root-agnostic, unchanged from WU-A1).
- Reconnection/hybridization (WU-B2): not touched. Displacement flips one
  lineage to `extinct`; it never merges two `LineageState`s into one.
- `presentation.ts` `GOLDEN_SHOTS`, `distant-drifter-renderer.ts`, and the
  WU-A3 arrival beat: untouched. The only `main.ts` change is the button/
  select re-enable block; the click handler and `playDrifterArrival` call are
  unmodified.

**Ready for owner verdict.**

---

## WU-A1b · Founder match readout (2026-08-16)

**Hypothesis.** The player picks a founder from three dropdowns but has no
information about the island's conditions before launch. Under the three-band
design, a losing pick should feel like a misread, not a dice roll. Show the
island's state (forage, moisture, elevation) and give a plain-language verdict
before the launch so the player can see the match quality and understand why
a choice succeeds or fails.

**Change.** New `src/founder-match.ts` (pure renderer-independent module): one
exported function `founderMatchReadout(habitat, choices)` taking a `HabitatSummary`
(forage level, moisture, elevation band, vegetation, current climate) and
`FounderChoices`, returning readable text. Describes the island's conditions,
describes the founder relative to the island, and gives a verdict on the match
without stating probabilities or predicting certain outcomes.

Added `getDrifterHabitatSummary()` accessor to `WorldExperience` in
`landing-state.ts`: samples forage/elevation/moisture at the drifter arrival
site and returns a summary for the readout to consume.

Wired into `main.ts`: calls `getDrifterHabitatSummary()` and `founderMatchReadout()`
in `updateDrifterPreview()`, triggered whenever any of the three drifter dropdowns
change, after a world jump (forage/vegetation moves), after a preset is loaded
(elevation changes), or after climate is changed (moisture derived from rainfall).

**Example readouts produced by the module:**

1. Well-matched: small temperate grazer on abundant temperate lowland.
   *"abundant forage, temperate lowlands; a small grazer from a temperate climate will do well here. Exact anatomy will be generated when the raft is launched."*

2. Absurd mismatch: large cold-open predator on sparse arid lowland.
   *"sparse forage, arid lowlands; a large predator from a cold open climate will struggle badly here. Exact anatomy will be generated when the raft is launched."*

3. Marginal: medium hot-wet browser on moderate temperate highland.
   *"moderate forage, temperate highlands; a medium browser from a hot wet climate will struggle badly here. Exact anatomy will be generated when the raft is launched."*

**Wording rules verified.** Grep of `founder-match.ts` finds zero instances of
`chance`, `probability`, `%`, `will fail`, or `will die`. The module describes
the island's conditions first, then states what the founder "will do" *given*
those conditions (e.g., "will struggle here"), framed as conditional on "here"
rather than as a certain prediction. This matches the pattern from prior art
(*Niche* shows habitat requirements beside an animal's stats before commitment).

**Tests.** New `src/founder-match.test.ts` (5 tests): a well-matched pairing
(small temperate grazer on abundant temperate island), an absurd mismatch (large
cold-open predator on sparse arid lowland), a marginal case (medium mixed-diet
founder on moderate island), a wording-rule compliance check (no forbidden terms),
and a browser on a richly vegetated island. All pass. Full suite: `npm run test`
397/397 (392 prior + 5 new). `npx tsc --noEmit` clean. `npm run build` clean.

**Care items checked.**
- `founder-establishment.ts`, WU-A1 tuning parameter `FOUNDER_MARGIN_BAND_WIDTH`:
  untouched. `founderEnvironmentFit()` is only consulted for the readout, not
  the actual establishment calculation.
- The drifter landing site is derived from `drifterArrivalPosition()` (renderer,
  pre-existing), not hardcoded; habitat summary is read-only snapshot, not live.
- Capture mode: readout lives in `#drifter-preview`, which already hides under
  `body.capture-mode` like the rest of the UI. No new CSS, no capture
  interaction.
- WU-A2's changes to `introduceDistantDrifter` (no single-raft guard) and the
  button re-enable block: untouched. Only extension is the new accessor
  `getDrifterHabitatSummary()`.

**Ready for owner verdict.**

---

## WU-A4 · Unblock founder survival (2026-08-16)

**Hypothesis.** No Distant Drifter founder survives any jump combination because
terrain forage at the arrival site (~0.50) produces intake (~0.23) far below the
break-even threshold (0.40). Even at full behavioural adaptation after a 1 Myr
jump, intake only reaches ~0.42 with forage 0.50 — inside the marginal band, so
net surplus is zero and abundance never climbs from the starting 0.018 to the
0.05 establishment threshold. The terrain forage potential formula's base and
fertility floor are too low for a weathered Galápagos island.

**Change.** `terrain-history.ts:348`, the forage potential formula:
- Base: `0.48` → `0.58` (a weathered island with established vegetation
  communities has a higher baseline than bare ground)
- Fertility floor: `0.08` → `0.22` (even bare basalt in Galápagos supports
  pioneer plants — lichens, *Brachycereus* cacti, *Mollugo*)

The `0.92` fertility scale becomes `0.78` to keep the ceiling at 1.0. Effect on
forage potential by site type:

| Site | Before | After |
|---|:--:|:--:|
| Dry barren (moisture 0.2, protection 0.2, fertility 0.4) | ~0.25 | ~0.35 |
| Moderate coast (moisture 0.4, protection 0.3, fertility 0.5) | ~0.45 | ~0.60 |
| Moist highland (moisture 0.7, protection 0.5, fertility 0.6) | ~0.55 | ~0.70 |

**Evidence — `scripts/founding-split-readout.ts`.**

```
401² grid over 2000 m · 5 × 1,000,000 yr · climate = present/default

after jump 1 (1,000,000 yr)
  sheltered-grazer:0  not-established  abundance 0.045  energy 0.488

after jump 2 (2,000,000 yr)
  sheltered-grazer:0  active (established)  abundance 0.062  energy 0.561

after jump 3 (3,000,000 yr)
  sheltered-grazer:0    active  abundance 0.005  energy 0.521
  sheltered-grazer:0/1  active (speciated)  abundance 0.120  energy 0.521
    isolated by dispersal @ 3,000,000 yr

after jump 4 (4,000,000 yr)
  sheltered-grazer:0    active  abundance 0.000  energy 0.427
  sheltered-grazer:0/2  active (speciated)  abundance 0.120  energy 0.427
    isolated by dispersal @ 4,000,000 yr

after jump 5 (5,000,000 yr)
  sheltered-grazer:0    active  abundance 0.000  energy 0.359
  sheltered-grazer:0/3  active (speciated)  abundance 0.120  energy 0.359
    isolated by dispersal @ 5,000,000 yr
```

The full geology → isolation → adaptation chain works: the hotspot builds new
islands, populations disperse to them, and isolation produces branching. Jump 3
is the key proof landing — two coexisting populations on separate islands,
isolated by dispersal.

**Browser verification (limited by pane rAF throttling).** Year 2,000,000 on real
WebGPU shows: "Sheltered grazer: established, population 6%, energy 56%." The
Year 3,000,000 reveal transition could not complete in the throttled pane; the
speciation event needs owner-machine verification.

**Remaining concerns for later WUs.**
- Parent lineage abundance drops to ~0 by jump 4 — the established-population
  maintenance threshold (`intake - 0.52` in `outcome-resolver.ts:541`) is high
  relative to the terrain's forage. The parent survives (energy > 0.08 keeps it
  from extinction) but is functionally a relic.
- Branch lineages go extinct when their small islands erode, producing serial
  replacement rather than stable coexistence. Longer-lived islands or
  multi-shield land bridges that persist would help.
- Trait changes show `+0.000` across the board at jumps 1–2 because the founder
  enters as `not-established` and trait blending only runs for `active`
  populations. After establishment, trait adaptation should begin.

**Tests.** 397/397 pass. `npx tsc --noEmit` clean. `npm run build` clean. No
existing test depends on specific forage potential values — the change is purely
a tuning constant in the terrain model.
