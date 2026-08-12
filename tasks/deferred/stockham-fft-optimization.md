# Stockham FFT + Workgroup-Memory Transpose

**Priority:** Deferred optimization  
**File scope:** `src/fft-ocean.ts` only — no other files affected

## Problem

The current Cooley-Tukey implementation runs ~14 dispatches per field (7 row butterflies + 7 column butterflies via explicit transpose) across 3 fields = 50+ bind-group switches per frame. On Apple Silicon and integrated GPUs, bind-group switching overhead is non-trivial and accumulates.

The explicit transpose between horizontal and vertical passes writes through VRAM with non-coalesced stride access.

## Solution

### 1. Stockham-based 2D FFT
Replace the radix-2 Cooley-Tukey butterfly passes with a Stockham (or Stockham-based) 2D FFT that performs multiple butterfly stages inside a single compute workgroup using `var<workgroup>` shared memory. This collapses 7 butterfly passes per axis down to 1–2 dispatches per axis.

### 2. Workgroup-memory transpose
Handle the matrix transpose in 16×16 tiles within `var<workgroup>` memory instead of a separate VRAM read/write pass. Ensures coalesced reads/writes and eliminates the VRAM stride bottleneck.

### Expected result
~50 dispatches/frame → ~4–6 dispatches/frame. Meaningful win if `n` is increased beyond 128×128 or lower-end hardware support is needed.

## Why deferred
- Ocean is not currently the render bottleneck
- Bigger visual gaps remain: reef domain, aerial domain, creature assets
- Cheaper to implement before increasing `n` than after
- Clean, self-contained rewrite of one file
