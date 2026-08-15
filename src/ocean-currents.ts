import { SEA_LEVEL, WIND, type ClimateForces } from "./climate";
import type { WorldSnapshot } from "./world-snapshot";

/**
 * Depth-integrated prevailing flow over the seabed.
 *
 * Coral does not choose where to live; water does. Reef zonation follows the
 * flow field far more tightly than it follows depth alone, so the current
 * field is simulation state that both the succession model and the renderer
 * read, rather than a shader-side decoration.
 *
 * Velocity is metres per second in world axes. `speed` and `shelter` are
 * normalized against the prevailing open-water reference so downstream
 * consumers never have to re-derive the scale.
 */
export interface CurrentField {
  readonly side: number;
  readonly extent: number;
  readonly step: number;
  readonly seaLevel: number;
  /** Reference open-water speed in m/s that `speed` is normalized against. */
  readonly referenceSpeed: number;
  readonly flowX: Float32Array;
  readonly flowZ: Float32Array;
  /**
   * |flow| / referenceSpeed, so undisturbed open water sits at 1.
   *
   * Deliberately not capped at 1: water crossing a shallow reef crest really
   * does outrun the open shelf, and that acceleration is the venturi that
   * sorts branching coral from massive coral. Capping it would flatten the
   * majority of the shelf onto a single value and throw the signal away.
   * Bounded by SPEED_CEILING.
   */
  readonly speed: Float32Array;
  /** Stagnant and recirculating water: leeward wake, lagoons, embayments. */
  readonly shelter: Float32Array;
  /** Signed vertical vorticity, normalized. Eddies read directly off this. */
  readonly vorticity: Float32Array;
  /** 1 where the cell is submerged. */
  readonly water: Uint8Array;
  readonly prevailing: Readonly<{ x: number; z: number }>;
}

export interface CurrentSample {
  readonly x: number;
  readonly z: number;
  readonly speed: number;
  readonly shelter: number;
  readonly vorticity: number;
}

/**
 * Upper bound on normalized speed. Open water is 1; a scoured crest reaches
 * roughly twice that before the depth-averaged model stops being meaningful.
 */
export const SPEED_CEILING = 2.5;
/** Friction floor. Below this the boundary layer eats the depth-averaged flow. */
const FRICTION_DEPTH = 0.9;
/** Depth over which transport saturates; deeper water carries no extra flux. */
const TRANSPORT_DEPTH = 22;
/**
 * How far downstream an obstacle keeps a recognisable wake, as a fraction of
 * the world extent.
 *
 * A wake belongs to the island that makes it, so this cannot be a fixed number
 * of metres: the authored 110 m was tuned against the old 380 m world, and
 * keeping it at 2,000 m would have left every island trailing a wake shorter
 * than its own shore. The ratio is what was actually authored.
 */
const WAKE_RANGE_FRACTION = 110 / 380;

/**
 * Largest grid the flow solve runs on, regardless of how fine the terrain is.
 *
 * The pressure projection converges in sweeps proportional to the grid width
 * and costs a full grid pass each, so the solve is side³ — it dominated a deep
 * time jump the moment the world widened (3.6 s of a 3.6 s resolve at 401²).
 * The flow field does not need terrain resolution: it is a basin-scale field
 * that every consumer reads through `sampleCurrent`'s bilinear filter in world
 * coordinates, so solving it coarsely and sampling it smoothly is invisible
 * downstream. At the 2,000 m extent this is about 12.5 m per cell, which still
 * resolves an island wake across roughly forty-five cells.
 *
 * Measured on the shipping 401² terrain: the two projections cost 580 ms at
 * 193, 170 ms at this value, against 3.55 s uncapped. The wake trace is a
 * further 80 ms and is not the term that scales badly.
 */
export const CURRENT_FIELD_MAX_SIDE = 161;
/**
 * Sweeps of the pressure solve, scaled to the grid.
 *
 * An island deflects water long before the water reaches it, so the potential
 * has to be converged across the whole basin, not merely relaxed locally. With
 * optimal over-relaxation the error decays like (1 - 2π/side) per sweep, so a
 * few sweeps per cell of width clears six digits with room to spare.
 */
function projectionSweeps(side: number): number {
  return Math.min(1400, Math.max(120, side * 4));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Surface currents run at a few percent of the wind that drives them, with a
 * residual tidal component that survives a calm. This keeps a calm epoch's
 * reef in the low-flow regime without stalling it completely.
 */
export function prevailingCurrentSpeed(climate: ClimateForces): number {
  return 0.08 + WIND[climate.wind].speed * 0.021;
}

/**
 * Read the snapshot's bathymetry onto the solve grid.
 *
 * When the solve grid is the snapshot's own the read is exact. When it is
 * coarser, each solve cell takes the *shallowest* snapshot cell in its
 * footprint rather than an average: a rock that breaks the surface has to keep
 * deflecting the flow, and averaging would drown small islets and let the
 * current run straight through them.
 */
function bathymetrySampler(
  snapshot: WorldSnapshot,
  side: number,
): (x: number, z: number) => number {
  const source = snapshot.gridSize;
  if (side >= source) {
    return (x, z) => snapshot.elevations[z * source + x]!;
  }
  const ratio = (source - 1) / (side - 1);
  return (x, z) => {
    const x0 = Math.round(x * ratio);
    const z0 = Math.round(z * ratio);
    const x1 = Math.min(source - 1, Math.round((x + 1) * ratio) - 1);
    const z1 = Math.min(source - 1, Math.round((z + 1) * ratio) - 1);
    let shallowest = -Infinity;
    for (let sz = z0; sz <= Math.max(z0, z1); sz++) {
      for (let sx = x0; sx <= Math.max(x0, x1); sx++) {
        const value = snapshot.elevations[sz * source + sx]!;
        if (value > shallowest) shallowest = value;
      }
    }
    return shallowest;
  };
}

/** Solve ∇²φ = divergence with no-flux walls, then subtract the gradient. */
function project(
  side: number,
  step: number,
  water: Uint8Array,
  fluxX: Float32Array,
  fluxZ: Float32Array,
  potential: Float32Array,
  divergence: Float32Array,
): void {
  const index = (x: number, z: number) => z * side + x;
  divergence.fill(0);
  for (let z = 1; z < side - 1; z++) {
    for (let x = 1; x < side - 1; x++) {
      const i = index(x, z);
      if (!water[i]) continue;
      divergence[i] = (
        fluxX[i + 1]! - fluxX[i - 1]! + fluxZ[i + side]! - fluxZ[i - side]!
      ) / (2 * step);
    }
  }

  potential.fill(0);
  // Jacobi would need thousands of sweeps to carry the island's influence
  // across the basin. Over-relaxed Gauss-Seidel, updated in place, converges
  // in sweeps proportional to the grid width rather than its area, which is
  // the difference between water that wraps the island and water that barely
  // notices it. The optimal factor for this stencil is a standard result.
  const relaxation = 2 / (1 + Math.sin(Math.PI / side));
  const sweeps = projectionSweeps(side);
  for (let iteration = 0; iteration < sweeps; iteration++) {
    for (let z = 1; z < side - 1; z++) {
      for (let x = 1; x < side - 1; x++) {
        const i = index(x, z);
        if (!water[i]) { potential[i] = 0; continue; }
        // A land neighbour contributes a zero-gradient (Neumann) wall, which
        // is what turns the prevailing drift into flow that wraps the island
        // instead of flow that drives into it.
        let sum = 0;
        let open = 0;
        if (water[i + 1]) { sum += potential[i + 1]!; open++; }
        if (water[i - 1]) { sum += potential[i - 1]!; open++; }
        if (water[i + side]) { sum += potential[i + side]!; open++; }
        if (water[i - side]) { sum += potential[i - side]!; open++; }
        if (open === 0) { potential[i] = 0; continue; }
        const target = (sum - divergence[i]! * step * step) / open;
        potential[i]! += relaxation * (target - potential[i]!);
      }
    }
  }

  for (let z = 1; z < side - 1; z++) {
    for (let x = 1; x < side - 1; x++) {
      const i = index(x, z);
      if (!water[i]) { fluxX[i] = 0; fluxZ[i] = 0; continue; }
      const east = water[i + 1] ? potential[i + 1]! : potential[i]!;
      const west = water[i - 1] ? potential[i - 1]! : potential[i]!;
      const north = water[i + side] ? potential[i + side]! : potential[i]!;
      const south = water[i - side] ? potential[i - side]! : potential[i]!;
      fluxX[i]! -= (east - west) / (2 * step);
      fluxZ[i]! -= (north - south) / (2 * step);
    }
  }
}

/** How far the upstream march advances per sample, in cells. */
const SHADOW_MARCH_STEP = 0.5;
/** Smoothing passes applied to the shadow before it is differentiated. */
const SHADOW_SMOOTHING_PASSES = 3;
/** Lateral half-width the wake gains per unit travelled downstream. */
const WAKE_SPREAD = 0.26;
/** Lateral taps across the spreading wake, and their weights. */
const WAKE_FAN = [-1, -0.5, 0, 0.5, 1] as const;
const WAKE_FAN_WEIGHTS = [0.1, 0.2, 0.4, 0.2, 0.1] as const;

/** Bilinear land coverage: 0 in open water, 1 over land, fractional at a shore. */
function landFractionAt(side: number, water: Uint8Array, gx: number, gz: number): number {
  const max = side - 1;
  const cx = Math.min(max, Math.max(0, gx));
  const cz = Math.min(max, Math.max(0, gz));
  const x0 = Math.floor(cx);
  const z0 = Math.floor(cz);
  const x1 = Math.min(max, x0 + 1);
  const z1 = Math.min(max, z0 + 1);
  const tx = cx - x0;
  const tz = cz - z0;
  const land = (x: number, z: number) => (water[z * side + x] ? 0 : 1);
  const north = land(x0, z0) + (land(x1, z0) - land(x0, z0)) * tx;
  const south = land(x0, z1) + (land(x1, z1) - land(x0, z1)) * tx;
  return north + (south - north) * tz;
}

/** Average each water cell with its wet neighbours, in place. */
function smoothWaterField(
  side: number,
  water: Uint8Array,
  field: Float32Array,
  scratch: Float32Array,
  passes: number,
): void {
  for (let pass = 0; pass < passes; pass++) {
    scratch.set(field);
    for (let z = 1; z < side - 1; z++) {
      for (let x = 1; x < side - 1; x++) {
        const i = z * side + x;
        if (!water[i]) continue;
        let sum = scratch[i]!;
        let count = 1;
        if (water[i + 1]) { sum += scratch[i + 1]!; count++; }
        if (water[i - 1]) { sum += scratch[i - 1]!; count++; }
        if (water[i + side]) { sum += scratch[i + side]!; count++; }
        if (water[i - side]) { sum += scratch[i - side]!; count++; }
        field[i] = sum / count;
      }
    }
  }
}

/**
 * Mark how deeply each water cell sits in an island's flow shadow by marching
 * upstream until land blocks the view. Potential flow alone wraps an obstacle
 * symmetrically and leaves no wake at all, so separation has to be added.
 *
 * The march samples land coverage bilinearly at sub-cell steps, across a fan
 * that widens with distance, and the result is then smoothed. All three matter:
 * the wake's lateral gradient is what carries the sign of the eddies, and a
 * shadow that snapped to whole cells and kept a constant width would hand that
 * gradient nothing but stair-step aliasing over a flat top.
 */
function traceWakeShadow(
  side: number,
  step: number,
  wakeRange: number,
  water: Uint8Array,
  prevailX: number,
  prevailZ: number,
  shadow: Float32Array,
  scratch: Float32Array,
): void {
  const reachCells = wakeRange / step;
  const perpX = -prevailZ;
  const perpZ = prevailX;
  shadow.fill(0);
  for (let z = 0; z < side; z++) {
    for (let x = 0; x < side; x++) {
      const i = z * side + x;
      if (!water[i]) continue;
      let strongest = 0;
      for (let march = SHADOW_MARCH_STEP; march <= reachCells; march += SHADOW_MARCH_STEP) {
        const falloff = 1 - (march * step) / wakeRange;
        if (falloff <= 0) break;
        // Nearer land shadows harder, so once the remaining falloff can no
        // longer beat what has already been found the march is finished.
        if (falloff <= strongest) break;
        const baseX = x - prevailX * march;
        const baseZ = z - prevailZ * march;
        const width = march * WAKE_SPREAD;
        let land = 0;
        for (let tap = 0; tap < WAKE_FAN.length; tap++) {
          const offset = WAKE_FAN[tap]! * width;
          land += WAKE_FAN_WEIGHTS[tap]!
            * landFractionAt(side, water, baseX + perpX * offset, baseZ + perpZ * offset);
        }
        if (land > 0) strongest = Math.max(strongest, land * falloff);
      }
      shadow[i] = strongest;
    }
  }
  smoothWaterField(side, water, shadow, scratch, SHADOW_SMOOTHING_PASSES);
}

/** Build the prevailing flow field for one landing from bathymetry and climate. */
export function buildCurrentField(snapshot: WorldSnapshot, climate?: ClimateForces): CurrentField {
  const forces = (climate ?? snapshot.climate) as ClimateForces;
  const extent = snapshot.extent;
  const side = Math.min(snapshot.gridSize, CURRENT_FIELD_MAX_SIDE);
  const step = extent / (side - 1);
  const wakeRange = extent * WAKE_RANGE_FRACTION;
  const elevationAt = bathymetrySampler(snapshot, side);
  const seaLevel = SEA_LEVEL[forces.seaLevel];
  const referenceSpeed = prevailingCurrentSpeed(forces);
  const wind = WIND[forces.wind];
  // A calm regime still has a residual drift; without a direction the whole
  // field would collapse to zero and every reef would read as sheltered.
  const prevailX = wind.x !== 0 ? wind.x : 0.82;
  const prevailZ = wind.x !== 0 ? 0.34 : 0.57;
  const prevailLength = Math.hypot(prevailX, prevailZ);
  const prevailing = { x: prevailX / prevailLength, z: prevailZ / prevailLength };

  const cells = side * side;
  const water = new Uint8Array(cells);
  const depth = new Float32Array(cells);
  const fluxX = new Float32Array(cells);
  const fluxZ = new Float32Array(cells);
  for (let i = 0; i < cells; i++) {
    const submerged = seaLevel - elevationAt(i % side, Math.floor(i / side));
    depth[i] = Math.max(0, submerged);
    if (submerged <= 0) continue;
    water[i] = 1;
    // Volume flux, not velocity. Dividing back out by depth at the end is what
    // accelerates the flow over a shallow reef crest and slackens it in a deep
    // lagoon — the venturi that sorts branching coral from massive coral.
    const transport = Math.min(depth[i]!, TRANSPORT_DEPTH)
      * clamp01((depth[i]! - FRICTION_DEPTH * 0.35) / FRICTION_DEPTH);
    fluxX[i] = prevailing.x * transport;
    fluxZ[i] = prevailing.z * transport;
  }

  const potential = new Float32Array(cells);
  const divergence = new Float32Array(cells);
  project(side, step, water, fluxX, fluxZ, potential, divergence);

  const shadow = new Float32Array(cells);
  traceWakeShadow(side, step, wakeRange, water, prevailing.x, prevailing.z, shadow, divergence);
  const perpX = -prevailing.z;
  const perpZ = prevailing.x;
  for (let z = 1; z < side - 1; z++) {
    for (let x = 1; x < side - 1; x++) {
      const i = z * side + x;
      if (!water[i] || shadow[i]! <= 0) continue;
      // The shear layers on either side of the wake roll up into a pair of
      // counter-rotating eddies. The lateral gradient of the shadow carries
      // the sign of that rotation, so the two lobes come out opposed.
      const lateral = (
        (shadow[i + 1]! - shadow[i - 1]!) * perpX + (shadow[i + side]! - shadow[i - side]!) * perpZ
      ) * 0.5;
      const strength = shadow[i]!;
      const transport = Math.min(depth[i]!, TRANSPORT_DEPTH);
      fluxX[i]! -= prevailing.x * transport * strength * 0.78;
      fluxZ[i]! -= prevailing.z * transport * strength * 0.78;
      fluxX[i]! += perpX * transport * lateral * 5.5;
      fluxZ[i]! += perpZ * transport * lateral * 5.5;
    }
  }
  // The wake terms are not divergence free on their own, so the field is
  // projected a second time. Recirculation survives; sources and sinks do not.
  project(side, step, water, fluxX, fluxZ, potential, divergence);

  const flowX = new Float32Array(cells);
  const flowZ = new Float32Array(cells);
  const speed = new Float32Array(cells);
  const shelter = new Float32Array(cells);
  const vorticity = new Float32Array(cells);
  for (let i = 0; i < cells; i++) {
    if (!water[i]) { shelter[i] = 1; continue; }
    const effectiveDepth = Math.max(FRICTION_DEPTH, depth[i]!);
    const scale = referenceSpeed / Math.max(FRICTION_DEPTH, Math.min(TRANSPORT_DEPTH, effectiveDepth));
    flowX[i] = fluxX[i]! * scale;
    flowZ[i] = fluxZ[i]! * scale;
    speed[i] = Math.min(SPEED_CEILING, Math.hypot(flowX[i]!, flowZ[i]!) / referenceSpeed);
    shelter[i] = clamp01(1 - speed[i]! * 0.85 + shadow[i]! * 0.42);
  }
  for (let z = 1; z < side - 1; z++) {
    for (let x = 1; x < side - 1; x++) {
      const i = z * side + x;
      if (!water[i]) continue;
      const curl = (flowZ[i + 1]! - flowZ[i - 1]! - flowX[i + side]! + flowX[i - side]!) / (2 * step);
      vorticity[i] = Math.max(-1, Math.min(1, curl * 40 / referenceSpeed));
    }
  }

  return {
    side, extent, step, seaLevel, referenceSpeed,
    flowX, flowZ, speed, shelter, vorticity, water, prevailing,
  };
}

function bilinear(field: CurrentField, values: Float32Array, x: number, z: number): number {
  const max = field.side - 1;
  const gx = Math.max(0, Math.min(max, (x / field.extent + 0.5) * max));
  const gz = Math.max(0, Math.min(max, (z / field.extent + 0.5) * max));
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const x1 = Math.min(max, x0 + 1);
  const z1 = Math.min(max, z0 + 1);
  const tx = gx - x0;
  const tz = gz - z0;
  const north = values[z0 * field.side + x0]! + (values[z0 * field.side + x1]! - values[z0 * field.side + x0]!) * tx;
  const south = values[z1 * field.side + x0]! + (values[z1 * field.side + x1]! - values[z1 * field.side + x0]!) * tx;
  return north + (south - north) * tz;
}

export function sampleCurrent(field: CurrentField, x: number, z: number): CurrentSample {
  return {
    x: bilinear(field, field.flowX, x, z),
    z: bilinear(field, field.flowZ, x, z),
    speed: bilinear(field, field.speed, x, z),
    shelter: bilinear(field, field.shelter, x, z),
    vorticity: bilinear(field, field.vorticity, x, z),
  };
}

/**
 * Pack the field for a shader. RG carries the flow vector remapped into 0..1,
 * B carries normalized speed divided by SPEED_CEILING, A carries shelter.
 *
 * A consumer recovers metres per second as
 * `(rg * 2 - 1) * referenceSpeed * SPEED_CEILING` and normalized speed as
 * `b * SPEED_CEILING`.
 */
export function packCurrentField(field: CurrentField, target: Float32Array): void {
  const scale = 1 / Math.max(1e-6, field.referenceSpeed * SPEED_CEILING * 2);
  for (let i = 0; i < field.side * field.side; i++) {
    target[i * 4] = Math.max(0, Math.min(1, field.flowX[i]! * scale + 0.5));
    target[i * 4 + 1] = Math.max(0, Math.min(1, field.flowZ[i]! * scale + 0.5));
    target[i * 4 + 2] = field.speed[i]! / SPEED_CEILING;
    target[i * 4 + 3] = field.shelter[i]!;
  }
}
