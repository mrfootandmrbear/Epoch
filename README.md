# Epoch

Sculpt a world. Set the forces. Jump an epoch — a thousand years or more in one move. Look at what nature, water, and evolving life made of it.

Successor to [Habitat](https://github.com/mrfootandmrbear/Habitat), distilled from its playtesting down to what mattered most: forming is fun, but seeing what an epoch did to what you formed is the point.

Start here: [THESIS.md](THESIS.md).

What the predecessor proved—and what Epoch should deliberately leave behind—is captured in [HABITAT_REVIEW.md](HABITAT_REVIEW.md).

First form→jump→reveal checkpoint running: directly raise or carve a bare island, choose a jump from 1 year through 1 million years, and reveal a duration-scaled living state over a procedural FFT ocean (Three.js, WebGPU + TSL) — `npm install && npm run dev`.

This checkpoint now includes the first bounded outcome resolver described in [HABITAT_REVIEW.md](HABITAT_REVIEW.md). Sculpted elevation, slope, shelter, inferred moisture, and exposure determine where succession establishes and where populations gather. It resolves a landing snapshot directly rather than stepping through every elapsed year, so deep-time jumps remain fast and deterministic.

The prototype exposes the [THESIS.md §2.1](THESIS.md#21-two-speeds-not-one) jump ladder—1, 5, 10, 25, 50, 100, 1,000 years and progressively deeper-time presets through 1 million years. Jumps accumulate into a persistent world age; after every reveal the player can explore, reshape the landing state, choose another duration, and jump again. Duration controls succession maturity while terrain and player-selected rainfall, temperature, prevailing wind, and sea level control each landing. Drainage, disturbance memory, and richer population change are the next causal layers.

Climate is deliberately a whole-island forcing layer. Its derived habitat fields should eventually connect terrestrial, freshwater, coastal and marine, and aerial food webs. Future plants, land animals, aquatic animals, and flying animals must resolve from those shared conditions and exchanges rather than growing into separate simulation silos.

The landing state is not only an overview. Camera scale runs continuously from whole-island composition toward intimate shoreline, forest, and wildlife views; cursor-directed zoom lets the player descend into whatever part of the reveal catches their attention. Rendering work must clear both scales—the island should read coherently from above and remain a place the player wants to inhabit up close.

Visible grazers now roam using a coarse terrain-aware navigation field. Water and severe slopes are impassable, gentler exposed slopes carry a higher movement cost, and lightweight cohesion/separation keeps each population legible as a herd. This local movement is deliberately distinct from deep-time migration: jumps resolve populations statistically, then landing-state individuals embody that outcome at playable scale.

The two grazer populations now carry stable identities and renderer-independent trait means derived from the habitat at their resolved sites. Wet, sheltered ground and exposed, rugged ground shape body mass, leg and foot proportions, insulation, coat, and horns; one primitive-rig adapter turns those semantic traits into the current visible bodies while preserving the seam for a future Foxel/glTF rig. Trait inheritance and migration across successive jumps remain part of the next persistent-history pass.

The jump resolver now captures one immutable sampled `WorldSnapshot` before resolving life. Terrestrial habitat, drainage-fed freshwater pools, shallow-water productivity, nesting ground, and wind lift all read that same terrain and climate state. Grazers separate across land habitats, coastal swimmers follow productive shallows, and aerial animals nest over suitable land while ranging toward nearby feeding water. These are the first connected terrestrial, freshwater, marine, and aerial outcomes—not final ecosystem breadth, but the shared substrate future populations will extend.

Terrain change now accumulates between jumps instead of being recalculated from the original island under only the latest climate. Each jump applies a bounded, duration-scaled erosion pass to the previous landing, carries exposed-soil disturbance forward, and uses vegetation from the previous landing to protect soil during the next interval. Sculpting edits that persistent substrate directly, so a short dry jump cannot restore land removed by an earlier wet epoch.
