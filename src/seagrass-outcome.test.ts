import { describe, expect, it } from "vitest";
import type { ClimateForces } from "./climate";
import { resolveLanding, sampleEcosystem } from "./outcome-resolver";
import { captureWorldSnapshot, snapshotHeightAt } from "./world-snapshot";

const shelteredWet: ClimateForces = {
  rainfall: "wet",
  temperature: "mild",
  wind: "calm",
  seaLevel: "present",
};

function lagoonIsland(x: number, z: number): number {
  return 7 - Math.hypot(x, z) * 0.08;
}

describe("seagrass resolution", () => {
  it("uses productive submerged shallows after coastal succession begins", () => {
    const snapshot = captureWorldSnapshot(lagoonIsland, 1_000, shelteredWet);
    const landing = resolveLanding(snapshot, undefined, 1_000);

    expect(landing.outcome.seagrass.length).toBeGreaterThan(0);
    expect(landing.outcome.seagrass.every((tuft) => {
      const habitat = sampleEcosystem(
        (x, z) => snapshotHeightAt(snapshot, x, z),
        tuft.x,
        tuft.z,
        shelteredWet,
      );
      return tuft.y < 0 && habitat.coastalProductivity >= 0.28
        && habitat.slope <= 0.5 && habitat.exposure <= 0.7;
    })).toBe(true);

    const pioneer = resolveLanding(
      captureWorldSnapshot(lagoonIsland, 10, shelteredWet),
      undefined,
      10,
    );
    expect(pioneer.outcome.seagrass).toHaveLength(0);
  });
});
