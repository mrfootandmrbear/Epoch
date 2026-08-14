# Water: technique ladder and rejected approaches

Companion reference for [SKILL.md](../SKILL.md). Load this when the problem is a
water surface — ocean, shore, basin, stream, cascade, or underwater volume.

Compiled 2026-08-13 from a survey of public WebGPU water work plus the primary
literature those projects cite. Sources at the bottom, with what each one is
good for and where it is unverified.

## 1. Pick the owner before picking the technique

One surface, one authoritative representation. Hybrids need an explicit spatial
or frequency handoff, not a blend of two guesses.

| Required observable | Representation | Invalid when |
| --- | --- | --- |
| Broad stochastic directional sea, open water | Spectral FFT cascades | Depth-varying breaking or wet/dry fronts matter |
| A few coherent authored waves, cheap CPU queries | Parametric (Gerstner) sum | The band contains many independent modes — it reads as wallpaper |
| Depth-driven shoaling, run-up, moving waterline | Nonlinear shallow water with wet/dry fronts | Overturning or entrained air is required |
| Directed flow down a fixed channel bed | Advected flow field on authored geometry | Bulk volume change or avulsion matters |
| Standing basin, bounded, weak disturbance | Linear heightfield | Breaking or bulk transport matters |
| Overturning lip, air cavity, jets | Particle/volume solver, or a local authored deformation | A single-valued heightfield suffices |

A Fourier height field is single-valued by construction. It produces steep
crests and whitecaps but **cannot** produce a plunging lip with an air cavity.
Do not tune the spectrum trying to get one; add a local deformation or accept
the limit.

Epoch mapping: `fft-ocean.ts` owns the open sea; `freshwater-basins.ts` owns
standing water; `cascade-renderer.ts` owns streams and falls. Keep the
boundaries — do not let one grow into another's observable.

## 2. Spectral ocean: what a production-grade version has

The five items below are what separates public toy implementations from ones
that read as water. Ranked by visual return.

### 2.1 Multiple cascades over disjoint wavenumber bands

One patch cannot carry swell and glitter at once. Its resolution forces a
choice: a large patch loses capillary detail, a small patch visibly tiles.
Production systems run **three independent bands**, each its own FFT, each with
its own dispersion, summed at shading time. Representative split:

- ~250 m — long swell, carries the silhouette and buoyancy;
- ~17 m — wind sea, carries the main shape;
- ~5 m — capillary-gravity, breaks the sun glitter into facets.

Bands must use **disjoint** wavenumber windows with a guard band, or energy is
double-counted and the sea reads over-rough. Cutoff at the band edges, do not
just overlay three full spectra.

### 2.2 Foam selected by the displacement Jacobian

Whitecaps appear where the horizontal displacement mapping **compresses**, not
where a noise texture says so. Reconstruct the Jacobian from the displacement
derivative FFTs; permit foam only where it folds below a threshold and the
crest is high. Break up coverage with multi-scale noise **after** the physical
selection — noise never chooses the crest location.

Accumulate with separate birth and decay rates so whitecaps linger behind a
passing crest and dissipate, rather than strobing with the wave.

### 2.3 Geometry → BRDF transition with distance

Displace geometry with the long and medium bands only. Attenuate resolved
short-wave slopes with distance and move their remaining energy into
**roughness**. Turning sub-pixel waves directly into normals is the standard
cause of horizon shimmer and painted-looking streaks.

### 2.4 Exact dielectric Fresnel plus a facet-slope glint

Schlick with a tinted, softened reflection reads as plastic. Use exact
dielectric Fresnel at IOR 1.333, and drive direct sun glitter with a
wind-aligned Cox-Munk facet-slope distribution. Reflected radiance should keep
the atmosphere's contrast; transmitted open-water energy stays deliberately
dark.

### 2.5 Water as a participating volume

Separate Fresnel reflection from RGB transmission, absorption, and
in-scattering. Take optical distance **through the water**, not from a
transparency slider. See also `epoch_underwater_look_lesson` — Epoch already
learned that the underwater blue comes from haze, and that physical extinction
alone kills the colour.

## 3. Rejected approaches, with the reason

Recorded from a project that ran deterministic screenshot passes over each one.
Do not re-derive these.

| Approach | Failure mode |
| --- | --- |
| Sum of ~7 hand-authored Gerstner waves | Reads as a wavy-line texture, not water |
| Sine / cellular micro-normal patterns | Repeats visibly; stamped appearance |
| Cellular caustics painted on the floor | Looks decal-stamped under the water |
| Sinusoidal sand banding | Same — physically incoherent with the surface |
| Detached Bezier crest sheets | Disconnected foam bars instead of breaking water |
| One smooth wave band | Alternates between flat/plastic and implausibly sharp |
| Mirrored sand imagery | Adds detail without physical coherence |
| Strong local fold profiles for breakers | Bright cylindrical tube, or a horizontal shelf side-on |

The pattern: **detail added independently of the surface's own physics always
reads as applied, not as water.** Every one of these was replaced by deriving
the same feature from the simulation state.

## 4. WebGPU/TSL implementation notes

- **Batch every pass into one `renderer.compute(passes[])` call.** Epoch's
  ocean passes ~58 dependent compute nodes as a single array and gets correct
  results, because WebGPU orders dispatches within a compute pass and makes
  each one's writes visible to the next. Looping `renderer.compute()` per pass
  issued 58 separate submits per frame for no benefit. Note that poseidon's
  source claims the opposite — that a barrier is missing and each step needs
  its own submit. Epoch's working code is the stronger evidence; do not
  de-optimize on that comment alone.
- **Stockham over radix-2-with-transpose.** A Stockham formulation driven by a
  precomputed twiddle + butterfly-index buffer removes the explicit transpose
  passes entirely. Fewer dispatches, no scratch transpose buffer.
- **Pack multiple complex fields per transform.** Height, horizontal
  displacement, slopes, and displacement derivatives can ride in packed complex
  pairs so one set of butterfly stages produces everything the shader needs.
- **Storage buffers have no sampler.** Bilinear filtering must be hand-written,
  and WGSL `%` is truncating — negative coordinates need `((x % n) + n) % n` to
  wrap correctly. Epoch hit this; see `sampleBilinearFloat`.
- **Validate the transform in isolation** against an analytic impulse before
  wiring it to a spectrum. An FFT convention error (sign, normalization,
  centered-index correction) produces plausible-looking wrong water that is
  very hard to diagnose downstream.
- Declare the inverse convention explicitly and calibrate amplitudes to it. If
  the implementation uses a normalized inverse, rescale the initial spectrum
  rather than tuning the sea afterward.

## 5. Freshwater, rivers, and falls

Public WebGPU work here is thin — searches for waterfall, whitewater, spray,
and river rendering return essentially nothing usable. Epoch's
`cascade-renderer.ts` is ahead of the published state of the art, so expect to
invent rather than port.

What does exist:

- **Virtual pipes shallow water** — a GPU solver where each cell exchanges flux
  with its neighbours through four "pipes". Cheap, stable, handles terrain
  coupling and wet/dry. The natural fit if basins ever need to *flow* rather
  than sit.
- **Baked flow maps** — a CPU-authored RGBA field (flow XY, speed, shore
  coverage) sampled in world XZ by the surface shader. Cheap way to give a
  river directed motion and wet-shore foam without a solver. Good match for
  Epoch's deterministic-capture requirement, since the bake is CPU-side and
  seedable.
- **Hydraulic erosion** on terrain is a related GPU technique, but note Epoch's
  `epoch_waterfall_terrain_limit` finding: the cliffs came from fixing a
  diffusive resolver, not from more simulation.

## 6. Sources

Public implementations, surveyed 2026-08-13:

- [owenyuwono/poseidon](https://github.com/owenyuwono/poseidon) — Three.js +
  WebGPURenderer + TSL, Stockham compute IFFT, 3 cascades, Horvath/JONSWAP,
  Jacobian foam. Closest stack match to Epoch. **No licence file — read for
  architecture, do not copy code.**
- [siliconjungle/inkwell-webgpu-water](https://github.com/siliconjungle/inkwell-webgpu-water)
  (MIT) — raw WebGPU; source of §3's rejected-approaches table. Its perf claims
  are self-reported on unstated hardware; treat as unverified.
- [reed-soul/SeedOcean](https://github.com/reed-soul/SeedOcean) (MIT) — only
  surveyed project covering ocean *and* river/lake; flow maps, caustics,
  clipmap, WebGL2 fallback.
- [Spiri0/Threejs-WebGPU-IFFT-Ocean](https://github.com/Spiri0/Threejs-WebGPU-IFFT-Ocean)
  (MIT) — clean Three.js WebGPU IFFT reference.
- [lisyarus/webgpu-shallow-water](https://github.com/lisyarus/webgpu-shallow-water)
  (MIT) — virtual-pipes solver, native C++/WebGPU.
- [Popov72/OceanDemo](https://github.com/Popov72/OceanDemo) (MIT) — Babylon.js;
  well regarded but unmaintained since 2024.
- three.js official examples: `webgpu_ocean`, `webgpu_water`,
  `webgpu_compute_water`, `webgpu_caustics`, `webgpu_volume_caustics`. Present
  in the installed version; read these before inventing.
- [linegel/threejs-complete-set-of-skill](https://github.com/linegel/threejs-complete-set-of-skill)
  (ISC) — agent skills `threejs-spectral-ocean` and `threejs-water-optics`. Far
  more prescriptive than Epoch's house style; its model-selection table
  informed §1.

Primary literature these converge on:

- Tessendorf, *Simulating Ocean Water* — spectral synthesis, the base method.
- Horvath, *Empirical Directional Wave Spectra for Computer Graphics* (2015) —
  JONSWAP/TMA sea states, directional spreading.
- Bruneton, Neyret, Holzschuch, *Real-time Realistic Ocean Lighting using
  Seamless Transitions from Geometry to BRDF* — §2.3.
- Dupuy & Bruneton, *Real-time Animation and Rendering of Ocean Whitecaps* —
  §2.2.
- Cox & Munk, *Measurement of the Roughness of the Sea Surface from Photographs
  of the Sun's Glitter* — §2.4.
- Nouguier, Guérin, Chapron, *"Choppy wave" model for nonlinear gravity waves* —
  weak nonlinearity before explicit breaking.
- SIGGRAPH 2022, *Rendering Water in Horizon Forbidden West* — localized
  deformation for breaking fronts.

Two caveats worth carrying: several of the surveyed repos are visibly
agent-built, and none of their performance numbers have been reproduced on
Epoch's target hardware. The citations are real; the benchmarks are claims.
