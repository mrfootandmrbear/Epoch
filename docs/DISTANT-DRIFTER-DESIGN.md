# Distant Drifter founder design

> **Status:** Active design slice.
> **Scope:** Player-authored founder envelope, generated hereditary state, establishment, and the first land-fauna selection contract.
> **Canonical capability status:** [WILDLIFE-ROADMAP.md](../WILDLIFE-ROADMAP.md).

## Product bet

The player should begin a terrestrial lineage with something distinctive, then discover whether the island preserves, changes, branches, or extinguishes it. The player chooses three broad facts about the animals on the natural raft:

1. food source;
2. size;
3. origin climate.

The game generates the exact animal within those constraints. It reveals that founder cohort on the raft before launch and never rerolls it afterward. The choice is an ecological wager, not a creature editor and not a viability forecast.

The dramatic question is: **what did you send, and what did the island make of it?**

## Player choices

### Food source

Food source describes the founder's inherited feeding strategy, not a promise that matching food exists at the destination.

| Choice | Primary opportunity | Primary cost | Distinctive inherited tendency |
|---|---|---|---|
| Ground plants | Broad low vegetation can support a herd | Low-quality food requires time and digestive investment | Wide muzzle, durable digestion, grazing affinity |
| Woody plants | Shrubs, leaves, bark, and seasonal fruit open rougher habitat | Patchier food and greater reach cost | Browsing affinity, reach, narrower feeding structure |
| Animal prey | Energy-dense food can support a smaller population | Establishment fails without accessible prey | Prey affinity, pursuit/ambush tendency, offensive investment |
| Mixed | More fallback foods during change | Lower peak efficiency on any one source | Broader affinities with an efficiency penalty |

These are dominant resource affinities, not fixed species labels. Every founder carries small standing capacities outside its specialization. A predator may, rarely, amplify plant digestion and become herbivorous, or amplify shoreline feeding and begin taking marine forage. The reverse transitions are also possible. Large trophic changes require accessible intermediate food, surviving abundance, heritable variance, and long selection—not an archetype swap merely because another resource is present. A major change should normally produce a branch while leaving the ancestral feeding strategy legible.

### Size

Size is a band—small, medium, or large—not an exact mass. It anchors a randomly sampled founder mass and correlated proportions.

- Small animals need less food, fit more founders on a raft, mature faster, and lose heat faster. They are more vulnerable to many predators but can use cover and inaccessible terrain.
- Large animals store more energy, retain heat, and resist smaller predators. They require more food, fit fewer founders on a raft, mature slowly, and suffer more from resource crashes.
- Medium animals avoid the strongest extremes but receive no universal viability bonus.

### Origin climate

Origin climate should be a small set of legible presets built from temperature and moisture, such as cold-open, cold-wet, temperate-seasonal, hot-dry, and hot-wet. It seeds thermal optimum, thermal breadth, insulation, coat, water economy, and plausible body proportions.

Origin climate is provenance, not destiny. A mismatch imposes an immediate maintenance cost; descendants can shift only where the founder cohort contains usable hereditary variance and survives long enough to reproduce.

## Founder reveal

After the three choices, a stable generation seed samples one founder profile. The panel shows a small cohort on storm-torn vegetation and driftwood using the real creature renderer. It communicates silhouette, scale, coat, cohort size, condition, and raft damage without exposing exact trait values or predicting success.

The generated profile is committed when revealed. Reopening the panel, saving, loading, or advancing time must reproduce the same founders. A separate explicit reroll action, if the product ever permits one, would be a player action rather than incidental UI behavior.

## State contracts

“DNA” is useful player language, but implementation should keep four concerns separate.

### Founder profile

Immutable provenance and authored constraints:

- food-source choice;
- size band;
- origin-climate preset;
- generation seed;
- origin age;
- initial cohort abundance, condition, and raft attrition.

Cohort condition is not hereditary. It affects the establishment attempt but descendants do not inherit “raft damage.”

### Hereditary state

Population-level inherited distributions, never per-creature genomes:

- mean and variance for visible morphology: body mass, leg length, foot width, insulation, coat lightness, coat warmth, and defensive/offensive structure;
- food affinities for ground plants, woody plants, animal prey, and marine forage;
- thermal optimum and thermal breadth;
- moisture/water-economy tolerance;
- locomotion and defensive capability where they have an ecological consumer;
- bounded life-history terms such as maturation cost and reproductive output only when establishment needs them.

The first implementation should store only fields consumed by fitness, rendering, or lineage reporting. It should not begin with an arbitrary 80–120-float GPU layout.

### Population condition

Non-hereditary state resolved each jump:

- abundance;
- energy reserve;
- established, vulnerable, or extinct status;
- current site;
- realized diet;
- current predation loss and climate stress.

### Lineage history

Evidence of what happened rather than DNA:

- parent and branch references;
- origin and branching ages;
- ancestral snapshots;
- migrations and bottlenecks;
- environmental exposure;
- trait changes and selection causes.

Trajectories and environmental imprint belong here. They may influence future resolution, but they are not themselves genes.

## One fitness budget

Food, climate, and predation should meet in one energy-and-reproduction budget rather than independently pushing appearance sliders.

```text
accessible food
  = resource availability × inherited affinity × morphological access

usable intake
  = accessible food × digestive efficiency

maintenance cost
  = baseline metabolism(size)
  + climate mismatch(thermal optimum, breadth, insulation, water economy)
  + locomotion cost(body plan, terrain)

predation loss
  = predator pressure × encounter rate
  × vulnerability(size, cover use, mobility, defense, cohort behavior)

reproductive surplus
  = usable intake - maintenance cost - injury/predation burden
```

Energy determines immediate survival. Sustained reproductive surplus determines establishment and abundance growth. Predation can remove abundance directly and can also reduce feeding time or increase locomotion cost. Climate can change food availability as well as impose direct physiological cost, so hot drought can hurt a lineage twice without using an arbitrary extinction rule.

## Selection and evolution

Each jump resolves five steps:

1. Sample food resources, climate stress, terrain access, and predator pressure at candidate sites.
2. Evaluate the current hereditary distribution against those conditions.
3. Convert fitness into survival, energy, and reproductive output.
4. Shift trait means toward the traits associated with reproductive success, bounded by existing variance and jump duration.
5. Update variance through selection, mutation, drift, bottlenecks, and any later gene flow.

The important constraint is: **a population cannot adapt from variation it does not have.** Strong selection can change a variable population quickly, but it can only kill a genetically narrow mismatched founder cohort. Mutation restores variation slowly over long jumps; it is not an emergency rescue roll.

### Variance rules

- The raft bottleneck begins with low abundance and reduced variance.
- Directional selection shifts a mean and usually narrows variance along the selected axis.
- Stabilizing conditions narrow variance around a successful phenotype.
- Fluctuating conditions can preserve or widen variance when multiple phenotypes reproduce.
- Drift is strongest when abundance is low and may move means without improving fitness.
- Gene flow can restore variance later, but only if another related population can actually reach the lineage.

### Correlated tradeoffs

Traits must not evolve as independent sliders. At minimum:

- body size raises food demand and maturation cost while improving heat retention and resistance to smaller predators;
- insulation helps in cold conditions but raises heat-dumping cost in hot climates;
- long legs improve travel and some feeding access but cost energy and can perform poorly in dense cover;
- wide feet help on wet or soft ground but reduce efficient travel on firm open ground;
- defensive/offensive investment reduces some predation or improves hunting while costing growth and reproduction;
- broad diet affinity buffers change but remains less efficient than specialization at its optimum.
- trophic transitions amplify a small existing or mutated affinity over many reproducing generations; a lineage cannot consume an unavailable resource just to unlock the transition.

These correlations can initially be explicit fitness terms. They do not require a literal chromosome simulation.

## Predation contract

Predation is currently absent from the terrestrial simulation and must not be faked as a cosmetic trait target. The first implementation needs a coarse predator-pressure signal with an identified source:

- an established predatory lineage contributes pressure according to its abundance, prey affinity, body-size relationship, and habitat overlap;
- refuges, terrain, and vegetation reduce encounter rate;
- prey mobility, defense, and size alter vulnerability;
- prey abundance and accessibility constrain predator intake in return.

This creates a population-level loop: predators cannot persist without prey energy, and prey do not evolve defenses without actual predator pressure. Rendered chases may embody the result but never author it.

Until that loop exists, animal-prey founders should be visibly marked high risk and should only establish where a real prey resource exists. The game should not silently substitute generic forage for meat.

## Establishment outcomes

The initial raft cohort can produce four legible outcomes:

- **Lost:** journey attrition leaves no viable arrival.
- **Arrived vulnerable:** founders are present but lack reproductive surplus.
- **Established:** repeated surplus grows abundance beyond the founder bottleneck.
- **Failed after arrival:** the cohort survives briefly, then climate, food shortage, predation, drift, or a combination removes it.

The result should name dominant causes in plain language—“woody food was scarce,” “the warm-origin coat carried a severe cold cost,” or “small founders suffered heavy predation”—without exposing a deterministic success percentage before launch.

## First bounded proof

The Distant Drifter slice succeeds when:

1. The three player choices generate multiple distinctive but plausible founder profiles and a stable raft reveal.
2. The generated hereditary state persists unchanged until selection acts; UI reopening never rerolls it.
3. Food-source mismatch, size-linked metabolic demand, and origin-climate mismatch independently alter establishment in deterministic fixtures.
4. Combined pressures interact through the shared fitness budget rather than three unrelated pass/fail checks.
5. A narrow mismatched cohort can fail instead of automatically adapting, while a variable cohort can shift over a sufficiently long jump.
6. Drift is strongest during the founder bottleneck and can produce a non-adaptive trait change.
7. Predation affects outcomes only when a real predator/prey pressure source exists.
8. The lineage report distinguishes inherited traits, current condition, and the environmental causes of change.

## Explicitly deferred

- Per-individual genomes or reproduction.
- Player selection of exact morphology, coloration, defenses, or behavior.
- Guaranteed establishment or a pre-launch success percentage.
- Ordinary adaptation across trophic domains.
- Cross-domain land/water/air ancestry.
- A fixed GPU “DNA buffer” before the simulation state contract is proven.
