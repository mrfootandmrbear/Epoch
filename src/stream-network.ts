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

const DX = [-1, 0, 1, -1, 1, -1, 0, 1] as const;
const DZ = [-1, -1, -1, 0, 0, 1, 1, 1] as const;

interface MutableSegment {
  from: number;
  to: number;
  discharge: number;
  drop: number;
  length: number;
}

/** Resolve a sparse connected drainage network from coarse runoff and relief. */
export function resolveStreamSegments(
  terrain: Pick<TerrainHistory, "side" | "extent" | "elevations" | "runoff">,
  seaLevel: number,
  maxSources = 28,
): StreamSegment[] {
  const { side, extent, elevations, runoff } = terrain;
  const cellStep = extent / (side - 1);
  const candidates: number[] = [];
  for (let z = 2; z < side - 2; z++) for (let x = 2; x < side - 2; x++) {
    const index = z * side + x;
    if (runoff[index]! >= 0.12 && elevations[index]! > seaLevel + 1) candidates.push(index);
  }
  candidates.sort((a, b) => runoff[b]! - runoff[a]! || elevations[b]! - elevations[a]! || a - b);

  const sources: number[] = [];
  for (const index of candidates) {
    const x = index % side;
    const z = Math.floor(index / side);
    if (sources.some((source) => Math.hypot(x - source % side, z - Math.floor(source / side)) < 8)) continue;
    sources.push(index);
    if (sources.length >= maxSources) break;
  }

  const segments = new Map<string, MutableSegment>();
  for (const source of sources) {
    let current = source;
    const visited = new Set<number>();
    const sourceFlow = Math.max(0.01, runoff[source]!);
    for (let step = 0; step < side && !visited.has(current); step++) {
      visited.add(current);
      const x = current % side;
      const z = Math.floor(current / side);
      let next = -1;
      let bestGrade = 0;
      let bestDrop = 0;
      let bestLength = 0;
      for (let direction = 0; direction < 8; direction++) {
        const nx = x + DX[direction]!;
        const nz = z + DZ[direction]!;
        if (nx < 0 || nx >= side || nz < 0 || nz >= side) continue;
        const candidate = nz * side + nx;
        const drop = elevations[current]! - elevations[candidate]!;
        if (drop <= 0.01) continue;
        const length = cellStep * (DX[direction] !== 0 && DZ[direction] !== 0 ? Math.SQRT2 : 1);
        const grade = drop / length;
        if (grade > bestGrade + 1e-9 || (Math.abs(grade - bestGrade) <= 1e-9 && candidate < next)) {
          next = candidate;
          bestGrade = grade;
          bestDrop = drop;
          bestLength = length;
        }
      }
      if (next < 0) break;
      const key = `${current}:${next}`;
      const existing = segments.get(key);
      if (existing) existing.discharge += sourceFlow;
      else segments.set(key, {
        from: current,
        to: next,
        discharge: sourceFlow,
        drop: bestDrop,
        length: bestLength,
      });
      current = next;
      if (elevations[current]! <= seaLevel + 0.15) break;
    }
  }

  const byFrom = new Map<number, MutableSegment>();
  for (const segment of segments.values()) byFrom.set(segment.from, segment);
  const distanceCache = new Map<number, number>();
  const distanceToOutlet = (index: number): number => {
    const cached = distanceCache.get(index);
    if (cached !== undefined) return cached;
    const segment = byFrom.get(index);
    const distance = segment ? segment.length + distanceToOutlet(segment.to) : 0;
    distanceCache.set(index, distance);
    return distance;
  };

  return [...segments.values()].map((segment) => ({
    ...segment,
    fromDistance: distanceToOutlet(segment.from),
    toDistance: distanceToOutlet(segment.to),
  }));
}
