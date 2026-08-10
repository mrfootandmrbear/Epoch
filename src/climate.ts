export type RainfallRegime = "arid" | "temperate" | "wet";
export type TemperatureRegime = "cold" | "mild" | "warm";
export type WindRegime = "calm" | "westerly" | "easterly";
export type SeaLevelRegime = "low" | "present" | "high";

/** Global forces captured with each jump. These describe a climate, not a place to affect. */
export interface ClimateForces {
  rainfall: RainfallRegime;
  temperature: TemperatureRegime;
  wind: WindRegime;
  seaLevel: SeaLevelRegime;
}

export const DEFAULT_CLIMATE: ClimateForces = {
  rainfall: "temperate",
  temperature: "mild",
  wind: "westerly",
  seaLevel: "present",
};

export const RAINFALL: Record<RainfallRegime, { moisture: number; erosion: number }> = {
  arid: { moisture: -0.28, erosion: 0.45 },
  temperate: { moisture: 0, erosion: 1 },
  wet: { moisture: 0.24, erosion: 1.65 },
};

export const TEMPERATURE: Record<TemperatureRegime, { growth: number; insulation: number }> = {
  cold: { growth: 0.5, insulation: 1 },
  mild: { growth: 1, insulation: 0.45 },
  warm: { growth: 1.16, insulation: 0 },
};

export const WIND: Record<WindRegime, { x: number; exposure: number; speed: number }> = {
  calm: { x: 0, exposure: 0.55, speed: 4 },
  westerly: { x: 1, exposure: 1, speed: 18 },
  easterly: { x: -1, exposure: 1, speed: 18 },
};

export const SEA_LEVEL: Record<SeaLevelRegime, number> = {
  low: -2,
  present: 0,
  high: 3,
};

export function climateLabel(forces: ClimateForces): string {
  return `${forces.temperature} · ${forces.rainfall} · ${forces.wind} · ${forces.seaLevel} sea`;
}
