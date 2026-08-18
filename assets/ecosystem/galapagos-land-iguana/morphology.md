# Galápagos land-iguana founder morphology

## Ecological job

A squat arid-island herbivore. Founders graze coastal and seasonal forage; later
isolation can pull the same body toward wetter or more exposed islands without
leaving the family.

## Real-world referents

*Conolophus subcristatus* (Galápagos land iguana) supplies the blunt head,
nuchal-to-dorsal crest, dewlap, sprawling-but-short limbs, and long tapering
tail. *Conolophus pallidus* informs the ochre-to-gold arid palette. Crest height
carries the sim's `hornLength` channel so the family never grows mammal horns.

## Silhouette bet

A player should read “land iguana” from the low barrel, blunt snout, dewlap,
sagittal crest, and long tail before reading colour or UI. Crest extremes stay
a ridge of spines, not a pair of horns.

## Trait map

| Trait | Environmental driver | Continuous or discrete | Visible expression |
|---|---|---|---|
| Body mass | Forage and energetic reserve | Continuous | Torso and jowl volume expand along a stable spine line |
| Leg length | Inundation and roughness | Continuous | Body clearance and limb length increase together |
| Foot width | Soft substrate and inundation | Continuous | Distal feet broaden without widening the upper limb |
| Insulation | Temperature and exposure | Continuous | Body and dewlap bulk increase; hide stays scaly, not furred |
| Horn length | Open-habitat competition and defense | Continuous | Nuchal and dorsal crest spines lengthen from fixed bases |
| Coat warmth | Habitat palette and exposure | Continuous material value | Per-instance hue/saturation shift toward gold or drab brown |
| Coat lightness | Habitat palette and solar exposure | Continuous material value | Per-instance value shift against the ochre family albedo |
| Foot plan | Persistent inundation | Discrete | Compact clawed foot vs splayed wet-ground foot |
| Walk phase | Locomotion | Animation parameter | Two topology-stable diagonal-gait pose targets |

## Family resemblance

Every variant retains the same vertex topology, blunt head, dewlap, sagittal
crest bases, long tail, ochre-gold palette family, and metre-true squat
proportions. Habitat pulls silhouette and coat; ancestry stays obvious.

## Rejected directions

- Mammal horns, antlers, or ear pinnae were rejected as fantasy variants on an
  iguana body.
- Foxel remeshing was rejected because it cannot prove topology-stable
  per-instance morphs required by herd instancing.
- Giant or dwarf heroic scaling was rejected; one world unit is one metre.
- Separate parent and descendant meshes were rejected; branches must share this
  rig so WU-4c can split by trait, not by species swap.
