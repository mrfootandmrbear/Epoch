/**
 * Emergent island grouping and saddle connectivity, resolved from the terrain
 * heightfield rather than from the shield record.
 *
 * `archipelago-history.ts` knows where every shield *is*. It deliberately does
 * not know which shields currently share an island, because that is geography:
 * two vents 300 m apart are one island or two depending on whether the ground
 * between them stands above the sea, which is a question about elevation,
 * erosion and sea level — not about vent positions. This module answers it, and
 * answers the follow-up that population isolation actually depends on: *at what
 * sea level does the connection break?*
 *
 * **One pass answers both.** Sort every cell by descending elevation and union
 * each into its already-added neighbours. This builds the classic join tree:
 *
 * - **Islands.** Every cell above sea level is processed before every cell below
 *   it, so the union-find state at the moment the sweep crosses sea level *is*
 *   the set of land components. No second traversal.
 * - **Saddles.** When adding a cell merges two distinct components, that cell's
 *   elevation is exactly the saddle between them — the highest col joining the
 *   two, and therefore the bottleneck of the best path. Two shields are joined
 *   as land whenever sea level sits below their saddle, so one number per pair
 *   describes their connectivity at *every* sea level, past or future.
 *
 * That second property is what makes gene flow tractable: a saddle elevation is
 * a durable fact about the terrain, so pairing it with `SeaLevelHistory` yields
 * the spans during which two populations could interbreed, without re-resolving
 * the terrain for each query.
 *
 * **Four-connectivity for land.** Land cells are joined orthogonally, not
 * diagonally. Eight-connectivity creates the standard grid paradox — two land
 * cells touching at a corner would count as connected while the two water cells
 * on the other diagonal also count as connected, so a lineage could cross a
 * strait that a fish could equally swim through. Four is the conservative
 * reading and the one that matches walkable ground.
 */

import type { ShieldHistory } from "./archipelago-history";

export const SEA_LEVEL_HISTORY_VERSION = 1 as const;

/** A contiguous body of land standing above sea level. */
export interface IslandGroup {
  /** Stable within one resolve; ordered by descending area, so `island-0` is the largest. */
  readonly id: string;
  /** Shields whose vent sits on this island, in the order they appear in the shield record. */
  readonly shieldIds: readonly string[];
  readonly landCells: number;
  readonly areaSquareMetres: number;
  /** Highest elevation on this island, in metres relative to datum (not to sea level). */
  readonly summitElevation: number;
  readonly summitX: number;
  readonly summitZ: number;
  /** Area-weighted centre of the island's land, in crust/terrain world coordinates. */
  readonly centroidX: number;
  readonly centroidZ: number;
}

/**
 * The bottleneck between two shields: the highest col on the best path between
 * them. They share an island exactly while sea level is strictly below it.
 */
export interface ShieldSaddle {
  readonly shieldA: string;
  readonly shieldB: string;
  /**
   * Elevation of the col, in metres relative to datum. Two shields on the same
   * unbroken massif saddle high; two that only meet across a deep basin saddle
   * far below sea level and are never one island at any plausible stand.
   */
  readonly elevation: number;
  /** Where the col sits, so a caller can name or render the land bridge. */
  readonly x: number;
  readonly z: number;
}

export interface IslandGeography {
  /** The stand this grouping was resolved at, in metres. */
  readonly seaLevel: number;
  /** Land components, largest first. Empty when the whole grid is submerged. */
  readonly islands: readonly IslandGroup[];
  /**
   * Saddle for every pair of shields, both orderings keyed for lookup. Pairs are
   * present even when both shields are submerged: the col is a property of the
   * terrain, not of the current stand.
   */
  readonly saddles: readonly ShieldSaddle[];
  /** Island id for a shield's vent cell, or `null` when that vent is underwater. */
  readonly islandOfShield: ReadonlyMap<string, string | null>;
  readonly totalLandCells: number;
  readonly totalLandAreaSquareMetres: number;
}

interface Grid {
  readonly side: number;
  readonly extent: number;
  readonly elevations: Float32Array;
}

function cellCentreMetres(index: number, side: number, extent: number): { x: number; z: number } {
  const step = extent / Math.max(1, side - 1);
  const half = extent / 2;
  return {
    x: (index % side) * step - half,
    z: Math.floor(index / side) * step - half,
  };
}

/** Nearest grid cell to a world position, clamped to the grid. */
export function cellIndexAt(x: number, z: number, side: number, extent: number): number {
  const step = extent / Math.max(1, side - 1);
  const half = extent / 2;
  const clampAxis = (value: number): number =>
    Math.min(side - 1, Math.max(0, Math.round((value + half) / step)));
  return clampAxis(z) * side + clampAxis(x);
}

class DisjointSet {
  private readonly parent: Int32Array;
  private readonly size: Int32Array;

  constructor(count: number) {
    this.parent = new Int32Array(count);
    this.size = new Int32Array(count).fill(1);
    for (let index = 0; index < count; index++) this.parent[index] = index;
  }

  find(index: number): number {
    let root = index;
    while (this.parent[root] !== root) root = this.parent[root]!;
    // Path compression, iteratively — a recursive find would blow the stack on
    // a long monotone ridge, which is exactly what a shield flank is.
    let walk = index;
    while (this.parent[walk] !== root) {
      const next = this.parent[walk]!;
      this.parent[walk] = root;
      walk = next;
    }
    return root;
  }

  /** Unions by size and returns the surviving root, or -1 when already joined. */
  union(a: number, b: number): number {
    let rootA = this.find(a);
    let rootB = this.find(b);
    if (rootA === rootB) return -1;
    if (this.size[rootA]! < this.size[rootB]!) [rootA, rootB] = [rootB, rootA];
    this.parent[rootB] = rootA;
    this.size[rootA]! += this.size[rootB]!;
    return rootA;
  }
}

/**
 * Resolve which shields currently share an island, and at what sea level each
 * pair would separate.
 *
 * `shields` may be empty — the islands are still resolved, which is what the
 * starting world needs before any vent exists.
 */
export function resolveIslandGeography(
  grid: Grid,
  seaLevel: number,
  shields: readonly ShieldHistory[] = [],
): IslandGeography {
  const { side, extent, elevations } = grid;
  if (!Number.isInteger(side) || side < 2) {
    throw new RangeError(`island geography needs a grid side of at least 2, received ${side}`);
  }
  if (elevations.length !== side * side) {
    throw new RangeError(
      `island geography grid is ${elevations.length} cells, expected ${side * side} for side ${side}`,
    );
  }
  if (!Number.isFinite(seaLevel)) {
    throw new RangeError("island geography sea level must be finite");
  }

  const count = elevations.length;
  const cellArea = (extent / (side - 1)) ** 2;

  // Descending elevation, with the index as a tiebreak so equal-height plateaus
  // union in a fixed order and the whole resolve stays deterministic.
  const order = Array.from({ length: count }, (_, index) => index)
    .sort((a, b) => elevations[b]! - elevations[a]! || a - b);

  const set = new DisjointSet(count);
  const added = new Uint8Array(count);

  // Shields that have entered each component, tracked only for roots. Shields
  // are few, so the cross product on merge is cheap and each pair is recorded
  // exactly once — at the moment their components first meet, which is the
  // definition of their saddle.
  const shieldsInComponent = new Map<number, number[]>();
  const shieldCell = new Map<number, number[]>();
  shields.forEach((shield, shieldIndex) => {
    const cell = cellIndexAt(shield.crustX, shield.crustZ, side, extent);
    const existing = shieldCell.get(cell);
    if (existing) existing.push(shieldIndex);
    else shieldCell.set(cell, [shieldIndex]);
  });

  const saddles: ShieldSaddle[] = [];
  let islandRoots: Int32Array | null = null;

  for (const index of order) {
    const elevation = elevations[index]!;

    // The sweep crosses sea level exactly once. Everything already added is
    // land, and the current union-find state is precisely the land components,
    // so snapshot it here rather than repeating the traversal.
    if (islandRoots === null && elevation <= seaLevel) {
      islandRoots = new Int32Array(count).fill(-1);
      for (let cell = 0; cell < count; cell++) {
        if (added[cell]) islandRoots[cell] = set.find(cell);
      }
    }

    added[index] = 1;
    let root = set.find(index);
    let carried = shieldsInComponent.get(root);

    // Vents standing on this cell join whatever component it lands in.
    const arriving = shieldCell.get(index);
    if (arriving) {
      if (!carried) {
        carried = [];
        shieldsInComponent.set(root, carried);
      }
      // Two vents in one cell are already at zero separation; pair them at this
      // cell's own elevation so the record stays complete.
      for (let a = 0; a < arriving.length; a++) {
        for (let b = a + 1; b < arriving.length; b++) {
          saddles.push(makeSaddle(shields, arriving[a]!, arriving[b]!, elevation, index, side, extent));
        }
      }
      carried.push(...arriving);
    }

    const x = index % side;
    const z = Math.floor(index / side);
    const neighbours = [
      x > 0 ? index - 1 : -1,
      x < side - 1 ? index + 1 : -1,
      z > 0 ? index - side : -1,
      z < side - 1 ? index + side : -1,
    ];

    for (const neighbour of neighbours) {
      if (neighbour < 0 || !added[neighbour]) continue;
      const rootA = set.find(index);
      const rootB = set.find(neighbour);
      if (rootA === rootB) continue;

      const shieldsA = shieldsInComponent.get(rootA);
      const shieldsB = shieldsInComponent.get(rootB);
      // This cell is the col joining the two components, so it is the saddle
      // for every shield pair that spans the merge.
      if (shieldsA && shieldsB) {
        for (const a of shieldsA) {
          for (const b of shieldsB) {
            saddles.push(makeSaddle(shields, a, b, elevation, index, side, extent));
          }
        }
      }

      const survivor = set.union(rootA, rootB);
      const merged = [...(shieldsA ?? []), ...(shieldsB ?? [])];
      shieldsInComponent.delete(rootA);
      shieldsInComponent.delete(rootB);
      if (merged.length > 0) shieldsInComponent.set(survivor, merged);
      root = survivor;
      carried = merged;
    }
  }

  // A grid standing entirely above sea level never crosses, so the snapshot has
  // to be taken after the sweep instead.
  if (islandRoots === null) {
    islandRoots = new Int32Array(count).fill(-1);
    for (let cell = 0; cell < count; cell++) islandRoots[cell] = set.find(cell);
  }

  return assembleGeography({
    side,
    extent,
    elevations,
    seaLevel,
    cellArea,
    islandRoots,
    shields,
    shieldCell,
    saddles,
  });
}

function makeSaddle(
  shields: readonly ShieldHistory[],
  a: number,
  b: number,
  elevation: number,
  cell: number,
  side: number,
  extent: number,
): ShieldSaddle {
  const centre = cellCentreMetres(cell, side, extent);
  // Order the pair by shield index so a saddle reads the same regardless of
  // which component happened to be the larger one at merge time.
  const [low, high] = a < b ? [a, b] : [b, a];
  return {
    shieldA: shields[low]!.id,
    shieldB: shields[high]!.id,
    elevation,
    x: centre.x,
    z: centre.z,
  };
}

interface AssembleInput {
  readonly side: number;
  readonly extent: number;
  readonly elevations: Float32Array;
  readonly seaLevel: number;
  readonly cellArea: number;
  readonly islandRoots: Int32Array;
  readonly shields: readonly ShieldHistory[];
  readonly shieldCell: ReadonlyMap<number, number[]>;
  readonly saddles: readonly ShieldSaddle[];
}

function assembleGeography(input: AssembleInput): IslandGeography {
  const { side, extent, elevations, seaLevel, cellArea, islandRoots, shields, shieldCell, saddles } = input;

  interface Accumulator {
    landCells: number;
    summitElevation: number;
    summitIndex: number;
    sumX: number;
    sumZ: number;
    shieldIndices: number[];
  }
  const byRoot = new Map<number, Accumulator>();

  for (let cell = 0; cell < elevations.length; cell++) {
    if (elevations[cell]! <= seaLevel) continue;
    const root = islandRoots[cell]!;
    if (root < 0) continue;
    let entry = byRoot.get(root);
    if (!entry) {
      entry = {
        landCells: 0,
        summitElevation: Number.NEGATIVE_INFINITY,
        summitIndex: cell,
        sumX: 0,
        sumZ: 0,
        shieldIndices: [],
      };
      byRoot.set(root, entry);
    }
    entry.landCells += 1;
    const centre = cellCentreMetres(cell, side, extent);
    entry.sumX += centre.x;
    entry.sumZ += centre.z;
    if (elevations[cell]! > entry.summitElevation) {
      entry.summitElevation = elevations[cell]!;
      entry.summitIndex = cell;
    }
  }

  for (const [cell, shieldIndices] of shieldCell) {
    if (elevations[cell]! <= seaLevel) continue;
    const entry = byRoot.get(islandRoots[cell]!);
    if (entry) entry.shieldIndices.push(...shieldIndices);
  }

  // Largest island first, with the summit position as a deterministic tiebreak
  // so two equal-area islands never swap ids between runs.
  const ordered = [...byRoot.entries()].sort(
    ([, a], [, b]) => b.landCells - a.landCells || a.summitIndex - b.summitIndex,
  );

  const islandOfShield = new Map<string, string | null>();
  for (const shield of shields) islandOfShield.set(shield.id, null);

  const islands: IslandGroup[] = ordered.map(([, entry], position) => {
    const id = `island-${position}`;
    const summit = cellCentreMetres(entry.summitIndex, side, extent);
    entry.shieldIndices.sort((a, b) => a - b);
    for (const shieldIndex of entry.shieldIndices) islandOfShield.set(shields[shieldIndex]!.id, id);
    return {
      id,
      shieldIds: entry.shieldIndices.map((shieldIndex) => shields[shieldIndex]!.id),
      landCells: entry.landCells,
      areaSquareMetres: entry.landCells * cellArea,
      summitElevation: entry.summitElevation,
      summitX: summit.x,
      summitZ: summit.z,
      centroidX: entry.sumX / entry.landCells,
      centroidZ: entry.sumZ / entry.landCells,
    };
  });

  let totalLandCells = 0;
  for (const island of islands) totalLandCells += island.landCells;

  return {
    seaLevel,
    islands,
    saddles,
    islandOfShield,
    totalLandCells,
    totalLandAreaSquareMetres: totalLandCells * cellArea,
  };
}

/** The saddle between two shields, or `null` when either is unknown to this resolve. */
export function saddleBetween(
  geography: IslandGeography,
  shieldA: string,
  shieldB: string,
): ShieldSaddle | null {
  for (const saddle of geography.saddles) {
    if (
      (saddle.shieldA === shieldA && saddle.shieldB === shieldB) ||
      (saddle.shieldA === shieldB && saddle.shieldB === shieldA)
    ) {
      return saddle;
    }
  }
  return null;
}

/**
 * Whether two shields stand on one island at a given stand. Defaults to the
 * stand the geography was resolved at, which is the common case.
 */
export function shieldsConnected(
  geography: IslandGeography,
  shieldA: string,
  shieldB: string,
  seaLevel: number = geography.seaLevel,
): boolean {
  if (shieldA === shieldB) return geography.islandOfShield.get(shieldA) != null;
  const saddle = saddleBetween(geography, shieldA, shieldB);
  return saddle !== null && saddle.elevation > seaLevel;
}

// ---------------------------------------------------------------------------
// Sea-level history
// ---------------------------------------------------------------------------

/**
 * A stand held over a span of world years. Spans are contiguous and
 * non-overlapping: `endYears` of one sample is `startYears` of the next.
 */
export interface SeaLevelSample {
  readonly startYears: number;
  readonly endYears: number;
  readonly seaLevel: number;
}

export interface SeaLevelHistory {
  readonly version: typeof SEA_LEVEL_HISTORY_VERSION;
  readonly samples: readonly SeaLevelSample[];
}

export function createSeaLevelHistory(): SeaLevelHistory {
  return { version: SEA_LEVEL_HISTORY_VERSION, samples: [] };
}

/**
 * Append the stand a jump was resolved at.
 *
 * Consecutive jumps at the same stand coalesce into one span. Without that, a
 * player clicking the 1,000-year rung repeatedly would accumulate thousands of
 * identical samples, and every connectivity query would pay for them.
 */
export function recordSeaLevel(
  history: SeaLevelHistory,
  totalYearsBefore: number,
  jumpYears: number,
  seaLevel: number,
): SeaLevelHistory {
  if (!Number.isFinite(jumpYears) || jumpYears < 0) {
    throw new RangeError("sea level jump years must be a non-negative finite number");
  }
  if (!Number.isFinite(seaLevel)) throw new RangeError("sea level must be finite");
  if (jumpYears === 0) return history;

  const endYears = totalYearsBefore + jumpYears;
  const last = history.samples[history.samples.length - 1];
  if (last && last.seaLevel === seaLevel && last.endYears === totalYearsBefore) {
    return {
      ...history,
      samples: [...history.samples.slice(0, -1), { ...last, endYears }],
    };
  }
  return {
    ...history,
    samples: [...history.samples, { startYears: totalYearsBefore, endYears, seaLevel }],
  };
}

/** The stand in force at a point in world time, or `null` outside the record. */
export function seaLevelAt(history: SeaLevelHistory, years: number): number | null {
  for (const sample of history.samples) {
    if (years >= sample.startYears && years < sample.endYears) return sample.seaLevel;
  }
  const last = history.samples[history.samples.length - 1];
  if (last && years === last.endYears) return last.seaLevel;
  return null;
}

/** A span during which a saddle stood above the sea, so land connected it. */
export interface ConnectionEpisode {
  readonly startYears: number;
  readonly endYears: number;
}

/**
 * The spans during which a given saddle carried a land connection.
 *
 * This is the query population isolation is actually built on: a lineage's gene
 * flow is possible exactly while its two habitats are one island, and the
 * *last* episode's end is the moment isolation began. Adjacent qualifying spans
 * are merged so a stand that repeats across several jumps reads as one episode
 * rather than as one per click.
 */
export function connectionEpisodes(
  history: SeaLevelHistory,
  saddleElevation: number,
): readonly ConnectionEpisode[] {
  const episodes: ConnectionEpisode[] = [];
  for (const sample of history.samples) {
    if (sample.seaLevel >= saddleElevation) continue;
    const last = episodes[episodes.length - 1];
    if (last && last.endYears === sample.startYears) {
      episodes[episodes.length - 1] = { startYears: last.startYears, endYears: sample.endYears };
    } else {
      episodes.push({ startYears: sample.startYears, endYears: sample.endYears });
    }
  }
  return episodes;
}

/**
 * World year at which a saddle last stopped carrying a connection, or `null` if
 * it never connected or is still connected at the end of the record.
 */
export function isolatedSinceYear(
  history: SeaLevelHistory,
  saddleElevation: number,
): number | null {
  const episodes = connectionEpisodes(history, saddleElevation);
  const last = episodes[episodes.length - 1];
  if (!last) return null;
  const recordEnd = history.samples[history.samples.length - 1]?.endYears;
  if (recordEnd !== undefined && last.endYears >= recordEnd) return null;
  return last.endYears;
}

export function validateSeaLevelHistory(value: unknown): asserts value is SeaLevelHistory {
  if (typeof value !== "object" || value === null) throw new TypeError("sea level history must be an object");
  const history = value as Record<string, unknown>;
  if (history.version !== SEA_LEVEL_HISTORY_VERSION) {
    throw new RangeError(
      `sea level history version must be ${SEA_LEVEL_HISTORY_VERSION}, received ${String(history.version)}`,
    );
  }
  if (!Array.isArray(history.samples)) throw new TypeError("sea level history.samples must be an array");
  let previousEnd: number | null = null;
  history.samples.forEach((entry, index) => {
    const context = `sea level history.samples[${index}]`;
    if (typeof entry !== "object" || entry === null) throw new TypeError(`${context} must be an object`);
    const sample = entry as Record<string, unknown>;
    for (const field of ["startYears", "endYears", "seaLevel"] as const) {
      if (!Number.isFinite(sample[field])) throw new RangeError(`${context}.${field} must be finite`);
    }
    const startYears = sample.startYears as number;
    const endYears = sample.endYears as number;
    if (endYears <= startYears) throw new RangeError(`${context} must cover a positive span of years`);
    // Gaps or overlaps would silently corrupt every connectivity query built on
    // this record, and the failure would surface far from the cause.
    if (previousEnd !== null && startYears !== previousEnd) {
      throw new RangeError(`${context} starts at ${startYears}, expected ${previousEnd} to stay contiguous`);
    }
    previousEnd = endYears;
  });
}
