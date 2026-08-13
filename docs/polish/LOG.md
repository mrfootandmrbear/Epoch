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
