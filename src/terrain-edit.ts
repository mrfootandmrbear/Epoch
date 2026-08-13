import type { TerrainHistory } from "./terrain-history";

export interface TerrainBrushSettings {
  readonly radius: number;
  readonly strength: number;
}

export interface TerrainEditBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface TerrainEditSnapshot {
  readonly elevations: Float32Array;
  readonly disturbance: Float32Array;
  readonly vegetationProtection: Float32Array;
}

export function captureTerrainEditSnapshot(
  terrain: Pick<TerrainHistory, "elevations" | "disturbance" | "vegetationProtection">,
): TerrainEditSnapshot {
  return {
    elevations: terrain.elevations.slice(),
    disturbance: terrain.disturbance.slice(),
    vegetationProtection: terrain.vegetationProtection.slice(),
  };
}

export function restoreTerrainEditSnapshot(
  terrain: Pick<TerrainHistory, "elevations" | "disturbance" | "vegetationProtection">,
  snapshot: TerrainEditSnapshot,
): void {
  if (
    snapshot.elevations.length !== terrain.elevations.length
    || snapshot.disturbance.length !== terrain.disturbance.length
    || snapshot.vegetationProtection.length !== terrain.vegetationProtection.length
  ) {
    throw new RangeError("terrain edit snapshot does not match terrain size");
  }
  terrain.elevations.set(snapshot.elevations);
  terrain.disturbance.set(snapshot.disturbance);
  terrain.vegetationProtection.set(snapshot.vegetationProtection);
}

/** Apply one smooth, circular height dab and return its affected grid bounds. */
export function applyHeightBrush(
  terrain: Pick<TerrainHistory, "side" | "extent" | "elevations" | "disturbance" | "vegetationProtection">,
  centerX: number,
  centerZ: number,
  direction: 1 | -1,
  settings: Readonly<TerrainBrushSettings>,
  elevationFloor = -55,
): TerrainEditBounds | undefined {
  if (!Number.isFinite(settings.radius) || settings.radius <= 0) {
    throw new RangeError("terrain brush radius must be positive and finite");
  }
  if (!Number.isFinite(settings.strength) || settings.strength <= 0) {
    throw new RangeError("terrain brush strength must be positive and finite");
  }
  const step = terrain.extent / (terrain.side - 1);
  const half = terrain.extent / 2;
  const minX = Math.max(0, Math.floor((centerX - settings.radius + half) / step));
  const maxX = Math.min(terrain.side - 1, Math.ceil((centerX + settings.radius + half) / step));
  const minZ = Math.max(0, Math.floor((centerZ - settings.radius + half) / step));
  const maxZ = Math.min(terrain.side - 1, Math.ceil((centerZ + settings.radius + half) / step));
  let changed = false;

  for (let gz = minZ; gz <= maxZ; gz++) {
    const z = gz * step - half;
    for (let gx = minX; gx <= maxX; gx++) {
      const x = gx * step - half;
      const distance = Math.hypot(x - centerX, z - centerZ);
      if (distance >= settings.radius) continue;
      const index = gz * terrain.side + gx;
      const falloff = 1 - distance / settings.radius;
      terrain.elevations[index] = Math.max(
        elevationFloor,
        terrain.elevations[index]! + direction * settings.strength * falloff * falloff,
      );
      terrain.disturbance[index] = 1;
      terrain.vegetationProtection[index] = 0;
      changed = true;
    }
  }

  return changed ? { minX, maxX, minZ, maxZ } : undefined;
}

/** Move a circular footprint toward its weighted local mean without flattening its edge. */
export function applyLevelBrush(
  terrain: Pick<TerrainHistory, "side" | "extent" | "elevations" | "disturbance" | "vegetationProtection">,
  centerX: number,
  centerZ: number,
  settings: Readonly<TerrainBrushSettings>,
): TerrainEditBounds | undefined {
  if (!Number.isFinite(settings.radius) || settings.radius <= 0) throw new RangeError("terrain brush radius must be positive and finite");
  if (!Number.isFinite(settings.strength) || settings.strength <= 0) throw new RangeError("terrain brush strength must be positive and finite");
  const step = terrain.extent / (terrain.side - 1);
  const half = terrain.extent / 2;
  const minX = Math.max(0, Math.floor((centerX - settings.radius + half) / step));
  const maxX = Math.min(terrain.side - 1, Math.ceil((centerX + settings.radius + half) / step));
  const minZ = Math.max(0, Math.floor((centerZ - settings.radius + half) / step));
  const maxZ = Math.min(terrain.side - 1, Math.ceil((centerZ + settings.radius + half) / step));
  let weightedHeight = 0;
  let totalWeight = 0;
  for (let gz = minZ; gz <= maxZ; gz++) {
    const z = gz * step - half;
    for (let gx = minX; gx <= maxX; gx++) {
      const x = gx * step - half;
      const distance = Math.hypot(x - centerX, z - centerZ);
      if (distance >= settings.radius) continue;
      const weight = 1 - distance / settings.radius;
      weightedHeight += terrain.elevations[gz * terrain.side + gx]! * weight;
      totalWeight += weight;
    }
  }
  if (totalWeight === 0) return undefined;
  const target = weightedHeight / totalWeight;
  const response = Math.min(1, settings.strength / 4);
  for (let gz = minZ; gz <= maxZ; gz++) {
    const z = gz * step - half;
    for (let gx = minX; gx <= maxX; gx++) {
      const x = gx * step - half;
      const distance = Math.hypot(x - centerX, z - centerZ);
      if (distance >= settings.radius) continue;
      const index = gz * terrain.side + gx;
      const falloff = 1 - distance / settings.radius;
      terrain.elevations[index] = terrain.elevations[index]! + (target - terrain.elevations[index]!) * response * falloff * falloff;
      terrain.disturbance[index] = 1;
      terrain.vegetationProtection[index] = 0;
    }
  }
  return { minX, maxX, minZ, maxZ };
}

export interface CliffStrokeSettings {
  /** Shelf reach on either side of the drawn edge. */
  readonly radius: number;
  /** Height added to the left side of the directed stroke. */
  readonly height: number;
  /** Width of the transition across the cliff face. */
  readonly edgeWidth?: number;
}

function smoothstep01(value: number): number {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

/** Raise a shelf on the left of a directed line, leaving a narrow cliff face at the line. */
export function applyCliffStroke(
  terrain: Pick<TerrainHistory, "side" | "extent" | "elevations" | "disturbance" | "vegetationProtection">,
  startX: number,
  startZ: number,
  endX: number,
  endZ: number,
  settings: Readonly<CliffStrokeSettings>,
): TerrainEditBounds | undefined {
  const dx = endX - startX;
  const dz = endZ - startZ;
  const length = Math.hypot(dx, dz);
  if (length < 1) return undefined;
  if (!Number.isFinite(settings.radius) || settings.radius <= 0) throw new RangeError("cliff radius must be positive and finite");
  if (!Number.isFinite(settings.height) || settings.height <= 0) throw new RangeError("cliff height must be positive and finite");
  const step = terrain.extent / (terrain.side - 1);
  const half = terrain.extent / 2;
  const bound = settings.radius;
  const minX = Math.max(0, Math.floor((Math.min(startX, endX) - bound + half) / step));
  const maxX = Math.min(terrain.side - 1, Math.ceil((Math.max(startX, endX) + bound + half) / step));
  const minZ = Math.max(0, Math.floor((Math.min(startZ, endZ) - bound + half) / step));
  const maxZ = Math.min(terrain.side - 1, Math.ceil((Math.max(startZ, endZ) + bound + half) / step));
  const ux = dx / length;
  const uz = dz / length;
  const edgeWidth = Math.max(step * 0.75, settings.edgeWidth ?? settings.radius * 0.16);
  let changed = false;

  for (let gz = minZ; gz <= maxZ; gz++) {
    const z = gz * step - half;
    for (let gx = minX; gx <= maxX; gx++) {
      const x = gx * step - half;
      const rx = x - startX;
      const rz = z - startZ;
      const along = rx * ux + rz * uz;
      if (along < -bound || along > length + bound) continue;
      const across = -rx * uz + rz * ux;
      if (Math.abs(across) > bound) continue;
      const endpoint = smoothstep01((along + bound) / bound) * smoothstep01((length + bound - along) / bound);
      const shelf = smoothstep01((across + edgeWidth * 0.5) / edgeWidth);
      const outerFeather = smoothstep01((bound - across) / Math.max(step, bound * 0.28));
      const weight = endpoint * shelf * outerFeather;
      if (weight <= 0) continue;
      const index = gz * terrain.side + gx;
      terrain.elevations[index] = terrain.elevations[index]! + settings.height * weight;
      terrain.disturbance[index] = 1;
      terrain.vegetationProtection[index] = 0;
      changed = true;
    }
  }
  return changed ? { minX, maxX, minZ, maxZ } : undefined;
}

export class TerrainEditHistory {
  readonly #undo: TerrainEditSnapshot[] = [];
  readonly #redo: TerrainEditSnapshot[] = [];

  constructor(readonly limit = 20) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError("terrain edit history limit must be positive");
  }

  get canUndo(): boolean { return this.#undo.length > 0; }
  get canRedo(): boolean { return this.#redo.length > 0; }

  checkpoint(snapshot: TerrainEditSnapshot): void {
    this.#undo.push(snapshot);
    if (this.#undo.length > this.limit) this.#undo.shift();
    this.#redo.length = 0;
  }

  clear(): void {
    this.#undo.length = 0;
    this.#redo.length = 0;
  }

  undo(current: TerrainEditSnapshot): TerrainEditSnapshot | undefined {
    const previous = this.#undo.pop();
    if (!previous) return undefined;
    this.#redo.push(current);
    return previous;
  }

  redo(current: TerrainEditSnapshot): TerrainEditSnapshot | undefined {
    const next = this.#redo.pop();
    if (!next) return undefined;
    this.#undo.push(current);
    return next;
  }
}
