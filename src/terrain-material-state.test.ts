import { describe, expect, it } from "vitest";
import { packTerrainMaterialState } from "./terrain-material-state";

describe("packTerrainMaterialState", () => {
  it("packs disturbance, protection, runoff, and forage into stable RGBA channels", () => {
    const packed = packTerrainMaterialState({
      disturbance: new Float32Array([0.1, 0.2]),
      vegetationProtection: new Float32Array([0.3, 0.4]),
      runoff: new Float32Array([0.5, 0.6]),
      forage: new Float32Array([0.7, 0.8]),
    });
    expect(Array.from(packed)).toEqual([
      expect.closeTo(0.1), expect.closeTo(0.3), expect.closeTo(0.5), expect.closeTo(0.7),
      expect.closeTo(0.2), expect.closeTo(0.4), expect.closeTo(0.6), expect.closeTo(0.8),
    ]);
  });

  it("rejects a target that cannot represent every terrain cell", () => {
    expect(() => packTerrainMaterialState({
      disturbance: new Float32Array(2),
      vegetationProtection: new Float32Array(2),
      runoff: new Float32Array(2),
      forage: new Float32Array(2),
    }, new Float32Array(4))).toThrow(/wrong size/);
  });
});
