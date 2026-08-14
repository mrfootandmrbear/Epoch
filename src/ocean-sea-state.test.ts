import { describe, expect, it } from "vitest";
import { resolveOceanSeaState } from "./ocean-sea-state";

describe("ocean sea state", () => {
  it("turns the storm presentation into a materially rougher, breaking sea", () => {
    const fair = resolveOceanSeaState(18, false);
    const storm = resolveOceanSeaState(18, true);
    expect(storm.windSpeed).toBeGreaterThan(fair.windSpeed * 1.5);
    expect(storm.amplitudeScale).toBeGreaterThan(fair.amplitudeScale * 2.5);
    expect(storm.chopScale).toBeGreaterThan(2);
    expect(storm.crestFoamStrength).toBe(1);
  });
});
