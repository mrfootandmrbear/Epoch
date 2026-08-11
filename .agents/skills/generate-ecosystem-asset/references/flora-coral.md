# Flora and coral rules

Prefer seeded procedural source with cached geometry families. Runtime code may parameterize or instance exported geometry, but authoring generators remain build-time tools.

## Plants

- Expose trunk/branch proportions, crown geometry, leaf density/size, lean, and color only where habitat pressure plausibly drives them.
- Use shared skeleton data across LODs when possible.
- Replace generator-specific materials and wind with Epoch-owned WebGPU/TSL materials.
- Preview the calm silhouette and a wind-deformed state.

## Coral

- Choose an ecologically legible growth grammar: branching, massive, plating, foliose, columnar, or encrusting.
- Tie colony form to light, depth, wave exposure, sediment, or competition.
- Separate colony-scale growth parameters from surface material detail.
- Preview a whole colony at gameplay distance and ensure the base seats on irregular seabed geometry.
- Treat living color, bleaching, and dead skeleton as material/state parameters unless geometry genuinely changes.
