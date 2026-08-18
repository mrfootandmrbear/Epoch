# WU-N1 — Underwater camera navigation

> **Class:** Task. **Authority:** Below `docs/EXECUTION.md`. **Answers:** what this session implements. **Finish:** the Done when list, then stop.

**Model:** local Agent (pixels). Cloud/CI cannot pass the visual gate.
**Size:** medium. **Depends on:** WU-M1. **Blocks:** WU-M2, WU-M4.
**Owner visual verdict required.**

Navigation unit inside the parked water-life program: M1 crab → **N1 underwater camera** → M2 marine iguana → M3 sea lion → M4 urchin → M5 upwelling bird. Do not start this brief in the same session as a family.

---

Work Unit: WU-N1 — Underwater camera navigation

**Read first:** `docs/EXECUTION.md` item 6, `CLAUDE.md` art-direction bible (restraint clause), then these files only:

- `src/camera-focus.ts` / `src/camera-focus.test.ts` (`flyTargetHalfZoom`, `flyTargetLineageInspection`)
- `src/main.ts` (OrbitControls setup ~L205-215, `dblclick` handler, `flyToLineage`, fog uniforms `fogSeaLevel`)
- `src/landing-state.ts` (`populationFocusTarget` marine branch, `setAtmosphere`, submerged material haze)
- `src/render-scale.ts` (`RENDER_SCALE`), `src/climate.ts` (`SEA_LEVEL`)
- `src/presentation.ts` (shot definitions — **add**, never edit existing)

Do not explore beyond them. Do not start M2–M5. This is camera navigation and the minimum submerged look, **not** FFT or water-surface polish.

## Why this exists

The camera cannot get below the waterline by any gesture. Measured in the running app on 2026-08-18, three independent clamps stack:

1. `src/camera-focus.ts:24` — `flyTargetHalfZoom` sets `toTarget.y = Math.max(hitPoint.y, 0)`. The raycast does hit the seabed (verified picks at y = −4.5 on the shelf and −30.3 on the slope), and the result is then snapped to sea level.
2. `src/landing-state.ts:1032-1034` — the marine branch of `populationFocusTarget` returns `y: sea + 1.5`, so flying to a shoal parks the target 1.5 m *above* the surface.
3. `src/main.ts:210` — `maxPolarAngle = Math.PI * 0.49` (88.2°). The camera can never sit below its own target. Driving real wheel events shows the orbit bottoming out on that cone and sliding along it, camera `y` asymptoting to target `y`.

Target `y` is clamped ≥ 0 on every entry path, pan preserves target `y`, and the camera is locked above the target — so there is no gesture sequence that reaches the water column.

Nothing is rendered for that state either. Forcing the camera to −2.4 m and −21 m and re-rendering still shows sky, horizon, and island above a flat teal plane: no submerged haze, no surface read from below, no depth attenuation, seabed as a black silhouette.

M2 (a lizard whose adaptation *is* diving to graze) and M4 (an animal that lives on the reef floor) cannot pass a visual gate the player cannot navigate to.

## Design decision this unit implements

**Submergence is a camera state, not a mode the player selects.** Crossing the waterline is continuous, the same Google Earth gesture vocabulary keeps working, and there is no dive button, no separate underwater controller, and no camera collision system.

- **Fly-to keeps submerged hits.** Replace the sea-level clamp with a seabed clamp: the target may go below 0, but never below terrain height at that point (hold a small clearance, ~1.5 m, so a fly-to never buries the camera in rock).
- **Polar limit becomes depth-dependent.** Above water, keep the current 88.2° — it exists so the player never sees under the world. Submerged, open it far enough to level out and look up at the underside of the surface (~120°), and interpolate across a narrow band around the waterline so a rise-and-break is not a snap. Above-water framing must be unchanged; the existing golden shots are the check.
- **Marine focus targets resolve at real depth.** `populationFocusTarget` returns the shoal/site depth, not `sea + 1.5`. `flyTargetLineageInspection`'s `+11` height offset must not push a submerged bookmark back through the surface.
- **Minimum submerged look, three effects with stated purposes, nothing more.** (a) Depth- and distance-attenuating water haze so the water column reads as a volume and distance is legible; (b) the surface readable as a ceiling from below, so "I am under it" is unambiguous; (c) no sky leak when submerged. Per the restraint clause: no caustics, god rays, refraction pass, bubbles, or wet-lens effect in this unit. Reuse the existing submerged-material haze and `setAtmosphere` sun agreement rather than inventing a second lighting path.
- **Clamp and blend logic lives in a pure, testable module** (extend `camera-focus.ts` or add `src/underwater-camera.ts`) so the rules have deterministic tests. The renderer consumes them; simulation stays untouched.

## Goal

From a coastal overview, a player can double-click into the shallows, keep descending to the shelf and slope with the ordinary scroll/drag vocabulary, level out and look up at the surface from beneath, and come back up without a snap — and at every depth the frame reads as underwater.

## Tasks

1. Depth-aware clamps in a pure module, with tests: fly-to targets clamped to seabed clearance instead of sea level; polar limit interpolated across the waterline band; above-water behaviour provably unchanged at y ≥ 0.
2. Wire the clamps into `main.ts` OrbitControls and the `dblclick` handler. Do not change the mouse-button map or add a gesture.
3. `populationFocusTarget` marine branch returns real depth; check `flyTargetLineageInspection` does not lift a submerged bookmark above the surface.
4. Submerged render state: haze, surface-from-below, sky suppression, driven off camera depth against `SEA_LEVEL[activeClimate.seaLevel]` so a sea-level regime change moves it correctly.
5. Add new capture shots for shallow (~−3 m), shelf (~−10 m), and slope (~−25 m), plus one looking up at the surface. **Add entries only** — existing `GOLDEN_SHOTS` and capture sets are the comparison basis for all prior evidence.

## Done when

- Double-click into water descends; the camera reaches the shelf and slope with scroll and drag alone.
- Submerged, the camera can level out and look up at the surface; above water it still cannot dip below the horizon clamp.
- Waterline crossing has no snap in polar limit or haze.
- Flying to a marine lineage lands in the water column with the animals in frame.
- Existing golden shots are visually unchanged.
- New underwater capture URLs exist for the owner.
- `npm test`, `npx tsc --noEmit`, and `npm run build` pass.

## Explicitly not the goal

FFT or water-surface polish, caustics, god rays, refraction, bubbles or wet-lens, a swim/dive avatar, camera-terrain collision as a general system, a separate underwater control scheme, any M2–M5 family, or retuning above-water framing.

**Known adjacent limit, deliberately out of scope:** `controls.minDistance = 3` with a 55° fov means the closest possible framing is ~3.1 m of visible height, so a 0.07 m crab carapace is ~2% of frame height. Centimetre-scale near inspection is a separate decision — do not change `minDistance` here.

## Hard constraints

- One world unit is one metre. Depths come from terrain and `SEA_LEVEL`; do not introduce a second depth scale.
- Simulation must not import meshes; do not add renderer types to resolvers.
- Capture mode stays deterministic: seed `0xe90c4`, frozen sim time, forced `day`, fixed cameras, UI hidden.
- Do not claim fps. Headless readings are not perf evidence; ask for an owner still-frame and motion look on real WebGPU.
- Do not edit existing `GOLDEN_SHOTS` or existing capture sets.

**End with:** test, typecheck, build, capture URLs for the owner, and a short `docs/EXECUTION.md` note that underwater navigation is implemented and awaiting owner verdict.

**This unit needs an owner visual verdict.** One question: "Can you swim the camera down to the reef and back without fighting it, and does it read as underwater the whole way?"
