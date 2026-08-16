import { describe, expect, it } from "vitest";
import { resolveFounderEstablishment } from "./founder-establishment";

const raftFounders = { energy: 0.38, abundance: 0.018, feedingAdaptation: 0.28 };
const favorable = { foodAvailability: 0.72, climateFit: 1, metabolicCost: 1 };

describe("founder establishment", () => {
  it("does not turn arrival into an automatic foothold", () => {
    const result = resolveFounderEstablishment(raftFounders, favorable, 1_000);
    expect(result.status).toBe("not-established");
    expect(result.abundance).toBeLessThan(0.05);
  });

  it("can establish after adapting to abundant local food", () => {
    const result = resolveFounderEstablishment(raftFounders, { ...favorable, foodAvailability: 0.9 }, 1_000_000);
    expect(result.feedingAdaptation).toBeGreaterThan(raftFounders.feedingAdaptation);
    expect(result.status).toBe("active");
  });

  it("fails when the landing site cannot feed the cohort", () => {
    const result = resolveFounderEstablishment(raftFounders, { ...favorable, foodAvailability: 0.04 }, 100_000);
    expect(result.status).toBe("extinct");
    expect(result.energy).toBe(0);
    expect(result.abundance).toBe(0);
  });

  it("charges climate mismatch and large-body maintenance through the same budget", () => {
    const matched = resolveFounderEstablishment(raftFounders, { foodAvailability: 0.9, climateFit: 1, metabolicCost: 0.9 }, 100_000);
    const mismatched = resolveFounderEstablishment(raftFounders, { foodAvailability: 0.9, climateFit: 0.35, metabolicCost: 1.18 }, 100_000);
    expect(matched.energy).toBeGreaterThan(mismatched.energy);
    expect(matched.abundance).toBeGreaterThan(mismatched.abundance);
  });

  // WU-A1: adaptation must be reachable within a single jump, or "marginal"
  // never means anything — a founder's fate would already be fixed at the
  // moment of choice. A 1-year jump still makes zero progress on purpose
  // (matches the shared `traitAdaptationRate` curve); a long enough single
  // jump must now reach full behavioural adaptation.
  it("reaches full feeding adaptation within one sufficiently long jump", () => {
    const stalled = resolveFounderEstablishment(raftFounders, favorable, 1);
    expect(stalled.feedingAdaptation).toBe(raftFounders.feedingAdaptation);

    const adapted = resolveFounderEstablishment(raftFounders, favorable, 1_000_000);
    expect(adapted.feedingAdaptation).toBe(1);
  });

  // Pinned from scripts/founder-matrix-readout.ts's bare-young-volcanic
  // column, run through the real resolveFounderEstablishment (WU-A1's
  // "before" matrix found 60/60 FounderChoices extinct on this exact site;
  // this is the "after" contrast the LOG entry cites). Same island, same
  // 1,000,000-year jump: a well-matched founder establishes and a
  // deliberately mismatched one fails, for a mismatch attributable to a
  // named cause, not a global margin.
  it("lets a well-matched founder establish where a mismatched one on the same island fails", () => {
    // ground-plants / small / temperate-origin founder on a young volcanic
    // island whose best site is wet, warm ground-plant forage: food source
    // and origin climate both match what the site offers.
    const wellMatched = resolveFounderEstablishment(
      raftFounders,
      { foodAvailability: 0.502, climateFit: 1, metabolicCost: 0.9 },
      1_000_000,
    );
    expect(wellMatched.status).toBe("active");

    // animal-prey / large / cold-wet-origin founder on the same island: no
    // terrestrial prey field exists yet (food-source mismatch) and the
    // founder's origin climate is nothing like the island's (climate
    // mismatch) — an absurd double mismatch, not a moved margin.
    const mismatched = resolveFounderEstablishment(
      raftFounders,
      { foodAvailability: 0.022, climateFit: 0.42, metabolicCost: 1.18 },
      1_000_000,
    );
    expect(mismatched.status).toBe("extinct");
  });

  // The middle band: a founder whose full-adaptation intake sits close to
  // break-even should be genuinely contested, not snapped to a hard
  // outcome — it stays alive with abundance held roughly flat, exactly
  // where `FOUNDER_MARGIN_BAND_WIDTH` says the primary intake signal alone
  // should not decide.
  it("leaves a near-break-even founder contested rather than deciding it outright", () => {
    const marginal = resolveFounderEstablishment(
      raftFounders,
      { foodAvailability: 0.452, climateFit: 0.811, metabolicCost: 1 },
      1_000_000,
    );
    expect(marginal.status).toBe("not-established");
    expect(marginal.abundance).toBeGreaterThan(0);
  });
});
