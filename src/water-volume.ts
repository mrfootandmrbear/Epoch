import { SEA_LEVEL, type ClimateForces } from "./climate";
import { snapshotHeightAt, type WorldSnapshot } from "./world-snapshot";

export type WaterBand = "benthic" | "midwater" | "surface";

export interface WaterNode {
  readonly id: number;
  readonly column: number;
  readonly gridX: number;
  readonly gridZ: number;
  readonly band: WaterBand;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly seabed: number;
  readonly columnDepth: number;
  readonly light: number;
  readonly neighbors: readonly number[];
}

export interface BenthicSite {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly depth: number;
  readonly light: number;
  readonly slope: number;
  readonly stableSubstrate: number;
}

export interface WaterVolume {
  readonly side: number;
  readonly extent: number;
  readonly step: number;
  readonly seaLevel: number;
  readonly nodes: readonly WaterNode[];
  readonly benthicSites: readonly BenthicSite[];
}

const BAND_MINIMUM_DEPTH: Readonly<Record<WaterBand, number>> = {
  benthic: 0.7,
  midwater: 2.5,
  surface: 1,
};

const bandY = (band: WaterBand, seabed: number, sea: number, depth: number): number => {
  if (band === "surface") return sea - Math.min(0.45, depth * 0.2);
  if (band === "midwater") return sea - depth * 0.5;
  return seabed + Math.min(0.65, depth * 0.22);
};

/** Build a coarse navigable water volume plus a distinct seabed contract. */
export function buildWaterVolume(snapshot: WorldSnapshot, side = 25): WaterVolume {
  const sea = SEA_LEVEL[(snapshot.climate as ClimateForces).seaLevel];
  const step = snapshot.extent / (side - 1);
  const half = snapshot.extent / 2;
  const nodes: Array<Omit<WaterNode, "neighbors"> & { neighbors: number[] }> = [];
  const nodeAt = new Map<string, number>();
  const benthicSites: BenthicSite[] = [];
  const bands: readonly WaterBand[] = ["benthic", "midwater", "surface"];
  const key = (x: number, z: number, band: WaterBand) => `${x}:${z}:${band}`;

  for (let gridZ = 0; gridZ < side; gridZ++) {
    for (let gridX = 0; gridX < side; gridX++) {
      const x = -half + gridX * step;
      const z = -half + gridZ * step;
      const seabed = snapshotHeightAt(snapshot, x, z);
      const depth = sea - seabed;
      if (depth <= 0) continue;
      const east = snapshotHeightAt(snapshot, Math.min(half, x + step * 0.35), z);
      const west = snapshotHeightAt(snapshot, Math.max(-half, x - step * 0.35), z);
      const north = snapshotHeightAt(snapshot, x, Math.min(half, z + step * 0.35));
      const south = snapshotHeightAt(snapshot, x, Math.max(-half, z - step * 0.35));
      const slope = Math.hypot(east - west, north - south) / Math.max(1, step * 0.7);
      const light = Math.max(0, Math.min(1, 1 - depth / 18));
      benthicSites.push({ x, y: seabed, z, depth, light, slope, stableSubstrate: Math.max(0, Math.min(1, 1 - slope * 0.85)) });
      for (const band of bands) {
        if (depth < BAND_MINIMUM_DEPTH[band]) continue;
        const id = nodes.length;
        nodes.push({ id, column: gridZ * side + gridX, gridX, gridZ, band, x,
          y: bandY(band, seabed, sea, depth), z, seabed, columnDepth: depth, light, neighbors: [] });
        nodeAt.set(key(gridX, gridZ, band), id);
      }
    }
  }

  const connect = (first: number | undefined, second: number | undefined): void => {
    if (first === undefined || second === undefined) return;
    if (!nodes[first]!.neighbors.includes(second)) nodes[first]!.neighbors.push(second);
    if (!nodes[second]!.neighbors.includes(first)) nodes[second]!.neighbors.push(first);
  };
  for (const node of nodes) {
    for (const [dx, dz] of [[1, 0], [0, 1]] as const) {
      const neighbor = nodeAt.get(key(node.gridX + dx, node.gridZ + dz, node.band));
      if (neighbor === undefined) continue;
      const other = nodes[neighbor]!;
      const midpointDepth = sea - snapshotHeightAt(snapshot, (node.x + other.x) / 2, (node.z + other.z) / 2);
      if (midpointDepth >= BAND_MINIMUM_DEPTH[node.band]) connect(node.id, neighbor);
    }
    if (node.band === "benthic") connect(node.id, nodeAt.get(key(node.gridX, node.gridZ, "midwater")));
    if (node.band === "midwater") connect(node.id, nodeAt.get(key(node.gridX, node.gridZ, "surface")));
  }
  return { side, extent: snapshot.extent, step, seaLevel: sea, nodes, benthicSites };
}

export function waterNodeSupportsBody(node: WaterNode, bodySize: number): boolean {
  const requiredDepth = 0.45 + bodySize * 1.7;
  return node.columnDepth >= requiredDepth;
}

export function reachableWaterNodes(
  volume: WaterVolume,
  origin: Readonly<{ x: number; z: number; band?: WaterBand }> | undefined,
  bodySize: number,
  maximumDistance: number,
): readonly WaterNode[] {
  const viable = volume.nodes.filter((node) => waterNodeSupportsBody(node, bodySize));
  if (!origin) return viable;
  const start = viable.reduce<WaterNode | undefined>((best, node) => {
    const bandPenalty = origin.band && origin.band !== node.band ? volume.step : 0;
    const distance = Math.hypot(node.x - origin.x, node.z - origin.z) + bandPenalty;
    return !best || distance < Math.hypot(best.x - origin.x, best.z - origin.z) ? node : best;
  }, undefined);
  if (!start) return [];
  const allowed = new Set(viable.map((node) => node.id));
  const distances = new Map<number, number>([[start.id, 0]]);
  const queue = [start.id];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const id = queue[cursor]!;
    const distance = distances.get(id)!;
    for (const neighbor of volume.nodes[id]!.neighbors) {
      if (!allowed.has(neighbor)) continue;
      const stepCost = volume.nodes[id]!.column === volume.nodes[neighbor]!.column ? volume.step * 0.35 : volume.step;
      const nextDistance = distance + stepCost;
      if (nextDistance > maximumDistance || nextDistance >= (distances.get(neighbor) ?? Infinity)) continue;
      distances.set(neighbor, nextDistance);
      queue.push(neighbor);
    }
  }
  return [...distances.keys()].map((id) => volume.nodes[id]!);
}
