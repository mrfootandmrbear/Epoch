import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three/webgpu";
import type { FreshwaterField } from "./freshwater-basins";

export interface FreshwaterRenderer {
  readonly mesh: Mesh;
  setField: (field: FreshwaterField) => void;
}

export function createFreshwaterRenderer(scene: Group): FreshwaterRenderer {
  const geometry = new BufferGeometry();
  const material = new MeshStandardMaterial({
    color: 0x397984,
    roughness: 0.18,
    metalness: 0.08,
    transparent: true,
    opacity: 0.9,
  });
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 3;
  mesh.receiveShadow = true;
  scene.add(mesh);

  return {
    mesh,
    setField(field) {
      const positions: number[] = [];
      const side = field.gridSize;
      const step = field.extent / (side - 1);
      const half = field.extent / 2;
      const vertex = (index: number): [number, number, number] => {
        const x = index % side;
        const z = Math.floor(index / side);
        return [x * step - half, field.surface[index]! + 0.08, z * step - half];
      };
      const triangle = (a: number, b: number, c: number): void => {
        if (!Number.isFinite(field.surface[a]) || !Number.isFinite(field.surface[b]) || !Number.isFinite(field.surface[c])) return;
        if (Math.max(field.surface[a]!, field.surface[b]!, field.surface[c]!)
          - Math.min(field.surface[a]!, field.surface[b]!, field.surface[c]!) > 0.01) return;
        positions.push(...vertex(a), ...vertex(b), ...vertex(c));
      };
      for (let z = 0; z < side - 1; z++) for (let x = 0; x < side - 1; x++) {
        const a = z * side + x;
        const b = a + 1;
        const c = a + side;
        const d = c + 1;
        triangle(a, c, b);
        triangle(b, c, d);
      }
      geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      mesh.visible = positions.length > 0;
    },
  };
}
