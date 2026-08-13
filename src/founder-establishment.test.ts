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
});
