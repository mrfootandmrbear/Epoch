import type { TerrainHistory } from "./terrain-history";

export interface StreamSegment {
  readonly from: number;
  readonly to: number;
  readonly discharge: number;
  readonly drop: number;
  readonly length: number;
  /** Distance in metres remaining to the downstream end of the network. */
  readonly fromDistance: number;
  readonly toDistance: number;
}

/** Below this discharge a reach carries no visible water surface. */
export const MIN_VISIBLE_DISCHARGE = 0.12;
/** Above this grade water aerates instead of holding a coherent creek surface. */
export const CREEK_MAX_GRADE = 0.22;
/** Above this grade water separates from the bed and plunges. */
export const FALL_MIN_GRADE = 1;

export type ReachKind = "dry" | "creek" | "rapid" | "fall";

/**
 * One classification shared by every inland-water renderer. The grade bands are
 * a rendering decision, not hydrology: the resolver owns discharge and drop, and
 * this only decides which surface treatment reads correctly for that pair.
 */
export function classifyReach(segment: StreamSegment): ReachKind {
  if (segment.discharge < MIN_VISIBLE_DISCHARGE) return "dry";
  const grade = segment.drop / segment.length;
  if (grade <= CREEK_MAX_GRADE) return "creek";
  return grade < FALL_MIN_GRADE ? "rapid" : "fall";
}

/**
 * How aerated a steep reach reads, 0 at the creek seam and 1 on a sheer face.
 * Continuity at the seam is what keeps a river from changing material abruptly
 * where its grade crosses a threshold.
 */
export function reachAeration(segment: StreamSegment): number {
  const grade = segment.drop / segment.length;
  return Math.max(0, Math.min(1, (grade - CREEK_MAX_GRADE) / (1.45 - CREEK_MAX_GRADE)));
}

const D8_X = [-1, 0, 1, -1, 1, -1, 0, 1] as const;
const D8_Z = [-1, -1, -1, 0, 0, 1, 1, 1] as const;

interface HeapEntry { index: number; level: number }

/** Deterministic min-heap: ties break on cell index, never on insertion order. */
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

/** Cells connected to the map edge below sea level — the true open ocean, not an inland pit that happens to sit low. */
function connectedOcean(side: number, elevations: Float32Array, seaLevel: number): Uint8Array {
  const ocean = new Uint8Array(side * side);
  const queue = new Int32Array(side * side);
  let head = 0;
  let tail = 0;
  const visit = (index: number): void => {
    if (ocean[index] || elevations[index]! >= seaLevel) return;
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

/**
 * A cell must gather at least this many upstream cells — not units of water —
 * before it counts as a channel. Gating on catchment area rather than raw
 * accumulated runoff keeps channelization a geometric question independent of
 * climate: a single wet cell's own runoff can already sit near the 0-1 ceiling,
 * which would otherwise channelize an entire steep young slope on its own,
 * while an arid catchment ten times the size can carry less total water than
 * one wet cell. Area still has to carry real water to render — see
 * `MIN_VISIBLE_DISCHARGE` below — this only decides where a channel may start.
 */
export const MIN_CATCHMENT_CELLS = 40;
/** Hard ceiling on emitted reaches, independent of how much terrain qualifies. */
export const MAX_STREAM_SEGMENTS = 900;
/**
 * Accumulated runoff sums without bound as catchments merge — a trunk river
 * near the coast can gather two orders of magnitude more than a headwater.
 * `MIN_VISIBLE_DISCHARGE`, `MIN_PLUNGE_DISCHARGE` and every renderer's width
 * curve downstream of this module were calibrated against single-source flow
 * values of roughly 0.1-1. A square root keeps that calibration valid: it is
 * the same compression the renderers already apply for width, so folding one
 * copy in here maps the full accumulated range back down to a bounded 0-~3
 * band without re-tuning any consumer, while staying strictly monotonic so
 * "increases downstream" is preserved exactly.
 */
const DISCHARGE_SCALE = 0.15;

/**
 * Resolve a bounded, deterministic drainage network from terrain and runoff.
 *
 * This is a D8 receiver graph built with an ocean-seeded priority flood — the
 * same technique `freshwater-basins.ts` uses to fill depressions, reused here
 * so flats and pits get a well-defined, cycle-free drainage direction instead
 * of a special-cased escape. Every land cell gets exactly one receiver (the
 * next cell downstream); following receivers from any cell strictly follows
 * non-increasing filled elevation and terminates at the ocean or a retained
 * depression, so the graph can neither cycle nor flow uphill. Flow accumulates from every cell's
 * own runoff up through that graph, so a channel only appears where real
 * upstream catchment backs it — not wherever one cell's local runoff sample
 * happened to be high. Tributary edges that share a receiver automatically
 * share the rendered downstream reach, because they *are* the same edge.
 */
export interface StreamNetworkOptions {
  /** Override for `MIN_CATCHMENT_CELLS`, mainly so small fixtures can exercise topology without needing production-scale catchments. */
  readonly minCatchmentCells?: number;
  readonly maxSegments?: number;
  /** Finite entries mark retained standing water that absorbs inflow. */
  readonly retainedWaterSurface?: Float32Array;
}

export function resolveStreamSegments(
  terrain: Pick<TerrainHistory, "side" | "extent" | "elevations" | "runoff">,
  seaLevel: number,
  options: StreamNetworkOptions = {},
): StreamSegment[] {
  const minCatchmentCells = options.minCatchmentCells ?? MIN_CATCHMENT_CELLS;
  const maxSegments = options.maxSegments ?? MAX_STREAM_SEGMENTS;
  const retainedWaterSurface = options.retainedWaterSurface;
  const { side, extent, elevations, runoff } = terrain;
  const count = side * side;
  const cellStep = extent / (side - 1);

  const ocean = connectedOcean(side, elevations, seaLevel);

  // Priority flood outward from the ocean, exactly as `freshwater-basins.ts`
  // fills depressions. This alone gives every cell a `floodParent` — the
  // neighbor that first reached it — which is a proven cycle-free route to the
  // ocean, including across perfectly flat plateaus where no local gradient
  // exists to route by at all.
  const visited = new Uint8Array(count);
  const floodParent = new Int32Array(count).fill(-1);
  const filled = new Float32Array(count);
  const heap = new MinHeap();
  let seeded = false;
  for (let i = 0; i < count; i++) {
    if (!ocean[i]) continue;
    visited[i] = 1;
    filled[i] = seaLevel;
    heap.push({ index: i, level: seaLevel });
    seeded = true;
  }
  if (!seeded) {
    // No ocean reachable — an inland-only fixture, most likely. Seed from the
    // map boundary so the fill still has a deterministic root to hang off.
    for (let i = 0; i < side; i++) {
      for (const index of [i, (side - 1) * side + i, i * side, i * side + side - 1]) {
        if (visited[index]) continue;
        visited[index] = 1;
        filled[index] = elevations[index]!;
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
      const neighbor = nz * side + nx;
      if (visited[neighbor]) continue;
      visited[neighbor] = 1;
      floodParent[neighbor] = current.index;
      filled[neighbor] = Math.max(elevations[neighbor]!, current.level);
      heap.push({ index: neighbor, level: filled[neighbor]! });
    }
  }

  // Refine direction wherever real terrain gradient exists: among neighbors
  // that are strictly lower on the filled surface (so choosing one can never
  // create a cycle — see below), prefer the one with the steepest true grade,
  // the same normalized drop/length comparison the renderer's grade bands are
  // tuned against. Only cells with no strictly-lower neighbor at all — flat
  // plateaus and depression floors, where grade has no signal — keep the
  // flood's own routing.
  //
  // This can never introduce a cycle: every chosen edge (refined or fallback)
  // has filled[receiver] <= filled[cell], so any cycle would require every
  // cell on it to share one filled value exactly — but a refined edge always
  // strictly decreases filled, so an all-equal cycle could only be built from
  // fallback edges, and the flood's parent pointers are already a proven tree.
  const receiver = floodParent.slice();
  for (let i = 0; i < count; i++) {
    if (floodParent[i]! < 0) continue;
    const x = i % side;
    const z = Math.floor(i / side);
    let bestReceiver = -1;
    let bestGrade = -Infinity;
    for (let d = 0; d < 8; d++) {
      const nx = x + D8_X[d]!;
      const nz = z + D8_Z[d]!;
      if (nx < 0 || nx >= side || nz < 0 || nz >= side) continue;
      const neighbor = nz * side + nx;
      if (filled[neighbor]! >= filled[i]! - 1e-6) continue;
      const length = cellStep * (D8_X[d] !== 0 && D8_Z[d] !== 0 ? Math.SQRT2 : 1);
      const grade = (elevations[i]! - elevations[neighbor]!) / length;
      if (grade > bestGrade + 1e-9 || (Math.abs(grade - bestGrade) <= 1e-9 && neighbor < bestReceiver)) {
        bestReceiver = neighbor;
        bestGrade = grade;
      }
    }
    if (bestReceiver >= 0) receiver[i] = bestReceiver;
  }

  // Retained freshwater is a hydrologic terminal until its surface reaches a
  // spillway. Likewise, an unresolved depression cannot silently route water
  // uphill: stop at its floor rather than fabricating a positive render drop.
  // The incoming edge remains, so a stream visibly feeds the pool; only the
  // impossible pass-through edge is removed.
  for (let i = 0; i < count; i++) {
    const r = receiver[i]!;
    if (r < 0) continue;
    if (retainedWaterSurface && Number.isFinite(retainedWaterSurface[i])) {
      receiver[i] = -1;
      continue;
    }
    if (elevations[r]! > elevations[i]! + 1e-6) receiver[i] = -1;
  }

  // Topological order over the final receiver graph, derived fresh by BFS
  // from the roots rather than assumed from flood order (refinement above can
  // reassign a cell to a receiver the flood discovered in a different order).
  const children: number[][] = Array.from({ length: count }, () => []);
  for (let i = 0; i < count; i++) {
    const r = receiver[i]!;
    if (r >= 0) children[r]!.push(i);
  }
  const order: number[] = [];
  for (let i = 0; i < count; i++) if (receiver[i]! < 0) order.push(i);
  for (let k = 0; k < order.length; k++) {
    for (const child of children[order[k]!]!) order.push(child);
  }
  if (order.length !== count) throw new Error("Drainage receiver graph contains a cycle");

  // Flow accumulation. `order` places every receiver strictly before whatever
  // reaches it, so walking it backwards folds each cell's flow into its
  // receiver exactly once — a valid topological pass with no separate sort.
  // Catchment cell count accumulates the same way, in the same pass — it is
  // what decides *where* a channel may start; accumulated runoff is what
  // decides how much water it carries once it does.
  const accumulation = new Float32Array(count);
  const catchmentCells = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    accumulation[i] = Math.max(0, runoff[i]!);
    catchmentCells[i] = 1;
  }
  for (let k = order.length - 1; k >= 0; k--) {
    const cell = order[k]!;
    const r = receiver[cell]!;
    if (r >= 0) {
      accumulation[r] += accumulation[cell]!;
      catchmentCells[r] += catchmentCells[cell]!;
    }
  }

  // Distance-to-terminal and per-cell edge length, forward pass this time (a
  // receiver's own distance must already be resolved before its children add
  // to it, and `order` gives receivers an earlier position than their children).
  const distanceToOutlet = new Float32Array(count);
  const edgeLength = new Float32Array(count);
  for (let k = 0; k < order.length; k++) {
    const cell = order[k]!;
    const r = receiver[cell]!;
    if (r < 0) continue;
    const dx = (cell % side) - (r % side);
    const dz = Math.floor(cell / side) - Math.floor(r / side);
    const length = cellStep * (dx !== 0 && dz !== 0 ? Math.SQRT2 : 1);
    edgeLength[cell] = length;
    distanceToOutlet[cell] = length + distanceToOutlet[r]!;
  }

  // A cell channelizes once real upstream area backs it and that area is
  // actually carrying visible water. Land already at or below sea level
  // cannot originate a new reach (it is the mouth, not a source). `sqrt` is
  // monotonic, so gating and ranking on the compressed value instead of the
  // raw sum changes which cells clear `MIN_VISIBLE_DISCHARGE` without
  // disturbing the accumulation order it relies on.
  const channelized: number[] = [];
  for (let i = 0; i < count; i++) {
    if (receiver[i]! < 0) continue;
    if (elevations[i]! <= seaLevel + 0.15) continue;
    if (catchmentCells[i]! < minCatchmentCells) continue;
    if (Math.sqrt(accumulation[i]!) * DISCHARGE_SCALE < MIN_VISIBLE_DISCHARGE) continue;
    channelized.push(i);
  }
  // Bounded output: keep the largest catchments first if there are more than
  // the cap allows. Accumulation is non-decreasing downstream by construction,
  // so every kept cell's entire path to the outlet also qualifies — trimming
  // by rank can never strand a kept reach without its downstream continuation.
  channelized.sort((a, b) => (
    accumulation[b]! - accumulation[a]!
    || distanceToOutlet[a]! - distanceToOutlet[b]!
    || a - b
  ));
  const selected = channelized.slice(0, maxSegments).sort((a, b) => a - b);

  return selected.map((from) => {
    const to = receiver[from]!;
    const drop = Math.max(0, elevations[from]! - elevations[to]!);
    return {
      from,
      to,
      discharge: Math.sqrt(accumulation[from]!) * DISCHARGE_SCALE,
      drop,
      length: edgeLength[from]!,
      fromDistance: distanceToOutlet[from]!,
      toDistance: distanceToOutlet[to]!,
    };
  });
}
