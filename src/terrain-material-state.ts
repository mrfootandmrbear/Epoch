import type { TerrainHistory } from "./terrain-history";

export const TERRAIN_MATERIAL_CHANNELS = 4;

/** Pack continuous simulation fields for bilinear sampling by the terrain shader. */
export function packTerrainMaterialState(
  terrain: Pick<TerrainHistory, "disturbance" | "vegetationProtection" | "runoff" | "forage">,
  target: Float32Array<ArrayBufferLike> = new Float32Array(
    terrain.disturbance.length * TERRAIN_MATERIAL_CHANNELS,
  ),
): Float32Array<ArrayBufferLike> {
  if (target.length !== terrain.disturbance.length * TERRAIN_MATERIAL_CHANNELS) {
    throw new Error("Terrain material state target has the wrong size");
  }
  for (let i = 0; i < terrain.disturbance.length; i++) {
    const offset = i * TERRAIN_MATERIAL_CHANNELS;
    target[offset] = terrain.disturbance[i]!;
    target[offset + 1] = terrain.vegetationProtection[i]!;
    target[offset + 2] = terrain.runoff[i]!;
    target[offset + 3] = terrain.forage[i]!;
  }
  return target;
}
