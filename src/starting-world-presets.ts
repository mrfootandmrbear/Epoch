import type { ClimateForces } from "./climate";
import type { VolcanicOutput } from "./volcanism";

export type StartingWorldPresetId = "weathered-island" | "young-volcano" | "drowned-ridges";

export interface StartingWorldPreset {
  readonly id: StartingWorldPresetId;
  readonly name: string;
  readonly description: string;
  readonly climate: Readonly<ClimateForces>;
  readonly volcanicOutput: VolcanicOutput;
  readonly hotSpot?: Readonly<{ x: number; z: number }>;
  heightAt(x: number, z: number): number;
}

function noise(x: number, z: number): number {
  return Math.sin(x * 0.17) * Math.cos(z * 0.13);
}

function weatheredIsland(x: number, z: number): number {
  const d = Math.hypot(x * 0.92, z * 1.08);
  const island = Math.max(0, 1 - Math.pow(d / 165, 2.25));
  const ridge = 20 * Math.exp(-Math.pow((x + 24 + z * 0.16) / 38, 2));
  const highlands = 13 * Math.sin(x * 0.038 + z * 0.016) + 7 * Math.sin(z * 0.071);
  const river = 9 * Math.exp(-Math.pow((x - 18 - 16 * Math.sin(z * 0.025)) / 10, 2));
  return island * (7 + ridge + highlands * island + noise(x, z) * 3.5) - river * island - 3.2;
}

function youngVolcano(x: number, z: number): number {
  const distance = Math.hypot(x + 8, z - 4);
  const shield = Math.max(0, 1 - Math.pow(distance / 172, 1.7));
  const cone = 44 * Math.exp(-Math.pow(distance / 52, 2));
  const crater = 15 * Math.exp(-Math.pow(distance / 13, 2));
  const flank = 4 * Math.sin(Math.atan2(z - 4, x + 8) * 7) * Math.max(0, 1 - distance / 145);
  return shield * (9 + cone - crater + flank + noise(x, z) * 1.5) - 4.5;
}

function drownedRidges(x: number, z: number): number {
  const distance = Math.hypot(x * 0.84, z * 1.15);
  const shelf = Math.max(0, 1 - Math.pow(distance / 178, 2));
  const ridgeA = 14 * Math.exp(-Math.pow((x + 48 + z * 0.2) / 24, 2));
  const ridgeB = 12 * Math.exp(-Math.pow((x - 46 + z * 0.16) / 26, 2));
  const channel = 8 * Math.exp(-Math.pow((x - 7 * Math.sin(z * 0.035)) / 18, 2));
  return shelf * (2.5 + ridgeA + ridgeB - channel + noise(x, z) * 2.2) - 5.4;
}

export const STARTING_WORLD_PRESETS: readonly StartingWorldPreset[] = [
  {
    id: "weathered-island",
    name: "Weathered island",
    description: "An old, varied island with a high spine and established drainage.",
    climate: { rainfall: "temperate", temperature: "mild", wind: "westerly", seaLevel: "present" },
    volcanicOutput: "active",
    heightAt: weatheredIsland,
  },
  {
    id: "young-volcano",
    name: "Young volcano",
    description: "A steep basalt shield, active source, and little inherited relief.",
    climate: { rainfall: "wet", temperature: "warm", wind: "easterly", seaLevel: "present" },
    volcanicOutput: "vigorous",
    hotSpot: { x: -8, z: 4 },
    heightAt: youngVolcano,
  },
  {
    id: "drowned-ridges",
    name: "Drowned ridges",
    description: "Two exposed uplands divided by a flooded central passage.",
    climate: { rainfall: "wet", temperature: "mild", wind: "westerly", seaLevel: "high" },
    volcanicOutput: "extinct",
    heightAt: drownedRidges,
  },
] as const;

export function startingWorldPreset(id: string): StartingWorldPreset {
  return STARTING_WORLD_PRESETS.find((preset) => preset.id === id) ?? STARTING_WORLD_PRESETS[0]!;
}
