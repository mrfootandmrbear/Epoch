# Renderer roadmap

> **Status:** Canonical landing-state rendering tracker.
> **Updated:** 2026-08-13.
> **Scope:** The visual proof required by `THESIS.md` §5–6: deep-time legibility, atmosphere, terrain, water, lighting, shadows, grading, and landing-state scale.

`THESIS.md` defines the bar; this page records what has actually cleared it. A renderer capability is not **Built** until automated checks pass and an owner visual verdict is recorded against the fixed capture set.

## Epoch-scale milestone

The canonical comparison uses one generated island, the `whole-island` camera, default climate, capture time `42`, and four independent landings:

| Jump | Capture URL | Required reading |
|---:|---|---|
| 1 year | `?shot=whole-island&years=1&time=42` | Baseline landform; pioneer succession only. |
| 1,000 years | `?shot=whole-island&years=1000&time=42` | Mature succession without deep-time coastal retreat. |
| 100,000 years | `?shot=whole-island&years=100000&time=42` | Landscape-scale weathering and visible shoreline loss. |
| 1,000,000 years | `?shot=whole-island&years=1000000&time=42` | Strongest bounded incision/retreat and a visibly inherited living world. |

Automated floor: `src/epoch-scale-terrain.test.ts` requires the one-year visible terrain to remain stable and the million-year terrain to change broadly while losing land area. This protects legibility; it does not substitute for the owner verdict.

Volcanic comparison uses the same camera and time with `&volcano=active` or another output rung. `?shot=whole-island&years=1000&time=42&volcano=active` is a construction diagnostic. An extinct single-jump URL is not a decline proof because it has no inherited volcanic load; a serialized multi-jump life-cycle capture is required before an owner verdict.

**Current verdict:** **Candidate**. The four rungs are now visually distinguishable and the upper ladder changes coastline geometry. Owner review is still required before calling the §5 milestone accepted.

**Sky/horizon regression boundary:** **Owner accepted on 2026-08-13.** The world-space solar arc, horizon haze composition, far-water continuity, and current sky/water meeting are protected by the fixed `whole-island` capture. This verdict applies only to sky/horizon presentation; it does not accept the reef-builder candidate or later climate-specific atmosphere work.

## Capability ledger

| Area | Status | Present evidence | Next gate |
|---|---|---|---|
| Cross-system visual cohesion | **Direction approved; experimenting** | Godot migration plan cancelled after its integrated slice showed that engine replacement does not create a shared art direction. Hybrid stylized-naturalist direction selected: semantic palette and material response first, smooth geomorphic macro terrain, selective geological facets, continuous water, no outlines by default. Three.js r185 exposes the required public TSL material and post-processing primitives. | Build the feature-gated controlled style laboratory in `docs/STYLIZED-RENDER-COHESION.md`; isolate palette, lighting, and geometry normals across whole-island, shoreline, herd-detail, and reef/shore sentinel sheets before combining a candidate. |
| Deep-time landform | **Candidate** | One-pass weathering, drainage incision, and coastal retreat; four-rung fixed captures; numeric regression test. | Owner verdict on magnitude and plausibility. |
| Volcanic island history | **Experimenting** | A fixed player-placed hot spot accretes a bounded shield before erosion; vigorous/active/waning/extinct output is persistent, deterministic downhill flows resurface capped terrain, basalt and ash alter the terrain surface and ecology, bathymetry reaches −55 m, and retained volcanic load drives deep-time subsidence after extinction. | Capture the same vent as seamount, breached shield, carved island, and drowned remnant; tune life-cycle pacing and flow silhouettes from those frames. |
| Atmosphere | **Sky/horizon built; climate integration experimenting** | Owner-accepted world-space sky over a real solar arc and continuous far-water horizon. Climate-driven exponential height fog remains a bounded lower-atmosphere modifier. | Preserve the accepted horizon; judge only climate fog contradictions in the environment fixtures. Add clouds later. |
| Terrain shading | **Candidate** | Persistent geology and derived spatial environment fields drive moisture, exposure, sediment, frost, basalt, ash, carbonate, ground cover, and erosion regimes. Global climate no longer recolors vertex bands directly. | Judge the five environment fixtures without changing accepted sky/horizon composition. |
| Ocean surface | **Experimenting** | Tessendorf/JONSWAP FFT with restrained broad swell, subtle multi-directional chop and horizontal crest displacement, Fresnel, analytic sky reflection, shallow transmission, and shoreline foam. A far-water skirt carries the same open-water shading out to where aerial perspective has fully dissolved it into the sky, and the displaced patch retires its waves and wave shading at a world-anchored rim so the two always meet as one flat surface, so the horizon is a horizon rather than the edge of the 1400 m patch. | Add crest/Jacobian foam and verify motion plus shallow/deep transitions. |
| Reef landing renderer | **Built for the first reef family** | Owner accepted the paired mature-reef integration on 2026-08-13: current-sorted colonies share water optics with the seabed, persistent framework deposits carbonate, and exposed basalt remains legible beside the surviving reef. | Preserve this evidence while iterating; later reef families and major visual changes require their own verdicts. |
| Shadows | **Experimenting** | One broad 2048² island solar map keeps direct-light shadowing consistent across the authored terrain. | Verify island/shoreline/forest cameras and record the owner verdict; revisit true cascades only if close-range resolution requires them. |
| Inland water and ice | **Experimenting** | Runoff remains explicit; deterministic downhill tracing now feeds a separate animated stream/creek ribbon renderer alongside freshwater basins. Terrain geometry remains authoritative and uncontaminated. | Validate channel placement and motion, then add waterfall transitions and climate-driven snowfield/glacier surfaces. |
| Post-processing | **Built** as a bounded layer | TSL grading and restrained bloom; optional full-resolution GTAO evaluation path. | Revisit only alongside accepted materials and lighting. |
| Creature mesh and motion | **Built** for first fauna family | Owner accepted `example-marsh-grazer` after topology-stable export, island showcase, and paired live terrain-aware locomotion evidence. | Preserve the evidence; each later fauna family must pass independently. |
| Marine creature mesh and motion | **Candidate** for first fish family | `epoch-coastal-forager` replaces the primitive swimmer with one instanced topology, inherited shape traits, resolved water-band placement, energy condition, and tail-driven swim motion. Fixed fixture: `?shot=fish&fixture=mature-warm-reef&fish=candidate&time=42`. | Owner verdict on silhouette, habitat fit, and motion before acceptance. |
| Per-instance trait expression | **Built** for terrestrial grazer | The accepted marsh-grazer uses stable render seeds to sample modest individual differences around population means across five shape and two coat-color axes; the sim still owns means and stores no variance. | Preserve the cosmetic-versus-simulated distinction; later fauna must pass independently. |
| Instanced herd rendering | **Built** for terrestrial grazer; herd scale **experimenting** | One `InstancedMesh` still renders each lineage. Herd size is now 96 instances per lineage, low in the declared 50–200 band. A visible foreground WebGPU run on 2026-08-13 reported 60 fps and 15 total frame draws with the contrast herds present; the fixed evidence is `artifacts/creatures/herd-live-60fps-review.png`. | Owner verdict on herd density and motion at 96. The diagnostic reading is evidence, not a substitute for judging whether the result looks alive. |
| Coat color as phenotype | **Built** for terrestrial grazer; within-herd range **experimenting** | Per-instance coat warmth and lightness tint the marsh-grazer's accepted neutral albedo. Each site now samples its herd from a seeded uniform, bimodal, or graded distribution over those two scalars, and the colour mapping they feed was widened to match. Population means are preserved by construction and under test. | Owner verdict that the widened tonal range still reads as the accepted animal, not a new one. |
| Insulation surface treatment | **Experimenting** | A TSL node material layers object-space coat noise over the accepted mesh: banded fibre and guard frequencies that fade with distance, roughness from a tight faintly specular hide to a scattering coat, and trough self-shadowing. Insulation reaches the fragment stage on an instanced attribute mirrored from the shape morph. Chosen over shell layers because shells add a draw per shell per lineage. | Owner verdict on `?shot=coat-detail&herd=contrast&time=42`. |
| Creature trait LOD | **Experimenting** | Walk-cycle pose sampling repartitions by camera distance: every frame inside 130 m, every third frame to 300 m, frozen beyond, staggered by instance and with the herd's morph texture re-uploaded only when some animal re-posed. Silhouette, coat, and colour are untouched at every distance. Geometry is deliberately not swapped between bands — that would cost the single instanced draw per lineage. | Owner verdict that no pose stutter is visible at the band edges. |
| Trait-driven herd behavior | **Experimenting** | Body mass and leg length set stride speed and turn rate; heading is rate-limited and animals travel along their facing, so turn radius is visible. Body size sets neighbour spacing, insulation sets cluster tightness, and cohesion radius is held looser than separation so the two forces cannot cancel in place. | Owner verdict on `?showcase=herd-contrast` in motion. Emergent tests cover the numbers; only a person can judge the read. |

## Creature embodiment ladder

Each rung requires an in-renderer owner verdict; API availability or an offline asset preview is not acceptance.

1. **Trait vocabulary fixed:** document ranges and meanings for body mass, leg length, foot width, insulation, horn length, coat warmth, and coat lightness.
2. **Expression spike accepted:** on Apple Silicon WebGPU, show all five shape channels and two color channels at their extremes on one topology-stable mesh. Record the actual Three.js resources correctly: `InstancedMesh.morphTexture` stores per-instance weights as a `DataTexture`; morph vertex data is stored separately in a `DataArrayTexture`.
3. **Motion architecture accepted:** prove grounded locomotion combined with trait expression. Pose morphs are a candidate, not a commitment, until animation quality and channel interactions are captured.
4. **Within-herd variation visible:** a still frame shows distinguishable individuals without labels while simulation authority remains at population level.
5. **Herd scale accepted:** the chosen target instance count renders within the existing frame budget and verifies the intended draw-call count.
6. **Surface treatment and LOD accepted:** insulation reads as coat structure nearby, while overview silhouettes and color remain legible at reduced cost.
7. **Behavioral differentiation accepted:** two populations can be distinguished at mid distance from movement alone.

The visual fixture is one herd captured from overview, mid, and near cameras, with GPU timing and draw count recorded alongside the images. Current static evidence is stored at `artifacts/creatures/coat-detail-review.png` and `artifacts/creatures/herd-contrast-review.png`; the live diagnostic is `artifacts/creatures/herd-live-60fps-review.png`.

**Rungs 4–7 are implemented and awaiting owner verdicts.** None may be called accepted until those are recorded. The fixture cameras are:

| Rung | Capture URL | Required reading |
|---:|---|---|
| 4 — within-herd variation | `?shot=coat-detail&herd=contrast&time=42` | Individuals distinguishable without labels, from colour and coat alone. |
| 5 — herd scale | `?shot=whole-island&herd=contrast&time=42` | 96 instances per lineage still legible as a herd; draw count unchanged at 15. |
| 6 — surface treatment and LOD | `?shot=coat-detail&herd=contrast&time=42` near, `?shot=whole-island&herd=contrast&time=42` overview | Insulation reads as coat structure near; silhouette and colour survive the overview. |
| 7 — behavioural differentiation | `?showcase=herd-contrast` (live, in motion) | Two opposite-mean populations told apart from movement alone at mid distance. |

`?shot=herd-contrast&herd=contrast&time=42` is the mid-distance still of the same pair. The contrast herds are a diagnostic, not a landing outcome: they exist only under these query parameters.

Rung 5 now has a visible foreground diagnostic reading of 60 fps and 15 draws on the review machine. It remains `experimenting` until the owner accepts the density and motion; a healthy counter does not establish the visual verdict required by the ladder.

## Planned sequence

1. Run the bounded stylized-cohesion laboratory, isolate palette, lighting, and selective faceting, then select a shared hybrid visual grammar before further isolated effect polish.
2. Capture one fixed vent across emergence and decline, then tune volcanic growth and subsidence pacing; keep the open-ocean start as a separate owner decision.
3. Record the owner verdict on the four-rung milestone and tune geomorphic magnitude if requested.
4. Preserve the accepted sky/horizon while validating climate-driven fog only where the environment fixtures reveal contradictions; add authored clouds later.
5. Judge the five state-driven environment fixtures, then add triplanar rock projection only if they expose stretching.
6. Revisit water composition inside the selected shared grammar: absorption, refraction, choppy displacement, crest foam, and shallow/deep transitions.
7. Replace island-wide shadow coverage with a close/far strategy.
8. Validate accepted ecosystem assets in the landing renderer before expanding asset breadth.
9. Extend freshwater into connected flowing surfaces: drainage-fed streams and creeks, waterfall transitions at steep drops, then persistent snowfield/glacier flow for suitable climates.
10. Run the bounded creature expression spike, then advance the embodiment ladder in order; placement relative to the existing renderer work remains an owner scheduling decision.
11. Preserve the accepted `epoch-reef-builder-family` paired evidence while extending reef ecology incrementally.

## Maintenance rule

Update this page whenever renderer status, capture URLs, or the milestone verdict changes. `WILDLIFE-ROADMAP.md` remains canonical for ecology and asset-family status; neither tracker may claim acceptance on behalf of the other.
