# Epoch reef builder family — morphology card

## Ecological job

Build three-dimensional shallow-water habitat over long substrate ages. The
family turns light, current exposure, shelter, sediment and disturbance into a
reef silhouette that makes the landing state's history readable.

## Real-world referents

- *Acropora* supplies the swept-water branching thickets and table crowns.
- *Porites* supplies massive, long-lived bommies in sheltered water.
- Meandroid brain corals supply compact sediment-tolerant forms.
- Gorgonian sea fans supply thin filtering surfaces across strong current.
- Crustose coralline algae supplies the low pioneer layer on young substrate.

These are growth-form referents for one bounded visual family, not a claim that
the current resolver models six taxonomically complete species.

## Silhouette bet

A player should infer water movement and reef age without labels: branching,
plating and fan forms imply swept bright water; broad domes and brain forms
imply older or more sheltered substrate; flat crust implies recent settlement.

## Trait map

| Trait | Environmental driver | Continuous or discrete | Visible expression |
|---|---|---|---|
| Colony age | Substrate age and uninterrupted growth | Continuous | Radius, height and exceptional massive bommies |
| Health | Heat stress, depth and flushing | Continuous | Living tissue pales toward exposed skeleton |
| Flow exposure | Current speed and shelter | Continuous | Lean, fan sway and form weighting |
| Living color | Symbiont condition and bounded pigment morph | Continuous | Warm tissue with a minority cool morph |
| Growth form | Light, flow, sediment and succession phase | Discrete | Encrusting, branching, plating, massive, meandroid or fan grammar |

Branching, massive, plating, fan, brain and encrusting colonies retain their
ecological site identity and pack into mixed communities across the continuous
carbonate field already accumulated in terrain history. The renderer adds no
per-site foundation geometry. It instead makes that existing field legible as
an irregular weathered reef-rock pavement with broad low ledges. Encrusting
colonies retain their biological footprint so rock remains visible between
them, and the render-only relief embeds their bases slightly into the framework.
An independent instanced layer adds dense hand-sized fragments of bleached dead
skeleton, weathered limestone and coralline-coated rubble across that carbonate
field. It is sampled independently of living colony positions, preventing the
one-rock-per-coral composition. Massive domes remain coral growth forms, not
presentation rocks.

The continuous floor itself carries the load-bearing reef identity: nonrepeating
macro, fragment, grain and fleck scales break the broad colour wash into
weathered carbonate, with intermittent coralline film and matching normal
relief. Caustics remain present but are attenuated over carbonate so moving
light cannot turn the fixed substrate into broad cartoon sand waves.
The final underwater palette keeps the pavement light cool grey. Most rubble is
pale grey, a smaller share is mid blue-grey, and the darkest tier is still a
readable dark grey rather than near-black. Coarser fragment-scale colour and normal variation
prevents the substrate from returning to a fine sandy read; warm brown is used
by neither pavement nor rubble underwater.

## Family resemblance

All forms share the same restrained reef-tissue palette, water-column material,
health/bleaching response, seeded surface language and seabed seating contract.
The variants differ where habitat pressure changes colony architecture, not as
decorative collectible forms.

Within each community, a stable presentation scale preserves the resolver's
maximum biological envelope while pulling many colonies down toward recruit
size, producing a readable small/medium/dominant hierarchy. Healthy mottled
tissue also carries restrained green/cyan/red fluorescent re-emission under the
blue-rich underwater light; bleaching removes the response, and the effect is
localized rather than making the full colony self-lit.

## Rejected directions

- One evenly distributed rainbow palette: it obscures flow and health signals.
- Runtime-only procedural authoring as the accepted pipeline: geometry must be
  exported and cached from a reproducible build-time source before candidate.
- Treating every growth form as a separate unrelated species package before the
  shared reef-builder visual contract has passed at gameplay distance.

## Current gate

Stage returned to `candidate` for LW-2 after the previously accepted crustose
form was revised from an open surface into a closed mantle over exposed rock.
The earlier orthographic, colony, gameplay-distance and in-engine evidence is
retained as the accepted baseline rather than overwritten. The exact remaining
volume-only evidence is also retained with the owner's verdict that it was
closer but still lacked a rock host; one-coral/one-rock and repeated encrusting
patch clusters also missed the photo reference's mixed-form communal structure.
The communal-framework attempt was also rejected because its repeated compact
foundations still read as coral-boulder placements. The continuous-reef pass was
closer, then revised with a broader colony-size hierarchy and visible restrained
fluorescence. That coral treatment was judged good; the remaining issue moved to
the smooth seafloor. The exact gate is now the owner's visual verdict on the
multi-scale carbonate-material showcase; only that verdict can return the
family to `accepted`.
