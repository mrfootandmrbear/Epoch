import { herdLayoutRadius } from "./herd-behavior";

/**
 * Presentation seating for a resolved lineage. Simulation still owns site,
 * island, and abundance; this only decides where visible samples stand, and
 * never writes back into history.
 */

export interface HerdSeat {
  readonly x: number;
  readonly z: number;
  readonly rotationY: number;
  readonly visible: boolean;
}

export interface HerdPlacementQuery {
  islandAt: (x: number, z: number) => string | null;
  walkable: (x: number, z: number) => boolean;
}

/** Same hash landing-state uses, so capture seating stays deterministic. */
export function herdPlacementHash(x: number, z: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * How many instances the landing should draw. Abundance is a 0–1 simulation
 * fraction of the renderer cap, never a licence to fill all 96 slots.
 */
export function visibleHerdCount(abundance: number, capacity: number): number {
  if (capacity <= 0) return 0;
  const scaled = Math.ceil(Math.max(0, abundance) * capacity);
  return Math.max(1, Math.min(capacity, scaled));
}

function acceptable(
  x: number,
  z: number,
  homeIsland: string | null,
  query: HerdPlacementQuery,
): boolean {
  if (!query.walkable(x, z)) return false;
  if (homeIsland === null) return true;
  return query.islandAt(x, z) === homeIsland;
}

/**
 * Pull a coastal miss back toward the known site first, then spiral from the
 * site. Searching from a water candidate equally in every direction can land
 * on the neighbouring island's beach.
 */
function recoverSeat(
  candidateX: number,
  candidateZ: number,
  siteX: number,
  siteZ: number,
  homeIsland: string | null,
  query: HerdPlacementQuery,
): { x: number; z: number } | null {
  if (acceptable(candidateX, candidateZ, homeIsland, query)) {
    return { x: candidateX, z: candidateZ };
  }
  for (let step = 1; step <= 8; step++) {
    const t = 1 - step / 8;
    const x = siteX + (candidateX - siteX) * t;
    const z = siteZ + (candidateZ - siteZ) * t;
    if (acceptable(x, z, homeIsland, query)) return { x, z };
  }
  const origins: ReadonlyArray<readonly [number, number]> = [
    [siteX, siteZ],
    [candidateX, candidateZ],
  ];
  for (const [originX, originZ] of origins) {
    for (let ring = 1; ring <= 14; ring++) {
      const radius = ring * 4;
      const samples = 8 + ring * 2;
      for (let k = 0; k < samples; k++) {
        const angle = (k / samples) * Math.PI * 2;
        const x = originX + Math.cos(angle) * radius;
        const z = originZ + Math.sin(angle) * radius;
        if (acceptable(x, z, homeIsland, query)) return { x, z };
      }
    }
  }
  if (acceptable(siteX, siteZ, homeIsland, query)) return { x: siteX, z: siteZ };
  return null;
}

/**
 * Phyllotaxis seats around the resolver site, spaced for the animals that are
 * actually drawn, then snapped onto the lineage's home island. Animals that
 * cannot stand on that island stay hidden rather than swimming or sharing the
 * neighbouring beach.
 */
export function seatHerdOnIsland(options: {
  siteX: number;
  siteZ: number;
  visibleCount: number;
  capacity: number;
  spacing: number;
  seed: number;
  homeIsland: string | null;
  query: HerdPlacementQuery;
}): readonly HerdSeat[] {
  const {
    siteX, siteZ, visibleCount, capacity, spacing, seed, homeIsland, query,
  } = options;
  const count = Math.max(0, Math.min(capacity, visibleCount));
  const layoutRadius = herdLayoutRadius(count, spacing);
  return Array.from({ length: capacity }, (_, index): HerdSeat => {
    if (index >= count) {
      return { x: siteX, z: siteZ, rotationY: 0, visible: false };
    }
    const radial = Math.sqrt((index + 0.5) / Math.max(1, count)) * layoutRadius;
    const jitter = herdPlacementHash(index, seed + 103) * 0.22;
    const angle = index * 2.399963 + herdPlacementHash(index, seed + 92) * 0.35;
    const candidateX = siteX + Math.cos(angle) * radial * (0.92 + jitter);
    const candidateZ = siteZ + Math.sin(angle) * radial * (0.92 + jitter);
    const seat = recoverSeat(candidateX, candidateZ, siteX, siteZ, homeIsland, query);
    if (!seat) return { x: siteX, z: siteZ, rotationY: angle + Math.PI, visible: false };
    return {
      x: seat.x,
      z: seat.z,
      rotationY: angle + Math.PI,
      visible: true,
    };
  });
}
