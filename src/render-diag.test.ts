import { describe, expect, it } from "vitest";
import {
  DEFAULT_RENDER_DIAG,
  FAR_LOD_VIEW_OFFSET,
  formatRenderHud,
  readRenderDiagOptions,
  RENDER_DIAG_FLAGS,
} from "./render-diag";
import { RENDER_SCALE } from "./render-scale";

describe("render diag flags", () => {
  it("leaves shipping behavior unchanged when diag is omitted", () => {
    expect(readRenderDiagOptions(new URLSearchParams())).toEqual(DEFAULT_RENDER_DIAG);
    expect(readRenderDiagOptions(new URLSearchParams("post=0"))).toEqual(DEFAULT_RENDER_DIAG);
  });

  it("enables each isolation flag from diag=", () => {
    for (const flag of RENDER_DIAG_FLAGS) {
      const options = readRenderDiagOptions(new URLSearchParams(`diag=${flag}`));
      const expected = {
        ...DEFAULT_RENDER_DIAG,
        noHerd: flag === "no-herd",
        flatHide: flag === "flat-hide",
        freezePose: flag === "freeze-pose",
        farLod: flag === "far-lod",
        noFft: flag === "no-fft",
        noShadow: flag === "no-shadow",
      };
      expect(options).toEqual(expected);
    }
  });

  it("combines repeated diag params and comma lists", () => {
    expect(readRenderDiagOptions(new URLSearchParams("diag=no-herd&diag=no-fft"))).toEqual({
      ...DEFAULT_RENDER_DIAG,
      noHerd: true,
      noFft: true,
    });
    expect(readRenderDiagOptions(new URLSearchParams("diag=freeze-pose,far-lod"))).toEqual({
      ...DEFAULT_RENDER_DIAG,
      freezePose: true,
      farLod: true,
    });
  });

  it("ignores unknown diag tokens", () => {
    expect(readRenderDiagOptions(new URLSearchParams("diag=impostors"))).toEqual(DEFAULT_RENDER_DIAG);
    expect(readRenderDiagOptions(new URLSearchParams("diag=no-herd,mystery"))).toEqual({
      ...DEFAULT_RENDER_DIAG,
      noHerd: true,
    });
  });

  it("keeps the far-lod view offset beyond every near vegetation band", () => {
    expect(FAR_LOD_VIEW_OFFSET).toBeGreaterThan(
      RENDER_SCALE.islandExtent + RENDER_SCALE.lod.treeNear,
    );
  });
});

describe("render HUD", () => {
  it("prints backend, fps, draws, and camera distance in metres", () => {
    expect(formatRenderHud("WebGPU", 61, 48, 38.2)).toBe(
      "backend: WebGPU · 61 fps · 48 draws · 38 m",
    );
    expect(formatRenderHud("WebGL2", 24, 90, 512.6)).toBe(
      "backend: WebGL2 · 24 fps · 90 draws · 513 m",
    );
  });
});
