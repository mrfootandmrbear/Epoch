# WU-P0-1 — Make a clean clone installable

> **Class:** Task. **Authority:** Below `docs/EXECUTION.md`. **Answers:** what this session implements.

**Model:** Cloud or local Agent (no GPU). **Size:** small. **Depends on:** nothing. **May run in parallel** with WU-4a.

---

Work Unit: WU-P0-1 — Make a clean clone installable

**Read first:** the P0-1 entry in `docs/polish/BACKLOG.md` (evidence only), `package.json`, then regenerate from the current tree. Do not explore the renderer.

## Goal

`npm install` on a clean clone succeeds without `--no-package-lock --no-save`.

## Care

The corrupt lockfile entry is an optional-platform rollup record with no `version`. Regeneration is a large diff. Afterward verify:

- `three` remains **0.185.1**
- `@dgreenheck/ez-tree` stays pinned to commit `dcf309b`

## Done when

- `rm -rf node_modules && npm install` works.
- `npm test` and `npx tsc --noEmit` still pass.
- Session rule / `CLAUDE.md` install workaround is updated or removed.

Do not bump unrelated dependencies "while you're here."
