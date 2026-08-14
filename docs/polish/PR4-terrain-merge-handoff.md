# PR #4 merge-conflict handoff — terrain-material.ts

**Status:** Blocked on a renderer decision that needs a build + **live WebGPU**
check. Prepared by Claude Code on 2026-08-14; the merge was **aborted**, the
branch is clean, nothing was pushed. This file is uncommitted and is **not** part
of PR #4 — move/commit it wherever suits you.

- **PR:** <https://github.com/mrfootandmrbear/Epoch/pull/4>
- **Branch:** `docs/stylized-cohesion-art-direction`  →  **base:** `main`
  (`origin/main` @ `217879c`, "Merge pull request #3")
- **Merge base:** `2d22874`

## Why it conflicts

The branch and `origin/main` are **two parallel renderer histories** that diverged
at `2d22874`:

- The branch carries `c5e88d2` "Fix rendered bathymetry" — terrain is displaced by
  a **render-height texture**.
- `origin/main` never received `c5e88d2`; it independently built a
  **reef-carbonate relief** system on the **same** `material.positionNode`.

So this is a real renderer integration, not a textual merge.

## Reproduce

```bash
git fetch origin
git checkout docs/stylized-cohesion-art-direction
git merge origin/main        # stops with the 3 conflicts below
# ...resolve...
git commit && git push       # updates PR #4
```

## The three conflicts

### 1. `src/terrain-material.ts` — the hard one (renderer code)

Both sides write the terrain vertex output `material.positionNode` inside
`createTerrainMaterial`, in mutually exclusive ways. Full divergence
(`git diff HEAD origin/main -- src/terrain-material.ts`):

- **Branch (HEAD) has, `main` removed:**
  - `abs` import
  - `renderHeightTexture: DataTexture` in `TerrainMaterialOptions`
  - `const edgeDistance = float(extent/2).sub(max(abs(x), abs(z)))`
  - `const renderHeight = texture(options.renderHeightTexture, terrainUv).r`
  - `material.positionNode = vec3(x, renderHeight, z)`  ← **render-height displacement**
  - `edgeDistance` is still **used downstream**: `boundaryVisibility = smoothstep(1, 14, edgeDistance)`
- **`main` has, branch lacks:**
  - Comment: "Keeping lookup independent of vertex displacement lets reef relief rise…"
  - `carbonateMottle`, `carbonateFleck`, `visibleCarbonate`, `reefDepthMask`, `reefMass`, `reefRelief`
  - `material.positionNode = positionLocal.add(vec3(0, reefRelief, 0))`  ← **reef-relief displacement**

**The collision:** a naive keep-both leaves two `positionNode` assignments in one
function; the later one (reef relief) silently clobbers the render-height
displacement. Neither `--ours` nor `--theirs` is correct on its own:

- `--theirs` (main) deletes `edgeDistance`'s definition while it is still used at
  `boundaryVisibility` → **build breaks**, and drops the bathymetry feature.
- `--ours` (branch) drops main's whole reef-carbonate relief + coloring.

**Decisions the resolver must make (then WebGPU-verify):**

1. **Compose the two displacements into one `positionNode`.** Likely intent: keep
   render-height as the terrain's base shape and add reef relief on top, e.g.
   `material.positionNode = vec3(positionLocal.x, renderHeight.add(reefRelief), positionLocal.z)`.
   ⚠️ `reefDepthMask` currently derives from `seaLevel.sub(positionLocal.y)`; once
   the surface is render-height-displaced, `positionLocal.y` may no longer be the
   rendered height — check whether it should read `renderHeight` (or
   `positionWorld.y`) instead so the reef mask sits at the right depth.
2. **Keep `renderHeightTexture` option?** If yes, every caller of
   `createTerrainMaterial` must still pass it and the render-height field must
   still be produced (`src/render-bathymetry.ts`). Check call sites — `main`'s
   callers were updated to *not* pass it. `src/landing-state.ts` auto-merged during
   the attempt; verify it wires the texture through.
3. **Keep `abs` import + `edgeDistance` + `boundaryVisibility`** (branch feature)
   unless `main` replaced boundary handling elsewhere.
4. **Keep main's reef carbonate coloring** (`carbonateMottle`/`Fleck` feed albedo).

**Verification (required before merge):** `npx tsc --noEmit` and `npm run test`
clean, then a **live WebGPU** capture on the owner's machine confirming (a) the
bathymetry boundary still reads, (b) the reef pavement/relief still rises, and
(c) the four deep-time rungs stay distinguishable. Per `CLAUDE.md`, a headless/
`--webgl` capture does **not** count for this class of change.

### 2. `RENDERER-ROADMAP.md` — canonical, owner-authored (§ "Planned sequence")

Docs-only, but this file is owner-authored — have the owner eyeball the result.
The two sides differ only in the numbered "Planned sequence":

- **Branch (HEAD)** adds the stylized-cohesion lab as **item 1** and rephrases the
  water item to "inside the selected shared grammar."
- **`main`** marks the volcanic lifecycle as **owner-accepted** ("Preserve the
  owner-accepted cumulative fixed-vent lifecycle") — newer status the branch lacks.

**Recommended union:** keep HEAD's item 1 (run the stylized-cohesion lab first)
**and** adopt main's "preserve the owner-accepted fixed-vent lifecycle" phrasing
for the volcanic item, rather than the branch's older "capture one fixed vent…"
wording. Combine; don't pick one side wholesale.

### 3. `docs/polish/LOG.md` — working log

Append-only session log; both sides added different entries from the shared
ancestor (hence the large 78–513 span). **Union both blocks** in date order — no
content is mutually exclusive. `git checkout --theirs` then re-append the branch's
entries, or hand-merge.

## Recommendation

Have an agent/owner that can **build and run WebGPU on the machine** (Cursor, or
you) do conflict #1; #2 and #3 are safe doc unions. Do not merge until #1 passes
a live WebGPU check — this is the exact case the "verify on real hardware"
invariant exists for.
