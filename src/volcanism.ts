import type { TerrainHistory } from "./terrain-history";

/**
 * Shield geometry, in metres.
 *
 * A Galápagos shield has a ~10° mean flank: broad, low, caldera-topped. The
 * previous 68 m radius against a 52 m cap built a 43° cone that broke the
 * surface as a 97 m wide spike — a cinder cone, not a shield. These radii are
 * the reason `RENDER_SCALE.islandExtent` moved to 2,000 m: a 48 m summit at
 * 10° needs a 272 m base, which the old 380 m grid could not contain.
 *
 * Caps are unchanged; only the radii grew. `target` falls off as radial², so
 * the mean flank is `atan(cap / radius)` and the profile is gentle at the
 * skirt, steepest at mid-flank, and rounded at the summit.
 */
export const SHIELD_GEOMETRY = {
  vigorous: { radius: 272, cap: 52 },
  active: { radius: 244, cap: 43 },
  waning: { radius: 76, cap: 15 },
} as const;

/**
 * Flank roughness wavelength, in metres.
 *
 * Per-cell white noise put ±9% of the cap between neighbouring cells, which at
 * the old 2.11 m grid meant single steps of up to 75° on a shield whose whole
 * point is a 10° silhouette. Sampling the same hash on a fixed metric lattice
 * and interpolating keeps the texture while making it a property of the
 * volcano rather than of the grid resolution.
 */
const ROUGHNESS_WAVELENGTH = 34;

export const VOLCANIC_OUTPUTS = ["vigorous", "active", "waning", "extinct"] as const;
export type VolcanicOutput = typeof VOLCANIC_OUTPUTS[number];

export interface HotSpot {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly output: VolcanicOutput;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hash(x: number, z: number, salt: number): number {
  const value = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Smooth value noise on a fixed metric lattice, so flank texture has a real
 * wavelength in metres instead of inheriting whatever the cell size is.
 */
function flankRoughness(worldX: number, worldZ: number, salt: number): number {
  const gx = worldX / ROUGHNESS_WAVELENGTH;
  const gz = worldZ / ROUGHNESS_WAVELENGTH;
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const tx = gx - x0;
  const tz = gz - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = hash(x0, z0, salt);
  const b = hash(x0 + 1, z0, salt);
  const c = hash(x0, z0 + 1, salt);
  const d = hash(x0 + 1, z0 + 1, salt);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sz;
}

const FLOW_DIRECTIONS = [
  [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
] as const;

function routeLavaFlows(
  terrain: TerrainHistory,
  elevations: Float32Array,
  basalt: Float32Array,
  volcanicLoad: Float32Array,
  disturbance: Float32Array,
  nutrients: Float32Array,
  forage: Float32Array,
  vegetationProtection: Float32Array,
  substrateAge: Float32Array,
  surfaceAgeYears: Float32Array,
  soilDevelopment: Float32Array,
  sediment: Float32Array,
  carbonate: Float32Array,
  vent: HotSpot,
  radius: number,
  strength: number,
  duration: number,
  salt: number,
): void {
  if (vent.output === "waning" || strength * duration < 0.08) return;
  const step = terrain.extent / (terrain.side - 1);
  const half = terrain.extent / 2;
  const ventX = Math.max(1, Math.min(terrain.side - 2, Math.round((vent.x + half) / step)));
  const ventZ = Math.max(1, Math.min(terrain.side - 2, Math.round((vent.z + half) / step)));
  const flowCount = vent.output === "vigorous" ? 7 : 4;
  for (let flow = 0; flow < flowCount; flow++) {
    const direction = FLOW_DIRECTIONS[Math.floor(hash(flow, salt, 19) * FLOW_DIRECTIONS.length)]!;
    const sourceX = Math.max(1, Math.min(terrain.side - 2, ventX + direction[0] * 2));
    const sourceZ = Math.max(1, Math.min(terrain.side - 2, ventZ + direction[1] * 2));
    let current = sourceZ * terrain.side + sourceX;
    const visited = new Set<number>();
    // A flow's reach belongs to the volcano, not to the grid: budget is spent
    // one cell per step, so it has to be derived from how far down the shield
    // the lava should actually run. A vigorous flow crosses its own flank.
    const reachMetres = radius * (vent.output === "vigorous" ? 1.05 : 0.72);
    let budget = (reachMetres / step) * duration;
    while (budget > 0.2 && !visited.has(current)) {
      visited.add(current);
      const x = current % terrain.side;
      const z = Math.floor(current / terrain.side);
      const deposit = Math.min(0.32, budget * 0.035) * strength;
      const previousElevation = elevations[current]!;
      elevations[current] = Math.max(previousElevation, Math.min(55, previousElevation + deposit * 0.24));
      volcanicLoad[current] = clamp01(volcanicLoad[current]! + Math.max(0, elevations[current]! - previousElevation) / 45);
      basalt[current] = Math.max(basalt[current]!, clamp01(0.58 + deposit));
      disturbance[current] = Math.max(disturbance[current]!, 0.78);
      nutrients[current] *= 0.18;
      forage[current] *= 0.12;
      vegetationProtection[current] *= 0.08;
      substrateAge[current] *= 0.08;
      surfaceAgeYears[current] = 0;
      soilDevelopment[current] *= 0.06;
      sediment[current] *= 0.18;
      carbonate[current] = 0;
      budget -= 1;
      let next = -1;
      let best = Number.POSITIVE_INFINITY;
      for (const [dx, dz] of FLOW_DIRECTIONS) {
        const nx = x + dx; const nz = z + dz;
        if (nx <= 0 || nx >= terrain.side - 1 || nz <= 0 || nz >= terrain.side - 1) continue;
        const candidate = nz * terrain.side + nx;
        const score = elevations[candidate]! + hash(candidate, flow, salt) * 0.12;
        if (score < best && !visited.has(candidate)) { best = score; next = candidate; }
      }
      if (next < 0 || elevations[next]! > elevations[current]! + 0.35) break;
      current = next;
    }
  }
}

/** Accrete a bounded broad shield before the existing weathering pass. */
export function resolveVolcanicAccretion(
  previous: TerrainHistory,
  hotSpots: readonly HotSpot[],
  jumpYears: number,
): TerrainHistory {
  if (hotSpots.length === 0 || jumpYears <= 0) return previous;
  const elevations = previous.elevations.slice();
  const basalt = previous.basalt.slice();
  const ash = previous.ash.slice();
  const volcanicLoad = previous.volcanicLoad.slice();
  const disturbance = previous.disturbance.slice();
  const vegetationProtection = previous.vegetationProtection.slice();
  const substrateAge = previous.substrateAge.slice();
  const surfaceAgeYears = previous.surfaceAgeYears.slice();
  const soilDevelopment = previous.soilDevelopment.slice();
  const sediment = previous.sediment.slice();
  const carbonate = previous.carbonate.slice();
  const forage = previous.forage.slice();
  const nutrients = previous.nutrients.slice();
  const step = previous.extent / (previous.side - 1);
  const half = previous.extent / 2;
  const duration = clamp01(Math.log10(jumpYears + 1) / 3);

  for (const vent of hotSpots) {
    if (vent.output === "extinct") continue;
    const strength = vent.output === "vigorous" ? 1 : vent.output === "active" ? 0.72 : 0.2;
    const { radius, cap } = SHIELD_GEOMETRY[vent.output];
    const salt = [...vent.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    for (let z = 1; z < previous.side - 1; z++) {
      const worldZ = z * step - half;
      for (let x = 1; x < previous.side - 1; x++) {
        const worldX = x * step - half;
        const distance = Math.hypot(worldX - vent.x, worldZ - vent.z);
        if (distance >= radius) continue;
        const index = z * previous.side + x;
        const radial = 1 - distance / radius;
        const roughness = 0.91 + flankRoughness(worldX, worldZ, salt) * 0.18;
        const target = -4 + cap * radial * radial * roughness;
        const growth = Math.max(0, target - elevations[index]!) * duration * strength;
        const resurfacing = radial * radial * duration * strength * 0.68;
        if (growth <= 0.002 && resurfacing <= 0.002) continue;
        elevations[index] = Math.max(elevations[index]!, Math.min(target, elevations[index]! + growth));
        const deposit = clamp01(growth / 5 + resurfacing);
        basalt[index] = Math.max(basalt[index]!, deposit);
        volcanicLoad[index] = clamp01(volcanicLoad[index]! + clamp01(growth / 45 + resurfacing * 0.035));
        if (vent.output === "vigorous" && distance < radius * 0.42) ash[index] = Math.max(ash[index]!, radial * duration * 0.7);
        disturbance[index] = Math.max(disturbance[index]!, deposit);
        vegetationProtection[index] *= 1 - deposit;
        forage[index] *= 1 - deposit * 0.92;
        nutrients[index] *= 1 - deposit * 0.94;
        substrateAge[index] *= 1 - deposit;
        surfaceAgeYears[index] *= 1 - deposit;
        soilDevelopment[index] *= 1 - deposit * 0.96;
        sediment[index] *= 1 - deposit * 0.86;
        carbonate[index] *= 1 - deposit;
      }
    }
    routeLavaFlows(
      previous, elevations, basalt, volcanicLoad, disturbance, nutrients, forage,
      vegetationProtection, substrateAge, surfaceAgeYears, soilDevelopment, sediment, carbonate,
      vent, radius, strength, duration, salt,
    );
  }

  return {
    ...previous, elevations, basalt, ash, volcanicLoad, disturbance,
    vegetationProtection, forage, nutrients, substrateAge, sediment, carbonate,
    surfaceAgeYears, soilDevelopment,
  };
}
