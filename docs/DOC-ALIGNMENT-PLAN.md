# Documentation Alignment Plan

Status: proposal. Nothing here is a decision. This plan lists edits to make and questions to answer; it does not make the calls.

Written 2026-08-12. Inputs: the *Player Attachment Through Visible Evolution* design note, and `docs/SIM-RENDER-AUDIT.md`.

## Why this exists

The Player Attachment note proposes ten changes spanning sim and render. The repo's planning docs — THESIS.md, RENDERER-ROADMAP.md, WILDLIFE-ROADMAP.md — do not currently reflect most of them, and in one case actively contradict one. This plan reconciles the two.

The docs are in good shape. This is not a cleanup. Three of the four core docs are internally consistent and honestly scoped, and the status vocabularies are stricter than most projects manage. The gap is that the creature-embodiment work has grown from one ledger row into roughly seven distinct capabilities, and the docs haven't caught up.

## The one hard contradiction

THESIS.md:84 (§6) states:

> "Because it does not provide blend shapes or topology-stable morph targets, continuous evolved traits should drive ordinary glTF skeleton proportions at runtime, while genuinely discrete adaptations select among a small family of pre-baked Foxel variants."

The Player Attachment note proposes a base grazer mesh authored with five morph targets (body mass, leg length, foot width, insulation, horn length).

These cannot both be true. THESIS derives its position from a Foxel constraint — Foxel does not export blend shapes, therefore use skeleton proportions. The Player Attachment note assumes a mesh authored with blend shapes, which implies either a non-Foxel authoring path for the grazer, or a Foxel export post-processed to add morph targets.

**This is Open Decision 1 below — now RESOLVED.** Morph targets win: per-instance blend weights via `morphTexture` (DataArrayTexture), Foxel not required. THESIS.md:84 has been updated to reflect this. See OD-1 in the Open Decisions section.

## Second-order finding: the audit overclaims on grazer traits

`docs/SIM-RENDER-AUDIT.md:11` places this under **Rendering Correctly**:

> "**Land lineage traits → grazer** — All 7 traits mapped to mesh (bodyMass, legLength, footWidth, insulation, coatWarmth, coatLightness, hornLength). Abundance drives herd count."

This is true at population granularity and misleading at individual granularity. `applyGrazerTraits` (`src/landing-state.ts:232`) is called once per animal in a herd loop (`src/landing-state.ts:743`) but receives the same `lineage.traits` object every time. Every animal in a herd is identical. The seven traits are mapped to *the mesh*; they are not mapped to *individuals*.

That distinction is the entire subject of the Player Attachment note, so the audit should not read as though the problem is solved. See the SIM-RENDER-AUDIT edits below.

## Alignment gaps by category

**(a) Shipped but under-documented.** The seven trait names appear in exactly one place — `docs/SIM-RENDER-AUDIT.md:11`, a snapshot audit. No roadmap enumerates them. WILDLIFE-ROADMAP.md:44 says only "seven-trait means." THESIS.md:83 names body mass and insulation and gestures at limbs and feet. Coat warmth, coat lightness, and horn length are named in no planning doc at all. The trait vocabulary the player is supposed to learn to read has no canonical home.

Also under-documented: TSL compute and storage-buffer work is already shipped and non-trivial (`src/fft-ocean.ts` uses `instancedArray`, `StorageBufferNode`, and several `Fn(...)` compute passes for the ocean FFT). The proposed creature instancing pipeline is not greenfield GPU work for this codebase — there is in-repo precedent. Neither roadmap mentions this, so the creature compute proposal reads as riskier than it is.

**(b) Proposed but absent from every roadmap.** Lineage DNA. Per-population variance as a simulated field. Path-dependent selection. Shell fur. Per-instance GPU trait sampling. Stable instance seeds. Distance-based trait LOD. Trait-driven behavioral differentiation. Per-instance coat variation. All absent.

**(c) Present but framed as finished when the proposal supersedes it.** WILDLIFE-ROADMAP.md:51 marks lineage history UI **Built** — "Land ancestry and fish condition/adaptation are reported textually," and README.md:35 describes "a compact lineage panel." The Player Attachment note proposes a field-notebook lineage card with an ancestry tree, trait sparklines, and a biome glyph. That is a successor to shipped work, not greenfield. The ledger should show both rungs rather than reading as done.

**(d) Already half-committed and worth claiming.** WILDLIFE-ROADMAP.md:84 records that marine state "records an origin domain and optional terrestrial ancestor seam." That is a proto-lineage-DNA — ancestry already persists in one domain. The lineage DNA proposal should be written as generalizing this existing seam, not as a new invention.

## Edits by document

### THESIS.md

THESIS is narrative and founding. Edits should be minimal and should add questions rather than commitments.

1. **§8 "Open, not yet decided" — add Open Decisions 1, 3, 4, and 12** from the list below, in the doc's existing prose style. These are genuine founding-level questions: the creature asset pipeline, whether render-layer fiction about individual continuity is permitted, and what "visible trait variation" was meant to mean.

2. **§6, line 84 — add a pointer, not a rewrite.** Append a clause or trailing sentence noting that the morph-target question is reopened by the per-instance trait expression work and is tracked in §8. Do not change the substance of the sentence. Suggested shape: the existing statement stands as the default, with a note that an alternative authoring path is under evaluation.

3. **§5, line 72 — ratify the ambiguity.** The first-spike scope says "plus a small population rendered with visible trait variation." Add a clause fixing whether this means variation *between* populations or *between individuals within* a population. The Player Attachment note assumes the latter; the shipped code does the former. One clause settles it. If the answer is contested, this becomes Open Decision 12 instead and §5 gets a pointer to §8.

4. **§4 "Animals evolve across the jump" — add path dependence.** One paragraph: the same conditions acting on populations with different histories should produce different outcomes. This is a design claim about what the game is, not an implementation detail, so it belongs in THESIS rather than only in WILDLIFE-ROADMAP. Do not describe the float layout here.

**Do not** add morph targets, compute pipelines, shell fur, LOD, or seeds to THESIS. Those are implementation and belong in the roadmaps.

### RENDERER-ROADMAP.md

The capability ledger currently carries one row for all creature work:

> "Creature embodiment | **Planned** | Primitive semantic trait adapter only. | Accepted rigged/animated fauna family with readable extremes at gameplay distance." (line 38)

That row now has to carry seven distinct capabilities with different dependencies and different success tests. Split it.

1. **Replace the single row with these rows**, using the doc's existing Candidate / Experimenting / Built / Planned vocabulary and its existing three-column shape (status / today / target):

   - **Creature mesh and rig** — *Planned*. Today: primitive semantic trait adapter only. Target: an accepted fauna asset carrying every expression channel the seven traits need.
   - **Per-instance trait expression** — *Planned*. Today: one trait set per herd; every individual in a herd is identical (`src/landing-state.ts:743`). Target: individuals within one herd visibly differ along all seven axes.
   - **GPU herd instantiation** — *Planned*. Today: per-animal CPU mesh mutation. Target: compute-driven instance buffer feeding a single instanced draw per herd. Note the existing in-repo precedent (`src/fft-ocean.ts`).
   - **Coat colour as phenotype** — *Candidate*. Today: per-population HSL applied to body material (`src/landing-state.ts:240–244`). Target: per-instance colour from coat warmth and coat lightness against a neutral base albedo.
   - **Insulation shading** — *Planned*. Today: insulation alters body scale only. Target: insulation reads as fur, not only as bulk.
   - **Distance-based trait LOD** — *Planned*. Today: LOD exists for vegetation only. Target: trait expression cost scales with camera distance.
   - **Trait-driven herd behaviour** — *Planned*. Today: herd cohesion and separation are wired but trait-independent. Target: spacing, speed, and grazing posture derive from trait values.

   Note that **Coat colour as phenotype** is the only row that is not *Planned*. It is partially shipped. Whether it earns *Candidate* or stays *Planned* depends on this doc's own rule that nothing counts as Built until an owner records a visual verdict — apply that rule rather than my suggestion if they conflict.

2. **Add a new section `## Creature embodiment ladder`**, placed after the capability ledger. The seven rows above have a dependency order that a flat ledger cannot express. Define rungs, each with a stated success test in the style this doc already uses:

   1. **Trait vocabulary fixed** — the seven axes are named in a planning doc with committed ranges and units. Test: a reader can state what a trait value of 0.8 means without reading code.
   2. **Expression channels accepted** — the mesh carries whatever channels the traits need (morph targets, skeleton proportions, or a hybrid — pending Open Decision 1). Test: all seven traits produce a visible difference at their extremes on a single static mesh.
   3. **Within-herd variation visible** — individuals in one herd differ. Test: a still capture of one herd shows distinguishable individuals without labels.
   4. **Herd scale** — instantiation runs at target herd size without frame-rate regression. Test: the target herd count renders within the existing frame budget. (Target count is Open Decision 9.)
   5. **Fur and pattern** — insulation reads as coat texture; optional pattern overlay. Test: a mixed-insulation herd shows sleek and shaggy individuals in one capture.
   6. **Trait LOD** — expression degrades gracefully with distance. Test: island-overview framing distinguishes two populations by scale and colour alone.
   7. **Behavioural differentiation** — trait values drive motion. Test: two populations are distinguishable at mid-distance from movement alone, with individual detail suppressed.

3. **Add a creature-specific visual verdict criterion.** This doc pins its verdicts to a fixed four-rung capture comparison at years 1 / 1,000 / 100,000 / 1,000,000. Those rungs test deep time, not embodiment. Creature rungs need their own fixture: a single herd captured at the three LOD distances (overview, mid, near). Add this alongside the existing four rungs rather than replacing them.

4. **`## Planned sequence` — splice in the creature items.** Preserve the existing eight items and their relative order; renumber as needed. The new items' internal order must be ladder order (2 → 3 → 4 → 5/6 → 7 above; rung 1 is a doc edit, not a sequence item). Where creature items sit relative to the existing eight is a scheduling call for the owner — do not invent a position. If unclear, append them and note that placement is unresolved.

**Retire:** nothing. The existing rows are accurate.

### WILDLIFE-ROADMAP.md

This is the sim-authority doc and the natural home for the trait vocabulary and the lineage DNA contract.

1. **Line 44 — enumerate the traits.** The row currently reads "Established lineages persist identity, site, seven-trait means, migration, abundance, extinction, and bounded deep-time speciation." Name the seven: body mass, leg length, foot width, insulation, coat warmth, coat lightness, horn length. Keep "means" and make the means-only limitation explicit, since variance is the proposed addition.

2. **Add capability ledger rows**, using this doc's Built / Experimenting / Planned / Deferred vocabulary:

   - **Per-population trait variance** — *Planned*. Today: means only. Target: variance simulated per axis, responding to selection pressure, drift, bottlenecks, and gene flow.
   - **Lineage DNA** — *Planned*. Today: ancestry persists as identity and a terrestrial ancestor seam for marine (line 84). Target: a compact hereditary record per population covering means, variances, trajectories, ancestral snapshots, environmental imprint, and branching history.
   - **Path-dependent selection** — *Planned*. Today: selection reads current conditions only. Target: outcomes depend on lineage history as well as present conditions.

3. **Line 51 — split the lineage UI row.** It currently reads Built for textual land and fish reporting. Keep that as Built. Add the field-notebook lineage card as *Planned*, explicitly as a successor to the textual report rather than a parallel feature. Note that the card consumes the same lineage DNA record the sim and renderer use.

4. **Add `### Lineage DNA state`**, modelled structurally on the existing `### Reef-site state` (line 104). That section already establishes the pattern of defining a state contract before building against it, and the lineage DNA needs exactly that — a fixed field layout, because a storage buffer contract cannot exist against a range. Record the proposed groups (trait means, trait variances, trajectories, ancestral snapshots, environmental imprint, lineage depth and branching) and mark the sizes as unresolved pending Open Decision 6. Do not invent a fixed layout.

5. **Speciation trigger.** The doc records "bounded deep-time speciation" as Built. The proposal makes variance the speciation trigger. Add a note that the trigger mechanism is proposed to change, and that the relationship to the shipped behaviour is unresolved (Open Decision 7). Do not mark the shipped speciation as superseded.

6. **Line 48, aerial row — hold the existing gate.** That row already says ancestry comes only after an aerial trait and energy model works. Lineage DNA must not quietly bypass this. Add a clause stating lineage DNA lands on land lineages first and reaches aerial only through the existing gate.

7. **Line 84, marine — claim the seam.** Note that the recorded origin domain and terrestrial ancestor seam is the precedent the lineage DNA generalises. This is a framing edit; it costs one clause and it prevents the lineage DNA reading as unprecedented.

8. **Asset ledger (line 64) — add an expression criterion.** The ladder is brief → source → preview → candidate → accepted, and line 64 states no fauna asset is currently a visual candidate. Nothing in that ladder requires an asset to be able to *express the traits*. Add that criterion: an accepted grazer must carry the expression channels for all seven axes plus a neutral base albedo suitable for per-instance tinting. Without this, an asset could be accepted and still be unable to show evolution.

9. **`## Planned sequence` — add variance, lineage DNA, and path-dependent selection**, in that dependency order (variance is a prerequisite for both others). Preserve existing items and numbering discipline.

### docs/SIM-RENDER-AUDIT.md

1. **Amend line 11.** Qualify the "all 7 traits mapped" claim with the per-population caveat: one trait set per herd, all individuals in a herd identical. Cite `src/landing-state.ts:743`.

2. **Add a new bullet under `## Sim Output Without Render (gaps)`:** within-population trait variation — no variance field exists in the sim, and the renderer applies one trait set per herd. This is the gap the Player Attachment note addresses.

3. **Add to the grazer bullet: the acceptance caveat.** The audit currently applies "not accepted visual assets" to swimmer and bird meshes (line 34) but not to the grazer, which reads as though the grazer mesh is accepted. It is not — RENDERER-ROADMAP.md:38 calls it a "primitive semantic trait adapter" and WILDLIFE-ROADMAP.md:64 calls the primitive grazer an integration adapter. Add the cross-reference so the three docs agree.

4. **Add to `## Planned (not implemented on either side)`**, each with the existing `**PLANNED —**` prefix: lineage DNA; per-population variance; per-instance trait expression channels; per-instance GPU trait sampling; stable instance seeds; shell-based fur; distance-based trait LOD; field-notebook lineage card; trait-driven behavioural differentiation.

5. **Add a dateline and a pointer to this plan** at the top, so the audit reads as a snapshot rather than a standing commitment.

### README.md

No edits yet. Line 29 ("one primitive-rig adapter... preserving the seam for a future Foxel/glTF rig") is directly downstream of Open Decision 1 and should change only once that resolves. Line 35's lineage panel description stays accurate until the lineage card ships.

### New documents

None proposed by this plan. Every proposal here has a natural home in an existing doc. Resist adding a creature-specific roadmap — the split between sim authority (WILDLIFE) and visual fidelity (RENDERER) already accommodates this work, and a third roadmap would duplicate both ledgers.

Separately, `docs/INLAND-WATER-DESIGN.md` captures open design notes for rivers, waterfalls, and the brackish/mangrove river-mouth zone (sim flow accumulation, channel/waterfall/plunge-pool render pieces, ocean-seam questions) — not yet reconciled with WILDLIFE-ROADMAP.md or RENDERER-ROADMAP.md.

## Open decisions

These are questions. None should be written into a roadmap as a commitment until answered.

1. **Creature asset pipeline — RESOLVED.** Morph targets confirmed. Five morph channels (body mass, leg length, foot width, insulation, horn length) plus two per-instance coat color floats (coat warmth, coat lightness), driven from a `morphTexture` (DataArrayTexture) under `WebGPURenderer`. `InstancedMesh` + `SkinnedMesh` are mutually exclusive in the Three.js WebGPU path; foot width and horn length have no natural joint-transform expression. Foxel is an early candidate authoring pipeline, not a requirement — any topology-stable export with a consistent vertex count can drive morph targets. Ladder rungs 2–5 and the RENDERER ledger rows are now unblocked.

2. **Per-instance morph weights: TSL or raw WGSL.** The Player Attachment note observes that TSL's `morphReference()` and `instanceIndex` nodes may be composable for per-instance morph weights, but that TSL's morph support may assume weights are uniform across instances, requiring a raw WGSL override. The note itself says both paths are worth prototyping. Unresolved. Only relevant if Decision 1 admits morph targets.

3. **Short-jump seed carry-forward.** Should some instance seeds persist across short jumps (1–10 years) with mortality applied, creating the impression that specific animals survived? The note is explicit that this is render-layer fiction — the sim tracks no individuals. Two sub-questions: what jump length is the threshold, and does this serve or violate THESIS §3's plausible-not-precise rule? Arguably it serves it exactly, but that is a call for the owner, not an assumption.

4. **Procedural pattern overlay.** The note marks spots, stripes, and countershading as stretch. In or out of the current sequence? If in: does pattern type derive from the sim's environmental imprint, or from a render-side biome lookup? The first makes it a sim output and constrains the lineage DNA layout; the second keeps it purely cosmetic.

5. **Lineage DNA domain scope.** Land only at first, or all three domains? WILDLIFE-ROADMAP.md:48 already gates aerial ancestry behind a working aerial trait and energy model, and marine already carries an ancestor seam (line 84). Recommend land-first, but the marine seam means the generalisation question is live now rather than later.

6. **Lineage DNA field layout.** The note proposes ~80–120 floats with several ranges unresolved: trajectories are 7 floats for velocity or 14 with acceleration; ancestral snapshots are 3 to 5 × 7 floats; environmental imprint is 8 to 12 floats. A `Float32Array` storage buffer contract needs one number, not a range. What is the fixed layout?

7. **Variance and the existing speciation trigger.** Does variance-exceeds-threshold replace the shipped "bounded deep-time speciation" trigger, or supplement it? If it replaces it, what happens to existing behaviour and its test coverage? WILDLIFE-ROADMAP.md:44 currently marks that speciation Built.

8. **Lineage card form.** Screen-space UI overlay or in-world field guide object? And does it replace the shipped textual lineage panel (WILDLIFE-ROADMAP.md:51, README.md:35) or sit alongside it? The field-notebook aesthetic is specified; the delivery surface is not.

9. **Target herd size.** The note assumes 50–200 individuals per population as the case that motivates GPU instantiation. Current rendering draws roughly seven animals per herd. What is the target, and does abundance map to instance count linearly, logarithmically, or with a cap? This number determines whether the compute pipeline is necessary or merely tidy.

10. **Trait LOD implementation and thresholds.** `THREE.LOD` or a distance branch inside the compute pass? The note offers both. And what camera distances define far, mid, and near — these need to be fixed before rung 6's success test means anything.

11. **Does the pipeline generalise?** Is the morph/instance/variance stack a grazer-specific solution, or the pattern marine and aerial adopt later? Marine currently renders six traits as one (`docs/SIM-RENDER-AUDIT.md:27`) and has the same problem. Answering this shapes how general the capability rows should be written.

12. **What "visible trait variation" meant.** THESIS.md:72's first-spike scope is ambiguous between between-population and within-population variation. The shipped code does the former; the Player Attachment note assumes the latter. Ratifying this retroactively fixes what the first spike was supposed to prove.

## Suggested execution order

**Now, no decisions required.** Trait enumeration in WILDLIFE-ROADMAP.md:44. The SIM-RENDER-AUDIT corrections — these fix a live inaccuracy and should not wait. THESIS §8 open-question additions. The marine ancestor-seam framing clause. The aerial gate clause.

**After Decisions 1, 5, and 9.** The RENDERER capability ledger split and the creature embodiment ladder. The WILDLIFE lineage DNA state section. Asset ledger expression criterion.

**After prototyping.** Decision 2 (TSL vs WGSL) resolves only by trying both, per the note's own recommendation. README.md line 29. Planned-sequence placement in both roadmaps.

**Deliberately deferred.** Decision 4 (pattern overlay) is stretch by the note's own framing and should not enter a planned sequence until the ladder reaches rung 5.
