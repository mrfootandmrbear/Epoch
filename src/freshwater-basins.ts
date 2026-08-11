import type { RainfallRegime } from "./climate";
import type { FreshwaterOutcome } from "./outcome-resolver";
import type { WorldSnapshot } from "./world-snapshot";

export interface FreshwaterField {
  readonly gridSize: number;
  readonly extent: number;
  /** Absolute water-surface elevation; NaN means dry or ocean-connected. */
  readonly surface: Float32Array;
  readonly depth: Float32Array;
  readonly basins: FreshwaterOutcome[];
}

interface HeapEntry { index: number; level: number }

class MinHeap {
  private readonly values: HeapEntry[] = [];
  private less(a: HeapEntry, b: HeapEntry): boolean {
    return a.level !== b.level ? a.level < b.level : a.index < b.index;
  }
  push(entry: HeapEntry): void {
    this.values.push(entry);
    let i = this.values.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(this.values[i]!, this.values[parent]!)) break;
      [this.values[i], this.values[parent]] = [this.values[parent]!, this.values[i]!];
      i = parent;
    }
  }
  pop(): HeapEntry | undefined {
    const root = this.values[0];
    const last = this.values.pop();
    if (!root || !last || this.values.length === 0) return root;
    this.values[0] = last;
    let i = 0;
    while (true) {
      let child = i;
      const left = i * 2 + 1;
      const right = left + 1;
      if (left < this.values.length && this.less(this.values[left]!, this.values[child]!)) child = left;
      if (right < this.values.length && this.less(this.values[right]!, this.values[child]!)) child = right;
      if (child === i) break;
      [this.values[i], this.values[child]] = [this.values[child]!, this.values[i]!];
      i = child;
    }
    return root;
  }
  get size(): number { return this.values.length; }
}

const D8_X = [-1, 0, 1, -1, 1, -1, 0, 1] as const;
const D8_Z = [-1, -1, -1, 0, 0, 1, 1, 1] as const;

function connectedOcean(snapshot: WorldSnapshot, seaLevel: number): Uint8Array {
  const side = snapshot.gridSize;
  const ocean = new Uint8Array(side * side);
  const queue = new Int32Array(side * side);
  let head = 0;
  let tail = 0;
  const visit = (index: number): void => {
    if (ocean[index] || snapshot.elevations[index]! >= seaLevel) return;
    ocean[index] = 1;
    queue[tail++] = index;
  };
  for (let i = 0; i < side; i++) {
    visit(i);
    visit((side - 1) * side + i);
    visit(i * side);
    visit(i * side + side - 1);
  }
  while (head < tail) {
    const index = queue[head++]!;
    const x = index % side;
    const z = Math.floor(index / side);
    for (let d = 0; d < 8; d++) {
      const nx = x + D8_X[d]!;
      const nz = z + D8_Z[d]!;
      if (nx >= 0 && nx < side && nz >= 0 && nz < side) visit(nz * side + nx);
    }
  }
  return ocean;
}

/** Habitat-style ocean-seeded Priority-Flood with rainfall-dependent storage. */
export function resolveFreshwaterField(
  snapshot: WorldSnapshot,
  seaLevel: number,
  rainfall: RainfallRegime,
): FreshwaterField {
  const side = snapshot.gridSize;
  const count = side * side;
  const ocean = connectedOcean(snapshot, seaLevel);
  const filled = new Float32Array(snapshot.elevations);
  const visited = new Uint8Array(count);
  const heap = new MinHeap();
  for (let i = 0; i < count; i++) {
    if (!ocean[i]) continue;
    visited[i] = 1;
    heap.push({ index: i, level: seaLevel });
  }
  if (heap.size === 0) {
    for (let i = 0; i < side; i++) {
      for (const index of [i, (side - 1) * side + i, i * side, i * side + side - 1]) {
        if (visited[index]) continue;
        visited[index] = 1;
        heap.push({ index, level: filled[index]! });
      }
    }
  }
  while (heap.size) {
    const current = heap.pop()!;
    const x = current.index % side;
    const z = Math.floor(current.index / side);
    for (let d = 0; d < 8; d++) {
      const nx = x + D8_X[d]!;
      const nz = z + D8_Z[d]!;
      if (nx < 0 || nx >= side || nz < 0 || nz >= side) continue;
      const index = nz * side + nx;
      if (visited[index]) continue;
      visited[index] = 1;
      const raw = filled[index]!;
      filled[index] = Math.max(raw, current.level);
      heap.push({ index, level: filled[index]! });
    }
  }

  const fillFraction = rainfall === "wet" ? 0.92 : rainfall === "temperate" ? 0.68 : 0.3;
  const minimumFullDepth = rainfall === "arid" ? 1.2 : 0.45;
  const candidate = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    if (!ocean[i] && filled[i]! - snapshot.elevations[i]! >= minimumFullDepth) candidate[i] = 1;
  }

  const surface = new Float32Array(count);
  surface.fill(Number.NaN);
  const depth = new Float32Array(count);
  const basins: Array<FreshwaterOutcome & { score: number }> = [];
  const queue = new Int32Array(count);
  const cellSize = snapshot.extent / (side - 1);
  for (let start = 0; start < count; start++) {
    if (!candidate[start]) continue;
    const spillLevel = filled[start]!;
    let head = 0;
    let tail = 0;
    let bottom = Infinity;
    candidate[start] = 0;
    queue[tail++] = start;
    while (head < tail) {
      const index = queue[head++]!;
      bottom = Math.min(bottom, snapshot.elevations[index]!);
      const x = index % side;
      const z = Math.floor(index / side);
      for (let d = 0; d < 8; d++) {
        const nx = x + D8_X[d]!;
        const nz = z + D8_Z[d]!;
        if (nx < 0 || nx >= side || nz < 0 || nz >= side) continue;
        const next = nz * side + nx;
        if (!candidate[next] || Math.abs(filled[next]! - spillLevel) > 1e-4) continue;
        candidate[next] = 0;
        queue[tail++] = next;
      }
    }
    if (tail < 2) continue;
    const waterLevel = bottom + (spillLevel - bottom) * fillFraction;
    let wetCells = 0;
    let weightedX = 0;
    let weightedZ = 0;
    let volume = 0;
    for (let q = 0; q < tail; q++) {
      const index = queue[q]!;
      const cellDepth = waterLevel - snapshot.elevations[index]!;
      if (cellDepth < 0.08) continue;
      surface[index] = waterLevel;
      depth[index] = cellDepth;
      const x = index % side;
      const z = Math.floor(index / side);
      weightedX += x * cellDepth;
      weightedZ += z * cellDepth;
      volume += cellDepth;
      wetCells++;
    }
    if (wetCells < 2 || volume <= 0) continue;
    const gx = weightedX / volume;
    const gz = weightedZ / volume;
    basins.push({
      x: (gx / (side - 1) - 0.5) * snapshot.extent,
      y: waterLevel,
      z: (gz / (side - 1) - 0.5) * snapshot.extent,
      radius: Math.sqrt(wetCells * cellSize * cellSize / Math.PI),
      score: volume * cellSize * cellSize,
    });
  }
  return {
    gridSize: side,
    extent: snapshot.extent,
    surface,
    depth,
    basins: basins.sort((a, b) => b.score - a.score).map(({ score: _score, ...basin }) => basin),
  };
}

export function resolveFreshwaterBasins(
  snapshot: WorldSnapshot,
  seaLevel: number,
  rainfall: RainfallRegime,
): FreshwaterOutcome[] {
  return resolveFreshwaterField(snapshot, seaLevel, rainfall).basins;
}
