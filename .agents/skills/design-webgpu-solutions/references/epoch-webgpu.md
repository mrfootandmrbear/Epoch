# Epoch WebGPU context

Use this reference to orient WebGPU design work. Repository source and canonical trackers win when this file becomes stale.

## Platform contract

- Runtime: TypeScript, Vite, Three.js `WebGPURenderer`, and TSL.
- Target: modern Chromium desktop, with 60 fps at 1080p on the owner's Apple Silicon machine.
- WebGL is a fallback and automated-evidence path, not the visual target.
- One world unit equals one metre.
- Capture fixtures use a fixed seed, frozen time, fixed cameras, forced atmosphere, and hidden UI.
- Rendering consumes landing snapshots. Simulation remains renderer-independent.

Inspect `package.json`, `src/main.ts`, `src/presentation.ts`, `src/render-scale.ts`, and the relevant renderer module before designing a change.

## Capability verification

WebGPU, WGSL, browsers, and Three.js WebGPU/TSL evolve quickly. Establish the actual capability surface for every nontrivial design:

1. Record the installed `three` version.
2. Search installed source and type declarations for the proposed API.
3. Find an official Three.js example or test that exercises comparable behavior.
4. Check the current WebGPU and WGSL specifications for the underlying primitive.
5. Check target-browser limits and implementation status when the design depends on optional features or high resource counts.
6. Separate WebGPU capability from Three.js exposure. A browser feature is not automatically usable through TSL.

Prefer primary sources. Blog posts and demos are leads, not proof.

## Opportunity map

Consider these patterns without assuming they are appropriate:

- compute-generated placement, compaction, and spatial bins;
- GPU culling and LOD selection;
- indirect or bundled submission when exposed and measurable;
- shared environmental fields for water, foam, caustics, sediment, snow, wind, vegetation, and habitat visualization;
- ping-pong or temporal fields where continuity adds visual value;
- GPU animation and behavior for ephemeral individuals derived from population state;
- procedural geometry or deformation with bounded topology and memory;
- hierarchical reductions, prefix sums, and work queues;
- virtualized or chunked world data for close-to-island camera scales;
- asynchronous staging and rare, bounded readback for diagnostics.

## Cost model

Estimate before implementing:

```text
storage bytes = element count × bytes per element × buffered copies
upload rate   = changed bytes × updates per second
work          = invocations × approximate work per invocation
```

Also count passes, dispatches, render draws, bind-group changes, texture samples, atomics, readbacks, and full-resolution screen operations. Approximation is sufficient; hidden scale is not.

## Design cautions

- Avoid frequent GPU-to-CPU readback; it can serialize the pipeline.
- Avoid duplicating a large field solely to accommodate mismatched layouts without measuring the tradeoff.
- Treat storage alignment, texture formats, device limits, and workgroup sizing as explicit design inputs.
- Bound atomic contention and nondeterministic ordering when results affect captures.
- Define initialization and clearing costs for persistent resources.
- Plan resource disposal and device-loss reconstruction.
- Avoid one enormous instancing domain when spatial chunks enable meaningful culling.
- Verify that TSL-generated shaders and resource bindings match the intended dataflow; do not reason only from authored node graphs.

## Evidence hierarchy

From strongest to weakest:

1. foreground WebGPU measurement on target hardware plus fixed visual evidence;
2. WebGPU measurement on representative hardware;
3. automated correctness and resource-contract tests;
4. headless or WebGL fallback captures;
5. estimates and source inspection;
6. API recollection or an unverified demo.

Use weak evidence to choose experiments, not to declare acceptance.
