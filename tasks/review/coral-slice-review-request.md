# Coral vertical slice — review request

**Branch:** `sky-horizon-solar-arc`
**Date:** 2026-08-13
**Look at it:** `npm run dev`, then open `/?shot=reef&years=100000&time=42`

The `reef` golden shot puts the camera under the surface among the colonies.
That is deliberate and it is the shot to judge this on. Absorption, subsurface
scatter, caustics and the water column are all functions of the path light
takes to the eye, and a camera above the surface puts almost none of that path
in frame — an over-water shot cannot show whether any of this works. Every
calibration decision below was found by looking through that shot.

`/?shot=wave-height&years=100000&time=42` is the check that the reef did not
damage the accepted water look.

---

## What was built

### Ocean currents — `src/ocean-currents.ts`

Existed already but was unwired and failing. Three things were wrong:

- **The pressure solve did not converge.** 72 Jacobi sweeps on a 65-wide grid
  is far short of what Jacobi needs to carry an island's influence across a
  basin, so water barely noticed land in its path. Replaced with in-place
  over-relaxed Gauss-Seidel at the optimal factor for the stencil, swept
  proportional to grid width rather than area.
- **The wake shadow was aliased.** It marched upstream snapping to whole cells,
  so differentiating it laterally — which is what carries the sign of the eddy
  pair — returned stair-steps. It now samples land coverage bilinearly at
  half-cell steps across a fan that widens downstream, then smooths.
- **`speed` was clamped to 1, which pinned 54% of wet cells at exactly 1.0**
  and discarded the crest acceleration the module exists to produce. Open water
  now reads 1 and a scoured crest reads above it.

Vorticity behind the island now reads as a clean counter-rotating pair.

### Reef succession — `src/reef-succession.ts`

Sites, not colonies, are the persistent unit. Substrate age sets the phase —
crustose coralline algae, early colonisers, established assemblage, ancient
Porites bommies up to 5 m across — and fresh basalt resets a site to bare rock
however many years the epoch ran. The current field sorts growth form within a
phase: swept sites take branching staghorn and sea fans, slack sheltered water
takes massive Porites and brain coral.

### Geometry — `src/coral-geometry-assets.ts`

Real indexed surfaces for six growth forms, each built in a unit box so the
renderer scales instances by the radius and height succession resolved. Massive
and brain share one dome generator and differ only in the surface field applied
to it — taking the sine of a smooth field produces the winding non-closing
bands that are a brain coral's whole identity, which plain noise will not.

### Renderer and shading — `src/coral-renderer.ts`, `src/coral-material.ts`, `src/reef-water.ts`

Twelve draws for the whole reef, however many thousand colonies it holds.
Absorption rides on the albedo where scene lights still act on it; in-scattered
haze never touched the colony, so it goes on emissive and stays flat. Thin
tissue scatters via a wrapped diffuse term plus a back-lit lobe, weighted by a
per-form translucency so a fan glows and a bommie does not.

`src/terrain-material.ts` now runs the same caustics, absorption and haze, so
the seabed and the colonies standing on it cannot disagree.

### Marine snow — `src/marine-snow.ts`

Particles drift on the same solved field the reef was scored against, so they
gather in the leeward wake for the same reason the massive corals are there.
Both the count drawn and their opacity follow local shelter.

---

## Decisions worth arguing with

**Absorption is gentler than real seawater, and that is the biggest
compromise here.** At true coefficients a colony twenty metres out has lost
about ninety percent of its red, so every species arrives at the eye as the
same green-grey. That is what real water does and it defeats the per-species
colour this renderer exists to show. The channel *ratio* is kept; the absolute
rate is roughly a third of physical. If you would rather have physical
accuracy and accept a monochrome reef at distance, this is the number to
change: `EXTINCTION` in `src/reef-water.ts`.

**In-scattered haze carries the underwater look, not absorption.** An early
pass leaned on absorption alone and turned warm sand and gold coral the same
olive — murky rather than submerged. A submerged scene reads blue because the
column between eye and subject is itself glowing.

**A minority cool pigment morph was added** (~26% of stony colonies, teal
through violet). Pigment morphs within a species are real, but the reason they
are here is that every warm hue converges on one olive once the water takes its
red. They are what still look like different animals afterwards. If this reads
as too candied, `COOL_MORPH_SHARE` is the dial.

**Colony budget is 9000, clustered tightly.** A few thousand spread evenly over
a shelf this wide reads as gravel. Cost is instance count, not draw count.

---

## Gaps — known, not hidden

- **Caustics are procedural, not refracted.** Two drifting noise fields
  differenced and sharpened, not a solve against the FFT surface. They do not
  know where the actual wave crests are. At reef distance this is not the term
  that gives the trick away, but it is not physical.
- **Sway is verified by plumbing, not by an animated capture.** The tests cover
  fan orientation across the flow, the per-instance flow vector in the
  instance's own frame, and that stony corals get zero sway. The shader-side
  oscillation itself was read, not filmed — capture mode freezes the clock.
- **No frame-rate measurement.** The render loop runs on `requestAnimationFrame`,
  which the browser suspends for unfocused tabs, so every reading available in
  this environment was stale. 9000 instances across 12 draws needs a check on a
  real foreground tab before it is trusted.
- **Reef sites are resampled each landing, not carried in world history.** The
  roadmap asks for reef state to live in world history so a site records what
  earlier epochs built. Succession here is derived from substrate age each time
  rather than accumulated, so it cannot yet show recovery-from-survivors or a
  reef that failed to recover.
- **No bleaching event, disturbance, or dead framework.** Health responds to
  heat stress per landing, but there is no storm damage, no rubble, no pale
  skeleton persisting as substrate.
- **Fish do not interact with the reef.** The shelter and productivity the reef
  creates are not fed to the marine lineages.
- **The seabed is volcanic brown, not carbonate sand.** Left alone deliberately:
  `terrainColor` is shared with the shoreline look that was already accepted,
  and changing it would move more than the reef.
- **Sea fans are sparse** (~2% of colonies) because the test island's shelf
  rarely exceeds the flow threshold they need. Correct behaviour, but it means
  the sway work is under-exercised on this terrain.

---

## Verification

`npx tsc --noEmit` clean; 196 tests across 37 files pass.

New coverage: reef succession (17), coral geometry (11), coral renderer (13),
marine snow (8), plus the repaired ocean-current suite (6).

The interesting ones are the tests that would fail if the physics were faked:
counter-rotating vorticity either side of the wake centreline; growth form
sorting by the flow a colony actually sits in; fresh basalt returning an
ancient reef to pioneers; sea fans standing across the current whatever
direction it runs; and marine snow gathering thicker in the lee than in the
windward water.
