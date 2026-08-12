import { describe, expect, it } from "vitest";
import type { LineageChange } from "./lineage-history";
import { buildLineageReportHtml } from "./lineage-report";

const root: LineageChange = {
  id: "sheltered-grazer:0",
  identity: "sheltered-grazer",
  previousStatus: "active",
  status: "active",
  moved: 4,
  event: "migrated",
};

describe("lineage report", () => {
  it("orders descendants beneath their parent regardless of input order", () => {
    const child: LineageChange = {
      ...root,
      id: "sheltered-grazer:0/1",
      parentId: root.id,
      event: "speciated",
      moved: 72,
    };
    const html = buildLineageReportHtml([child, root]);
    expect(html.indexOf("Sheltered grazer")).toBeLessThan(html.indexOf("Descendant 1"));
    expect(html).toContain("style=\"--depth:1\"");
    expect(html).toContain("new branch · 72m isolated");
  });

  it("shows only the three strongest trait changes", () => {
    const html = buildLineageReportHtml([{
      ...root,
      traits: {
        bodyMass: { before: 1, after: 1.01 },
        legLength: { before: 1, after: 1.2 },
        footWidth: { before: 1, after: 0.7 },
        insulation: { before: 1, after: 1.4 },
      },
    }]);
    expect(html).toContain("insulation +0.400");
    expect(html).toContain("feet -0.300");
    expect(html).toContain("legs +0.200");
    expect(html).not.toContain("mass +0.010");
  });

  it("escapes lineage identifiers before rendering", () => {
    expect(buildLineageReportHtml([{ ...root, id: "<unsafe>" }])).toContain("&lt;unsafe&gt;");
  });

  it("makes population condition legible", () => {
    const html = buildLineageReportHtml([{
      ...root,
      abundance: { before: 0.7, after: 0.42 },
      energy: { before: 0.6, after: 0.31 },
    }]);
    expect(html).toContain("population 42%");
    expect(html).toContain("energy 31%");
  });
});
