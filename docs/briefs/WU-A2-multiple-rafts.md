# WU-A2 — Multiple rafts and lineage roots

**Model:** Sonnet · **Size:** medium · **Depends on:** WU-A1 (must land first)

---

Work Unit: WU-A2 — Multiple rafts and lineage roots

**Read first:** `CLAUDE.md`, `docs/polish/MAP.md`, the "Rafts: seeding the
bank" section of `docs/TANGLED-BANK.md`, and these files:
`src/landing-state.ts` (the `introduceDistantDrifter` implementation at ~line
1092 and the `WorldExperience` interface at ~line 460),
`src/lineage-history.ts` (`createDrifterFounderHistory` at ~line 134 and the
`LineageState` type), `src/founder-establishment.ts`, and the founder path
through `src/outcome-resolver.ts`.
Do not explore beyond them.

## Why this exists

`landing-state.ts:1093` is a single line:

```
if (worldHistory.lineages.lineages.some((lineage) => lineage.status !== "extinct")) return false;
```

One raft, ever, unless everything already died. `docs/TANGLED-BANK.md` requires
the opposite — the player launches rafts "before the first jump, between jumps,
after an extinction event, or into a thriving ecosystem," and each successful
raft becomes a separate root in the bank. Four scenarios in that document
depend on it, including the entire second-root and predator-after-herbivore
premise.

Deleting the guard is one line. **The unit is what the guard was standing in
for:** a raft arriving into an occupied island has to face the incumbents.

## Goal

A player can launch rafts at any time. A raft into an occupied island competes
for forage with established populations and may fail, take a marginal niche,
or rarely displace an incumbent. Each successful raft is a distinct root.

## Tasks

1. **Remove the guard** and let `introduceDistantDrifter` run at any time.
   Note that lineage ids are already ordinal-based
   (`sheltered-grazer:${ordinal}`, from `lineages.length`), so distinct ids
   come for free — do not rebuild the id scheme.

2. **Add `rootId` to `LineageState`.** Every founding raft starts a root; every
   branch inherits its ancestor's `rootId`. Bump `WorldHistory` version and keep
   existing readers working. Include a per-root palette *hook* — a stable index
   or key the renderer can later read — but **do not** write any renderer code
   in this unit.

3. **Arrival into an occupied island contests forage.** Establishment must read
   what incumbent populations are already consuming at and around the arrival
   site, not just the raw forage field. Reuse WU-A1's band structure: an
   arrival into a saturated island should shift toward the failing end of the
   same three bands rather than getting a separate bespoke rule.

4. **Preserve the outcomes the design names:** failure, a marginal niche, or —
   rarely — displacement of an incumbent. Do not implement displacement as a
   coin flip; it should follow from the arrival's fitness against the
   incumbent's at that site.

## Done when

- Two rafts launched at different times both appear as separate roots in the
  lineage record, with branches correctly inheriting `rootId`.
- The **same** founder choice, launched into a saturated island, demonstrably
  fails more often than into a bare one — shown with numbers from a readout
  script, not asserted.
- Tests cover: a second raft succeeding into a bare island, a second raft
  failing into a saturated one, and `rootId` inheritance across a branch.
- WU-A1's matrix still spreads across three bands; this unit must not collapse
  it back.
- Existing lineage and gene-flow tests pass unchanged.

## Care

- **Do not let a second raft destabilise gene flow.** `outcome-resolver.ts`
  homogenizes same-island lineages. Two roots on one island must **not**
  exchange genes — they are ancestrally separate populations, and
  `docs/TANGLED-BANK.md` is explicit that roots stay "interacting but
  ancestrally separate." Check this specifically; it is the most likely silent
  bug in this unit.
- The UI currently disables the drifter button permanently after one launch
  (`main.ts` ~line 736). Re-enable it so the verb is actually reachable, but
  keep the UI change minimal — presentation of the arrival is WU-A3.

**Do not touch:** the arrival animation or camera (WU-A3). Any renderer file
beyond re-enabling the button. `presentation.ts` `GOLDEN_SHOTS`. Reconnection
or hybridization (that is WU-B2) — two roots meeting is **not** hybridization
and must not be implemented as such here.

**End with:** `npm run test`, `npx tsc --noEmit`, `npm run build`, and a
`docs/polish/LOG.md` entry with the bare-vs-saturated comparison numbers.

Do not claim any owner verdict; say "ready for owner verdict".
