import { RAINFALL, SEA_LEVEL, WIND, type ClimateForces } from "./climate";

export interface VegetationSite {
  x: number;
  z: number;
  scale: number;
}

/** Mutable world history is kept separate from immutable jump snapshots. */
export interface TerrainHistory {
  readonly side: number;
  readonly extent: number;
  readonly elevations: Float32Array;
  readonly disturbance: Float32Array;
  readonly vegetationProtection: Float32Array;
  readonly forage: Float32Array;
  /** Plant-available nutrient stock retained in each land cell. */
  readonly nutrients: Float32Array;
  /** Normalized freshwater flow accumulated during the previous jump. */
  readonly runoff: Float32Array;
  /** Nutrients delivered to coastal water and retained between jumps. */
  readonly marineNutrients: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Epoch-scale geomorphic response. Short jumps still weather the surface, but
 * landscape-scale incision and coastal retreat only become important after a
 * millennium. Keeping the response bounded preserves the one-pass resolver
 * while ensuring the upper jump ladder produces a materially different land.
 */
export function geomorphicDuration(jumpYears: number): Readonly<{
  weathering: number;
  deepTime: number;
}> {
  const logYears = Math.log10(Math.max(1, jumpYears));
  return {
    weathering: clamp01(logYears / 6),
    deepTime: clamp01((logYears - 3) / 3),
  };
}

export function createTerrainHistory(
  elevations: Float32Array,
  side: number,
  extent: number,
): TerrainHistory {
  return {
    side,
    extent,
    elevations: elevations.slice(),
    disturbance: new Float32Array(elevations.length),
    vegetationProtection: new Float32Array(elevations.length),
    forage: new Float32Array(elevations.length).fill(0.62),
    nutrients: new Float32Array(elevations.length).fill(0.5),
    runoff: new Float32Array(elevations.length),
    marineNutrients: 0.2,
  };
}

/** Apply one bounded, duration-scaled geomorphic pass to the previous landing. */
export function resolveTerrainHistory(
  previous: TerrainHistory,
  jumpYears: number,
  climate: Readonly<ClimateForces>,
): TerrainHistory {
  const { side, extent } = previous;
  const nextElevations = previous.elevations.slice();
  const nextDisturbance = new Float32Array(previous.disturbance.length);
  const nextForage = previous.forage.slice();
  const nextNutrients = previous.nutrients.slice();
  const nextRunoff = new Float32Array(previous.runoff.length);
  const { weathering: duration, deepTime } = geomorphicDuration(jumpYears);
  const erosion = RAINFALL[climate.rainfall].erosion;
  const wind = WIND[climate.wind].exposure;
  const sea = SEA_LEVEL[climate.seaLevel];
  const rainSupply = climate.rainfall === "wet" ? 1 : climate.rainfall === "temperate" ? 0.62 : 0.18;
  let exportedNutrients = 0;
  let coastalCells = 0;

  for (let z = 1; z < side - 1; z++) {
    for (let x = 1; x < side - 1; x++) {
      const index = z * side + x;
      const elevation = previous.elevations[index]!;
      const neighborhood = (
        previous.elevations[index - 1]! + previous.elevations[index + 1]!
        + previous.elevations[index - side]! + previous.elevations[index + side]!
      ) * 0.25;
      const relief = Math.abs(neighborhood - elevation);
      const protection = previous.vegetationProtection[index]!;
      const exposed = 1 - protection * 0.78;
      const transport = duration * erosion * exposed * (0.055 + relief * 0.012)
        + deepTime * erosion * exposed * (0.08 + relief * 0.018);
      const coastal = elevation < sea + 5
        ? duration * erosion * exposed * clamp01((sea + 5 - elevation) / 7) * 0.72
          + deepTime * exposed * clamp01((sea + 7 - elevation) / 9) * (1.8 + wind * 1.1)
        : 0;
      const downhill = Math.max(0, elevation - Math.min(
        previous.elevations[index - 1]!, previous.elevations[index + 1]!,
        previous.elevations[index - side]!, previous.elevations[index + side]!,
      ));
      const drainageIncision = deepTime * rainSupply * exposed
        * clamp01(previous.runoff[index]! * 0.7 + downhill * 0.055)
        * (0.35 + relief * 0.045);
      nextElevations[index] = Math.max(
        -5,
        elevation + (neighborhood - elevation) * Math.min(0.42, transport)
          - coastal - drainageIncision,
      );

      const activity = clamp01((relief * 0.1 + coastal * 0.32) * erosion * exposed + duration * wind * 0.06);
      const recovery = duration * (0.08 + protection * 0.42 + Math.max(0, RAINFALL[climate.rainfall].moisture) * 0.2);
      nextDisturbance[index] = clamp01(previous.disturbance[index]! * (1 - recovery) + activity);
      const moisture = RAINFALL[climate.rainfall].moisture;
      const potential = clamp01(0.48 + moisture * 0.55 + protection * 0.42 - nextDisturbance[index]! * 0.38);
      const regrowth = duration * (0.12 + Math.max(0, moisture) * 0.16);
      nextForage[index] = clamp01(previous.forage[index]! + (potential - previous.forage[index]!) * regrowth);

      // Coarse D8-style drainage: local relief and rainfall accumulate water;
      // vegetation retains soil while exposed erosion exports its nutrients.
      const inheritedFlow = (
        previous.runoff[index - 1]! + previous.runoff[index + 1]!
        + previous.runoff[index - side]! + previous.runoff[index + side]!
      ) * 0.125;
      nextRunoff[index] = clamp01(rainSupply * (0.16 + downhill * 0.08) + inheritedFlow * 0.58);
      const litter = duration * protection * (0.035 + Math.max(0, moisture) * 0.035);
      const nutrientLoss = duration * erosion * nextRunoff[index]! * exposed * (0.025 + relief * 0.004);
      nextNutrients[index] = clamp01(previous.nutrients[index]! + litter - nutrientLoss);
      if (elevation <= sea + 4) {
        exportedNutrients += nutrientLoss * (0.5 + nextRunoff[index]! * 0.5);
        coastalCells++;
      }
    }
  }

  return {
    side,
    extent,
    elevations: nextElevations,
    disturbance: nextDisturbance,
    // Protection describes the vegetation present during this jump. It is
    // replaced after the new landing resolves, rather than inferred mid-jump.
    vegetationProtection: previous.vegetationProtection.slice(),
    forage: nextForage,
    nutrients: nextNutrients,
    runoff: nextRunoff,
    marineNutrients: clamp01(
      previous.marineNutrients * (1 - duration * 0.24)
      + exportedNutrients / Math.max(1, coastalCells) * 7.5,
    ),
  };
}

export interface GrazingPopulation {
  readonly site?: Readonly<{ x: number; z: number }>;
  readonly abundance?: number;
}

/** Record the coarse grazing pressure that the next epoch will inherit. */
export function withGrazingPressure(
  history: TerrainHistory,
  populations: readonly GrazingPopulation[],
  jumpYears: number,
): TerrainHistory {
  const forage = history.forage.slice();
  const step = history.extent / (history.side - 1);
  const half = history.extent / 2;
  const duration = clamp01(Math.log10(Math.max(1, jumpYears) + 1) / 6);
  for (const population of populations) {
    if (!population.site || !population.abundance) continue;
    const centerX = Math.round((population.site.x + half) / step);
    const centerZ = Math.round((population.site.z + half) / step);
    const radius = Math.max(2, Math.ceil((12 + population.abundance * 16) / step));
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = centerX + dx;
        const z = centerZ + dz;
        if (x < 0 || x >= history.side || z < 0 || z >= history.side) continue;
        const falloff = 1 - Math.hypot(dx, dz) / radius;
        if (falloff <= 0) continue;
        const index = z * history.side + x;
        const consumed = duration * population.abundance * falloff * 0.58;
        forage[index] = clamp01(forage[index]! - consumed);
      }
    }
  }
  return { ...history, forage };
}

export function withVegetationProtection(
  history: TerrainHistory,
  vegetation: readonly VegetationSite[],
): TerrainHistory {
  const protection = new Float32Array(history.elevations.length);
  const step = history.extent / (history.side - 1);
  const half = history.extent / 2;
  for (const plant of vegetation) {
    const centerX = Math.round((plant.x + half) / step);
    const centerZ = Math.round((plant.z + half) / step);
    const radius = Math.max(2, Math.ceil((4 + plant.scale * 1.8) / step));
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = centerX + dx;
        const z = centerZ + dz;
        if (x < 0 || x >= history.side || z < 0 || z >= history.side) continue;
        const distance = Math.hypot(dx, dz) / radius;
        if (distance >= 1) continue;
        const index = z * history.side + x;
        protection[index] = Math.max(protection[index]!, (1 - distance) * 0.86);
      }
    }
  }
  return { ...history, vegetationProtection: protection };
}
