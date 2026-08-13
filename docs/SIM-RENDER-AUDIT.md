# Epoch: Simulation–Rendering Gap Audit

*Snapshot updated: 2026-08-13. Goal: keep simulation and rendering in tandem. Proposed follow-up work is reconciled in `docs/DOC-ALIGNMENT-PLAN.md`; this audit does not itself confer implementation or visual acceptance.*

## Rendering Correctly
- **Terrain elevation** — TerrainHistory.elevations synced into Three.js plane geometry. Drives all terrain geometry, shadows, walkability, ocean depth reads.
- **Disturbance, vegetationProtection, runoff, forage** — Packed into RGBA DataTexture. `terrain-material.ts` drives rock exposure, ground cover, erosion tinting, and wet shore.
- **Local environment** — Rainfall × temperature selects one of nine foundations; terrain resolves moisture, exposure, drainage, water depth, sediment, frost potential, and a compact habitat class per cell. The renderer receives continuous fields, not biome colors.
- **Substrate history** — Basalt, ash, substrate age, sediment, and reef-produced carbonate persist in terrain history. Fresh basalt suppresses carbonate; runoff sediment can bury it.
- **Basalt, ash, carbonate, substrate age** — RGBA geological DataTexture. Materials preserve fresh volcanic ground, expose carbonate shelf, and use substrate maturity only for bounded surface treatment.
- **Tree placement + morphology** — vegetation-renderer.ts consumes all morphology fields: guild, height, crown dims, lean, foliage HSL. Near/far LOD wired.
- **Seagrass** — seagrass-renderer.ts consumes height, spread, scale, rotation, HSL. Per-tuft sway, near/far LOD.
- **Land lineage traits → grazer** — All seven population means feed the accepted marsh-grazer. Stable renderer seeds add modest individual samples around those means; abundance controls visible instance count, and one `InstancedMesh` renders each lineage. The sim still stores no within-population variance.
- **Herd behavior** — Terrain pathfinding, cohesion/separation wired in update loop.
- **Freshwater basins** — freshwater-renderer.ts triangulates flat-surface grid from FreshwaterField.surface.
- **Stream ribbons** — stream-renderer.ts animates segments with discharge ≥ 0.12 and drop/length ≤ 0.22.
- **Ocean surface** — Tessendorf/JONSWAP FFT, analytic chop, Fresnel, sky reflection, depth transmission, shoreline foam.
- **Atmosphere + height fog** — Sun direction/color/intensity, fog density/ceiling driven by climate regime.
- **Post-processing** — TSL grading, bloom (0.12 threshold), optional GTAO.
- **Terrain detail** — terrain-detail-renderer.ts places outcrops/scree from slope, disturbance, vegetationProtection.
- **Wet shore** — Vertex-color alpha keyed to sea level distance.
- **Marine energy → aerial score** — preyAvailability feeds aerial flock score via marineAbundance * 0.34.

## Sim Output Without Render (gaps)
- **TerrainHistory.nutrients** — Computed, influences tree suitability, not packed into terrain texture. Nutrient-rich patches look identical to depleted ones.
- **TerrainHistory.volcanicLoad** — Drives subsidence but not in volcanic texture. No visual cue for lithospheric loading.
- **FreshwaterField.depth** — Computed per cell. freshwater-renderer.ts reads only surface elevation. Shallow and deep pools look identical.
- **Waterfall segments** — resolveStreamSegments identifies steep-drop reaches and reserves them for a "dedicated waterfall layer." That layer does not exist.
- **Marine trait nuance** — the candidate coastal-forager expresses body size, streamlining, maneuverability, depth control, thermal tolerance, energy, and resolved water-band placement. Depth preference selects that band but has no additional cosmetic cue, by design.
- **Land lineage energy** — In resolver + report. The accepted expression renderer does not read it. A starving population has fewer visible instances through abundance but no independent condition/posture cue.
- **Marine lineage energy** — Candidate fish now use energy for saturation, condition, and swim cadence; owner visual verdict remains.
- **Terrestrial feedingAdaptation** — Computed in founder resolver, not in PopulationTraits, no visual.
- **MarineEnergyExchange fields** (primaryProductivity, nurseryCapacity, preyAvailability, shorelineSubsidy) — Feed aerial score correctly. No independent visual layer. shorelineSubsidy computed, nothing consumes it.
- **Aerial population persistence** — Stateless: no species identity, no persistence across jumps, no trait variation. 12 identical primitive birds regenerated each jump.
- **Within-population trait variation** — The sim stores means but no variance per terrestrial trait axis. Current individual differences are stable renderer sampling, not inherited simulation state.
- **Primitive bird mesh** — Integration adapter per WILDLIFE-ROADMAP.md. The primitive swimmer has been replaced by a candidate fish family.

## Planned (not implemented on either side)
- **PLANNED — Clouds** — Deferred until lower atmosphere passes accepted.
- **PLANNED — Crest/Jacobian foam** — Next ocean gate. No Jacobian computed from FFT.
- **PLANNED — Waterfall transitions** — Segments reserved. No geometry, particles, or material layer.
- **PLANNED — Snowfield/glacier surfaces** — No snow/ice layer for cold climates.
- **PLANNED — Triplanar rock projection** — Conditional on capture review.
- **CANDIDATE — Reef succession system** — Persistent sites resolve cover, framework, stress, composition, and carbonate deposition from depth, light, currents, temperature, runoff/sediment, substrate age, and basalt.
- **BUILT — First coral asset family** — Owner accepted the paired `epoch-reef-builder-family` integration on 2026-08-13; future major visual changes require their own verdict.
- **CANDIDATE — First fish/marine asset family** — `epoch-coastal-forager` is integrated and awaits owner visual judgment.
- **PLANNED — Aerial wildlife persistence** — No AerialLineageState, no nesting/metabolic model.
- **PLANNED — Freshwater ecology** — Basin is habitat only. No ecological consumer defined.
- **PLANNED — Full cross-domain food web loop** — Runoff→coast→marine partially wired. Marine→aerial→land (guano) not persistent.
- **PLANNED — Cross-domain ancestry (land → water)** — Schema reserved, no resolver logic fires it.
- **PLANNED — Jump-transition visual treatment** — Explicitly deferred in THESIS.md §2.1 and §8.
- **PLANNED — Per-population trait variance and lineage DNA** — No fixed hereditary record yet covers variance, trajectories, ancestral snapshots, environmental imprint, or branching history.
- **BUILT for first grazer; CANDIDATE for first fish — Instanced trait expression** — Both use topology-stable instanced morph storage. Fish instances currently share their lineage means; no per-instance biological sampling is claimed.
- **PLANNED — Insulation surface treatment and trait LOD** — No fur/shell treatment or distance-scaled creature expression.
- **PLANNED — Trait-driven behavior** — Herd movement is trait-independent.
- **PLANNED — Field-notebook lineage card** — Existing lineage reporting is textual; the richer successor has no fixed data or delivery contract.
