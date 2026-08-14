import { describe, expect, it } from "vitest";
import {
  isVolcanicLifecyclePhase,
  volcanicLifecyclePrefix,
  VOLCANIC_LIFECYCLE_PHASES,
} from "./volcanic-lifecycle";

describe("volcanic lifecycle capture sequence", () => {
  it("replays a cumulative prefix for every phase", () => {
    for (const [index, phase] of VOLCANIC_LIFECYCLE_PHASES.entries()) {
      const prefix = volcanicLifecyclePrefix(phase);
      expect(prefix).toHaveLength(index + 1);
      expect(prefix.at(-1)?.phase).toBe(phase);
    }
  });

  it("moves from construction to extinction and ends at high sea level", () => {
    const sequence = volcanicLifecyclePrefix("drowned");
    expect(sequence[0]?.output).toBe("vigorous");
    expect(sequence.slice(1).every((step) => step.output === "extinct")).toBe(true);
    expect(sequence.at(-1)?.climate.seaLevel).toBe("high");
  });

  it("accepts only named capture phases", () => {
    expect(isVolcanicLifecyclePhase("carved")).toBe(true);
    expect(isVolcanicLifecyclePhase("active")).toBe(false);
    expect(isVolcanicLifecyclePhase(null)).toBe(false);
  });
});
