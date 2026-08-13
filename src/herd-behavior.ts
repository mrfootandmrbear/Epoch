import { POPULATION_TRAIT_BOUNDS, type PopulationTraits } from "./population-traits";

/**
 * How a population's trait means express as movement. The simulation still owns
 * the means; this is a renderer-side reading of them, in the same spirit as the
 * per-instance expression sampling — no behaviour here feeds back into history.
 *
 * The contract for RENDERER-ROADMAP rung 7 is that two populations with
 * different means are distinguishable at mid distance from movement alone, so
 * every channel below has to survive being seen from a long way off: pace,
 * how wide a turn reads, and how tightly the group holds together.
 */
export interface HerdBehavior {
  /** Ground speed over open terrain, metres per second. */
  readonly strideSpeed: number;
  /** Fastest sustainable heading change, radians per second. */
  readonly turnRate: number;
  /** Distance at which neighbours start pushing each other apart, metres. */
  readonly spacing: number;
  /** Distance from the herd centre past which an animal is drawn back, metres. */
  readonly cohesionRadius: number;
  /** How strongly a straggler is pulled back toward the centre. */
  readonly cohesionStrength: number;
  /** Walk-cycle cadence multiplier; short legs take more steps per metre. */
  readonly strideCadence: number;
}

function normalized(key: keyof PopulationTraits, value: number): number {
  const { min, max } = POPULATION_TRAIT_BOUNDS[key];
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Turning radius is speed divided by turn rate, so this is the derived quantity
 * the roadmap names rather than a separate channel.
 */
export function turnRadius(behavior: HerdBehavior): number {
  return behavior.strideSpeed / behavior.turnRate;
}

/**
 * Radius for a deterministic phyllotaxis layout whose nearest neighbours do
 * not begin inside the behavior's separation distance. The renderer may ask
 * for a wider composition, but never a denser one: separation steering only
 * works once animals move and cannot repair a stacked review frame.
 */
export function herdLayoutRadius(count: number, spacing: number, requestedRadius = 0): number {
  if (count <= 1) return Math.max(0, requestedRadius);
  return Math.max(requestedRadius, spacing * Math.sqrt(count) * 0.66);
}

export function deriveHerdBehavior(traits: Readonly<PopulationTraits>): HerdBehavior {
  const mass = normalized("bodyMass", traits.bodyMass);
  const leg = normalized("legLength", traits.legLength);
  const insulation = normalized("insulation", traits.insulation);

  // Stride length scales with leg length, so long-legged descendants cover
  // ground faster; mass is carried, so it costs pace.
  const strideSpeed = 2.4 * (0.66 + leg * 0.72) * (1.14 - mass * 0.32);

  // Heavy, long-limbed animals commit to a heading and swing wide out of it.
  // Light short-legged ones pivot almost in place.
  const turnRate = 2.7 - mass * 1.35 - leg * 0.55;

  // Bigger bodies need more room; insulation pulls the whole group tighter,
  // so cold-adapted herds pack and hot-climate grazers string out.
  const spacing = (3.0 + mass * 3.6) * (1.18 - insulation * 0.36);
  const cohesionStrength = 0.15 + insulation * 0.21;

  // A cohesion radius inside the separation distance would leave the two
  // forces fighting each other in place, which reads as jitter rather than as
  // a tight herd. The group's holding distance is always the looser of the two.
  const cohesionRadius = Math.max(24 - insulation * 13, spacing * 1.9);

  return {
    strideSpeed,
    turnRate,
    spacing,
    cohesionRadius,
    cohesionStrength,
    // Short legs cover less ground per step, so they step more often to hold
    // the same pace; this keeps feet from skating at either extreme.
    strideCadence: 1.32 - leg * 0.62,
  };
}

/**
 * Rotates `current` toward `desired` by at most `maxDelta`, taking the short way
 * around. Headings are compared on the circle, so a turn from just under +pi to
 * just over -pi is a nudge rather than a full spin.
 */
export function approachHeading(current: number, desired: number, maxDelta: number): number {
  let difference = (desired - current) % (Math.PI * 2);
  if (difference > Math.PI) difference -= Math.PI * 2;
  if (difference < -Math.PI) difference += Math.PI * 2;
  if (Math.abs(difference) <= maxDelta) return desired;
  return current + Math.sign(difference) * maxDelta;
}
