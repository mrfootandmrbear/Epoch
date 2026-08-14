# Epoch integrated Godot slice

This disposable spike asks whether the same Epoch landing-state content becomes
materially more coherent and easier to art-direct in Godot. It is deliberately
not a standalone water demo.

## Boundary

- TypeScript/fixture data owns terrain, climate, placement, and camera intent.
- Godot owns meshes derived from that data, lighting, atmosphere, materials,
  water motion, shoreline treatment, and presentation.
- One Godot unit remains one metre.
- Nothing in this directory is simulation authority.

Generate the deterministic fixture:

```bash
npm run spike:godot:fixture
```

Then open this directory in Godot 4.3 or newer and run `main.tscn`. Press `1`
for the whole-island camera and `2` for the shoreline camera. Press `Space` to
pause water motion for comparison captures.

## Acceptance gate

Compare both cameras with Epoch's canonical WebGPU views. Continue toward a
migration only if the integrated Godot frame—not merely its water—is clearly
more coherent and the scene is materially easier to art-direct. Judge:

1. shared light and atmosphere across terrain, water, vegetation, and fauna;
2. land/water and object/ground transitions;
3. whether distribution reads as habitat rather than placed instances;
4. close and whole-island composition;
5. iteration speed for a meaningful visual adjustment.

Record Godot version, renderer, resolution, FPS, frame time, and screenshots in
`VERDICT.md`. Until an owner verdict is recorded, this remains a candidate.

