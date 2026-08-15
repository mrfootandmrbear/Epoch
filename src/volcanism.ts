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
/**
 * How hard a *single vent* is erupting right now. Derived from the vent's
 * distance to the plume by `archipelago-history.ts`, never chosen by the player
 * — the player sets `PlumeVigor` below, which is a property of the whole
 * hotspot rather than of any one shield.
 */
export type VolcanicOutput = typeof VOLCANIC_OUTPUTS[number];

export const PLUME_VIGORS = ["hyperactive", "active", "dormant"] as const;
/** The one volcanic control the player holds once the world is running. */
export type PlumeVigor = typeof PLUME_VIGORS[number];

/**
 * What the three plume settings mean mechanically: how much rock an eruption
 * lays down, and how often eruptions happen.
 *
 * `ejecta` scales the edifice a vent is building *towards*, so it moves the
 * shield's radius and cap together and therefore leaves the mean flank angle
 * untouched — a hyperactive plume builds a bigger Galápagos shield, not a
 * steeper one, which is what THESIS §6 asks for. `frequency` scales how fast a
 * vent closes on that target and how many lava flows resurface it.
 *
 * `active` is deliberately exactly 1 on both axes: it is the Galápagos-scale
 * calibration the owner accepted on 2026-08-15 (a 6.6° mean flank measured on
 * the starting island), so selecting it reproduces the accepted constants
 * rather than approximating them.
 */
export const PLUME_VIGOR: Readonly<Record<PlumeVigor, { readonly ejecta: number; readonly frequency: number }>> = {
  hyperactive: { ejecta: 1.5, frequency: 1.75 },
  active: { ejecta: 1, frequency: 1 },
  dormant: { ejecta: 0, frequency: 0 },
};

export function isPlumeVigor(value: unknown): value is PlumeVigor {
  return typeof value === "string" && PLUME_VIGORS.includes(value as PlumeVigor);
}

export interface HotSpot {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly output: VolcanicOutput;
  /**
   * How much of its shield this vent has built, 0..1. Scales the edifice the
   * vent is building *towards*, so terrain follows the integrated construction
   * record in `archipelago-history.ts` instead of jumping to a full shield the
   * moment a vent's stage is sampled as active. Defaults to 1 — a lone authored
   * vent is a finished volcano, which is what every pre-archipelago caller means.
   */
  readonly construction?: number;
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
  frequency: number,
  cap: number,
): void {
  if (vent.output === "waning" || strength * duration < 0.08) return;
  const step = terrain.extent / (terrain.side - 1);
  const half = terrain.extent / 2;
  const ventX = Math.max(1, Math.min(terrain.side - 2, Math.round((vent.x + half) / step)));
  const ventZ = Math.max(1, Math.min(terrain.side - 2, Math.round((vent.z + half) / step)));
  // Flow count is the "how often it erupts" half of plume vigor: a hyperactive
  // plume resurfaces its flanks with more separate flows, an active one keeps
  // the authored counts exactly.
  const flowCount = Math.max(1, Math.round((vent.output === "vigorous" ? 7 : 4) * frequency));
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
      // The 55 m ceiling is authored against the active shield's 43 m cap. A
      // hyperactive plume builds past it, so the ceiling has to follow the
      // edifice or flows would silently clip the summit they are resurfacing.
      const ceiling = Math.max(55, cap);
      elevations[current] = Math.max(previousElevation, Math.min(ceiling, previousElevation + deposit * 0.24));
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

/**
 * Accrete bounded broad shields before the existing weathering pass.
 *
 * `vigor` is the plume setting the player holds — one value for the whole
 * hotspot, because there is one plume. It defaults to `active`, which is
 * identity on both axes, so every caller that predates the plume control
 * resolves exactly the terrain it always did.
 */
export function resolveVolcanicAccretion(
  previous: TerrainHistory,
  hotSpots: readonly HotSpot[],
  jumpYears: number,
  vigor: PlumeVigor = "active",
): TerrainHistory {
  const { ejecta, frequency } = PLUME_VIGOR[vigor];
  if (hotSpots.length === 0 || jumpYears <= 0 || ejecta <= 0) return previous;
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
    const strength = (vent.output === "vigorous" ? 1 : vent.output === "active" ? 0.72 : 0.2) * frequency;
    // Stage sets the *rate* a vent builds at; `construction` sets the size of
    // the edifice it is building towards. Keeping those separate matters. When
    // stage picked the size too, a shield that reached full construction had by
    // then also drifted far enough to read as `waning`, whose 76 m table entry
    // describes a small lone cone — so every shield in the chain was handed a
    // target smaller than the island it had just built, growth clamped to zero,
    // and nothing past the starting island ever broke the surface.
    //
    // Radius and cap scale together, so a part-built shield is a low seamount
    // rather than a steep spike, and the flank angle is the same at every size.
    const built = Math.min(1, Math.max(0, vent.construction ?? 1));
    if (built <= 0) continue;
    const scale = ejecta * built;
    const radius = SHIELD_GEOMETRY.vigorous.radius * scale;
    const cap = SHIELD_GEOMETRY.vigorous.cap * scale;
    if (radius < step) continue;
    // How far *new* rock reaches is a property of how hard the vent is erupting
    // now, not of the edifice under it. A waning vent still tops up near its
    // summit but stops extending its skirt, so its activity retreats inwards
    // while the shield it already built stays exactly where it is.
    const activeRadius = Math.min(radius, SHIELD_GEOMETRY[vent.output].radius * ejecta);
    const salt = [...vent.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    for (let z = 1; z < previous.side - 1; z++) {
      const worldZ = z * step - half;
      for (let x = 1; x < previous.side - 1; x++) {
        const worldX = x * step - half;
        const distance = Math.hypot(worldX - vent.x, worldZ - vent.z);
        if (distance >= activeRadius) continue;
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
      vent, activeRadius, strength, duration, salt, frequency, cap,
    );
  }

  return {
    ...previous, elevations, basalt, ash, volcanicLoad, disturbance,
    vegetationProtection, forage, nutrients, substrateAge, sediment, carbonate,
    surfaceAgeYears, soilDevelopment,
  };
}
