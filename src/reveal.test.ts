import { describe, expect, it } from "vitest";
import { REVEAL_TREATMENTS, isRevealTreatmentName, revealTreatmentOptions } from "./reveal";

describe("reveal treatments", () => {
  it("provides two variants for each of three philosophies", () => {
    const counts = new Map<string, number>();
    for (const treatment of Object.values(REVEAL_TREATMENTS)) {
      counts.set(treatment.philosophy, (counts.get(treatment.philosophy) ?? 0) + 1);
      expect(treatment.resolveAt).toBeLessThan(treatment.duration);
    }
    expect([...counts.values()]).toEqual([2, 2, 2]);
  });

  it("exposes stable selectable options", () => {
    expect(revealTreatmentOptions()).toHaveLength(6);
    expect(isRevealTreatmentName("transform-scan")).toBe(true);
    expect(isRevealTreatmentName("unknown")).toBe(false);
  });
});
