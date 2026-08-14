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

## Alternatives

### A — Shared palette and light response

Keep current materials and introduce an Epoch-owned TSL library for palette
mapping, value compression, roughness families, distance detail, and atmospheric
integration. This adds no pass and only small shader arithmetic. It is the
lowest-risk route, but silhouettes and contacts may remain weak.

### B — Shared materials plus restrained edges (recommended)

Add A, then compose selective depth/normal edges and contact darkening in the
existing post pipeline. Use one MRT scene pass, one bounded edge evaluation,
and the current grade/bloom stage. Outlines must be distance- and category-aware:
terrain horizons, creature silhouettes, and major foliage masses may read;
internal tessellation must not.

### C — Fully illustrative renderer

Quantize lighting aggressively and add watercolor noise, temporal stipple, or
broad image-space abstraction. This could create a strong identity but risks
flattening habitat information, water motion, evolved traits, and deep-time
differences. Do not attempt it until B proves insufficient.

## Candidate visual grammar

1. **Palette families:** atmosphere defines light/shadow bias; habitat defines
   local hue; material identity contributes bounded variation.
2. **Value hierarchy:** sky and distant water are quiet; land masses separate
   at mid value; creatures and epoch-significant features get the clearest
   local contrast.
3. **Lighting bands:** compress diffuse response into soft authored bands while
   retaining continuous specular response for water and wet surfaces.
4. **Edge hierarchy:** silhouette and contact edges only—never a universal black
   outline or exposure of procedural triangle density.
5. **Detail frequency:** macro variation is shared across the world; fine detail
   retires consistently with camera distance.
6. **Grounding:** vegetation and fauna inherit local ground hue, fog, key-light
   direction, and contact treatment rather than reading as color-picked assets.
7. **Transitions:** shoreline, forest edge, rock/soil, and water depth are
   material transitions driven by shared world fields, not coincident geometry.

## Visual target and candidate parameters

The intended read is mocked up as an art-direction one-sheet — the same fixed
`whole-island` landing under all three grammars beside today's baseline, plus the
palette, value ladder, and the seven rules. It is the shared reference the three
agents converge on so they do not each invent a different read from prose.

> **Mockup artifact:** <https://claude.ai/code/artifact/eedb6aea-a7d8-49c5-942e-18a33f071a9e>
> (owner-owned; private until shared. It is an *authored approximation of the
> intended read*, not a render — the pipeline still has to earn it live.)

**Reference (owner-supplied, 2026-08-14):** a stylized **low-poly** island —
faceted warm-grey rock, one bright harmonised palette (turquoise shelf → deep
blue, vivid greens, warm sand), **no outlines**, grounded vegetation. It was a
watermarked Adobe Stock preview, so it is a *style* reference only, not an asset.
The mockup palette and the recommended grammar below are tuned to it.

**Open decision — low-poly geometry.** The reference's faceted look is terrain
*shape*, not a shader. Taking only the palette + flat shading on the current
geomorphic terrain is low-risk; committing to faceted terrain is a bigger change
that must still read the 1 / 1k / 100k / 1M deep-time rungs. **Owner's call before
it is baked in** — do not adopt faceted terrain silently.

**Proposed shared palette (candidate — for owner approval, not fixed).** Starting
values for the TSL palette library, tuned to the reference. Atmosphere biases
light, habitat sets local hue, material identity adds bounded variation on top.

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

**Grammar parameters.**

| Grammar | Palette | Shading | Edges | Grounding |
|---|---|---|---|---|
| A — flat-faceted *(recommended)* | shared | flat low-poly facets | none | on |
| B — faceted + whisper edge | shared | flat low-poly facets | silhouette + contact, faint | on |
| A′ — smooth soft-shaded | shared | continuous | none | on |

The reference revised the recommendation from B to **A**: it carries value with
flat facets and has *no outlines*, so B now exists only to test whether the
faintest edge helps or the no-outline read wins. Specular (sun glint, wet
surfaces) stays continuous even under flat diffuse (rule 03). These are a
starting target to tune from live WebGPU evidence, not fixed truth.

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
 selective edge/contact treatment
                    v
 palette/value grade + restrained bloom
                    v
 deterministic capture
```

Style uniforms update only when atmosphere or an art-direction control changes.
Existing environmental textures update on landing changes. There is no GPU
readback and no new simulation state.

## First spike: style laboratory

Add a feature-gated `?style=cohesion` laboratory to the existing renderer. Apply
three grammars to the unchanged fixed `whole-island` landing:

1. soft value bands plus shared palette;
2. the same with restrained silhouette/contact edges;
3. continuous light with shared palette and grounding only.

These are the concrete forms of the alternatives above: grammar 1 is a
posterized reading of **A**, grammar 2 is **B**, and grammar 3 is **A** without
value banding. **C** (fully illustrative) is deliberately not built in this
spike; it is reached only if the owner later judges B insufficient.

Use only terrain, FFT water, vegetation, the accepted marsh grazer, atmosphere,
and post-processing. Do not add reefs, fish, weather variants, or content.

**Selection evidence must be a single comparison sheet.** Capture the current
default renderer *and* all three grammars at the same fixed `whole-island`
landing, side by side, so the owner selects from a real comparison rather than
from sequential single shots. Choosing from one-at-a-time frames is a failure
mode this project has already hit; the unmodified baseline must be in the frame.

**Known interactions to watch — flag, do not silently absorb:**

- *Banded diffuse versus accepted creature evidence.* Grammars 1 and 2 compress
  diffuse into authored bands, which changes how the already-recorded coat
  warmth/lightness and insulation self-shadowing read. If a banded grammar is
  chosen, those reads need a fresh owner verdict — they were tuned under
  continuous light. Grammar 3 avoids this, which is a reason it may win by
  default rather than on merit; name that so the choice stays honest.
- *The edge stage is the performance variable.* B's silhouette/contact treatment
  is the one place a full-resolution screen-space pass can appear. Record whether
  it runs bounded (category-masked / reduced-resolution) or full-res; the
  1080p/60 fps verdict on the owner's machine turns on this more than on the
  shared-material arithmetic, which is cheap.

**Coverage is deliberately partial.** The lab and its `shoreline`/`herd-contrast`
follow-ons exercise only the terrestrial subset. The marine/reef/underwater
family (coral, fish, seagrass, reef-water, marine snow, drifters) is not in
these frames, and the reef landing renderer is already **owner-accepted
(2026-08-13)**. A grammar chosen here therefore carries a known downstream cost:
retrofitting it onto the accepted reef renderer without regressing that verdict.
That retrofit is a separate, later Work Unit, not part of grammar selection.

After the owner selects one grammar from live WebGPU evidence, carry only that
candidate into `shoreline` and `herd-contrast`. Record 1080p foreground WebGPU
FPS/frame time, draw count, new full-resolution passes, compilation behavior,
and deterministic captures.

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

