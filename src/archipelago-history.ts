/**
 * Renderer-independent record of the hotspot archipelago: one fixed mantle
 * hotspot, a crust that travels across it, and the shields the crust carries
 * away.
 *
 * **Reference frames.** The hotspot is fixed in *mantle* space. The terrain
 * heightfield in `terrain-history.ts` is the *crust* frame — it rides the
 * plate, so a shield's grid position never changes once it is born and no
 * inherited terrain has to be resampled as the world ages. What moves through
 * the grid is the hotspot: `hotspotCrustPosition` walks it backwards along the
 * drift axis as `crustOffset` accumulates. Distances between a shield and the
 * hotspot are identical in either frame, so nothing downstream needs to care
 * which one it is reading.
 *
 * **Compressed rates.** `PRODUCT.md` calls the playable island a compressed
 * representative landscape. Real plate motion would carry a shield tens of
 * kilometres per million years, which is still an order of magnitude past the
 * 2,000 m playable extent, so `DEFAULT_DRIFT_RATE` is authored for legible
 * morphology across the deep-time ladder rather than taken from measurement.
 */

import { SHIELD_GEOMETRY } from "./volcanism";

/** Volcanic construction stage. Emergence is geography, resolved from terrain, not from this. */
export const SHIELD_STAGES = ["nascent", "shield-building", "waning", "extinct"] as const;
export type ShieldStage = typeof SHIELD_STAGES[number];

export const ARCHIPELAGO_HISTORY_VERSION = 1 as const;

/**
 * Metres of crust travel per year.
 *
 * Chosen so the deep-time ladder divides its work legibly, and re-derived for
 * the 2,000 m extent adopted on 2026-08-15. Every ratio below is the one the
 * 380 m world was tuned to; only the metres changed.
 * - 1,000 years moves the crust 0.4 m — tectonically silent, which is correct
 *   for a rung whose subject is soil, drainage and vegetation.
 * - 100,000 years moves it 40 m — far less than a shield radius, so a saddle
 *   between neighbours is broken by sea level and erosion rather than by drift.
 * - 1,000,000 years moves it 400 m — just past `SHIELD_SPACING`, so a
 *   million-year click reliably exposes *one* new shield at the hotspot rather
 *   than a whole chain at once.
 *
 * The upper bound comes from the playable extent: at this rate the first island
 * needs roughly three million-year jumps to be carried from the hotspot to the
 * edge of the grid, so departure and inheritance read as an arc across several
 * clicks instead of happening in one. Verify a retune with the schematic in
 * `scripts/archipelago-schematic.ts`, which draws the chain against the grid.
 */
export const DEFAULT_DRIFT_RATE = 4e-4;

/**
 * Crust travel between successive shields, in metres. At ~1.4 shield radii the
 * summits read as separate volcanoes while their skirts still overlap into the
 * low saddle the first vertical slice needs. Derived from the shield geometry
 * in `volcanism.ts` so the two cannot drift apart.
 */
export const SHIELD_SPACING = Math.round(SHIELD_GEOMETRY.vigorous.radius * 1.4);

/** Iteration ceiling for birth stepping. Two iterations are spent per birth. */
const BIRTH_STEP_LIMIT = 8192;

/**
 * Distance from the hotspot, in metres, past which a shield receives no further
 * construction. Held at the authored ~1.76 shield radii.
 */
export const HOTSPOT_REACH = Math.round(SHIELD_GEOMETRY.vigorous.radius * 1.76);

/**
 * Years of undiminished hotspot feeding needed to build a shield out fully.
 *
 * Provisional. A shield stays inside `HOTSPOT_REACH` for about 1.2 million
 * years at the default drift rate, and its influence falls off linearly across
 * that span, so at this value a shield finishes construction around halfway
 * through its time over the hotspot and then rides on as old land. Expect to
 * retune alongside `RENDER_SCALE.islandExtent` — see the scale Work Unit in
 * `docs/EXECUTION.md`.
 */
export const FULL_CONSTRUCTION_YEARS = 250_000;

export interface ShieldHistory {
  readonly id: string;
  /** Total world years elapsed when this shield first erupted. */
  readonly birthYear: number;
  /**
   * Position in the crust frame — that is, in terrain-grid world coordinates.
   * Fixed for the shield's entire life, because the shield rides the plate.
   */
  readonly crustX: number;
  readonly crustZ: number;
  /**
   * Accumulated volcanic construction, 0..1. This is how much of its shield the
   * vent has built, not an elevation: actual terrain height stays the property
   * of `terrain-history.ts`, which resolves it from this.
   */
  readonly construction: number;
  /** Years since this shield last received meaningful construction. */
  readonly dormantYears: number;
}

export interface ArchipelagoHistory {
  readonly version: typeof ARCHIPELAGO_HISTORY_VERSION;
  /** The hotspot, fixed in mantle space for the life of the world. */
  readonly hotspotX: number;
  readonly hotspotZ: number;
  /** Unit vector: the direction the crust travels across the mantle. */
  readonly driftX: number;
  readonly driftZ: number;
  /** Metres of crust travel per year. */
  readonly driftRate: number;
  /** Metres the crust has travelled across the mantle since the world began. */
  readonly crustOffset: number;
  /** Serial for the next shield id, so ids stay unique and stable across loads. */
  readonly nextShieldSerial: number;
  readonly shields: readonly ShieldHistory[];
}

export interface Point2 {
  readonly x: number;
  readonly z: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface ArchipelagoOptions {
  readonly hotspotX?: number;
  readonly hotspotZ?: number;
  /** Drift direction; normalized on construction. Defaults to +x. */
  readonly driftX?: number;
  readonly driftZ?: number;
  readonly driftRate?: number;
}

/**
 * A fresh world: a fixed hotspot, an unmoved crust, and no shields yet. The
 * canonical opening erupts the first shield through `advanceArchipelago`.
 */
export function createArchipelagoHistory(options: ArchipelagoOptions = {}): ArchipelagoHistory {
  const rawX = options.driftX ?? 1;
  const rawZ = options.driftZ ?? 0;
  const length = Math.hypot(rawX, rawZ);
  if (!Number.isFinite(length) || length <= 0) {
    throw new RangeError("archipelago drift direction must be a non-zero finite vector");
  }
  const driftRate = options.driftRate ?? DEFAULT_DRIFT_RATE;
  if (!Number.isFinite(driftRate) || driftRate < 0) {
    throw new RangeError("archipelago drift rate must be a non-negative finite number");
  }
  return {
    version: ARCHIPELAGO_HISTORY_VERSION,
    hotspotX: options.hotspotX ?? 0,
    hotspotZ: options.hotspotZ ?? 0,
    driftX: rawX / length,
    driftZ: rawZ / length,
    driftRate,
    crustOffset: 0,
    nextShieldSerial: 0,
    shields: [],
  };
}

/**
 * Where the hotspot currently sits in crust/terrain coordinates. The crust has
 * moved `crustOffset` metres along the drift axis, so in the crust's own frame
 * the hotspot has travelled the same distance the other way.
 */
export function hotspotCrustPosition(history: ArchipelagoHistory, atOffset = history.crustOffset): Point2 {
  return {
    x: history.hotspotX - history.driftX * atOffset,
    z: history.hotspotZ - history.driftZ * atOffset,
  };
}

/** Where a shield currently sits in mantle space, having been carried by the crust. */
export function shieldMantlePosition(history: ArchipelagoHistory, shield: ShieldHistory): Point2 {
  return {
    x: shield.crustX + history.driftX * history.crustOffset,
    z: shield.crustZ + history.driftZ * history.crustOffset,
  };
}

/** Metres between a shield and the hotspot. Frame-independent. */
export function shieldDistanceFromHotspot(history: ArchipelagoHistory, shield: ShieldHistory): number {
  const hotspot = hotspotCrustPosition(history);
  return Math.hypot(shield.crustX - hotspot.x, shield.crustZ - hotspot.z);
}

/** How strongly the hotspot fed a shield at an arbitrary point in the crust's travel. */
function influenceAtOffset(history: ArchipelagoHistory, shield: ShieldHistory, offset: number): number {
  const hotspot = hotspotCrustPosition(history, offset);
  return clamp01(1 - Math.hypot(shield.crustX - hotspot.x, shield.crustZ - hotspot.z) / HOTSPOT_REACH);
}

/** How strongly the hotspot still feeds a shield, 1 directly above it to 0 beyond its reach. */
export function hotspotInfluence(history: ArchipelagoHistory, shield: ShieldHistory): number {
  return influenceAtOffset(history, shield, history.crustOffset);
}

/**
 * Construction stage, derived rather than stored so it can never disagree with
 * the shield's position relative to the hotspot.
 */
export function shieldStage(history: ArchipelagoHistory, shield: ShieldHistory): ShieldStage {
  const influence = hotspotInfluence(history, shield);
  if (influence <= 0) return "extinct";
  if (influence < 0.45) return "waning";
  if (shield.construction < 0.35) return "nascent";
  return "shield-building";
}

/**
 * Bridge to the vent model in `volcanism.ts`, so shield state can drive the
 * existing accretion pass without that module learning about the archipelago.
 */
export function shieldVolcanicOutput(stage: ShieldStage): "vigorous" | "active" | "waning" | "extinct" {
  switch (stage) {
    case "nascent": return "vigorous";
    case "shield-building": return "active";
    case "waning": return "waning";
    case "extinct": return "extinct";
  }
}

/** Distance from a crust position to the nearest existing shield, or Infinity if there are none. */
/**
 * The offset at which the travelling hotspot next stands a full `SHIELD_SPACING`
 * clear of every existing shield, solved rather than traced.
 *
 * The hotspot walks a straight line through the crust frame, so "clear of
 * shield i" is exactly "outside the circle of radius `SHIELD_SPACING` centred
 * on shield i", and the exit offset is the far root of a quadratic. The answer
 * for the whole chain is the furthest of those exits.
 *
 * This replaces a conservative sphere trace that stepped by `SPACING - gap`.
 * That step collapses towards zero for a shield sitting almost exactly one
 * spacing off the drift axis — the geometry is near-tangential, so each step
 * buys almost nothing — and the loop could exhaust its iteration guard on a
 * perfectly ordinary jump. Widening the world made that reachable, because the
 * number of steps grows with the spacing being traced.
 *
 * Returns `from` when the hotspot is already clear.
 */
function nextClearOffset(
  history: ArchipelagoHistory,
  shields: readonly ShieldHistory[],
  from: number,
): number {
  // Direction of travel of the hotspot *through the crust frame*.
  const dx = -history.driftX;
  const dz = -history.driftZ;
  const origin = hotspotCrustPosition(history, from);
  let latest = from;
  for (const shield of shields) {
    const ox = origin.x - shield.crustX;
    const oz = origin.z - shield.crustZ;
    // |origin + t·d - centre|² = SPACING², with |d| = 1 so the leading term is t².
    const b = ox * dx + oz * dz;
    const c = ox * ox + oz * oz - SHIELD_SPACING * SHIELD_SPACING;
    if (c >= 0) continue; // already outside this shield's circle
    // c < 0 puts the origin strictly inside, so the discriminant is positive
    // and the far root is the exit.
    const exit = -b + Math.sqrt(b * b - c);
    if (from + exit > latest) latest = from + exit;
  }
  return latest;
}

function distanceToNearestShield(shields: readonly ShieldHistory[], point: Point2): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const shield of shields) {
    const distance = Math.hypot(shield.crustX - point.x, shield.crustZ - point.z);
    if (distance < nearest) nearest = distance;
  }
  return nearest;
}

/**
 * Influence-years a shield accumulates while the hotspot feeds it, integrated
 * across the jump rather than sampled at its end.
 *
 * Sampling only the endpoint made construction depend on how the player *chunked*
 * elapsed time — one million-year click and ten hundred-thousand-year clicks
 * produced different islands from identical geometry, and a single long jump
 * credited a shield only for where it finally came to rest. Integrating makes
 * the result additive over sub-intervals, so the ladder's rungs compose.
 *
 * Also returns the last point in the jump at which the shield was still being
 * fed, so dormancy can start from there instead of from the whole jump.
 */
function integrateInfluence(
  history: ArchipelagoHistory,
  shield: ShieldHistory,
  fromYears: number,
  jumpYears: number,
): { influenceYears: number; lastActiveYears: number } {
  const span = jumpYears - fromYears;
  if (span <= 0) return { influenceYears: 0, lastActiveYears: -1 };

  // Resolve finely enough that the hotspot's falloff is well sampled. A
  // stationary crust needs a single sample, because influence cannot change.
  const travel = history.driftRate * span;
  const steps = Math.max(1, Math.min(8192, Math.ceil(travel / (HOTSPOT_REACH / 32))));

  const influenceAtYears = (years: number): number =>
    influenceAtOffset(history, shield, history.crustOffset + history.driftRate * years);

  let total = 0;
  let lastActiveYears = -1;
  let firstInactiveAfter = -1;
  for (let step = 0; step <= steps; step++) {
    const years = fromYears + (span * step) / steps;
    const influence = influenceAtYears(years);
    if (influence > 0) {
      lastActiveYears = years;
      firstInactiveAfter = -1;
    } else if (lastActiveYears >= 0 && firstInactiveAfter < 0) {
      firstInactiveAfter = years;
    }
    total += influence * (step === 0 || step === steps ? 0.5 : 1);
  }

  // The samples only bracket the moment feeding stopped; without refining it,
  // dormancy would be quantized to the sampling grid and could be several
  // percent of a long jump out. Distance from a fixed shield to a hotspot
  // travelling in a straight line is convex, so influence has a single falling
  // edge and bisection lands on it exactly.
  if (lastActiveYears >= 0 && firstInactiveAfter > lastActiveYears) {
    let low = lastActiveYears;
    let high = firstInactiveAfter;
    for (let iteration = 0; iteration < 40; iteration++) {
      const middle = (low + high) / 2;
      if (influenceAtYears(middle) > 0) low = middle;
      else high = middle;
    }
    lastActiveYears = low;
  }

  return { influenceYears: (total * span) / steps, lastActiveYears };
}

/**
 * Advance the crust across the hotspot by one jump.
 *
 * Long jumps can pass several shield spacings, so births are stepped through
 * the jump rather than all placed at the final hotspot position — otherwise a
 * single million-year jump would stack a whole chain's worth of shields on one
 * spot instead of laying them out along the drift axis.
 */
export function advanceArchipelago(
  history: ArchipelagoHistory,
  jumpYears: number,
  totalYearsBefore: number,
): ArchipelagoHistory {
  if (!Number.isFinite(jumpYears) || jumpYears < 0) {
    throw new RangeError("archipelago jump years must be a non-negative finite number");
  }
  if (jumpYears === 0) return history;

  const travel = history.driftRate * jumpYears;
  const endOffset = history.crustOffset + travel;
  const shields = [...history.shields];
  let serial = history.nextShieldSerial;

  // Walk the jump, erupting a shield each time the hotspot has cleared a full
  // spacing from whatever land is nearest to it.
  let offset = history.crustOffset;
  let guard = 0;
  for (;;) {
    if (guard++ > BIRTH_STEP_LIMIT) {
      // Silently truncating the chain would corrupt the world with no signal,
      // so fail loudly instead. Unreachable at any playable drift rate.
      throw new RangeError(
        `archipelago birth stepping exceeded ${BIRTH_STEP_LIMIT} iterations for a ${jumpYears} year jump`,
      );
    }
    const position = hotspotCrustPosition(history, offset);
    const gap = distanceToNearestShield(shields, position);
    // The epsilon matters: the step below is a conservative sphere trace, and
    // for a shield sitting almost exactly one spacing off the drift axis the
    // step collapses towards zero and the crossing is never reached. Treating
    // "within a micrometre of a spacing" as a spacing removes that stall.
    if (gap >= SHIELD_SPACING - 1e-6) {
      const fraction = travel === 0 ? 0 : (offset - history.crustOffset) / travel;
      shields.push({
        id: `shield-${serial++}`,
        birthYear: totalYearsBefore + jumpYears * fraction,
        crustX: position.x,
        crustZ: position.z,
        construction: 0,
        dormantYears: 0,
      });
      continue;
    }
    // Advance to the offset at which the hotspot next stands a full spacing
    // clear of every shield, or stop if that lies past this jump.
    const next = nextClearOffset(history, shields, offset);
    if (next > endOffset || next <= offset) break;
    offset = next;
  }

  const advanced: ArchipelagoHistory = { ...history, crustOffset: endOffset, nextShieldSerial: serial, shields };

  const grown = shields.map((shield) => {
    // Integrate from the moment the shield existed, so a shield born partway
    // through a jump is neither credited nor charged for the years before it.
    const bornAt = Math.min(jumpYears, Math.max(0, shield.birthYear - totalYearsBefore));
    const { influenceYears, lastActiveYears } = integrateInfluence(history, shield, bornAt, jumpYears);
    const construction = clamp01(shield.construction + influenceYears / FULL_CONSTRUCTION_YEARS);

    // Dormancy tracks whether the hotspot is still feeding this shield — not
    // whether construction happened to move. A shield pinned at full
    // construction directly over the vent is the most active land in the
    // world, and must never read as the most weathered.
    let dormantYears: number;
    if (hotspotInfluence(advanced, shield) > 0) {
      dormantYears = 0;
    } else if (lastActiveYears < 0) {
      dormantYears = shield.dormantYears + (jumpYears - bornAt);
    } else {
      dormantYears = jumpYears - lastActiveYears;
    }
    return { ...shield, construction, dormantYears };
  });

  return { ...advanced, shields: grown };
}

function requireRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null) throw new TypeError(`${context} must be an object`);
  return value as Record<string, unknown>;
}

export function validateArchipelagoHistory(value: unknown): asserts value is ArchipelagoHistory {
  const history = requireRecord(value, "archipelago history");
  if (history.version !== ARCHIPELAGO_HISTORY_VERSION) {
    throw new RangeError(
      `archipelago history version must be ${ARCHIPELAGO_HISTORY_VERSION}, received ${String(history.version)}`,
    );
  }
  for (const field of ["hotspotX", "hotspotZ", "driftX", "driftZ"] as const) {
    if (!Number.isFinite(history[field])) throw new RangeError(`archipelago history.${field} must be finite`);
  }
  const driftLength = Math.hypot(history.driftX as number, history.driftZ as number);
  if (Math.abs(driftLength - 1) > 1e-6) {
    throw new RangeError(`archipelago history drift direction must be a unit vector, received length ${driftLength}`);
  }
  for (const field of ["driftRate", "crustOffset"] as const) {
    const entry = history[field];
    if (!Number.isFinite(entry) || (entry as number) < 0) {
      throw new RangeError(`archipelago history.${field} must be a non-negative finite number`);
    }
  }
  if (!Number.isInteger(history.nextShieldSerial) || (history.nextShieldSerial as number) < 0) {
    throw new RangeError("archipelago history.nextShieldSerial must be a non-negative integer");
  }
  if (!Array.isArray(history.shields)) throw new TypeError("archipelago history.shields must be an array");
  const ids = new Set<string>();
  history.shields.forEach((value, index) => {
    const context = `archipelago history.shields[${index}]`;
    const shield = requireRecord(value, context);
    if (typeof shield.id !== "string" || shield.id.length === 0) {
      throw new TypeError(`${context}.id must be a non-empty string`);
    }
    if (ids.has(shield.id as string)) throw new RangeError(`${context}.id duplicates ${String(shield.id)}`);
    ids.add(shield.id as string);
    for (const field of ["crustX", "crustZ"] as const) {
      if (!Number.isFinite(shield[field])) throw new RangeError(`${context}.${field} must be finite`);
    }
    for (const field of ["birthYear", "dormantYears"] as const) {
      const entry = shield[field];
      if (!Number.isFinite(entry) || (entry as number) < 0) {
        throw new RangeError(`${context}.${field} must be a non-negative finite number`);
      }
    }
    const construction = shield.construction;
    if (!Number.isFinite(construction) || (construction as number) < 0 || (construction as number) > 1) {
      throw new RangeError(`${context}.construction must be finite and within [0, 1]`);
    }
  });

  // A serial at or below an existing id would mint a duplicate on the next
  // jump, which validates clean now and throws one jump later, far from cause.
  for (const id of ids) {
    const suffix = Number.parseInt(id.replace(/^shield-/, ""), 10);
    if (Number.isInteger(suffix) && suffix >= (history.nextShieldSerial as number)) {
      throw new RangeError(
        `archipelago history.nextShieldSerial ${String(history.nextShieldSerial)} would duplicate existing ${id}`,
      );
    }
  }
}
