# The Tangled Bank — build plan

> **Class:** Plan. **Authority:** none. `docs/EXECUTION.md` remains the only
> source of priority and gate status. This file schedules work toward
> `docs/TANGLED-BANK.md`; it does not mark anything satisfied.
> **Written:** 2026-08-16.

## What this plan covers

`TANGLED-BANK.md` describes the player-facing artifact: a branching family
diagram grown by sculpting, launching rafts, and jumping. This plan states
what already exists, what does not, what order to build it in, and which
model runs each unit.

**Constraint accepted up front:** execution runs on Sonnet and Haiku to keep
token cost down. That is workable, but it changes *how* units must be written,
not just who runs them — see "Model routing" and "Session brief template".

## Gap analysis

### Already built (renderer-independent, tested)

| Tangled Bank concept | Where it lives | State |
|---|---|---|
| Lineage nodes with parent, generation, status | `lineage-history.ts` | Built |
| Branch cause recorded (vicariance / dispersal, dated, located) | `lineage-history.ts` `LineageOrigin` | Built |
| Isolation as the branching driver, not elapsed time | `outcome-resolver.ts` | Built, 2026-08-15 |
| Gene flow homogenizing same-island lineages | `outcome-resolver.ts` | Built |
| Drift in isolated populations | `outcome-resolver.ts` | Built |
| Land components, saddles, dated connection episodes, `islandAt` | `island-geography.ts` | Built, 35 tests |
| Hotspot chain producing new islands over deep time | `archipelago-history.ts` | Built, 40 tests |
| Migration that cannot cross water | `outcome-resolver.ts` + `islandAt` | Built, 2026-08-15 |
| Sculpt / Jump verbs | `main.ts`, `landing-state.ts` | Built |
| Raft with player founder choices | `founder-profile.ts`, `founder-establishment.ts`, `distant-drifter-renderer.ts` | Built |
| Text lineage panel | `lineage-report.ts`, `#lineage-panel` | Built |

The simulation half of "isolation makes the bank branch" is genuinely done.
That is the expensive part and it is behind us.

### Not built

Ranked by whether the rest of the plan depends on it.

1. **Founder viability does not discriminate — nothing populates the bank.**
   `docs/polish/LOG.md` (2026-08-15 correction) records that all 60
   `FounderChoices` combinations go extinct on a single 1,000,000-year jump,
   and that no jump-length strategy threads it.
   `scripts/founding-split-readout.ts` reproduces this.

   **Owner intent, recorded 2026-08-16:** failure is supposed to depend on the
   *match* between the drifter the player picked and the world they built — an
   arid small terrestrial founder arriving at an unsuitable island either
   adapts or fails, and that is the reward loop. So the defect is not "founders
   die"; it is that **outcome does not vary with the player's choice**. A
   uniform 60-of-60 extinction teaches the player nothing and makes the choice
   decorative. **Every other item on this list is untestable until outcomes
   spread.**
2. **Only one raft, ever.** `landing-state.ts:1093` returns `false` from
   `introduceDistantDrifter` if any lineage is not extinct. "Launch into a
   living ecosystem", "second root", "predator after herbivore" — all
   hard-blocked by that one guard, plus everything the guard is standing in for
   (arrival into an occupied island, competition for forage).
3. **No reconnection outcomes.** Nothing in `outcome-resolver.ts` handles two
   lineages meeting when a barrier disappears. Competition, coexistence, and
   hybridization are all absent. Hybridization additionally needs the lineage
   record to stop being a strict tree — a merged branch has two parents.
4. **Habitat pressure signatures are not implemented.** The 8-row table in
   `TANGLED-BANK.md` (high+foggy+rocky → stocky/insulated/grip feet, etc.) does
   not exist as authored pressures. `EXECUTION.md` item 2 is explicit that
   path-dependent selection is currently only "inherited-trait blending toward
   the new island's habitat".
5. **No bank diagram.** `lineage-report.ts` emits a text change list. There is
   no diagram, no roots, no dead wood, no filters, no two-population compare,
   no habitat overlay, no plain-language pressure summary.
6. **No domain transitions.** Land → shore → wading → swimming → aquatic, the
   air ladder, the flightlessness ladder: none exist. No `domain` concept in
   the trait model at all.
7. **No second trophic role.** One grazer family. Predator-prey, and therefore
   the "cross-domain food web" scenario, has no substrate.

### Sequencing judgment

Item 1 is also the blocker on `EXECUTION.md` order-of-work item 5. **The
Tangled Bank push and the current declared objective share the same first
task.** That is the reason to start here rather than treating this as a new
track: Phase A below closes the existing objective's blocker as a side effect,
so nothing is being jumped ahead of.

Items 6 and 7 are explicitly listed under "Deferred until this proof clears"
in `EXECUTION.md`. **This plan keeps them deferred** and stops at item 5. Say
so out loud to anyone who reads `TANGLED-BANK.md` and expects penguins in this
push — they are the design's horizon, not this build's scope.

## Model routing

Honest assessment, since the whole plan rests on it.

- **Sonnet** — all simulation logic, all resolver changes, the bank diagram,
  anything touching `outcome-resolver.ts` / `landing-state.ts` /
  `island-geography.ts`. These files are 700–1,500 lines with real invariants;
  a wrong edit here is expensive to find later.
- **Haiku** — narrow, fully specified, single-file work with an obvious test:
  filter predicates, label/copy generation, a pure data selector against a
  stated type, capture-set additions, doc updates. Haiku in a 122-file repo
  without a precise brief will re-explore and cost more than it saves.
- **Opus (this seat)** — planning, arbitration when a unit's findings
  contradict the plan, and writing the session briefs. Not implementation.

The savings come mostly from *not re-exploring*, not from the model tier.
`CLAUDE.md`'s "do not re-explore the repository" rule and `MAP.md` are what
make Sonnet affordable here; enforce them in every brief.

**`MAP.md` is stale** (dated 2026-08-12, says "38 modules / 379 tests"; there
are now 122 files in `src/` and the counts have moved). Refreshing it is
WU-0 below and it pays for itself immediately.

## Work units

One Work Unit per session, per `CLAUDE.md`. Each must end with tests passing,
`npx tsc --noEmit` clean, and a `docs/polish/LOG.md` entry.

### Phase 0 — make lightweight execution possible

**WU-0 · Refresh `docs/polish/MAP.md`** · Haiku · small
Update module list, line counts, test counts, and the 2 km world facts. Add a
short "lineage and population" section naming `lineage-history.ts`,
`outcome-resolver.ts`, `island-geography.ts`, `founder-establishment.ts` and
what each owns. No source changes.
*Done when:* a fresh session can name the right file for a lineage change
without globbing.

### Phase A — unblock the bank (nothing else can start)

**WU-A1 · Make founder viability discriminate on choice × world** · Sonnet · medium
The 2026-08-15 open question is answered (owner, 2026-08-16): drifters are
*meant* to fail when the player's pick does not suit the island. The unit is
therefore a balance unit, not an investigation. Work renderer-independently
through `scripts/founding-split-readout.ts`.

Produce the choice × world matrix first — all 60 `FounderChoices` against at
least three deliberately different island states (bare young volcanic, wet
vegetated highland, arid lowland) — with the numbers behind each outcome
(intake vs. break-even, adaptation rate vs. abundance decay). Then tune
`founder-establishment.ts` so the matrix spreads.

*Done when:* on at least one island state, a well-matched founder establishes
and a deliberately mismatched one fails, reproducibly, through the same
resolver a player's click uses — **and** the failure is attributable to a
named mismatch (food source, size band, or origin climate against the site's
forage, moisture, and elevation), not to a global margin. Regression tests pin
both a success and a matched failure. **This also closes `EXECUTION.md` item 5's
blocker.**

*Explicitly not the goal:* making founders survive. A founder that survives
everything is the same defect with the sign flipped.

#### Resolved design decision — adapt vs. fail (owner + PM, 2026-08-16)

The open "is adaptation reachable inside a jump?" question is settled as a
design decision, not left to tuning.

**Three bands, with the middle one as the design.**

1. **Well-matched** — establishes, then adapts. The player's read was right.
2. **Marginal** — contested. Adaptation genuinely races abundance decay and
   either can win. **Most founder choices on most islands should land here.**
3. **Absurd mismatch** — fails fast and legibly (an arid small grazer on bare
   young basalt with no forage).

Bands 1 and 3 exist to make band 2 mean something. Band 2 is where the
emergent gameplay lives.

**The width of band 2 is a single named tuning parameter.** Start it wide —
generous, close to "everything has a chance" — so the mechanic is legible
while it is being designed, then narrow it against evidence from real play.
It must stay one parameter, not diffuse into a dozen margins, or it cannot be
narrowed later.

**Adaptation must therefore be reachable within a jump.** The LOG records
`traitAdaptationRate(1) === 0` exactly, and adaptation climbing slower than
abundance decays at every tested jump length. Under this decision that is a
defect in scope for this unit, not an acceptable outcome: if the founder's
fate is fixed at the moment of choice, band 2 does not exist and the drifter
is a lottery ticket.

**Prior art this follows.** *Evolution* / *Nature* reveal the food supply
before traits are committed; *Niche* shows habitat requirements beside the
animal's stats. Both place the information **before** the choice, and both
read as fair for that reason. *Spore* is the counterexample (no failure state,
so no choice has weight); *Thrive* is the other (real adaptation, opaque
failure, players bounce).

**Ruled out:** adaptation points, mutation currency, or anything the player
spends on a creature. It breaks the four verbs in `TANGLED-BANK.md` — the
player would be touching the creatures.

**WU-A1b · Founder match readout** · Haiku · small · depends on WU-A1
A diagnostic readout in the existing `#experience` drifter panel, shown before
launch: what this island currently offers, what the selected founder needs,
and a plain-language verdict — *"sparse forage, wet highlands; an arid grazer
will struggle here."* Reads the existing forage field, world snapshot, and
founder profile; no new simulation.
*Done when:* changing any of the three drifter dropdowns changes the verdict,
and the wording never states a probability or predicts the outcome.
*Care:* this describes the island, it does not forecast. A percentage or a
predicted result destroys the surprise that makes band 2 worth playing. Not a
tutorial — no prose onboarding, no modal.

**WU-A3 · The raft arrives as a moment** · Sonnet · medium · independent of A1/A2
Owner request, 2026-08-16: the player should *see* the raft arrive, in the
spirit of the existing reveal. `distant-drifter-renderer.ts` already models the
raft correctly (logs, greenery, three founders); backlog **LW-5** files the
gap as framing, not modelling — at the default camera it is a speck at world
`(92, sea, 86)` and the zoom clamps well back, so the founder cohort never
resolves. Build the arrival beat: raft approach, a camera treatment that brings
the cohort to a readable scale, and a hand-off back to gameplay framing.
*Done when:* launching a raft in the live app produces an arrival the player
can watch and read the founders from, screenshotted for the owner.
**Owner visual verdict required.** Closes LW-5.
*Care:* must stay inert under `body.capture-mode` and must not break the fixed
capture cameras.

**WU-A2 · Multiple rafts** · Sonnet · medium
Remove the `landing-state.ts:1093` single-lineage guard and build what it was
standing in for: a raft arriving into an occupied island competes for forage
with incumbents, and may fail, take a marginal niche, or rarely displace.
Each successful raft becomes a distinct **root** in the lineage record
(`rootId` on `LineageState`), with a per-root palette hook the renderer can
read later.
*Done when:* two rafts launched at different times both appear as separate
roots; a raft into a saturated island demonstrably fails more often than the
same raft into a bare one; tests cover both.

### Phase B — the mechanics that make the bank tangled

**WU-B1 · Lineage record becomes a graph, not a tree** · Sonnet · medium
Add `parentIds` (plural) and a `merged` event to `lineage-history.ts`, keeping
`parentId` working for existing readers. Pure data model plus tests; no
resolver behaviour change in this unit. Separated deliberately so WU-B2 is not
also a schema migration.
*Done when:* `WorldHistory` version bumps cleanly, all existing lineage tests
pass unchanged, and a merged node round-trips.

**WU-B2 · Reconnection outcomes** · Sonnet · large — the biggest unit here
When `island-geography` reports two previously separate habitats rejoined,
classify the meeting from divergence time and niche overlap into
**competition** (weaker branch contracts or ends), **coexistence** (both
persist, limited gene flow), or **hybridization** (branches merge, offspring
carries traits from both, most likely at short divergence times). Record the
cause on the node the way `LineageOrigin` already records isolation cause.
*Done when:* a test drives all three outcomes from terrain history alone, and
the hybrid's traits are demonstrably a blend, not a re-roll.
*Care:* this is the design's headline mechanic. Do not fold anything else in.

**WU-B3 · Habitat pressure signatures** · Sonnet · medium
Implement the 8-row signature table as authored pressures with stated costs, so
each expressed trait difference has a named cause — which `EXECUTION.md`'s
"Definition of done" already requires and currently is not met.
*Done when:* two populations on deliberately different signatures diverge along
the traits the table names, and each divergence can be traced to an authored
pressure rather than a generic optimizer.

### Phase C — the bank the player actually looks at

**WU-C1 · Bank selector** · Haiku · small
A pure renderer-independent function: `LineageHistory` + `WorldHistory` → bank
nodes, edges (including merges), roots, events, and per-node island/time/status
/domain tags. No DOM. Fully specified by WU-B1's types.
*Done when:* snapshot tests cover multi-root, extinct, and merged shapes.

**WU-C2 · Bank diagram** · Sonnet · large
Render the selector's output as the diagram: multiple roots visually distinct,
living branches vs. dead wood, branch points annotated with the terrain event
that caused them, merges drawn as merges. Inline SVG in the existing panel
frame; must respect `body.capture-mode` hiding like the rest of the UI.
*Done when:* a played sequence produces a readable diagram, screenshotted for
the owner. **Owner visual verdict required — this is the game's primary
artifact and cannot self-certify.**

**WU-C3 · Bank filters** · Haiku · small
Island / time / status / domain filters over WU-C1's output.
*Done when:* each filter narrows the diagram and the tests pin the predicates.

**WU-C4 · Per-population detail** · Sonnet · medium
Plain-language pressure summary ("isolated on a fog-fed highland for 200,000
years; body mass increased, insulation thickened"), ancestor/descendant
silhouette comparison, habitat overlay on the terrain map, lineage distance
between any two selected nodes.
*Done when:* the causal gate in `EXECUTION.md` can actually be attempted — a
reviewer reads only this surface and recounts geology → isolation → adaptation.

### Deferred out of this push (stated, not forgotten)

Domain transitions (water / air / flightlessness ladders), predator-prey and
the second trophic root, and cross-island archipelago inheritance beyond the
dispersal branching that already exists. All three are named in
`TANGLED-BANK.md` and all three sit behind `EXECUTION.md`'s "Deferred until
this proof clears". Reopen after WU-C4 clears its gate.

## Estimated shape

Eleven units, one session each, most Sonnet. Phase A gates everything else.
Owner visual verdicts are needed at **WU-A3** (arrival) and **WU-C2** (the bank
diagram) — budget review time at those two points, not earlier.

## Written briefs

Dispatch-ready briefs live in `docs/briefs/`. Written so far:

| Unit | Brief | Model | Depends on |
|---|---|---|---|
| WU-0 | `briefs/WU-0-map-refresh.md` | Haiku | — |
| WU-A1 | `briefs/WU-A1-founder-viability.md` | Sonnet | — |
| WU-A1b | `briefs/WU-A1b-founder-match-readout.md` | Haiku | WU-A1 |
| WU-A2 | `briefs/WU-A2-multiple-rafts.md` | Sonnet | WU-A1 |
| WU-A3 | `briefs/WU-A3-raft-arrival.md` | Sonnet | — |

WU-0, WU-A1 and WU-A3 can run in any order or in parallel. Phase B and C
briefs are written after WU-A1 reports, because its matrix may change what
WU-B3 has to do.

## Session brief template

Every unit is dispatched with exactly this, to stop a lightweight model from
re-deriving context:

```
Work Unit: <ID> — <title>
Read first: CLAUDE.md, docs/polish/MAP.md, and <the 2-4 named source files>.
Do not explore beyond them.
Goal: <one sentence>
Done when: <the unit's stated criteria>
Do not touch: <named files/systems out of scope>
End with: npm run test, npx tsc --noEmit, a docs/polish/LOG.md entry.
Do not claim any owner verdict; say "ready for owner verdict".
```

## Risks

- **WU-A1's adaptation rate may resist tuning.** The design decision above
  requires adaptation to be reachable inside a jump; the current
  `traitAdaptationRate` is not. If it cannot be made reachable without
  destabilising established populations, that is a structural finding about
  `founder-establishment.ts`, and the unit should stop and report rather than
  widen band 2 until failures disappear.
- **Band 2 could diffuse into many margins.** If the marginal band ends up
  spread across several constants, it can never be narrowed later with
  confidence. Keep it one named parameter; reject the unit if it is not.
- **WU-B2 is the one unit that could exceed a Sonnet session.** If it does,
  split it by outcome — competition first, hybridization second — rather than
  escalating the model.
- **The flat unlit newest shield** (`EXECUTION.md` "Open defects") makes
  populations on new islands hard to read. It will bite during Phase C
  screenshots. Not scheduled here; expect to schedule it before the WU-C2
  verdict.
- **Haiku scope creep.** If a Haiku unit starts reading files outside its
  brief, that unit was mis-specified — rewrite the brief, do not upgrade the
  model and move on.
