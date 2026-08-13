import type { TerrainHistory } from "./terrain-history";

export type TerrainField = Pick<TerrainHistory, "side" | "extent" | "elevations">;

/** Bilinear terrain height at a world-space point, clamped to the domain edge. */
export function sampleTerrainHeight(terrain: TerrainField, x: number, z: number): number {
  const step = terrain.extent / (terrain.side - 1);
  const half = terrain.extent / 2;
  const gx = Math.max(0, Math.min(terrain.side - 1, (x + half) / step));
  const gz = Math.max(0, Math.min(terrain.side - 1, (z + half) / step));
  const x0 = Math.floor(gx); const z0 = Math.floor(gz);
  const x1 = Math.min(terrain.side - 1, x0 + 1); const z1 = Math.min(terrain.side - 1, z0 + 1);
  const tx = gx - x0; const tz = gz - z0;
  const a = terrain.elevations[z0 * terrain.side + x0]!;
  const b = terrain.elevations[z0 * terrain.side + x1]!;
  const c = terrain.elevations[z1 * terrain.side + x0]!;
  const d = terrain.elevations[z1 * terrain.side + x1]!;
  return (a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * tz;
}

/**
 * Unit surface normal from central differences. Steep-reach renderers need this
 * rather than a +Y offset: on a near-vertical face a vertical lift moves the
 * water surface along the slope instead of away from it, so the uphill edge
 * sinks into the rock while the downhill edge floats off it.
 */
export function sampleTerrainNormal(
  terrain: TerrainField,
  x: number,
  z: number,
  out: [number, number, number] = [0, 1, 0],
): [number, number, number] {
  const step = terrain.extent / (terrain.side - 1);
  const dx = sampleTerrainHeight(terrain, x + step, z) - sampleTerrainHeight(terrain, x - step, z);
  const dz = sampleTerrainHeight(terrain, x, z + step) - sampleTerrainHeight(terrain, x, z - step);
  const nx = -dx;
  const ny = 2 * step;
  const nz = -dz;
  const scale = 1 / Math.max(1e-6, Math.hypot(nx, ny, nz));
  out[0] = nx * scale;
  out[1] = ny * scale;
  out[2] = nz * scale;
  return out;
}
