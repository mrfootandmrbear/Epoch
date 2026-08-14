import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
} from "three/webgpu";
import { color, float, mix, sin, uniform, uv } from "three/tsl";
import type { TerrainHistory } from "./terrain-history";
import { resolveStreamSegments, type StreamSegment } from "./stream-network";

const MAX_SEGMENTS = 5200;
const SUBDIVISIONS = 4;
const VERTICES_PER_REACH = 6;
const MAX_VERTICES = MAX_SEGMENTS * SUBDIVISIONS * VERTICES_PER_REACH;

export interface StreamRenderer {
  setTerrain(terrain: TerrainHistory, seaLevel: number, retainedWaterSurface?: Float32Array): void;
  update(elapsed: number): void;
}

function sampleHeight(terrain: Pick<TerrainHistory, "side" | "extent" | "elevations">, x: number, z: number): number {
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

/** Write upward-wound, terrain-following ribbon triangles into reusable buffers. */
export function writeStreamRibbonGeometry(
  terrain: Pick<TerrainHistory, "side" | "extent" | "elevations">,
  segments: readonly StreamSegment[],
  positions: Float32Array,
  normals: Float32Array,
  uvs: Float32Array,
): number {
  const cellStep = terrain.extent / (terrain.side - 1);
  const half = terrain.extent / 2;
  let vertex = 0;
  const writeVertex = (x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number) => {
    const p = vertex * 3;
    const t = vertex * 2;
    positions[p] = x; positions[p + 1] = y; positions[p + 2] = z;
    normals[p] = nx; normals[p + 1] = ny; normals[p + 2] = nz;
    uvs[t] = u; uvs[t + 1] = v;
    vertex++;
  };

  for (const segment of segments.slice(0, MAX_SEGMENTS)) {
    const fromX = segment.from % terrain.side * cellStep - half;
    const fromZ = Math.floor(segment.from / terrain.side) * cellStep - half;
    const toX = segment.to % terrain.side * cellStep - half;
    const toZ = Math.floor(segment.to / terrain.side) * cellStep - half;
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const horizontalLength = Math.max(0.001, Math.hypot(dx, dz));
    const px = -dz / horizontalLength;
    const pz = dx / horizontalLength;
    const width = 0.13 + Math.min(0.48, Math.sqrt(segment.discharge) * 0.34);
    const clearance = 0.045 + Math.min(0.09, segment.drop * 0.022);

    for (let subdivision = 0; subdivision < SUBDIVISIONS; subdivision++) {
      const t0 = subdivision / SUBDIVISIONS;
      const t1 = (subdivision + 1) / SUBDIVISIONS;
      const ax = fromX + dx * t0;
      const az = fromZ + dz * t0;
      const bx = fromX + dx * t1;
      const bz = fromZ + dz * t1;
      const a0x = ax - px * width; const a0z = az - pz * width;
      const a1x = ax + px * width; const a1z = az + pz * width;
      const b0x = bx - px * width; const b0z = bz - pz * width;
      const b1x = bx + px * width; const b1z = bz + pz * width;
      const a0 = [a0x, sampleHeight(terrain, a0x, a0z) + clearance, a0z] as const;
      const a1 = [a1x, sampleHeight(terrain, a1x, a1z) + clearance, a1z] as const;
      const b0 = [b0x, sampleHeight(terrain, b0x, b0z) + clearance, b0z] as const;
      const b1 = [b1x, sampleHeight(terrain, b1x, b1z) + clearance, b1z] as const;
      const v1x = a1[0] - a0[0]; const v1y = a1[1] - a0[1]; const v1z = a1[2] - a0[2];
      const v2x = b0[0] - a0[0]; const v2y = b0[1] - a0[1]; const v2z = b0[2] - a0[2];
      let nx = v1y * v2z - v1z * v2y;
      let ny = v1z * v2x - v1x * v2z;
      let nz = v1x * v2y - v1y * v2x;
      const normalLength = Math.max(1e-6, Math.hypot(nx, ny, nz));
      nx /= normalLength; ny /= normalLength; nz /= normalLength;
      const d0 = segment.fromDistance + (segment.toDistance - segment.fromDistance) * t0;
      const d1 = segment.fromDistance + (segment.toDistance - segment.fromDistance) * t1;
      writeVertex(...a0, nx, ny, nz, 0, d0);
      writeVertex(...a1, nx, ny, nz, 1, d0);
      writeVertex(...b0, nx, ny, nz, 0, d1);
      writeVertex(...a1, nx, ny, nz, 1, d0);
      writeVertex(...b1, nx, ny, nz, 1, d1);
      writeVertex(...b0, nx, ny, nz, 0, d1);
    }
  }
  return vertex;
}

export function createStreamRenderer(scene: Group): StreamRenderer {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(MAX_VERTICES * 3);
  const normals = new Float32Array(MAX_VERTICES * 3);
  const uvs = new Float32Array(MAX_VERTICES * 2);
  const positionAttribute = new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage);
  const normalAttribute = new BufferAttribute(normals, 3).setUsage(DynamicDrawUsage);
  const uvAttribute = new BufferAttribute(uvs, 2).setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("normal", normalAttribute);
  geometry.setAttribute("uv", uvAttribute);
  geometry.setDrawRange(0, 0);

  const time = uniform(0);
  const material = new MeshStandardNodeMaterial({
    roughness: 0.14,
    metalness: 0.03,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  // UV.y is continuous metres-to-outlet, so phase survives cell boundaries
  // and cardinal/diagonal reaches share the same physical wavelength.
  const pulse = sin(uv().y.mul(2.15).add(time.mul(3.1))).mul(0.5).add(0.5);
  material.colorNode = mix(color(0x397985), color(0x8fc0c4), pulse.mul(0.12));
  material.roughnessNode = mix(float(0.12), float(0.26), pulse);
  const mesh = new Mesh(geometry, material);
  mesh.name = "drainage-streams";
  mesh.renderOrder = 4;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  scene.add(mesh);

  return {
    setTerrain(terrain, seaLevel, retainedWaterSurface) {
      const segments = resolveStreamSegments(terrain, seaLevel, { retainedWaterSurface });
      // Single-source steep reaches are waterfall candidates, not creek
      // surfaces. Keep them in topology but reserve their rendering for the
      // dedicated waterfall transition layer.
      const creekSegments = segments.filter((segment) => (
        segment.discharge >= 0.12 && segment.drop / segment.length <= 0.22
      ));
      const vertexCount = writeStreamRibbonGeometry(terrain, creekSegments, positions, normals, uvs);
      geometry.setDrawRange(0, vertexCount);
      positionAttribute.needsUpdate = true;
      normalAttribute.needsUpdate = true;
      uvAttribute.needsUpdate = true;
      mesh.visible = vertexCount > 0;
    },
    update(elapsed) { time.value = elapsed; },
  };
}
