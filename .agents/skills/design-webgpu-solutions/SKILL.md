---
name: design-webgpu-solutions
description: Invent, evaluate, prototype, and integrate GPU-native rendering and compute solutions for Epoch's Three.js WebGPURenderer and TSL stack. Use for renderer architecture, shaders, compute passes, GPU simulation or generation, storage-buffer and texture dataflow, instancing, culling, LOD, indirect submission, temporal techniques, readback, GPU profiling, or any performance or visual problem where WebGPU may enable a solution beyond conventional WebGL patterns.
---

# Design WebGPU solutions

Treat WebGPU as a computational and rendering platform, not a faster WebGL. Find the smallest architecture that materially improves Epoch's visual result, scale, iteration speed, or system clarity.

## Start with evidence

1. Read `THESIS.md` sections 2.1, 3, 5, and 6.
2. Read the relevant sections of `RENDERER-ROADMAP.md`, `CLAUDE.md`, and [references/epoch-webgpu.md](references/epoch-webgpu.md).
3. Trace the current implementation and its tests before proposing a replacement.
4. Inspect the installed Three.js version and source. Do not infer current WebGPU or TSL behavior from memory.
5. For unstable capabilities, verify against primary sources: the WebGPU specification, WGSL specification, Three.js source, official examples, or authoritative browser documentation. Record versions, dates, and limitations.

## Frame the problem

Write a compact problem statement containing:

- the visual or gameplay outcome;
- the measured or observed limitation;
- the authoritative state and its update frequency;
- expected element count, resolution, and camera scale;
- target hardware and frame budget;
- acceptance evidence.

Do not prescribe compute, storage buffers, or another mechanism until the limiting resource is identified. It may be CPU submission, GPU bandwidth, occupancy, overdraw, synchronization, allocation churn, latency, shader complexity, or an authoring bottleneck.

## Generate alternatives

Produce at least three materially different options when the problem is architectural:

1. a conservative improvement within the current pipeline;
2. a GPU-native restructuring;
3. a more ambitious option that exploits WebGPU creatively.

Include “keep it on the CPU” when that is credible. For every option state:

- CPU and GPU ownership;
- buffers, textures, passes, dispatches, draws, and synchronization points;
- update cadence and lifetime;
- approximate storage and bandwidth;
- culling, LOD, and camera-scale behavior;
- deterministic capture implications;
- Three.js/TSL support and portability risk;
- failure mode and removal path.

Prefer dataflow diagrams or concise tables when several passes exchange resources.

## Use the integration ladder

Choose the lowest rung that preserves the intended benefit:

1. public Three.js and TSL APIs;
2. a small Epoch-owned abstraction over public APIs;
3. a contained, version-pinned Three.js extension with contract tests;
4. an isolated raw-WebGPU subsystem with explicit device/resource ownership;
5. an upstream Three.js contribution when the capability is broadly reusable.

Do not casually depend on private renderer internals. If a higher rung is necessary, document why lower rungs fail and keep the boundary replaceable.

## Prototype the riskiest claim

Build a disposable or feature-gated spike before a broad rewrite. The spike must answer the uncertain question, not merely draw a simplified demo.

- Use representative counts, texture sizes, and update rates.
- Keep simulation authority outside rendering.
- Add a fixed fixture or capture URL when visual comparison matters.
- Add a numeric test for resource layout, determinism, bounds, or derived data where useful.
- Record CPU time, GPU time when available, frame rate, draw and dispatch counts, allocation behavior, and memory estimates.
- Profile WebGPU in a foreground browser on real target hardware. Headless or WebGL fallback results are diagnostic only.
- Capture failure and fallback behavior, including device loss or unsupported limits when relevant.

Discard a losing spike cleanly. Preserve durable findings in the relevant roadmap, code comment, test, or a focused reference—not in an orphan experiment.

## Integrate deliberately

Before merging a successful design:

1. Define typed resource ownership and disposal.
2. Define resize, reset, device-loss, and hot-reload behavior.
3. Bound readbacks and CPU/GPU synchronization.
4. Avoid per-frame allocations and redundant uploads.
5. Chunk large instanced fields for culling where needed.
6. Keep capture mode deterministic.
7. Verify close, mid, and whole-island scales when the feature spans them.
8. Run relevant tests and `npm run build`.
9. Present visual changes for owner verdict; never self-certify them as accepted.

## Protect Epoch's architecture

- Simulation snapshots and lineage models own ecological truth. GPU state may derive, animate, compact, or render it but must not silently become the only authoritative copy.
- Deep-time jumps resolve landing states directly; do not introduce frame-by-frame millennium simulation.
- Preserve the one-metre world-scale contract.
- Spend complexity on plausible deep-time legibility and visual quality, not physical precision for its own sake.
- Share GPU fields across effects when they represent the same phenomenon, but do not couple unrelated systems merely to reduce pass count.
- Do not use compute because it is novel. State the concrete visual, performance, latency, or architectural gain.

## Deliver a decision

Report:

1. recommendation in one paragraph;
2. current bottleneck and evidence;
3. alternatives considered;
4. selected CPU/GPU dataflow;
5. capability and compatibility findings with versions;
6. prototype measurements and visual evidence;
7. integration risks and rollback boundary;
8. exact next gate.

If evidence is incomplete, label the design `hypothesis` or `candidate`, not `solution`.
