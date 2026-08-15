# Epoch execution direction

> **Class:** Contract. **Authority:** Canonical source for current state and
> priority. **Updated:** 2026-08-15. Update whenever a listed capability,
> priority, or verdict changes.

## Current objective

Prove one inherited hotspot-archipelago sequence in which volcanic history
changes land connectivity and habitat, a founder population loses gene flow,
and later descendants become visibly related specialists. The sequence must be
legible as geology → isolation → adaptation at overview, mid, and near scales.
The founder must be a recognizable present-day Galápagos lineage, not a generic
creature or an authored future species. This first proof must establish the
inheritance rules that later allow the world to become radically different
without becoming arbitrary or converging on a predetermined bestiary.

## Order of work

0. ~~**Resolve world scale.**~~ **Done. Owner verdict recorded 2026-08-15:
   "the scale is much better."** The owner chose a **2,000 m extent** from a
   three-option comparison (`evidence/world-scale/world-scale-comparison.svg`,
   regenerate with `scripts/world-scale-comparison.ts`) and accepted the
   resized world on sight.

   **Scope of that verdict:** world scale and the shield silhouette only. It is
   not a verdict on regional cohesion, reef-edge composition, organism quality,
   motion, or descendant readability — those remain the separate visual gates
   in "Definition of done" below, and none of them has been recorded.

   `RENDER_SCALE.islandExtent` is 2,000 m on a 401×401 grid (5.0 m/cell, from
   380 m at 181×181 / 2.11 m/cell). Shield radii moved to the 272 m item 0
   specified; the caps did not move. Two measurements, both by running the
   shipping accretion pass:

   - **A vigorous vent on bare seafloor** — the like-for-like comparison with
     item 0's original figure — breaks the surface as an island **390 m wide at
     a 13.2° mean flank**, from **97 m at 43°**.
   - **The same vent on the starting island**, which is the gameplay case,
     gives a **790 m wide landmass at a 6.6° mean flank** under a 45.6 m
     summit, because the shield is building onto existing land.

   Also changed because it was keyed to the old extent: starting-world
   landforms (stretched horizontally only — heights are unchanged, which is
   what turns a 13° island into a 5–6° one), offshore bathymetry (a shelf that
   breaks into a −52 m basin, replacing a flat few-metre plateau that would
   otherwise have been nine tenths of the world), vegetation scatter and
   density, camera clamps and default framing, shadow frustum, sculpt brush
   radii, ocean extent, and the archipelago drift rate and shield spacing.

   `terrain-history.ts` now normalizes its geomorphic coefficients against cell
   size, so the grid can move again without silently retuning erosion;
   `epoch-scale-terrain.test.ts` holds that contract. The ocean-current
   pressure solve was decoupled from the terrain grid — it is side³ and would
   otherwise have made a deep-time jump cost 3.6 s.

   **Prior captures are not comparable.** Existing `GOLDEN_SHOTS` are retained
   unedited as the basis for pre-resize evidence but now frame a fifth of the
   world; new `w2k-` cameras and the `baseline2km` / `shield2km` capture sets
   are a fresh baseline. See "What the resize left open" below.
1. Establish renderer-independent multi-shield history, emergent island groups,
   habitat connectivity, and gene-flow boundaries using the bounded geological
   process grammar in `PRODUCT.md`. *`ArchipelagoHistory` / `ShieldHistory`
   landed 2026-08-15 in `src/archipelago-history.ts`: fixed mantle hotspot,
   crust-frame terrain, drift-resolved shield positions, birth along the chain,
   integrated construction and dormancy. Scale-free — a resize retunes
   `DEFAULT_DRIFT_RATE`, `SHIELD_SPACING` and `FULL_CONSTRUCTION_YEARS` and
   changes nothing structural.*

   *Grouping and connectivity landed 2026-08-15 in `src/island-geography.ts`:
   land components and every shield-pair saddle elevation from one
   descending-elevation join tree, plus `SeaLevelHistory` so a saddle becomes
   the dated span during which two habitats were one island. Shield zero is the
   authored starting island — `WorldHistory` is now version 9 and carries both
   records, advancing them on every jump.*

   *The terrain consumer landed 2026-08-15: `resolveVolcanicAccretion` now runs
   off `resolveShieldVents`, so the chain builds real land and saddles are ground
   rather than bare basin floor. Two shields merge across a +5.3 m saddle that
   erodes to 4.9 m, and a third emerges as its own island. `hotSpots` is retired;
   `WorldHistory` is version 10 and `ArchipelagoHistory` version 2.*

   **What is still missing is the population consumer.** `resolveIslandGeography`
   has no shipping-path caller yet — nothing reads island membership to decide
   gene flow. That is item 2.
2. Add population variance, founder bottlenecks, drift, path-dependent
   selection, and ancestry records only to the depth required by the sequence;
   express selection through authored trait pressures and tradeoffs.
3. Resolve the serialized landing fixtures and their causal explanation.
4. Render the regional geology and both descendant populations with a shared
   inherited visual history rooted in the opening Galápagos grammar.
5. Capture the declared sequence, run automated checks, and obtain owner visual
   verdicts.
6. Resume water composition, herd embodiment verdicts, freshwater transitions,
   and broader ecology only where the integrated proof exposes a need.

## Recorded owner verdicts

- **World scale, 2026-08-15** — "the scale is much better." Covers world scale
  and the shield silhouette only. See order-of-work item 0.
- **Multi-shield accretion, 2026-08-15** — "good initial first, it passes."

  **Scope.** This verdict covers the *geology reading*: that the hotspot chain
  produces a legible sequence of islands, that a land bridge forms between two
  shields and then erodes, and that the three plume settings are visibly
  distinct. It was recorded against the live WebGPU frame, not only the
  fallback `chain2km` captures.

  **It is explicitly not** a verdict on regional cohesion, reef-edge
  composition, organism quality, motion, or descendant readability — those
  remain the separate, unrecorded visual gates in "Definition of done". It is
  also not a verdict on the newest shield rendering as a flat dark disc, which
  is a known open defect recorded below and was visible in the frame that
  passed. "Initial first" is the owner's own qualifier and should be read as
  approving the direction, not closing the surface.

## Open defects

- **The newest shield renders flat and unlit.** On real WebGPU as well as the
  fallback, the youngest shield in the chain draws as a dark disc with no
  relief, while `scripts/shield-chain-readout.ts` says that shield should carry
  a ~32 m summit. Unresolved: shading versus the live pipeline actually sinking
  it. Isolate by comparing the shipping landing's elevations against the
  readout's at that shield's cell — the two run slightly different
  post-accretion steps.

## What the resize left open

Named here so the next unit does not have to rediscover them. None of these
blocks the owner verdict on scale itself.

- **The shield has no caldera.** The accretion target is a smooth `radial²`
  dome, so a vigorous vent still peaks rather than being summit-truncated. The
  mean flank is now right (6.6°) and the upper flank (~17°) is inside the
  Galápagos range, but "overturned soup bowl" is shape work that belongs to
  `volcanism.ts`, not to the extent.
- **Reef-edge composition needs its own pass.** The review shelf and its vent
  were re-seated by the island stretch factor and the reef band now sits at a
  real distance offshore, but a 244 m active shield dominates any wide framing
  the old fixture implied. `w2k-reef-above` is a near shot for that reason.
- **A deep-time jump costs ~0.41 s** of renderer-independent resolve at
  401×401, against ~0.33 s at the old 380 m world and 3.6 s if the ocean
  current solve had been left on the terrain grid. The pressure projection is
  still three quarters of it. Multi-shield accretion adds 4–11 ms and stays flat
  as the world ages, so the chain is not a cost concern.
- **The plume leaves the terrain grid after 2.45 Myr.** The heightfield is the
  crust frame, so the hotspot walks backwards through it and exits at x = -1000 m;
  shields born after that never make land. The full geology → isolation arc fits
  inside that window, so it does not block the current objective, but the chain
  tops out at about three on-grid islands.
- **Terrain accretion is not additive over sub-intervals.** Growth is an
  exponential approach capped per jump, so one 3 Myr click and three 1 Myr clicks
  give different islands. `construction` *is* additive; terrain is not. Captures
  of the chain must use `jumps=` to replay a rung cumulatively.
- **Scale constants hide in files a resize never opens.** Four were missed on
  the first pass and caught by review: the ocean shader's terrain UV divisor,
  the pathfinding search box, the drifter's arrival point, and migration reach.
  All now key to `RENDER_SCALE.AUTHORED_SCALE` or `islandLandRadius`. Before
  the next resize, grep `src/` for bare numeric literals used as metres rather
  than trusting the diff.
- **Fog, lighting and sea state were not retuned for the new distances.** They
  are the open `LW-6` / `LW-7` items; the resize makes them more visible
  because there is now a horizon to see.

## Ecosystem expansion rule

After the current proof clears, broaden the ecosystem by authoring recognizable
present-day Galápagos founder families and the resources they require. Each
family begins from an ancestral form with a bounded, inherited trait contract:
continuous traits that rendering can express, discrete adaptations represented
by authored variants, and explicit pressures, costs, and ecological consumers.

Do not author speculative future creatures as required landing outcomes. Forms
such as giant lightly armored tortoises or terrestrial sea-lion descendants are
possibility tests for the combined geology, climate, resource, population, and
inheritance rules. They are successful only if those rules can produce an
understandable path toward them—or credibly produce a different adaptation,
stasis, contraction, or extinction instead.

Expand one bounded family at a time. Prefer a founder family that adds a needed
ecological role or exercises a proven evolutionary seam; do not build a broad
catalogue ahead of the simulation and causal-reveal support that gives its
members consequences.

## Capability summary

| Area | Current state | Next gate |
|---|---|---|
| Form → jump → reveal loop | Implemented | Preserve while replacing isolated duration shots with one inherited sequence. |
| World scale | **Accepted** 2026-08-15 — 2,000 m extent at 401×401 cells (5.0 m/cell); shield mean flank measured at 6.6° | None. Do not reopen without a demonstrated failure. Prior captures are not a valid A/B. |
| Multi-shield archipelago record | Implemented renderer-independent in `archipelago-history.ts` with 40 tests; shield zero is the authored island | Preserve. The record advances every jump and validates as part of `WorldHistory` v9. |
| Emergent island grouping and connectivity | Implemented in `island-geography.ts` with 32 tests — land components, shield-pair saddles, `SeaLevelHistory`, dated connection episodes | Terrain consumer done. Still needs a *population* consumer: nothing reads island membership to decide gene flow. |
| Persistent terrain and volcanic change | **Accepted** 2026-08-15 — "good initial first, it passes." Accretion runs off `resolveShieldVents`; the player fixes hotspot position and drift bearing at world formation and thereafter holds one three-way plume setting | None. See the verdict's scope below before treating any other gate as satisfied. |
| Climate, hydrology, ocean, reef, and shared habitat sampling | Implemented in bounded forms | Reconcile fields with shield age, regional upwelling, and changing connectivity. |
| Terrestrial population persistence | Implemented with trait means, energy, abundance, Distant Drifter establishment, and bounded branching | Persistent variance, explicit gene flow, drift, and path-dependent authored selection. |
| Marine lineage and reef succession | Implemented as bounded proofs | Preserve; expand only for an integrated-proof consumer. |
| Aerial persistence and wider food web | Partial or planned | Deferred behind the current objective. |
| Landing-state renderer | Substantial WebGPU/TSL implementation | Regional multi-shield grammar and serialized proof captures. |
| Ecosystem assets | Grazer and coral accepted; tree, seagrass, and fish remain candidates | Use one recognizable present-day Galápagos founder family for the proof; after it clears, add ancestral families one at a time with bounded evolvable trait contracts. |
| Jump transition | Production direction selected; depth remains secondary | Revisit after landing causality reads clearly. |

“Implemented” means present with proportionate automated evidence. “Accepted”
is reserved for an explicit owner visual verdict. Detailed historical matrices
in `RENDERER-ROADMAP.md` and `WILDLIFE-ROADMAP.md` are retired snapshots; consult
them for migration detail, not priority.

## Definition of done for the current objective

- The same persisted world produces at least three declared landing states.
- Geological inheritance, connection loss, and habitat divergence are visible.
- One founder lineage branches through explicit isolation and inherited
  variation, not an arbitrary elapsed-time threshold.
- Each expressed trait difference has an authored pressure, cost, and
  player-visible consequence; no generic optimizer invents adaptations.
- Both descendant populations have credible resource paths, and their energy and
  abundance respond to resource change without renderer involvement.
- Descendants remain visibly related while their adaptations match their
  habitats.
- The explanation surface names the actual recorded causes and ancestry.
- Simulation tests cover grouping, gene flow, variance, drift/selection, and
  branching invariants.
- Fixed WebGPU captures cover overview, reef-edge composition, mid, and near
  views for the sequence.
- **Visual gate:** the owner separately records verdicts for regional cohesion,
  reef-edge composition, organism quality, motion, and descendant readability.
- **Causal gate:** without being told the intended mapping, a reviewer can use
  only the landing and its player-facing history to identify the divided
  habitats, associate the descendants' major adaptations with those habitats,
  and recount the geology → isolation → adaptation chain. Record their answers
  and any mistaken inference; an attractive screenshot cannot pass this gate.
- `npm test`, `npm run build`, and all touched asset checks pass.

## Deferred until this proof clears

- Additional fauna families or unrelated biome breadth.
- Authored speculative future species or predetermined evolutionary endpoints.
- Individual-animal persistence.
- Broad trophic catalogues and speculative cross-domain transitions.
- Renderer polish without a demonstrated failure in the integrated sequence.
- New documentation trackers or status systems.
