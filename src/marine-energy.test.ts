import { describe, expect, it } from "vitest";
import { DEFAULT_CLIMATE } from "./climate";
import { resolveLanding } from "./outcome-resolver";
import { captureWorldSnapshot } from "./world-snapshot";

describe("marine energy exchange", () => {
  it("exposes productive water, nursery habitat, prey, and shoreline subsidy without feeding grazers directly", () => {
    const island = (x: number, z: number) => 18 - Math.hypot(x, z) * 0.2;
    const result = resolveLanding(captureWorldSnapshot(island, 10_000, DEFAULT_CLIMATE), { lineages: [] }, 10_000);
    expect(result.outcome.marineEnergy.primaryProductivity).toBeGreaterThan(0);
    expect(result.outcome.marineEnergy.nurseryCapacity).toBeGreaterThan(0);
    expect(result.outcome.marineEnergy.preyAvailability).toBeGreaterThan(0);
    expect(result.outcome.marineEnergy.shorelineSubsidy).toBeGreaterThan(0);
    expect(result.outcome.populations).toEqual([]);
  });

  it("lets reef structure raise nursery capacity without renderer state", () => {
    const island = (x: number, z: number) => 18 - Math.hypot(x, z) * 0.2;
    const snapshot = captureWorldSnapshot(island, 10_000, DEFAULT_CLIMATE);
    const bare = resolveLanding(snapshot, { lineages: [] }, 10_000, undefined, { shelter: 0, productivity: 0 });
    const reef = resolveLanding(snapshot, { lineages: [] }, 10_000, undefined, { shelter: 1, productivity: 1 });
    expect(reef.outcome.marineEnergy.nurseryCapacity).toBeGreaterThan(bare.outcome.marineEnergy.nurseryCapacity);
    expect(reef.outcome.marineEnergy.primaryProductivity).toBeGreaterThan(bare.outcome.marineEnergy.primaryProductivity);
  });
});
