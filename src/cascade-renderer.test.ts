import { describe, expect, it } from "vitest";
import {
  CASCADE_BED,
  CASCADE_WATER,
  resolvePlungeSites,
  writeCascadeGeometry,
  writePlungeGeometry,
} from "./cascade-renderer";
import { classifyReach, resolveStreamSegments, type StreamSegment } from "./stream-network";
import { createTerrainHistory, resolveTerrainHistory } from "./terrain-history";
import type { ClimateForces } from "./climate";

// Seed landform used only to exercise the cascade layer. This is the authored
// benched-shield profile the renderer was tuned against — a smooth shield alone
// tops out near 54° and never produces the sheer reaches these tests assert, so
// the bench staircase is reproduced here rather than depending on the runtime
// terrain module.
function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
const BENCH_HEIGHT = 7.5;
const RISER_SHARE = 0.22;
function benchWarp(x: number, z: number): number {
  return 1.5 * Math.sin(x * 0.031 + z * 0.019)
    + 0.95 * Math.sin(z * 0.047 - x * 0.011)
    + 0.55 * Math.sin(x * 0.084 + z * 0.063);
}
function benchSpacing(x: number, z: number): number {
  return BENCH_HEIGHT * (1 + 0.3 * Math.sin(x * 0.017 - z * 0.023) + 0.12 * Math.sin(z * 0.038));
}
function shieldHeight(x: number, z: number): number {
  const d = Math.hypot(x * 0.92, z * 1.08);
  const island = Math.max(0, 1 - Math.pow(d / 165, 2.25));
  const ridge = 20 * Math.exp(-Math.pow((x + 24 + z * 0.16) / 38, 2));
  const highlands = 13 * Math.sin(x * 0.038 + z * 0.016) + 7 * Math.sin(z * 0.071);
  const weathering = 3.5 * Math.sin(x * 0.17) * Math.cos(z * 0.13);
  const river = 9 * Math.exp(-Math.pow((x - 18 - 16 * Math.sin(z * 0.025)) / 10, 2));
  return island * (7 + ridge + highlands * island + weathering) - river * island - 3.2;
}
function benched(raw: number, x: number, z: number): number {
  const spacing = benchSpacing(x, z);
  const warped = raw + benchWarp(x, z);
  const level = Math.floor(warped / spacing);
  const within = warped / spacing - level;
  const riser = smoothstep(1 - RISER_SHARE, 1 - RISER_SHARE * 0.12, within);
  return (level + riser) * spacing - benchWarp(x, z);
}
function terrainHeight(x: number, z: number): number {
  const raw = shieldHeight(x, z);
  const structure = smoothstep(1.5, 11, raw) * (1 - smoothstep(34, 46, raw));
  const strength = 0.62 + 0.28 * Math.sin(x * 0.023 + z * 0.031);
  return raw + (benched(raw, x, z) - raw) * structure * strength;
}

const CLIMATE: ClimateForces = {
  rainfall: "temperate", wind: "westerly", seaLevel: "present", temperature: "mild",
};

const SIZE = 380;
const SEGMENTS = 180;
const SIDE = SEGMENTS + 1;
const STEP = SIZE / SEGMENTS;
const HALF = SIZE / 2;

function island(years: number) {
  const elevations = new Float32Array(SIDE * SIDE);
  for (let z = 0; z < SIDE; z++) {
    for (let x = 0; x < SIDE; x++) {
      elevations[z * SIDE + x] = terrainHeight(x * STEP - HALF, z * STEP - HALF);
    }
  }
  return resolveTerrainHistory(createTerrainHistory(elevations, SIDE, SIZE), years, CLIMATE);
}

function slope(side: number, drop: number) {
  const elevations = new Float32Array(side * side);
  for (let z = 0; z < side; z++) for (let x = 0; x < side; x++) elevations[z * side + x] = 20 - z * drop;
  return { side, extent: side - 1, elevations };
}

const buffers = (vertices: number) => ({
  positions: new Float32Array(vertices * 3),
  normals: new Float32Array(vertices * 3),
  uvs: new Float32Array(vertices * 2),
  aerations: new Float32Array(vertices),
});

describe("cascade coverage", () => {
  it("leaves no flowing reach undrawn, whatever the terrain's grade mix", () => {
    // The defect this layer exists to close: the creek renderer drew only
    // creek-grade reaches and nothing drew the rest, so 82-100% of the resolved
    // network was invisible. The guard is that the two filters partition the
    // network — asserting a particular creek-to-cascade ratio instead would only
    // pin the terrain generator's statistics, which are free to change.
    for (const years of [1, 1_000, 100_000, 1_000_000]) {
      const terrain = island(years);
      const segments = resolveStreamSegments(terrain, 0);
      const drawnByCreeks = segments.filter((s) => classifyReach(s) === "creek");
      const drawnByCascades = segments.filter((s) => {
        const kind = classifyReach(s);
        return kind === "rapid" || kind === "fall";
      });
      const undrawn = segments.filter((s) => classifyReach(s) === "dry");

      expect(drawnByCreeks.length + drawnByCascades.length + undrawn.length).toBe(segments.length);
      expect(undrawn).toHaveLength(0);
      // Both layers must actually carry work, or one of them is dead code.
      expect(drawnByCreeks.length).toBeGreaterThan(0);
      expect(drawnByCascades.length).toBeGreaterThan(0);

      const store = buffers(drawnByCascades.length * 8 * 4 * 6);
      const written = writeCascadeGeometry(
        terrain, drawnByCascades, store.positions, store.normals, store.uvs, store.aerations,
      );
      expect(written).toBe(drawnByCascades.length * 8 * 4 * 6);
    }
  });

  it("keeps the bed wider than the water it carries", () => {
    const terrain = slope(6, 3);
    const segment: StreamSegment = {
      from: 0, to: 6, discharge: 0.9, drop: 3, length: 1, fromDistance: 5, toDistance: 4,
    };
    const spread = (profile: typeof CASCADE_WATER) => {
      const store = buffers(8 * 4 * 6);
      const count = writeCascadeGeometry(
        terrain, [segment], store.positions, store.normals, store.uvs, store.aerations, profile,
      );
      let min = Infinity;
      let max = -Infinity;
      for (let vertex = 0; vertex < count; vertex++) {
        const x = store.positions[vertex * 3]!;
        min = Math.min(min, x);
        max = Math.max(max, x);
      }
      return max - min;
    };
    expect(spread(CASCADE_BED)).toBeGreaterThan(spread(CASCADE_WATER) * 1.5);
  });

  it("carries a per-reach aeration that rises with grade", () => {
    const terrain = slope(6, 3);
    const gentle: StreamSegment = {
      from: 0, to: 6, discharge: 0.9, drop: 0.4, length: 1, fromDistance: 5, toDistance: 4,
    };
    const sheer: StreamSegment = { ...gentle, drop: 3 };
    const read = (segment: StreamSegment) => {
      const store = buffers(8 * 4 * 6);
      writeCascadeGeometry(
        terrain, [segment], store.positions, store.normals, store.uvs, store.aerations,
      );
      return store.aerations[0]!;
    };
    expect(read(gentle)).toBeGreaterThan(0);
    expect(read(sheer)).toBeGreaterThan(read(gentle));
    expect(read(sheer)).toBeLessThanOrEqual(1);
  });

  it("places one plunge only where falling water lands on gentler ground", () => {
    const terrain = slope(8, 3);
    const stacked: StreamSegment[] = [
      { from: 0, to: 8, discharge: 0.9, drop: 3, length: 1, fromDistance: 4, toDistance: 3 },
      { from: 8, to: 16, discharge: 0.9, drop: 3, length: 1, fromDistance: 3, toDistance: 2 },
      { from: 16, to: 24, discharge: 0.9, drop: 0.1, length: 1, fromDistance: 2, toDistance: 1 },
    ];
    const sites = resolvePlungeSites(terrain, stacked, -100);
    expect(sites).toHaveLength(1);
    expect(sites[0]!.cell).toBe(16);
    // The stacked face above the landing counts as one fall, not two splashes.
    expect(sites[0]!.drop).toBeCloseTo(6);
  });

  it("never drapes a plunge pool below sea level", () => {
    const terrain = slope(8, 3);
    const segments: StreamSegment[] = [
      { from: 8, to: 16, discharge: 0.9, drop: 3, length: 1, fromDistance: 3, toDistance: 2 },
    ];
    expect(resolvePlungeSites(terrain, segments, 100)).toHaveLength(0);
  });

  it("drapes plunge patches onto the bed instead of lidding them flat", () => {
    const terrain = slope(8, 3);
    const sites = [{ cell: 16, drop: 6, discharge: 0.9 }];
    const store = buffers(5 * 5 * 6);
    const count = writePlungeGeometry(terrain, sites, store.positions, store.normals, store.uvs);
    expect(count).toBe(5 * 5 * 6);
    const heights = new Set<number>();
    for (let vertex = 0; vertex < count; vertex++) heights.add(store.positions[vertex * 3 + 1]!);
    expect(heights.size).toBeGreaterThan(1);
  });

  it("steepens the network across deep time", () => {
    const falls = (years: number) => {
      const terrain = island(years);
      return resolveStreamSegments(terrain, 0).filter((s) => classifyReach(s) === "fall").length;
    };
    // Drainage incision is deep-time weighted, so an aged island should carry
    // strictly more sheer reaches than a young one. This is the visual payload
    // of the jump ladder, not an incidental statistic.
    expect(falls(1_000_000)).toBeGreaterThan(falls(1));
  });
});
