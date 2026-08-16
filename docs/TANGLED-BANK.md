# The Tangled Bank — player evolution design

> **Status:** Active design document, 2026-08-16.
> **Depends on:** `GALAPAGOS-HOTSPOT-PLAN.md`, `DISTANT-DRIFTER-DESIGN.md`,
> `OCEAN-COLONIZATION-AND-DOMAIN-TRANSITIONS.md`.
> **Purpose:** Define how the player grows a branching family of descendants
> through terrain sculpting and raft launches, and how that family becomes the
> game's central artifact.

## The Tangled Bank

The Tangled Bank is the player's evolving family diagram — a living map of
every population that descended from every raft the player has launched.
It is the game's primary artifact: the thing the player builds, the thing
they show other people, and the thing that makes each playthrough unique.

The name comes from the closing paragraph of *On the Origin of Species*:
Darwin describing an entangled bank of plants, birds, insects, and worms —
all elaborately constructed, all dependent on each other, all produced by
laws acting around us. That image — overhead, intertwined, dense with life
that came from somewhere — is what the player's diagram should feel like.

Lineages split, reconnect, hybridize, go extinct, radiate explosively, and
sit unchanged for ages. The player's bank will be dense in some places,
bare in others, with dead roots and surprising new growth. No two players
will grow the same one.

## How the player grows the bank

The player never touches the creatures. They have exactly four verbs:

1. **Sculpt** — reshape the island: dig channels, raise ridges, flood
   lowlands, expose rock, create pools, build land bridges, collapse saddles.
2. **Launch** — send a founding raft toward the island (available at any
   time, as many times as the player wants).
3. **Jump** — advance deep time (1 / 1k / 100k / 1M years) and let geology
   and evolution resolve.
4. **Read** — inspect the bank, explore the island, compare descendants,
   understand what happened and why.

Every branch on the bank exists because the player's terrain created the
conditions for it, or because the player chose to send a new raft into an
existing ecosystem. Every extinction exists because the player's terrain
removed the conditions that sustained it.

## Rafts: seeding the bank

Rafts are how terrestrial animal life reaches the island. The player can
launch a raft at any time — before the first jump, between jumps, after an
extinction event, or into a thriving ecosystem.

Each raft uses the Distant Drifter process: the player picks food source,
size, and origin climate. The game generates the founder cohort. The raft
launches, and establishment is not guaranteed — the founders face the
island's current conditions.

### Why multiple rafts matter

- **A bare island** needs a raft to start. The first raft is the root of the
  entire bank.
- **After extinction** the player can relaunch. The new raft starts a fresh
  root alongside the dead wood of the old one — two separate lineage trees
  in the same bank.
- **Into a living ecosystem** is the high-risk play. New arrivals must
  compete with established populations for food and habitat. They may fail
  immediately, carve out a marginal niche, or — rarely — displace an
  incumbent. A successful second raft creates a second independent root in
  the bank, and the two lineage trees can interact through competition,
  niche partitioning, and predator-prey dynamics.
- **Different founder choices** let the player seed different ecological
  roles. Send herbivores first to establish a base, then send predators
  later once prey biomass exists. Or send two herbivore rafts with different
  size bands and watch them partition the landscape.
- **Timing matters.** A raft sent to a young volcanic island with no soil
  faces different odds than one sent to a mature island with established
  vegetation and drainage.

Each raft's lineage remains visually trackable in the bank — different roots,
different palettes, interacting but ancestrally separate.

## What makes the bank branch

### Isolation is the primary driver

A population splits into two when a barrier forms between subgroups. The
barrier can be:

- **Water** — a flooded saddle, a dug channel, rising sea level
- **Elevation** — a raised ridge too steep to cross
- **Habitat discontinuity** — lava resurfacing that destroys the corridor
  between two vegetated zones

Once isolated, each subpopulation responds independently to its local habitat
pressures. Drift adds random wobble, especially in small populations. Over
deep time, the two sides diverge into visibly distinct descendants.

**Player lever:** the player controls when and where isolation happens by
sculpting barriers. Dig a channel across a peninsula and you've started a
speciation event. You won't see the result until you jump.

### Reconnection and hybridization

When a barrier disappears — sea level drops, a land bridge forms, erosion
opens a saddle — previously isolated populations meet again. What happens
depends on how far they've diverged and how their niches overlap:

**Competition** — both populations occupy the same niche but one is
better-adapted to the shared zone. The weaker competitor contracts or goes
extinct. One branch on the bank ends. This happens when niche overlap is
high and fitness is unequal.

**Coexistence** — the two populations have diverged into different niches
during isolation. A highland grazer and a lowland browser can share a
reconnected landscape without displacing each other. Both persist, now
exchanging limited gene flow. This happens when niches have differentiated
enough that neither outcompetes the other.

**Hybridization** — recently diverged populations with overlapping niches
blend back together. The result is a single population carrying traits from
both parent branches — potentially more variable and more adaptable than
either ancestor. Two branches merge into one on the bank, but the merged
population may carry novel trait combinations that neither parent had.
Hybridization is most likely when divergence time is short (tens of
thousands of years, not millions) and reproductive compatibility remains
high.

Hybridization is one of the bank's most powerful emergent mechanics. A
player who deliberately isolates populations, lets them adapt to different
pressures, then reconnects them is performing artificial selection through
landscape architecture. The hybrid population might combine a highland
ancestor's cold tolerance with a coastal ancestor's foraging breadth —
producing something neither lineage could have reached alone. Or the
hybrid might be a muddled generalist that gets outcompeted by the next
specialist to emerge. The outcome depends on what traits each parent
contributed and what the shared habitat demands.

**Player lever:** the player controls reconnection by building land bridges,
letting erosion open corridors, or sculpting terrain that brings habitats
into contact. Reconnection is a deliberate gamble — you might create a
powerful hybrid, preserve two coexisting specialists, or lose a lineage
you spent jumps cultivating.

### Habitat pressure shapes each branch

While isolation determines *where* the bank branches, habitat pressure
determines *what* each branch becomes. Every zone on the island has a
signature that pushes adaptation:

| Habitat signature | What it selects for |
|---|---|
| High + foggy + rocky | Stocky build, insulation, grip feet |
| Low + arid + open | Lean build, heat tolerance, speed |
| Coastal + tidal + shallow | Wading limbs, waterproof covering, shore foraging |
| Flooded + permanent water | Aquatic adaptation or extinction |
| Dense canopy + mid-elevation | Climbing ability, lighter build, camouflage |
| Exposed ridge + updrafts | Lighter frame, gliding membranes |
| Fragmented archipelago | Dispersal ability — swimming or flight to reach new land |
| Mangrove + intertidal | Semi-aquatic persistence, broad diet |

**Player lever:** the player controls habitat signatures by sculpting terrain.
Raise a ridge and you create a rain shadow — arid on one side, humid on the
other. Flood a lowland and you force aquatic adaptation or extinction. Every
sculpting action changes which pressures act on which populations.

## Domain transitions: land, sea, and air

The bank doesn't stay on land. Over deep time, terrain conditions can push
populations across domain boundaries. These are the rarest, most dramatic
branches — and they emerge from what the player built.

A population's food-finding strategy is the bridge between domains. An animal
doesn't decide to become aquatic; it follows food into water, and over
generations, the ones that feed better in water reproduce more. The player
creates the conditions where food is more accessible in a new domain than
in the old one.

### Path to water

The player creates persistent coastal shallows, tidal flats, or permanently
flooded lowlands. A population at the water's edge faces sustained pressure
to forage in water.

```
terrestrial
  → shore forager (visits water for food)
  → wading specialist (long legs, waterproof covering)
  → swimmer (webbed feet, streamlined body)
  → fully aquatic (limbs become fins, tail becomes propulsive)
```

Each stage is a separate jump's worth of selection. The player sees
intermediate forms — a wading descendant is visually distinct from both its
terrestrial ancestor and its future aquatic descendant. The transition can
stall at any intermediate if the habitat pressure changes. A population of
semi-aquatic waders is a valid permanent outcome, not a failed transition.

**Player lever:** maintain shallow productive water adjacent to an established
population for multiple jumps. Remove the water and the transition stalls or
reverses.

### Path to air

The player creates fragmented habitat — sea stacks, isolated ridgelines,
separated canopy islands — where the only way to reach new resources is
across a gap.

```
terrestrial
  → climber (grip limbs, lighter build)
  → glider (membrane or proto-wing, lighter still)
  → powered flier (full wing structure, hollow frame)
```

Alternatively, exposed ridgelines with consistent updrafts favor soaring
over powered flight, producing a different aerial body plan.

**Player lever:** fragment habitat so that populations must cross gaps to
survive. Maintain updraft-producing ridgelines. The more isolated the
fragments, the stronger the selection for aerial dispersal.

### Path from air to water

A coastal flighted population with access to rich marine food can specialize
toward diving:

```
flighted coastal bird
  → plunge/pursuit diver
  → wing-propelled swimmer (heavier, more rigid wings)
  → flightless marine specialist (penguin-like)
```

**Player lever:** create productive coastal upwelling with limited terrestrial
food. The population must find more value in diving than in flying.

### Path from flight to flightlessness

An island population with abundant ground food, no terrestrial predators, and
no need to cross barriers can lose flight:

```
flighted generalist
  → ground-biased forager
  → facultative flier (short flights only)
  → flightless terrestrial specialist
```

**Player lever:** create a predator-free island with rich ground food and no
habitat gaps. Flight becomes metabolically expensive for no benefit.

### Cross-domain food finding

Domain transitions aren't just about locomotion — they're about where food
is. A population can find food across domain boundaries without fully
transitioning:

- A terrestrial population forages at tide pools and rocky shores without
  becoming aquatic
- A flighted population dives for fish without becoming flightless
- A semi-aquatic population grazes on land and hunts in water
- A gliding population exploits canopy insects without becoming a powered
  flier

These mixed strategies are stable outcomes, not incomplete transitions. A
population that can feed in two domains may be less efficient in each than
a specialist, but it's buffered against change in either. The bank will
contain many populations in these intermediate states — and they're some of
the most interesting branches because they can tip in either direction on the
next jump.

### Transition constraints

Every domain transition follows the rules in
`OCEAN-COLONIZATION-AND-DOMAIN-TRANSITIONS.md`:

- Every intermediate form must be independently viable — it feeds, reproduces,
  and persists in a corridor habitat.
- The source domain's capability degrades as the destination domain's improves.
  Nothing becomes equally excellent at walking, swimming, and flying.
- Ancestry is never hidden. A penguin-like diver still looks related to the
  bird it descended from. A marine descendant still carries its terrestrial
  ancestor's palette.
- Transitions can fail. Remove the pressure, and the population stays where it
  is or retreats.

## Reading the bank

The Tangled Bank is a visual diagram the player can inspect at any time.

### Navigation

The bank can grow large across multiple islands and millions of years. The
player navigates it by:

- **Filtering by island** — show only lineages on a specific island
- **Filtering by time** — collapse history before a chosen jump
- **Filtering by status** — living only, extinct only, or both
- **Filtering by domain** — land, sea, air, or mixed
- **Comparing any two populations** — select two nodes to see their lineage
  distance, divergence history, and side-by-side silhouettes

### Structure

- Every population that ever existed, living or extinct
- Branch points: where and when a population split, and what terrain event
  caused it
- Extinctions: where and when a lineage ended, and what killed it
- Reconnections and hybridizations: where branches merged, and what the
  hybrid inherited from each parent
- Domain transitions: marked as landmark events on the branch
- Multiple roots: one per successful raft, visually distinct

### Per-population detail

- **Silhouette comparison** — ancestor and descendant side by side, showing how
  proportions, limbs, covering, and coloration changed
- **Habitat overlay** — where this population lives on the island, shown on the
  terrain map
- **Pressure summary** — what environmental forces shaped this population (plain
  language: "isolated on a fog-fed highland for 200,000 years; body mass
  increased, insulation thickened, feet adapted to rocky substrate")
- **Lineage distance** — how many branches separate any two living populations,
  showing how related they are

## Emergent gameplay: what makes each bank unique

### Cascading consequences

The player digs a channel to isolate two ground populations. But the channel
also creates a new waterway. One population's edge subgroup starts foraging
at the new shore. Three jumps later, that edge subgroup has become a
semi-aquatic wading lineage — a branch the player never planned. Meanwhile,
the isolated highland population, cut off from gene flow, drifts into an
unexpected body plan because its founding subgroup happened to be small and
genetically narrow. The bank grew two new branches from one sculpting action,
and neither was what the player intended.

### Deliberate hybridization

The player isolates a population on a cold, foggy highland and another on a
hot, arid coast. Over 200,000 years, the highland branch develops thick
insulation and stocky build; the coastal branch develops lean heat tolerance
and shore-foraging ability. The player then sculpts a gentle slope connecting
the two zones and jumps. The populations meet. Because they diverged recently,
they hybridize — producing a variable population with cold-tolerant
individuals that can also forage at the shore. On the next jump, this hybrid
population radiates into the new combined habitat more successfully than
either parent could have alone. The player used isolation and reconnection as
a breeding program, and the bank records the whole story: two branches that
merged and then exploded outward.

### Cross-domain food web

The player's second raft introduces a small predator into an island already
populated by large herbivores from the first raft. The predator establishes
in coastal scrub, too small to threaten adults but capable of taking
juveniles. The herbivore population shifts toward larger body size and inland
habitat. Meanwhile, the predator population splits — one group follows prey
inland, another starts taking fish and crabs at the shore. Three jumps later,
the inland predators are larger pursuit hunters and the coastal predators are
semi-aquatic fishers. The bank now has two roots (herbivore and predator)
whose branches shaped each other, with one predator lineage crossing a
domain boundary because food was easier to find in water than on land.

### Tragic reconnection

The player spends four jumps cultivating two isolated populations into
distinct specialists. Then sea level drops and a land bridge forms. The
lowland specialist outcompetes the highland one in the shared zone. A branch
the player invested in goes extinct. The bank gets pruned. The player learns
that isolation is a gift that geology can take back.

### The archipelago inheritance

As the hotspot chain produces new islands, life from older islands colonizes
them. The player's bank extends across islands — a population from Island 1
rafts to Island 2, founding a new branch that radiates independently. The
bank becomes an archipelago-wide family, with different islands hosting
different descendants of the same ancestor. When Island 1 eventually subsides
and drowns, its lineages survive only through the branches that colonized
younger land. The bank records this history — a drowned root, living branches
on distant islands.

### The empty island

The player sculpts aggressively — floods everything, strips all highland
habitat. Every population goes extinct. The bank is entirely dead wood. The
island is barren and silent. The player launches a new raft — different
founder choices this time. The new lineage starts a fresh root in the bank.
The old dead wood remains visible, a fossil record of what was lost. This is
not a game-over. It is a consequence and a fresh start.

## What the Tangled Bank is NOT

- **Not a tech tree.** There are no unlocks, no research points, no
  prerequisites the player checks off. Branches emerge from terrain, not from
  a menu.
- **Not a creature creator.** The player never designs an animal. They design
  a landscape, choose what to send to it, and discover what it produced.
- **Not a food web diagram.** The bank tracks ancestry, not feeding
  relationships. Predator-prey dynamics exist in the simulation but are
  displayed separately.
- **Not a score with a win condition.** A wide, deep bank with domain
  transitions is impressive, but a narrow bank with two exquisitely adapted
  specialists is equally valid. The bank is the player's story, not their
  grade.

## Relationship to existing design contracts

This document is the player-facing view of mechanics defined elsewhere:

| Mechanic | Authoritative source |
|---|---|
| Hotspot chain, crust motion, shield construction | `GALAPAGOS-HOTSPOT-PLAN.md` |
| Founding raft, player choices, establishment | `DISTANT-DRIFTER-DESIGN.md` |
| Population evolution, selection, drift, gene flow | `GALAPAGOS-HOTSPOT-PLAN.md` §Population evolution |
| Domain transitions, corridors, intermediate viability | `OCEAN-COLONIZATION-AND-DOMAIN-TRANSITIONS.md` |
| Habitat pressures, fitness budget, trait tradeoffs | `DISTANT-DRIFTER-DESIGN.md` §One fitness budget |
| Ocean colonization, marine residents, visitors | `OCEAN-COLONIZATION-AND-DOMAIN-TRANSITIONS.md` |

This document does not override any of those contracts. It describes how they
feel to the player and what the player's relationship to them is.
