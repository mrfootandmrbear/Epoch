# Epoch documentation

This directory is the entry point for working on Epoch. Read only the level of
detail your change needs.

## Authority hierarchy

When documents disagree, the higher row wins.

| Order | Document | Answers |
|---:|---|---|
| 1 | [PRODUCT.md](../PRODUCT.md) | What are we building, and what must remain true? |
| 2 | [ARCHITECTURE.md](ARCHITECTURE.md) | How is the product divided, and which layer owns state? |
| 3 | [EXECUTION.md](EXECUTION.md) | What is true now, what is next, and what proves completion? |
| 4 | Active brief in [`briefs/`](briefs/) | What bounded change is being executed? (`tasks/` is leftover dispatch, not the live path.) |
| 5 | Reference or archive | Why was something explored, and what evidence remains useful? |

Code and tests describe present mechanics but do not silently change product
direction. If implementation invalidates a higher-level document, update that
document in the same change or surface the conflict.

## Document classes

- **Contract:** `PRODUCT.md`, `ARCHITECTURE.md`, and `EXECUTION.md`. These are
  maintained and authoritative.
- **Reference:** Narrow technical or design material linked by a contract. It
  may explain a subsystem but cannot set repo-wide priority.
- **Task:** A bounded implementation brief with a finish condition. Remove or
  archive it when complete.
- **Archive:** Historical rationale, audits, plans, and completed handoffs. It
  must carry an archive banner and cannot claim live status.
- **Asset package documentation:** Lives with the asset under
  `assets/ecosystem/<asset-id>/` and follows the ecosystem asset workflow.

## Writing rules

Every new maintained document must state:

1. its class and authority;
2. the question it answers;
3. its owner or update trigger;
4. exact evidence or completion conditions for status claims.

Do not create another roadmap, status ledger, audit, or alignment plan. Update
`EXECUTION.md`. Prefer links to duplicated explanations. Use **accepted** only
for an owner-reviewed visual result; use **verified** for automated evidence.

## Existing references

- [RENDER-SYSTEM-MAP.md](RENDER-SYSTEM-MAP.md) — renderer dataflow reference.
- [GALAPAGOS-HOTSPOT-PLAN.md](GALAPAGOS-HOTSPOT-PLAN.md) — world-generation
  rationale and proposed architecture.
- [OCEAN-COLONIZATION-AND-DOMAIN-TRANSITIONS.md](OCEAN-COLONIZATION-AND-DOMAIN-TRANSITIONS.md)
  — marine and cross-domain rationale.
- [DISTANT-DRIFTER-DESIGN.md](DISTANT-DRIFTER-DESIGN.md) — founder-arrival design.

The former root `THESIS.md`, renderer/wildlife roadmaps, audits, studies, and
polish ledgers are retained temporarily as historical sources. Their status and
priority claims are retired; migrate useful facts into the three contracts when
those areas are next changed.

