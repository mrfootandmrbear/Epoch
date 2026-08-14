# Evolution Across Three Domains

> **Archived design study:** This comparison preserves early rationale, not live
> completion state. Use [docs/EXECUTION.md](docs/EXECUTION.md) for current
> status and sequence. [Ocean colonization, ecological pressure, and domain
> transitions](docs/OCEAN-COLONIZATION-AND-DOMAIN-TRANSITIONS.md) contains the
> later cross-domain rationale.

Comparing how Species: ALRE and Ecosystem model evolutionary mechanics — and what Epoch can take from each for land, water, and air life.

---

## Land

### Genetics

| Species: ALRE | Ecosystem | Epoch (current) |
|---|---|---|
| Full per-creature genome. Body plan, limbs, metabolism, temperature tolerance, diet, and behavior are all encoded in mutable genes. Reproduction introduces random mutations; survival filters them. | No terrestrial model — Ecosystem is marine only. Land is terrain the player sculpts to shape coastlines, not a habitat creatures evolve for. | **Built.** Population-level trait vector (bodyMass, legLength, footWidth, insulation, coatLightness, coatWarmth, hornLength). No individual genomes — traits blend toward habitat-derived targets at a rate scaled to jump duration. |

### Selection pressure

| Species: ALRE | Ecosystem | Epoch (current) |
|---|---|---|
| Climate (temperature, weather), vegetation type and density, resource distribution. Player controls these directly — lower temperature and thin-furred creatures freeze. Predation adds a second axis. | N/A for land. | **Built.** Climate forces (temperature, rainfall, wind, sea level) reshape habitat scores. Sheltered grazers favor moisture/drainage; ridge grazers favor exposure/slope. Deep-time factor increases niche divergence over long jumps. |

### Speciation

| Species: ALRE | Ecosystem | Epoch (current) |
|---|---|---|
| Real-time phylogenetic trees. Populations that drift far enough apart in trait space branch into new species on the tree. Allopatric speciation via geographic isolation. | N/A for land. | **Built, first pass.** Two founding identities can branch after deep-time isolation. Descendants retain parentage, origin age, generation, site, traits, abundance, and energy. |

> **Key lesson from Species:** Species proves that readable speciation needs visible trait variation and a phylogenetic record. Epoch now performs a first deterministic branch when isolation, elapsed time, and trait distance clear bounded thresholds. The per-individual genome approach remains too granular for Epoch's jump-based model; population-level inheritance is the right timescale.

---

## Water

### Aquatic life

| Species: ALRE | Ecosystem | Epoch (current) |
|---|---|---|
| Not a focus. Species is a land simulation — water bodies exist as obstacles or boundaries, not as habitats with their own evolutionary dynamics. | The entire game. Procedural body shapes, fin placement, and swimming styles. Physics calculates drag and thrust from geometry — form dictates whether a creature can hunt, flee, or just exist efficiently. | **Placement only.** Coastal animals are placed via `coastalProductivity` scoring (shallow water, rainfall, low exposure). Freshwater pools placed via drainage. No aquatic traits, no body evolution, no food web. |

### Physics model

| Species: ALRE | Ecosystem | Epoch (current) |
|---|---|---|
| N/A for water. | Real drag/thrust computation from body geometry. Neural networks control fin movement. Inefficient swimmers burn calories and starve before reproducing. The physics IS the selection pressure. | **Not started.** FFT ocean is built (JONSWAP spectrum, lit water with foam), but no creature-water interaction. No buoyancy, no swimming physics, no energy budgets. |

### Food web

| Species: ALRE | Ecosystem | Epoch (current) |
|---|---|---|
| N/A for water. | Plankton → small fish → apex predators. Energy flows through the web — overgrazing plankton crashes the whole chain. Player manages coral reefs, seabed depth, and water conditions to shape niches. | **Not started.** The `coastalProductivity` score is a proto-food-web signal (shallow warm water = more life), but there's no trophic structure, no energy budget, no predator-prey dynamics. |

> **Key lesson from Ecosystem:** Ecosystem's core insight is that physics-as-selection-pressure produces the most legible evolution. You don't need to hand-design "this fin shape is good" — you simulate drag and thrust, and efficient body plans emerge. For Epoch's jump-based model, the equivalent would be: define an energy budget per marine population (calories from coastal productivity vs. cost of body plan), let body traits (streamlining, size, depth preference, thermal tolerance) blend toward what the local physics rewards, and resolve the outcome across the jump. The FFT ocean already gives you wave energy and coastal zones — those can become the selection landscape for marine trait vectors, paralleling how climate forces drive land traits today.

---

## Air

### Flight

| Species: ALRE | Ecosystem | Epoch (current) |
|---|---|---|
| Creatures can evolve wing-like limbs and glide/fly, but it's emergent from the body plan — not a designed system. Aerial life happens when body shape, metabolism, and limb ratios line up. It's rare and impressive when it does. | Not modeled. Ecosystem is fully aquatic. No aerial domain. | **Scaffold only.** `AerialPopulationOutcome` exists: position, altitude, radius, visibility. Driven by nesting + lift + nearby coastal productivity scores. Appears after year 25. No traits, no evolution, no body plan. |

### Selection pressure

| Species: ALRE | Ecosystem | Epoch (current) |
|---|---|---|
| Flight in Species costs energy — creatures must eat enough to sustain their metabolic load. Heavier or poorly-shaped fliers crash or can't take off. Wind and elevation matter indirectly through the terrain system. | N/A. | **Implicit only.** Wind exposure and slope drive the `lift` score. Nesting requires elevation, moisture, exposure, and drainage. But these are placement heuristics — no feedback loop where traits change in response. |

### Transition to flight

| Species: ALRE | Ecosystem | Epoch (current) |
|---|---|---|
| Emergent. A species that happens to evolve lighter bodies, longer limbs, and membrane-like skin surfaces can discover gliding. No scripted "unlock flight" event — the genome space allows it if the math works out. | N/A. | **Not started.** No mechanism for a lineage to transition between domains. Land grazers can go extinct or migrate, but can't evolve into fliers. Aerial is a separate fixed outcome, not a descendant of a land lineage. |

> **Key lesson from Species:** Species shows that the most satisfying flights are the ones the player didn't design — they emerged. In Epoch's time-jump model, the equivalent is: over deep time, a coastal lineage that scores high on lift and low on body mass should be able to branch into an aerial lineage. The current `lift` and `nesting` ecosystem scores are the selection landscape — they just need to be wired into a trait vector (wingspan, body mass, metabolic rate) that blends across jumps the same way land traits do. The branching threshold from `populationTraitDistance` becomes the speciation event where "cliff-dwelling coastal animal" becomes "seabird."

---

## Cross-Domain Architecture

Both games suggest the same structural pattern: traits, habitat scoring, selection pressure, and speciation are the universal engine — what changes per domain is which traits matter and which physics drive selection.

**Shared engine (already in Epoch):** Trait vectors, habitat-driven target traits, blend-over-time adaptation, lineage status tracking, trait distance measurement, climate forces as global modifiers. This machinery is domain-agnostic — it works for any population that lives in a scored habitat.

**Land domain (built):** Two grazer archetypes diverged by moisture/exposure preference. 7 traits. Terrain navigation with A* pathfinding. Tree placement by ecosystem scoring. The most complete domain — needs speciation branching and predator-prey to match Species' depth.

**Water domain (scaffolded):** Needs a marine trait vector (streamlining, size, depth preference, thermal tolerance), `coastalProductivity` as the energy source, wave energy from the FFT ocean as environmental stress, and a trophic layer (even a simple "small eats plankton, large eats small" chain). Coral requires a parallel persistent-colony contract—growth form, living cover, stress, bleaching, mortality, and dead skeleton—rather than being treated as a fish lineage or decorative prop.

**Air domain (scaffolded):** Needs an aerial trait vector (wingspan, body mass, metabolic rate, soaring efficiency), `lift` and `nesting` as selection axes, coastal productivity as the food link. Most interesting if aerial lineages can descend from coastal land or marine lineages rather than appearing independently.

---

## Design Tensions

Where Species and Ecosystem pull in opposite directions, and which side Epoch's time-jump model is naturally closer to.

| Tension | Species: ALRE | Ecosystem | Epoch's natural fit |
|---|---|---|---|
| **Granularity** | Per-individual genomes. Every creature is unique. High fidelity, high computational cost. | Body shape + neural net per creature. Also per-individual but focused on physics, not genetics. | **Population-level.** Epoch jumps thousands of years — individual lifetimes are invisible. The blend-toward-target model already handles this correctly. Don't adopt per-individual genetics. |
| **Selection mechanism** | Survival to reproduction. If you live long enough to mate, your genes spread. Direct fitness. | Energy efficiency. If your body plan wastes calories, you starve. Physics-driven fitness. | **Habitat scoring + energy budget.** The site-scoring system is already a fitness function. Adding a simple energy in/out calculation per domain would give marine and aerial populations the same legibility Ecosystem achieves, without needing per-frame physics. |
| **Player role** | Observer or interventionist. Phylogenetic trees to read, radiation guns to wield. Science-lab vibe. | Ecosystem manager. Terraform, plant coral, balance the food web. Gardener vibe. | **Time traveler.** The player doesn't tweak parameters — they jump forward and see what happened. Climate shifts between jumps create the selective pressure. The player's agency is choosing WHEN to look, not what to change. |
| **Speciation trigger** | Continuous drift measured against trait distance. Speciation is gradual and always happening. | Not a focus — species are more like niches that get filled. | **Threshold on trait distance after a jump.** A mature, isolated lineage can branch during a large jump when its inherited traits diverge sufficiently at an alternate viable site. |
| **Cross-domain transition** | Emergent but rare. A creature's genome space technically allows it, but the odds are tiny. | Not modeled. Marine only. | **Deep-time branching.** Over million-year jumps, a coastal land lineage with high lift scores should be eligible to branch into an aerial lineage. Same mechanism as land speciation — a trait vector drifts far enough from its parent that a new domain-specific lineage spawns. |

---

## Bottom Line

**Species' biggest gift to Epoch is the phylogenetic tree** — the idea that speciation is a visible, trackable event the player can read, not just a hidden state change. Epoch's lineage history now records a first bounded land branching event; it still needs a visualization and extension to future animal domains.

**Ecosystem's biggest gift is physics-as-fitness.** Instead of hand-authoring "this trait is good in this biome," you define the energy budget (food available minus cost of body plan in that physics environment) and let the math sort it out. For water, that means wave energy and coastal productivity drive marine trait selection. For air, lift and wind exposure drive aerial trait selection. The patterns are already in the code as ecosystem sample scores — they just aren't connected to trait vectors yet.

Neither game needed to solve the problem Epoch has: **making evolution legible across time jumps instead of in real time.** That's where Epoch's blend-toward-target model is genuinely novel. The right move is to extend that same population-level blending into water and air domains, retain the existing bounded speciation threshold, give coral a domain-appropriate colony history, and eventually expose those histories visibly—not to adopt either game's per-individual approach.
