# Example marsh grazer morphology

## Ecological job

Consumes emergent marsh vegetation and moves nutrients between wet meadow and shallow water.

## Real-world referents

Capybara supplies the low amphibious body and blunt grazing head. Marsh deer supplies the leggy silhouette associated with flooded grassland. Small bovids inform the short defensive horn pair without turning it into ornamental fantasy anatomy.

## Silhouette bet

A player should read “habitat-shaped grazer” from its clearance legs, blunt head, barrel body, and grounded stance before reading color or UI.

## Trait map

| Trait | Environmental driver | Continuous or discrete | Visible expression |
|---|---|---|---|
| Body mass | Forage and energetic reserve | Continuous | Torso volume expands while the family spine line remains stable |
| Leg length | Inundation and roughness | Continuous | Body clearance and leg length increase together |
| Foot width | Soft substrate and inundation | Continuous | Distal leg/foot footprint broadens without widening the whole limb |
| Insulation | Temperature and exposure | Continuous | Torso and head coat volume increases; surface treatment remains a later gate |
| Horn length | Competition and defense | Continuous | Short paired horns extend from a fixed base |
| Coat warmth | Habitat palette and exposure | Continuous material value | Per-instance hue/saturation shift against neutral albedo |
| Coat lightness | Habitat palette and solar exposure | Continuous material value | Per-instance value shift against neutral albedo |
| Walk phase | Locomotion | Animation parameter | Two topology-stable diagonal-gait pose targets test motion composition |

## Family resemblance

Every variant retains the same vertex topology, blunt head, barrel torso, spine line, paired short-horn bases, and marsh-umber palette family.

## Rejected directions

- Antlers were rejected because they would overpower the habitat-shaped silhouette.
- Runtime procedural remeshing was rejected because it would make trait expression non-reproducible and violate the build-time asset boundary.
- The source-stage cuboid silhouette is an architecture probe, not a visual-quality claim.

## Preview verdict — 2026-08-12

The first cuboid source proved the architecture but was rejected for candidate use: its head lacked a muzzle/neck transition, horn columns dominated the front view, foot anatomy was absent, and its body remained a box at gameplay distance.

**Revised candidate verdict:** the 615-vertex faceted source clears that rejection. The four refreshed in-engine WebGPU views show a continuous barrel torso and shoulders, neck and blunt muzzle, lateral ears, tapered clearance legs with broad hooves, swept short horns, and a restrained tail. Low, mean, and high trait samples remain visibly related while body mass, leg clearance, foot width, insulation volume, horn length, and coat values separate at gameplay distance.

## Landing integration — 2026-08-12

The asset replaces the primitive grazer groups in the landing renderer. Each lineage uses one `InstancedMesh`; stable render seeds sample modest individual differences around the authoritative population means, while navigation remains per visible animal and writes instance transforms. The fixed `?shot=herd&years=10000&time=42&herd=candidate` fixture places seven samples on authoritative terrain without creating simulation lineages or changing establishment rules. The recorded showcase verifies scale, terrain contact, shadows, color variation, and one-draw herd composition.

### Live locomotion review

The non-canonical `?showcase=herd` route leaves navigation and gait updates running. Paired frames recorded 2.5 seconds apart show the herd advancing along real terrain-aware paths with stable heading and ground contact. The foreground in-app WebGPU run held the application's 30 fps presentation cap and reported 15 total frame draws, matching the no-herd baseline in the same browser; this is a useful regression check, not a GPU timestamp measurement. Gait is functional but subtle at the current camera distance.

## Owner acceptance — 2026-08-12

**Accepted as the first fauna draft.** The owner reviewed the revised silhouette and live island-context evidence and recorded “passes.” This verdict accepts this bounded marsh-grazer family and its current landing integration; it does not accept future fauna families, shell-fur treatment, creature LOD, or simulated per-population variance on their behalf.
