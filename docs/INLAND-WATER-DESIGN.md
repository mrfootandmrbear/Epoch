# Inland Water — Open Design Notes

## Status
Open extension — not yet implemented as a complete inland-water system. Epoch already computes runoff, resolves downhill stream segments, renders bounded stream ribbons, and derives freshwater basins. These notes define the next contract: persistent/readable channels, steep-drop transitions, plunge pools, and the river-to-brackish-to-ocean seam.

## Visual Requirements
Inland water is a first-class visual feature. Waterfalls are part of the core visual concept. Rivers, plunge pools, and the brackish transition zone at river mouths must be visible — not just sim abstractions.

## Sim Responsibilities

- **Runoff and flow accumulation extension**: build on the existing terrain-history runoff field after volcanism and erosion rather than introducing a parallel hydrology authority. Determine whether the current discharge signal is sufficient or needs persistent accumulated flow.
- **Stable channel extraction**: extend the existing downhill stream-segment resolver into ordered, stable paths from source to coast. These paths are what the render layer consumes to build connected river meshes.
- **Waterfall detection**: cells where flow accumulation exceeds a threshold AND terrain slope exceeds a threshold (cliff faces, caldera rims, lava shelf edges). Volcanic island terrain produces these naturally.
- **Water body tagging**: cells classified as river, wetland, plunge pool, brackish, or arid — used for biome assignment, creature habitat logic, and vegetation placement.
- **Brackish zone tagging**: cells in the river-mouth mixing zone get their own biome tag, distinct from river and ocean. This zone supports mangrove habitat.

This sim work extends the current terrain-history and stream-resolution path. Volcanism remains one input to the authoritative heightfield; inland water must not become a second terrain or hydrology simulation.

## Render Responsibilities

### 1. River Channel Mesh
- Geometry built from sim-exported channel paths (spline or polyline mesh along cell sequence)
- Flow-map shader: directional UV scroll, foam at turbulence points, transparency at shallow edges
- Much cheaper than FFT; appropriate for bounded channels with directional flow
- Does not reuse fft-ocean.ts approach

### 2. Waterfall Face
See detailed rendering notes below. At minimum: coherent stream geometry, impact zone disturbance, spray that originates visibly from the impact point.

### 3. Plunge Pool
- Flat water plane at base of waterfall
- Radial ripple shader + foam ring
- Transitions to river channel mesh downstream
- At low elevation, must seam cleanly with the coastal ocean shader (fft-water.ts)

### 4. Brackish Transition Zone — Mangrove Habitat
The zone where river channels meet the ocean is a brackish mixing environment — neither freshwater nor marine. This is the primary mangrove biome.

**Render challenges:**
- Mangrove root systems straddle the waterline: prop roots visible above the surface, submerged below
- Tidal fluctuation means the waterline rises and falls — roots must work at multiple water heights
- The ocean seam problem is most critical here: the river flow shader, the brackish pool, and the FFT ocean must all meet at this zone without visible discontinuity
- Sediment-laden water from the river changes visual appearance of the coastal water near the mouth

**Sim tagging:** brackish cells form a gradient band between the last river-tagged cells and the first ocean cells. Width of this band can be proportional to river flow accumulation.

## Waterfall Rendering — Detailed Notes

For Epoch's reveal moments (a river that wasn't there before, one flowing faster after a million years of erosion), waterfalls are *change made visible*. Priority effects are: coherent stream, impact zone disturbance, and spray that visibly originates from the impact point. Sediment visibility is high-value — a reddish fall after volcanic ash, clear after heavy rain — makes evolutionary time visible without narration.

### Volumetric Effects
- **Mist generation**: whether spray and fog materialize around falling water or it's just a ribbon in air. Particle-based or volumetric shader work.
- **God rays (crepuscular rays)**: lighting beams shafting through mist spray. Incredibly atmospheric; expensive. Defer.
- **Water-lit mist**: spray absorbs and scatters light color from the water itself, not just white fog.
- **Depth fog interaction**: whether mist is genuinely volumetric or a flat haze that doesn't respect terrain/depth.

### Flow Behavior
- **Coherent stream**: falling water maintains a visible column with surface tension detail — not instantly dispersed into particles. Critical for readability.
- **Shear instability**: stream breaks into threads and droplets realistically as air resistance takes effect (Rayleigh-Plateau instability).
- **Spray scatter**: cone of mist radiating outward at impact — tight cone for high-velocity narrow falls, wider cone for low-velocity wide cascades.
- **Backflow**: water bounces and flows back slightly where the fall hits the pool, rather than just disappearing into impact effects.

### Impact Zone Rendering
- **Splashing detail**: individual splash arcs and droplets, not just foam.
- **Water surface disturbance**: falling water actually deforms the pool surface instead of a texture sitting on top.
- **Foam persistence**: dissipates quickly for fresh water, lingers for sediment-heavy flows.
- **Rock spray**: water interacts with protruding geometry mid-fall, not just falling straight down.

### Material Realism
- **Transparency variation**: water near the fall edge is opaque (aerated), core is transparent, edges colored by depth and light.
- **Sediment visibility**: heavy falls carry visible silt or sand, darkening the water column. Especially relevant post-volcanic-event — reddish-brown falls after ash, clearing after sustained rain.
- **Spray opacity gradation**: spray is densest near the base and fades with distance.
- **Reflected light**: water column glows slightly from reflected sky — not a dark silhouette.

### Geometric Credibility
- **Stream taper**: water column narrows as it falls (acceleration + air resistance).
- **Debris carriage**: leaves, branches, or sediment tumble visibly in the falling water.
- **Angled falls**: non-vertical streams bend; impact angle changes spray direction.
- **Pool edge compliance**: water flows out where topography permits, not uniformly overflowing.

### Sound-Sight Sync
- **Spray intensity matching**: visual mist density correlates with audio roar intensity.
- **Impact timing**: splashes and splash sounds sync with visual disturbance.
- **Mist-source coherence**: mist visibly originates from the impact zone, not floating mysteriously above the water.

## Open Decisions

1. **Waterfall face technique**: particles vs. geometry with alpha mask vs. distortion shader
2. **Channel path format**: how the sim exports stable paths to the render layer (typed array of cell indices? world-space spline control points?)
3. **Ocean seam at river mouth**: how the plunge pool / river channel transitions to the FFT ocean at the coastline — most critical at the brackish/mangrove zone where three water systems meet
4. **Brackish shader**: does the brackish zone get its own blend between river flow-map and FFT ocean, or is it handled by a hard cutoff?
5. **Update frequency and persistence**: resolve channels on jump/terrain-history cadence, not per frame; determine what identity must persist so small terrain changes do not make rivers flicker between unrelated paths
6. **LOD**: at what camera distance do waterfalls switch to a simpler representation?
7. **God rays / volumetric mist**: defer until core waterfall is working — high atmospheric value, high cost

## Relationship to Other Systems

- **volcanism.ts**: provides the heightfield flow accumulation runs on; waterfall locations are determined by volcanism output
- **fft-ocean.ts / fft-water.ts**: river mouth and brackish zone must seam with coastal ocean; two (possibly three) separate water shaders meeting at shoreline
- **Creature system / morph targets**: riparian and brackish biome cells determine where grazers and shore-adapted creatures congregate; drinking/wading behavior is a future behavior node
- **WILDLIFE-ROADMAP.md**: inland water biome affects habitat availability for terrestrial lineages; brackish zone enables a distinct coastal/mangrove lineage
