import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
} from "three/webgpu";
import { color, float, mix, sin, uniform, uv } from "three/tsl";
import type { TerrainHistory } from "./terrain-history";
import { resolveStreamSegments } from "./stream-network";

export interface StreamRenderer {
  setTerrain(terrain: TerrainHistory, seaLevel: number): void;
  update(elapsed: number): void;
}

export function createStreamRenderer(scene: Group): StreamRenderer {
  const geometry = new BufferGeometry();
  const time = uniform(0);
  const material = new MeshStandardNodeMaterial({
    roughness: 0.16,
    metalness: 0.04,
    transparent: true,
    opacity: 0.88,
  });
  const pulse = sin(uv().y.mul(18).sub(time.mul(3.4))).mul(0.5).add(0.5);
  material.colorNode = mix(color(0x285f6b), color(0x72aab1), pulse.mul(0.28));
  material.roughnessNode = mix(float(0.12), float(0.26), pulse);
  const mesh = new Mesh(geometry, material);
  mesh.name = "drainage-streams";
  mesh.renderOrder = 4;
  mesh.receiveShadow = true;
  scene.add(mesh);

  return {
    setTerrain(terrain, seaLevel) {
      const positions: number[] = [];
      const uvs: number[] = [];
      const segments = resolveStreamSegments(terrain, seaLevel);
      const cellStep = terrain.extent / (terrain.side - 1);
      const half = terrain.extent / 2;
      for (const segment of segments) {
        const ax = segment.from % terrain.side * cellStep - half;
        const az = Math.floor(segment.from / terrain.side) * cellStep - half;
        const bx = segment.to % terrain.side * cellStep - half;
        const bz = Math.floor(segment.to / terrain.side) * cellStep - half;
        const ay = terrain.elevations[segment.from]! + 0.07;
        const by = terrain.elevations[segment.to]! + 0.07;
        const length = Math.max(0.001, Math.hypot(bx - ax, bz - az));
        const px = -(bz - az) / length;
        const pz = (bx - ax) / length;
        const width = 0.34 + Math.min(1.2, segment.flow * 1.7);
        const a0: [number, number, number] = [ax - px * width, ay, az - pz * width];
        const a1: [number, number, number] = [ax + px * width, ay, az + pz * width];
        const b0: [number, number, number] = [bx - px * width, by, bz - pz * width];
        const b1: [number, number, number] = [bx + px * width, by, bz + pz * width];
        positions.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
        uvs.push(0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 1);
      }
      geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      mesh.visible = positions.length > 0;
    },
    update(elapsed) {
      time.value = elapsed;
    },
  };
}
