import { describe, expect, it } from "vitest";
import { resolveFounderEstablishment } from "./founder-establishment";

const raftFounders = { energy: 0.38, abundance: 0.018, feedingAdaptation: 0.28 };

describe("founder establishment", () => {
  it("does not turn arrival into an automatic foothold", () => {
    const result = resolveFounderEstablishment(raftFounders, 0.72, 0.55, 1_000);
    expect(result.status).toBe("not-established");
    expect(result.abundance).toBeLessThan(0.05);
  });

  it("can establish after adapting to abundant local food", () => {
    const result = resolveFounderEstablishment(raftFounders, 0.9, 0.75, 1_000_000);
    expect(result.feedingAdaptation).toBeGreaterThan(raftFounders.feedingAdaptation);
    expect(result.status).toBe("active");
  });

  it("fails when the landing site cannot feed the cohort", () => {
    const result = resolveFounderEstablishment(raftFounders, 0.04, 0.1, 100_000);
    expect(result.status).toBe("extinct");
    expect(result.energy).toBe(0);
    expect(result.abundance).toBe(0);
  });
});
