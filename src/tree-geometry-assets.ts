import { BufferAttribute, BufferGeometry } from "three/webgpu";
import geometryUrl from "../assets/ecosystem/epoch-canopy-tree/runtime/ez-tree-geometries.json?url";

export type TreeGeometryGuild = "broadleaf" | "conifer" | "windswept" | "mangrove";
export type TreeGeometryLevel = "near" | "far";
export type TreeGeometryPart = "branches" | "leaves";

interface PackedGeometry {
  readonly position: string;
  readonly normal: string;
  readonly uv: string;
  readonly index: string;
  readonly indexType: "uint16" | "uint32";
}

interface GeometryData {
  readonly families: Record<TreeGeometryGuild, Record<TreeGeometryLevel, Record<TreeGeometryPart, PackedGeometry>>>;
}

let geometryData: GeometryData | undefined;

export async function loadTreeGeometryAssets(): Promise<void> {
  if (geometryData) return;
  const response = await fetch(geometryUrl);
  if (!response.ok) throw new Error(`tree geometry load failed: ${response.status}`);
  geometryData = await response.json() as GeometryData;
}

function decodeBytes(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function float32(encoded: string): Float32Array {
  const bytes = decodeBytes(encoded);
  return new Float32Array(bytes.buffer);
}

function indexArray(encoded: string, type: PackedGeometry["indexType"]): Uint16Array | Uint32Array {
  const bytes = decodeBytes(encoded);
  return type === "uint32" ? new Uint32Array(bytes.buffer) : new Uint16Array(bytes.buffer);
}

function unpack(record: PackedGeometry): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(float32(record.position), 3));
  if (record.normal) geometry.setAttribute("normal", new BufferAttribute(float32(record.normal), 3));
  if (record.uv) geometry.setAttribute("uv", new BufferAttribute(float32(record.uv), 2));
  if (record.index) geometry.setIndex(new BufferAttribute(indexArray(record.index, record.indexType), 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

const cache = new Map<string, BufferGeometry>();

export function treeGeometry(
  guild: TreeGeometryGuild,
  level: TreeGeometryLevel,
  part: TreeGeometryPart,
): BufferGeometry {
  const key = `${guild}:${level}:${part}`;
  let geometry = cache.get(key);
  if (!geometry) {
    if (!geometryData) throw new Error("tree geometry assets must load before creating vegetation");
    const record = geometryData.families[guild][level][part];
    geometry = unpack(record);
    cache.set(key, geometry);
  }
  return geometry;
}
