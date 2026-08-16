import { describe, expect, it } from "vitest";
import type { ShieldHistory } from "./archipelago-history";
import {
  cellIndexAt,
  connectionEpisodes,
  createSeaLevelHistory,
  islandAt,
  islandIndexAt,
  isolatedSinceYear,
  recordSeaLevel,
  resolveIslandGeography,
  saddleBetween,
  seaLevelAt,
  shieldsConnected,
  validateSeaLevelHistory,
} from "./island-geography";

const SIDE = 41;
const EXTENT = 400;
const STEP = EXTENT / (SIDE - 1);
const HALF = EXTENT / 2;

function shield(id: string, crustX: number, crustZ: number): ShieldHistory {
  return { id, birthYear: 0, crustX, crustZ, construction: 1, dormantYears: 0 };
}

function buildGrid(elevationAt: (x: number, z: number) => number, side = SIDE, extent = EXTENT) {
  const step = extent / (side - 1);
  const half = extent / 2;
  const elevations = new Float32Array(side * side);
  for (let cellZ = 0; cellZ < side; cellZ++) {
    for (let cellX = 0; cellX < side; cellX++) {
      elevations[cellZ * side + cellX] = elevationAt(cellX * step - half, cellZ * step - half);
    }
  }
  return { side, extent, elevations };
}

/** Two cones 200 m apart, each 50 m tall at a 0.3 m/m flank, so the col is 20 m. */
function twinCones() {
  const cone = (x: number, z: number, peakX: number): number =>
    50 - 0.3 * Math.hypot(x - peakX, z);
  return buildGrid((x, z) => Math.max(cone(x, z, -100), cone(x, z, 100)));
}

describe("resolveIslandGeography — grouping", () => {
  it("joins two vents into one island while the col stands above the sea", () => {
    const geography = resolveIslandGeography(twinCones(), 0, [
      shield("shield-0", -100, 0),
      shield("shield-1", 100, 0),
    ]);

    expect(geography.islands).toHaveLength(1);
    expect(geography.islands[0]!.shieldIds).toEqual(["shield-0", "shield-1"]);
    expect(geography.islandOfShield.get("shield-0")).toBe("island-0");
    expect(geography.islandOfShield.get("shield-1")).toBe("island-0");
    expect(shieldsConnected(geography, "shield-0", "shield-1")).toBe(true);
  });

  it("splits the same terrain into two islands once the sea covers the col", () => {
    const geography = resolveIslandGeography(twinCones(), 25, [
      shield("shield-0", -100, 0),
      shield("shield-1", 100, 0),
    ]);

    expect(geography.islands).toHaveLength(2);
    expect(geography.islands.map((island) => island.shieldIds)).toEqual([["shield-0"], ["shield-1"]]);
    expect(geography.islandOfShield.get("shield-0")).toBe("island-0");
    expect(geography.islandOfShield.get("shield-1")).toBe("island-1");
    expect(shieldsConnected(geography, "shield-0", "shield-1")).toBe(false);
  });

  it("drowns every island when the sea passes both summits", () => {
    const geography = resolveIslandGeography(twinCones(), 55, [
      shield("shield-0", -100, 0),
      shield("shield-1", 100, 0),
    ]);

    expect(geography.islands).toEqual([]);
    expect(geography.totalLandCells).toBe(0);
    expect(geography.islandOfShield.get("shield-0")).toBeNull();
    expect(geography.islandOfShield.get("shield-1")).toBeNull();
  });

  it("orders islands by descending area, so island-0 is the largest", () => {
    // A wide low massif on the left, a narrow spike on the right.
    const grid = buildGrid((x, z) => {
      if (x < -40) return 20 - 0.05 * Math.hypot(x + 120, z);
      if (Math.hypot(x - 120, z) < 25) return 40;
      return -10;
    });
    const geography = resolveIslandGeography(grid, 0);

    expect(geography.islands.length).toBeGreaterThanOrEqual(2);
    expect(geography.islands[0]!.landCells).toBeGreaterThan(geography.islands[1]!.landCells);
    // The largest island is not the tallest one — area orders the ids, not height.
    expect(geography.islands[0]!.summitElevation).toBeLessThan(geography.islands[1]!.summitElevation);
  });

  it("reports summit, centroid and area for a single symmetric island", () => {
    const grid = buildGrid((x, z) => 50 - 0.3 * Math.hypot(x, z));
    const geography = resolveIslandGeography(grid, 0);

    expect(geography.islands).toHaveLength(1);
    const island = geography.islands[0]!;
    expect(island.summitElevation).toBeCloseTo(50, 5);
    expect(island.summitX).toBeCloseTo(0, 5);
    expect(island.summitZ).toBeCloseTo(0, 5);
    expect(island.centroidX).toBeCloseTo(0, 5);
    expect(island.centroidZ).toBeCloseTo(0, 5);
    expect(island.areaSquareMetres).toBeCloseTo(island.landCells * STEP * STEP, 5);
    expect(geography.totalLandAreaSquareMetres).toBeCloseTo(island.areaSquareMetres, 5);
  });

  it("treats land touching only at a corner as two islands", () => {
    const side = 5;
    const elevations = new Float32Array(side * side).fill(-10);
    elevations[1 * side + 1] = 5;
    elevations[2 * side + 2] = 5;
    const geography = resolveIslandGeography({ side, extent: 40, elevations }, 0);

    expect(geography.islands).toHaveLength(2);
  });

  it("treats orthogonally adjacent land as one island", () => {
    const side = 5;
    const elevations = new Float32Array(side * side).fill(-10);
    elevations[1 * side + 1] = 5;
    elevations[1 * side + 2] = 5;
    const geography = resolveIslandGeography({ side, extent: 40, elevations }, 0);

    expect(geography.islands).toHaveLength(1);
    expect(geography.islands[0]!.landCells).toBe(2);
  });

  it("handles a grid that never crosses sea level", () => {
    const grid = buildGrid(() => 30);
    const geography = resolveIslandGeography(grid, 0);

    expect(geography.islands).toHaveLength(1);
    expect(geography.islands[0]!.landCells).toBe(SIDE * SIDE);
  });

  it("resolves with no shields at all, which is the starting world", () => {
    const geography = resolveIslandGeography(twinCones(), 0);

    expect(geography.islands).toHaveLength(1);
    expect(geography.islands[0]!.shieldIds).toEqual([]);
    expect(geography.saddles).toEqual([]);
    expect(geography.islandOfShield.size).toBe(0);
  });
});

describe("resolveIslandGeography — saddles", () => {
  it("records the col elevation, not the sea level it was resolved at", () => {
    const shields = [shield("shield-0", -100, 0), shield("shield-1", 100, 0)];
    const low = resolveIslandGeography(twinCones(), 0, shields);
    const high = resolveIslandGeography(twinCones(), 25, shields);

    const fromLow = saddleBetween(low, "shield-0", "shield-1");
    const fromHigh = saddleBetween(high, "shield-0", "shield-1");

    expect(fromLow?.elevation).toBeCloseTo(20, 4);
    // The col is a fact about the terrain, so a different stand must not move it.
    expect(fromHigh?.elevation).toBeCloseTo(20, 4);
    expect(fromLow?.x).toBeCloseTo(0, 5);
    expect(fromLow?.z).toBeCloseTo(0, 5);
  });

  it("answers connectivity at any stand from one resolve", () => {
    const geography = resolveIslandGeography(twinCones(), 0, [
      shield("shield-0", -100, 0),
      shield("shield-1", 100, 0),
    ]);

    expect(shieldsConnected(geography, "shield-0", "shield-1", -2)).toBe(true);
    expect(shieldsConnected(geography, "shield-0", "shield-1", 19)).toBe(true);
    expect(shieldsConnected(geography, "shield-0", "shield-1", 21)).toBe(false);
    expect(shieldsConnected(geography, "shield-0", "shield-1", 3)).toBe(true);
  });

  it("finds a saddle for every pair, including submerged shields", () => {
    // Three cones; the third is a seamount whose summit never breaks the surface.
    const cone = (x: number, z: number, peakX: number, height: number): number =>
      height - 0.3 * Math.hypot(x - peakX, z);
    const grid = buildGrid((x, z) =>
      Math.max(cone(x, z, -160, 50), cone(x, z, -40, 50), cone(x, z, 160, -5)),
    );
    const shields = [shield("shield-0", -160, 0), shield("shield-1", -40, 0), shield("shield-2", 160, 0)];
    const geography = resolveIslandGeography(grid, 0, shields);

    for (const [a, b] of [
      ["shield-0", "shield-1"],
      ["shield-0", "shield-2"],
      ["shield-1", "shield-2"],
    ] as const) {
      expect(saddleBetween(geography, a, b), `${a}/${b}`).not.toBeNull();
    }
    // The seamount is on no island, but its col with its neighbour is still known.
    expect(geography.islandOfShield.get("shield-2")).toBeNull();
    expect(saddleBetween(geography, "shield-1", "shield-2")!.elevation).toBeLessThan(0);
    expect(shieldsConnected(geography, "shield-1", "shield-2")).toBe(false);
  });

  it("returns the same saddle regardless of argument order", () => {
    const geography = resolveIslandGeography(twinCones(), 0, [
      shield("shield-0", -100, 0),
      shield("shield-1", 100, 0),
    ]);

    expect(saddleBetween(geography, "shield-1", "shield-0")).toEqual(
      saddleBetween(geography, "shield-0", "shield-1"),
    );
  });

  it("records each pair exactly once", () => {
    const cone = (x: number, z: number, peakX: number): number => 50 - 0.3 * Math.hypot(x - peakX, z);
    const grid = buildGrid((x, z) => Math.max(cone(x, z, -120), cone(x, z, 0), cone(x, z, 120)));
    const geography = resolveIslandGeography(grid, 0, [
      shield("shield-0", -120, 0),
      shield("shield-1", 0, 0),
      shield("shield-2", 120, 0),
    ]);

    expect(geography.saddles).toHaveLength(3);
    const keys = geography.saddles.map((saddle) => `${saddle.shieldA}|${saddle.shieldB}`);
    expect(new Set(keys).size).toBe(3);
  });

  it("reports a shield as disconnected from itself when it is submerged", () => {
    const geography = resolveIslandGeography(twinCones(), 55, [shield("shield-0", -100, 0)]);

    expect(shieldsConnected(geography, "shield-0", "shield-0")).toBe(false);
  });
});

describe("resolveIslandGeography — contract", () => {
  it("is deterministic across repeated resolves", () => {
    const shields = [shield("shield-0", -100, 0), shield("shield-1", 100, 0)];
    const first = resolveIslandGeography(twinCones(), 0, shields);
    const second = resolveIslandGeography(twinCones(), 0, shields);

    expect(JSON.stringify(second.islands)).toBe(JSON.stringify(first.islands));
    expect(JSON.stringify(second.saddles)).toBe(JSON.stringify(first.saddles));
  });

  it("rejects a grid whose cell count disagrees with its side", () => {
    expect(() => resolveIslandGeography({ side: 4, extent: 40, elevations: new Float32Array(9) }, 0)).toThrow(
      /expected 16 cells|16 cells|expected/i,
    );
  });

  it("rejects a degenerate grid and a non-finite sea level", () => {
    expect(() => resolveIslandGeography({ side: 1, extent: 40, elevations: new Float32Array(1) }, 0)).toThrow(
      RangeError,
    );
    expect(() =>
      resolveIslandGeography({ side: 4, extent: 40, elevations: new Float32Array(16) }, Number.NaN),
    ).toThrow(RangeError);
  });

  it("maps world positions to cells and clamps outside the grid", () => {
    expect(cellIndexAt(0, 0, SIDE, EXTENT)).toBe(20 * SIDE + 20);
    expect(cellIndexAt(-HALF, -HALF, SIDE, EXTENT)).toBe(0);
    expect(cellIndexAt(HALF, HALF, SIDE, EXTENT)).toBe(SIDE * SIDE - 1);
    expect(cellIndexAt(-10_000, 10_000, SIDE, EXTENT)).toBe((SIDE - 1) * SIDE);
    expect(cellIndexAt(STEP, 0, SIDE, EXTENT)).toBe(20 * SIDE + 21);
  });
});

describe("resolveIslandGeography — island at a world position", () => {
  it("names the island a summit stands on, and reports water as null", () => {
    const shields = [shield("shield-0", -100, 0), shield("shield-1", 100, 0)];
    // Split stand: the col is drowned, so the two cones are two islands.
    const geography = resolveIslandGeography(twinCones(), 25, shields);

    expect(geography.islands).toHaveLength(2);
    // Each summit sits on its own island; the drowned col between them is water.
    expect(islandAt(geography, -100, 0)).toBe(geography.islandOfShield.get("shield-0"));
    expect(islandAt(geography, 100, 0)).toBe(geography.islandOfShield.get("shield-1"));
    expect(islandAt(geography, 0, 0)).toBeNull();
    // The two summits are on genuinely different components.
    expect(islandAt(geography, -100, 0)).not.toBe(islandAt(geography, 100, 0));
  });

  it("places both summits on one island while the col stands above the sea", () => {
    const geography = resolveIslandGeography(twinCones(), 0, [
      shield("shield-0", -100, 0),
      shield("shield-1", 100, 0),
    ]);

    expect(islandAt(geography, -100, 0)).toBe("island-0");
    expect(islandAt(geography, 100, 0)).toBe("island-0");
    // The col itself is now dry land, so it too resolves to the island.
    expect(islandAt(geography, 0, 0)).toBe("island-0");
  });

  it("returns -1 and null for open water far outside the land", () => {
    const geography = resolveIslandGeography(buildGrid((x, z) => 50 - 0.3 * Math.hypot(x, z)), 0);

    expect(islandIndexAt(geography, 190, 190)).toBe(-1);
    expect(islandAt(geography, 190, 190)).toBeNull();
  });
});

describe("sea level history", () => {
  it("coalesces consecutive jumps held at the same stand", () => {
    let history = createSeaLevelHistory();
    history = recordSeaLevel(history, 0, 1000, 0);
    history = recordSeaLevel(history, 1000, 1000, 0);
    history = recordSeaLevel(history, 2000, 1000, 0);

    expect(history.samples).toEqual([{ startYears: 0, endYears: 3000, seaLevel: 0 }]);
  });

  it("opens a new span when the stand changes", () => {
    let history = createSeaLevelHistory();
    history = recordSeaLevel(history, 0, 1000, 0);
    history = recordSeaLevel(history, 1000, 1000, 3);

    expect(history.samples).toEqual([
      { startYears: 0, endYears: 1000, seaLevel: 0 },
      { startYears: 1000, endYears: 2000, seaLevel: 3 },
    ]);
  });

  it("ignores a zero-length jump and rejects a negative one", () => {
    const history = recordSeaLevel(createSeaLevelHistory(), 0, 0, 0);
    expect(history.samples).toEqual([]);
    expect(() => recordSeaLevel(history, 0, -5, 0)).toThrow(RangeError);
    expect(() => recordSeaLevel(history, 0, 10, Number.NaN)).toThrow(RangeError);
  });

  it("reads the stand in force at a point in time", () => {
    let history = createSeaLevelHistory();
    history = recordSeaLevel(history, 0, 1000, -2);
    history = recordSeaLevel(history, 1000, 1000, 3);

    expect(seaLevelAt(history, 0)).toBe(-2);
    expect(seaLevelAt(history, 999)).toBe(-2);
    expect(seaLevelAt(history, 1000)).toBe(3);
    expect(seaLevelAt(history, 2000)).toBe(3);
    expect(seaLevelAt(history, 2001)).toBeNull();
    expect(seaLevelAt(createSeaLevelHistory(), 0)).toBeNull();
  });
});

describe("connection episodes", () => {
  /** A 20 m col, then a stand that rises over it and falls back. */
  function risingSea() {
    let history = createSeaLevelHistory();
    history = recordSeaLevel(history, 0, 1000, 0);
    history = recordSeaLevel(history, 1000, 1000, 3);
    history = recordSeaLevel(history, 2000, 1000, 25);
    history = recordSeaLevel(history, 3000, 1000, 0);
    return history;
  }

  it("merges adjacent connected spans into one episode", () => {
    // The 0 m and 3 m stands both clear a 20 m col, so they are one episode.
    expect(connectionEpisodes(risingSea(), 20)).toEqual([
      { startYears: 0, endYears: 2000 },
      { startYears: 3000, endYears: 4000 },
    ]);
  });

  it("reports no episodes for a col the sea never uncovered", () => {
    expect(connectionEpisodes(risingSea(), -5)).toEqual([]);
    expect(isolatedSinceYear(risingSea(), -5)).toBeNull();
  });

  it("reports one unbroken episode for a col the sea never reached", () => {
    expect(connectionEpisodes(risingSea(), 100)).toEqual([{ startYears: 0, endYears: 4000 }]);
    expect(isolatedSinceYear(risingSea(), 100)).toBeNull();
  });

  it("dates isolation from the end of the last connected span", () => {
    let history = createSeaLevelHistory();
    history = recordSeaLevel(history, 0, 1000, 0);
    history = recordSeaLevel(history, 1000, 1000, 3);
    history = recordSeaLevel(history, 2000, 1000, 25);

    // Connection survived the 0 m and 3 m stands and broke when the sea passed 20 m.
    expect(isolatedSinceYear(history, 20)).toBe(2000);
  });

  it("treats a still-connected pair as not isolated", () => {
    expect(isolatedSinceYear(risingSea(), 20)).toBeNull();
  });
});

describe("validateSeaLevelHistory", () => {
  it("accepts a record built through recordSeaLevel", () => {
    let history = createSeaLevelHistory();
    history = recordSeaLevel(history, 0, 1000, 0);
    history = recordSeaLevel(history, 1000, 1000, 3);

    expect(() => validateSeaLevelHistory(history)).not.toThrow();
    expect(() => validateSeaLevelHistory(createSeaLevelHistory())).not.toThrow();
  });

  it("rejects a wrong version, a non-array, and a non-object", () => {
    expect(() => validateSeaLevelHistory({ version: 2, samples: [] })).toThrow(RangeError);
    expect(() => validateSeaLevelHistory({ version: 1, samples: {} })).toThrow(TypeError);
    expect(() => validateSeaLevelHistory(null)).toThrow(TypeError);
  });

  it("rejects a gap in the record, which would corrupt every episode query", () => {
    expect(() =>
      validateSeaLevelHistory({
        version: 1,
        samples: [
          { startYears: 0, endYears: 1000, seaLevel: 0 },
          { startYears: 2000, endYears: 3000, seaLevel: 0 },
        ],
      }),
    ).toThrow(/contiguous/);
  });

  it("rejects a span that covers no years", () => {
    expect(() =>
      validateSeaLevelHistory({
        version: 1,
        samples: [{ startYears: 1000, endYears: 1000, seaLevel: 0 }],
      }),
    ).toThrow(/positive span/);
  });
});
