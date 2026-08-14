# Galápagos hotspot-archipelago plan

> **Status:** Canonical product-alignment plan, adopted 2026-08-14.
> **Authority:** `THESIS.md` defines the product; this document defines the first architecture that serves its Galápagos-inspired world.
> **Research basis:** USGS comparisons of Galápagos and Hawaiian hotspot volcanism, Galápagos island history, volcanic-island ontogeny, Quaternary sea-level evidence, and island-biogeography research reviewed on 2026-08-14.

## Decision

Epoch builds one coherent world: a stylized, Galápagos-inspired equatorial
hotspot archipelago. It does not build a catalogue of unrelated global climates.
Variation comes from island age, elevation, exposure, rainfall and garúa,
upwelling, sea-level history, volcanic disturbance, and biological inheritance.

This is inspiration, not a replica or a claim to reconstruct the real
Galápagos. Plausible geology and ecology constrain the outcomes; Epoch remains
free to compress space and time so those outcomes are playable and legible.

## Product loop

```text
fixed hotspot builds shields → crust carries islands away → erosion and sea divide habitat
           ↑                                                       ↓
new land and niches appear ← populations colonize, isolate, radiate, reconnect, or vanish
```

The player forms volcanic land and changes regional forces. Nature answers at
two coupled levels:

1. **Island ontogeny:** emergence, shield construction, caldera cycles, lava
   resurfacing, soil development, drainage dissection, coastal change,
   fragmentation, reef history, subsidence, and eventual drowning.
2. **Population history:** arrival, founder bottleneck, establishment, gene
   flow, isolation, drift, selection, adaptive radiation, reconnection,
   hybridization where credible, contraction, and extinction.

Neither is background for the other. A jump succeeds when the player can infer
how changed geography produced changed descendants.

## World contract

- The hotspot is fixed in mantle/world space.
- Oceanic crust moves across it with a direction and drift rate.
- A world contains multiple volcanic shields, even when only one is initially
  above water.
- Each shield owns age, construction stage, volcanic load, caldera state,
  surface age, and connection to neighboring shields.
- Islands are temporary groupings of emergent shield terrain, not permanent IDs.
  A land bridge can join two shields; inundation or erosion can split them.
- The regional ocean predates every island. Upwelling, currents, temperature,
  nutrients, sea level, and reef viability are ocean history, not island age.
- One world unit remains one metre. The playable island is a compressed
  representative landscape; rates are calibrated for plausible morphology, not
  applied literally from full-scale Galápagos measurements.
- Landing states resolve directly. Deep jumps do not simulate every year.

## Regional forces, not global climate presets

Retain the climate machinery but reinterpret its authority. The canonical
controls and derived fields are:

- hotspot output and recent volcanic disturbance;
- plate direction and drift rate;
- trade-wind direction and exposure;
- rainfall and garúa/cloud moisture;
- elevation-driven arid lowlands and humid highlands;
- upwelling strength, ocean temperature, and marine nutrients;
- sea level and deep-time sea-level regime.

Cold/arid, warm/wet, and similar global foundation fixtures remain useful test
inputs temporarily, but they are no longer product destinations. Snowfields,
glaciers, and broad world-biome expansion are deferred unless the Galápagos
world later demonstrates a direct need.

## Deep-time ladder

Every rung must preserve ancestry while revealing a different class of change.

| Jump | Geological read | Biological read |
|---:|---|---|
| 1 year | fresh lava/rain response, wet channels, seasonal coast and upwelling | immediate movement, stress, feeding and recruitment response |
| 1,000 years | soil and vegetation zonation, established drainage, young reef and colonization surfaces | founder establishment, bottlenecks, local adaptation, early population separation |
| 100,000 years | repeated sea-level history, coastal terraces, reef exposure/drowning, caldera or lava resurfacing, shield connections changing | isolated populations drift and specialize; reconnection restores gene flow or permits bounded hybridization |
| 1,000,000 years | major volcanic dissection, subsidence, fragmented shields, new emergent land nearer the hotspot | adaptive radiation, habitat loss, lineage migration to younger islands, contraction and extinction |
| later candidate | old island remnant, lagoon/reef-dominated state, or drowned shield beside younger islands | descendant ecosystems persist on stepping-stone islands after ancestral land disappears |

If these rungs cannot produce unmistakable related landing silhouettes and
population histories, remove the unsupported upper presets rather than amplify
arbitrary erosion.

## Population evolution contract

Populations remain authoritative; visible individuals remain renderer samples.
Each persistent population needs:

- lineage and parent identity;
- occupied habitat patch and island/shield connectivity;
- trait means and bounded per-trait variance;
- abundance, energy, and geographic range;
- founder provenance and bottleneck strength;
- gene-flow links to compatible populations;
- accumulated selection pressures and environmental history;
- branching, reconnection, contraction, and extinction history.

The resolver applies six coupled processes:

1. **Founder effects:** small arrivals carry narrow, path-dependent starting variation.
2. **Selection:** substrate, elevation, moisture, temperature, food, predation,
   exposure, and locomotor cost change trait distributions.
3. **Drift:** small isolated populations can diverge without every change being adaptive.
4. **Gene flow:** connected populations exchange variation and resist divergence.
5. **Radiation:** persistent isolation plus distinct viable niches can branch one
   ancestor into visibly related specialists.
6. **Extinction:** loss of area, food, connectivity, or tolerable habitat can end
   a lineage; equilibrium is not a permanent success state.

Evolution is indirect player authorship. There are no evolution points. The
lineage report must explain: where isolation occurred, which pressures mattered,
what visibly changed, whether gene flow continued, and what survived.

## Visual contract

The shared art direction should make these Galápagos relationships readable:

- dark young basalt against weathered older substrate;
- broad shield forms and summit calderas;
- lava age mosaics and vegetation recovery fronts;
- arid lowlands, fog-fed highlands, mangroves, and exposed coasts;
- cool productive upwelling water beside sun-heated land;
- seabird, fish, reef, and shoreline activity tied to marine productivity;
- related animal descendants whose feet, limbs, feeding structures, body mass,
  insulation, coloration, and behavior reveal different island niches.

Visual references and assets should serve this grammar. A visually excellent
system that points toward an unrelated climate or island type is out of scope.

## Existing-system disposition

| Existing work | Disposition |
|---|---|
| Three.js WebGPU/TSL renderer, ocean, atmosphere, terrain materials | **Retain** |
| persistent terrain, volcanic, reef, marine-energy, lineage history | **Retain and generalize** |
| fixed vent/hotspot lifecycle | **Reinterpret** as one shield in a fixed-hotspot/moving-crust system |
| climate identity matrix | **Reinterpret** as bounded regional regimes and elevation/exposure fields |
| deep-time erosion coefficients | **Pause** until shield age, plate motion, sea-level history, and island connectivity are authoritative |
| glacier/snowfield expansion | **Defer** |
| unrelated biome and fauna breadth | **Stop** |
| accepted ecosystem assets | **Preserve as evidence; reassess ecological fit before expansion** |
| cosmetic within-herd variation | **Preserve**, but do not confuse with simulated hereditary variance |

## First vertical slice

**Question:** Can one ancestor become two visibly related specialists because a
Galápagos-style landscape divided it?

Fixture:

1. Two neighboring volcanic shields begin joined by a low saddle.
2. One founder population establishes while the saddle permits gene flow.
3. A 100,000-year landing resolves sea-level and geomorphic history that floods
   or erodes the connection.
4. The populations persist in two distinct habitats: for example arid lava
   lowland and fog-fed highland, or inland grazer and intertidal forager.
5. A later landing reveals two related descendants with different visible
   traits, behavior, abundance, and range.
6. The lineage view explains the causal chain without labels being required to
   perceive the difference.

Acceptance evidence:

- before/after whole-archipelago and habitat cameras;
- connectivity and gene-flow numeric assertions;
- bounded trait-variance, drift, and selection tests;
- ancestry and speciation/reconnection history tests;
- visible descendant comparison at overview, mid, and near scales;
- real WebGPU timing and draw count;
- owner verdict that geology caused a legible, plausible evolutionary story.

## Implementation sequence

1. Align canonical documents and freeze incompatible expansion.
2. Add renderer-independent `ArchipelagoHistory`, `ShieldHistory`, and stable
   habitat-patch/island-connectivity identities.
3. Convert the current hotspot into fixed world-space authority and resolve
   crust-relative shield positions at landing time.
4. Resolve emergent-island grouping, saddle connections, sea-level history,
   shield age, and upwelling exposure into the immutable world snapshot.
5. Add per-population variance and explicit gene-flow links without adding
   individual genomes.
6. Make selection, drift, bottlenecks, reconnection, and extinction
   path-dependent; revise speciation only after this contract is tested.
7. Build the two-shield founder fixture and lineage explanation.
8. Render and judge the 1k/100k/1M sequence. Continue upper jumps only if it
   clears the acceptance evidence above.

## Sources informing the constraint

- USGS, *Contrasting volcanism in Hawaiʻi and the Galápagos*:
  https://www.usgs.gov/publications/contrasting-volcanism-hawaii-and-galapagos
- USGS, *On the Trail of Hotspots: the Galapagos and Hawaiian Islands*:
  https://www.usgs.gov/observatories/hvo/news/volcano-watch-trail-hotspots-galapagos-and-hawaiian-islands
- USGS, *Sea Level and Climate*:
  https://www.usgs.gov/water-science-school/science/sea-level-and-climate
- Galápagos Conservancy, *Biodiversity*:
  https://www.galapagos.org/about_galapagos/biodiversity/
- Valente et al., *The effects of island ontogeny on species diversity and phylogeny*:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC4043082/
