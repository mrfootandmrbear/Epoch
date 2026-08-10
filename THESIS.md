# Epoch — Founding Doc

> **Status:** Day zero. Distilled from extensive playtesting of Epoch's predecessor, Habitat.
> **Role:** What Epoch is and why it exists in this shape — the seed everything else should serve.
> **Weight:** This is one document, not a constitution. Epoch inherits Habitat's lessons, not its process.

---

## 1. Where this comes from

Habitat was a living sand castle: sculpt an island, set the natural forces at work, run time, watch the landscape and life answer. It worked, and playtesting it produced two clear signals:

1. **Sculpting terrain is fun.** The forming phase holds up on its own.
2. **Seeing what happened an epoch later is even more fun.** Not marginally — the time-jump, watching centuries or millennia collapse into a legible "here's what became of what you built," was the single most fun part of the whole game.

Everything below is what it looks like to take signal 2 seriously as the *design center* rather than a payoff bolted onto a terrain sandbox.

## 2. What Epoch is

**Sculpt a starting world. Set the forces. Jump an epoch — a thousand years or more in one move. Look at what nature and time made of it.**

The loop is two verbs, not a checklist of systems:

```
form  →  jump  →  look
 ↑                  │
 └──── reshape ──────┘
```

Forming is tactile and immediate, same as Habitat. Jumping is the new center of gravity: not a fast-forward you watch tick by tick, but a deliberate leap where the payoff *is* the leap — you commit to a jump size and a set of forces, and the world on the other side is the answer.

### 2.1 Two speeds, not one

The engine runs at two different speeds, and they are not the same problem:

**Play speed**, during build/inspect sessions: whatever game speed makes sculpting and short-run observation feel good. This is a live, steppable simulation at a human timescale — the player builds, nudges forces, watches immediate response. This is the register Habitat already ran in.

**Jump speed**, on demand: the player commits to a jump size and clicks. What happens next is not the engine stepping through a thousand simulated years and rendering each one — it's a load screen: something plays while the result is prepared, then it clears to reveal the landing state. What fills that load screen is open — a morph animation (the island visibly deforming from its pre-jump form toward its post-jump form) is one candidate, not a commitment. What's settled is the shape of the beat — commit → load → reveal — and that it *materializes* the outcome rather than *playing back* the interval.

This split is what makes §5 tractable. Epoch-scale rendering does not mean "run the live renderer for a thousand simulated years." It means computing a plausible end state (§3) and producing a convincing load-screen treatment for the beat between them — closer to a VFX/UI problem than a continuous physically-driven rendering one.

**Jump size is player input**, chosen from a preset ladder rather than typed freely: 1, 5, 10, 25, 50, 100, 1000 years, extending upward from there — deep-time presets are more of the same list, not a different mechanic. Every rung uses the same beat (commit, load, reveal); what changes is what the landing state plausibly contains, and, per §8, possibly how the load screen itself scales.

## 3. The governing design decision: plausible, not precise

Habitat spent real effort chasing simulation accuracy and left an unresolved tension on the table: the owner repeatedly said correctness mattered less than a believable outcome, but the engine's determinism guarantee (exact reproducibility) was never relaxed to match. That argument doesn't carry over — Epoch just decides it:

**The simulation's job is to produce a reasonable state for the epoch that was jumped, given the starting form and the forces set on it. It is not required to be physically exact, and it is not required to replay identically.** If a jump looks like something a thousand years of rain, wind, and tide plausibly do to that shape, it has done its job. Fidelity is a means to plausibility, never an end in itself, and never a reason a jump is slow, small, or doesn't ship.

This is the permission slip that makes epoch-scale jumps tractable at all — modeling a millennium exactly is a fantasy; modeling it *convincingly* is a rendering and coarse-simulation problem, which is solvable.

## 4. Animals evolve across the jump

Evolution is not a distant aspiration tacked on after the terrain works — it is part of what a jump is supposed to show. When you jump an epoch, what changed isn't only the land: populations that colonized it should plausibly have drifted, specialized, and diverged into forms suited to what the world became. A hollow that turned into a marsh and a ridge that turned into scrub should, an epoch later, plausibly hold different-looking descendants of whatever first arrived — not because the player bred them, but because that's what an epoch does to a population under selection.

Same rule as §3 applies: this needs to be *plausible* population-level drift and radiation, not an accurate genetic model. Procedural trait/morph variation driven by what the local conditions rewarded is enough. The bar is "makes sense in hindsight," same as Habitat's arrival mechanic — not phylogenetic rigor.

**Architected in, not sequenced after:** evolution is not gated behind §5 — it is validated alongside it, starting with the first spike. Too much else depends on world state already carrying population/trait data for evolution to be a layer added once rendering works; that's exactly the kind of retrofit §6 is trying to avoid on the visual side, and the same logic applies here. What is still sequenced is depth, not presence — the first spike proves a small population can look plausibly evolved and render at the bar set in §6, not that the full drift/radiation model is complete.

## 5. The load-bearing risk: rendering at epoch scale

§2.1 splits this risk into two pieces, and they are not equally scary.

**Play-speed rendering** is Habitat's problem, already fought once. Rain sheet-flow, snow ground-cover, sim-backlog freezing — real fights, but at a known scale (96×96 grid, day-to-season spans) with prior art to draw on.

**Jump-transition and landing-state rendering** is new and unproven. Two separate asks: (1) a load-screen treatment that sells "a thousand years happened" without literally simulating and rendering every intervening year — morph animation is one candidate, not a commitment (§2.1) — and (2) the state it clears to — a canyon, a reef, an ancient forest, whatever an epoch plausibly produced — has to render convincingly at whatever density and scale that implies, even though nothing about it needs to run in real time once it's landed.

**This is still the assumption everything else depends on.** If the landing state can't be rendered convincingly, or the load screen doesn't sell the jump, the two-verb loop in §2 doesn't work regardless of how good the underlying sim is — and the fix lives at the rendering/transition layer, not the sim.

Treat landing-state rendering as the first thing to validate — ahead of sim depth, ahead of the load-screen/transition treatment, but *with* evolution (§4), not ahead of it. See §6 for how high a bar that validation needs to clear.

**First spike, scoped narrowly:** a single fixed island, one jump size, terrain and water rendered at §6's bar, plus a small population rendered with visible trait variation. The jump-transition / load-screen treatment (§2.1, §8) is explicitly *not* attempted in this spike — deferred to a later one, not cut.

## 6. Visual bar: this should look stunning, not just work

§5 asks whether epoch-scale rendering can work at all. This sets a higher bar on top of that: **Epoch is meant to be visually stunning**, not merely legible — and that bar gets designed for from the start, alongside the sim, not queued behind it.

Habitat's own history is the cautionary example. `docs/VISUAL_UPGRADE_NOTE.md` in that repo records an explicit, out-of-process "push toward AAA-grade production polish" — PBR materials, real shadows, a real water shader, atmosphere, post-processing — that had to happen as a dedicated retrofit pass after the simulation and mechanics were already built. It worked, but it was a departure from normal process precisely *because* visual quality had been deferred long enough to need one. Epoch shouldn't need that pass.

Concretely:

- **Concrete reference for "stunning": [Three.js Water Pro](https://threejsresources.com/tool/three-js-water-pro).** FFT wave simulation, Fresnel reflections, subsurface scattering, caustics, real-time foam, dynamic sky — that's the water/atmosphere bar to clear, not just a mood-board pointer.
- **Renderer/tech stack: Three.js, fresh codebase (not a fork of Habitat's), targeting `WebGPURenderer` + TSL (Three.js Shading Language)** — that's what the reference above is built with, so matching it means matching its pipeline, not approximating the look on classic WebGL2. Trade-off, stated plainly rather than discovered later: WebGPU support isn't universal yet (weakest on Safari) — acceptable for a concept-stage solo project, revisit if/when distribution beyond a modern-Chromium target matters.
- **§5's validation spike should target real visual quality, not a bare-minimum "does this read" proof of concept.** Whether epoch-scale rendering works and whether it looks good are one question, not two answered in sequence — a rendering pipeline built cheap is expensive to make beautiful afterward.
- **§3 is what pays for this.** Simulation that doesn't chase precision frees up engineering and performance budget to spend on how the result actually looks. Plausibility is cheap; stunning is where the budget goes.

## 7. What Epoch does not inherit from Habitat

Habitat accumulated real process weight over its run: a Decision Register with Locked entries, a binding clip-test gate (D-007), owner-lock ceremony, multi-track cloud-agent pipelines, a verification policy document, a conformance ledger. That process served a long-running iterative project well, but the owner's own read is that some of it constrained the design rather than protecting it.

Epoch starts without that scaffolding. One founding doc, not a constitution. Decisions get made and written down when they matter, not routed through a lock ceremony. If the project grows to the point where that kind of governance earns its keep again, add it back deliberately — don't inherit it by default.

## 8. Open, not yet decided

- **How the landing state is actually computed.** §2.1 settles the *presentation* (transition, then reveal) but not the computation behind it — whether the end state is resolved directly from starting conditions + elapsed time (cheaper, and consistent with §3's "owes plausibility, not a literal trace"), or produced by stepping the sim forward at a coarse resolution and discarding the intermediate frames. Not needed to answer the first spike (§5), since that spike composes a landing state by hand rather than deriving one from a jump — but it's the next real fork after the spike lands.
- **What actually fills the load screen.** Morph animation (island visibly deforming pre→post) is one candidate, not a commitment — could as easily be something cheaper or more abstract. Its length, whether it scales with jump size, and whether it's skippable are all downstream of this and equally undecided. Explicitly out of scope for the first spike (§5).
- **Vegetation/tree rendering tooling — not decided, flagged for future study.** [ez-tree](https://github.com/dgreenheck/ez-tree) (procedural tree generator) is a candidate worth evaluating when plant rendering becomes a work item — check Three.js/WebGPU-TSL compatibility (§6) and whether its parameters can be driven by evolved traits (§4) before committing to it.

**Resolved since day zero:** renderer/tech stack (Three.js, fresh codebase, `WebGPURenderer` + TSL — see §6) and evolution's sequencing (baked in from the first spike, not gated — see §4) are no longer open; see those sections.

---

Nothing here is code yet. This document is the seed the first prototype should serve.
