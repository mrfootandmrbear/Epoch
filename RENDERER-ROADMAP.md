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

**Current verdict:** **Candidate**. The four rungs are now visually distinguishable and the upper ladder changes coastline geometry. Owner review is still required before calling the §5 milestone accepted.

## Capability ledger

| Area | Status | Present evidence | Next gate |
|---|---|---|---|
| Deep-time landform | **Candidate** | One-pass weathering, drainage incision, and coastal retreat; four-rung fixed captures; numeric regression test. | Owner verdict on magnitude and plausibility. |
| Atmosphere | **Experimenting** | Profile-driven authored sky gradient, sun/fill lighting, fog, exposure, dawn/day/storm grading. | Add a world-space solar disc and cloud layer; judge all three fixed profiles. |
| Terrain shading | **Experimenting** | Height, climate, disturbance, and slope-authored rock exposure with hemisphere fill. | Replace vertex-only shading with scale-independent material detail and verify close/far cameras. |
| Ocean surface | **Experimenting** | Tessendorf/JONSWAP FFT, fine chop, Fresnel, analytic sky reflection, shoreline foam. Broken planar reflector removed. | Add depth-based absorption/refraction, horizontal choppiness, and crest/Jacobian foam. |
| Shadows | **Experimenting** | One 2048² directional map plus hemisphere fill. | Choose cascades or camera-relative shadow coverage and verify island/herd/forest cameras. |
| Post-processing | **Built** as a bounded layer | TSL grading and restrained bloom; optional full-resolution GTAO evaluation path. | Revisit only alongside accepted materials and lighting. |
| Creature embodiment | **Planned** | Primitive semantic trait adapter only. | Accepted rigged/animated fauna family with readable extremes at gameplay distance. |

## Planned sequence

1. Record the owner verdict on the four-rung milestone and tune geomorphic magnitude if requested.
2. Finish atmosphere: world-space sun, authored clouds/haze, and distinct day/dawn/storm review frames.
3. Finish terrain: triplanar or equivalent detail, slope/shore blending, detail normals, and stable distant appearance.
4. Finish water composition: absorption, refraction, choppy displacement, crest foam, and shallow/deep transitions.
5. Replace island-wide shadow coverage with a close/far strategy.
6. Validate accepted ecosystem assets in the landing renderer before expanding asset breadth.

## Maintenance rule

Update this page whenever renderer status, capture URLs, or the milestone verdict changes. `WILDLIFE-ROADMAP.md` remains canonical for ecology and asset-family status; neither tracker may claim acceptance on behalf of the other.
