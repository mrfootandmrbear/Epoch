# Epoch: Simulation–Rendering Gap Audit

*Last updated: 2026-08-12. Goal: keep simulation and rendering in tandem.*

---

## Rendering Correctly

Sim output fully consumed by a renderer with correct visual output.

- **Terrain elevation** (`TerrainHistory.elevations`) — Synced into Three.js plane geometry via `landing-state.ts`. Drives all terrain geometry, shadow casting, walkability, and ocean depth reads.
- **Disturbance, vegetationProtection, runoff, forage** (`TerrainHistory`) — Packed into RGBA `DataTexture` by `packTerrainMaterialState`. `terrain-material.ts` samples to drive rock exposure, ground cover, erosion tinting, and wet shore tinting.
- **Basalt + ash** (`TerrainHistory.basalt`, `.ash`) — Packed into RG `DataTexture` (`volcanicTexture`). `terrain-material.ts` blends basalt (0x17191a) and ash (0x625f59) over base color.
- **Tree placement + morphology** (`LandingOutcome.trees`, `TreeOutcome.morphology`) — `vegetation-renderer.ts` consumes all morphology fields: guild, height, crownWidth, crownDepth, trunkWidth, lean, foliage HSL. Near/far LOD wired.
- **Seagrass** (`LandingOutcome.seagrass`) — `seagrass-renderer.ts` consumes height, spread, scale, rotation, HSL. Per-tuft phase sway. Near/far LOD.
- **Land lineage traits → grazer** (`PopulationOutcome.traits`) — All 7 trait fields mapped: bodyMass → scale, legLength → leg height, footWidth → leg radius, insulation → body width, coatWarmth → hue/saturation, coatLightness → brightness, hornLength → horn scale. Abundance drives herd count.
- **Herd behavior** — Terrain pathfinding, cohesion/separation wired in `update` loop.
- **Freshwater basins** (`FreshwaterField.surface`, `FreshwaterOutcome[]`) — `freshwater-renderer.ts` triangulates flat-surface grid. Filters seagrass/trees from pool boundaries.
- **Stream ribbons** (`TerrainHistory.runoff`, `resolveStreamSegments`) — `stream-renderer.ts` builds animated ribbon geometry for segments with discharge ≥ 0.12 and drop/length ≤ 0.22.
- **Ocean surface** — Tessendorf/JONSWAP FFT swell, three-layer analytic chop, Fresnel, sky reflection, specular, shallow depth transmission, shoreline foam. Wind regime drives FFT params.
- **Atmosphere + height fog** — Sun direction, color, intensity, ambient, fog density/ceiling all driven by climate regime. Correctly modulates across day/dawn/storm.
- **Post-processing** — TSL grading, restrained bloom (0.12 threshold), optional GTAO.
- **Terrain detail (outcrops + scree)** — `terrain-detail-renderer.ts`, slope/disturbance/vegetationProtection driven. Reacts to volcanic disturbance.
- **Wet shore** — Vertex-color alpha keyed to distance from sea level.
- **Marine energy → aerial score** — `preyAvailability` correctly feeds aerial bird flock score via `marineAbundance * 0.34`.

---

## Sim Output Without Render (gaps)

Data computed by the simulation with no renderer, or a renderer that is broken/placeholder/not visually accepted.

- **`TerrainHistory.nutrients`** — Per-cell nutrients computed by terrain and volcanic resolvers, influence tree suitability, but not packed into terrain texture. A nutrient-rich patch is visually identical to a depleted one.
- **`TerrainHistory.volcanicLoad`** — Drives subsidence (elevation change), but the load field itself is not in the volcanic texture. No visual cue for lithospheric loading until the heightfield changes.
- **`FreshwaterField.depth`** — Per-cell water depth computed by `resolveFreshwaterField`. `freshwater-renderer.ts` reads only `field.surface`. Shallow and deep pools look identical.
- **Waterfall segments** — `resolveStreamSegments` identifies steep-drop reaches (drop/length > 0.22) and explicitly reserves them for "the dedicated waterfall transition layer." That layer does not exist. Segments are computed, nothing renders them.
- **Marine traits beyond `bodySize`** — `MarineTraits.streamlining`, `.depthPreference`, `.thermalTolerance`, `.maneuverability`, `.depthControl` are all simulated and adapt across jumps. Only `bodySize` drives the swimmer's scale. Mesh is identical regardless of body shape or depth behavior.
- **Marine `band` (benthic/midwater/surface)** — `MarineLineageState.site.band` is tracked and placed in the 3-node water column graph. All swimmers render at the same Y regardless of band.
- **Land lineage `energy`** — Computed by the resolver, shown in lineage report. `applyGrazerTraits` does not read it. A starving population looks identical to a thriving one.
- **Marine lineage `energy`** — Same issue. Shown in report, no visual correlate.
- **Terrestrial `feedingAdaptation`** — Computed in founder resolver, stored on `LineageState`, influences forage efficiency, not exposed in `PopulationTraits`, no visual.
- **`MarineEnergyExchange` fields** (`primaryProductivity`, `nurseryCapacity`, `preyAvailability`, `shorelineSubsidy`) — Correctly feed aerial score. No independent visual layer. Coast productivity differences only indirectly visible via seagrass density and swimmer count. `shorelineSubsidy` computed, nothing consumes it.
- **Aerial population persistence** — Scored and positioned correctly but stateless: no species identity, no persistence across jumps, no trait variation. 12 identical primitive birds regenerated every jump.
- **Primitive swimmer + bird meshes** — Integration adapters per WILDLIFE-ROADMAP.md. Not accepted visual assets.

---

## Planned (not yet implemented on either side)

Features described in roadmap or planning docs. Not implemented in sim or render.

- **PLANNED — Clouds** — Deferred until lower atmosphere passes are accepted. No geometry, shader, or noise field.
- **PLANNED — Crest/Jacobian foam** — Next ocean gate in RENDERER-ROADMAP.md. No Jacobian determinant or crest signal computed from FFT.
- **PLANNED — Waterfall transitions** — Segments reserved in stream network. No geometry, particles, or material layer exists.
- **PLANNED — Snowfield/glacier surfaces** — No snow/ice surface layer for cold climates. No cold-whitening path in terrain material.
- **PLANNED — Triplanar rock projection** — Conditional on capture review exposing stretching. Not implemented.
- **PLANNED — Reef succession system** — Entirely greenfield. No sim fields, no resolver pass, no history record, no renderer, no asset. WILDLIFE-ROADMAP.md specifies substrate suitability, recruitment, living cover, growth-form composition, carbonate framework, stress/bleaching, competition, connectivity.
- **PLANNED — First coral asset family** — Blocked on reef-site contract. No geometry or material.
- **PLANNED — First fish/marine asset family** — Brief not yet started. Per WILDLIFE-ROADMAP.md, the brief is the immediate next step now that the marine experiment is closed.
- **PLANNED — Aerial wildlife persistence** — No `AerialLineageState`, no nesting, no metabolic cost, no persistence. Listed as planned experiment after marine abstraction settles.
- **PLANNED — Freshwater ecology** — Basin is habitat only. No ecological consumer defined.
- **PLANNED — Full cross-domain food web loop** — Runoff → coast → marine partially wired. Marine → aerial → land (guano) not persistent. `shorelineSubsidy` computed, nothing consumes it.
- **PLANNED — Cross-domain ancestry (land → water transition)** — `MarineLineageState.originDomain` and `ancestorLineageId` reserved in schema. No resolver logic triggers the transition.
- **PLANNED — Jump-transition visual treatment** — Morph animation or load-screen explicitly deferred in THESIS.md §2.1 and §8.
