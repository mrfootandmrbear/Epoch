# Fauna rules

Use Foxel `.fxl` as the preferred editable source for animals, fish, and birds; export rigged/animated `.glb` files for runtime. Another tool is allowed only when the manifest explains why it better satisfies the same contract.

anyCreature (vendored ACS under `tools/anycreature/`) may compile JSON → skinned GLB at **build time**. It is not a first-class fauna backend and not a runtime evolution engine. If a package uses it, read `tools/anycreature/README.md` before writing a spec — the punchier-silhouette cards are wrong for Epoch, and crab/cheliped traps from WU-M1 are recorded there. Do not reopen an accepted family to try the compiler.

## Shared requirements

- Use one base rig per related family whenever anatomy allows.
- Keep forward axis, ground/water origin, and real-world scale consistent across variants.
- Map continuous traits to bone proportions, material/color parameters, or animation parameters.
- Use separate pre-baked exports for discrete anatomy such as webbing, fin plans, beaks, or wing plans.
- Show the least and most extreme variants together at gameplay distance.
- Require `idle` and locomotion animation: `walk` for animals, `swim` for fish, `flight` for birds.

## Fish

Check side silhouette, turning volume, waterline/depth origin, fin readability, and whether swim cadence matches body plan. Avoid land-animal rigs merely rotated into water.

## Birds

Check folded and extended wing silhouettes, flight clearance, perch/ground origin, and distance readability. A flying dot is not an accepted bird asset.
