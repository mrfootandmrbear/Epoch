# Epoch architecture contract

> **Class:** Contract. **Authority:** Below `PRODUCT.md`, above subsystem notes.
> **Update when:** ownership, persistence, or cross-system dataflow changes.

## System shape

```text
player action
  → persistent world history
  → immutable snapshot for one jump
  → domain resolvers
  → semantic landing outcome
  → replaceable render adapters
  → pixels, motion, and explanation UI
```

The simulation resolves what exists. Presentation decides how that result is
sampled and shown. Data may flow from simulation to rendering; render state may
not become the hidden authority for later jumps.

## Ownership

| Concern | Authority | May consume | Must not own |
|---|---|---|---|
| Persistent world | world-history and domain-history modules | committed player actions, prior history | meshes, particles, visible instance IDs |
| Jump input | immutable world snapshot | history, terrain, climate, elapsed time | mutable renderer objects |
| Landing resolution | domain resolvers | snapshot and explicit cross-domain fields | scene graph or GPU resources |
| Presentation | landing-state/render adapters | semantic outcomes and derived fields | population truth or future simulation state |
| Explanation UI | outcome/history records | causes, deltas, ancestry, state | an independent explanation of what occurred |

## Shared contracts

- Terrain, geology, climate, hydrology, and ocean conditions are shared world
  inputs. Domains derive habitat from them rather than inventing private worlds.
- Cross-domain effects use explicit coarse fields such as forage, nutrients,
  productivity, shelter, prey, substrate, and pressure. Domains do not call into
  one another's renderers.
- Resource and energy flow is coarse but explicit: a population resolver must
  name its inputs, maintenance costs, and resource feedbacks. It may not use a
  generic habitat score as unexplained energy.
- Persistent biological units are populations, lineages, or reef sites. Visible
  organisms are bounded samples regenerated for a landing.
- Geology is persistent state advanced by a bounded authored process grammar.
  Fixed fixtures validate that grammar; they are not special-case outcomes used
  in ordinary play.
- Phenotype resolution combines inherited trait state with family-specific,
  authored pressure and tradeoff mappings. There is no universal
  habitat-vector-to-creature optimizer.
- Terrain and forcing edits remain provisional until a jump. Committing a jump
  advances the edited physical world and resolves its biological consequences;
  undo is not a time-reversal mechanic after commitment.
- A new persistent field requires a resolver that writes it and a named consumer
  that changes an outcome. A new visual field requires a semantic source.
- Jump resolution must remain bounded across the full duration ladder. Deep time
  is direct or coarsely stepped resolution, never frame-by-frame playback.

## Change directions

Before implementing a system change:

1. Name the player-visible consequence and the product pillar it serves.
2. Identify the authoritative state and its lifetime.
3. Define the smallest typed seam from producer to consumer.
4. Add deterministic coverage for simulation behavior.
5. Declare visual evidence and an owner verdict when pixels materially change.
6. If causality or adaptation changes, declare a separate comprehension check
   using only player-facing evidence and a reviewer who was not given the answer.
7. Update [EXECUTION.md](EXECUTION.md) if capability, priority, or acceptance
   changed.

Keep technical detail in code and narrow references. The renderer's detailed
pipeline is mapped in [RENDER-SYSTEM-MAP.md](RENDER-SYSTEM-MAP.md); ecosystem
asset production is governed by the repo instructions and its asset skill.
