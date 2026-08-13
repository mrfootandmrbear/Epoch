import { describe, expect, it } from "vitest";
import { buildCurrentField, prevailingCurrentSpeed, sampleCurrent } from "./ocean-currents";
import type { WorldSnapshot } from "./world-snapshot";
import type { ClimateForces } from "./climate";

const CLIMATE: ClimateForces = {
  rainfall: "temperate", temperature: "warm", wind: "westerly", seaLevel: "present",
};

const ISLAND_SIDE = 65;
const ISLAND_EXTENT = 320;
const ISLAND_HALF_CELLS = (ISLAND_SIDE - 1) / 2;
/** Grid radius where the cone breaks the surface. */
const ISLAND_SHORE_CELLS = ISLAND_HALF_CELLS * 0.3;
/** Grid radius where the cone meets the flat shelf. Probes sit outside this
 *  so depth is identical between them and velocity differences mean blocking
 *  rather than the shallow-water venturi. */
const ISLAND_BASE_CELLS = ISLAND_HALF_CELLS * 0.5;
const CELLS_TO_WORLD = ISLAND_EXTENT / (ISLAND_SIDE - 1);

/** A conical island rising from a broad flat shelf, with a shallow apron. */
function islandSnapshot(): WorldSnapshot {
  const side = ISLAND_SIDE;
  const elevations = new Float32Array(side * side);
  const half = ISLAND_HALF_CELLS;
  for (let z = 0; z < side; z++) {
    for (let x = 0; x < side; x++) {
      const distance = Math.hypot(x - half, z - half) / half;
      elevations[z * side + x] = -12 + 30 * Math.max(0, 1 - distance * 2);
    }
  }
  return { gridSize: side, extent: ISLAND_EXTENT, elevations, climate: CLIMATE, totalYears: 5000 };
}

function worldAt(snapshot: WorldSnapshot, gridX: number, gridZ: number): { x: number; z: number } {
  const max = snapshot.gridSize - 1;
  return { x: (gridX / max - 0.5) * snapshot.extent, z: (gridZ / max - 0.5) * snapshot.extent };
}

describe("ocean current field", () => {
  it("keeps flow out of land and moving in open water", () => {
    const field = buildCurrentField(islandSnapshot(), CLIMATE);
    for (let i = 0; i < field.water.length; i++) {
      if (field.water[i]) continue;
      expect(field.flowX[i]).toBe(0);
      expect(field.flowZ[i]).toBe(0);
    }
    const openWater = field.speed.filter((_speed, i) => field.water[i] === 1);
    expect(openWater.length).toBeGreaterThan(100);
    expect(Math.max(...openWater)).toBeGreaterThan(0.3);
  });

  it("wraps flow around the island instead of driving into it", () => {
    const snapshot = islandSnapshot();
    const field = buildCurrentField(snapshot, CLIMATE);
    const half = ISLAND_HALF_CELLS;
    const reach = ISLAND_BASE_CELLS + 3;
    const perpX = -field.prevailing.z;
    const perpZ = field.prevailing.x;
    const probe = (alongCells: number, acrossCells: number) => {
      const point = worldAt(
        snapshot,
        half + field.prevailing.x * alongCells + perpX * acrossCells,
        half + field.prevailing.z * alongCells + perpZ * acrossCells,
      );
      const sample = sampleCurrent(field, point.x, point.z);
      return {
        along: sample.x * field.prevailing.x + sample.z * field.prevailing.z,
        across: sample.x * perpX + sample.z * perpZ,
        speed: sample.speed,
      };
    };

    // On the stagnation streamline the island blocks the flow head-on. Both
    // probes sit on the flat shelf at the same depth, so the near one must be
    // slower purely because the island is in its way.
    const stagnation = probe(-reach, 0);
    const openShelf = probe(-half * 0.9, 0);
    expect(stagnation.speed).toBeLessThan(openShelf.speed * 0.8);

    // At the windward shoulder — 45° off the axis — the same water is turning
    // hardest, which is the deflection that carries it around the island.
    const diagonal = reach / Math.SQRT2;
    for (const side of [1, -1]) {
      const shoulder = probe(-diagonal, diagonal * side);
      expect(Math.abs(shoulder.across)).toBeGreaterThan(Math.abs(shoulder.along) * 0.3);
      // ...and it turns away from the island, not into it.
      expect(Math.sign(shoulder.across)).toBe(side);
    }
  });

  it("accelerates over a shallow crest relative to the deep shelf", () => {
    const side = 65;
    const extent = 320;
    const elevations = new Float32Array(side * side).fill(-20);
    // A submerged bank, never breaking the surface, across the middle.
    const half = (side - 1) / 2;
    for (let z = 0; z < side; z++) {
      for (let x = 0; x < side; x++) {
        const distance = Math.hypot(x - half, z - half) / half;
        elevations[z * side + x] = -20 + 18 * Math.max(0, 1 - distance * 3.2);
      }
    }
    const snapshot: WorldSnapshot = { gridSize: side, extent, elevations, climate: CLIMATE, totalYears: 5000 };
    const field = buildCurrentField(snapshot, CLIMATE);
    const crest = worldAt(snapshot, half, half);
    const shelf = worldAt(snapshot, 4, 4);
    expect(sampleCurrent(field, crest.x, crest.z).speed)
      .toBeGreaterThan(sampleCurrent(field, shelf.x, shelf.z).speed);
  });

  it("leaves a sheltered, recirculating wake behind the island", () => {
    const snapshot = islandSnapshot();
    const field = buildCurrentField(snapshot, CLIMATE);
    const half = (snapshot.gridSize - 1) / 2;
    const stepsDownstream = ISLAND_SHORE_CELLS + 4;
    const lee = worldAt(
      snapshot,
      half + field.prevailing.x * stepsDownstream,
      half + field.prevailing.z * stepsDownstream,
    );
    const windward = worldAt(
      snapshot,
      half - field.prevailing.x * stepsDownstream,
      half - field.prevailing.z * stepsDownstream,
    );
    const leeSample = sampleCurrent(field, lee.x, lee.z);
    const windwardSample = sampleCurrent(field, windward.x, windward.z);
    expect(leeSample.speed).toBeLessThan(windwardSample.speed);
    expect(leeSample.shelter).toBeGreaterThan(windwardSample.shelter);

    // Counter-rotating eddies: the two flanks of the wake must spin opposite
    // ways, so the signed vorticity has to change sign across the centreline.
    const perpX = -field.prevailing.z;
    const perpZ = field.prevailing.x;
    const offset = ISLAND_SHORE_CELLS * 0.55 * CELLS_TO_WORLD;
    const flank = (sign: number) => sampleCurrent(
      field,
      lee.x + perpX * sign * offset,
      lee.z + perpZ * sign * offset,
    ).vorticity;
    expect(flank(1) * flank(-1)).toBeLessThan(0);
  });

  it("scales flow with the wind regime and stays deterministic", () => {
    const snapshot = islandSnapshot();
    const calm = buildCurrentField(snapshot, { ...CLIMATE, wind: "calm" });
    const windy = buildCurrentField(snapshot, CLIMATE);
    expect(prevailingCurrentSpeed({ ...CLIMATE, wind: "calm" }))
      .toBeLessThan(prevailingCurrentSpeed(CLIMATE));
    expect(calm.referenceSpeed).toBeLessThan(windy.referenceSpeed);

    const repeat = buildCurrentField(snapshot, CLIMATE);
    expect([...repeat.flowX]).toEqual([...windy.flowX]);
  });

  it("reverses the prevailing axis with an easterly regime", () => {
    const snapshot = islandSnapshot();
    const westerly = buildCurrentField(snapshot, CLIMATE);
    const easterly = buildCurrentField(snapshot, { ...CLIMATE, wind: "easterly" });
    expect(Math.sign(westerly.prevailing.x)).toBe(-Math.sign(easterly.prevailing.x));
  });
});
