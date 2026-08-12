# Stockham FFT + Workgroup-Memory Transpose

**Priority:** Deferred optimization
**File scope:** src/fft-ocean.ts only

## Problem
Current Cooley-Tukey: ~14 dispatches per field × 3 fields = 50+ bind-group switches per frame. Bind-group switching overhead is non-trivial on Apple Silicon and integrated GPUs. Explicit transpose between horizontal and vertical passes uses non-coalesced VRAM stride access.

## Solution
1. Stockham-based 2D FFT using var<workgroup> shared memory — collapses 7 butterfly passes per axis to 1–2 dispatches.
2. 16×16 workgroup-memory transpose — coalesced reads/writes, eliminates VRAM stride bottleneck.

## Expected result
~50 dispatches/frame → ~4–6 dispatches/frame.

## Why deferred
- Ocean is not the current bottleneck
- Bigger gaps remain: reef, aerial, creature assets
- Cheaper before increasing n beyond 128×128
- Self-contained rewrite of one file
