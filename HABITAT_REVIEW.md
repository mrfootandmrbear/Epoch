# Habitat → Epoch: inheritance review

> Reviewed against Habitat `5479947` on 2026-08-09: thesis, playtest returns,
> time/living-world reviews, simulation/render wiring, probe evidence, source
> structure, and the running playable.

## Verdict

Habitat found the right toy and then built a large real-time ecological engine
around it. Its strongest player evidence is simple: sculpting held attention,
and a living hollow meeting the next storm differently created a desire to run
another storm. Epoch should preserve that causality and make the transformed
world—not the machinery used to calculate it—the event.

Epoch should not be a rewrite of Habitat feature-for-feature. It should be a
new renderer and interaction loop fed by a much smaller outcome model distilled
from Habitat's proven relationships.

## What Habitat proved

1. **Form is a meaningful cause.** Terrain edits reroute water, alter erosion,
   create habitat, and remain recognizable after time acts on them.
2. **Life changing physics is the best feedback loop.** The strongest playtest
   result was the colonized hollow holding the next storm differently.
3. **Global forces feel like nature acting.** Rain, wind, heat, sea, tide,
   season, erosion, and fire work better as regimes than targeted powers.
4. **Arrival is more satisfying than placement.** Organisms appearing because
   the place supports them is central to the “castle becomes alive” payoff.
5. **Everyday intuition is the right plausibility test.** Water runs downhill,
   plants stabilize wet ground, exposed shores erode, and unsuitable
   populations fail. Epoch should preserve these readable causal chains.

## What not to carry forward

### Continuous stepping as the epoch engine

Habitat's own time review measured a century at roughly 40 minutes on the full
event ladder and about 9 seconds even at a decadal integration floor. In the
reviewed playable, 20 wall seconds at the fastest setting advanced 84 simulated
days while dropping 4,168 steps. Epoch's jump cannot be a faster version of
this loop. It needs a direct or coarse outcome resolver whose cost is bounded
by world resolution and model passes, not elapsed years.

### Exact replay as a product constraint

Habitat's exact hashes made an excellent engineering harness but pulled design
toward identical histories, band invariance, and baseline governance. Epoch can
keep seeded randomness for debugging while allowing believable variation in
the landing state. The product promise is causal legibility, not hash identity.

### Inspector-first legibility

Habitat has more than twenty inspector fields, and its current adaptation
playtest asks a density tint to stand in for a visibly thicker coat. Epoch must
render the claim itself. If evolution matters, bodies, behavior, distribution,
and habitat association must visibly differ in the reveal without opening a
diagnostic layer.

### The process and UI surface

Habitat's Simple mode still exposes multiple force selectors, five time rates,
tool and brush selectors, undo, status text, and a numerical ledger. That is
appropriate for a simulation workbench, but it competes with the world as the
primary object. Epoch's form mode can be rich while its jump commitment remains
one focused decision: duration plus forces, then reveal.

### Rendering architecture

Habitat's renderer accumulated duplicated CPU/GLSL encodings, separate inland
and ocean water implementations, hand-mirrored seabed functions, and visual
calibration paths that repeatedly drifted. Epoch should preserve one-way
world-state ownership but express landing materials once in TSL and build
around WebGPU from the start.

## The state vocabulary worth inheriting

Epoch's first outcome resolver needs fewer fields than Habitat, but these are
the valuable categories:

| Outcome state | Habitat evidence to preserve | Epoch use |
| --- | --- | --- |
| elevation + substrate | sculpting, drainage, erosion, shore response | landing terrain and geomorphic change |
| moisture + inundation + exposure | habitat suitability and distinct wet/dry/coastal regions | biome allocation and material response |
| vegetation guild biomass | succession, roughness, infiltration, competition | visible vegetation communities and terrain stabilization |
| disturbance memory | fire scar, salinity, soil depth, mortality lag | history visible in the landing state |
| population density | carrying capacity from habitat and forage | where animals live after the jump |
| population trait means | insulation, limb length, webbing under selection | visible morph differences between descendant populations |

Do not begin by porting `WorldState`. Define an Epoch-native immutable
`WorldSnapshot` for pre-jump and post-jump states, then implement a resolver as
a sequence of coarse passes. Habitat algorithms are references for individual
relationships, not a dependency graph to reproduce.

## Recommended next build

Build one fixed 1,000-year jump from an editable starting island into the
existing landing-state scene:

1. Capture the sculpted terrain and selected force regime in `WorldSnapshot`.
2. Resolve drainage, exposure, and coarse erosion in a bounded number of grid
   passes.
3. Allocate vegetation communities from moisture, elevation, exposure, and
   disturbance, then let vegetation feed back into final erosion.
4. Split one founder grazer into two populations based on habitat separation;
   derive density and visible trait means from local conditions.
5. Reveal the resulting snapshot directly. Defer the transition treatment
   until the before/after pair is convincing.

The success test is not numerical agreement with Habitat. It is whether a
viewer can point to a changed landform and two descendant populations and say,
without an inspector, why each became that way.

The fixed duration is only a validation slice. Once that resolver produces a
convincing before/after pair, expose the thesis's full jump ladder (1, 5, 10,
25, 50, 100, 1,000 years and deeper-time presets). Duration should change the
strength and category of plausible outcomes, not select a separate mechanic:
short jumps emphasize weather, growth, and population movement; long jumps
admit succession, geomorphology, trait drift, divergence, and eventually deep
geological change. Every landing state becomes the editable starting state for
the next jump.
