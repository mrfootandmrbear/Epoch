# anyCreature in Epoch

Vendored ACS compiler (MIT, Ariescar / Alsomind Tech), **build-time only**.
Not a runtime dependency and not Epoch’s evolution engine.

```bash
npm run asset:crab:generate
# or:
node tools/anycreature/engine/cli.js <spec.json> <out.glb>
```

This folder has its own `"type": "commonjs"`. Epoch’s root `package.json` is
`"type": "module"`; without that local package.json, `cli.js` fails with
`require is not defined`.

Do not copy `cards/` or run the PUNCHIER silhouette gates. Those teach bold
game-monster shapes. Epoch needs a recognizable real-world founder and
plausible, often subtle divergence.

## What it is good for

JSON in, skinned vertex-coloured GLB out: explicit joints, named chains,
volumes, parts, `idle` / `walk` (clip names are free; the example wolf uses
`move`). Continuous Epoch traits can later drive bone scale, vertex-colour mix,
and clip weight. Discrete anatomy (webbing, a new fin plan, a marine-iguana
tail) should be a sibling spec that shares the ancestral skeleton, not a morph
target. There is no morph-target system; that matches Epoch’s asset rules.

Keep the compiler out of the player bundle. Ship the GLB. Capture must wait
until the GLB has loaded (`createCrabRenderer().ready`) or the still is empty.

This is not a first-class fauna backend yet. The splash crab is **candidate**.
Do not reopen the accepted land iguana to try the tool.

## Lessons from the Sally Lightfoot (WU-M1)

**Units.** Spec space is metres. A 5–8 cm crab is legal: most floors scale with
`modelH`. `ring_step` is metres, not a fraction — wolf’s `0.055` is a whole
carapace on a crab. Use ~`0.006`–`0.012`.

**`part_attachment` at centimetre scale.** Tolerance is `0.015 * modelH`, which
can be sub-millimetre. A paw or fin sitting 2 mm off its host **blocks** the
build. Bury the first third of a part, or drop the part.

**Volume tubes all read as legs.** A cheliped grown as a mirrored volume with
the same merus/dactyl language as walking legs reads as a fifth pair — a
ten-legged star. Walking legs: four mirrored chains, roots fanned along the
body (`Hips` / `Spine` / `Chest`), merus going *out* then down. Claws: do not
use that volume language.

**`paw` is a foot.** `size` is `[length(fwd), width, height]` and the pad snaps
*under* the host toward the ground. Putting a paw on a claw joint makes another
foot. Pointed dactyls on walking toes are fine; chelae are not paws.

**`fin` + `anchor.around` never faces forward.** On a body chain that runs +Z,
`around` is the tube’s radial frame (0 spine / 90 side / 180 belly). The
compiler will even say `faces side`. Anterior parts (mouth, claws, a beak) need
`conform: false` and a host `offset` along +Z, with negative U in `points` so
the plate stays buried in the front cap. Side-anchored fins sit on the carapace
roof or flanks.

**Even merus angles + `mirror` = a radial star.** Distinct walk-pair headings
(forward-out, due side, back-out) matter more than extra joints. Rear pairs
that curl toward the midline look like a fifth inward pair.

**Clips and checks.** `idle` and `walk` compile. `attack` is optional; if
present it must reach or swing. Non-mirrored chains cannot be 50:50 segment
rhythm unless `"style": "heavy"`. Limb clearance and root containment still
apply at crab scale.

**Runtime cost is an open gate.** The landing path clones a skinned GLB per
seat (occupancy cap 40). That is ordinary `SkinnedMesh`, not the cheap
instanced morph path used for fish and iguanas. Do not treat occupancy as
accepted until an owner look on real WebGPU says the counts are fine. Do not
report fps from headless capture.

**Vite.** Importing `.glb` needs `assetsInclude: ["**/*.glb"]`. Vertex AO lands
in `COLOR_0`; TSL `vertexColor()` is how redness/wetness mix without a texture.
