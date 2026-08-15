import { describe, expect, it } from "vitest";
import {
  createWorldHistory,
  validateWorldHistory,
  withRecordedSeaLevel,
  WORLD_HISTORY_VERSION,
} from "./world-history";
import { advanceArchipelago, hotspotCrustPosition, shieldDistanceFromHotspot } from "./archipelago-history";
import { DEFAULT_CLIMATE, SEA_LEVEL } from "./climate";

function validHistory() {
  return createWorldHistory(new Float32Array(9), 3, 300);
}

describe("world history validation", () => {
  it("accepts a world with terrestrial dispersal still gated", () => {
    const history = createWorldHistory(new Float32Array(4), 2, 10, false);
    expect(history.lineages.lineages).toEqual([]);
    expect(() => validateWorldHistory(history)).not.toThrow();
  });

  it("accepts the current schema", () => {
    expect(() => validateWorldHistory(validHistory())).not.toThrow();
  });

  it("rejects invalid persistent marine condition", () => {
    const history = validHistory();
    expect(() => validateWorldHistory({
      ...history,
      marineLineages: { lineages: [{ ...history.marineLineages.lineages[0], energy: 2 }] },
    })).toThrow("world history marine lineages[0].energy must be within [0, 1]");
  });

  it("rejects invalid persistent reef condition", () => {
    const history = validHistory();
    expect(() => validateWorldHistory({
      ...history,
      reef: { sites: [{ id: "reef:0", x: 0, z: 0, livingCover: 2, framework: 0, deadFramework: 0, pioneerCover: 0, stress: 0, composition: {} }] },
    })).toThrow("world history reef.sites[0].livingCover must be finite and within [0, 1]");
  });

  it("requires cross-domain marine ancestry to reference retained terrestrial history", () => {
    const history = validHistory();
    expect(() => validateWorldHistory({
      ...history,
      marineLineages: { lineages: [{
        ...history.marineLineages.lineages[0],
        originDomain: "terrestrial-transition",
        ancestorLineageId: "missing-grazer:0",
      }] },
    })).toThrow("ancestorLineageId references missing terrestrial lineage");
  });

  it("rejects state from another schema version", () => {
    expect(() => validateWorldHistory({ ...validHistory(), version: 0 }))
      .toThrow(`world history version must be ${WORLD_HISTORY_VERSION}, received 0`);
  });

  it("rejects terrain arrays that do not match the declared grid", () => {
    const history = validHistory();
    expect(() => validateWorldHistory({
      ...history,
      terrain: { ...history.terrain, disturbance: new Float32Array(8) },
    })).toThrow("world history terrain.disturbance length must be 9, received 8");
  });

  it("rejects duplicate lineage IDs", () => {
    const history = validHistory();
    expect(() => validateWorldHistory({
      ...history,
      lineages: { lineages: [history.lineages.lineages[0], history.lineages.lineages[0]] },
    })).toThrow("world history lineages[1].id duplicates sheltered-grazer:0");
  });

  it("rejects ancestry pointing outside the retained history", () => {
    const history = validHistory();
    expect(() => validateWorldHistory({
      ...history,
      lineages: {
        lineages: [{ ...history.lineages.lineages[0], parentId: "missing:0", generation: 1 }],
      },
    })).toThrow("world history lineages[0].parentId references missing missing:0");
  });

  it("rejects lineage archetypes missing from the descriptor registry", () => {
    const history = validHistory();
    expect(() => validateWorldHistory({
      ...history,
      lineages: {
        lineages: [{ ...history.lineages.lineages[0], identity: "unknown-grazer" }],
      },
    })).toThrow("world history lineages[0].identity is not recognized");
  });
});

describe("shield zero", () => {
  it("seats the authored vent as shield zero at full construction", () => {
    const history = createWorldHistory(new Float32Array(9), 3, 300, false, { x: -16, z: 8 });

    expect(history.archipelago.shields).toHaveLength(1);
    const [shield] = history.archipelago.shields;
    expect(shield!.id).toBe("shield-0");
    expect(shield!.crustX).toBe(-16);
    expect(shield!.crustZ).toBe(8);
    // The preset already drew this edifice into the heightfield, so recording
    // it as unbuilt would have the next jump grow land the player can see.
    expect(shield!.construction).toBe(1);
    expect(shield!.birthYear).toBe(0);
    expect(history.archipelago.nextShieldSerial).toBe(1);
  });

  it("places the hotspot on the starting island, so the chain grows from it", () => {
    const history = createWorldHistory(new Float32Array(9), 3, 300, false, { x: -16, z: 8 });

    expect(hotspotCrustPosition(history.archipelago)).toEqual({ x: -16, z: 8 });
    expect(shieldDistanceFromHotspot(history.archipelago, history.archipelago.shields[0]!)).toBe(0);
  });

  it("gives a ventless preset an empty archipelago rather than no archipelago", () => {
    const history = createWorldHistory(new Float32Array(9), 3, 300, false);

    expect(history.archipelago.shields).toEqual([]);
    expect(history.archipelago.nextShieldSerial).toBe(0);
    expect(() => validateWorldHistory(history)).not.toThrow();
  });

  it("holds the hotspot until the crust has carried shield zero a full spacing", () => {
    const seeded = createWorldHistory(new Float32Array(9), 3, 300, false, { x: 0, z: 0 }).archipelago;

    // A thousand years is tectonically silent, so no second vent may appear.
    expect(advanceArchipelago(seeded, 1000, 0).shields).toHaveLength(1);
    // A million years carries the crust just past one spacing, which is the
    // rate DEFAULT_DRIFT_RATE was chosen to produce: exactly one new shield.
    expect(advanceArchipelago(seeded, 1_000_000, 0).shields).toHaveLength(2);
  });

  it("keeps a seeded world valid after a jump", () => {
    const history = createWorldHistory(new Float32Array(9), 3, 300, false, { x: -16, z: 8 });
    const advanced = withRecordedSeaLevel(
      { ...history, archipelago: advanceArchipelago(history.archipelago, 1_000_000, 0) },
      0,
      1_000_000,
      DEFAULT_CLIMATE,
    );

    expect(() => validateWorldHistory(advanced)).not.toThrow();
    expect(advanced.seaLevelHistory.samples).toEqual([
      { startYears: 0, endYears: 1_000_000, seaLevel: SEA_LEVEL[DEFAULT_CLIMATE.seaLevel] },
    ]);
  });

  it("rejects an archipelago or sea-level record that does not validate", () => {
    const history = validHistory();
    expect(() => validateWorldHistory({
      ...history,
      archipelago: { ...history.archipelago, driftX: 4, driftZ: 0 },
    })).toThrow(/unit vector/);
    expect(() => validateWorldHistory({
      ...history,
      seaLevelHistory: { version: 1, samples: [{ startYears: 10, endYears: 5, seaLevel: 0 }] },
    })).toThrow(/positive span/);
  });
});
