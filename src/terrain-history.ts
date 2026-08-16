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
  /** Fresh volcanic substrate; decays as basalt weathers into soil. */
  readonly basalt: Float32Array;
  /** Short-lived explosive deposits around vigorous vents. */
  readonly ash: Float32Array;
  /** Persistent lithospheric load left by volcanic construction. */
  readonly volcanicLoad: Float32Array;
  /** Locally weathered substrate maturity; fresh lava resets it. */
  readonly substrateAge: Float32Array;
  /** Years since the cell was last substantially resurfaced by lava. */
  readonly surfaceAgeYears: Float32Array;
  /** Persistent mineral and organic soil development available to plants. */
  readonly soilDevelopment: Float32Array;
  /** Persistent mineral sediment available for transport and coastal burial. */
  readonly sediment: Float32Array;
  /** Persistent reef-produced carbonate framework and depositional substrate. */
  readonly carbonate: Float32Array;
  /** Nutrients delivered to coastal water and retained between jumps. */
  readonly marineNutrients: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

const D8_X = [-1, 0, 1, -1, 1, -1, 0, 1] as const;
const D8_Z = [-1, -1, -1, 0, 0, 1, 1, 1] as const;

interface DrainageField {
  readonly receiver: Int32Array;
  readonly accumulation: Float32Array;
  readonly catchment: Uint32Array;
}

/**
 * Concentrate local rainfall into persistent-looking catchments. This remains
 * a one-pass landing-state approximation: it routes the jump's resolved water
 * over the inherited terrain instead of stepping individual storms.
 */
function resolveDrainageField(
  elevations: Float32Array,
  runoff: Float32Array,
  side: number,
): DrainageField {
  const receiver = new Int32Array(elevations.length).fill(-1);
  const accumulation = runoff.slice();
  const catchment = new Uint32Array(elevations.length).fill(1);
  const order = Array.from({ length: elevations.length }, (_, index) => index)
    .sort((a, b) => elevations[b]! - elevations[a]! || a - b);

  for (const index of order) {
    const x = index % side;
    const z = Math.floor(index / side);
    let best = -1;
    let bestDrop = 0;
    for (let direction = 0; direction < 8; direction++) {
      const nx = x + D8_X[direction]!;
      const nz = z + D8_Z[direction]!;
      if (nx < 0 || nx >= side || nz < 0 || nz >= side) continue;
      const neighbor = nz * side + nx;
      const drop = elevations[index]! - elevations[neighbor]!;
      if (drop > bestDrop + 1e-6 || (Math.abs(drop - bestDrop) <= 1e-6 && neighbor < best)) {
        best = neighbor;
        bestDrop = drop;
      }
    }
    receiver[index] = best;
  }

  // Descending elevation is a valid topological order because every receiver
  // is strictly lower. Each cell contributes its water and area downstream.
  for (const index of order) {
    const downstream = receiver[index]!;
    if (downstream < 0) continue;
    accumulation[downstream] += accumulation[index]!;
    catchment[downstream] += catchment[index]!;
  }
  return { receiver, accumulation, catchment };
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
  const deepTimeRamp = clamp01((logYears - 3) / 3);
  return {
    weathering: clamp01(logYears / 6),
    // Reserve the strongest widening, retreat, and volcanic sag for the final
    // order of magnitude. The earlier 1.4 exponent left 100k and 1M too close
    // in the owner-reviewed whole-island comparison.
    deepTime: Math.pow(deepTimeRamp, 2),
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
    basalt: new Float32Array(elevations.length),
    ash: new Float32Array(elevations.length),
    volcanicLoad: new Float32Array(elevations.length),
    substrateAge: new Float32Array(elevations.length).fill(0.58),
    surfaceAgeYears: new Float32Array(elevations.length).fill(10_000),
    soilDevelopment: new Float32Array(elevations.length).fill(0.5),
    sediment: new Float32Array(elevations.length).fill(0.08),
    carbonate: new Float32Array(elevations.length),
    marineNutrients: 0.2,
  };
}

/**
 * Cell size, in metres, that every geomorphic coefficient below was originally
 * tuned at — the 181×181 grid over the old 380 m extent.
 *
 * The coefficients are written in *cell* units: `relief` is the drop to an
 * adjacent cell, `catchment` counts cells, the diffusion term is a bare
 * Laplacian weight. All three change meaning when the grid does, so widening
 * the world would silently retune erosion unless they are converted back to
 * this reference. See `docs/EXECUTION.md` order of work item 0.
 */
export const REFERENCE_CELL_METRES = 380 / 180;

interface CellMetrics {
  /** Metres per cell on this grid. */
  readonly metres: number;
  /** Cell size relative to `REFERENCE_CELL_METRES`. 1 on the original grid. */
  readonly scale: number;
  /**
   * Converts an adjacent-cell elevation drop into the drop the reference grid
   * would have seen across the same physical gradient.
   */
  readonly gradient: number;
  /**
   * Cell *area* relative to the reference cell — the square of `scale`.
   *
   * Used only by the hillslope diffusion weight, which carries a discrete
   * Laplacian's 1/cellSize². Deliberately not applied to the drainage
   * thresholds; see the note at the channel field.
   */
  readonly area: number;
}

export function cellMetrics(extent: number, side: number): CellMetrics {
  const metres = extent / Math.max(1, side - 1);
  const scale = metres / REFERENCE_CELL_METRES;
  return { metres, scale, gradient: 1 / scale, area: scale * scale };
}

/** Apply one bounded, duration-scaled geomorphic pass to the previous landing. */
export function resolveTerrainHistory(
  previous: TerrainHistory,
  jumpYears: number,
  climate: Readonly<ClimateForces>,
): TerrainHistory {
  const { side, extent } = previous;
  const cell = cellMetrics(extent, side);
  const nextElevations = previous.elevations.slice();
  const nextDisturbance = new Float32Array(previous.disturbance.length);
  const nextForage = previous.forage.slice();
  const nextNutrients = previous.nutrients.slice();
  const nextRunoff = new Float32Array(previous.runoff.length);
  const nextBasalt = previous.basalt.slice();
  const nextAsh = previous.ash.slice();
  const nextVolcanicLoad = previous.volcanicLoad.slice();
  const nextSubstrateAge = previous.substrateAge.slice();
  const nextSurfaceAgeYears = previous.surfaceAgeYears.slice();
  const nextSoilDevelopment = previous.soilDevelopment.slice();
  const nextSediment = previous.sediment.slice();
  const nextCarbonate = previous.carbonate.slice();
  const { weathering: duration, deepTime } = geomorphicDuration(jumpYears);
  const erosion = RAINFALL[climate.rainfall].erosion;
  const wind = WIND[climate.wind].exposure;
  const sea = SEA_LEVEL[climate.seaLevel];
  const rainSupply = climate.rainfall === "wet" ? 1 : climate.rainfall === "temperate" ? 0.62 : 0.18;
  const weatheringHalfLife = climate.rainfall === "wet" ? 140 : climate.rainfall === "temperate" ? 650 : 4_000;
  let exportedNutrients = 0;
  let coastalCells = 0;

  // Resolve rainfall before reshaping the terrain so the entire jump uses one
  // authoritative drainage field. Inherited runoff makes established channels
  // more likely to keep carrying water on successive clicks.
  for (let z = 1; z < side - 1; z++) {
    for (let x = 1; x < side - 1; x++) {
      const index = z * side + x;
      const elevation = previous.elevations[index]!;
      const downhill = Math.max(0, elevation - Math.min(
        previous.elevations[index - 1]!, previous.elevations[index + 1]!,
        previous.elevations[index - side]!, previous.elevations[index + side]!,
      ));
      const inheritedFlow = (
        previous.runoff[index - 1]! + previous.runoff[index + 1]!
        + previous.runoff[index - side]! + previous.runoff[index + side]!
      ) * 0.125;
      nextRunoff[index] = clamp01(rainSupply * (0.16 + downhill * cell.gradient * 0.08) + inheritedFlow * 0.58);
    }
  }
  const drainage = resolveDrainageField(previous.elevations, nextRunoff, side);
  let channelField = new Float32Array(previous.elevations.length);
  for (let index = 0; index < channelField.length; index++) {
    // Both signals count upslope cells, so an area correction looks obviously
    // required here — and measurement says otherwise. A D8 network does not
    // hold its catchments fixed and merely sample them more finely: it
    // reorganises, and the cell counts feeding these thresholds stay close to
    // resolution-invariant on their own. Applying the analytic (cell/reference)²
    // correction overshot inland incision by ~2.9× at 5 m cells against the
    // same physical island resolved at 2.11 m; leaving it off lands at 0.82×.
    // See the cell-size invariance case in `epoch-scale-terrain.test.ts`.
    const catchmentSignal = clamp01((Math.sqrt(drainage.catchment[index]!) - 2.5) / 8);
    const dischargeSignal = clamp01(Math.sqrt(drainage.accumulation[index]!) / 5.5);
    channelField[index] = catchmentSignal * dischargeSignal;
  }
  // A mature river is a valley, not a one-vertex scratch. Expand the connected
  // centerline laterally as deep time increases; max propagation preserves the
  // drainage silhouette instead of turning it into uniform smoothing.
  //
  // A pass widens by one cell, so the count buys a fixed number of *metres*
  // only if it shrinks as cells grow.
  const referenceWidening = deepTime >= 0.85 ? 4 : deepTime >= 0.3 ? 1 : 0;
  const wideningPasses = referenceWidening === 0
    ? 0
    : Math.max(1, Math.round(referenceWidening * cell.gradient));
  for (let pass = 0; pass < wideningPasses; pass++) {
    const widened = channelField.slice();
    const falloff = [0.7, 0.56, 0.42, 0.3][pass] ?? 0.3;
    for (let z = 1; z < side - 1; z++) {
      for (let x = 1; x < side - 1; x++) {
        const index = z * side + x;
        const neighbor = Math.max(
          channelField[index - 1]!, channelField[index + 1]!,
          channelField[index - side]!, channelField[index + side]!,
        ) * falloff;
        widened[index] = Math.max(widened[index]!, neighbor);
      }
    }
    channelField = widened;
  }

  for (let z = 1; z < side - 1; z++) {
    for (let x = 1; x < side - 1; x++) {
      const index = z * side + x;
      const elevation = previous.elevations[index]!;
      const neighborhood = (
        previous.elevations[index - 1]! + previous.elevations[index + 1]!
        + previous.elevations[index - side]! + previous.elevations[index + side]!
      ) * 0.25;
      // Cell-unit relief is not a slope until it is divided by cell size.
      const relief = Math.abs(neighborhood - elevation) * cell.gradient;
      const protection = previous.vegetationProtection[index]!;
      const exposed = 1 - protection * 0.78;
      const transport = duration * erosion * exposed * (0.055 + relief * 0.012)
        + deepTime * erosion * exposed * (0.08 + relief * 0.018);
      const coastal = elevation < sea + 5
        ? duration * erosion * exposed * clamp01((sea + 5 - elevation) / 7) * 0.72
          + Math.pow(deepTime, 1.5) * exposed * clamp01((sea + 7 - elevation) / 9)
            * (3.5 + wind * 1.1)
        : 0;
      const downhill = Math.max(0, elevation - Math.min(
        previous.elevations[index - 1]!, previous.elevations[index + 1]!,
        previous.elevations[index - side]!, previous.elevations[index + side]!,
      )) * cell.gradient;
      const channelStrength = channelField[index]!;
      const channelTime = clamp01((Math.log10(Math.max(1, jumpYears)) - 2) / 4);
      // Roots protect slopes, but concentrated flow can breach a mature canopy.
      // This prevents the first forested landing from freezing geomorphology.
      const channelExposure = 1 - protection * 0.35;
      const drainageIncision = channelTime * rainSupply * channelExposure
        * channelStrength * (0.65 + deepTime * 2.15 + downhill * 0.07 + relief * 0.065);
      const reachesCoast = elevation <= sea + 3
        && drainage.receiver[index]! >= 0
        && previous.elevations[drainage.receiver[index]!]! <= sea + 1;
      const alluvialDeposition = reachesCoast
        ? channelTime * rainSupply * channelStrength * (0.18 + previous.sediment[index]! * 0.22)
        : 0;
      // Volcanic islands keep sagging after their vent dies. Load relaxes
      // slowly, so extinct edifices still cross the shoreline in deep time.
      const subsidence = deepTime * previous.volcanicLoad[index]!
        * (1.15 + previous.volcanicLoad[index]! * 1.85);
      // Hillslope diffusion. The Laplacian carries a 1/cellSize², so holding
      // the weight fixed across a resize would smooth a proportionally wider
      // strip of ground per jump and quietly melt the shield silhouette the
      // 2 km extent was adopted to express.
      const diffusion = Math.min(0.42, transport / cell.area);
      nextElevations[index] = Math.max(
        -55,
        elevation + (neighborhood - elevation) * diffusion
          - coastal - drainageIncision - subsidence + alluvialDeposition,
      );

      const activity = clamp01(
        (relief * 0.1 + coastal * 0.32) * erosion * exposed
        + drainageIncision * 0.42 + duration * wind * 0.06,
      );
      const recovery = duration * (0.08 + protection * 0.42 + Math.max(0, RAINFALL[climate.rainfall].moisture) * 0.2);
      nextDisturbance[index] = clamp01(previous.disturbance[index]! * (1 - recovery) + activity);
      const moisture = RAINFALL[climate.rainfall].moisture;
      const inheritedAge = previous.surfaceAgeYears[index]!;
      const surfaceAge = Math.min(50_000_000, inheritedAge + jumpYears);
      nextSurfaceAgeYears[index] = surfaceAge;
      const mineralWeathering = 1 - Math.exp(-jumpYears / weatheringHalfLife);
      const surfaceMaturity = 1 - Math.exp(-surfaceAge / (weatheringHalfLife * 2.4));
      const soilPotential = clamp01(
        surfaceMaturity * (0.34 + rainSupply * 0.34)
        + protection * 0.28
        + previous.ash[index]! * 0.2
        - clamp01(relief / 8) * 0.18
        - nextRunoff[index]! * erosion * 0.06,
      );
      const soilResponse = 1 - Math.exp(-jumpYears / (weatheringHalfLife * 4));
      nextSoilDevelopment[index] = clamp01(previous.soilDevelopment[index]!
        + (soilPotential - previous.soilDevelopment[index]!) * soilResponse);
      const fertility = clamp01(nextSoilDevelopment[index]! * 0.68 + previous.nutrients[index]! * 0.32);
      const potential = clamp01((0.58 + moisture * 0.55 + protection * 0.42
        - nextDisturbance[index]! * 0.38) * (0.22 + fertility * 0.78));
      const regrowth = duration * (0.12 + Math.max(0, moisture) * 0.16);
      nextForage[index] = clamp01(previous.forage[index]! + (potential - previous.forage[index]!) * regrowth);

      const litter = duration * protection * (0.035 + Math.max(0, moisture) * 0.035);
      const nutrientLoss = duration * erosion * nextRunoff[index]! * exposed * (0.025 + relief * 0.004);
      nextNutrients[index] = clamp01(previous.nutrients[index]! + litter - nutrientLoss);
      const substrateWeathering = Math.max(duration * 0.006, mineralWeathering);
      const weatheredBasalt = previous.basalt[index]! * substrateWeathering;
      nextBasalt[index] = clamp01(previous.basalt[index]! - weatheredBasalt);
      nextAsh[index] = clamp01(previous.ash[index]! * (1 - duration * (0.12 + rainSupply * 0.2)));
      nextVolcanicLoad[index] = clamp01(previous.volcanicLoad[index]! * (1 - deepTime * 0.018));
      nextSubstrateAge[index] = clamp01(Math.max(previous.substrateAge[index]!, surfaceMaturity)
        * (1 - nextBasalt[index]! * 0.72));
      const erodedMineral = clamp01(transport * 0.12 + drainageIncision * 0.34 + nutrientLoss * 0.8);
      const coastalDeposition = elevation <= sea + 5
        ? nextRunoff[index]! * duration * (0.08 + Math.max(0, sea + 3 - elevation) * 0.018)
          + alluvialDeposition * 0.45
        : 0;
      nextSediment[index] = clamp01(previous.sediment[index]! * (1 - duration * 0.035)
        + erodedMineral + coastalDeposition);
      // Carbonate is persistent geology, but runoff can bury it and fresh
      // basalt has priority over biological deposition.
      nextCarbonate[index] = clamp01(previous.carbonate[index]!
        * (1 - duration * (0.004 + nextSediment[index]! * 0.035))
        * (1 - nextBasalt[index]! * 0.92));
      nextNutrients[index] = clamp01(nextNutrients[index]! + weatheredBasalt * 0.38);
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
    basalt: nextBasalt,
    ash: nextAsh,
    volcanicLoad: nextVolcanicLoad,
    substrateAge: nextSubstrateAge,
    surfaceAgeYears: nextSurfaceAgeYears,
    soilDevelopment: nextSoilDevelopment,
    sediment: nextSediment,
    carbonate: nextCarbonate,
    marineNutrients: clamp01(
      previous.marineNutrients * (1 - duration * 0.24)
      + exportedNutrients / Math.max(1, coastalCells) * 7.5,
    ),
  };
}

/** Accumulate persistent carbonate around mature reef framework. */
export function withReefDeposition(
  history: TerrainHistory,
  sites: readonly Readonly<{
    x: number; z: number; framework: number; deadFramework: number; cover: number;
  }>[],
  jumpYears: number,
): TerrainHistory {
  if (sites.length === 0) return history;
  const carbonate = history.carbonate.slice();
  const sediment = history.sediment.slice();
  const step = history.extent / (history.side - 1);
  const half = history.extent / 2;
  const duration = clamp01(Math.log10(Math.max(1, jumpYears)) / 6);
  for (const site of sites) {
    const production = clamp01(site.framework + site.deadFramework * 0.7 + site.cover * 0.3) * duration;
    if (production < 0.01) continue;
    const centerX = Math.round((site.x + half) / step);
    const centerZ = Math.round((site.z + half) / step);
    const radius = Math.max(2, Math.ceil((4 + production * 8) / step));
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      const x = centerX + dx; const z = centerZ + dz;
      if (x < 0 || z < 0 || x >= history.side || z >= history.side) continue;
      const falloff = 1 - Math.hypot(dx, dz) / radius;
      if (falloff <= 0) continue;
      const index = z * history.side + x;
      const basaltSuppression = 1 - history.basalt[index]!;
      const burial = 1 - sediment[index]! * 0.72;
      carbonate[index] = clamp01(carbonate[index]!
        + production * falloff * basaltSuppression * burial * 0.16);
      sediment[index] = clamp01(sediment[index]! + production * falloff * 0.025);
    }
  }
  return { ...history, carbonate, sediment };
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
