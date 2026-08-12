# Deferred

Items consciously not done, with the reason. Deferring is an honest outcome;
silently dropping is not. Each entry names *why* — budget, asset limitation,
engine limitation, or scope.

## Deferred in Phase 0

### Hardware performance baseline
**Reason: environment limitation.** The sandbox has no real GPU (ANGLE/
SwiftShader software rasterisation) and runs headless, where `requestAnimation
Frame` is throttled. The in-app FPS counter reported a flat "60 fps" on the
WebGPU backend *while rendering nothing at all*, which is proof the reading is
not measuring what it appears to measure. No trustworthy frame-time baseline can
be taken here. The performance target in `CLAUDE.md` is therefore stated as an
intent inherited from THESIS's platform target, not as a measured starting
point. **Needs:** one manual capture on the owner's real target machine in a
foreground tab, on the WebGPU backend, after P0-2 clears.

### Baseline captured on the WebGL2 fallback rather than WebGPU
**Reason: environment limitation.** This sandbox has no GPU and exposes no
WebGPU adapter, so the renderer falls back to WebGL2. Forcing WebGPU with
`--enable-unsafe-webgpu` is not a valid substitute — it enables experimental IDL
members a shipping browser lacks, and Phase 0 wasted a cycle mistaking the
resulting failure for a product defect. THESIS §6 rules WebGL2 out as a visual
target, so every Phase 0 score is provisional. Post-processing in particular
(`src/post-processing.ts` TSL grading, bloom, optional GTAO) may behave
differently or not run at all on the fallback, making image-quality and lighting
the least trustworthy scores of the set. **Needs:** one capture run on the
owner's machine, where WebGPU works.

### Full Phase 1 audit
**Reason: Phase 0 scope.** The directive ends Phase 0 at "baseline captured,
scorecard written, stop and report." The hostile-reviewer audit is the next
session's work. Ideally it runs against WebGPU evidence from the owner's
machine; a fallback-only audit risks chasing artifacts of the wrong backend.

### `ui` shot set is defined but not yet captured
**Reason: budget + sequencing.** The set exists in `scripts/capture.mjs` but UI
review needs non-capture-mode runs (capture mode hides every panel), and the
first-run/idle states need a deliberate interaction script rather than a fixed
URL. Worth building when the UI/HUD Work Unit starts, not before.
