# Environment foundation

> Status: owner-accepted technical foundation, realigned 2026-08-14. Preserve
> its evidence, but the nine broad climate identities are no longer product
> destinations. They are migration/test inputs while the same continuous fields
> are reinterpreted for the Galápagos regional system in
> `docs/GALAPAGOS-HOTSPOT-PLAN.md`.

## State model

The current implementation still exposes four global jump forces, and rainfall
× temperature defines nine diagnostic foundation identities:

| | Arid | Temperate | Wet |
|---|---|---|---|
| Cold | cold-arid | cold-temperate | cold-wet |
| Mild | mild-arid | mild-temperate | mild-wet |
| Warm | warm-arid | warm-temperate | warm-wet |

Wind direction/exposure and sea level modify those foundations spatially. Terrain elevation, slope, aspect, drainage, runoff, substrate age, disturbance, volcanism, sediment, and succession resolve local continuous fields. A small habitat vocabulary labels useful combinations without becoming simulation authority: exposed rock, dry ground, mesic ground, wet ground, frost ground, freshwater margin, intertidal, shallow shelf, reef shelf, and deep benthic.

These identities now describe existing coverage, not the future control scheme.
The Galápagos migration retains the continuous-field architecture while
replacing broad climate selection with regional trade winds, rainfall/garúa,
elevation, upwelling, sea-level history, and shield age.

`TerrainHistory` owns inherited geology and ecological deposits: elevation, disturbance, vegetation protection, forage, nutrients, runoff, basalt, ash, volcanic load, years since resurfacing, substrate maturity, soil development, sediment, and carbonate. Wet extinct lava weathers and develops soil on century-to-millennial rungs; arid lava remains visibly and ecologically young for much longer. Active construction resolves after inherited weathering so the landing retains recent flows. `EnvironmentField` is derived per landing and is not serialized. Material palette mixing, procedural detail, water optics, fog, and LOD remain rendering state.

Before the first jump, `createInitialWorldState` creates a year-zero geological world with the authored elevation, mature non-volcanic substrate, low background sediment, empty runoff/carbonate/reef histories, no terrestrial founders, and the default climate as the pending force. The first jump is tested separately from that state.

## Reef and substrate interaction

Reef sites persist living cover, framework, dead framework, pioneer cover, stress, and composition. Warm, lit, low-sediment sites accumulate framework. Framework and skeletal debris deposit persistent carbonate into nearby terrain cells. Fresh basalt resets substrate maturity and removes carbonate; runoff-derived sediment suppresses reef suitability and gradually buries carbonate. Carbonate affects the seabed material only after it exists in terrain history—the renderer no longer invents it from colony proximity.

## Deterministic review fixtures

All use `time=42`. The accepted horizon regression remains `?shot=whole-island&years=10000&time=42`.

| Fixture | Above-water URL | Underwater URL |
|---|---|---|
| cold + arid + exposed + low sea | `?shot=whole-island&fixture=cold-arid-exposed-low&time=42` | — |
| mild + temperate + exposed + present sea | `?shot=whole-island&fixture=mild-temperate-exposed-present&time=42` | — |
| warm + wet + calm + high sea | `?shot=whole-island&fixture=warm-wet-calm-high&time=42` | — |
| warm + arid volcanic island | `?shot=whole-island&fixture=warm-arid-volcanic&time=42` | — |
| mature warm reef, carbonate shelf, exposed basalt | `?shot=reef-above&fixture=mature-warm-reef&time=42` | `?shot=reef&fixture=mature-warm-reef&time=42` |

The mature-reef fixture places its active vent at `(60, 70)`, on the inner edge of the reviewed shelf rather than at the world origin. Its basalt apron enters both cameras while the outer reef remains beyond the main shield radius.

## Migration and approximations

`WorldHistory` schema version is 7. Version 6 has no substrate-age, sediment, or carbonate arrays. No persisted-save loader exists yet, so validation intentionally rejects version 6 instead of fabricating history. A future loader should seed substrate age from world age and basalt, seed low mineral sediment from runoff/disturbance, and initialize carbonate to zero unless reef history can reconstruct a conservative deposit.

Current approximations are intentionally coarse: rainfall supplies runoff without an explicit evapotranspiration balance; sediment is a normalized stock rather than grain-size classes; frost potential is rendered as bounded ground cover rather than persistent snowpack/glacier flow; habitat labels are diagnostic categories over continuous fields; calm water retains a residual directional current for reef circulation; carbonate deposition expands radially around sampled reef sites rather than being advected as particles.

The accepted sky/water baseline already included the submerged fog mask, double-sided underwater surface, revised reef haze, and associated water palette edits present in the working tree when this environment pass began. This pass preserves those owner-owned edits and verifies its canonical `whole-island` fixture against that accepted working-tree baseline; it does not claim those changes as new environment work.

## Owner verdict boundaries

- Preserve the accepted sky, solar arc, horizon haze, and water continuity.
- Judge whether the five fixtures make climate and sea-level differences coherent without looking decoratively recolored.
- Judge whether paired reef views show persistent carbonate shelf, exposed basalt, living framework, and sediment pressure as one environment.
- The owner accepted the current foundation and paired `epoch-reef-builder-family` integration on 2026-08-13 as passing for future iteration. Preserve the evidence; future major visual changes require a new verdict.
