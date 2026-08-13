import { describe, expect, it } from "vitest";
import { InstancedMesh, Scene } from "three/webgpu";
import { createTerrainDetailRenderer } from "./terrain-detail-renderer";
import { createTerrainHistory } from "./terrain-history";

const SIDE = 9;

function rubble(scene: Scene): InstancedMesh {
  const mesh = scene.getObjectByName("reef-rubble");
  if (!(mesh instanceof InstancedMesh)) throw new Error("reef rubble mesh missing");
  return mesh;
}

describe("terrain detail renderer", () => {
  it("adds dense submerged rubble only where reef carbonate exists", () => {
    const side = SIDE;
    const elevations = new Float32Array(side * side).fill(-5);
    const bare = createTerrainHistory(elevations, side, 32);
    const scene = new Scene();
    const renderer = createTerrainDetailRenderer(scene);

    renderer.update(bare, () => -5, 0);
    expect(rubble(scene).count).toBe(0);

    const reef = { ...bare, carbonate: new Float32Array(side * side).fill(0.2) };
    renderer.update(reef, () => -5, 0);
    expect(rubble(scene).count).toBeGreaterThan(20);
  });
});
