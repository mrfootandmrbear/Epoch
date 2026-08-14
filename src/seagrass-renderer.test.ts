import { describe, expect, it } from "vitest";
import { Group } from "three/webgpu";
import geometry from "../assets/ecosystem/epoch-seagrass-meadow/runtime/seagrass-geometries.json";
import { createReefWaterUniforms } from "./reef-water";
import { loadSeagrassGeometryAssets } from "./seagrass-geometry-assets";
import { createSeagrassRenderer } from "./seagrass-renderer";

describe("seagrass renderer", () => {
  it("uses the landing's shared underwater medium", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify(geometry));
    await loadSeagrassGeometryAssets();
    globalThis.fetch = originalFetch;
    const water = createReefWaterUniforms(3);
    expect(createSeagrassRenderer(new Group(), water).water).toBe(water);
  });
});
