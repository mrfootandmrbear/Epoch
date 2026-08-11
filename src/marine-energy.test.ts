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
});
