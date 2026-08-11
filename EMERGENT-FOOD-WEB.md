# Emergent Food Web — Design Brief for Implementation

> **Status note (2026-08-11):** This document preserves the original proposal and rationale. Steps 2 and 5 have substantially landed through persistent forage, forage-aware site scoring, grazing pressure, regrowth, lineage energy, abundance, and starvation. Use [WILDLIFE-ROADMAP.md](WILDLIFE-ROADMAP.md) for canonical status and current sequencing, including marine animals and coral.

Animals should follow food sources. This creates emergent gameplay: complex, unscripted outcomes from simple rules interacting. The core idea is that every ecosystem layer (land, sea, air) references the others through food and habitat, forming feedback loops the player never directly controls but can influence through terrain sculpting and climate.

## The feedback loop

```
terrain/climate → vegetation grows
vegetation → grazers eat it (depletes forage)
grazing + vegetation → nutrient runoff to coast
coastal nutrients → coastal productivity → swimmers feed
swimmers (food) + land (nesting) → birds
birds (guano) → enriches soil → vegetation
                    ↓
              player sculpts terrain → changes drainage/moisture → shifts everything
```

No single system is the engine — the whole island is.

## Implementation steps (recommended order)

### Step 1: Bias real-time grazer wandering toward vegetation

**Where:** `landing-state.ts` lines 577-593, inside the `update()` closure where grazers pick a new destination.

**Current behavior:** Random angle, random radius (18-53 units), check walkability, go.

**New behavior:** Sample several candidate destinations (the retry loop already tries up to 10). Score each by proximity to trees in `currentOutcome.trees`. Pick the highest-scoring walkable candidate, with some noise so movement isn't robotic. The trees array is already available in the `update` closure.

**Why first:** Smallest change, most visible result. Grazers drift toward tree clusters instead of wandering aimlessly. Proves the concept. Only touches destination-picking — pathfinding, herd cohesion, herd separation all untouched.

**What it looks like:** Sheltered grazers in a moist valley with broadleaf trees stay in the valley. Ridge grazers on exposed slopes near windswept trees stay up there. Two herds, two habitats, no scripting.

### Step 2: Epoch-scale site scoring includes vegetation density

**Where:** `outcome-resolver.ts`, `siteScore()` at line 194, and `migratedSite()` / `foundingSite()`.

**Current behavior:** `siteScore` uses abstract niche weights (moisture, drainage, slope, exposure). Vegetation isn't referenced.

**New behavior:** When scoring candidate sites, also count nearby trees (or estimate vegetation density from ecosystem samples). This doesn't replace niche scoring — it adds a food-availability signal on top.

**Effect:** Climate shifts that kill vegetation in one area and grow it in another pull whole populations across the map over geological time. Player sculpting that changes moisture/drainage shifts vegetation, which shifts grazer migration targets.

### Step 3: Coastal productivity linked to land vegetation

**Where:** `sampleEcosystem()` in `outcome-resolver.ts` line 153, specifically the `coastalProductivity` calculation.

**Current behavior:** `coastalProductivity` depends on shallow water depth, rainfall, and exposure. Purely terrain/climate driven.

**New behavior:** Factor in vegetation density on the adjacent land. Coastal areas near lush vegetation get higher productivity (nutrient runoff, root systems, leaf litter). Overgrazing near shore reduces coastal productivity.

**Effect:** Swimmers redistribute around the island based on what's happening on land. Grazers overgraze the north shore → productivity drops → swimmers move to the south coast. Land ecosystem affects sea ecosystem without any direct coupling between grazers and swimmers.

### Step 4: Birds follow swimmers AND need land nesting

**Where:** `resolveLanding()` in `outcome-resolver.ts`, the aerial scoring loop around line 436.

**Current behavior:** All 12 birds orbit one optimal point based on nesting + lift + nearby coastal productivity. Single flock, single location.

**New behavior:** Birds need both nesting sites (high elevation, some vegetation shelter) and food (proximity to productive coast with swimmers). The best bird habitat is where good nesting overlaps with good fishing. This creates tension — the best ridge might be far from the best coast.

**Effect:** When swimmers move because land grazing changed runoff, birds follow their food source — pulling them away from nesting. Nesting quality drops, bird population declines, less guano enriches the land, vegetation suffers. You never script "population decline" — it emerges from the food web.

### Step 5: Grazing depletion and regrowth

**Where:** New per-cell data layer in terrain history (like `disturbance` or `vegetationProtection` in `terrain-history.ts`), plus modifications to vegetation placement in `resolveLanding()`.

**New behavior:** A "forage" layer (Float32Array, same grid as terrain) tracks vegetation health per cell. Grazers reduce forage near them over time. Forage regrows slowly when ungrazed. Vegetation placement and density reference the forage layer.

**Effect:** This is the big one — creates boom-bust cycles. Lush area attracts grazers → overgrazing → vegetation crashes → grazers forced to migrate → vegetation recovers → cycle repeats. Also creates visible trail formation (grass shorter where grazers walk most). Biggest implementation lift of all the steps.

### Step 6 (optional): Freshwater pools as nutrient transport

**Where:** Freshwater pool placement in `resolveLanding()` and its influence on `coastalProductivity`.

**Current behavior:** Pools are decorative, placed by drainage score.

**New behavior:** Pools represent water collection points. Their nutrient content depends on vegetation health of the surrounding land. Pool nutrients flow to the coast, affecting coastal productivity. This is the mechanism by which inland grazing affects the coast 50+ units away.

## World size recommendation

**Current:** 380x380 terrain, ~250 usable land diameter, ~33k vertices.

**Problem:** At 250 units across with herds that wander 50 units per journey, a herd samples most of the island in 3-4 walks. Not enough spatial "neighborhoods" for food-following to produce visible, sustained migration patterns.

**Recommendation:** Grow to ~500-520 units.

- ~350 usable land diameter — roughly 12 herd-widths across
- Room for 4-5 distinct vegetation zones grazers can move between
- Enough coastline for swimmer distribution to be readable
- Birds get meaningful range between nesting and fishing grounds
- At 240 segments: ~58k vertices — still fine for WebGPU
- Navigation grid cells stay at 6 units, no pathfinding changes needed

**Ceiling:** 500 is probably the max before you'd need a zoom-to-region camera system. The player needs to see the whole island to connect "vegetation died over there → grazers moved here → coast changed."

**Population scaling:** Larger world needs slightly larger herds (10-12 instead of 7) so the island doesn't feel empty. Consider more swimmers (15 instead of 10) and birds (16-18 instead of 12) to fill the larger coastline and airspace.

**Constants to change:**
- `TERRAIN_SIZE` in `landing-state.ts` (380 → ~500)
- `TERRAIN_SEGMENTS` (180 → ~240, keeping cell size similar)
- Herd count in `addEvolvedHerds` (7 → 10-12)
- `LIMIT` in `animal-navigation.ts` (150 → ~210)
- Sampling counts in `foundingSite`/`migratedSite` may need slight increases for the larger search space
- Coastal animal count (10 → 15), aerial count (12 → 16-18)
- Camera position/distance in `main.ts` to frame the larger island

## Key architectural principle

Give every ecosystem layer a "productivity" or "forage" value that other layers can read. When adding coastal and aerial food connections, each one is just a new consumer of an existing signal — not a new system. The data flow is:

```
terrain grid (elevations, disturbance, forage) 
    → sampleEcosystem() reads it all
    → every animal system scores from ecosystem samples
    → animal behavior writes back to forage layer
    → next tick, ecosystem samples reflect the change
```

This keeps the coupling loose. Each animal system only knows about ecosystem samples, not about other animal systems directly. Emergence comes from them all reading and writing the same shared terrain state.
