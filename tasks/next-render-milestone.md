# Next render milestone — Climate & time as one atmospheric identity

> **Superseded as next work on 2026-08-14.** The implementation and its evidence
> remain valid, but broad climate differentiation is no longer Epoch's product
> direction. The next milestone is the Galápagos hotspot-archipelago and
> two-shield evolutionary proof in `docs/GALAPAGOS-HOTSPOT-PLAN.md`. Future
> atmosphere work should reinterpret this machinery for trade winds, garúa,
> elevation zones, upwelling, and regional ocean state.

> **One sentence:** Make the whole landing state sit inside a single
> climate-and-time-driven atmosphere — light colour/direction/intensity, sky,
> aerial-perspective haze (colour *and* density), water base colour, and grading
> all resolved from the landing's climate foundation and sun state so every layer
> (terrain, water, vegetation, herds, reef) is lit by one coherent mood — giving
> the above-water world the unifying medium the underwater reef already has.
>
> **Recommended by:** whole-world render-architecture investigation, 2026-08-13.
> Evidence is real-WebGPU still frames (browser pane, `time=42`) + full code
> trace. See `docs/RENDER-SYSTEM-MAP.md` for the architecture this builds on.
> **Status:** Implemented 2026-08-13; automated verification complete, visual
> evidence and owner verdict still required. This document remains the design
> and acceptance spec for that verdict.

---

## 1. The player-visible problem

The loop is `form → jump → look`. The payoff is the **look** — the moment a
landing state resolves and reads as one place with a history. Today the
individual systems are competent, but the landing does not cohere into one world
because **the atmosphere is a constant**:

- A **cold-arid** landing and a **warm-wet** landing differ on the *ground*
  (vegetation density, soil colour, reef vigour, sea level) but share an
  **identical sky, sun, light colour, haze, and water mood**. The *place*
  changes; the *air and light* do not. Climate reads as a recolour, not a
  different world.
- **Dawn / day / storm** resolve to nearly the same hazy mid-tone. The warm dawn
  tint reaches the sky dome and the birds but not the terrain or water; "storm"
  only dims and cools the sky (and sits over a mirror-flat sea).
- Above water there is **no unifying medium**. Underwater, the shared
  water-column optics (extinction + haze + caustics) put every element in one
  substance and the reef view is the most coherent, "shot" image in the game.
  Above water, terrain / ocean / vegetation / herds are each individually plausible
  but are not visibly *in the same air*.

This is exactly the failure the brief names: "a collection of individually
competent rendering systems" rather than "one stunning, causally coherent living
world." Light and atmosphere are the one layer that touches everything at once,
so fixing them is the highest-leverage way to make the whole compose.

## 2. Historical rationale for this completed milestone

- **Maximum cross-system leverage, minimum surface area.** One authority
  (`sampleAtmosphere` + the lights/uniforms it feeds) already reaches terrain,
  water, vegetation, herds, and reef every frame (`docs/RENDER-SYSTEM-MAP.md` §1,
  §5). Widening its *inputs* from time-only to climate+time changes the entire
  composition without touching a single per-layer renderer's geometry.
- **The data already exists and is causally grounded.** Simulation already
  resolves nine rainfall×temperature foundations and a committed `ClimateForces`
  per landing (`environment.ts`, `climate.ts`). This is render-facing sim state
  that is currently *visually silent in the air* — so lighting it is legible
  causality, not arbitrary spectacle (satisfies THESIS §6's "stylized, not
  arbitrary").
- **It uplifts every other candidate.** Rough seas (LW-7), deeper vegetation, or
  a volcanic chronosequence all land better under directional, climate-tinted
  light than under the current flat fill. Doing atmosphere first is not
  opportunity cost — it is the multiplier.
- **It directly serves deep-time legibility**, the THESIS §5 load-bearing
  requirement, by giving distinct climates (which the player *chose* as forces)
  distinct moods.

## 3. Evidence

**Runtime (real WebGPU, browser pane, `time=42`):**

- `?shot=whole-island&fixture=cold-arid-exposed-low` vs
  `?shot=whole-island&fixture=warm-wet-calm-high`: ground/vegetation/reef differ;
  **sky, light, haze, and water colour are identical**.
- `?shot=dawn` vs default day vs `?shot=storm`: all three are the same hazy
  mid-tone; storm sits over a glassy sea.
- `?shot=reef&fixture=mature-warm-reef`: the one genuinely coherent, atmospheric
  image — because a single medium contains everything. This is the target feel,
  above water.

**Code:**

- `src/atmosphere.ts:111` — `sampleAtmosphere(elapsed, profile)` takes **no
  climate argument**; sun/ambient/fog colours are functions of solar elevation
  and a fixed day/dawn/storm profile only.
- `src/main.ts:141` — the *only* climate→air path is `resolveHeightFog(climate)`
  (density/ceiling), a bounded lower-atmosphere modifier. Colour is not climate-driven.
- `src/post-processing.ts:37` — `COLOR_TREATMENTS` grading deltas are sub-threshold
  (dawn +4.5% warm; storm −10% sat).
- Before implementation, `src/fft-water.ts` and `atmosphere-renderer.ts` read
  time-driven `fogColor`/`ambientColor` only. They now consume the shared
  resolved atmosphere and climate mood; this row records the original evidence.

## 4. Desired visual result

Same island geometry and same fauna, but the **mood is authored by the climate
the player set**, and by time of day, as one coherent system:

- **Cold-wet:** cool, low-contrast, desaturated key; dense, high, blue-grey
  aerial perspective; steel/slate water; short fog ceiling. Reads *raw and cold*.
- **Warm-arid:** warm, hard, high-contrast key; thin, pale, warm haze; bright
  sky; deep visibility. Reads *bright and exposed*.
- **Warm-wet (tropical):** warm key, humid green-blue haze, luminous cyan
  shallows. Reads *lush*.
- **Cold-arid:** pale, flat, hard light; thin cold haze; dark cold sea.
- **Dawn / dusk:** a genuine low, long, warm/golden key that **reaches the ground
  and water**, not just the dome; long raking shadows (the `dawn` camera already
  shows the shadow geometry works — it just lacks the colour and low angle).
- **Storm** (if paired with LW-7 later): heavy desaturated key, low ceiling, dim
  exposure — over a sea that can actually roughen.

The default **temperate / day** look must remain **visually identical** to the
current owner-accepted baseline (see §6 non-goals).

## 5. Scope

**In scope:**

1. Add a **climate mood input** to the atmosphere authority: extend
   `sampleAtmosphere` (or wrap it) to take the landing's `ClimateForces` /
   resolved foundation, producing a `ClimateMood` that modulates: key-light
   colour temperature & intensity, ambient/hemisphere colour & intensity,
   sky horizon/zenith bias, **aerial-perspective colour and density**, water base
   colour bias, and the grading tint/sat/contrast.
2. **Make aerial perspective climate-driven**, colour + density, on both the
   scene fog node and the ocean's distance fade / far-water skirt, so distance
   reads as *this climate's air*.
3. **Give dawn/dusk a real low golden key** that reaches ground and water
   (currently the dawn profile's sun sits at elevation 0.2 and its warmth is
   washed out before it reaches surfaces).
4. **Couple the two lighting authorities to one mood struct** so land (scene
   lights) and water (analytic uniforms) cannot drift (`RENDER-SYSTEM-MAP` §5).
5. Wire the mood through `advance()`/`updateAtmosphere` so a jump into a new
   climate visibly changes the air, and add fixtures.

**Explicit non-goals:**

- **Rough seas / sea-state (LW-7).** Amplitude, storm wind tier, crest foam — a
  separate milestone. This one may *recolour* a storm sky but must not touch FFT
  amplitude or `WIND`.
- **Clouds / volumetrics / god rays.** Deferred by `RENDERER-ROADMAP` and
  `INLAND-WATER-DESIGN`.
- **New shadow strategy / cascades.** Keep the single island shadow map.
- **Any change to simulation.** Climate forces, the 9 foundations, and
  `resolveHeightFog` semantics are read, not rewritten. No new sim field.
- **Deep-time terrain magnitude or reef seeding** (a different candidate).
- **Vegetation density / new geometry.**
- **The fish/seagrass-in-water lighting mismatch** (`docs/RENDER-SYSTEM-MAP.md`
  §8) — both submerged marine organisms skip the shared submerged optics. Real,
  but a separate small bug fixed by routing `fish-renderer.ts` and
  `seagrass-renderer.ts` through `ReefWaterUniforms`, not by this milestone.

## 6. Do-not-break (accepted evidence that must remain unchanged)

- **Sky / horizon / solar-arc / far-water continuity** — owner-accepted
  2026-08-13 (`RENDERER-ROADMAP.md:26`). The default **temperate+day** render
  must be pixel-comparable to the accepted `?shot=whole-island&years=10000`
  baseline. Climate mood is an *additive modulation*; at temperate/day all
  deltas must be ≈0.
- **Underwater reef** (`?shot=reef&fixture=mature-warm-reef`, owner-accepted).
  Mood may tint the *above-water* water column and shallow shelf; it must not
  disturb the submerged extinction ratios or caustic behaviour that carry the
  accepted look. Reef already tints its haze toward `sunColor` at 0.06 — extend
  that path, don't replace it.
- Cross-population herd read, accepted marsh-grazer, accepted reef family: unaffected.

## 7. Affected files & systems

- `src/atmosphere.ts` — add climate mood; keep the pure time-of-day path intact
  as the temperate baseline.
- `src/main.ts` — `updateAtmosphere()` / `applyCommittedHeightFog()` pass climate
  mood to lights, ocean (`updateAtmosphere`), reef (`setAtmosphere`), fog, and
  `renderPipeline.setProfile`. This is the one sync point (§5 hidden coupling).
- `src/atmosphere-renderer.ts` — sky horizon/zenith accept mood bias.
- `src/fft-water.ts` — `updateAtmosphere` accepts mood: water base colour + aerial
  fade colour/onset.
- `src/post-processing.ts` — `COLOR_TREATMENTS` become climate×time, or a mood
  tint multiplies the profile treatment.
- `src/environment.ts` / `src/climate.ts` — expose the resolved foundation / a
  small `climateMood()` mapping (read-only).
- `src/environment-fixtures.ts`, `src/presentation.ts` — add capture fixtures.
- **New tests:** `src/atmosphere.test.ts` (extend), a new `climate-mood.test.ts`.

## 8. Data contract (sim → render)

Sim stays authoritative; render derives a **pure, bounded** mood. Proposed:

```ts
// derived, not persisted; a pure function of already-authoritative inputs
interface ClimateMood {
  keyTint: Color;        // multiplies sun colour (≈white at temperate)
  keyIntensityScale: number;   // 1.0 at temperate
  ambientTint: Color;
  ambientIntensityScale: number;
  hazeColor: Color;      // aerial-perspective colour (air + water distance)
  hazeDensityScale: number;    // multiplies fog density & pulls aerial onset in
  waterTint: Color;      // bias applied to ocean base + shallow shelf
  grade: ColorTreatment; // tint/sat/contrast, composed with time profile
}
function climateMood(forces: Readonly<ClimateForces>): ClimateMood; // pure, bounded
```

Rules: `climateMood(DEFAULT_CLIMATE)` ⇒ identity (all tints white, all scales 1,
grade = today's `day`). Every output clamped. Its input is already computed and
free: `foundationalClimateIdentity(climate)` (`src/environment.ts:52`) returns
one of the nine `${temperature}-${rainfall}` labels, and the resolved
`EnvironmentField.climateIdentity` already carries it per landing but reaches no
renderer's atmosphere. `climateMood` reads `ClimateForces` / that label only; it
never reads geometry, meshes, or the renderer, and never writes world state. This
is the concrete "render-facing sim field with no atmospheric expression" the
milestone lights up (`docs/RENDER-SYSTEM-MAP.md` §6).

## 9. Proposed rendering architecture

- One `ClimateMood` computed per jump (in `advance()`), stored beside
  `committedClimate`, and combined **every frame** with the time-of-day
  `AtmosphereState` inside `updateAtmosphere()`. Combination order:
  `finalSunColor = timeState.sunColor × mood.keyTint`, etc. This preserves the
  existing time cycle and layers climate on top.
- Feed the combined result to **all sinks in one place** (the existing
  `updateAtmosphere` body) so the two lighting authorities can never diverge.
- Aerial perspective becomes `mix(scene, mood.hazeColor, f(distance × mood.hazeDensityScale))`
  reusing the existing fog node and the ocean's `aerial` smoothstep — no new pass.
- Grading: `finalTreatment = compose(timeProfileTreatment, mood.grade)`.

No new render passes, no new draw calls, no new buffers → **zero draw-count and
near-zero frame-cost impact** (uniform writes only).

## 10. Technical risks (WebGPU / TSL / three 0.185.1)

- **Uniform vs recompiled node graphs.** Mood must drive **uniforms** already in
  the graphs (colours/scales), not restructure TSL node trees per climate, or
  each climate triggers a WGSL recompile/stall. All target values are already
  uniforms (`sunColor`, `fogColor`, `horizonColor`, grade uniforms) — keep it that way.
- **Two-authority sync regressions** (`RENDER-SYSTEM-MAP` §5) — the main hazard.
  Mitigate by routing every sink through one function and asserting in a test
  that ocean/reef/land receive the same mood object.
- **Tone-mapping interaction.** ACES + exposure 0.6 will compress saturated
  tints; validate final saturation on-screen, not in the mood struct.
- **Do not double-fog the submerged volume** — the `aboveWaterFog` mask
  (`main.ts:139`) must keep gating any density increase.
- **Bloom threshold** (0.12) — a brighter warm-arid key must not push foam/pale
  shelf over it (the reason it was set low); re-check `?shot=dawn`.

## 11. Performance budget

- **Draw calls:** unchanged (~15 whole-island). Verify `renderer.info.render.calls`
  is identical before/after at the same fixture.
- **Frame cost:** uniform writes per frame only; no new passes/geometry/textures.
- Target unchanged: 60 fps @ 1080p WebGPU (owner-measured; pane fps is not valid).

## 12. Required fixed fixtures (add; never edit existing golden entries)

For each of at least four contrasting foundations, at day and at dawn, at the
`whole-island` camera and one near camera:

- `?shot=whole-island&fixture=cold-wet-*` (new), `warm-arid-*`, plus the existing
  `cold-arid-exposed-low`, `warm-wet-calm-high`, `mild-temperate-exposed-present`.
- Add a **dawn variant** of the atmosphere so dawn is judged per-climate
  (e.g. `?shot=whole-island&fixture=warm-wet-calm-high&sky=dawn` — a new capture
  param, or a `dawn`-profiled fixture), plus one shoreline camera to judge the
  water tint and one `reef`/`reef-above` to prove the underwater accepted look is
  untouched.
- Regression pin: `?shot=whole-island&years=10000&time=42` (the accepted horizon
  baseline) must be visually unchanged.

## 13. Automated regression tests

- `climate-mood.test.ts`: `climateMood(DEFAULT_CLIMATE)` is the identity (tints =
  white within ε, scales = 1, grade = `day`); all outputs clamped to bounds for
  all 81 climate combinations; monotonic sanity (cold→warm shifts key hue warmer;
  wet→arid lowers haze density).
- Extend `atmosphere.test.ts`: composed sun/ambient/fog colours equal the current
  values at `DEFAULT_CLIMATE` (baseline-preservation lock).
- `post-processing.test.ts`: composed treatment at temperate+day equals today's
  `day` treatment.
- A sync test asserting land/ocean/reef receive one mood instance per update.
- Keep 243/243 green; `tsc --noEmit` and `vite build` clean.

## 14. Human visual-review questions (owner verdict gate)

1. Do four contrasting climates now read as **four different worlds' air/light**,
   not one world recoloured?
2. Does dawn light **reach the ground and water** as a low golden key (not just
   the sky)?
3. Is the accepted **temperate+day** whole-island frame unchanged?
4. Is the accepted **underwater reef** unchanged?
5. Does any climate look *arbitrary* rather than like plausible weather/air
   (THESIS §6)?

## 15. Staged implementation sequence (independently verifiable checkpoints)

1. **Identity scaffold.** Add `ClimateMood` + `climateMood()` returning identity
   for all inputs; thread it through `updateAtmosphere` combining as ×white/×1.
   *Checkpoint:* every fixture is pixel-identical to today; tests green. (Pure
   plumbing; safe rollback point.)
2. **Aerial perspective by climate.** Wire `hazeColor`/`hazeDensityScale` into the
   fog node + ocean aerial fade only. *Checkpoint:* wet climates read hazier,
   arid clearer; temperate unchanged.
3. **Key + ambient tint by temperature/rainfall.** *Checkpoint:* cold cools,
   warm warms, on ground *and* water; temperate unchanged.
4. **Water base tint + shallow shelf.** *Checkpoint:* tropical shallows luminous,
   cold seas slate; reef underwater untouched.
5. **Dawn low golden key** reaching surfaces + grading composition. *Checkpoint:*
   dawn fixtures read as dawn.
6. **Fixtures + tests + evidence pass**, then hand to owner verdict.

Each checkpoint is a valid stopping point; steps 2–5 are independent tints.

## 16. Rollback seams

- Step 1 makes mood the identity, so reverting `climateMood()` to identity (or a
  `?mood=0` param mirroring `?post=0`) restores today's look exactly.
- Each tint (haze/key/water/grade) is a separate multiply — any one can be zeroed
  without touching the others.

## 17. Definition of done

- `climateMood()` is a pure, bounded, tested function; identity at `DEFAULT_CLIMATE`.
- Four+ contrasting climate fixtures render visibly distinct air/light/haze/water
  at day and dawn, on real WebGPU, with **no draw-count change** and the accepted
  temperate/day and underwater-reef frames unchanged.
- All sinks fed from one mood object per update (sync test passing).
- 243/243 tests + new tests green; `tsc`/`vite build` clean.
- Evidence captured; **status recorded as "ready for owner verdict," not accepted**
  (owner-verdict gate, `CLAUDE.md`).

## 18. Why this precedes plausible alternatives

- **vs Sea-state completion (LW-7):** water is ~half the frame but one system;
  atmosphere touches *all* layers and makes even the current calm sea read as
  *this climate's* sea. Rough seas land better afterward. (Also the biggest,
  highest-risk single unit per `BACKLOG` Slice D.)
- **vs Deep-time gestalt legibility (1k/100k/1M + reef temporal maturity):** the
  highest-value fix straddles the sim/render boundary (terrain magnitude, reef
  seeding) and risks the accepted reef verdict — architecturally dangerous.
  Distinct climate moods already begin to differentiate landings without touching
  sim authority.
- **vs Vegetation density / "forest that reads as a forest":** real but local
  (one camera), single-system, no cross-layer leverage.
- **vs Waterfall/freshwater richness:** small screen area; spray/mist volumetrics
  are high-cost and `INLAND-WATER-DESIGN` itself defers them; LW-4 already lifted
  the worst cascade artifacts.
- **vs Wildlife embodiment depth / shadow cascades:** both are refinements of
  already-accepted or already-`experimenting` systems with low whole-composition
  leverage; neither makes a *landing* cohere.

## Appendix — candidate shortlist (scored 1–5, higher = better; "Safety" = inverse of risk to accepted work)

| Candidate | Payoff | X-system leverage | Player-visible | Feasibility | Safety | Evidence | Capture-validate | Arch cleanliness | Opp. cost | **Total** |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **C1 Climate+time atmospheric identity (recommended)** | 5 | 5 | 5 | 4 | 3 | 5 | 5 | 4 | 5 | **41** |
| C2 Sea-state / rough water (LW-7) | 4 | 2 | 4 | 3 | 4 | 5 | 3 | 4 | 3 | 32 |
| C3 Deep-time gestalt legibility (rungs + reef maturity) | 5 | 3 | 4 | 2 | 3 | 5 | 5 | 2 | 3 | 32 |
| C4 Vegetation density / habitat massing | 3 | 2 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 32 |
| C5 Waterfall / freshwater integration | 3 | 2 | 3 | 3 | 5 | 3 | 3 | 4 | 2 | 28 |

## Appendix — before-state captures (reproduce, then A/B against these)

Real WebGPU, browser pane, `time=42`, dev server `epoch-dev` (or `epoch-dev-alt`
on 5199). All render at **15 draws** unless noted. Capture the same URLs after
the change; the identity-checkpoint (step 1) requires these to be unchanged.

| URL | Current read (the problem) | Must become |
|---|---|---|
| `?shot=whole-island&fixture=cold-arid-exposed-low` | pale bare ground; **sky/light/haze/water identical to warm-wet** | cold, flat, hard cold light; thin cold haze; dark cold sea |
| `?shot=whole-island&fixture=warm-wet-calm-high` | greener island; **same sky/light/haze/water as cold-arid** | warm humid key; green-blue haze; luminous cyan shallows |
| `?shot=dawn` | warm tint on sky+birds only; ground/water hazy mid-tone (shadow geometry already correct) | low golden key reaching ground **and** water |
| `?shot=storm` | dimmer/cooler sky over a **mirror-flat sea** | heavier desaturated key (sea-state is a *separate* milestone) |
| `?shot=whole-island&years=10000&time=42` | accepted horizon baseline | **unchanged** (regression pin) |
| `?shot=reef&fixture=mature-warm-reef` | accepted underwater reef — the coherence target | **unchanged** (protected) |
| `?shot=shoreline` | land→shallow→reef read-through under flat light | water tint reads *this climate* |

Env fixtures are defined in `src/environment-fixtures.ts`; new contrasting
foundations (e.g. `cold-wet-*`, `warm-arid-*` at present/calm) must be **added**
there, never by editing an existing fixture.
