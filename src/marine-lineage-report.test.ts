import { describe, expect, it } from "vitest";
import { buildMarineLineageReportHtml } from "./marine-lineage-report";
import type { MarineLineageChange } from "./marine-lineage";

describe("marine lineage report", () => {
  it("reports habitat, population condition, and strongest adaptation", () => {
    const change: MarineLineageChange = {
      id: "coastal-forager:0", previousStatus: "active", status: "active", moved: 12, event: "migrated",
      habitat: { elevation: -3, slope: 0.1, moisture: 1, exposure: 0.2, drainage: 0, coastalProductivity: 0.8,
        nesting: 0, lift: 0, forage: 1, depth: 3, temperature: 0.85, waveCost: 0.2, food: 0.8,
        band: "midwater", waterY: -1.5, light: 0.8, structuralComplexity: 0.2 },
      traits: { streamlining: { before: 0.4, after: 0.6 } },
      abundance: { before: 0.3, after: 0.5 }, energy: { before: 0.5, after: 0.7 },
    };
    const html = buildMarineLineageReportHtml([change]);
    expect(html).toContain("Marine history");
    expect(html).toContain("midwater · 3.0u column");
    expect(html).toContain("population 50%");
    expect(html).toContain("streamlining +0.200");
  });
});
