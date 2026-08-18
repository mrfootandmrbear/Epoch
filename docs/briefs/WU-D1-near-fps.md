# WU-D1 — Name the near-camera fps cost

> **Class:** Task. **Authority:** Below `docs/EXECUTION.md`. **Answers:** what this session implements. **Finish:** the Done when list, then stop.

**Model:** local Agent (instrumentation) + owner foreground Chromium (fps). **Size:** small. **Depends on:** WU-4b2. **Blocks:** WU-4c near owner look.

No owner visual verdict. The owner supplies fps numbers; the session names a bottleneck.

---

Work Unit: WU-D1 — Name the near-camera fps cost

**Read first:** the open defect in `docs/EXECUTION.md`, `.agents/skills/design-webgpu-solutions/SKILL.md` (start with evidence; do not prescribe a fix), then these files only:

- `src/main.ts` (render loop, HUD, query params)
- `src/landing-state.ts` (herd count, pose interval, morph texture upload)
- `src/creature-material.ts` / `src/creature-expression-spike.ts`
- `src/render-scale.ts` (LOD distances)
- `src/post-processing.ts` (existing `?post=0`)
- `src/camera-focus.ts` (`LINEAGE_INSPECTION_DISTANCE` is 38 m)
- `docs/RENDER-SYSTEM-MAP.md` sections 2 and 4 (herds, vegetation, ocean, LOD)

Do not explore beyond them. Read vegetation / coral / seagrass / FFT modules only if a listed toggle needs a one-line hook there.

## Why this exists

Owner report 2026-08-16: zooming in on creatures bogs fps on real WebGPU. Nothing has isolated the cost. WU-4c needs a near look; that look is worthless while the frame dies. Guess-tuning hide, morph, or LOD is forbidden until the limiting resource is named.

## Goal

A foreground-tab fps table on the owner's machine that names the cost, or shows near already holds 60 fps at 1080p.

## Required shape

Instrumentation only. Default play must match today's pixels and motion.

Add query flags consumed from `URLSearchParams`, combinable, default off:

| Flag | Isolation |
|---|---|
| `diag=no-herd` | Hide living herds (occupancy discs may stay) |
| `diag=flat-hide` | Swap founder hide for an unlit / flat material |
| `diag=freeze-pose` | Force `creaturePoseInterval` to 0 (no morph upload) |
| `diag=far-lod` | Keep tree / seagrass / coral on far geometry |
| `diag=no-fft` | Skip `fftOcean.update` |
| `diag=no-shadow` | Disable the directional shadow map |

`?post=0` already exists; use it. Do not invent other flags.

HUD already prints `backend · fps · draws`. Add camera distance in metres (eye to orbit target is enough) so overview / mid / near are labeled. Do not report fps from the IDE browser pane, a background tab, headless capture, or `--enable-unsafe-webgpu`.

## Measurement

Owner runs **foreground Chromium, WebGPU, ~1080p**, one fixture, three cameras, then the same near camera with one flag at a time.

Fixture (three living lineages, so extra draws are in play):

`?founders=drifter&plume=active&years=1000000&jumps=5`

Cameras:

- Overview — `?shot=proof-diversified-overview`
- Mid — `?shot=proof-diversified-parent-mid`
- Near — lineage fly to 38 m (click the parent row). HUD distance must read ~38 m.

Record backend, fps, draws, distance. Then at the **same** near stop, apply each flag alone. The recovering toggle is the answer. Flat fps across flags with draws unchanged means the cost is still unnamed — say so; do not guess.

## Done when

- Flags exist; omitting `diag` leaves shipping behavior unchanged.
- Owner table is recorded in `docs/EXECUTION.md` on the open defect (overview / mid / near, plus each near isolation).
- The defect is labeled **hypothesis** or **candidate** with one limiting resource (fill, pose upload, near-LOD geometry, ocean compute, shadows, post, draw-count growth, or unnamed). Not **solution**.
- If near already holds 60 fps, close the defect as stale and leave WU-4c next.
- If it fails, do **not** write the fix in this session. Next brief is the smallest change that matches the named cost.
- `npm test`, `npx tsc --noEmit`, and `npm run build` pass.

## Explicitly not the goal

A performance fix. WU-4c silhouettes. Impostors. Splitting the one-`InstancedMesh`-per-lineage draw. Changing production LOD, hide, or morph. Enlarging or shrinking the iguana. Reopening world scale.

**End with:** EXECUTION names the bottleneck (or closes the defect). Stop.
