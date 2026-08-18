import type { ClimateForces } from "./climate";
import { AUTHORED_SCALE, RENDER_SCALE } from "./render-scale";
import type { PlumeVigor } from "./volcanism";
import type { StartingVent } from "./world-history";

export type StartingWorldPresetId = "weathered-island" | "young-volcano" | "drowned-ridges";

/** The empty world a fresh session loads. Proof capture URLs are pinned separately. */
export const DEFAULT_STARTING_WORLD_ID: StartingWorldPresetId = "young-volcano";

export interface StartingWorldPreset {
  readonly id: StartingWorldPresetId;
  readonly name: string;
  readonly description: string;
  readonly climate: Readonly<ClimateForces>;
  /**
   * The plume setting this world opens on — the one volcanic control the player
   * keeps once the world is running.
   */
  readonly plumeVigor: PlumeVigor;
  /**
   * Where the plume sits and which way it carries its shields, when the preset
   * authors one. Absent means the world opens with no hotspot at all and the
   * player places it; that is the case for both worlds whose islands are older
   * than their volcanism.
   */
  readonly plume?: Readonly<{ x: number; z: number; driftX: number; driftZ: number }>;
  heightAt(x: number, z: number): number;
}

/**
 * Horizontal stretch applied to every authored landform, against the metres
 * these presets were originally written in.
 *
 * The three presets were authored to fill the old 380 m grid, which meant
 * islands ~330 m across carrying 40 m summits — a 13° mean flank, and roughly
 * two and a half times too steep for the Galápagos grammar in `THESIS.md` §6.
 * `RENDER_SCALE.islandExtent` is now 2,000 m, so the *heights* stay exactly
 * where they were and only the ground plan grows: a ~880 m island under the
 * same 40 m relief is a 5–6° flank, which is what an old weathered shield
 * actually looks like.
 *
 * Deliberately not `islandExtent / 380`. Filling the new grid edge to edge
 * would leave no open sea, and the whole point of the wider world is that two
 * shields, their saddle, and the water around them all fit — which is why the
 * factor comes from `RENDER_SCALE.islandLandRadius` rather than the extent.
 */
const HORIZONTAL_STRETCH = AUTHORED_SCALE;

/** Authored constants are written in the original metres; this stretches them. */
function span(meters: number): number {
  return meters * HORIZONTAL_STRETCH;
}

/** Depth of the basin the island group stands in, in metres below sea level. */
const BASIN_DEPTH = -52;

/**
 * The seafloor outside an island's own shelf.
 *
 * Each preset used to end on a single constant — `-3.2`, `-4.5`, `-5.4` — which
 * made every square metre of water outside the island the same few metres deep.
 * On the old 380 m grid that constant was a thin apron and nobody could tell.
 * On 2,000 m it is nine tenths of the world, so the "open sea" the wider extent
 * was chosen for was really a featureless waist-deep plateau stretching to the
 * horizon, and a shield that drowned simply vanished into it instead of
 * subsiding into deep water.
 *
 * A shelf that breaks into a basin also gives the reef somewhere to be: the
 * shallow band is now a ring at a real distance from shore rather than
 * everywhere at once.
 */
function offshoreFloor(x: number, z: number, shelfDepth: number): number {
  const distance = Math.hypot(x, z);
  const shelfEdge = RENDER_SCALE.islandLandRadius * 1.15;
  const basinEdge = RENDER_SCALE.islandLandRadius * 1.95;
  if (distance <= shelfEdge) return shelfDepth;
  const t = Math.min(1, (distance - shelfEdge) / (basinEdge - shelfEdge));
  const eased = t * t * (3 - 2 * t);
  return shelfDepth + (BASIN_DEPTH - shelfDepth) * eased;
}

function noise(x: number, z: number): number {
  return Math.sin((x / HORIZONTAL_STRETCH) * 0.17) * Math.cos((z / HORIZONTAL_STRETCH) * 0.13);
}

function weatheredIsland(x: number, z: number): number {
  const d = Math.hypot(x * 0.92, z * 1.08);
  const island = Math.max(0, 1 - Math.pow(d / span(165), 2.25));
  const ridge = 20 * Math.exp(-Math.pow((x + span(24) + z * 0.16) / span(38), 2));
  const highlands = 13 * Math.sin((x * 0.038 + z * 0.016) / HORIZONTAL_STRETCH)
    + 7 * Math.sin((z * 0.071) / HORIZONTAL_STRETCH);
  const river = 9 * Math.exp(-Math.pow((x - span(18) - span(16) * Math.sin((z * 0.025) / HORIZONTAL_STRETCH)) / span(10), 2));
  return island * (7 + ridge + highlands * island + noise(x, z) * 3.5) - river * island
    + offshoreFloor(x, z, -3.2);
}

function youngVolcano(x: number, z: number): number {
  const distance = Math.hypot(x + span(8), z - span(4));
  const shield = Math.max(0, 1 - Math.pow(distance / span(172), 1.7));
  const cone = 44 * Math.exp(-Math.pow(distance / span(52), 2));
  const crater = 15 * Math.exp(-Math.pow(distance / span(13), 2));
  const flank = 4 * Math.sin(Math.atan2(z - span(4), x + span(8)) * 7)
    * Math.max(0, 1 - distance / span(145));
  return shield * (9 + cone - crater + flank + noise(x, z) * 1.5) + offshoreFloor(x, z, -4.5);
}

function drownedRidges(x: number, z: number): number {
  const distance = Math.hypot(x * 0.84, z * 1.15);
  const shelf = Math.max(0, 1 - Math.pow(distance / span(178), 2));
  const ridgeA = 14 * Math.exp(-Math.pow((x + span(48) + z * 0.2) / span(24), 2));
  const ridgeB = 12 * Math.exp(-Math.pow((x - span(46) + z * 0.16) / span(26), 2));
  const channel = 8 * Math.exp(-Math.pow((x - span(7) * Math.sin((z * 0.035) / HORIZONTAL_STRETCH)) / span(18), 2));
  return shelf * (2.5 + ridgeA + ridgeB - channel + noise(x, z) * 2.2) + offshoreFloor(x, z, -5.4);
}

export const STARTING_WORLD_PRESETS: readonly StartingWorldPreset[] = [
  {
    id: "young-volcano",
    name: "Young volcano",
    description: "A steep basalt shield, active source, and little inherited relief.",
    climate: { rainfall: "wet", temperature: "warm", wind: "easterly", seaLevel: "present" },
    // The cone's own centre, drifting +x — so the chain marches away from the
    // starting island along the axis `archipelago-history.ts` defaults to,
    // which is the bearing every prior spacing and drift-rate figure was
    // measured against.
    plumeVigor: "active",
    plume: { x: -span(8), z: span(4), driftX: 1, driftZ: 0 },
    heightAt: youngVolcano,
  },
  {
    id: "weathered-island",
    name: "Weathered island",
    description: "An old, varied island with a high spine and established drainage.",
    climate: { rainfall: "temperate", temperature: "mild", wind: "westerly", seaLevel: "present" },
    plumeVigor: "active",
    heightAt: weatheredIsland,
  },
  {
    id: "drowned-ridges",
    name: "Drowned ridges",
    description: "Two exposed uplands divided by a flooded central passage.",
    climate: { rainfall: "wet", temperature: "mild", wind: "westerly", seaLevel: "high" },
    plumeVigor: "dormant",
    heightAt: drownedRidges,
  },
] as const;

export function startingWorldPreset(id: string): StartingWorldPreset {
  return STARTING_WORLD_PRESETS.find((preset) => preset.id === id) ?? STARTING_WORLD_PRESETS[0]!;
}

export function startingVentForPreset(preset: StartingWorldPreset): StartingVent | undefined {
  return preset.plume ? { ...preset.plume, vigor: preset.plumeVigor } : undefined;
}
