import { BufferAttribute, BufferGeometry } from "three/webgpu";
import geometryUrl from "../assets/ecosystem/epoch-seagrass-meadow/runtime/seagrass-geometries.json?url";

export type SeagrassGeometryLevel = "near" | "far";

interface PackedGeometry {
  readonly position: number[];
  readonly index: number[];
}

interface GeometryData {
  readonly schemaVersion: 1;
  readonly levels: Record<SeagrassGeometryLevel, PackedGeometry>;
}

let geometryData: GeometryData | undefined;
const cache = new Map<SeagrassGeometryLevel, BufferGeometry>();

export async function loadSeagrassGeometryAssets(): Promise<void> {
  if (geometryData) return;
  const response = await fetch(geometryUrl);
  if (!response.ok) throw new Error(`seagrass geometry load failed: ${response.status}`);
  geometryData = await response.json() as GeometryData;
}

export function seagrassGeometry(level: SeagrassGeometryLevel): BufferGeometry {
  const cached = cache.get(level);
  if (cached) return cached;
  if (!geometryData) throw new Error("seagrass geometry assets must load before creating meadows");
  const record = geometryData.levels[level];
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(record.position), 3));
  geometry.setIndex(new BufferAttribute(new Uint16Array(record.index), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  cache.set(level, geometry);
  return geometry;
}
