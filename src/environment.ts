import { RAINFALL, SEA_LEVEL, WIND, type ClimateForces } from "./climate";
import type { TerrainHistory } from "./terrain-history";

export const FOUNDATIONAL_CLIMATE_IDENTITIES = [
  "cold-arid", "cold-temperate", "cold-wet",
  "mild-arid", "mild-temperate", "mild-wet",
  "warm-arid", "warm-temperate", "warm-wet",
] as const;

export type FoundationalClimateIdentity = typeof FOUNDATIONAL_CLIMATE_IDENTITIES[number];

export type HabitatClass =
  | "exposed-rock"
  | "dry-ground"
  | "mesic-ground"
  | "wet-ground"
  | "frost-ground"
  | "freshwater-margin"
  | "intertidal"
  | "shallow-shelf"
  | "reef-shelf"
  | "deep-benthic";

export interface EnvironmentField {
  readonly side: number;
  readonly extent: number;
  readonly climateIdentity: FoundationalClimateIdentity;
  readonly seaLevel: number;
  readonly slope: Float32Array;
  readonly exposure: Float32Array;
  readonly moisture: Float32Array;
  readonly drainage: Float32Array;
  readonly waterDepth: Float32Array;
  readonly sediment: Float32Array;
  readonly frost: Float32Array;
  readonly habitats: readonly HabitatClass[];
}

export interface LocalEnvironmentSample {
  readonly slope: number;
  readonly exposure: number;
  readonly moisture: number;
  readonly drainage: number;
  readonly waterDepth: number;
  readonly frost: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function foundationalClimateIdentity(
  climate: Pick<ClimateForces, "rainfall" | "temperature">,
): FoundationalClimateIdentity {
  return `${climate.temperature}-${climate.rainfall}` as FoundationalClimateIdentity;
}

export interface HabitatFactors {
  readonly elevation: number;
  readonly seaLevel: number;
  readonly slope: number;
  readonly moisture: number;
  readonly drainage: number;
  readonly runoff: number;
  readonly sediment: number;
  readonly frost: number;
  readonly basalt: number;
  readonly carbonate: number;
}

export function classifyHabitat(factors: HabitatFactors): HabitatClass {
  const depth = factors.seaLevel - factors.elevation;
  if (depth > 24) return "deep-benthic";
  if (depth > 0.8) {
    if (factors.carbonate > 0.22 && factors.basalt < 0.5 && factors.sediment < 0.68) return "reef-shelf";
    return "shallow-shelf";
  }
  if (depth > -1.3) return "intertidal";
  if (factors.frost > 0.48) return "frost-ground";
  if (factors.runoff > 0.48 || factors.drainage > 0.72) return "freshwater-margin";
  if (factors.basalt > 0.5 || factors.slope > 0.82) return "exposed-rock";
  if (factors.moisture < 0.34) return "dry-ground";
  if (factors.moisture > 0.7) return "wet-ground";
  return "mesic-ground";
}

/** Shared climate-on-terrain resolver for ecology and gridded material fields. */
export function resolveLocalEnvironmentSample(
  elevation: number,
  dx: number,
  dz: number,
  concavity: number,
  runoff: number,
  climate: Readonly<ClimateForces>,
): LocalEnvironmentSample {
  const seaLevel = SEA_LEVEL[climate.seaLevel];
  const rain = RAINFALL[climate.rainfall];
  const wind = WIND[climate.wind];
  const slope = Math.hypot(dx, dz);
  const windward = wind.x === 0 ? 0.5 : clamp01(0.5 + dx * wind.x * 0.32);
  const exposure = clamp01((0.18 + elevation / 38 + slope * 0.42) * wind.exposure);
  const moisture = clamp01(
    0.48 + rain.moisture + (12 - elevation) / 30 + concavity * 0.12
    - slope * 0.28 + (windward - 0.5) * 0.18 + clamp01(runoff) * 0.3,
  );
  const drainage = elevation > seaLevel
    ? clamp01(moisture * 0.72 + Math.max(0, concavity) * 0.2 + slope * 0.12 + clamp01(runoff) * 0.28)
    : 0;
  const waterDepth = Math.max(0, seaLevel - elevation);
  const cold = climate.temperature === "cold" ? 1 : climate.temperature === "mild" ? 0.28 : 0;
  const frost = elevation > seaLevel
    ? clamp01(cold * (0.34 + Math.max(0, elevation - 5) / 30) * (1.08 - moisture * 0.18))
    : 0;
  return { slope, exposure, moisture, drainage, waterDepth, frost };
}

/** Resolve climate forces against terrain without storing renderer choices in history. */
export function resolveEnvironmentField(
  terrain: TerrainHistory,
  climate: Readonly<ClimateForces>,
): EnvironmentField {
  const { side, extent } = terrain;
  const count = side * side;
  const slope = new Float32Array(count);
  const exposure = new Float32Array(count);
  const moisture = new Float32Array(count);
  const drainage = new Float32Array(count);
  const waterDepth = new Float32Array(count);
  const sediment = terrain.sediment.slice();
  const frost = new Float32Array(count);
  const habitats: HabitatClass[] = new Array(count);
  const seaLevel = SEA_LEVEL[climate.seaLevel];
  const cell = extent / (side - 1);

  for (let z = 0; z < side; z++) {
    for (let x = 0; x < side; x++) {
      const index = z * side + x;
      const west = terrain.elevations[z * side + Math.max(0, x - 1)]!;
      const east = terrain.elevations[z * side + Math.min(side - 1, x + 1)]!;
      const north = terrain.elevations[Math.max(0, z - 1) * side + x]!;
      const south = terrain.elevations[Math.min(side - 1, z + 1) * side + x]!;
      const dx = (east - west) / Math.max(cell, (x === 0 || x === side - 1) ? cell : cell * 2);
      const dz = (south - north) / Math.max(cell, (z === 0 || z === side - 1) ? cell : cell * 2);
      const elevation = terrain.elevations[index]!;
      const concavity = (west + east + north + south) * 0.25 - elevation;
      const local = resolveLocalEnvironmentSample(
        elevation, dx, dz, concavity, terrain.runoff[index]!, climate,
      );
      slope[index] = local.slope;
      exposure[index] = local.exposure;
      moisture[index] = local.moisture;
      drainage[index] = local.drainage;
      waterDepth[index] = local.waterDepth;
      frost[index] = local.frost;
      habitats[index] = classifyHabitat({
        elevation, seaLevel, slope: local.slope, moisture: local.moisture,
        drainage: local.drainage, runoff: terrain.runoff[index]!, sediment: sediment[index]!,
        frost: local.frost, basalt: terrain.basalt[index]!, carbonate: terrain.carbonate[index]!,
      });
    }
  }

  return {
    side, extent, climateIdentity: foundationalClimateIdentity(climate), seaLevel,
    slope, exposure, moisture, drainage, waterDepth, sediment, frost, habitats,
  };
}

export const ENVIRONMENT_TEXTURE_CHANNELS = 4;

/** RGBA = local moisture, exposure, sediment, frost potential. */
export function packEnvironmentField(
  field: EnvironmentField,
  target: Float32Array<ArrayBufferLike> = new Float32Array(
    field.side * field.side * ENVIRONMENT_TEXTURE_CHANNELS,
  ),
): Float32Array<ArrayBufferLike> {
  if (target.length !== field.side * field.side * ENVIRONMENT_TEXTURE_CHANNELS) {
    throw new Error("Environment texture target has the wrong size");
  }
  for (let index = 0; index < field.side * field.side; index++) {
    const offset = index * ENVIRONMENT_TEXTURE_CHANNELS;
    target[offset] = field.moisture[index]!;
    target[offset + 1] = field.exposure[index]!;
    target[offset + 2] = field.sediment[index]!;
    target[offset + 3] = field.frost[index]!;
  }
  return target;
}
