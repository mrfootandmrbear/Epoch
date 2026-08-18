# Epoch execution direction

> **Class:** Contract. **Authority:** Canonical source for current state and
> priority. **Updated:** 2026-08-18. Update whenever a listed capability,
> priority, or verdict changes.

## Current objective

Prove one inherited hotspot-archipelago sequence in which volcanic history
changes land connectivity and habitat, a founder population loses gene flow,
and later descendants become visibly related specialists. The sequence must be
legible as geology → isolation → adaptation at overview, mid, and near scales.
Overview is geology plus occupancy (which islands are inhabited). Individual
bodies are an inspection subject: mid and near, reached by flying to a lineage.
The founder must be a recognizable present-day Galápagos lineage, not a generic
creature or an authored future species. This first proof must establish the
inheritance rules that later allow the world to become radically different
without becoming arbitrary or converging on a predetermined bestiary.

**How the remaining work is dispatched.** One brief per Cursor session, from
`docs/briefs/`. Do not start the next brief in the same chat. Cloud Agents may
run simulation and lockfile units; founder embodiment, fps diagnostic, and owner
look need local WebGPU.

| Next | Brief | Gate |
|---|---|---|
| **Now** | [WU-4c](briefs/WU-4c-ancestry-split.md) — ancestry vs habitat split | Owner: descendant readability at mid/near |
| After that | Item 5 captures + visual and causal gates | Recorded in this file |
| Parallel, optional | [WU-P0-1](briefs/WU-P0-1-lockfile.md) — clean `npm install` | Tests on a fresh clone |

Do not resume LW-6, LW-7, extra fauna, or atmosphere identity unless a proof
capture shows the sequence fails without them.

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

   *The population consumer landed 2026-08-15.* `resolveIslandGeography` gained a
   point query (`islandAt`); `landing-state.advance` resolves the geography at
   each landing's stand and threads it, with `seaLevelHistory`, into
   `resolveLanding`. Nothing about the grouping record itself changed — this is
   its first reader. See item 2.
2. Add population variance, founder bottlenecks, drift, path-dependent
   selection, and ancestry records only to the depth required by the sequence;
   express selection through authored trait pressures and tradeoffs.
   *Implemented 2026-08-15 in `outcome-resolver.ts`: gene flow homogenizes
   same-island lineages, branching is driven by island isolation (vicariance
   dated from a drowned saddle, or an epoch-gated dispersal) rather than the old
   elapsed-time cooldown, isolated lineages drift, and a branch records its
   `origin` cause. Gated on geography being present, so the determinism baseline
   (geography-free fixtures) is unchanged. Verified end-to-end on the real 2 km
   world via `scripts/gene-flow-readout.ts`. Still bounded: "path-dependent
   selection" is present only as inherited-trait blending toward the new
   island's habitat.*

   *`migratedSite`'s water-blindness closed 2026-08-15: ordinary migration and
   the wide reanchor search (after a population's exact site drowns) now both
   require the candidate to share a land connection with wherever the
   population currently stands (`islandAt`, falling back to `nearestIslandId`
   when the exact site has drowned outright), so a lineage can no longer
   "migrate" to a different island with no path between them. Gated on
   geography exactly like the rest of item 2, so the legacy fixture path is
   unchanged; 5 new tests in `island-geography.test.ts` and `gene-flow.test.ts`
   reproduce the old bug against the pre-fix resolver before confirming the fix
   closes it.*
3. Resolve the serialized landing fixtures and their causal explanation.
   *Implemented 2026-08-16 (WU-A5). Three proof fixtures defined:*
   - *Established (jump 2, Year 2M): founder takes hold on the main island.*
   - *Speciated (jump 3, Year 3M): first branch disperses to a new volcanic
     island — two coexisting populations on separate islands.*
   - *Diversified (jump 5, Year 5M): three living populations across two
     islands, with continued branching and trait divergence.*

   *Balance fixes required to reach stable coexistence:*
   - *Coastal food floor in `terrain-history.ts`: land cells within 15 m of sea
     level get a marine-derived forage floor (0.30 at sea level, tapering),
     applied post-accretion via `applyCoastalForageFloor` so young volcanic
     islands aren't starved by lava resurfacing.*
   - *Coastal supplement in `outcome-resolver.ts`: established-population intake
     adds up to 0.16 from coastal proximity, matching the founder pathway's
     existing `coastalProductivity` accounting.*
   - *Maintenance thresholds lowered: energy 0.48→0.38, abundance 0.52→0.42,
     energy-to-abundance 0.45→0.38. The old thresholds exceeded the forage
     available on a moderate Galápagos island.*
   - *Epoch story (`epoch-story.ts`) now reports establishment events after the
     first jump.*

   *Causal explanation verified at each fixture: the epoch story names dispersal
   causes ("across open water"), the lineage report names isolation dates and
   habitat labels, and trait changes show opposite adaptation directions between
   parent (temperate/sheltered) and branch (wet) populations. Capture set
   `proofSequence` added to `scripts/capture.mjs`.*
4. Render the regional geology and both descendant populations with a shared
   inherited visual history rooted in the opening Galápagos grammar.
   *Split 2026-08-17 into WU-4a (Galápagos land-iguana family, candidate),
   WU-4b (place proof populations), WU-4c (ancestry vs habitat split). The
   accepted marsh-grazer remains on disk as prior evidence; the proof path must
   stop using it as the founder look.*
   *WU-4a accepted 2026-08-18: package `galapagos-land-iguana` is **accepted**.
   The proof embodiment (`createCreatureExpressionSpike`, landing herds, raft
   founders) uses that export. `hornLength` is a nuchal/dorsal crest. Owner:
   "the iguana model passes for now." Scope is the founder look, not placement
   (WU-4b) or descendant split (WU-4c).*
   *WU-4b accepted 2026-08-18: proof herds seat through the same `advance` /
   `resolveLanding` path a player click uses. Abundance drives visible count;
   seats stay on the lineage's `islandAt` home and do not pack a full cap into
   an 11 m radius. Showcase herds are not used on the proof URLs. Capture set
   `proofPlacement` and cameras `proof-established-*` / `proof-speciated-*` /
   `proof-diversified-*` were added; existing `GOLDEN_SHOTS` are unedited.
   Owner: herds are on the islands the lineage report names. Scope is placement,
   not occupancy/spacing (WU-4b2) or descendant split (WU-4c).*
   *WU-4b2 accepted 2026-08-18: overview occupancy is one cheap disc per living
   lineage, hidden inside 64 m of 3D camera distance so mid/near still show the
   herd. Horizontal-only distance hid the disc from an overhead overview.
   `deriveHerdBehavior` neighbour distance is ~1.5–2.5 m for a metre-true land
   iguana; wander stays inside cohesion so mid cameras read a cluster, not
   pepper. The extra 0.9 `herdScale` squash is gone — package `scaleMeters` is
   the player-facing size. Mesh size and world scale were not reopened.
   Near-camera fps was [WU-D1](briefs/WU-D1-near-fps.md); it measured clean and
   the defect is closed as stale (see "Open defects"), so WU-4c's near owner
   look is unblocked. Owner: inhabited islands read at overview; each living lineage reads as
   a herd at mid. Scope is occupancy and mid herd mass, not descendant
   readability (WU-4c).*
5. Capture the declared sequence, run automated checks, and obtain owner visual
   verdicts.
   *Attempted and retracted 2026-08-15, same day — see LOG.md "Correction".*
   *Unblocked 2026-08-16 (WU-A4): terrain forage potential was too low for any
   founder to establish. Raised the base from 0.48 → 0.58 and the fertility
   floor from 0.08 → 0.22 in `terrain-history.ts:348`.
   `scripts/founding-split-readout.ts` now shows: founder not-established at
   jump 1, established at jump 2, speciated via island dispersal at jump 3.
   The default founder (small ground-plants temperate-seasonal) on the default
   weathered island with active plume reaches two coexisting populations on
   separate islands by Year 3,000,000. BACKLOG P1-1 ("fauna is unreachable
   by automated capture") is unblocked — `?founders=drifter&plume=active&
   years=1000000&jumps=2` reaches an established founder, `jumps=3` reaches
   speciation. Items 3–4 can now proceed.*
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
- **Founder viability band-2 density, 2026-08-16** — accepted as-is. WU-A1
  (`docs/briefs/WU-A1-founder-viability.md`) flagged that the "marginal"
  band only covers 14–18% of the 60-choice × 3-island matrix rather than
  "most cells," for a structural reason (the world's best-site forage tops
  out too close to the break-even threshold to widen the band further
  without collapsing the well-matched band). Owner reviewed this gap and did
  not ask for a follow-up unit. Do not reopen without a new demonstrated
  need — see the WU-A1 entry in `docs/polish/LOG.md` (2026-08-16) for the
  full matrix.
- **Raft arrival camera beat, 2026-08-16** — accepted. WU-A3
  (`docs/briefs/WU-A3-raft-arrival.md`) closes backlog LW-5. Live
  verification in the review harness was inconclusive (the browser pane's
  throttled `requestAnimationFrame` on a backgrounded tab could not render
  the beat at usable speed); the owner confirmed it directly on their own
  machine instead.
- **Land-iguana founder family, 2026-08-18** — "the iguana model passes for
  now." WU-4a (`docs/briefs/WU-4a-founder-family.md`). Covers the founder look:
  a recognizable Galápagos land-iguana family at gameplay distance, with
  `hornLength` expressed as a nuchal/dorsal crest rather than mammal horns.
  The marsh-grazer remains on disk as prior evidence and is no longer the
  proof-path embodiment.

  **It is explicitly not** a verdict on descendant readability (WU-4c), motion,
  regional cohesion, or reef-edge composition.
  "For now" is the owner's qualifier: the family is good enough to carry the
  proof; later look work is allowed if a later capture shows the sequence
  failing without it.
- **Proof placement, 2026-08-18** — herds sit on the islands the lineage report
  names. WU-4b (`docs/briefs/WU-4b-proof-placement.md`). Covers seating live
  lineages through `advance` / `resolveLanding`, abundance-driven counts, and
  home-island seats. Inspection fly to ~38 m stays.

  **It is explicitly not** a verdict on descendant readability (WU-4c), motion,
  or the near-camera fps defect.
- **Overview occupancy and mid herd mass, 2026-08-18** — inhabited islands read
  at overview; each living lineage reads as a herd at mid. WU-4b2
  (`docs/briefs/WU-4b2-herd-presentation.md`). Covers one occupancy disc per
  living lineage, iguana-scale spacing (~1.5–2.5 m), and dropping the extra
  0.9 herd squash. Inspection fly to ~38 m stays. Occupancy hide distance is
  3D, so an overhead overview still reads inhabited islands.

  **It is explicitly not** a verdict on descendant readability (WU-4c), motion,
  regional cohesion, reef-edge composition, or the near-camera fps defect.

## Open defects

- ~~**Zooming in on creatures bogs the framerate down, 2026-08-16.**~~
  **Closed as stale 2026-08-18 (WU-D1).** The owner measured the D1 fixture
  (`?founders=drifter&plume=active&years=1000000&jumps=5`, three living
  lineages) in foreground Chromium on the WebGPU backend, flying to the parent
  lineage at the 38 m inspection stop:

  | Near stop, 38 m | fps |
  |---|---|
  | Baseline | 60 |
  | `diag=no-herd` | 60 |

  Near holds the 60 fps target with the herd drawing, and hiding the herd
  changes nothing — so there is no near-camera cost left to name on this
  fixture and no fix unit is warranted. The remaining `diag` flags
  (`flat-hide`, `freeze-pose`, `far-lod`, `no-fft`, `no-shadow`) were not
  exercised because the baseline already passed. WU-4c's near owner look is
  unblocked.

  **Scope of the closure.** This is the D1 fixture at the D1 stop, not a
  statement that every session holds 60 fps. The original report came from
  ordinary live play, which may have differed in jumps taken, herds shown, or
  time on the clock. If the slowdown recurs, reopen with what that session was
  doing — the isolation flags are already shipped in `src/render-diag.ts` and
  cost nothing to run.

  **Two herd-path defects D1 surfaced but did not measure**, recorded so they
  are not rediscovered. Neither is urgent now that near passes, and neither
  should be "fixed" without a demonstrated cost:
  - `creaturePoseNear` / `creaturePoseFar` (130 m / 300 m in
    `src/render-scale.ts`) are documented in the file as sized for a 2.1 m
    grazer shoulder, but the founder is a 0.26 m-hip land iguana. Pose writes
    run roughly 8× further out than the animal's size warrants.
  - `syncHerdMatrices` (`src/landing-state.ts`) recomputes a bounding sphere
    and re-uploads the full instance matrix every frame per lineage whether or
    not anything moved.
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
| Emergent island grouping and connectivity | Implemented in `island-geography.ts` with 35 tests — land components, shield-pair saddles, `SeaLevelHistory`, dated connection episodes, and an `islandAt` point query | Both consumers done: terrain (accretion) and population (gene flow) now read it. Preserve. |
| Persistent terrain and volcanic change | **Accepted** 2026-08-15 — "good initial first, it passes." Accretion runs off `resolveShieldVents`; the player fixes hotspot position and drift bearing at world formation and thereafter holds one three-way plume setting | None. See the verdict's scope below before treating any other gate as satisfied. |
| Climate, hydrology, ocean, reef, and shared habitat sampling | Implemented in bounded forms | Reconcile fields with shield age, regional upwelling, and changing connectivity. |
| Terrestrial population persistence | Implemented with trait means, energy, abundance, Distant Drifter establishment, and now island-driven gene flow, isolation branching, drift, and ancestry records (`gene-flow.test.ts`) | Deepen path-dependent selection and per-lineage variance only where the serialized proof (items 3–5) exposes a need. |
| Marine lineage and reef succession | Implemented as bounded proofs | Preserve; expand only for an integrated-proof consumer. |
| Aerial persistence and wider food web | Partial or planned | Deferred behind the current objective. |
| Landing-state renderer | Substantial WebGPU/TSL implementation | Regional multi-shield grammar and serialized proof captures. |
| Ecosystem assets | Grazer, coral, and land-iguana founder family **accepted** (WU-4a, 2026-08-18); proof placement **accepted** (WU-4b, 2026-08-18); overview occupancy and mid herd mass **accepted** (WU-4b2, 2026-08-18); tree, seagrass, and fish remain candidates | WU-4c descendant readability at mid/near (near-camera fps closed as stale, WU-D1, 2026-08-18). |
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
- The lightweight biodiversity/ecosystem-health indicator named in
  `PRODUCT.md` — needs species breadth beyond the current single grazer
  family to be meaningful.
