# Ocean colonization, ecological pressure, and domain transitions

> **Status:** Planned design contract, 2026-08-13.
> **Canonical sequencing:** [WILDLIFE-ROADMAP.md](../WILDLIFE-ROADMAP.md).
> **Purpose:** Preserve the decisions behind expanding Epoch's ocean life, food web, and rare evolutionary transitions between water, land, and air. This document does not claim implementation or accepted assets.

## Product outcome

An island does not begin in an empty ocean. Ocean life exists beyond the playable island, reaches it through currents and migration, establishes where the island creates viable habitat, and changes as the island changes. Small resident populations should make the food web legible; large visitors should make a productive island feel connected to a larger world.

Over sufficiently long jumps, a player who sustains unusual but viable conditions may also reveal a descendant population crossing a domain boundary. The player creates selection pressures and habitat corridors; the player never selects an evolution command. A transition succeeds only when each intermediate population can feed, reproduce, and persist.

The desired reveal is explanatory in hindsight: a terrestrial crab, flightless island bird, penguin-like pursuit diver, or secondarily aquatic grazer should visibly retain its ancestry while making sense as an answer to this island.

## Three persistence scopes

Marine life needs three scopes rather than one list of island-owned species.

1. **Regional ocean pool:** pre-exists the island and supplies larvae, drifting colonists, migrants, and recolonization after local extinction. Temperature province, current connectivity, isolation, and elapsed time constrain what can arrive.
2. **Island-associated residents:** persistent populations established on the island's intertidal zone, shelf, reef, seagrass, mangroves, caves, beaches, or connected streams. These populations carry ancestry, traits, condition, abundance, site, and ecological effects across jumps.
3. **Visitors:** ocean-owned animals such as sharks, rays, turtles, tuna, whales, and seals. Their presence responds to prey, temperature, currents, breeding habitat, cleaning or resting habitat, and season-like jump conditions. A sighting is not automatically a resident lineage.

A new volcanic island may receive visitors immediately, acquire films and larval recruits quickly, and still take much longer to develop mature resident communities or terrestrial colonists. Island age must not be treated as ocean age.

## Colonization routes

Arrival and establishment are separate gates. Supported routes are:

- pelagic larvae carried by currents;
- rafting on vegetation, wrack, pumice, or other floating habitat;
- active swimming or seasonal migration;
- repeated shoreline excursions by amphibious populations;
- ocean-connected stream recruitment by amphidromous fish and crustaceans;
- transport and nutrient movement by birds and other mobile link animals.

Arrival depends primarily on the regional pool and connectivity. Establishment depends on local food, substrate, shelter, climate fit, reproduction, and pressure from residents. A failed establishment can be retried by later arrivals; local extinction does not erase the regional source.

## Functional food-web groups

Simulate ecological functions before building a taxonomic catalogue.

| Group | Referents | Shared signals read | Coarse effects written |
|---|---|---|---|
| Shoreline scavengers and detritivores | shore, hermit, mangrove, and land crabs; amphipods | wrack, carrion, shoreline subsidy, moisture, shelter | nutrient transport, detritus removal, seed and seedling pressure, prey biomass |
| Benthic grazers | urchins, limpets, grazing snails | algae, reef or kelp cover, substrate, predator refuge | grazing pressure, open settlement space, bioerosion, barren risk |
| Filter feeders | clams, mussels, oysters, sponges | planktonic productivity, flow, sediment, substrate | benthic biomass, water filtering, shell or bed structure, prey biomass |
| Structure makers | oyster beds, mussel mats, tube-worm reefs | recruitment, flow, substrate stability | roughness, shelter, nursery capacity, settlement substrate |
| Small resident predators | eels, octopus, lobsters, sea stars | prey biomass, caves, reef complexity, temperature | predation pressure, shell predation, prey redistribution |
| Amphidromous colonizers | gobies, shrimp, freshwater eels | open stream route, flow, ocean recruitment | marine-freshwater energy exchange, stream grazing or predation |
| Large visitors | sharks, rays, turtles, seals, whales, large schooling fish | prey, migration corridor, breeding or resting habitat | episodic predation, grazing, disturbance, carcass or nutrient pulse |

The first resident proof should be a coastal crab/scavenger population because it can connect marine productivity, wrack, shoreline prey, terrestrial nutrients, seedling recruitment, and bird or eel predation. It should precede a crab asset package; the simulation contract must define which morphology and motion are required.

The first multi-member pressure loop should remain bounded: **crab/scavenger → urchin/grazer → eel/ambush predator**. Aggregate guild state is acceptable until a persistent population is needed for ancestry, trait evolution, or a visually important reveal.

## Shared ecological pressure field

Populations exchange coarse fields through the world snapshot. They do not inspect one another's renderer instances or directly mutate another lineage.

The planned marine/coastal pressure vocabulary is:

- `grazingPressure`
- `predationPressure`
- `shellPredation`
- `competitionPressure`
- `disturbancePressure`
- `recruitmentPressure`
- `nurseryValue`
- `diseasePressure`
- `shorelineScavengePressure`

Names and storage layout remain implementation decisions. The contract is that pressure must be population-derived, spatially coarse, bounded, inherited only when ecologically appropriate, and consumed by fitness or succession before it earns persistent state.

Examples of pressure-to-trait responses include:

| Pressure | Plausible selected responses |
|---|---|
| Ambush predators | shelter use, maneuverability, camouflage, nocturnality, smaller accessible profile |
| Pursuit predators | schooling, speed, streamlining, deeper or more open habitat |
| Shell predation | shell thickness, attachment, burrowing, refuge use |
| Heavy grazing | faster growth, defended tissue, inaccessible growth form |
| Shelter competition | body compression, territoriality, depth specialization |
| Strong currents | attachment, compact form, stronger propulsion |
| Low oxygen or turbidity | respiratory tolerance, lower metabolic demand, surface access |
| Unreliable recruitment | longer dispersal, brooding, or local larval retention |
| Nursery loss | alternate habitat use, earlier maturity, smaller adult size, migration |

Ecological effects must be capable of changing sign. Urchins can preserve coral settlement space or create a barren; crabs can recycle nutrients or suppress forest recruitment; predators can stabilize grazers or eliminate a vulnerable founder. Avoid permanent labels such as “beneficial species.”

## Climate and biome mapping

Epoch's nine rainfall × temperature identities remain the simulation inputs. Do not author nine disconnected species lists. Temperature selects a broad regional marine pool; rainfall, runoff, exposure, substrate, sea level, and habitat succession filter that pool locally.

| Climate tendency | Expected emphasis |
|---|---|
| Warm + wet | coral, mangrove, and seagrass communities; land and mangrove crabs; urchins; clams; morays; turtle and ray visitors |
| Warm + arid | exposed reef and tide-pool specialists; strong desiccation filter; rainfall-limited terrestrial crab activity |
| Mild + wet | kelp or macroalgae, wrack beaches, mussels, shore crabs, urchins, eels, seabird subsidy |
| Mild + arid | rocky shore and shell beds, episodic productivity, weak inland subsidy |
| Cold + wet | kelp, mussels, sea stars, amphipods, urchins, seabirds, seals, and whale visitors |
| Cold + arid | slow recruitment and growth, strong seasonality, mollusk- and echinoderm-heavy benthos, episodic visitors |

Wind and exposure distinguish sheltered nurseries from wave-worked shores. Sea level controls habitat area and connectivity. Island geology and age control substrate without controlling the age of the surrounding ocean.

## Domain-transition rules

Cross-domain evolution is a rare branching outcome, not ordinary trait blending.

1. **Both domains must work independently first.** Source and destination population contracts, fitness, extinction, and history must exist before a transition can target them.
2. **Every intermediate must be viable.** A transition requires consecutive jumps with food, reproduction, and positive condition in a corridor habitat; one favorable landing is insufficient.
3. **Selection acts on population variance.** The player changes habitat and pressures. Individuals do not transform through use, and the player does not purchase an adaptation.
4. **Continuous capabilities precede discrete anatomy.** Proportions, tolerance, investment, and behavior may drift continuously. New propulsion plans, respiratory strategies, reproductive independence, wings, flippers, or substantially changed feet require authored variants and a descendant branch.
5. **Ancestry is never discarded.** The new lineage records its ancestor, origin domain, transition corridor, and the pressures that made the branch viable.
6. **Tradeoffs remain real.** Investment in one domain must carry costs in another. A lineage does not become equally excellent at walking, swimming, and flying.
7. **Failure remains possible.** Intermediate populations may go extinct or retreat to their ancestral niche when the corridor closes.

Potential continuous capabilities include terrestrial, aquatic, and aerial locomotion investment; air-exposure and desiccation tolerance; salinity tolerance; diving capacity; insulation; metabolic demand; substrate attachment; and reproductive dependence on water. Only fields used by fitness, rendering, or reporting should be persisted.

## Transition corridors to preserve

### Sea to land

```text
marine resident
  → intertidal forager
  → amphibious shoreline resident
  → land-feeding, water-breeding population
  → reproductively independent terrestrial descendant
```

Crabs are the first preferred proof. A vertebrate sea-to-land transition is a later deep-time outcome because it needs more demanding respiratory, support, locomotion, and reproductive intermediates.

### Flighted bird to terrestrial flightlessness

```text
flighted generalist
  → ground-biased forager
  → facultative or short-distance flier
  → flightless terrestrial specialist
```

Flightlessness is favored by a sustained combination of reliable ground food, low terrestrial predation, safe ground nesting, low need to cross unsuitable habitat, increasing body size, stronger terrestrial locomotion, and the metabolic cost of maintaining flight. Food abundance alone is insufficient. Dodo-like island flightlessness and ostrich-like cursorial specialization are distinct ecological outcomes even when they share reduced flight investment.

### Flighted bird to penguin-like aquatic flightlessness

```text
flighted coastal bird
  → plunge or pursuit diver
  → increasingly wing-propelled swimmer
  → flightless marine specialist
```

Rigid propulsive wings, denser bones, insulation, oxygen storage, streamlining, and larger body size improve diving while progressively degrading aerial flight. This is an exchange of locomotor specialization, not degeneration and not the same authored branch as a flightless runner.

### Land to water

```text
terrestrial shoreline forager
  → semi-aquatic feeder
  → amphibious resident
  → predominantly aquatic descendant
```

Hippo-like semi-aquatic grazers and whale-like fully aquatic descendants may share ancestry but must remain divergent outcomes. The current marine `terrestrial-transition` seam is reserved precedent, not permission to skip the intermediates.

## Planned proofs and gates

1. Define the smallest shared pressure-field contract and prove that it is renderer-independent.
2. Add regional-pool arrival separately from local resident establishment and extinction.
3. Add one persistent coastal crab/scavenger population and demonstrate a two-way land–sea effect.
4. Add bounded urchin/grazer and eel/ambush-predator pressure so at least one trait response and one succession response are legible.
5. Add visitor outcomes that respond to island state without being serialized as island lineages.
6. Establish persistent aerial populations with explicit flight energy, nesting, predation, and food pressure.
7. Add transition-corridor state and prove marine-crab to amphibious-crab branching.
8. Prove flighted-bird to terrestrial-flightless branching.
9. Prove flighted-diver to penguin-like aquatic-flightless branching as a separate authored adaptation path.
10. Show the lineage history, transition cause, and retained family resemblance in the landing reveal.

Each proof needs deterministic or bounded simulation evidence, an explanation that makes sense in hindsight, and—when it receives an asset—game-distance visual evidence plus an owner verdict through the ecosystem asset gates.

## Explicit non-decisions

- Exact TypeScript interfaces, serialization layout, thresholds, mutation rates, and transition probabilities are not chosen here.
- No crab, eel, urchin, clam, visitor, flightless-bird, or penguin-like asset package is started by this document.
- Functional guilds do not all need lineage identity. Persistence is earned by ancestry, evolutionary relevance, or a player-visible history.
- This plan does not require per-individual genomes, per-frame predator simulation, or exact phylogenetic reconstruction.
- Climate referents constrain plausible function and form; they are not fixed spawn tables.

