# Scorecard

**Dated:** 2026-08-12 (Phase 0 baseline)
**Backend:** WebGL2 fallback — **not the target pipeline**
**Status: PROVISIONAL.** THESIS §6 rules out WebGL2 as a visual target, so every
visual score must be re-taken on WebGPU once BACKLOG P0-2 clears.

Scale: 0–3 prototype · 4–5 visibly unfinished · 6 competent indie ·
7 professional · 8 highly polished · 9 exceptional · 10 near-impossible to
improve. **Do not inflate.** Categories that could not be honestly judged from
this session's evidence are marked `—` rather than guessed.

| Category | Score | Justification |
|---|:--:|---|
| Art direction | 5 | A coherent stylized language exists (soft faceted foliage, muted matte palette) and it is not arbitrary. But it is undifferentiated — dawn, storm and midday all resolve to the same hazy mid-tone, so the direction has no visible *intent* yet. |
| Environment | 4 | The island reads as a place, but `forest-interior` frames two trees on a bare hillside — the camera built to show a forest has no forest in it. |
| Geometry | 4 | Terrain silhouettes are uniformly soft and rounded — no cliffs, rock faces, or strata at any rung. The ocean is a finite plane with visible straight edges. |
| Materials | 4 | Near-uniform matte response across terrain, foliage and water. No differentiation between soil, rock, sand and vegetation at close range. |
| Textures | 3 | Effectively no texture detail reads at any scale; the closest shot shows low-frequency brown mottling that looks like blotching rather than ground. |
| Lighting | 4 | Single directional key plus ambient/hemisphere. Flat and low-contrast, with no directional intent and no time-of-day differentiation reaching the image. |
| Shadows | 5 | Tree shadows are present, correctly placed and reasonably soft — the most competent visual system in the set. Marked down for a suspected shadow-map band in `07-herd` and no contact shadows. |
| Image quality | 5 | Clean stills, no visible aliasing crawl, but flat and hazy overall. **Least trustworthy score on the card** — post-processing may not run identically on the fallback backend. |
| VFX | 3 | Essentially absent. No spray, spindrift, dust, or particulate anywhere. Foam exists but produces detached open-water patches that read as artifacts. |
| Animation | — | Not assessable from stills, and the one animated subject (the herd) did not render. Needs a motion-frame pass after P0-2. |
| Secondary motion | — | Same. No tree sway, grass response or water interaction could be confirmed from single frames. |
| Physics | — | Not exercised this session. |
| Collision | — | Navigation field exists in simulation (`animal-navigation.ts`) but was not visually exercised. |
| Game feel | — | No interactive pass this session; Phase 0 is capture-only. |
| Camera | 6 | Golden framings are well-composed and orbit clamps are thoughtful (the `maxPolarAngle` guard against rendering the world's underside is a real catch). Marked down only for `forest-interior` not containing a forest. |
| UI / HUD | — | Capture mode hides every panel, so none was captured. The `ui` shot set is defined but not yet built out. |
| Environmental life | 3* | Birds are flat white slivers and the water reads empty of visible fauna. **\*Partly unassessable:** land animals are correctly absent pre-drifter, so this score covers only what the captured state should contain. A fair score needs a post-drifter capture path. |
| Polish | 3 | A black screen on the target browser, a 404 on every page load, and no favicon. |
| Stability | 3 | Tests and determinism are genuinely strong (94 passing, snapshot-backed). Scored low regardless because the product does not render at all on its stated target platform. |
| Performance | — | Unmeasurable in this environment; see `DEFERRED.md`. |

**Assessed mean: 4.1** across the 14 scored categories. Categories marked `—`
are excluded rather than counted as zero or as passes.

## Honest read

The **simulation** is markedly more mature than the **presentation**. Determinism,
persistence, trait inheritance, hydrology and the deep-time resolver are
substantial, well-tested work. What the player actually sees has not caught up:
the world is legible but empty, flatly lit, and materially undifferentiated —
and right now, on the target browser, entirely black.

This is exactly the failure mode THESIS §6 was written to prevent ("Epoch
shouldn't need that pass"). The corrective is not more effects; it is making the
existing systems *read* — a finite ocean plane that doesn't announce its edges,
lighting with a stated intent, populated cameras, and material separation.

No category is at the Level 5 "independently accepted" bar, and none should be
claimed as such. Per `CLAUDE.md`, polish work prepares evidence for the owner
verdict gate; it does not pass through it.
