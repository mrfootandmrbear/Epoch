import type { TerrainHistory } from "./terrain-history";

export interface StreamSegment {
  readonly from: number;
  readonly to: number;
  readonly flow: number;
  readonly drop: number;
}

const DX = [-1, 0, 1, -1, 1, -1, 0, 1] as const;
const DZ = [-1, -1, -1, 0, 0, 1, 1, 1] as const;

/** Resolve a sparse connected drainage network from coarse runoff and relief. */
export function resolveStreamSegments(
  terrain: Pick<TerrainHistory, "side" | "elevations" | "runoff">,
  seaLevel: number,
  maxSources = 28,
): StreamSegment[] {
  const { side, elevations, runoff } = terrain;
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

  const segments = new Map<string, StreamSegment>();
  for (const source of sources) {
    let current = source;
    const visited = new Set<number>();
    for (let step = 0; step < side && !visited.has(current); step++) {
      visited.add(current);
      const x = current % side;
      const z = Math.floor(current / side);
      let next = current;
      let nextHeight = elevations[current]!;
      for (let direction = 0; direction < 8; direction++) {
        const nx = x + DX[direction]!;
        const nz = z + DZ[direction]!;
        if (nx < 0 || nx >= side || nz < 0 || nz >= side) continue;
        const candidate = nz * side + nx;
        const height = elevations[candidate]!;
        if (height < nextHeight - 0.01 || (height === nextHeight && candidate < next)) {
          next = candidate;
          nextHeight = height;
        }
      }
      if (next === current) break;
      const key = `${current}:${next}`;
      segments.set(key, {
        from: current,
        to: next,
        flow: Math.max(runoff[current]!, runoff[next]!),
        drop: elevations[current]! - elevations[next]!,
      });
      current = next;
      if (elevations[current]! <= seaLevel + 0.15) break;
    }
  }
  return [...segments.values()];
}
