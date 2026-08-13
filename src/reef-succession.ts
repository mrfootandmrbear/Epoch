import { SEA_LEVEL, TEMPERATURE, type ClimateForces } from "./climate";
import { sampleCurrent, type CurrentField } from "./ocean-currents";
import {
  snapshotBasaltAt,
  snapshotHeightAt,
  snapshotRunoffAt,
  type WorldSnapshot,
} from "./world-snapshot";

/**
 * Reef succession over one landing.
 *
 * The persistent unit is a site — suitable seabed plus what earlier epochs
 * managed to build on it — not a colony. Colonies are sampled out of a site's
 * phase each landing; the site is what carries history. This is the contract
 * WILDLIFE-ROADMAP.md asks for, reduced to the one bounded growth family the
 * vertical slice needs.
 *
 * Two inputs decide almost everything. Substrate age says how long this rock
 * has been available to settle on, so fresh lava can only ever hold pioneers.
 * The current field says how hard the water works the site, which is what
 * sorts branching forms from massive ones — coral does not choose where to
 * live, water does.
 */

export type CoralGuild =
  /** Crustose coralline algae: the pink-purple crust that precedes coral. */
  | "crustose-algae"
  /** Acropora staghorn: fast, fragile, branching. Wants moving water. */
  | "staghorn"
  /** Acropora plate: horizontal table chasing light in calmer water. */
  | "table"
  /** Massive Porites: slow hemispherical boulders. The framework builder. */
  | "massive-porites"
  /** Diploria brain coral: grooved dome, tolerant of sheltered lagoon water. */
  | "brain"
  /** Gorgonian sea fan: soft, flexible, oriented across the flow. */
  | "sea-fan";

export const CORAL_GUILDS: readonly CoralGuild[] = [
  "crustose-algae", "staghorn", "table", "massive-porites", "brain", "sea-fan",
];

/**
 * Where a site has got to. These are states, not a mandatory ladder: a site
 * whose substrate is reset by a lava flow returns to `pioneer` regardless of
 * what it held before.
 */
export type ReefPhase = "barren" | "pioneer" | "colonizer" | "established" | "ancient";

export interface ReefSite {
  readonly x: number;
  readonly z: number;
  /** Seabed elevation in metres, so colonies seat on the real floor. */
  readonly y: number;
  readonly depth: number;
  /** 0..1 how long this rock has been available to settle on. */
  readonly substrateAge: number;
  /** Normalized current speed at the site. */
  readonly flow: number;
  readonly shelter: number;
  /** 0..1 surface light reaching the seabed. */
  readonly light: number;
  readonly phase: ReefPhase;
  /** 0..1 fraction of the substrate under living cover. */
  readonly cover: number;
}

export interface CoralColony {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly guild: CoralGuild;
  /** Horizontal half-extent in metres. */
  readonly radius: number;
  /** Height above the seabed in metres. */
  readonly height: number;
  readonly rotation: number;
  /** Lean off vertical, in radians. */
  readonly tilt: number;
  /** 0..1 maturity within this guild. Drives the super-specimen bommies. */
  readonly age: number;
  /** 0..1. Low is bleached: tissue pales toward bare white skeleton. */
  readonly health: number;
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
  /** Local flow direction, so soft corals can be seated and swayed by it. */
  readonly flowX: number;
  readonly flowZ: number;
  readonly flowSpeed: number;
  readonly depth: number;
}

export interface ReefOutcome {
  readonly sites: readonly ReefSite[];
  readonly colonies: readonly CoralColony[];
  /** 0..1 mean living cover across all reef-capable sites. */
  readonly meanCover: number;
  readonly phaseCounts: Readonly<Record<ReefPhase, number>>;
}

/** Shallower than this the surf breaks colonies faster than they grow. */
const SURF_DEPTH = 0.85;
/** Below this depth there is not enough light for a reef-building community. */
const PHOTIC_DEPTH = 32;
/** Depth of the brightest, most productive band. */
const OPTIMUM_DEPTH = 7;
const MAX_SITES = 1500;
const MAX_COLONIES = 2600;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hash(a: number, b: number): number {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Light reaching the seabed. Coral is a light-limited animal above all else,
 * so this is a hard ceiling on cover rather than one term among many.
 */
export function benthicLight(depth: number): number {
  if (depth <= 0) return 0;
  return clamp01(Math.exp(-depth / (PHOTIC_DEPTH * 0.55)));
}

/**
 * How long this rock has been available to settle on, 0..1.
 *
 * Time since the landing began sets the ceiling; fresh basalt pulls it back
 * down, because a lava flow does not age a reef, it deletes one and hands back
 * bare rock. That is the whole reason a young volcanic island can be old in
 * years and still hold nothing but crust.
 */
export function substrateAge(totalYears: number, basalt: number): number {
  // A decade of settlement, a century of colonisation, a millennium of
  // framework, and ten of those before a site reads as ancient. Reef time is
  // logarithmic, so the decade band is as wide on this scale as the millennium.
  const elapsed = clamp01(Math.log10(Math.max(1, totalYears)) / 5);
  return clamp01(elapsed * (1 - clamp01(basalt) * 0.92));
}

/** Which phase a site's maturity puts it in. */
export function reefPhaseFor(maturity: number): ReefPhase {
  if (maturity < 0.06) return "barren";
  if (maturity < 0.2) return "pioneer";
  if (maturity < 0.44) return "colonizer";
  if (maturity < 0.76) return "established";
  return "ancient";
}

/**
 * Guild weights for one site.
 *
 * Flow is the sorting axis. Water moving over a crest delivers food and
 * carries away sediment, which is what branching and plating forms need and
 * what lets them outgrow everything else; slack sheltered water silts up and
 * leaves it to the massive domes that can shrug sediment off. Sea fans want
 * the strongest flow of all and stand across it.
 */
export function guildWeights(site: ReefSite): Readonly<Record<CoralGuild, number>> {
  const { flow, shelter, light, phase } = site;
  // Undisturbed open water is 1, so these bands are read against that: a site
  // only counts as swept once it is outrunning the open shelf.
  const exposed = clamp01((flow - 0.55) / 0.75);
  const slack = clamp01((shelter - 0.35) / 0.5);
  if (phase === "barren") {
    return { "crustose-algae": 0, staghorn: 0, table: 0, "massive-porites": 0, brain: 0, "sea-fan": 0 };
  }
  if (phase === "pioneer") {
    // Nothing but crust, whatever the water is doing.
    return { "crustose-algae": 1, staghorn: 0, table: 0, "massive-porites": 0, brain: 0, "sea-fan": 0 };
  }
  const established = phase === "established" || phase === "ancient";
  return {
    // Crust never leaves; it just stops being all there is.
    "crustose-algae": phase === "colonizer" ? 0.52 : 0.24,
    staghorn: (phase === "colonizer" ? 0.3 : 0.26) * (0.3 + exposed * 1.5),
    table: established ? 0.2 * light * (0.45 + exposed * 0.75) : 0.02,
    "massive-porites": (phase === "colonizer" ? 0.16 : 0.3) * (0.5 + slack * 0.9),
    brain: established ? 0.22 * (0.32 + slack * 1.25) : 0.03,
    "sea-fan": established ? 0.16 * clamp01((flow - 0.8) / 0.6) : 0,
  };
}

function pickGuild(weights: Readonly<Record<CoralGuild, number>>, roll: number): CoralGuild | undefined {
  let total = 0;
  for (const guild of CORAL_GUILDS) total += weights[guild];
  if (total <= 0) return undefined;
  let cursor = roll * total;
  for (const guild of CORAL_GUILDS) {
    cursor -= weights[guild];
    if (cursor <= 0) return guild;
  }
  return CORAL_GUILDS[CORAL_GUILDS.length - 1];
}

interface ColonyForm {
  readonly radius: number;
  readonly height: number;
  readonly hue: number;
  readonly saturation: number;
  readonly lightness: number;
}

/**
 * Size and colour for one colony.
 *
 * Age scales the massive forms hardest. That is the point of the ancient
 * phase: a Porites bommie metres across is centuries of accretion, and it has
 * to read as obviously older than everything around it rather than as a
 * slightly larger version of the same boulder.
 */
function colonyForm(
  guild: CoralGuild,
  age: number,
  variation: number,
  tint: number,
  site: ReefSite,
): ColonyForm {
  const spread = 0.72 + variation * 0.62;
  switch (guild) {
    case "crustose-algae":
      return {
        radius: (0.45 + variation * 0.5) * (0.7 + age * 0.5),
        height: 0.035 + variation * 0.04,
        // The pink-violet band that gives a pioneer reef its colour.
        hue: 0.92 + tint * 0.06,
        saturation: 0.3 + tint * 0.2,
        lightness: 0.44 + tint * 0.14,
      };
    case "staghorn":
      return {
        radius: (0.34 + variation * 0.42) * (0.42 + age * 1.1) * spread,
        height: (0.42 + variation * 0.5) * (0.4 + age * 1.35),
        hue: 0.09 + tint * 0.05,
        saturation: 0.32 + tint * 0.22,
        lightness: 0.44 + tint * 0.16,
      };
    case "table":
      return {
        radius: (0.62 + variation * 0.75) * (0.4 + age * 1.5),
        height: (0.22 + variation * 0.2) * (0.5 + age * 0.8),
        hue: 0.1 + tint * 0.045,
        saturation: 0.26 + tint * 0.2,
        lightness: 0.42 + tint * 0.14,
      };
    case "massive-porites": {
      // A 0.4 m nub at recruitment through to a 5 m bommie: the outer end of
      // that range is centuries of accretion and is meant to be rare.
      const radius = (0.25 + Math.pow(age, 1.45) * 2.05) * (0.8 + variation * 0.28);
      return {
        radius,
        // Hemispherical, slightly flattened. Porites domes are wider than tall.
        height: radius * (0.62 + variation * 0.22),
        hue: 0.11 + tint * 0.035,
        saturation: 0.3 + tint * 0.18,
        lightness: 0.38 + tint * 0.12,
      };
    }
    case "brain": {
      const scale = 0.35 + Math.pow(age, 1.2) * 1.5;
      return {
        radius: scale * (0.5 + variation * 0.22),
        height: scale * (0.34 + variation * 0.14),
        hue: 0.13 + tint * 0.05,
        saturation: 0.22 + tint * 0.16,
        lightness: 0.46 + tint * 0.14,
      };
    }
    case "sea-fan":
      return {
        radius: (0.5 + variation * 0.6) * (0.45 + age * 1.15),
        height: (0.7 + variation * 0.8) * (0.45 + age * 1.2),
        // Gorgonians run purple through red-orange rather than the browns of
        // the zooxanthellate stony corals around them.
        hue: 0.9 + tint * 0.12,
        saturation: 0.32 + tint * 0.22 + site.flow * 0.08,
        lightness: 0.4 + tint * 0.16,
      };
  }
}

export interface ReefOptions {
  /** Colony budget, for tests and lower render tiers. */
  readonly maxColonies?: number;
}

/**
 * Resolve every reef site and the colonies standing on it for one landing.
 *
 * Deterministic: identical snapshot, current field, and climate must give an
 * identical reef, because the landing is re-resolved whenever the player jumps
 * back to the same moment.
 */
export function resolveReef(
  snapshot: WorldSnapshot,
  current: CurrentField,
  climate?: ClimateForces,
  options: ReefOptions = {},
): ReefOutcome {
  const forces = (climate ?? snapshot.climate) as ClimateForces;
  const seaLevel = SEA_LEVEL[forces.seaLevel];
  const warmth = TEMPERATURE[forces.temperature].growth;
  // Reef building is a warm-water process. A cold epoch does not merely slow
  // it, it takes the framework builders off the table entirely.
  const thermal = clamp01((warmth - 0.62) / 0.5);
  const maxColonies = options.maxColonies ?? MAX_COLONIES;
  const sites: ReefSite[] = [];
  const colonies: CoralColony[] = [];
  const phaseCounts: Record<ReefPhase, number> = {
    barren: 0, pioneer: 0, colonizer: 0, established: 0, ancient: 0,
  };

  const reach = snapshot.extent * 0.5;
  let coverTotal = 0;
  for (let i = 0; i < MAX_SITES * 4 && sites.length < MAX_SITES; i++) {
    const angle = hash(i, 1301) * Math.PI * 2;
    const radius = Math.sqrt(hash(i, 1307)) * reach;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = snapshotHeightAt(snapshot, x, z);
    const depth = seaLevel - y;
    if (depth < SURF_DEPTH || depth > PHOTIC_DEPTH) continue;

    const flowSample = sampleCurrent(current, x, z);
    const light = benthicLight(depth);
    const basalt = snapshotBasaltAt(snapshot, x, z);
    const age = substrateAge(snapshot.totalYears, basalt);
    // River plumes are the classic reef killer: freshwater and the silt it
    // carries smother recruits and cut the light the survivors need.
    const turbidity = clamp01(snapshotRunoffAt(snapshot, x, z));
    const depthFit = clamp01(1 - Math.abs(depth - OPTIMUM_DEPTH) / (PHOTIC_DEPTH * 0.72));
    // Some water movement is required — utterly slack water silts up — but a
    // site scoured well past the open-shelf current cannot hold a framework.
    const flowFit = clamp01(1 - Math.abs(flowSample.speed - 0.85) * 0.85);
    const suitability = clamp01(
      light * (0.35 + depthFit * 0.65) * (0.45 + flowFit * 0.55) * thermal * (1 - turbidity * 0.85),
    );
    if (suitability < 0.06) continue;

    const maturity = clamp01(age * (0.42 + suitability * 0.75));
    const phase = reefPhaseFor(maturity);
    const cover = phase === "barren" ? 0 : clamp01(
      // Established reef sits in the 30-60% cover band that a healthy reef
      // actually holds; ancient sites push past it on framework alone.
      (phase === "pioneer" ? 0.1 : 0.18 + maturity * 0.55) * (0.4 + suitability * 0.75),
    );
    const site: ReefSite = {
      x, z, y, depth,
      substrateAge: age,
      flow: flowSample.speed,
      shelter: flowSample.shelter,
      light,
      phase,
      cover,
    };
    sites.push(site);
    phaseCounts[phase]++;
    coverTotal += cover;
  }

  for (let s = 0; s < sites.length && colonies.length < maxColonies; s++) {
    const site = sites[s]!;
    if (site.phase === "barren") continue;
    const weights = guildWeights(site);
    const flowSample = sampleCurrent(current, site.x, site.z);
    // Cover is a fraction of substrate, so it has to drive how many colonies
    // stand on the site rather than only how big each one is.
    const budget = Math.round(1 + site.cover * 11);
    for (let c = 0; c < budget && colonies.length < maxColonies; c++) {
      const seed = s * 31 + c;
      if (hash(seed, 1409) > 0.22 + site.cover * 1.15) continue;
      const guild = pickGuild(weights, hash(seed, 1423));
      if (!guild) continue;

      // Colonies scatter over a few metres of substrate rather than stacking
      // on the site centre, so a site reads as a patch of reef, not a bouquet.
      const spreadAngle = hash(seed, 1427) * Math.PI * 2;
      const spreadRadius = Math.sqrt(hash(seed, 1429)) * 3.4;
      const x = site.x + Math.cos(spreadAngle) * spreadRadius;
      const z = site.z + Math.sin(spreadAngle) * spreadRadius;
      const y = snapshotHeightAt(snapshot, x, z);
      const depth = seaLevel - y;
      if (depth < SURF_DEPTH * 0.7 || depth > PHOTIC_DEPTH) continue;

      // Age within the guild. The oldest specimens are rare by construction:
      // the power keeps most colonies young and lets a few run away, which is
      // what makes a metres-wide bommie read as exceptional.
      const ageRoll = hash(seed, 1433);
      const localAge = clamp01(site.substrateAge * (0.35 + Math.pow(ageRoll, 2.1) * 1.5));
      // Heat stress bleaches; depth and moving water protect. A hot epoch's
      // shallow slack reef pales while the same reef stays coloured deeper.
      const heatStress = clamp01((warmth - 1.05) / 0.22);
      const health = clamp01(
        1 - heatStress * clamp01(1 - depth / 14) * (0.75 - flowSample.speed * 0.45)
        - hash(seed, 1439) * 0.12,
      );
      const form = colonyForm(guild, localAge, hash(seed, 1447), hash(seed, 1451), site);
      colonies.push({
        x, y, z,
        guild,
        radius: form.radius,
        height: form.height,
        rotation: hash(seed, 1453) * Math.PI * 2,
        // Colonies grow off vertical on a slope, but a bommie is heavy enough
        // to sit square; the light ones lean more.
        tilt: (hash(seed, 1459) - 0.5) * (guild === "massive-porites" ? 0.12 : 0.34),
        age: localAge,
        health,
        hue: form.hue,
        saturation: form.saturation,
        lightness: form.lightness,
        flowX: flowSample.x,
        flowZ: flowSample.z,
        flowSpeed: flowSample.speed,
        depth,
      });
    }
  }

  return {
    sites,
    colonies,
    meanCover: sites.length === 0 ? 0 : coverTotal / sites.length,
    phaseCounts,
  };
}
