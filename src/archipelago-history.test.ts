import { describe, expect, it } from "vitest";
import {
  advanceArchipelago,
  createArchipelagoHistory,
  hotspotCrustPosition,
  hotspotInfluence,
  shieldDistanceFromHotspot,
  shieldMantlePosition,
  shieldStage,
  shieldVolcanicOutput,
  validateArchipelagoHistory,
  DEFAULT_DRIFT_RATE,
  FULL_CONSTRUCTION_YEARS,
  HOTSPOT_REACH,
  SHIELD_SPACING,
  SHIELD_STAGES,
  type ArchipelagoHistory,
} from "./archipelago-history";

/** Years of drift needed to travel a given distance at the default rate. */
function yearsFor(distanceMeters: number): number {
  return distanceMeters / DEFAULT_DRIFT_RATE;
}

/** Advance a fresh world far enough to hold exactly one shield. */
function worldWithOneShield(): ArchipelagoHistory {
  const history = advanceArchipelago(createArchipelagoHistory(), 1, 0);
  expect(history.shields).toHaveLength(1);
  return history;
}

describe("archipelago reference frames", () => {
  it("keeps the hotspot fixed in mantle space no matter how far the crust travels", () => {
    let history = createArchipelagoHistory({ hotspotX: 12, hotspotZ: -30 });
    for (let jump = 0; jump < 4; jump++) history = advanceArchipelago(history, 100_000, jump * 100_000);
    expect(history.hotspotX).toBe(12);
    expect(history.hotspotZ).toBe(-30);
  });

  it("walks the hotspot backwards through the crust frame as the crust advances", () => {
    const history = createArchipelagoHistory({ driftX: 1, driftZ: 0 });
    const advanced = advanceArchipelago(history, yearsFor(50), 0);
    expect(hotspotCrustPosition(advanced).x).toBeCloseTo(-50, 6);
    expect(hotspotCrustPosition(advanced).z).toBeCloseTo(0, 6);
  });

  it("never moves a shield within the crust frame, because the shield rides the plate", () => {
    const born = worldWithOneShield();
    const origin = born.shields[0]!;
    const later = advanceArchipelago(born, 500_000, 1);
    const same = later.shields.find((shield) => shield.id === origin.id)!;
    expect(same.crustX).toBe(origin.crustX);
    expect(same.crustZ).toBe(origin.crustZ);
  });

  it("carries a shield across mantle space by exactly the crust travel", () => {
    const born = worldWithOneShield();
    const before = shieldMantlePosition(born, born.shields[0]!);
    const later = advanceArchipelago(born, yearsFor(80), 1);
    const after = shieldMantlePosition(later, later.shields.find((s) => s.id === born.shields[0]!.id)!);
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeCloseTo(80, 4);
  });

  it("measures the same shield-to-hotspot distance in either frame", () => {
    const born = worldWithOneShield();
    const shield0 = born.shields[0]!;
    const later = advanceArchipelago(born, yearsFor(40), 1);
    const shield = later.shields.find((s) => s.id === shield0.id)!;
    const mantle = shieldMantlePosition(later, shield);
    const crustFrame = shieldDistanceFromHotspot(later, shield);
    const mantleFrame = Math.hypot(mantle.x - later.hotspotX, mantle.z - later.hotspotZ);
    expect(crustFrame).toBeCloseTo(mantleFrame, 6);
    // Measured as a delta: the seeding jump already drifted the crust slightly,
    // so the shield does not start exactly beneath the hotspot.
    expect(crustFrame - shieldDistanceFromHotspot(born, shield0)).toBeCloseTo(40, 6);
  });

  it("normalizes an arbitrary drift direction to a unit vector", () => {
    const history = createArchipelagoHistory({ driftX: 3, driftZ: 4 });
    expect(Math.hypot(history.driftX, history.driftZ)).toBeCloseTo(1, 12);
    expect(history.driftX).toBeCloseTo(0.6, 12);
  });

  it("rejects a degenerate drift direction", () => {
    expect(() => createArchipelagoHistory({ driftX: 0, driftZ: 0 })).toThrow(RangeError);
  });
});

describe("shield birth along the chain", () => {
  it("erupts the first shield at the hotspot in a fresh world", () => {
    const history = worldWithOneShield();
    const shield = history.shields[0]!;
    expect(shield.crustX).toBeCloseTo(0, 6);
    expect(shield.crustZ).toBeCloseTo(0, 6);
    expect(shieldDistanceFromHotspot(history, shield)).toBeLessThan(1);
  });

  it("does not erupt a second shield until the hotspot has cleared a full spacing", () => {
    const born = worldWithOneShield();
    const short = advanceArchipelago(born, yearsFor(SHIELD_SPACING * 0.8), 1);
    expect(short.shields).toHaveLength(1);
    const long = advanceArchipelago(born, yearsFor(SHIELD_SPACING * 1.2), 1);
    expect(long.shields).toHaveLength(2);
  });

  it("lays a long jump's shields out along the drift axis instead of stacking them", () => {
    const born = worldWithOneShield();
    // Three further spacings of travel, expressed in spacings rather than years
    // so retuning the drift rate cannot silently weaken this test.
    const aged = advanceArchipelago(born, yearsFor(SHIELD_SPACING * 3.2), 1);
    expect(aged.shields).toHaveLength(4);
    const ordered = [...aged.shields].sort((a, b) => a.birthYear - b.birthYear);
    for (let index = 1; index < ordered.length; index++) {
      const previous = ordered[index - 1]!;
      const current = ordered[index]!;
      const gap = Math.hypot(current.crustX - previous.crustX, current.crustZ - previous.crustZ);
      expect(gap).toBeCloseTo(SHIELD_SPACING, 4);
      // Younger shields sit further along -drift in the crust frame.
      expect(current.crustX).toBeLessThan(previous.crustX);
    }
  });

  it("orders the chain so older shields are further from the hotspot", () => {
    const aged = advanceArchipelago(worldWithOneShield(), yearsFor(SHIELD_SPACING * 3.2), 1);
    const ordered = [...aged.shields].sort((a, b) => a.birthYear - b.birthYear);
    const distances = ordered.map((shield) => shieldDistanceFromHotspot(aged, shield));
    for (let index = 1; index < distances.length; index++) {
      expect(distances[index]!).toBeLessThan(distances[index - 1]!);
    }
  });

  it("dates each birth inside the jump that produced it", () => {
    const born = worldWithOneShield();
    const jump = yearsFor(SHIELD_SPACING * 3.2);
    const aged = advanceArchipelago(born, jump, 5_000);
    expect(aged.shields.length).toBeGreaterThan(1);
    for (const shield of aged.shields.slice(1)) {
      expect(shield.birthYear).toBeGreaterThanOrEqual(5_000);
      expect(shield.birthYear).toBeLessThanOrEqual(5_000 + jump);
    }
    // Births are spread through the jump, not all dated at its start or end.
    const dates = aged.shields.slice(1).map((shield) => shield.birthYear);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("issues stable unique ids", () => {
    const aged = advanceArchipelago(worldWithOneShield(), yearsFor(SHIELD_SPACING * 3.2), 1);
    const ids = new Set(aged.shields.map((shield) => shield.id));
    expect(ids.size).toBe(aged.shields.length);
    expect(aged.nextShieldSerial).toBe(aged.shields.length);
  });

  it("does not erupt anything on a zero-year jump", () => {
    const history = createArchipelagoHistory();
    expect(advanceArchipelago(history, 0, 0)).toBe(history);
  });

  it("rejects a negative jump", () => {
    expect(() => advanceArchipelago(createArchipelagoHistory(), -1, 0)).toThrow(RangeError);
  });
});

describe("construction stage", () => {
  it("builds a shield while it sits under the hotspot", () => {
    const born = worldWithOneShield();
    const grown = advanceArchipelago(born, 1_000, 1);
    expect(grown.shields[0]!.construction).toBeGreaterThan(born.shields[0]!.construction);
  });

  it("progresses nascent → shield-building → waning → extinct as the crust carries it off", () => {
    let history = advanceArchipelago(createArchipelagoHistory(), 1, 0);
    let elapsed = 1;
    const id = history.shields[0]!.id;
    const stageAt = (h: ArchipelagoHistory) => shieldStage(h, h.shields.find((s) => s.id === id)!);
    const jump = (years: number) => {
      history = advanceArchipelago(history, years, elapsed);
      elapsed += years;
    };
    expect(stageAt(history)).toBe("nascent");

    jump(100_000);
    expect(stageAt(history)).toBe("shield-building");

    // Past 55% of the hotspot's reach the vent is waning.
    jump(yearsFor(HOTSPOT_REACH * 0.7));
    expect(stageAt(history)).toBe("waning");

    jump(yearsFor(HOTSPOT_REACH));
    expect(stageAt(history)).toBe("extinct");
  });

  it("stops building and accumulates dormancy once beyond the hotspot's reach", () => {
    const born = worldWithOneShield();
    const carried = advanceArchipelago(born, yearsFor(HOTSPOT_REACH * 2), 1);
    const shield = carried.shields.find((s) => s.id === born.shields[0]!.id)!;
    expect(hotspotInfluence(carried, shield)).toBe(0);
    expect(shield.dormantYears).toBeGreaterThan(0);

    const further = advanceArchipelago(carried, 50_000, 1);
    const older = further.shields.find((s) => s.id === born.shields[0]!.id)!;
    expect(older.construction).toBe(shield.construction);
    expect(older.dormantYears).toBe(shield.dormantYears + 50_000);
  });

  it("builds a shield out fully if it sits over the hotspot long enough, and no further", () => {
    let history = worldWithOneShield();
    for (let jump = 0; jump < 4; jump++) {
      history = advanceArchipelago(history, FULL_CONSTRUCTION_YEARS, 1 + jump * FULL_CONSTRUCTION_YEARS);
    }
    expect(history.shields[0]!.construction).toBe(1);
  });

  it("never lets construction fall back once built", () => {
    let history = worldWithOneShield();
    let previous = history.shields[0]!.construction;
    for (let jump = 0; jump < 12; jump++) {
      history = advanceArchipelago(history, 200_000, 1 + jump * 200_000);
      const current = history.shields[0]!.construction;
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });

  it("maps each stage onto the volcanic output the existing vent model expects", () => {
    expect(shieldVolcanicOutput("nascent")).toBe("vigorous");
    expect(shieldVolcanicOutput("shield-building")).toBe("active");
    expect(shieldVolcanicOutput("waning")).toBe("waning");
    expect(shieldVolcanicOutput("extinct")).toBe("extinct");
    expect(SHIELD_STAGES).toHaveLength(4);
  });
});

describe("construction is a property of elapsed time, not of how it was clicked", () => {
  /** Total construction after spending `total` years in `chunks` equal jumps. */
  function constructionAfter(total: number, chunks: number): number {
    let history = worldWithOneShield();
    let elapsed = 1;
    for (let chunk = 0; chunk < chunks; chunk++) {
      history = advanceArchipelago(history, total / chunks, elapsed);
      elapsed += total / chunks;
    }
    return history.shields[0]!.construction;
  }

  it("reaches the same construction however the player chunks the same span", () => {
    // Kept below the saturation ceiling so the comparison is meaningful.
    const single = constructionAfter(120_000, 1);
    expect(single).toBeLessThan(1);
    for (const chunks of [2, 5, 20, 200]) {
      expect(constructionAfter(120_000, chunks)).toBeCloseTo(single, 4);
    }
  });

  it("ends every chunking at the same crust offset", () => {
    const offsets = [1, 4, 50].map((chunks) => {
      let history = worldWithOneShield();
      let elapsed = 1;
      for (let chunk = 0; chunk < chunks; chunk++) {
        history = advanceArchipelago(history, 120_000 / chunks, elapsed);
        elapsed += 120_000 / chunks;
      }
      return history.crustOffset;
    });
    expect(offsets[1]).toBeCloseTo(offsets[0]!, 9);
    expect(offsets[2]).toBeCloseTo(offsets[0]!, 9);
  });

  it("builds more shield for a longer jump, across the whole ladder", () => {
    const rungs = [1, 1_000, 100_000, 1_000_000];
    const built = rungs.map((years) => advanceArchipelago(worldWithOneShield(), years, 1).shields[0]!.construction);
    for (let index = 1; index < built.length; index++) {
      expect(built[index]!).toBeGreaterThan(built[index - 1]!);
    }
  });
});

describe("dormancy", () => {
  it("never marks the shield sitting on the hotspot as dormant, even at full construction", () => {
    let history = worldWithOneShield();
    let elapsed = 1;
    for (let jump = 0; jump < 12; jump++) {
      history = advanceArchipelago(history, 100_000, elapsed);
      elapsed += 100_000;
      const shield = history.shields[0]!;
      if (hotspotInfluence(history, shield) > 0) expect(shield.dormantYears).toBe(0);
    }
    // The run is long enough that construction has actually saturated.
    expect(history.shields[0]!.construction).toBe(1);
  });

  it("never reports more dormant years than the shield has existed", () => {
    let history = worldWithOneShield();
    let elapsed = 1;
    for (const years of [1_000, 100_000, 1_000_000, 1_000_000, 1_000_000]) {
      history = advanceArchipelago(history, years, elapsed);
      elapsed += years;
      for (const shield of history.shields) {
        expect(shield.dormantYears).toBeLessThanOrEqual(elapsed - shield.birthYear + 1e-6);
      }
    }
  });

  it("dates dormancy from when feeding stopped, not from the start of the jump", () => {
    const born = worldWithOneShield();
    // Travel twice the hotspot's reach: fed for the first half, dormant after.
    const jump = yearsFor(HOTSPOT_REACH * 2);
    const carried = advanceArchipelago(born, jump, 1);
    const shield = carried.shields.find((s) => s.id === born.shields[0]!.id)!;
    expect(hotspotInfluence(carried, shield)).toBe(0);

    // The seeding jump left the shield fractionally off the hotspot, so it
    // crosses out of reach fractionally early. Derive rather than assume.
    const fed = yearsFor(HOTSPOT_REACH - shieldDistanceFromHotspot(born, born.shields[0]!));
    // Exact to well under a year, not merely to the sampling grid.
    expect(shield.dormantYears).toBeCloseTo(jump - fed, 0);
    expect(shield.dormantYears).toBeLessThan(jump);
  });
});

describe("shields born partway through a jump", () => {
  it("gives a newborn shield the construction it earned before drifting away", () => {
    const aged = advanceArchipelago(worldWithOneShield(), yearsFor(SHIELD_SPACING * 3.2), 1);
    // Every shield in the chain passed over the hotspot, so none may be blank.
    for (const shield of aged.shields) {
      expect(shield.construction).toBeGreaterThan(0);
    }
  });

  it("does not charge a newborn shield for years before it existed", () => {
    const totalBefore = 5_000;
    const jump = yearsFor(SHIELD_SPACING * 3.2);
    const aged = advanceArchipelago(worldWithOneShield(), jump, totalBefore);
    for (const shield of aged.shields.slice(1)) {
      const age = totalBefore + jump - shield.birthYear;
      expect(shield.dormantYears).toBeLessThanOrEqual(age + 1e-6);
    }
  });
});

describe("degenerate and off-axis geometry", () => {
  it("erupts once and then stops when the crust does not move", () => {
    const still = createArchipelagoHistory({ driftRate: 0 });
    const first = advanceArchipelago(still, 1_000_000, 0);
    expect(first.shields).toHaveLength(1);
    const second = advanceArchipelago(first, 1_000_000, 1_000_000);
    expect(second.shields).toHaveLength(1);
    // A stationary shield over a stationary hotspot still builds.
    expect(second.shields[0]!.construction).toBe(1);
  });

  it("places births correctly on a diagonal drift axis", () => {
    const diagonal = advanceArchipelago(
      createArchipelagoHistory({ driftX: 1, driftZ: 1 }),
      yearsFor(SHIELD_SPACING * 2.2),
      0,
    );
    const ordered = [...diagonal.shields].sort((a, b) => a.birthYear - b.birthYear);
    expect(ordered.length).toBeGreaterThanOrEqual(3);
    for (let index = 1; index < ordered.length; index++) {
      const previous = ordered[index - 1]!;
      const current = ordered[index]!;
      expect(Math.hypot(current.crustX - previous.crustX, current.crustZ - previous.crustZ))
        .toBeCloseTo(SHIELD_SPACING, 4);
    }
  });

  it("still erupts when an authored shield sits almost exactly one spacing off-axis", () => {
    // This geometry collapses the birth step towards zero; it must not stall.
    const seeded: ArchipelagoHistory = {
      ...createArchipelagoHistory(),
      nextShieldSerial: 1,
      shields: [{
        id: "shield-0",
        birthYear: 0,
        crustX: 0,
        crustZ: SHIELD_SPACING - 1e-5,
        construction: 0.5,
        dormantYears: 0,
      }],
    };
    const advanced = advanceArchipelago(seeded, yearsFor(SHIELD_SPACING * 3), 0);
    expect(advanced.shields.length).toBeGreaterThan(1);
  });
});

describe("archipelago validation", () => {
  it("accepts a resolved history", () => {
    const history = advanceArchipelago(worldWithOneShield(), 1_000_000, 1);
    expect(() => validateArchipelagoHistory(history)).not.toThrow();
  });

  it("rejects a non-unit drift direction", () => {
    const history = { ...createArchipelagoHistory(), driftX: 2, driftZ: 0 };
    expect(() => validateArchipelagoHistory(history)).toThrow(RangeError);
  });

  it("rejects duplicate shield ids", () => {
    const born = worldWithOneShield();
    const history = { ...born, shields: [born.shields[0]!, born.shields[0]!] };
    expect(() => validateArchipelagoHistory(history)).toThrow(RangeError);
  });

  it("rejects construction outside the unit interval", () => {
    const born = worldWithOneShield();
    const history = { ...born, shields: [{ ...born.shields[0]!, construction: 1.4 }] };
    expect(() => validateArchipelagoHistory(history)).toThrow(RangeError);
  });

  it("rejects a negative crust offset", () => {
    expect(() => validateArchipelagoHistory({ ...createArchipelagoHistory(), crustOffset: -1 })).toThrow(RangeError);
  });

  it("rejects an unknown version", () => {
    expect(() => validateArchipelagoHistory({ ...createArchipelagoHistory(), version: 99 })).toThrow(RangeError);
  });

  it("rejects a serial that would mint an id the world already uses", () => {
    // Left unchecked this validates clean and then throws a jump later, far
    // from the corruption that caused it.
    const born = worldWithOneShield();
    expect(() => validateArchipelagoHistory({ ...born, nextShieldSerial: 0 })).toThrow(RangeError);
  });

  it("survives a JSON round trip of an aged world", () => {
    const aged = advanceArchipelago(worldWithOneShield(), yearsFor(SHIELD_SPACING * 3.2), 1);
    const restored = JSON.parse(JSON.stringify(aged));
    expect(() => validateArchipelagoHistory(restored)).not.toThrow();
    expect(restored.shields).toHaveLength(aged.shields.length);
  });
});
