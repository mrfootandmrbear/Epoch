import { describe, expect, it } from "vitest";
import { createWorldHistory, validateWorldHistory } from "./world-history";

function validHistory() {
  return createWorldHistory(new Float32Array(9), 3, 300);
}

describe("world history validation", () => {
  it("accepts the current schema", () => {
    expect(() => validateWorldHistory(validHistory())).not.toThrow();
  });

  it("rejects state from another schema version", () => {
    expect(() => validateWorldHistory({ ...validHistory(), version: 0 }))
      .toThrow("world history version must be 1, received 0");
  });

  it("rejects terrain arrays that do not match the declared grid", () => {
    const history = validHistory();
    expect(() => validateWorldHistory({
      ...history,
      terrain: { ...history.terrain, disturbance: new Float32Array(8) },
    })).toThrow("world history terrain.disturbance length must be 9, received 8");
  });

  it("rejects duplicate lineage IDs", () => {
    const history = validHistory();
    expect(() => validateWorldHistory({
      ...history,
      lineages: { lineages: [history.lineages.lineages[0], history.lineages.lineages[0]] },
    })).toThrow("world history lineages[1].id duplicates sheltered-grazer:0");
  });

  it("rejects ancestry pointing outside the retained history", () => {
    const history = validHistory();
    expect(() => validateWorldHistory({
      ...history,
      lineages: {
        lineages: [{ ...history.lineages.lineages[0], parentId: "missing:0", generation: 1 }],
      },
    })).toThrow("world history lineages[0].parentId references missing missing:0");
  });

  it("rejects lineage archetypes missing from the descriptor registry", () => {
    const history = validHistory();
    expect(() => validateWorldHistory({
      ...history,
      lineages: {
        lineages: [{ ...history.lineages.lineages[0], identity: "unknown-grazer" }],
      },
    })).toThrow("world history lineages[0].identity is not recognized");
  });
});
