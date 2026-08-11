# Wildlife roadmap

> **Status:** Canonical capability and experiment tracker.
> **Updated:** 2026-08-11.
> **Scope:** Wildlife, food-web connections, evolutionary lineages, and the ecosystem asset families that make those systems visible.

Epoch deliberately avoids a heavyweight decision register. This page answers the smaller operational questions: what is built, what is being tested, what comes next, and what evidence advances it. `THESIS.md` remains product direction; design studies remain rationale. When they disagree about current status, this page wins.

## Status vocabulary

- **Built:** implemented and covered by proportionate automated or visual evidence.
- **Experimenting:** a bounded hypothesis with a stated success test; not yet a reusable foundation.
- **Planned:** the next coherent extension after the active experiment.
- **Deferred:** intentionally outside the current sequence.

Asset production has a separate, stricter ladder: `brief` → `source` → `preview` → `candidate` → `accepted`. A system being built never implies that its visual asset is accepted.

## Product contract

Wildlife exists to make an epoch legible in hindsight. Populations—not individual animals—are simulation authority. A landing may instantiate individuals for movement and animation, but persistence belongs to lineage identity, habitat, traits, abundance, energy, ancestry, and ecological effects.

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

## Capability ledger

| Layer | Status | Present contract | Next proof |
|---|---|---|---|
| Shared snapshot | **Built** | One sampled terrain/climate/forage state supplies land, freshwater, coast, and air scoring. | Add explicit marine nutrient, wave-stress, and benthic substrate fields only when their first consumer is implemented. |
| Terrestrial lineages | **Built** | Persistent identity, site, seven-trait means, inheritance, migration, energy, abundance, extinction, and bounded deep-time speciation. | Replace primitive embodiment with one real fauna family and verify that trait extremes remain readable at gameplay distance. |
| Play-speed land behavior | **Built** | Terrain-aware paths, herd cohesion/separation, and walkability are renderer-side embodiments of resolved populations. | Bias destination choice toward current forage without making local movement authoritative over epoch history. |
| Freshwater | **Built** as habitat; **planned** as ecology | Drainage-fed basins are derived from the shared snapshot. | Define one ecological consumer before adding nutrient transport or freshwater wildlife. |
| Marine animals | **Experimenting** | Coastal productivity places ephemeral swimmers; no persistent marine lineage exists. | Prove one persistent fish lineage driven by food, depth, temperature, and wave cost. |
| Aerial animals | **Planned** | Nesting, lift, and nearby coastal food place one ephemeral flock. | Generalize the population contract after the marine experiment; add ancestry only after an aerial trait/energy model works. |
| Reef succession | **Planned** | No reef-site history or coral renderer exists. Seagrass proves submerged instancing, not reef ecology. | Prove colonization, persistent framework, disturbance, and recovery with one bounded coral growth family. |
| Cross-domain food web | **Experimenting** | Forage drives land site choice, energy, abundance, grazing depletion, and regrowth. Other links remain heuristic. | Feed land vegetation/runoff into marine productivity, then expose fish food availability for birds. |
| Lineage/colony history UI | **Built** for land reporting; **planned** beyond land | Land changes and ancestry are reported textually. | Add a readable branching view only after a second domain shares the history contract. |

## Asset ledger

| Asset family | Category | Stage | System relationship | Exact next gate |
|---|---|---:|---|---|
| `epoch-seagrass-meadow` | plant | **accepted** | Visible sheltered coastal productivity and nursery cover. | No gate. Revisit density/color only through a called-out refresh. |
| `epoch-canopy-tree` | plant | **candidate** | Visible woody cover, soil protection, forage structure, and mangrove habitat. | Owner visual verdict on the recorded showcase and previews. |
| `example-marsh-grazer` | animal | **brief** | Illustrative trait/asset contract; not a production creature. | Select Foxel source workflow and define the shared rig, discrete foot variants, and reproducible procedure. |
| First marine lineage family | fish | **planned** | Visual proof of the first persistent non-land lineage. | Create a brief only when the marine experiment fixes its trait contract. |
| First reef-builder family | coral | **planned** | Visual proof of reef succession, habitat-driven morphology, bleaching, and dead framework. | Create a brief only when reef-site state and growth pressures are specified. |
| First aerial lineage family | bird | **deferred** | Replaces the primitive flock after aerial persistence is proven. | Wait for the marine population abstraction to settle. |

No fauna or coral asset is currently a visual candidate. Primitive grazers, swimmers, and birds are integration adapters, not accepted wildlife.

## Active experiment: persistent marine lineage

**Hypothesis:** the existing population-level land machinery can generalize to water without per-frame swimming physics or a parallel simulation silo.

**Bounded scope:** one fish lineage, one trophic role, and one landing renderer adapter. Its semantic trait vector should stay small: body size, streamlining, depth preference, thermal tolerance, and propulsion plan. Food intake comes from coastal productivity; costs come from body size, wave exposure, temperature mismatch, and depth mismatch. Continuous traits remain runtime parameters; a genuinely different fin/propulsion plan is a discrete authored variant.

**Success evidence:**

1. The lineage persists across repeated jumps with stable identity, site, traits, energy, and abundance.
2. A climate, sea-level, or wave change produces a predictable migration or trait response.
3. Food scarcity can contract or extinguish the lineage without renderer state participating.
4. Determinism and world-history validation tests cover the new state.
5. Trait extremes form a viable brief for one fish asset family and remain legible in a gameplay-distance comparison.

**Stop condition:** if marine needs cannot use a domain adapter over the existing lineage/history concepts, record the mismatch before generalizing further. Do not force fish into land-only types merely to claim reuse.

## Next experiment: reef succession

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

1. **Marine population contract:** implement and test the active fish-lineage experiment.
2. **Marine visual proof:** advance one fish family from brief through candidate; require owner visual judgment before acceptance.
3. **Reef-site contract:** add persistent substrate suitability, recruitment, living cover, composition, framework, stress, competition, and connectivity.
4. **Reef succession proof:** show bare connected substrate progressing through pioneers toward a young reef, then test one disturbance and its conditional recovery across later jumps.
5. **Coral visual proof:** advance one reef-builder family through colony and gameplay-distance previews, seabed seating, living/bleached/dead states, candidate integration, and owner verdict.
6. **Marine food exchange:** let vegetation/runoff and coral/seagrass habitat affect productivity; let fish consumption feed back at epoch scale.
7. **Aerial persistence:** reuse the settled population concepts with nesting, lift, metabolic cost, and marine prey availability.
8. **Cross-domain branching:** only then test rare land/coastal-to-air ancestry. It is a deep-time outcome, not a prerequisite for credible birds.
9. **History visualization:** present land, fish, bird, and reef histories with domain-appropriate relationships; reef succession should not be mislabeled as animal speciation.

## Deferred until earned

- Per-individual genomes, neural controllers, and continuous reproductive simulation.
- Full hydrodynamic swimming physics as the selection engine.
- Multiple trophic levels before one consumer/resource loop is legible.
- Cross-domain evolutionary transitions before both source and destination domains persist independently.
- A larger island solely to make unfinished food-web behavior appear spatially richer.
- Additional wildlife families without a bounded ecological role and asset owner.

## Maintenance rule

Update this page in the same change that alters a listed capability, experiment result, or asset stage. Design-study documents may preserve their original proposal, but their header must point here and identify any steps already superseded by implementation.
