import { describe, expect, it } from "vitest";
import { renderBathymetryOffset, renderBoundaryHeight } from "./render-bathymetry";

describe("render-only bathymetry", () => {
  it("leaves the playable interior unchanged and reaches deep water at the edge", () => {
    expect(renderBathymetryOffset(0)).toBe(0);
    expect(renderBathymetryOffset(6)).toBe(0);
    expect(renderBathymetryOffset(28)).toBe(38);
    expect(renderBathymetryOffset(17)).toBeCloseTo(9.5);
  });

  it("forces even land-touching domain edges into deep render water", () => {
    expect(renderBoundaryHeight(12, 20)).toBe(12);
    expect(renderBoundaryHeight(12, 14)).toBe(12);
    expect(renderBoundaryHeight(80, 0)).toBe(-40);
    expect(renderBoundaryHeight(-5, 0)).toBe(-40);
  });
});
