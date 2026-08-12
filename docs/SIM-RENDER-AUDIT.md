# Epoch: Simulation–Rendering Gap Audit

*Last updated: 2026-08-12. Goal: keep simulation and rendering in tandem.*

## Rendering Correctly
- **Terrain elevation** — TerrainHistory.elevations synced into Three.js plane geometry. Drives all terrain geometry, shadows, walkability, ocean depth reads.
- **Disturbance, vegetationProtection, runoff, forage** — Packed into RGBA DataTexture. terrain-material.ts drives rock exposure, ground cover, erosion tinting, wet shore.
- **Basalt + ash** — RG DataTexture (volcanicTexture). Blends basalt/ash color over base terrain.
- **Tree placement + morphology** — vegetation-renderer.ts consumes all morphology fields: guild, height, crown dims, lean, foliage HSL. Near/far LOD wired.
- **Seagrass** — seagrass-renderer.ts consumes height, spread, scale, rotation, HSL. Per-tuft sway, near/far LOD.
- **Land lineage traits → grazer** — All 7 traits mapped to mesh (bodyMass, legLength, footWidth, insulation, coatWarmth, coatLightness, hornLength). Abundance drives herd count.
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
- **Marine traits beyond bodySize** — streamlining, depthPreference, thermalTolerance, maneuverability, depthControl all simulated. Only bodySize drives swimmer scale. Mesh is trait-invariant.
- **Marine band (benthic/midwater/surface)** — Tracked in 3-node water column graph. All swimmers render at same Y regardless of band.
- **Land lineage energy** — In resolver + report. applyGrazerTraits does not read it. Starving population looks identical to thriving one.
- **Marine lineage energy** — Same issue. Shown in report, no visual correlate.
- **Terrestrial feedingAdaptation** — Computed in founder resolver, not in PopulationTraits, no visual.
- **MarineEnergyExchange fields** (primaryProductivity, nurseryCapacity, preyAvailability, shorelineSubsidy) — Feed aerial score correctly. No independent visual layer. shorelineSubsidy computed, nothing consumes it.
- **Aerial population persistence** — Stateless: no species identity, no persistence across jumps, no trait variation. 12 identical primitive birds regenerated each jump.
- **Primitive swimmer + bird meshes** — Integration adapters per WILDLIFE-ROADMAP.md. Not accepted visual assets.

## Planned (not implemented on either side)
- **PLANNED — Clouds** — Deferred until lower atmosphere passes accepted.
- **PLANNED — Crest/Jacobian foam** — Next ocean gate. No Jacobian computed from FFT.
- **PLANNED — Waterfall transitions** — Segments reserved. No geometry, particles, or material layer.
- **PLANNED — Snowfield/glacier surfaces** — No snow/ice layer for cold climates.
- **PLANNED — Triplanar rock projection** — Conditional on capture review.
- **PLANNED — Reef succession system** — Entirely greenfield. No sim fields, resolver, history, renderer, or asset.
- **PLANNED — First coral asset family** — Blocked on reef-site contract.
- **PLANNED — First fish/marine asset family** — Brief not started. Immediate next step per WILDLIFE-ROADMAP.md.
- **PLANNED — Aerial wildlife persistence** — No AerialLineageState, no nesting/metabolic model.
- **PLANNED — Freshwater ecology** — Basin is habitat only. No ecological consumer defined.
- **PLANNED — Full cross-domain food web loop** — Runoff→coast→marine partially wired. Marine→aerial→land (guano) not persistent.
- **PLANNED — Cross-domain ancestry (land → water)** — Schema reserved, no resolver logic fires it.
- **PLANNED — Jump-transition visual treatment** — Explicitly deferred in THESIS.md §2.1 and §8.
