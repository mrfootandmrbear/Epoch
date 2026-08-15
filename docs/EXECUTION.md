# Epoch execution direction

> **Class:** Contract. **Authority:** Canonical source for current state and
> priority. **Updated:** 2026-08-14. Update whenever a listed capability,
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

0. **Resolve world scale before building further on `RENDER_SCALE.islandExtent`.**
   The 380 m extent is a render-proof-of-concept inheritance and is too small
   for the shield forms this direction requires. At the radius and cap
   `volcanism.ts` currently builds (68 m / 52 m) a vigorous vent produces a
   ~49° upper flank — a cinder cone, not the broad shield the visual contract
   calls for. A 48 m summit at a credible 10° shield slope needs a 272 m base
   radius, so a single plausible shield is wider than the whole present grid,
   and a two-shield saddle wants roughly 1.2 km. Owner independently reports a
   "weird sense of scale" in playthroughs, which this explains: every other
   dimension in the world is honest in metres, so the island reads as a model.
   The change is cross-cutting — camera clamps, LOD bands, ocean extent,
   terrain segment count, sculpt brush radii, and the erosion tuning calibrated
   at 2.11 m/cell — and it invalidates every existing golden-shot comparison.
   Treat it as its own Work Unit with an owner before/after verdict.
   *Adopted 2026-08-15.*
1. Establish renderer-independent multi-shield history, emergent island groups,
   habitat connectivity, and gene-flow boundaries using the bounded geological
   process grammar in `PRODUCT.md`. *`ArchipelagoHistory` / `ShieldHistory`
   landed 2026-08-15 in `src/archipelago-history.ts`: fixed mantle hotspot,
   crust-frame terrain, drift-resolved shield positions, birth along the chain,
   integrated construction and dormancy. Scale-free — a resize retunes
   `DEFAULT_DRIFT_RATE`, `SHIELD_SPACING` and `FULL_CONSTRUCTION_YEARS` and
   changes nothing structural. Island grouping and connectivity are still open.*
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
| World scale | 380 m island extent at 181×181 cells (2.11 m/cell), inherited from the render proof of concept | Resolve the extent; current geometry cannot express a shield silhouette. See order of work item 0. |
| Multi-shield archipelago record | Implemented renderer-independent in `archipelago-history.ts` with 40 tests | Emergent island grouping, saddle connectivity, sea-level history; then wire the existing island in as shield zero. |
| Persistent terrain and volcanic change | Implemented for the current island model | Multi-shield accretion and stable derived island grouping. |
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
