# Renderer roadmap

> **Status:** Canonical landing-state rendering tracker.
> **Updated:** 2026-08-11.
> **Scope:** The visual proof required by `THESIS.md` §5–6: deep-time legibility, atmosphere, terrain, water, lighting, shadows, grading, and landing-state scale.

`THESIS.md` defines the bar; this page records what has actually cleared it. A renderer capability is not **Built** until automated checks pass and an owner visual verdict is recorded against the fixed capture set.

## Epoch-scale milestone

The canonical comparison uses one generated island, the `whole-island` camera, default climate, capture time `42`, and four independent landings:

| Jump | Capture URL | Required reading |
|---:|---|---|
| 1 year | `?shot=whole-island&years=1&time=42` | Baseline landform; pioneer succession only. |
| 1,000 years | `?shot=whole-island&years=1000&time=42` | Mature succession without deep-time coastal retreat. |
| 100,000 years | `?shot=whole-island&years=100000&time=42` | Landscape-scale weathering and visible shoreline loss. |
| 1,000,000 years | `?shot=whole-island&years=1000000&time=42` | Strongest bounded incision/retreat and a visibly inherited living world. |

Automated floor: `src/epoch-scale-terrain.test.ts` requires the one-year visible terrain to remain stable and the million-year terrain to change broadly while losing land area. This protects legibility; it does not substitute for the owner verdict.

Volcanic comparison uses the same camera and time with `&volcano=active` or another output rung. `?shot=whole-island&years=1000&time=42&volcano=active` is a construction diagnostic. An extinct single-jump URL is not a decline proof because it has no inherited volcanic load; a serialized multi-jump life-cycle capture is required before an owner verdict.

**Current verdict:** **Candidate**. The four rungs are now visually distinguishable and the upper ladder changes coastline geometry. Owner review is still required before calling the §5 milestone accepted.

## Capability ledger

| Area | Status | Present evidence | Next gate |
|---|---|---|---|
| Deep-time landform | **Candidate** | One-pass weathering, drainage incision, and coastal retreat; four-rung fixed captures; numeric regression test. | Owner verdict on magnitude and plausibility. |
| Volcanic island history | **Experimenting** | A fixed player-placed hot spot accretes a bounded shield before erosion; vigorous/active/waning/extinct output is persistent, deterministic downhill flows resurface capped terrain, basalt and ash alter the terrain surface and ecology, bathymetry reaches −55 m, and retained volcanic load drives deep-time subsidence after extinction. | Capture the same vent as seamount, breached shield, carved island, and drowned remnant; tune life-cycle pacing and flow silhouettes from those frames. |
| Atmosphere | **Experimenting** | Stable world-space sky and solar disc; climate-driven exponential height fog makes wet/cold/calm lowlands visibly hazier while arid/windy/warm climates clear, with bounded ridge contrast. | Judge fixed arid/day, wet/dawn, and cold/calm frames; add clouds only after the lower atmosphere passes. |
| Terrain shading | **Experimenting** | Height, climate, disturbance, slope, vegetation protection, runoff, and forage drive distinct ground regimes plus filtered MaterialX Perlin detail normals. Simulation elevation remains separate from cosmetic shading. | Tune regime strength from herd/forest/whole-island captures, then record the owner verdict. |
| Ocean surface | **Experimenting** | Tessendorf/JONSWAP FFT with restrained broad swell, subtle multi-directional chop and horizontal crest displacement, Fresnel, analytic sky reflection, shallow transmission, and shoreline foam. | Add crest/Jacobian foam and verify motion plus shallow/deep transitions. |
| Shadows | **Experimenting** | One broad 2048² island solar map keeps direct-light shadowing consistent across the authored terrain. | Verify island/shoreline/forest cameras and record the owner verdict; revisit true cascades only if close-range resolution requires them. |
| Inland water and ice | **Experimenting** | Runoff remains explicit; deterministic downhill tracing now feeds a separate animated stream/creek ribbon renderer alongside freshwater basins. Terrain geometry remains authoritative and uncontaminated. | Validate channel placement and motion, then add waterfall transitions and climate-driven snowfield/glacier surfaces. |
| Post-processing | **Built** as a bounded layer | TSL grading and restrained bloom; optional full-resolution GTAO evaluation path. | Revisit only alongside accepted materials and lighting. |
| Creature embodiment | **Planned** | Primitive semantic trait adapter only. | Accepted rigged/animated fauna family with readable extremes at gameplay distance. |

## Planned sequence

1. Capture one fixed vent across emergence and decline, then tune volcanic growth and subsidence pacing; keep the open-ocean start as a separate owner decision.
2. Record the owner verdict on the four-rung milestone and tune geomorphic magnitude if requested.
3. Validate the world-space sun and climate-driven height fog across arid/day, wet/dawn, and cold/calm frames; add authored clouds only after the lower atmosphere passes.
4. Finish terrain: tune state-driven ground regimes and detail normals, then add triplanar rock projection only if fixed captures expose stretching.
5. Finish water composition: absorption, refraction, choppy displacement, crest foam, and shallow/deep transitions.
6. Replace island-wide shadow coverage with a close/far strategy.
7. Validate accepted ecosystem assets in the landing renderer before expanding asset breadth.
8. Extend freshwater into connected flowing surfaces: drainage-fed streams and creeks, waterfall transitions at steep drops, then persistent snowfield/glacier flow for suitable climates.

## Maintenance rule

Update this page whenever renderer status, capture URLs, or the milestone verdict changes. `WILDLIFE-ROADMAP.md` remains canonical for ecology and asset-family status; neither tracker may claim acceptance on behalf of the other.
