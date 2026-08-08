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

## 3. The governing design decision: plausible, not precise

Habitat spent real effort chasing simulation accuracy and left an unresolved tension on the table: the owner repeatedly said correctness mattered less than a believable outcome, but the engine's determinism guarantee (exact reproducibility) was never relaxed to match. That argument doesn't carry over — Epoch just decides it:

**The simulation's job is to produce a reasonable state for the epoch that was jumped, given the starting form and the forces set on it. It is not required to be physically exact, and it is not required to replay identically.** If a jump looks like something a thousand years of rain, wind, and tide plausibly do to that shape, it has done its job. Fidelity is a means to plausibility, never an end in itself, and never a reason a jump is slow, small, or doesn't ship.

This is the permission slip that makes epoch-scale jumps tractable at all — modeling a millennium exactly is a fantasy; modeling it *convincingly* is a rendering and coarse-simulation problem, which is solvable.

## 4. Animals evolve across the jump

Evolution is not a distant aspiration tacked on after the terrain works — it is part of what a jump is supposed to show. When you jump an epoch, what changed isn't only the land: populations that colonized it should plausibly have drifted, specialized, and diverged into forms suited to what the world became. A hollow that turned into a marsh and a ridge that turned into scrub should, an epoch later, plausibly hold different-looking descendants of whatever first arrived — not because the player bred them, but because that's what an epoch does to a population under selection.

Same rule as §3 applies: this needs to be *plausible* population-level drift and radiation, not an accurate genetic model. Procedural trait/morph variation driven by what the local conditions rewarded is enough. The bar is "makes sense in hindsight," same as Habitat's arrival mechanic — not phylogenetic rigor.

**Sequencing, not scope-cutting:** evolution is in scope from the start conceptually, but it is *gated* behind §5 — see below. Building evolving animals on top of a terrain/water renderer that can't hold up at epoch scale would be building on sand (the bad kind).

## 5. The load-bearing risk: rendering at epoch scale

Habitat's water and coverage rendering (rain sheet-flow, snow ground-cover, sim-backlog freezing) was a recurring fight even at a 96×96 terrestrial grid over game-time spans of days to seasons. Epoch's core promise — sculpt, then watch a thousand years happen — is a much harder version of the same problem: more elapsed time, more accumulated change, and a jump that needs to *read* correctly the instant it lands, with no time-lapse animation to hide behind.

**This is the assumption everything else depends on.** If terrain, water, and coverage can't be rendered convincingly at whatever scale an epoch-jump needs, the two-verb loop in §2 doesn't work regardless of how good the underlying sim is, and the design needs to be rethought at the rendering layer before anything else — not patched.

Treat this as the first thing to validate, ahead of building out sim depth or evolution mechanics on top of it.

## 6. What Epoch does not inherit from Habitat

Habitat accumulated real process weight over its run: a Decision Register with Locked entries, a binding clip-test gate (D-007), owner-lock ceremony, multi-track cloud-agent pipelines, a verification policy document, a conformance ledger. That process served a long-running iterative project well, but the owner's own read is that some of it constrained the design rather than protecting it.

Epoch starts without that scaffolding. One founding doc, not a constitution. Decisions get made and written down when they matter, not routed through a lock ceremony. If the project grows to the point where that kind of governance earns its keep again, add it back deliberately — don't inherit it by default.

## 7. Open, not yet decided

- **Renderer/tech stack.** WebGL is under consideration as a direction — not committed. This is an implementation choice that should follow from what §5's validation finds, not precede it.
- **What "an epoch" means as a unit.** A fixed jump size, a player-chosen one, or several presets (century / millennium / deep time) — undecided.
- **What carries state across a jump vs. what's regenerated from the post-jump conditions.** Directly related to §3 — if the sim only owes plausibility, it may be cheaper to resolve the destination state from the starting conditions + elapsed time than to actually step through the interval.

---

Nothing here is code yet. This document is the seed the first prototype should serve.
