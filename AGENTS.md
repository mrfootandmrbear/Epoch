# Epoch agent instructions

Epoch's product direction lives in [THESIS.md](THESIS.md). Preserve unrelated working-tree changes and keep simulation state separate from rendering concerns.

## Ecosystem assets

When designing, generating, modeling, rigging, animating, exporting, validating, or integrating an animal, fish, bird, plant, or coral asset, use [generate-ecosystem-asset](.agents/skills/generate-ecosystem-asset/SKILL.md).

One agent task owns one bounded asset family. Put packages under `assets/ecosystem/<asset-id>/` and run:

```bash
npm run asset:check -- assets/ecosystem/<asset-id>
```

Do not call a package accepted without a recorded owner visual verdict.
