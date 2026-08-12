import { describe, expect, it } from "vitest";
import { DEFAULT_CLIMATE } from "./climate";
import { createDrifterFounderHistory, createLineageHistory, type LineageHistory } from "./lineage-history";
import { resolveLanding } from "./outcome-resolver";
import { captureWorldSnapshot } from "./world-snapshot";

function establishedHistory(): LineageHistory {
  const root = createLineageHistory().lineages[0]!;
  return {
    lineages: [{
      ...root,
      status: "active",
      site: { x: 0, z: 0 },
      abundance: 0.2,
      energy: 0.2,
    }],
  };
}

describe("population energy and abundance", () => {
  it("lets persistent forage distinguish survival from starvation", () => {
    const heightAt = () => 12;
    const rich = captureWorldSnapshot(heightAt, 1_000_000, DEFAULT_CLIMATE, 32, 180, () => 1);
    const exhausted = captureWorldSnapshot(heightAt, 1_000_000, DEFAULT_CLIMATE, 32, 180, () => 0);

    const thriving = resolveLanding(rich, establishedHistory(), 1_000_000).nextHistory.lineages[0]!;
    const starved = resolveLanding(exhausted, establishedHistory(), 1_000_000).nextHistory.lineages[0]!;

    expect(thriving.status).toBe("active");
    expect(thriving.abundance).toBeGreaterThan(0.2);
    expect(starved.status).toBe("extinct");
    expect(starved.abundance).toBe(0);
    expect(starved.energy).toBe(0);
  });

  it("keeps drifter founders vulnerable until food supports reproduction", () => {
    const heightAt = () => 12;
    const shortRich = captureWorldSnapshot(heightAt, 1_000, DEFAULT_CLIMATE, 32, 180, () => 0.82);
    const deepRich = captureWorldSnapshot(heightAt, 1_000_000, DEFAULT_CLIMATE, 32, 180, () => 0.95);
    const exhausted = captureWorldSnapshot(heightAt, 100_000, DEFAULT_CLIMATE, 32, 180, () => 0.02);

    const arrived = resolveLanding(shortRich, createDrifterFounderHistory(0), 1_000).nextHistory.lineages[0]!;
    const established = resolveLanding(deepRich, createDrifterFounderHistory(0), 1_000_000).nextHistory.lineages[0]!;
    const failed = resolveLanding(exhausted, createDrifterFounderHistory(0), 100_000).nextHistory.lineages[0]!;

    expect(arrived.status).toBe("not-established");
    expect(arrived.abundance).toBeLessThan(0.05);
    expect(established.status).toBe("active");
    expect(established.feedingAdaptation).toBeGreaterThan(0.28);
    expect(failed.status).toBe("extinct");
  });
});
