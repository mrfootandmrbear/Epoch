# Stylized render cohesion — WebGPU direction

**Status:** Candidate architecture; owner-approved direction, visual grammar not
yet accepted. **Target:** Three.js r185 (`0.185.1`), `WebGPURenderer` + TSL,
modern Chromium desktop, 60 fps at 1080p on the owner's Apple Silicon machine.

## Decision and problem

The Godot plan is cancelled. Its bounded slice showed that changing engines
does not create cohesion: individually plausible terrain, water, vegetation,
and fauna still read as assembled elements without a shared visual grammar.
Epoch retains WebGPU/TSL and preserves the Godot slice only as negative evidence.

Epoch's current systems choose color, value, roughness, edge treatment, detail
frequency, and distance behavior locally. Post-processing grades the assembled
result but cannot make it one authored world. The required outcome is a shared
stylized grammar that clarifies habitat, adaptation, and deep-time change at
shoreline, mid, and whole-island scales without making every surface identical.

## Verified capability surface

The installed public Three.js/TSL surface is sufficient for the investigation:

- node materials can share reusable color, lighting, roughness, and distance
  functions while retaining material-specific inputs;
- MaterialX noise and triplanar projection can correlate shape breakup across
  terrain and assets without UV-dependent seams;
- `posterize` supports controlled value and color bands;
- `pass` plus MRT expose scene color, normals, and depth;
- `toonOutlinePass` provides a public screen-space outline implementation;
- screen-space depth, derivatives, and normal reconstruction permit selective
  edge and contact treatments;
- the current pipeline already composes grading, bloom, and optional GTAO using
  public APIs.

These are capabilities, not an art style. The missing layer is a rule set for
how every renderer uses them.

## Alternatives

### A — Shared palette and light response

Keep current materials and introduce an Epoch-owned TSL library for palette
mapping, value compression, roughness families, distance detail, and atmospheric
integration. This adds no pass and only small shader arithmetic. It is the
lowest-risk route, but silhouettes and contacts may remain weak.

### B — Shared materials plus restrained edges (recommended)

Add A, then compose selective depth/normal edges and contact darkening in the
existing post pipeline. Use one MRT scene pass, one bounded edge evaluation,
and the current grade/bloom stage. Outlines must be distance- and category-aware:
terrain horizons, creature silhouettes, and major foliage masses may read;
internal tessellation must not.

### C — Fully illustrative renderer

Quantize lighting aggressively and add watercolor noise, temporal stipple, or
broad image-space abstraction. This could create a strong identity but risks
flattening habitat information, water motion, evolved traits, and deep-time
differences. Do not attempt it until B proves insufficient.

## Candidate visual grammar

1. **Palette families:** atmosphere defines light/shadow bias; habitat defines
   local hue; material identity contributes bounded variation.
2. **Value hierarchy:** sky and distant water are quiet; land masses separate
   at mid value; creatures and epoch-significant features get the clearest
   local contrast.
3. **Lighting bands:** compress diffuse response into soft authored bands while
   retaining continuous specular response for water and wet surfaces.
4. **Edge hierarchy:** silhouette and contact edges only—never a universal black
   outline or exposure of procedural triangle density.
5. **Detail frequency:** macro variation is shared across the world; fine detail
   retires consistently with camera distance.
6. **Grounding:** vegetation and fauna inherit local ground hue, fog, key-light
   direction, and contact treatment rather than reading as color-picked assets.
7. **Transitions:** shoreline, forest edge, rock/soil, and water depth are
   material transitions driven by shared world fields, not coincident geometry.

## Candidate dataflow

```text
landing snapshot + environment fields (CPU authority)
                    |
                    v
 shared style uniforms + spatial textures (GPU read-only)
          | terrain | water | vegetation | fauna |
                    v
 scene pass: color + normal + depth (MRT)
                    v
 selective edge/contact treatment
                    v
 palette/value grade + restrained bloom
                    v
 deterministic capture
```

Style uniforms update only when atmosphere or an art-direction control changes.
Existing environmental textures update on landing changes. There is no GPU
readback and no new simulation state.

## First spike: style laboratory

Add a feature-gated `?style=cohesion` laboratory to the existing renderer. Apply
three grammars to the unchanged fixed `whole-island` landing:

1. soft value bands plus shared palette;
2. the same with restrained silhouette/contact edges;
3. continuous light with shared palette and grounding only.

Use only terrain, FFT water, vegetation, the accepted marsh grazer, atmosphere,
and post-processing. Do not add reefs, fish, weather variants, or content.

After the owner selects one grammar from live WebGPU evidence, carry only that
candidate into `shoreline` and `herd-contrast`. Record 1080p foreground WebGPU
FPS/frame time, draw count, new full-resolution passes, compilation behavior,
and deterministic captures.

## Acceptance gate

The owner must answer yes to all of these:

1. Does the frame read as one world rather than assembled systems?
2. Are terrain, water, vegetation, and fauna still materially distinct?
3. Does stylization improve habitat and evolved-trait legibility?
4. Do shoreline, mid, and whole-island views all improve?
5. Are the four deep-time landing rungs at least as distinguishable as before?
6. Does the foreground WebGPU run hold 60 fps at 1080p?

If no candidate passes, remove the feature-gated style layer. Do not integrate a
candidate into the default renderer before owner selection.

