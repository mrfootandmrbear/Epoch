# Epoch product direction

> **Authority:** This is the product contract. It explains what Epoch is, what
> it must make the player feel, and the boundaries that implementation serves.
> Current priorities live in [docs/EXECUTION.md](docs/EXECUTION.md).

## The promise

Epoch is a playable deep-time evolutionary world-shaping game. The player
begins with a stylized, Galápagos-inspired hotspot archipelago, intervenes in
its geology and climate, and jumps across millions of years to discover what
natural selection, isolation, chance, and extinction made of it.

The player forms volcanic islands, changes environmental forces, commits to a
jump from years to geological time, and inspects the world that emerges. Land,
water, climate, plants, animals, reefs, and evolutionary history must answer the
same causes. The pleasure is not operating a dashboard; it is recognizing how
the player's world became this world.

```text
form → set forces → jump → reveal → inspect → intervene → jump again
```

## Product pillars

### Deep time is the main verb

A jump resolves a plausible landing state; it does not replay every elapsed
moment. Every duration uses the same commit → transition → reveal beat. Larger
jumps may change geology, island connectivity, ecology, and lineages—not merely
increase vegetation density.

### One inherited world, not one permanent look

Epoch is not a catalogue of disconnected biomes or planet presets. A fixed
hotspot, moving crust, shield age, elevation, trade winds, rainfall and garúa,
upwelling, sea-level history, reef viability, and dispersal distance define the
starting grammar. They do not constrain the world to resemble the present-day
Galápagos forever. Across millions of years, the archipelago may fragment,
reconnect, drown, be replaced by younger land, and develop ecosystems unlike
anything in its starting state.

The constraint is inheritance, not resemblance. Every radical outcome must
remain explainable as a descendant of the same geology, organisms, chance
events, and player decisions.

The regional system is **bounded procedural history**, not a hand-authored chain
of island outcomes and not a general geology simulator. Epoch resolves a small
authored grammar—shield birth at the hotspot, crustal drift, aging, erosion,
subsidence, connection and separation, sea-level change, and drowning—from
persistent state. Curated fixtures define proof cases and tuning bounds; they do
not replace the player's accumulated world. Only processes that create a
legible decision or landing consequence belong in the model.

### Plausibility outranks precision

The simulation owes the player a convincing consequence, not a physically exact
millennium or byte-identical replay. Spend complexity where it improves causal
legibility, surprise, beauty, or player choice. Do not preserve fidelity that
makes jumps slow without making their outcomes more believable.

### Evolution is part of the reveal

Populations persist; rendered individuals do not. Founder effects, isolation,
selection, drift, changing gene flow, reconnection, radiation, contraction, and
extinction should produce descendants whose forms and histories make sense in
hindsight. Geology and evolution are one product system.

Trait evolution uses a **small authored ecology**, not an unconstrained phenotype
optimizer. Each asset family exposes a bounded set of inherited traits with
known costs, tradeoffs, and habitat pressures. Selection changes those traits
continuously within authored biological priors; drift and founder effects may
move them without improving fitness. Similar pressures should permit analogous
solutions across families, while ancestry keeps those solutions visibly
family-specific. New trait axes require a readable silhouette, surface, motion,
or behavior consequence and at least one environmental tradeoff.

Epoch is a counterfactual Darwinian laboratory, not a recreation of natural
history. The player tests what selection, drift, founder effects, gene flow,
extinction, and intervention produce under altered conditions. The rules should
support surprising outcomes—including ecosystems that become unfamiliar—while
preserving enough ancestry and causal evidence that the surprise can be
understood rather than dismissed as random generation.

### Resources bound life

Plausible ecology requires coarse energy flow. Forage, productivity, prey,
shelter, and other explicit resources constrain establishment, energy,
abundance, movement, reproduction, contraction, and extinction. Consumers feed
pressure back into those resources where that feedback matters on a later jump.
Epoch does not need exact caloric accounting, but it must never produce a
population without a credible resource path.

### Intervention has consequences

The first form shapes mostly bare land. Later intervention acts on an inhabited
world and is intentionally not a harmless editor. Raising or carving terrain,
opening channels, changing drainage, moving sea level, and altering climate may
destroy habitat, isolate or reconnect populations, damage reefs, or create new
opportunities. Those consequences are the game, not errors to protect the player
from.

The player may revise an uncommitted edit, but a jump commits the changed world
and its ecological consequences. Epoch should explain likely physical effects
before commitment and actual biological effects after the reveal. The player
does not directly place established terrestrial populations: **Distant Drifter**
is the deliberate colonization gamble, introducing a small energy-limited
founder cohort whose inherited feeding strategy, local resources, and climate
fit determine whether it establishes.

### Beauty is functional

Epoch must be visually distinctive at overview and inspection distance. Young
basalt, old eroded shields, arid lowlands, fog-fed highlands, mangroves, reefs,
and productive water establish the opening visual grammar. Later worlds may
depart from it dramatically, but must retain a legible inherited visual history:
materials age, landforms descend from earlier landforms, and organisms remain
recognizable through ancestry even as their adaptations transform them.
Stylization should clarify material, habitat, motion, ancestry, and adaptation
rather than decorate an otherwise unreadable simulation.

Epoch's signature visual moment is the reveal of an inherited archipelago at
the reef edge: ocean and atmosphere establish scale; changed geology and water
show what divided the world; inspection discovers visibly related descendants
fitted to the habitats on either side. Water is the compositional anchor, but
the spectacle is the whole causal transformation—not an isolated shader demo or
an ecologically misplaced fantasy landscape.

### Jump scale is a choice, not a progression gate

The preset ladder is intentionally fine-grained at human timescales and
logarithmic in deep time. A player may choose any available duration, including
a deep jump early. Short jumps support intervention and attachment; deep jumps
permit geological and evolutionary change. The game may recommend a sequence
for onboarding, but it must not require grinding through smaller rungs. A direct
deep jump owes a coherent landing; repeated jumps additionally owe accumulated
history and path dependence.

## Player-facing quality bar

A successful landing lets the player answer, without reading implementation
language:

1. What changed?
2. Why did it change?
3. What persisted from the previous world?
4. What new possibility does this create for the next jump?

The primary proof is a sequence, not an isolated beauty shot: one inherited
world across multiple jumps, with geological and biological causality remaining
legible.

Beauty and causal comprehension are separate gates. A landing can pass one and
fail the other. Visual acceptance asks whether the composition, materials,
motion, and organisms meet the owner-reviewed bar. Causal acceptance asks
whether a person who was not told the intended answer can identify the major
habitat differences, relate visible adaptations to them, and reconstruct the
recorded change with only player-facing evidence.

## Non-negotiable boundaries

- Simulation state remains independent of rendering. Renderers consume resolved,
  immutable outcomes and never become persistence authority.
- The target renderer is Three.js `WebGPURenderer` with TSL. Modern Chromium
  desktop is the current supported platform.
- Visible instance counts are presentation. Population identity, abundance,
  traits, ancestry, range, and ecological effects are simulation.
- Add a field, subsystem, or asset family only with a named consumer and a
  player-visible consequence.
- An automated check establishes correctness; it does not establish visual
  acceptance. Material visual changes require an owner verdict against declared
  evidence.

## Current product proof

The next integrated proof is an inherited hotspot-archipelago sequence: two
neighboring volcanic shields begin connected; geological change alters their
habitats and gene flow; one founder population separates into visibly related
specialists; a later landing makes the geology → isolation → adaptation chain
understandable. This proof outranks unrelated breadth and isolated polish.

## Deliberately outside the direction

- A scientifically exhaustive earth simulator.
- Continuous playback of every year inside a deep-time jump.
- Unrelated climate presets or collectible fantasy variants.
- Individual-animal persistence masquerading as population simulation.
- Feature breadth that does not strengthen the form → jump → reveal loop.
- Open-ended phenotype search without authored biological priors.
- Hand-authored landing outcomes that replace persistent world history.
- Process ceremony, parallel status ledgers, or documents with ambiguous
  authority.
