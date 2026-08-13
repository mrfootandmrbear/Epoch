import { describe, expect, it } from "vitest";
import { createDistantDrifterRenderer } from "./distant-drifter-renderer";
import { createFounderProfile } from "./founder-profile";

describe("Distant Drifter renderer", () => {
  it("reveals the committed founder on floating natural debris", () => {
    const renderer = createDistantDrifterRenderer();
    const founder = createFounderProfile({
      foodSource: "woody-plants",
      size: "small",
      originClimate: "cold-wet",
    }, 10_000, 2, 12345);

    renderer.reveal(founder, 1.4);
    expect(renderer.group.visible).toBe(true);
    expect(renderer.group.name).toBe("distant-drifter");
    expect(renderer.founderSeed()).toBe(12345);
    expect(renderer.group.children).toHaveLength(13);

    renderer.update(Math.PI, 2.1);
    expect(renderer.group.position.y).toBeGreaterThan(1.9);

    renderer.hide();
    expect(renderer.group.visible).toBe(false);
    expect(renderer.founderSeed()).toBeUndefined();
  });
});
