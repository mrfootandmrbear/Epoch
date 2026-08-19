# Epoch intertidal crab morphology card

## Ecological job

A shoreline scavenger on wet splash lava. It makes `shorelineSubsidy` visible as occupancy on black rock, recycling wrack and marine productivity at the waterline without becoming a persistent lineage history.

## Real-world referents

*Grapsus grapsus* (Sally Lightfoot) supplies the flattened transverse carapace, long spreading walking legs, modest claws, and the adult scarlet-on-lava read. Juveniles stay mottled and cryptic on wet basalt until they redden.

## Silhouette bet

At shoreline mid a reviewer should read “splash crab,” not “extra fish”: a low oval body, wide leg span, and bright adult red against black lava. Juveniles read as darker specks on the same rock. Carapace stays centimetre-scale.

## Trait map

| Trait | Environmental driver | Continuous or discrete | Visible expression |
|---|---|---|---|
| Body size | Shoreline subsidy and energy | Continuous | Carapace and limb scale around a stable stance |
| Redness | Maturity on splash rock | Continuous | Juvenile cryptic olive-brown to adult scarlet-orange |
| Wetness | Proximity to swash | Continuous | Flatter carapace, darker wet hide |
| Agility | Wave exposure on steep lava | Continuous | Longer legs and a slightly higher stance |
| Walk phase | Sideways scuttle | Animation parameter | Alternating lateral leg morphs |

## Family resemblance

Every sample shares one topology, flattened Grapsus carapace, eight walking legs plus modest claws, eyestalks, and the splash-lava palette family. Adults redden; they do not become a second species.

## Runtime motion

`idle` and `walk` are authored clips on the compiled GLB. Walk is a sideways scuttle. Juvenile redness tints the vertex-coloured hide toward cryptic brown. The landing renderer clones the skinned GLB at centimetre scale; simulation does not import meshes. Compiler traps (volume-tube claws, `paw` as a foot, `fin` anchors that never face forward) live in `tools/anycreature/README.md`.

## Rejected directions

- Ghost crab or mangrove fiddler anatomy (later families, not this rig).
- Inflating the carapace to read at overview.
- Seating crabs in the water column as extra coastal-forager instances.
- Using anyCreature as a runtime evolution engine or in the player browser.
- Applying anyCreature's "punchier silhouette" doctrine; Epoch keeps a recognizable Grapsus.
- Replacing the accepted land-iguana family with this tool.
