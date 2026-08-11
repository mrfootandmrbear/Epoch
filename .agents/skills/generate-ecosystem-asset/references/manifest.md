# Asset package contract

Every package lives at `assets/ecosystem/<asset-id>/` and contains `asset.json` plus `morphology.md`.

## Identity

- `schemaVersion`: `1`
- `id`: lowercase kebab-case; must match the directory name
- `displayName`: concise human name
- `category`: `animal`, `fish`, `bird`, `plant`, or `coral`
- `stage`: `brief`, `source`, `preview`, `candidate`, or `accepted`
- `role`: ecological function, not taxonomic novelty
- `habitats`: one or more plain-language habitat labels
- `realWorldReferents`: one or more organisms or growth forms

## Visual contract

- `silhouette`: the recognizable shape at gameplay distance
- `paletteFamily`: shared family palette name
- `scaleMeters`: positive `{ min, max }`
- `traits.continuous`: runtime-driven parameters with `name`, `driver`, and `range`
- `traits.discrete`: authored variant ladders with `name`, `driver`, and at least two `variants`

## Production contract

- `source.tool`: authoring/generation tool
- `source.files`: editable source paths relative to the package
- `source.procedure`: reproducible command or concise procedure
- `previews`: preview paths relative to the package
- `exports`: runtime file paths relative to the package
- `lods`: objects with `name`, `file`, and positive `maxTriangles`
- `animations.required`: required clip names
- `showcase`: in-engine image or clip relative to the package
- `acceptance.verdict`: owner verdict; required only for `accepted`

## Required previews

At `preview` and beyond, include filenames or labels containing `front`, `side`, `top`, and `game-distance`. Birds additionally need `flight`; fish need `swim`; coral needs `colony`; plants need `wind`.

Paths must stay inside the package, use forward slashes, and exist at the stage where they become required.
