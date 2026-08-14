# Stylized render cohesion — WebGPU direction

**Status:** Candidate architecture; owner-approved direction, visual grammar not
yet accepted. **Target:** Three.js r185 (`0.185.1`), `WebGPURenderer` + TSL,
modern Chromium desktop, 60 fps at 1080p on the owner's Apple Silicon machine.

## Decision and problem

The Godot plan is cancelled. Its bounded slice showed that changing engines
does not create cohesion: individually plausible terrain, water, vegetation,
and fauna still read as assembled elements without a shared visual grammar.
Epoch retains WebGPU/TSL and preserves the Godot slice only as negative evidence.

Epoch's current systems choose color, value, roughness, edge treatment, detail
frequency, and distance behavior locally. Post-processing grades the assembled
result but cannot make it one authored world. The required outcome is a shared
stylized grammar that clarifies habitat, adaptation, and deep-time change at
shoreline, mid, and whole-island scales without making every surface identical.

## Verified capability surface

The installed public Three.js/TSL surface is sufficient for the investigation:

- node materials can share reusable color, lighting, roughness, and distance
  functions while retaining material-specific inputs;
- MaterialX noise and triplanar projection can correlate shape breakup across
  terrain and assets without UV-dependent seams;
- `posterize` supports controlled value and color bands;
- `pass` plus MRT expose scene color, normals, and depth;
- `toonOutlinePass` provides a public screen-space outline implementation;
- screen-space depth, derivatives, and normal reconstruction permit selective
  edge and contact treatments;
- the current pipeline already composes grading, bloom, and optional GTAO using
  public APIs.

These are capabilities, not an art style. The missing layer is a rule set for
how every renderer uses them.

## Direction

Epoch will pursue a **hybrid stylized-naturalist** grammar. Visual cohesion comes
primarily from semantic color, bounded material response, shared lighting,
atmospheric integration, contact, and consistent distance behavior. Faceting is
a material- and landform-specific tool, not the renderer-wide style:

- soil, dunes, weathered slopes, and other geomorphic surfaces retain smooth
  macro form;
- exposed rock, cliffs, basalt, scree, coral skeleton, and possibly ice may use
  authored facets where planar structure clarifies geology;
- vegetation remains topology-light and silhouette-led;
- fauna remains stylized and topology-efficient, but must not read as visibly
  faceted at inspection distance;
- FFT water remains optically continuous and is never made low-poly merely to
  match land geometry;
- outlines are off by default; value separation, atmosphere, and contact must
  carry silhouettes before a screen-space edge pass is considered.

This is an art-direction decision, not a WebGPU optimization. Moderate triangle
counts are not an observed bottleneck. The known performance risks are draw
submission, vegetation and reef overdraw, shadow work, full-resolution
screen-space passes, and material complexity. Geometry simplification still
belongs in measured LOD and instancing decisions, but exposing polygons must
earn a visual benefit independently.

## Alternatives

### A — Shared palette and light response

Keep current materials and introduce an Epoch-owned TSL library for palette
mapping, value compression, roughness families, distance detail, and atmospheric
integration. This adds no pass and only small shader arithmetic. It is the
lowest-risk route, but silhouettes and contacts may remain weak.

### B — Shared materials plus restrained edges

Add A, then compose selective depth/normal edges and contact darkening in the
existing post pipeline. Use one MRT scene pass, one bounded edge evaluation,
and the current grade/bloom stage. Outlines must be distance- and category-aware:
terrain horizons, creature silhouettes, and major foliage masses may read;
internal tessellation must not.

### C — Hybrid stylized-naturalist materials and geometry (recommended)

Build on A, preserve smooth macro terrain, and allow selective authored facets
only for materials whose structure supports them. Keep water continuous,
fauna inspection-safe, and vegetation silhouette-led. This asks more of the
material grammar than a global `flatShading` switch, but it preserves ecological
and deep-time legibility while gaining the deliberate shapes of the reference.

### D — Fully illustrative renderer

Quantize lighting aggressively and add watercolor noise, temporal stipple, or
broad image-space abstraction. This could create a strong identity but risks
flattening habitat information, water motion, evolved traits, and deep-time
differences. Do not attempt it until C proves insufficient.

## Candidate visual grammar

1. **Palette families:** atmosphere defines light/shadow bias; habitat defines
   local hue; material identity contributes bounded variation.
2. **Value hierarchy:** sky and distant water are quiet; land masses separate
   at mid value; creatures and epoch-significant features get the clearest
   local contrast.
3. **Lighting response:** begin with continuous diffuse light and bounded value
   compression. Treat authored diffuse bands as a separate experiment; retain
   continuous specular response for water and wet surfaces.
4. **Edge hierarchy:** silhouette and contact edges only—never a universal black
   outline or exposure of procedural triangle density.
5. **Detail frequency:** macro variation is shared across the world; fine detail
   retires consistently with camera distance.
6. **Grounding:** vegetation and fauna inherit local ground hue, fog, key-light
   direction, and contact treatment rather than reading as color-picked assets.
7. **Transitions:** shoreline, forest edge, rock/soil, and water depth are
   material transitions driven by shared world fields, not coincident geometry.
8. **Geometry language:** preserve smooth geomorphic macro form and expose
   facets only where rock, coral, ice, or another material has a plausible
   planar structure. Polygon visibility is never a global consistency rule.

## Visual target and candidate parameters

The initial intended read was mocked up as an art-direction one-sheet — the same
fixed `whole-island` landing under three early bundled grammars beside today's
baseline, plus the palette and value ladder. Keep it as a mood and color
reference, not as the experiment design: the controlled matrix below supersedes
its bundled grammar comparison.

> **Mockup artifact:** <https://claude.ai/code/artifact/eedb6aea-a7d8-49c5-942e-18a33f071a9e>
> (owner-owned; private until shared. It is an *authored approximation of the
> intended read*, not a render — the pipeline still has to earn it live.)

**Reference (owner-supplied, 2026-08-14):** a stylized **low-poly** island —
faceted warm-grey rock, one bright harmonised palette (turquoise shelf → deep
blue, vivid greens, warm sand), **no outlines**, grounded vegetation. It was a
watermarked Adobe Stock preview, so it is a *style* reference only, not an asset.
The mockup palette and the recommended grammar below are tuned to it.

**Decision — selective faceting, not global low-poly.** The reference's faceted
look is terrain shape, not a WebGPU feature or automatic performance win. Epoch
will preserve smooth geomorphic terrain and test facets only on geological or
material structures that plausibly benefit from them. Do not switch the terrain,
water, fauna, or whole renderer to flat shading. Any selective faceting must
still improve the 1 / 1k / 100k / 1M deep-time read at close, mid, and
whole-island scales.

**Proposed shared palette (candidate — for owner approval, not fixed).** The hex
values below are anchors, not the palette system. The TSL library must expose
semantic roles: atmosphere light/shadow bias, habitat hue, material identity,
wetness/depth, succession state, and protected accents for fauna and
epoch-significant features. Each role needs bounded value and chroma ranges plus
explicit day, dawn, storm, haze, and underwater transforms. Validate the result
after ACES tone mapping at the supported exposure range; raw swatches are not
evidence.

| Family | Values |
|---|---|
| Atmosphere (day) | sky zenith `#64B0D6` · sky horizon `#CBE8EC` · sunlight `#FFE6B0` · water haze `#A9DDE0` |
| Rock (low-poly) | apex `#DDD4C5` · sun face `#CDC3B4` · body `#ADA192` · shadow face `#8B7F6C` |
| Green · land | canopy `#7CB04A` · lowland `#5F9A3C` · understory `#3F6F2C` · sand `#ECDFB8` |
| Water (paused) | shallow `#5FC6CC` · deep `#123F74` · foam `#F4FDFB` |
| Fauna | base hide `#9C8567` · warm coat `#A87C4F` · ground tint `#5F9A3C` |

**Value hierarchy (where each element may sit).** Sky and distant water quiet in a
narrow high band (~0.58–0.80); land across the working mid (~0.26–0.66); water
anchors the low (~0.16–0.44); creatures and epoch cues are the only elements
granted the widest local contrast (~0.14 and ~0.82). Read the plates in
grayscale and this is what should survive.

**Material-response contract.** Color unifies the frame, but materials remain
distinct through bounded response families. The implementation must record, per
family, diffuse softness, roughness range, specular width, transmission or
subsurface allowance, normal/detail frequency, wet-state behavior, atmospheric
tint, and the distance at which fine detail retires. At minimum cover rock,
soil, sand, foliage, bark, hide/coat, coral tissue/skeleton, foam, and water.

**Candidate variables.** Do not bundle palette mapping, lighting quantization,
and geometry normals into named grammars. They are independent variables and
must be isolated before combining a winner.

| Test | Geometry normals | Lighting | Palette |
|---|---|---|---|
| Baseline | current | current | current |
| Palette only | current | current | semantic shared palette |
| Lighting only | current | soft value compression | current |
| Palette + lighting | current | soft value compression | semantic shared palette |
| Global flat diagnostic | flat | continuous | semantic shared palette |
| Selective geological facets | mixed by material | continuous or softly compressed | semantic shared palette |

The global-flat row is a diagnostic, not a candidate default. It exists to show
whether visible facets add anything that material-specific facets do not. No
outline variant enters this first matrix; add one later only if the selected
no-outline treatment still fails silhouette or contact readability.

## Candidate dataflow

```text
landing snapshot + environment fields (CPU authority)
                    |
                    v
 shared style uniforms + spatial textures (GPU read-only)
          | terrain | water | vegetation | fauna |
                    v
 scene pass: color + normal + depth (MRT)
                    v
 shared grounding/contact treatment
                    v
 palette/value grade + restrained bloom
                    v
 deterministic capture
```

Style uniforms update only when atmosphere or an art-direction control changes.
Existing environmental textures update on landing changes. There is no GPU
readback and no new simulation state.

## First spike: controlled style laboratory

Add a feature-gated `?style=cohesion` laboratory to the existing renderer. Build
the six rows in the candidate-variable matrix without changing simulation or
content. The implementation may stage this as palette/lighting first and
geometry second, but the comparison sheet must preserve the isolated rows.

Use terrain, FFT water, vegetation, the accepted marsh grazer, atmosphere, and
post-processing for the primary terrestrial comparison. Also include one
existing accepted reef/shore frame as a compatibility sentinel; do not restyle
or re-accept the reef in this Work Unit. Its purpose is to reject a terrestrial
grammar that obviously cannot extend underwater without destroying the reef's
material separation. Do not add fish, weather variants, or new content.

**Selection evidence must use fixed comparison sheets.** Capture the current
default renderer and all isolated rows at the same landing, time, camera, and
exposure. Provide whole-island, shoreline, herd-detail, and reef/shore sentinel
sheets. The unmodified baseline must appear on every sheet. A winner at only one
camera scale is not a winner.

**Known interactions to watch — flag, do not silently absorb:**

- *Compressed diffuse versus accepted creature evidence.* The lighting-only and
  combined rows change how the already-recorded coat
  warmth/lightness and insulation self-shadowing read. If compressed lighting is
  chosen, those reads need a fresh owner verdict — they were tuned under
  continuous light.
- *Do not infer performance from polygon visibility.* Record triangles, draws,
  material count, shadow draws, and frame time for the geometry rows. A visible
  low-poly surface is not a performance optimization unless measurements show
  that its resource reduction matters.

**Coverage is bounded, not terrestrial-only.** The reef/shore sentinel does not
authorize a marine retrofit, but marine incompatibility is now a rejection
signal during grammar selection rather than a deferred surprise. The full
marine family (coral, fish, seagrass, reef water, marine snow, and drifters)
still receives its own later Work Unit and owner verdict.

After the owner selects the useful variables from live WebGPU evidence, combine
only those into one hybrid candidate. Record 1080p foreground WebGPU FPS/frame
time, triangle and draw counts, material/shadow draws, new full-resolution
passes, compilation behavior, and deterministic captures. The exact next gate
is an owner verdict on the four camera-scale sheets plus the four deep-time
rungs; only then may the candidate be proposed for default integration.

## Acceptance gate

The owner must answer yes to all of these:

1. Does the frame read as one world rather than assembled systems?
2. Are terrain, water, vegetation, and fauna still materially distinct?
3. Does stylization improve habitat and evolved-trait legibility?
4. Do shoreline, mid, and whole-island views all improve?
5. Are the four deep-time landing rungs at least as distinguishable as before?
6. Does the foreground WebGPU run hold 60 fps at 1080p?
7. Does the frozen water still read as belonging to the frame, rather than
   becoming the new odd element once terrain, vegetation, and fauna shift?

Question 7 exists because water shading is paused, not removed: the visual bar
(THESIS §6) is defined by water, so harmonising everything *except* water can
relocate the assembled-elements problem onto it. A "no" here is a finding that
scopes the later water-in-grammar Work Unit, not a failure of the grammar.

Question 6 is judged on a deliberately content-light lab scene; a green reading
is necessary but provisional until the chosen grammar runs in the fully
populated default renderer.

If no candidate passes, remove the feature-gated style layer. Do not integrate a
candidate into the default renderer before owner selection.

## Multi-agent build coordination

Epoch is built by more than one agent working in parallel — the owner runs them
together on purpose, to spread usage limits and to match model strength to the
task — with the owner as the only hardware-truth and visual-verdict authority:

- **Claude Code** (Anthropic, in-repo): implements one Work Unit at a time,
  produces deterministic captures, and follows the session ritual and every
  invariant in `CLAUDE.md`.
- **Cursor** (in-repo AI editor): edits source directly in this repo. Same repo,
  same invariants — it is not exempt from anything below because it is a
  different tool. Before touching renderer code it reads `CLAUDE.md`, this plan,
  and the WebGPU design skill rather than translating WebGL-era patterns.
- **ChatGPT "Sol"** (design and critique, relayed by the owner): reasons about
  architecture and reviews plans. Sol does not run the renderer on hardware and
  produces no capture evidence, so Sol's conclusions are proposals pending an
  owner-verified check, never verified results. Handoffs arrive as "for Sol"
  messages the owner relays; answer in kind for the owner to carry back.

**Rules that bind every agent, regardless of tool:**

1. **Only the owner's live WebGPU run is a verdict.** No agent may call a grammar
   "accepted"; say "ready for owner verdict." Headless/sandbox captures have no
   real GPU, need `--webgl`, and are fallback-backend evidence only — never
   conclude the renderer is broken from one.
2. **Do not mark canonical trackers satisfied.** `THESIS.md`,
   `RENDERER-ROADMAP.md`, `WILDLIFE-ROADMAP.md`, and `HABITAT_REVIEW.md` are
   owner-authored. This plan and `docs/polish/` are the working surface; edit
   those and prepare evidence for the canonical trackers, never self-certify
   through their gates.
3. **All lab work stays behind `?style=cohesion`** and must not alter the default
   render path or the deterministic capture contract (seed `0xe90c4`, frozen sim
   time, forced `day` atmosphere, fixed cameras, UI hidden). It must stay
   removable.
4. **Renderer decisions follow the WebGPU design skill**
   (`.agents/skills/design-webgpu-solutions/SKILL.md`), and simulation state
   stays separate from rendering: no GPU readback and no new sim state (see the
   dataflow above).
5. **Do not hand-edit generated assets** under `assets/ecosystem/*/runtime/`; add
   new golden shots and capture sets rather than editing existing ones.
6. **Two in-repo editors can collide.** Claude Code and Cursor both edit source
   directly, and runs overlap. Before a Work Unit, check `git status` and recent
   commits; if another agent is active on a branch or file set, work on a
   separate branch rather than editing the same files concurrently.

**Shared state lives in the repo, not in any one agent's chat.** Current work
state is `docs/polish/BACKLOG.md`, `SCORECARD.md`, and `LOG.md`; repo navigation
is `docs/polish/MAP.md`. Any agent picking up this work reads those first and
records where it stopped there, so the next agent — whichever tool it is — can
continue without the prior conversation.
