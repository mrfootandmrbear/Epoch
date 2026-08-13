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
  readonly id: string;
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
  /** Carbonate structure retained even when living tissue dies. */
  readonly framework: number;
  /** Recently dead structure still available as habitat and settlement surface. */
  readonly deadFramework: number;
  readonly stress: number;
  readonly connectivity: number;
}

export interface ReefSiteState {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly livingCover: number;
  readonly framework: number;
  readonly deadFramework: number;
  readonly pioneerCover: number;
  readonly stress: number;
  readonly composition: Readonly<Record<CoralGuild, number>>;
}

export interface ReefHistory {
  readonly sites: readonly ReefSiteState[];
}

export function createReefHistory(): ReefHistory {
  return { sites: [] };
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
  readonly history: ReefHistory;
  /** Coarse ecological effects consumed by marine populations, never meshes. */
  readonly habitat: Readonly<{ shelter: number; productivity: number }>;
}

/** Shallower than this the surf breaks colonies faster than they grow. */
const SURF_DEPTH = 0.85;
/** Below this depth there is not enough light for a reef-building community. */
const PHOTIC_DEPTH = 32;
/** Depth of the brightest, most productive band. */
const OPTIMUM_DEPTH = 7;
const MAX_SITES = 2600;
/**
 * A healthy reef holds 30-60% living cover. Spread thinly over a shelf this
 * wide, a few thousand colonies reads as scattered stones on bare sand rather
 * than as reef, so the budget is set by what cover has to look like at close
 * range. Instancing means the cost of this is instance count, not draw count.
 */
export const MAX_REEF_COLONIES = 9000;

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
 *
 * Colour is chosen to survive the water rather than to look right on a swatch.
 * Seawater strips red first, so a colony authored at the muted tan it actually
 * reflects in air arrives at the eye as grey stone. These run saturated and a
 * shade darker than the sand they stand on, which is what leaves them still
 * reading as living tissue after several metres of absorption.
 */
function colonyForm(
  guild: CoralGuild,
  age: number,
  variation: number,
  tint: number,
  site: ReefSite,
  morph = 0,
): ColonyForm {
  const spread = 0.72 + variation * 0.62;
  const base = warmColonyForm(guild, age, variation, tint, site, spread);
  // Crust and gorgonians already own the cool end of the reef's palette; a
  // morph would only take their identity away.
  const takesMorph = guild !== "crustose-algae" && guild !== "sea-fan";
  if (!takesMorph || morph < COOL_MORPH_SHARE) return base;
  // A minority pigment morph. Zooxanthellate corals of one species come in
  // strikingly different colours, and the cool morphs matter here beyond
  // accuracy: every warm hue converges on the same olive once the water has
  // taken its red, so a reef authored entirely in golds and tans arrives
  // monochrome however much its saturation is raised. The cool morphs are what
  // survive the water still looking like different animals.
  const cool = (morph - COOL_MORPH_SHARE) / (1 - COOL_MORPH_SHARE);
  return {
    ...base,
    hue: COOL_MORPH_HUE.start + cool * COOL_MORPH_HUE.span,
    // Held well below the warm morphs' saturation. Blue survives the water
    // almost intact, so a cool morph authored as boldly as a gold one arrives
    // at full strength and reads as painted plastic rather than as tissue.
    saturation: Math.min(0.66, base.saturation * 0.8 + 0.04),
    lightness: base.lightness + 0.04,
  };
}

/** Fraction of colonies keeping the ordinary warm pigment. */
const COOL_MORPH_SHARE = 0.74;
/** Teal through violet: the band the cool morphs draw from. */
const COOL_MORPH_HUE = Object.freeze({ start: 0.45, span: 0.33 });

function warmColonyForm(
  guild: CoralGuild,
  age: number,
  variation: number,
  tint: number,
  site: ReefSite,
  spread: number,
): ColonyForm {
  switch (guild) {
    case "crustose-algae":
      return {
        radius: (0.45 + variation * 0.5) * (0.7 + age * 0.5),
        height: 0.035 + variation * 0.04,
        // The pink-violet band that gives a pioneer reef its colour.
        hue: 0.9 + tint * 0.08,
        saturation: 0.52 + tint * 0.26,
        lightness: 0.36 + tint * 0.12,
      };
    case "staghorn":
      return {
        // A thicket stands taller than the boulders around it. Undersized, the
        // branching reads as debris on top of a field of domes rather than as
        // the structure that gives a swept reef its silhouette.
        radius: (0.42 + variation * 0.5) * (0.5 + age * 1.25) * spread,
        height: (0.62 + variation * 0.7) * (0.5 + age * 1.6),
        hue: 0.07 + tint * 0.06,
        saturation: 0.5 + tint * 0.28,
        lightness: 0.33 + tint * 0.14,
      };
    case "table":
      return {
        radius: (0.62 + variation * 0.75) * (0.4 + age * 1.5),
        height: (0.22 + variation * 0.2) * (0.5 + age * 0.8),
        hue: 0.09 + tint * 0.05,
        saturation: 0.46 + tint * 0.26,
        lightness: 0.31 + tint * 0.13,
      };
    case "massive-porites": {
      // A 0.4 m nub at recruitment through to a 5 m bommie: the outer end of
      // that range is centuries of accretion and is meant to be rare.
      const radius = (0.25 + Math.pow(age, 1.45) * 2.05) * (0.8 + variation * 0.28);
      return {
        radius,
        // Hemispherical, slightly flattened. Porites domes are wider than tall.
        height: radius * (0.62 + variation * 0.22),
        // Gold through mustard: the colour a Porites dome actually holds.
        hue: 0.1 + tint * 0.05,
        saturation: 0.58 + tint * 0.24,
        lightness: 0.29 + tint * 0.12,
      };
    }
    case "brain": {
      const scale = 0.35 + Math.pow(age, 1.2) * 1.5;
      return {
        radius: scale * (0.5 + variation * 0.22),
        height: scale * (0.34 + variation * 0.14),
        hue: 0.12 + tint * 0.07,
        saturation: 0.44 + tint * 0.26,
        lightness: 0.33 + tint * 0.13,
      };
    }
    case "sea-fan":
      return {
        radius: (0.5 + variation * 0.6) * (0.45 + age * 1.15),
        height: (0.7 + variation * 0.8) * (0.45 + age * 1.2),
        // Gorgonians run purple through red-orange rather than the browns of
        // the zooxanthellate stony corals around them.
        hue: 0.86 + tint * 0.16,
        saturation: 0.55 + tint * 0.28 + site.flow * 0.06,
        lightness: 0.34 + tint * 0.15,
      };
  }
}

export interface ReefOptions {
  /** Colony budget, for tests and lower render tiers. */
  readonly maxColonies?: number;
  readonly previousHistory?: ReefHistory;
  readonly jumpYears?: number;
  /** 0..1 bounded storm or burial disturbance for causal-history tests. */
  readonly disturbance?: number;
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
  const maxColonies = options.maxColonies ?? MAX_REEF_COLONIES;
  const legacyLanding = options.previousHistory === undefined;
  const previous = new Map((options.previousHistory?.sites ?? []).map((site) => [site.id, site]));
  const duration = clamp01(Math.log10(Math.max(1, options.jumpYears ?? snapshot.totalYears)) / 6);
  const disturbance = clamp01(options.disturbance ?? 0);
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

    // Candidate index is deterministic and unique even when two samples land
    // in the same half-metre cell; quantized coordinates are not.
    const id = `sample:${i}`;
    const inherited = previous.get(id);
    const edgeRecruitment = clamp01((radius - reach * 0.58) / (reach * 0.28));
    let neighbourSignal = 0;
    if (!inherited && previous.size > 0) {
      for (const candidate of previous.values()) {
        const distance = Math.hypot(candidate.x - x, candidate.z - z);
        if (distance < 28) neighbourSignal = Math.max(neighbourSignal, candidate.livingCover * (1 - distance / 28));
      }
    }
    // The island receives a bounded larval rain from the surrounding ocean;
    // inherited mature sites then strengthen local recruitment.
    const oceanRecruitment = previous.size === 0 ? 0.3 : 0.08;
    const connectivity = clamp01(oceanRecruitment + edgeRecruitment * 0.45 + neighbourSignal * 1.4);
    const heatStress = clamp01((warmth - 1.05) / 0.22) * clamp01(1 - depth / 16);
    const acuteStress = clamp01(heatStress + disturbance);
    const priorLiving = inherited?.livingCover ?? 0;
    const priorFramework = inherited?.framework ?? 0;
    const survivors = priorLiving * (1 - acuteStress * (0.45 + duration * 0.45));
    const recruitment = connectivity * suitability * duration * (0.18 + (inherited?.pioneerCover ?? 0) * 0.45);
    const pioneerCover = clamp01((inherited?.pioneerCover ?? 0) * (1 - duration * 0.18) + recruitment * 0.72);
    const directMaturity = clamp01(age * (0.42 + suitability * 0.75));
    const directPhase = reefPhaseFor(directMaturity);
    const directCover = directPhase === "barren" ? 0 : clamp01(
      (directPhase === "pioneer" ? 0.1 : 0.18 + directMaturity * 0.55) * (0.4 + suitability * 0.75),
    );
    const livingCover = legacyLanding
      ? directCover
      : clamp01(survivors + recruitment + pioneerCover * suitability * duration * 0.42
        + (inherited ? 0 : directCover * duration * duration * connectivity));
    const mortality = Math.max(0, priorLiving - survivors);
    const framework = clamp01(priorFramework * (1 - duration * 0.018) + livingCover * duration * 0.17 + mortality * 0.5);
    const deadFramework = clamp01((inherited?.deadFramework ?? 0) * (1 - duration * 0.08) + mortality + disturbance * priorFramework * 0.32);
    const maturity = legacyLanding
      ? directMaturity
      : clamp01(Math.max(age * 0.18, pioneerCover * 0.36 + livingCover * 0.64 + framework * 0.72));
    const phase = reefPhaseFor(maturity);
    const cover = livingCover;
    const site: ReefSite = {
      id, x, z, y, depth,
      substrateAge: age,
      flow: flowSample.speed,
      shelter: flowSample.shelter,
      light,
      phase,
      cover,
      framework,
      deadFramework,
      stress: acuteStress,
      connectivity,
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
    const budget = Math.round(1 + site.cover * 22);
    for (let c = 0; c < budget && colonies.length < maxColonies; c++) {
      const seed = s * 31 + c;
      if (hash(seed, 1409) > 0.22 + site.cover * 1.15) continue;
      const guild = pickGuild(weights, hash(seed, 1423));
      if (!guild) continue;

      // Colonies scatter over a couple of metres of substrate rather than
      // stacking on the site centre, so a site reads as a patch of reef and
      // not a bouquet. Kept tight on purpose: reef grows in thickets with bare
      // substrate between them, and scattering colonies evenly across the
      // shelf would read as gravel however many of them there were.
      const spreadAngle = hash(seed, 1427) * Math.PI * 2;
      const spreadRadius = Math.sqrt(hash(seed, 1429)) * 2.3;
      const x = site.x + Math.cos(spreadAngle) * spreadRadius;
      const z = site.z + Math.sin(spreadAngle) * spreadRadius;
      const y = snapshotHeightAt(snapshot, x, z);
      const depth = seaLevel - y;
      if (depth < SURF_DEPTH * 0.7 || depth > PHOTIC_DEPTH) continue;

      // Age within the guild. The oldest specimens are rare by construction:
      // the power keeps most colonies young and lets a few run away, which is
      // what makes a metres-wide bommie read as exceptional.
      const ageRoll = hash(seed, 1433);
      // Weighted hard toward the young. A reef is mostly recruits and small
      // colonies with a few old ones standing over them; drawn from a narrow
      // band instead, every colony comes out the same size and the reef reads
      // as a field of uniform boulders rather than as living cover.
      const localAge = clamp01(site.substrateAge * (0.2 + Math.pow(ageRoll, 2.2) * 1.6));
      // Heat stress bleaches; depth and moving water protect. A hot epoch's
      // shallow slack reef pales while the same reef stays coloured deeper.
      const heatStress = clamp01((warmth - 1.05) / 0.22);
      const health = clamp01(
        1 - (heatStress + site.stress * 0.7) * clamp01(1 - depth / 14) * (0.75 - flowSample.speed * 0.45)
        - hash(seed, 1439) * 0.12,
      );
      const form = colonyForm(
        guild, localAge, hash(seed, 1447), hash(seed, 1451), site, hash(seed, 1487),
      );
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

  const history: ReefHistory = {
    sites: sites.map((site) => {
      const weights = guildWeights(site);
      const total = CORAL_GUILDS.reduce((sum, guild) => sum + weights[guild], 0) || 1;
      return {
        id: site.id, x: site.x, z: site.z,
        livingCover: site.cover,
        framework: site.framework,
        deadFramework: site.deadFramework,
        pioneerCover: site.phase === "pioneer" ? site.cover : Math.min(site.cover, 0.18),
        stress: site.stress,
        composition: Object.fromEntries(CORAL_GUILDS.map((guild) => [guild, weights[guild] / total])) as Record<CoralGuild, number>,
      };
    }),
  };
  const meanFramework = sites.reduce((sum, site) => sum + site.framework + site.deadFramework * 0.7, 0) / Math.max(1, sites.length);
  return {
    sites,
    colonies,
    meanCover: sites.length === 0 ? 0 : coverTotal / sites.length,
    phaseCounts,
    history,
    habitat: {
      shelter: clamp01(meanFramework * 1.6),
      productivity: clamp01((sites.length === 0 ? 0 : coverTotal / sites.length) * 1.35 + meanFramework * 0.35),
    },
  };
}
