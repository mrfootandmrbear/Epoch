import { describe, expect, it } from "vitest";
import { DEFAULT_CLIMATE } from "./climate";
import { buildWaterVolume, reachableWaterNodes, waterNodeSupportsBody } from "./water-volume";
import { captureWorldSnapshot } from "./world-snapshot";

describe("three-band water volume", () => {
  it("lets surface swimmers pass above a rock that removes lower bands", () => {
    const seabed = (x: number, z: number) => Math.hypot(x, z) < 7 ? -1.2 : -6;
    const volume = buildWaterVolume(captureWorldSnapshot(seabed, 1_000, DEFAULT_CLIMATE, 49, 120), 13);
    const rockColumn = volume.nodes.filter((node) => node.gridX === 6 && node.gridZ === 6);
    expect(rockColumn.map((node) => node.band)).toEqual(["benthic", "surface"]);
    const reachable = reachableWaterNodes(volume, { x: -40, z: 0, band: "surface" }, 0.4, 100);
    expect(reachable.some((node) => node.gridX === 10 && node.gridZ === 6 && node.band === "surface")).toBe(true);
  });

  it("lets small fish use shallow passages that exclude large bodies", () => {
    const shallowChannel = (x: number) => Math.abs(x) < 8 ? -1.4 : -5;
    const volume = buildWaterVolume(captureWorldSnapshot(shallowChannel, 1_000, DEFAULT_CLIMATE, 49, 120), 13);
    const channel = volume.nodes.find((node) => node.gridX === 6 && node.band === "surface")!;
    expect(waterNodeSupportsBody(channel, 0.25)).toBe(true);
    expect(waterNodeSupportsBody(channel, 0.9)).toBe(false);
  });

  it("keeps benthic substrate state separate from swimming nodes", () => {
    const volume = buildWaterVolume(captureWorldSnapshot(() => -4, 1_000, DEFAULT_CLIMATE, 25, 100), 9);
    expect(volume.benthicSites).toHaveLength(81);
    expect(volume.benthicSites[0]).toMatchObject({ depth: 4, light: expect.any(Number) });
    expect(volume.nodes.some((node) => node.band === "midwater")).toBe(true);
  });
});
