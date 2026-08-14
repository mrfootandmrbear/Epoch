# Wildlife roadmap — retired snapshot

> **Retired 2026-08-14:** Preserve this detailed capability history during
> migration, but do not take current priority or status from it. The maintained
> status and next gates live in [docs/EXECUTION.md](docs/EXECUTION.md); product
> and ownership rules live in [PRODUCT.md](PRODUCT.md) and
> [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

> **Status:** Canonical capability and experiment tracker.
> **Updated:** 2026-08-14.
> **Scope:** Wildlife, food-web connections, evolutionary lineages, and the ecosystem asset families that make those systems visible.

Landing-state rendering quality is tracked separately in [RENDERER-ROADMAP.md](RENDERER-ROADMAP.md); asset acceptance still requires an in-renderer owner verdict.

This page preserves the detailed pre-migration capability ledger. It no longer
sets product direction, current status, or priority; those live in `PRODUCT.md`
and `docs/EXECUTION.md`.

## Status vocabulary

- **Built:** implemented and covered by proportionate automated or visual evidence.
- **Experimenting:** a bounded hypothesis with a stated success test; not yet a reusable foundation.
- **Planned:** the next coherent extension after the active experiment.
- **Deferred:** intentionally outside the current sequence.

Asset production has a separate, stricter ladder: `brief` → `source` → `preview` → `candidate` → `accepted`. A system being built never implies that its visual asset is accepted.

## Product contract

Wildlife exists to make an epoch legible in hindsight. Populations—not individual animals—are simulation authority. A landing may instantiate individuals for movement and animation, but persistence belongs to lineage identity, habitat, traits, abundance, energy, ancestry, and ecological effects.

The canonical world is now the Galápagos-inspired hotspot archipelago defined
in `THESIS.md` §2.1 and `docs/GALAPAGOS-HOTSPOT-PLAN.md`. Wildlife development
prioritizes founder effects, changing island connectivity, gene flow, isolation,
drift, selection, adaptive radiation, reconnection, contraction, and extinction.
Additional animal breadth does not outrank proving one ancestor splitting into
visibly related specialists because geological change divided its populations.

Every living domain should follow the same data flow:

```text
terrain + climate + inherited ecosystem fields
  → immutable world snapshot
  → domain habitat/productivity samples
  → persistent population or colony resolution
  → semantic landing outcomes
  → replaceable render adapters and accepted asset families
  → coarse ecological effects inherited by the next jump
```

Domains exchange shared signals such as forage, coastal productivity, nutrients, prey availability, shelter, and substrate. They should not reach into one another's renderers or treat visible instance counts as simulation state.

Ocean colonization, resident/visitor scope, ecological pressure fields, and rare domain transitions are specified in [docs/OCEAN-COLONIZATION-AND-DOMAIN-TRANSITIONS.md](docs/OCEAN-COLONIZATION-AND-DOMAIN-TRANSITIONS.md). That study preserves the rationale; this roadmap controls sequencing and completion status.

## Capability ledger

| Layer | Status | Present contract | Next proof |
|---|---|---|---|
| Shared snapshot | **Built** | One sampled terrain/climate/forage state supplies land, freshwater, coast, and air scoring. | Add explicit marine nutrient, wave-stress, and benthic substrate fields only when their first consumer is implemented. |
| Water-volume habitat | **Built** as a bounded proof | Surface, midwater, and benthic nodes connect horizontally through open water and vertically within columns; body size controls shallow clearance. A separate benthic field records coral-facing depth, light, slope, and substrate stability. | Add current direction, oxygen, and persistent nutrients when the first consumer needs each field. |
| Terrestrial lineages | **Built** | Drifters introduce one tiny founder cohort; food-use adaptation, local forage, energy, and reproduction gate establishment. Established lineages persist identity, site, migration, abundance, extinction, bounded deep-time speciation, and means for body mass, leg length, foot width, insulation, coat warmth, coat lightness, and horn length. No per-axis variance is stored. | Replace primitive embodiment with one real fauna family and verify that trait extremes remain readable at gameplay distance. |
| Distant Drifter founder design | **Experimenting** | The arrival panel now chooses food source, size band, and origin climate. Launch commits a stable generated phenotype and inherited food-affinity profile; establishment shares food availability, size-linked maintenance, and origin-climate fit. Small latent plant and marine affinities preserve rare future trophic transitions without inventing terrestrial prey. | Add the real raft image/diorama, evolve food affinities through variance and selection, and add predation only from a real population-level pressure source. See `docs/DISTANT-DRIFTER-DESIGN.md`. |
| Per-population trait variance | **Planned; next evolutionary foundation** | Terrestrial lineages store means only; renderer variation is cosmetic. | Simulate bounded variance per axis with explicit responses to selection, drift, founder bottlenecks, and gene flow. |
| Habitat connectivity and gene flow | **Planned; next world/evolution seam** | Populations occupy sites and migrate, but no persistent graph states whether shields/islands exchange genes. | Derive stable habitat patches and connections from emergent island grouping; persist bounded gene-flow links between compatible populations. |
| Lineage hereditary/history record | **Planned** | Identity and ancestry persist; marine state reserves an origin domain and optional terrestrial ancestor seam. Distant Drifter separates founder provenance, hereditary state, condition, and history. | Record only trait means/variance, founder bottleneck, accumulated pressures, gene flow, ancestry, branching, reconnection, range, contraction, and extinction fields consumed by resolution or reporting. |
| Path-dependent selection and drift | **Planned** | Selection primarily reads current conditions and inherited means; small-population drift is not explicit. | Make two populations with different histories resolve differently under the same present conditions, and allow non-adaptive divergence under prolonged isolation. |
| Adaptive radiation and reconnection | **Planned; replaces isolated speciation tuning** | Bounded speciation exists, but geography, variance, and gene flow do not yet cause it. | Branch only after persistent isolation plus viable niche difference and sufficient divergence; let reconnection restore gene flow or permit bounded hybridization where compatibility remains. |
| Play-speed land behavior | **Built** | Terrain-aware paths, herd cohesion/separation, and walkability are renderer-side embodiments of resolved populations. Cohesion, separation, stride speed, and turn rate now read the population's trait means, so two lineages move differently; route requests run under a per-frame budget so a herd cannot stall a frame by re-pathing at once. Behaviour reads the means and never writes back. | Bias destination choice toward current forage without making local movement authoritative over epoch history. |
| Freshwater | **Built** as habitat; **planned** as ecology | Drainage-fed basins are derived from the shared snapshot. | Define one ecological consumer before adding nutrient transport or freshwater wildlife. |
| Marine animals | **Built** for one lineage; visual proof **experimenting** | A coastal-forager persists in connected 3D water bands with body-size clearance, depth choice, streamlining, maneuverability, depth control, thermal tolerance, energy, abundance, migration, and extinction. Its candidate renderer now expresses inherited shape, water band, condition, and swim cadence. | Owner verdict on the fixed fish showcase and live landing motion. |
| Ocean colonization scopes | **Planned** | The current first fish and reef sites begin locally; there is no explicit regional source pool or distinction between residents and visitors. | Separate regional arrival, local establishment, and ocean-owned visitation without tying ocean age to island age. |
| Marine/coastal pressure field | **Planned** | Marine energy exposes productivity, nursery capacity, prey, and shoreline subsidy, but populations do not yet write spatial grazing, predation, shell-predation, competition, recruitment, disease, or scavenging pressure. | Prove the smallest renderer-independent pressure contract with one consumer/resource response before adding a trophic catalogue. |
| Shoreline invertebrates | **Planned** | No persistent crab, filter-feeder, benthic grazer, or resident benthic predator population exists. | Use a coastal crab/scavenger as the first resident proof, then bound a crab–urchin–eel pressure loop; simulation role precedes asset production. |
| Large marine visitors | **Planned** | No distinction exists between an island-associated population and a mobile animal responding to the island from the wider ocean. | Derive episodic visitors from prey, temperature, currents, and breeding/resting habitat without silently creating island lineages. |
| Aerial animals | **Planned** | Nesting, lift, and nearby coastal food place one ephemeral flock. | Generalize the population contract after the marine experiment; add ancestry only after an aerial trait/energy model works. |
| Cross-domain evolution | **Planned; gated** | Marine history reserves a terrestrial ancestor seam, but no transition corridor or intermediate population state exists. | After both domains persist independently, prove consecutive viable intermediates and ancestry-preserving discrete branching; first target is marine crab to amphibious crab, followed by separate terrestrial- and aquatic-flightlessness paths in birds. |
| Reef succession | **Built** as a bounded proof | Persistent reef sites carry pioneer and living cover, accumulated framework, dead framework, stress, and connectivity across jumps. Deterministic tests cover recruitment, disturbance, survivors, retained dead structure, and conditional recovery; landing colonies remain renderer samples. | Add explicit in-game disturbance controls and domain-aware reef history reporting before broadening the food web. |
| Cross-domain food web | **Experimenting** | Forage drives land dynamics. Marine primary productivity, nursery capacity, fish abundance, prey availability, and shoreline subsidy form an explicit energy exchange; nesting aerial outcomes already read marine abundance. | Make runoff/nutrients persistent, then add one land or aerial consumer of prey/subsidy without feeding grazers implausibly. |
| Textual lineage/colony reporting | **Built** for land and first fish; **planned** for reefs | Land ancestry and fish condition/adaptation are reported textually. | Add domain-aware reef succession after the reef-site contract exists. |
| Field-notebook lineage card | **Planned** | No ancestry tree, trait sparklines, or biome glyph exists. | Consume the lineage DNA contract as a richer successor to the textual report; delivery surface remains open. |

**Trait expression for terrestrial lineages — built for the first accepted family:** Five morph channels (body mass, leg length, foot width, insulation, horn length) plus two per-instance coat-color scalars map the seven lineage fields. Three.js r185 reads per-instance weights from an `InstancedMesh` `DataTexture`, with morph vertex data stored separately in a `DataArrayTexture`. Pose-morph locomotion and one instanced draw per lineage are integrated and owner-accepted for `example-marsh-grazer`; other fauna must clear their own asset and visual gates.

Insulation additionally reaches the fragment stage on an instanced attribute mirrored from its morph weight, driving a coat surface treatment that a morph texture cannot reach; and each site samples its herd's two coat scalars from a seeded distribution rather than a single narrow band. Both are renderer-side sampling around the stored means, which are preserved. **The sim still stores no within-population variance**, and none of this is a step toward per-individual state — see the per-population trait variance row, which remains planned and is where real variance belongs.

## Asset ledger

| Asset family | Category | Stage | System relationship | Exact next gate |
|---|---|---:|---|---|
| `epoch-seagrass-meadow` | plant | **candidate** | Visible sheltered coastal productivity and nursery cover; slow per-tuft current sway is under renewed review. | Owner verdict on revised in-engine motion. |
| `epoch-canopy-tree` | plant | **candidate** | Visible woody cover, soil protection, forage structure, and mangrove habitat. | Owner visual verdict on the recorded showcase and previews. |
| `example-marsh-grazer` | animal | **accepted**; embodiment depth **experimenting** | Owner accepted the first fauna draft after revised topology/runtime export, four static views, island showcase, and paired live locomotion evidence. One instanced draw replaces each lineage's primitive groups. Herd scale has since risen to 96 per lineage with coat, LOD, and trait-driven movement layered on; a visible foreground WebGPU review run reported 60 fps and the same 15 draws. | Maintain the accepted evidence; future refinements must not silently replace it. The added embodiment work is tracked as **experimenting** in RENDERER-ROADMAP rungs 4–7 and still needs owner verdicts on density, coat read, LOD transitions, and movement. |
| `epoch-coastal-forager` | fish | **candidate** | Visual proof of the first persistent non-land lineage through one topology-stable, tail-propelled family. | Owner verdict on gameplay-distance silhouette, trait read, and swim motion in the fixed showcase. |
| `epoch-reef-builder-family` | coral | **accepted** | Owner accepted the paired mature-reef integration on 2026-08-13, including persistent carbonate shelf, exposed basalt, current-sorted colonies, and shared underwater optics. | Preserve the accepted family while future iterations deepen reef ecology. |
| First aerial lineage family | bird | **deferred** | Replaces the primitive flock after aerial persistence is proven. | Wait for the marine population abstraction to settle. |

The marsh grazer is the first accepted fauna family. Primitive swimmers and birds remain integration adapters. The reef-builder is the first accepted coral family.

## Completed experiment: persistent marine lineage

**Hypothesis:** the existing population-level land machinery can generalize to water without per-frame swimming physics or a parallel simulation silo.

**Bounded scope:** one fish lineage, one trophic role, and one landing renderer adapter. Its semantic trait vector should stay small: body size, streamlining, depth preference, thermal tolerance, and propulsion plan. Food intake comes from coastal productivity; costs come from body size, wave exposure, temperature mismatch, and depth mismatch. Continuous traits remain runtime parameters; a genuinely different fin/propulsion plan is a discrete authored variant.

**Success evidence:**

1. The lineage persists across repeated jumps with stable identity, site, traits, energy, and abundance.
2. A climate, sea-level, or wave change produces a predictable migration or trait response.
3. Food scarcity can contract or extinguish the lineage without renderer state participating.
4. Determinism and world-history validation tests cover the new state.
5. Trait extremes form a viable brief for one fish asset family and remain legible in a gameplay-distance comparison.

**Stop condition:** if marine needs cannot use a domain adapter over the existing lineage/history concepts, record the mismatch before generalizing further. Do not force fish into land-only types merely to claim reuse.

**Result:** accepted as a separate marine domain adapter over shared migration/adaptation concepts. The first coastal-forager persists renderer-independent state, reacts predictably to sea-level and temperature change, becomes extinct without viable food habitat, validates in world history, replays deterministically, reports its condition after each jump, and drives the primitive swimmer adapter. Its semantic traits are body size, streamlining, depth preference, thermal tolerance, and the discrete tail-propulsion plan.

The spatial follow-up replaced point-site movement with a coarse three-band water graph. Submerged relief can remove benthic or midwater passage without blocking surface passage; fish can route around closed columns; body size controls shallow-channel access. Maneuverability and depth control now complement streamlining, so reef-complexity and open-water pressures can reward different descendants. Marine state also records an origin domain and optional terrestrial ancestor seam, reserving credible grazer-to-amphibious-to-aquatic ancestry without triggering that transition before intermediate fitness is modeled.

That origin/ancestor seam is the existing precedent for a future general lineage-DNA contract. The first implementation should remain land-first; aerial ancestry still waits for a working aerial trait and energy model, and marine generalization must preserve the completed domain adapter rather than replacing it implicitly.

### Proposed lineage-DNA state

The Distant Drifter design narrows this proposal. Hereditary state should contain population-level trait means and variances plus diet and climate capabilities that fitness actually consumes. Player choices, origin climate, origin age, and the stable generation seed belong to an immutable founder profile. Energy, abundance, and realized stress belong to current condition. Trajectories, ancestral snapshots, environmental exposure, lineage depth, and branching references belong to lineage history rather than “DNA.” Do not bind a GPU buffer or replace the shipped speciation trigger until the simulation contract and the relationship between variance-driven and existing bounded speciation are proven.

## Completed experiment: reef succession

Coral follows the marine lineage experiment, but it is not an animal-lineage variant and not simply a colony whose health value changes. The persistent unit is a **reef site**: suitable seabed plus its inherited biological community and accumulated carbonate framework. Individual colonies can recruit, grow, compete, bleach, die, and be replaced while the reef itself records what earlier epochs built.

The resolver should make these broad phases legible without promising a precise ecological replay:

```text
bare suitable substrate
  → pioneer film / encrusting colonizers
  → scattered young coral recruits
  → competing colony patchwork
  → framework-building mature reef
  → disturbance, bleaching, burial, breakage, or drowning
  → recovery from surviving patches OR persistent dead framework
```

These are state transitions, not a mandatory linear ladder. A storm can reopen space and favor compact or encrusting forms. Clear, warm, shallow water can let branching or plating colonies expand. Sediment and turbidity can arrest recruitment. Rapid sea-level rise can drown a reef that cannot accrete upward quickly enough; exposure from falling sea level can kill its crest. A damaged reef may recover from surviving colonies, recruit a different growth-form mix, shift toward algae or seagrass, or remain a dead skeleton that still changes waves, shelter, substrate, and future recruitment.

### Reef-site state

The first state contract should be coarse and causal:

- **Substrate suitability:** hard surface, slope, depth, stability, and sediment burden.
- **Recruitment:** availability of colonizers plus connection to existing reef sites; a bare isolated seabed should not instantly become a mature reef.
- **Living cover:** the occupied fraction currently producing and extending living structure.
- **Growth-form composition:** shares of a small set of ecological grammars, initially no more than pioneer/encrusting and one framework builder.
- **Framework:** accumulated dead-and-living carbonate structure that persists after mortality and can accrete, erode, break, or become buried.
- **Stress and bleaching:** temperature anomaly, light, water quality, and elapsed exposure; bleaching is not synonymous with immediate death.
- **Competition:** initially an aggregate pressure representing coral, algae, and open substrate rather than several fully simulated species.
- **Connectivity:** a bounded dispersal signal from mature living reef sites that controls where new sites can establish.

Reef state belongs in world history, separate from rendered colony instances. The landing outcome samples that state into colonies, rubble, pale skeleton, algae, and habitat structure. Fish may consume the resulting shelter/productivity signals, but fish abundance must not directly author coral meshes.

### First bounded coral proof

The first asset family should still select one ecologically legible framework-building grammar—branching, massive, plating, foliose, columnar, or encrusting—and expose only habitat-driven parameters. A minimal pioneer state may use simple encrusting coverage rather than a second elaborate asset family. Light and depth govern usable energy; wave exposure rewards or penalizes growth form; sediment suppresses recruitment and living cover; competition limits expansion. Living color, bleaching, and dead skeleton are material/state parameters unless geometry genuinely changes.

**Success evidence:**

1. A bare but connected suitable site recruits pioneers before it can become a mature reef; an unsuitable or isolated site does not.
2. Living cover, growth-form composition, and carbonate framework persist across repeated jumps independently of rendered instances.
3. Depth, light, wave exposure, sediment, competition, temperature stress, and connectivity visibly change recruitment, colony state, morphology, or succession direction.
4. Bleaching, mortality, and recovery are causal landing outcomes, not timed visual effects, and bleaching can resolve to either recovery or partial death.
5. Dead skeleton remains as inherited framework after mortality, affects later habitat, and erodes or becomes buried rather than vanishing on the next landing.
6. A disturbed reef can recover from survivors, recruit a different community, or fail to recover depending on the next epoch's conditions.
7. A generated colony seats correctly on irregular seabed, reads at gameplay distance, and advances through the normal coral asset gates with a recorded owner verdict.

## Planned sequence

1. **Preserve completed foundations:** marine lineages, reef sites/succession, reef visual proof, marine habitat exchange, and accepted fauna rendering remain evidence—not the next expansion target.
2. **Archipelago habitat identity:** consume stable shield, emergent-island, habitat-patch, and connection IDs from the new world history.
3. **Founder fixture:** establish one land population across two connected volcanic shields through the real arrival/fitness path.
4. **Terrestrial trait variance:** add bounded hereditary variance and founder bottleneck effects without individual genomes.
5. **Gene-flow graph:** derive ongoing exchange from saddle, water, distance, dispersal capability, and island connectivity.
6. **Path-dependent selection and drift:** accumulate habitat pressures; allow isolated small populations to diverge adaptively and non-adaptively.
7. **Radiation/reconnection contract:** resolve branching, restored gene flow, bounded compatibility, contraction, and extinction from persistent history rather than jump duration alone.
8. **Two-shield evolutionary proof:** a 100,000-year landing divides the founder population; a later landing reveals two visibly related specialists with different traits, behavior, abundance, and range.
9. **Causal lineage view:** explain where isolation occurred, what pressures mattered, what changed visibly, whether gene flow continued, and what survived.
10. **Regional marine coupling:** reinterpret ocean temperature/productivity around upwelling, reef, seabird, shoreline, and terrestrial-subsidy relationships.
11. **Only after the proof:** resume new crab, aerial, visitor, food-web, transition-corridor, and additional asset-family breadth in Galápagos-relevant order.

## Deferred until earned

- Per-individual genomes, neural controllers, and continuous reproductive simulation.
- Full hydrodynamic swimming physics as the selection engine.
- Multiple trophic levels before one consumer/resource loop is legible.
- Cross-domain evolutionary transitions before both source and destination domains persist independently.
- Direct domain or locomotor archetype swaps without consecutive viable intermediate populations.
- Treating abundant ground food by itself as sufficient selection for bird flightlessness.
- Treating a large marine visitor sighting as an island-owned evolutionary lineage.
- A larger island solely to make unfinished food-web behavior appear spatially richer.
- Additional wildlife families without a bounded ecological role and asset owner.
- Wildlife or habitat families whose primary purpose is an unrelated global climate preset.

## Maintenance rule

Update this page in the same change that alters a listed capability, experiment result, or asset stage. Design-study documents may preserve their original proposal, but their header must point here and identify any steps already superseded by implementation.
