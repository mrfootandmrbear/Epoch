import { describe, expect, it } from "vitest";
import type { ClimateForces } from "./climate";
import { resolveLanding } from "./outcome-resolver";
import { captureWorldSnapshot } from "./world-snapshot";

const warmWet: ClimateForces = {
  rainfall: "wet",
  temperature: "warm",
  wind: "westerly",
  seaLevel: "present",
};

function coastalIsland(x: number, z: number): number {
  return 7 - Math.hypot(x, z) * 0.09;
}

describe("mangrove resolution", () => {
  it("places mangroves only in warm saltwater intertidal habitat", () => {
    const warm = resolveLanding(captureWorldSnapshot(coastalIsland, 1_000, warmWet), undefined, 1_000);
    const mangroves = warm.outcome.trees.filter((tree) => tree.morphology.guild === "mangrove");

    expect(mangroves.length).toBeGreaterThan(0);
    expect(mangroves.every((tree) => tree.y >= -0.75 && tree.y <= 1.35)).toBe(true);

    const mild = resolveLanding(captureWorldSnapshot(
      coastalIsland,
      1_000,
      { ...warmWet, temperature: "mild" },
    ), undefined, 1_000);
    expect(mild.outcome.trees.some((tree) => tree.morphology.guild === "mangrove")).toBe(false);
  });
});
