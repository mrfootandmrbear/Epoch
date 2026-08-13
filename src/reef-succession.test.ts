import { describe, expect, it } from "vitest";
import {
  benthicLight,
  guildWeights,
  reefPhaseFor,
  resolveReef,
  substrateAge,
  type CoralGuild,
  type ReefSite,
} from "./reef-succession";
import { buildCurrentField } from "./ocean-currents";
import type { WorldSnapshot } from "./world-snapshot";
import type { ClimateForces } from "./climate";

const CLIMATE: ClimateForces = {
  rainfall: "temperate", temperature: "warm", wind: "westerly", seaLevel: "present",
};

const SIDE = 65;
const EXTENT = 320;

/**
 * A small island ringed by a broad shallow shelf that shoals to a crest and
 * then drops away. This is the shape a fringing reef actually occupies, and it
 * gives the current field both a scoured crest and a sheltered lagoon.
 */
function reefSnapshot(options: { basalt?: number; totalYears?: number } = {}): WorldSnapshot {
  const half = (SIDE - 1) / 2;
  const elevations = new Float32Array(SIDE * SIDE);
  const basalt = new Float32Array(SIDE * SIDE).fill(options.basalt ?? 0);
  for (let z = 0; z < SIDE; z++) {
    for (let x = 0; x < SIDE; x++) {
      const d = Math.hypot(x - half, z - half) / half;
      // Peak inland, a lagoon, a shallow crest, then the drop-off.
      const island = 26 * Math.max(0, 1 - d * 4.2);
      const lagoon = -9 * Math.exp(-Math.pow((d - 0.33) / 0.1, 2));
      const crest = 6.4 * Math.exp(-Math.pow((d - 0.46) / 0.07, 2));
      elevations[z * SIDE + x] = island + lagoon + crest - 6 - Math.max(0, d - 0.5) * 40;
    }
  }
  return {
    gridSize: SIDE,
    extent: EXTENT,
    elevations,
    basalt,
    runoff: new Float32Array(SIDE * SIDE),
    climate: CLIMATE,
    totalYears: options.totalYears ?? 4000,
  };
}

function reefFor(options: Parameters<typeof reefSnapshot>[0] = {}, climate = CLIMATE) {
  const snapshot = reefSnapshot(options);
  const current = buildCurrentField(snapshot, climate);
  return resolveReef(snapshot, current, climate);
}

function guildShare(colonies: readonly { guild: CoralGuild }[], guilds: readonly CoralGuild[]): number {
  if (colonies.length === 0) return 0;
  return colonies.filter((colony) => guilds.includes(colony.guild)).length / colonies.length;
}

describe("benthic light", () => {
  it("falls off with depth and reaches nothing below the photic zone", () => {
    expect(benthicLight(0)).toBe(0);
    expect(benthicLight(3)).toBeGreaterThan(benthicLight(12));
    expect(benthicLight(12)).toBeGreaterThan(benthicLight(30));
    expect(benthicLight(60)).toBeLessThan(0.05);
  });
});

describe("substrate age", () => {
  it("accumulates with elapsed time", () => {
    expect(substrateAge(10, 0)).toBeLessThan(substrateAge(1000, 0));
    expect(substrateAge(1000, 0)).toBeLessThan(substrateAge(100000, 0));
  });

  it("is reset by fresh lava however long the epoch ran", () => {
    // A flow does not age a reef, it deletes one and hands back bare rock.
    expect(substrateAge(100000, 1)).toBeLessThan(substrateAge(50, 0) + 0.1);
    expect(substrateAge(100000, 1)).toBeLessThan(0.1);
  });
});

describe("reef phases", () => {
  it("orders barren through ancient by maturity", () => {
    expect(reefPhaseFor(0)).toBe("barren");
    expect(reefPhaseFor(0.1)).toBe("pioneer");
    expect(reefPhaseFor(0.3)).toBe("colonizer");
    expect(reefPhaseFor(0.6)).toBe("established");
    expect(reefPhaseFor(0.95)).toBe("ancient");
  });
});

describe("guild weights", () => {
  const site = (overrides: Partial<ReefSite>): ReefSite => ({
    id: "0:0", x: 0, z: 0, y: -6, depth: 6,
    substrateAge: 0.9, flow: 0.5, shelter: 0.4, light: 0.6,
    phase: "established", cover: 0.5, framework: 0.4, deadFramework: 0,
    stress: 0, connectivity: 1,
    ...overrides,
  });

  it("gives a pioneer site nothing but crustose algae", () => {
    const weights = guildWeights(site({ phase: "pioneer" }));
    expect(weights["crustose-algae"]).toBeGreaterThan(0);
    for (const guild of ["staghorn", "table", "massive-porites", "brain", "sea-fan"] as const) {
      expect(weights[guild]).toBe(0);
    }
  });

  it("favours branching and fans where the water moves", () => {
    const swept = guildWeights(site({ flow: 0.85, shelter: 0.12 }));
    const slack = guildWeights(site({ flow: 0.08, shelter: 0.92 }));
    expect(swept.staghorn).toBeGreaterThan(slack.staghorn);
    expect(swept["sea-fan"]).toBeGreaterThan(slack["sea-fan"]);
  });

  it("favours massive and brain forms in sheltered water", () => {
    const swept = guildWeights(site({ flow: 0.85, shelter: 0.12 }));
    const slack = guildWeights(site({ flow: 0.08, shelter: 0.92 }));
    expect(slack["massive-porites"]).toBeGreaterThan(swept["massive-porites"]);
    expect(slack.brain).toBeGreaterThan(swept.brain);
  });
});

describe("reef succession", () => {
  it("is deterministic for an identical world", () => {
    const first = reefFor();
    const second = reefFor();
    expect(second.colonies.length).toBe(first.colonies.length);
    expect(second.colonies[10]).toEqual(first.colonies[10]);
    expect(second.meanCover).toBe(first.meanCover);
  });

  it("builds a populated reef on old substrate", () => {
    const reef = reefFor();
    expect(reef.sites.length).toBeGreaterThan(50);
    expect(reef.colonies.length).toBeGreaterThan(200);
    expect(reef.meanCover).toBeGreaterThan(0.1);
  });

  it("seats every colony underwater and within the photic zone", () => {
    const reef = reefFor();
    for (const colony of reef.colonies) {
      expect(colony.y).toBeLessThan(0);
      expect(colony.depth).toBeGreaterThan(0);
      expect(colony.depth).toBeLessThanOrEqual(32);
    }
  });

  it("holds a young reef at crust and nubs, and an old one at bommies", () => {
    const young = reefFor({ totalYears: 8 });
    const old = reefFor({ totalYears: 400000 });

    // A young reef is pioneers: crust, and no ancient framework at all.
    expect(young.phaseCounts.ancient).toBe(0);
    expect(guildShare(young.colonies, ["crustose-algae"])).toBeGreaterThan(0.7);

    expect(old.phaseCounts.ancient).toBeGreaterThan(0);
    expect(guildShare(old.colonies, ["crustose-algae"]))
      .toBeLessThan(guildShare(young.colonies, ["crustose-algae"]));
    expect(old.meanCover).toBeGreaterThan(young.meanCover);
  });

  it("grows super-specimen bommies only where substrate is ancient", () => {
    const old = reefFor({ totalYears: 400000 });
    const bommies = old.colonies.filter(
      (colony) => colony.guild === "massive-porites" && colony.radius * 2 >= 2,
    );
    expect(bommies.length).toBeGreaterThan(0);
    // Centuries-old Porites run 2-5 m across and dominate what is around them.
    const widest = Math.max(...bommies.map((colony) => colony.radius * 2));
    expect(widest).toBeGreaterThan(2);
    expect(widest).toBeLessThan(5.1);
    // Rare, not the norm: a reef of uniform giants reads as scenery.
    expect(bommies.length).toBeLessThan(old.colonies.length * 0.25);

    const young = reefFor({ totalYears: 8 });
    expect(young.colonies.some((colony) => colony.radius * 2 >= 2)).toBe(false);
  });

  it("returns bare rock to pioneers after a lava flow, however old the epoch", () => {
    const buried = reefFor({ totalYears: 400000, basalt: 1 });
    expect(buried.phaseCounts.ancient).toBe(0);
    expect(buried.phaseCounts.established).toBe(0);
    expect(guildShare(buried.colonies, ["crustose-algae"])).toBe(1);
  });

  it("sorts growth form by the flow the site actually sits in", () => {
    const reef = reefFor({ totalYears: 400000 });
    // Split at the reef's own median flow rather than an absolute speed: what
    // matters is that the faster half of a given reef sorts differently from
    // the slower half, whatever absolute speeds that reef happens to span.
    const speeds = reef.colonies.map((colony) => colony.flowSpeed).sort((a, b) => a - b);
    const median = speeds[Math.floor(speeds.length / 2)]!;
    const swept = reef.colonies.filter((colony) => colony.flowSpeed > median);
    const slack = reef.colonies.filter((colony) => colony.flowSpeed <= median);
    expect(swept.length).toBeGreaterThan(20);
    expect(slack.length).toBeGreaterThan(20);

    expect(guildShare(swept, ["staghorn", "sea-fan"]))
      .toBeGreaterThan(guildShare(slack, ["staghorn", "sea-fan"]));
    expect(guildShare(slack, ["massive-porites", "brain"]))
      .toBeGreaterThan(guildShare(swept, ["massive-porites", "brain"]));
  });

  it("keeps a cold epoch from building reef", () => {
    const cold = reefFor({ totalYears: 400000 }, { ...CLIMATE, temperature: "cold" });
    const warm = reefFor({ totalYears: 400000 });
    expect(cold.colonies.length).toBeLessThan(warm.colonies.length * 0.25);
  });

  it("carries a local flow vector on every colony for sway", () => {
    const reef = reefFor();
    const moving = reef.colonies.filter((colony) => Math.hypot(colony.flowX, colony.flowZ) > 0);
    expect(moving.length).toBeGreaterThan(reef.colonies.length * 0.5);
  });

  it("respects a colony budget", () => {
    const snapshot = reefSnapshot();
    const current = buildCurrentField(snapshot, CLIMATE);
    const capped = resolveReef(snapshot, current, CLIMATE, { maxColonies: 40 });
    expect(capped.colonies.length).toBeLessThanOrEqual(40);
  });

  it("persists framework and recruits connected pioneers before mature coral", () => {
    const snapshot = reefSnapshot({ totalYears: 1000 });
    const current = buildCurrentField(snapshot, CLIMATE);
    const first = resolveReef(snapshot, current, CLIMATE, { previousHistory: { sites: [] }, jumpYears: 25 });
    const second = resolveReef(snapshot, current, CLIMATE, { previousHistory: first.history, jumpYears: 1000 });
    expect(first.history.sites.some((site) => site.pioneerCover > 0)).toBe(true);
    expect(second.meanCover).toBeGreaterThan(first.meanCover);
    expect(second.history.sites.reduce((sum, site) => sum + site.framework, 0))
      .toBeGreaterThan(first.history.sites.reduce((sum, site) => sum + site.framework, 0));
  });

  it("retains dead framework after disturbance and can recover from survivors", () => {
    const snapshot = reefSnapshot({ totalYears: 100000 });
    const current = buildCurrentField(snapshot, CLIMATE);
    const established = resolveReef(snapshot, current, CLIMATE);
    const damaged = resolveReef(snapshot, current, CLIMATE, {
      previousHistory: established.history, jumpYears: 100, disturbance: 0.9,
    });
    const recovered = resolveReef(snapshot, current, CLIMATE, {
      previousHistory: damaged.history, jumpYears: 1000, disturbance: 0,
    });
    expect(damaged.history.sites.some((site) => site.deadFramework > 0)).toBe(true);
    expect(damaged.meanCover).toBeLessThan(established.meanCover);
    expect(recovered.meanCover).toBeGreaterThan(damaged.meanCover);
  });
});
