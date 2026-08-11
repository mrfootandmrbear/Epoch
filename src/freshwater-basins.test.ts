import { describe, expect, it } from "vitest";
import { resolveFreshwaterBasins, resolveFreshwaterField } from "./freshwater-basins";
import { createFreshwaterRenderer } from "./freshwater-renderer";
import { Group } from "three/webgpu";
import type { WorldSnapshot } from "./world-snapshot";

function snapshot(openChannel = false): WorldSnapshot {
  const side = 7;
  const elevations = new Float32Array(side * side).fill(8);
  for (let z = 2; z <= 4; z++) for (let x = 2; x <= 4; x++) elevations[z * side + x] = 3;
  elevations[3 * side + 3] = 1;
  if (openChannel) for (let x = 0; x <= 2; x++) elevations[3 * side + x] = 1;
  return {
    gridSize: side,
    extent: 60,
    elevations,
    climate: { rainfall: "temperate", temperature: "mild", wind: "westerly", seaLevel: "present" },
    totalYears: 100,
  };
}

describe("freshwater basin resolution", () => {
  it("pools rain in an enclosed low area", () => {
    const field = resolveFreshwaterField(snapshot(), -2, "temperate");
    const pools = field.basins;
    expect(pools).toHaveLength(1);
    expect(pools[0]!.y).toBeGreaterThan(1);
    expect(Math.abs(pools[0]!.x)).toBeLessThan(5);
    expect(Math.abs(pools[0]!.z)).toBeLessThan(5);
    expect([...field.depth].filter((value) => value > 0).length).toBeGreaterThan(3);
    expect([...field.surface].filter(Number.isFinite).length).toBeGreaterThan(3);
  });

  it("builds a terrain-aligned surface and clears it after drainage", () => {
    const renderer = createFreshwaterRenderer(new Group());
    renderer.setField(resolveFreshwaterField(snapshot(), -2, "temperate"));
    expect(renderer.mesh.geometry.attributes.position!.count).toBeGreaterThan(0);
    expect(renderer.mesh.visible).toBe(true);

    renderer.setField(resolveFreshwaterField(snapshot(true), -2, "temperate"));
    expect(renderer.mesh.geometry.attributes.position!.count).toBe(0);
    expect(renderer.mesh.visible).toBe(false);
  });

  it("drains a basin after a channel reaches the boundary", () => {
    expect(resolveFreshwaterBasins(snapshot(true), -2, "temperate")).toHaveLength(0);
  });

  it("fills wet climates higher than temperate climates", () => {
    const wet = resolveFreshwaterBasins(snapshot(), -2, "wet")[0]!;
    const temperate = resolveFreshwaterBasins(snapshot(), -2, "temperate")[0]!;
    expect(wet.y).toBeGreaterThan(temperate.y);
  });
});
