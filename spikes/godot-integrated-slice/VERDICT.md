# Owner visual verdict

**Status:** Candidate rendered; awaiting owner review.

| Evidence | Value |
|---|---|
| Godot version | 4.7.1 stable |
| Renderer | Metal 4.0 / Forward+ |
| Hardware | Apple M4 Pro |
| Resolution | 1280×720 comparison; 1920×1080 performance |
| Diagnostic FPS / frame time | 30 / 33.33 ms, V-Sync capped; not a GPU ceiling measurement |
| Whole-island capture | `captures/wholeIsland.png` |
| Shoreline capture | `captures/shoreline.png` |

## Questions

- Does the world read as one authored environment?
- Is it substantially better than the canonical WebGPU frame?
- Was changing the shared look faster and more legible than editing renderer code?
- Is native-first acceptable if this clears the bar?

## Current engineering read

The spike proves the boundary and native renderer path: a deterministic Epoch
fixture loads without simulation ownership moving into Godot, both canonical
cameras render through Forward+, and whole-frame palette/atmosphere changes are
fast. It does not yet prove a migration should happen. The procedural stand-in
assets and first-pass materials remain below Epoch's visual bar; the owner must
judge whether the editor workflow and integrated frame justify a second,
asset-faithful slice.

**Decision:** pending owner verdict; do not call this accepted.
