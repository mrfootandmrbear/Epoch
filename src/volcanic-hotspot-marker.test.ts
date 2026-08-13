import { describe, expect, it } from "vitest";
import { hotSpotVisualStyle } from "./volcanic-hotspot-marker";

describe("volcanic hotspot marker", () => {
  it("makes stronger output brighter and more animated", () => {
    const vigorous = hotSpotVisualStyle("vigorous");
    const active = hotSpotVisualStyle("active");
    const extinct = hotSpotVisualStyle("extinct");
    expect(vigorous.opacity).toBeGreaterThan(active.opacity);
    expect(active.opacity).toBeGreaterThan(extinct.opacity);
    expect(vigorous.pulse).toBeGreaterThan(active.pulse);
    expect(extinct.pulse).toBe(0);
  });
});
