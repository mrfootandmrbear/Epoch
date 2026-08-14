# Render system map

> **Status:** Durable technical reference for the landing-state renderer.
> **Updated:** 2026-08-13 after climate-atmosphere milestone implementation.
> **Written:** 2026-08-13, from a full code trace + a real-WebGPU capture pass in
> the browser pane (still frames at `time=42`; motion/fps not judged — see the
> pane caveat in `docs/polish/BACKLOG.md`).
> **Authority note:** This is a *rendering* map. Simulation authority lives in
> the `WorldHistory`/resolver modules and is never owned by a renderer. Where a
> renderer reads simulation state, it reads a **derived, immutable** snapshot or
> a packed texture — it does not mutate world state. Do not use this document to
> reclassify any owner verdict; `RENDERER-ROADMAP.md` and `WILDLIFE-ROADMAP.md`
> remain canonical for status.

## 1. Rendering architecture overview

Epoch renders one **landing state** — the resolved world on the far side of a
jump — as a single Three.js `Scene` drawn by a `WebGPURenderer` (TSL / node
materials) through one post-processing `RenderPipeline`. The scene is assembled
once per jump and then only animated: geometry and textures are rewritten inside
`landingState.advance()`, and the render loop in `src/main.ts:764` just evolves
the FFT ocean, the atmosphere, and the per-frame animation (herd steering, fish,
birds, caustic/foam clocks).

Two hard seams define the architecture:

- **Simulation → render is one-way.** `WorldHistory` (persistent) and the
  per-jump immutable `WorldSnapshot` (`src/world-snapshot.ts`) are resolved into
  a `LandingOutcome` (`src/outcome-resolver.ts`), which the renderers *sample*.
  Renderers hold no authority; instance counts are never simulation state.
- **The composition is unusually cheap.** A whole-island frame draws in **~15
  render calls** (verified live: `renderer.info.render.calls`). Nearly every
  layer is a single `InstancedMesh` or a single batched mesh. This is a genuine
  strength and the reason herd scale (96/lineage) and dense reef rubble (up to
  100 000 instances) cost draws in the low tens, not thousands.

### Frame production pipeline

```
WorldHistory (persistent: terrain, reef, lineages, volcanism, hotspots)
  → resolveVolcanicAccretion∘resolveTerrainHistory   (advance(): erosion + lava)
  → WorldSnapshot (immutable sample: heightAt, climate, forage, geology fields)
  → resolveLanding() → LandingOutcome                (trees, populations, fish,
        reef habitat, coastalAnimals, aerial, marineEnergy, freshwaterField)
  → landing-state.ts writes:
        · terrain geometry (PlaneGeometry Y + vertex colours)
        · 3 terrain DataTextures (state / volcanic / environment)
        · height + ocean-mask DataTextures
        · per-renderer instance buffers (trees, herds, fish, coral, rubble…)
  → per-frame update(): FFT compute, atmosphere state, herd/fish/bird animation,
        caustic + foam clocks
  → RenderPipeline: scenePass → grade(tint/sat/contrast) → bloom → [opt GTAO]
  → player-visible pixels
```

### Lighting model (the coherence backbone — read this)

All above-water opaque materials are `MeshStandard*` node materials, so they are
lit by **three shared scene lights** created in `src/main.ts:201-217`:

- `DirectionalLight` (the sun / antisolar moon) — the only shadow caster, one
  2048² map covering the island (`src/main.ts:204-212`).
- `AmbientLight` + `HemisphereLight` — sky fill.

`updateAtmosphere()` (`src/main.ts:228`) drives all three from
`sampleAtmosphere()` (`src/atmosphere.ts:111`) every frame: sun direction,
`sunColor`, `ambientColor`, intensities, `fogColor`, exposure. The ocean surface
and the submerged (reef/seabed) materials do **not** use these lights; they carry
their own analytic sun (`sunDir`/`sunColorNode` uniforms) fed the same state via
`oceanMesh.updateAtmosphere()` and `landingState.setAtmosphere()`
(`src/main.ts:249-253`). The scene lights (land) and analytic uniforms (water)
remain separate sinks, but both now receive one `ResolvedAtmosphere` from the
single `updateAtmosphere()` sync point.

The scene `fogNode` (`src/main.ts:141`) is exponential height fog, masked to
above-waterline only (`aboveWaterFog`) so it never double-fogs the submerged
volume. Fog density/ceiling come from `resolveHeightFog(committedClimate)`
(`src/atmosphere.ts:22`); its optical depth is composed with the same bounded
climate mood that supplies atmospheric colour and light.

## 2. State → pixel dependency map

| Layer | Authoritative state | Persists across jumps? | Transform → renderable | GPU expression | Cadence | Scale / LOD | Causally coupled to |
|---|---|---|---|---|---|---|---|
| Terrain geometry | `WorldHistory.terrain.elevations` | **Yes** (erosion accumulates) | `advance()` writes `PlaneGeometry` Y + vertex colour; `makeHeightTexture` | 1 mesh, `TerrainMaterial` (`terrain-material.ts`) | per jump / per sculpt | 380 m, 180² grid; no geometry LOD | drainage, volcanism, sea level |
| Terrain material | packed `state`/`volcanic`/`environment` DataTextures (`terrain-material-state.ts`, `environment.ts`) | derived each jump | `packTerrainMaterialState` + `packEnvironmentField` | `MeshStandardNodeMaterial` + shared water optics | per jump | fades by camera distance | climate, reef carbonate, caustics |
| Ocean surface | `FFTOcean` height/slope storage buffers (`fft-ocean.ts`) | no (regenerated per wind + fair/storm sea state, cached) | Tessendorf/JONSWAP GPU IFFT (58 compute passes/frame) | 1 `NodeMaterial` patch + 1 far-water skirt ring (`fft-water.ts`); slope-gated crest foam | per frame | 1400 m patch + 12 km skirt; wave/chop fade with distance | wind regime, presentation storm, sea level, terrain height texture |
| Submerged optics | `ReefWaterUniforms` (`reef-water.ts`) | no | shared `opticalPath`/`waterTransmission`/`waterHaze`/`causticLight` | reused by seabed, coral, fish, and seagrass materials | per frame (caustic clock) | extinction to ~26 m; caustics fade w/ depth | sun state, sea level |
| Coral / reef | `WorldHistory.reef` + `ReefOutcome.colonies` (`reef-succession.ts`) | **Yes** (framework, cover, stress) | `resolveReef` → `reef.setReef()` | 6 guilds × near/far `InstancedMesh` (`coral-renderer.ts`), `CoralMaterial` SSS + fluorescence | per jump; sway per frame | `coralNear` 46 m | currents, carbonate deposition, sediment |
| Reef rubble / carbonate floor | `terrain.carbonate`/`basalt`/`sediment` | **Yes** | `terrain-detail-renderer.ts` (independent of colony positions) | 1 `InstancedMesh`, ≤100 000 icosahedra | per jump | none (frustumCulled off) | reef deposition, depth |
| Vegetation | `LandingOutcome.trees` (`VegetationMorphology`) | no (re-resolved) | `vegetation-renderer.ts` near/far repartition | up to 4 guild × {branch,leaf} × {near,far} `InstancedMesh` (ez-tree geometry) | per jump; LOD on camera move | `treeNear` 92 m | moisture, exposure, slope, temperature, wind, sea level |
| Seagrass | `LandingOutcome.seagrass` | no | `seagrass-renderer.ts` | instanced, per-tuft sway | per jump; sway per frame | `seagrassNear` 72 m | shallow productivity |
| Terrestrial herds | `PopulationOutcome` (traits/site/abundance) | **Yes** (lineage means, not variance) | `advance()` seats instances; `expressionSample` | 1 `InstancedMesh`/lineage, morph-target expression spike (`creature-expression-spike.ts`), coat material | per jump; steer + pose per frame | pose LOD 130/300 m; **no geometry LOD** (protects 1 draw) | forage, habitat, walkability |
| Fish | `MarinePopulationOutcome` + `coastalAnimals` | **Yes** (marine lineage) | `fish-renderer.ts` | 1 instanced topology, tail swim | per jump; swim per frame | — | coastal productivity, water band, temperature |
| Aerial birds | `AerialPopulationOutcome` (position/radius/visible **only**) | **No — stateless** | `addAerialAnimals` (`landing-state.ts:414`) | 12 primitive `Group`s (sphere + 2 cones), flat white | regenerated every jump | none | nesting + lift + marine abundance |
| Freshwater basins | `FreshwaterField.basins` | derived | `freshwater-renderer.ts` (flat surface) | triangulated surface | per jump | — | drainage, rainfall, sea level |
| Streams / cascades | `resolveStreamSegments` (`stream-network.ts`) | derived from terrain | `stream-renderer.ts` (ribbons) + `cascade-renderer.ts` (fall reaches + plunge pools) | draped `MeshStandardNodeMaterial` ribbons | per jump; flow clock per frame | — | discharge, slope, sea level |
| Distant drifter | founder lineage `founder` | event, not landing | `distant-drifter-renderer.ts` (raft) | small group at world edge | on arrival | — | player choice |
| Atmosphere / sky | `ResolvedAtmosphere` (`atmosphere.ts`) | no | time profile × bounded `ClimateMood`; `atmosphere-renderer.ts` world-space sky node | `scene.backgroundNode`; scene lights; fog node | per frame | infinite | committed climate + time |
| Post-processing | `COLOR_TREATMENTS[profile]` (`post-processing.ts`) | no | grade → bloom → opt GTAO | 1 `RenderPipeline` | per frame | full res; GTAO opt full-res | atmosphere profile (day/dawn/storm) |

## 3. Texture / buffer / geometry / material ownership

- **Terrain DataTextures** (all `FloatType`, 181² = `TERRAIN_SIDE`), created in
  `landing-state.ts:135-193`, packed in `syncTerrainMaterialState()`:
  - `terrainStateTexture` RGBA = disturbance / vegetationProtection / runoff / forage.
  - `volcanicTexture` RGBA = basalt / ash / carbonate / substrateAge.
  - `environmentTexture` RGBA = localMoisture / localExposure / sediment / frost
    (from `resolveEnvironmentField`, **not serialized**).
  - `terrainHeightTexture` (R) + `oceanMaskTexture` (R) — consumed by the ocean
    surface for depth read-through and land/enclosed-basin masking.
- **FFT storage buffers** (`fft-ocean.ts`): `heightBuffer`, `slopeXBuffer`,
  `slopeZBuffer` (`instancedArray`), plus spectrum/scratch buffers. One
  `FFTOcean` + mesh is **cached per `WindRegime`** in `main.ts` `oceanCache`.
- **Shared submerged uniforms** (`createReefWaterUniforms`): `seaLevel`, `time`,
  `hazeColor`, `causticStrength` — one set per scene, handed to the terrain
  material **and** the coral material so the seabed and the colonies on it cannot
  disagree about the water between them and the eye.
- **Instanced geometry:** ez-tree build-time JSON (`tree-geometry-assets.ts`),
  seagrass JSON, coral colony LODs (`coral-geometry-assets.ts`), creature morph
  mesh (`creature-expression-spike.ts` — per-instance weights in
  `InstancedMesh.morphTexture` `DataTexture`, morph verts in a `DataArrayTexture`).
- **Shadows:** one `DirectionalLight.shadow` 2048² ortho box (±245 m) covering
  the whole island. `terrain`, trees, herds, rubble all cast+receive. Ocean and
  submerged materials neither cast nor receive (they self-shade analytically).
- **Post:** `scenePass` → tint×saturation×contrast grade → `bloom(0.12,0.18,1.35)`
  half-res → optional full-res GTAO. Enabled unless `?post=0`; GTAO only `?gtao=1`.

## 4. Update cadence & LOD boundaries

- **Per jump (`advance()`):** terrain geometry+colour, all 3 packed textures,
  reef, trees, seagrass, herd seating + expression, fish, birds, freshwater.
- **Per frame (`update()` / render loop):** FFT compute (`fftOcean.update`),
  atmosphere + lights + fog + exposure, herd steering & pose morph (budgeted:
  `PATHS_PER_FRAME=3`), fish swim, bird orbit, caustic/foam/sway clocks, marine
  snow, presentation camera.
- **LOD** (`render-scale.ts`): trees near/far swap at 92 m; seagrass 72 m; coral
  46 m; creature **pose sampling** (not geometry) every frame <130 m, every 3rd
  <300 m, frozen beyond; creature coat frequencies fade by distance in-shader.
  Terrain and ocean have **no discrete geometry LOD** — the ocean fades wave
  detail continuously; terrain relies on shader-distance fades only.

## 5. Cross-layer dependencies & hidden coupling

- **Two lighting sinks, one resolved state** (§1). `updateAtmosphere()` computes
  one `ResolvedAtmosphere` and fans it out to scene lights, ocean uniforms, reef
  sun uniforms, fog, sky, and grading. New atmosphere fields must still be
  routed at this sync point so no sink silently misses them.
- **Sea level is triplicated** and must agree: `climate.SEA_LEVEL[regime]` →
  terrain material (`setSeaLevel`), ocean mesh `position.y`, reef water uniform,
  fog `fogSeaLevel`, and the ocean-mask flood-fill in `syncShoreSurface`.
- **Terrain height texture is deliberately sunk at the domain edge**
  (`syncShoreSurface`, `landing-state.ts:753`) so the finite 380 m sim square
  never shows an edge under the 1400 m ocean patch + 12 km skirt.
- **Reef "first landing" is seeded from substrate age**, not succession
  (`refreshReef`, `landing-state.ts:655-675`): with no inherited sites the reef
  is built from how long the rock has been submerged, so a **1-year jump can land
  a fully mature-looking reef** (see §7).
- **Caustics/haze/extinction are one shared module** (`reef-water.ts`) used by
  both seabed and coral — this is why the underwater view coheres (see §7).

## 6. Render-facing simulation fields with **no visible expression**

(Cross-checked against `docs/SIM-RENDER-AUDIT.md`; several audit rows are now
stale — noted in §9.)

- `terrain.nutrients` — drives tree suitability; never packed to a texture. Rich
  and depleted ground look identical.
- `terrain.volcanicLoad` — drives subsidence; no visual cue for lithospheric load.
- `FreshwaterField.depth` — computed per cell; renderer reads only surface
  elevation, so shallow and deep pools look identical.
- `MarineEnergyExchange.shorelineSubsidy` — computed; **nothing consumes it** on
  either sim or render side.
- **Land lineage `energy`** — a starving herd shows fewer instances (abundance)
  but no condition/posture/colour cue.
- Terrestrial `feedingAdaptation` — computed in the founder resolver, absent from
  `PopulationTraits`, no visual.
- **Within-population trait variance** — sim stores means only; per-individual
  differences are stable renderer sampling, not inherited state (by design).
- **Aerial lineage** — no persistent species/traits; 12 identical primitive birds
  regenerated each jump.

## 7. What is already unusually successful (do not casually "improve")

- **The far-water horizon.** The 12 km skirt + world-anchored wave retirement +
  aerial-perspective fade (`fft-water.ts`) fully solved the Phase 0
  "finite plane with hard edges." Owner-accepted 2026-08-13. **Protected.**
- **The underwater reef composition.** The shared water-optics medium
  (`reef-water.ts`) + coral SSS/fluorescence (`coral-material.ts`) makes seabed,
  rubble, and every colony read as one submerged world. This is the game's
  clearest example of a *coherent* scene — and it coheres **because** one
  atmospheric medium contains every element. Owner-accepted 2026-08-13.
- **Draw-call discipline (~15).** Everything instanced/batched. Verified live at
  15 draws across `whole-island` (year 1), `whole-island&fixture=warm-arid-volcanic`,
  and `reef-above&fixture=mature-warm-reef`; `LOG.md` independently records 15 at
  `reef&mature-warm-reef` and at the contrast-herd frame (192 animals). Any new
  layer must respect this; adding a per-object draw path is the wrong move.
- **The FFT ocean is a real spectral synthesis** (Tessendorf/JONSWAP GPU IFFT),
  not a sum-of-sines — capable of a rough sea; only the inputs damp it (§8, LW-7).
- **Cross-population herd divergence** (nimble vs bulky) reads clearly at
  `coat-detail&herd=contrast`. Confirmed strength; do not regress it.

## 8. Known visual effects that lack simulation causality / are input-limited

- **Storm remains presentation state rather than climate state.** The storm
  profile now raises the FFT input to at least 32 m/s, increases swell/chop,
  and enables moving slope-gated crest foam. `ClimateForces.wind` still has no
  storm tier, so a player cannot yet commit storm seas as a simulated force.
- **Climate now reaches the air through one bounded mood.** `climateMood()` and
  `resolveAtmosphere()` modulate the shared key/fill, sky/fog, ocean base colour
  and distance fade, and post grade. Mild-temperate remains the exact baseline;
  the other foundations derive their mood from committed climate forces.
- **Per-profile grading is a near-noop** (`COLOR_TREATMENTS`): dawn ≈ +4.5% warm
  tint, storm ≈ +6% cool / −10% saturation. Below perceptual threshold at
  whole-island scale (LW-6).
- **Freshwater remains outside the reef medium by design.** Fish and seagrass
  now share the same `ReefWaterUniforms` as seabed, coral, and marine snow.
  Freshwater, streams, and drifters remain separate surface-water/land layers.

## 9. Documentation vs. code contradictions (flag, don't silently pick a side)

1. **Test counts are stale.** `CLAUDE.md`, `docs/polish/MAP.md:21`,
   `BASELINE.md` say "28 files / 94 tests". Actual: **47 files / 243 tests pass**
   (verified). `landing-state.ts` is 1324 lines (MAP says 896);
   `outcome-resolver.ts` is 831 (MAP says 799).
2. **Deep-time rungs — roadmap vs runtime.** `RENDERER-ROADMAP.md:24` says "the
   four rungs are now visually distinguishable." Live captures show 1 k / 100 k /
   1 M are **near-indistinguishable at whole-island scale**; only year-1 is
   clearly distinct. The row is still **Candidate** awaiting owner verdict and
   `BASELINE.md` already flags this, so it is *input to the gate*, not an accepted
   claim being contradicted. The automated floor (`epoch-scale-terrain.test.ts`)
   only checks 1 yr stability + 1 M broad-change/area-loss; it does **not** test
   that the middle rungs differ.
3. **`SIM-RENDER-AUDIT.md` is stale on two rows** (it predates WU-004 same day):
   it lists waterfalls as "layer does not exist" and insulation/trait-LOD as
   "PLANNED — no fur/shell/distance-scaled expression." Both now exist
   (`cascade-renderer.ts`; `creature-material.ts` coat + `creaturePoseInterval`
   LOD), tracked **Experimenting** in `RENDERER-ROADMAP.md`. The richer INLAND
   waterfall (spray/mist/plunge column) is still absent.
4. **`DOC-ALIGNMENT-PLAN.md:16` quotes an old THESIS §6** ("Foxel … glTF skeleton
   proportions"). THESIS.md:84 has since been updated to the topology-stable
   morph-target / `InstancedMesh` framing. Historical, not a live conflict.

## 10. Do-not-accidentally-break list

- The **accepted far-water horizon** and **sky/solar-arc composition** (owner
  verdict 2026-08-13). Any atmosphere change must preserve the default
  temperate/day look these were judged on.
- The **accepted underwater reef** (`reef-water.ts` extinction ratios +
  `coral-material.ts`). Do not "correct" `EXTINCTION` to physical values — the
  gentle red rate is a deliberate legibility trade (documented in the module).
- **One `InstancedMesh` per herd lineage** — never split geometry by LOD; the
  15-draw evidence depends on it.
- **The two-authority lighting sync** (scene lights ↔ ocean/reef uniforms):
  update all sinks together.
- **Sea-level triplication** must stay consistent across terrain / ocean / reef /
  fog / ocean-mask.
- **Capture determinism:** seed `0xe90c4`, frozen `time`, forced `day` profile,
  fixed cameras in `presentation.ts` `GOLDEN_SHOTS` — add fixtures, never edit
  existing golden entries (they are the comparison basis for all prior evidence).
