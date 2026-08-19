import { describe, expect, it, vi } from "vitest";

vi.mock("../assets/ecosystem/epoch-intertidal-crab/exports/sally-lightfoot.glb", () => ({
  default: "",
}));
vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    load(): void { /* tests do not fetch the compiled GLB */ }
  },
}));
vi.mock("three/addons/utils/SkeletonUtils.js", () => ({
  clone: (root: unknown) => root,
}));

import { Group } from "three/webgpu";
import { crabInstanceScale, createCrabRenderer } from "./crab-renderer";

describe("intertidal crab renderer", () => {
  it("keeps centimetre-scale instances around the authored carapace", () => {
    expect(crabInstanceScale(0.5) * 0.06).toBeGreaterThan(0.03);
    expect(crabInstanceScale(0.5) * 0.06).toBeLessThan(0.09);
    expect(crabInstanceScale(1) * 0.06).toBeLessThan(0.09);
  });

  it("accepts seats without blocking simulation on an unloaded GLB", () => {
    const renderer = createCrabRenderer(new Group());
    renderer.setSeats([
      { x: 12, y: 0.18, z: -4, heading: 0.4, bodySize: 0.5, redness: 0.9, wetness: 0.7, agility: 0.4, energy: 0.3 },
    ]);
    renderer.update(0.16);
    renderer.setSeats([]);
    expect(renderer.mesh.visible).toBe(false);
  });
});
