import { describe, expect, it } from "vitest";
import type { LineageChange } from "./lineage-history";
import { buildLineageReportHtml, populationDisplayName, shouldShowLineageChange } from "./lineage-report";

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

  it("marks active populations with sites as fly-to bookmarks", () => {
    const gotoSites = new Map([[root.id, { x: 10, y: 5, z: -20, island: "island-0" }]]);
    const html = buildLineageReportHtml([root], undefined, gotoSites);
    expect(html).toContain(`data-lineage-id="${root.id}"`);
    expect(html).toContain("lineage-node-goto");
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("click to view");
    expect(html).toContain("island-0");
  });

  it("does not mark populations without a goto site as interactive", () => {
    const html = buildLineageReportHtml([{ ...root, status: "not-established" }]);
    expect(html).toContain(`data-lineage-id="${root.id}"`);
    expect(html).not.toContain("lineage-node-goto");
    expect(html).not.toContain('role="button"');
  });

  it("hides vacant placeholder roots that were never seeded", () => {
    const vacant: LineageChange = {
      id: "sheltered-grazer:0",
      identity: "sheltered-grazer",
      previousStatus: "not-established",
      status: "not-established",
      moved: 0,
    };
    const otherVacant: LineageChange = {
      id: "ridge-grazer:0",
      identity: "ridge-grazer",
      previousStatus: "not-established",
      status: "not-established",
      moved: 0,
    };
    const founder: LineageChange = {
      id: "sheltered-grazer:2",
      identity: "sheltered-grazer",
      previousStatus: "not-established",
      status: "active",
      moved: 0,
      event: "established",
    };
    expect(shouldShowLineageChange(vacant)).toBe(false);
    expect(shouldShowLineageChange(otherVacant)).toBe(false);
    expect(shouldShowLineageChange(founder)).toBe(true);
    const html = buildLineageReportHtml([vacant, founder], undefined, new Map([[founder.id, { x: 1, y: 2, z: 3 }]]));
    expect(html).not.toContain("sheltered-grazer:0");
    expect(html).toContain("Sheltered grazer");
    expect(html).toContain("lineage-node-goto");
  });

  it("still shows a never-established raft that left founder evidence", () => {
    const failed: LineageChange = {
      id: "sheltered-grazer:0",
      identity: "sheltered-grazer",
      previousStatus: "not-established",
      status: "not-established",
      moved: 0,
      abundance: { before: 0.018, after: 0.04 },
      energy: { before: 0.38, after: 0.42 },
    };
    expect(shouldShowLineageChange(failed)).toBe(true);
  });

  it("includes active populations even when their change row was filtered", () => {
    const vacant: LineageChange = {
      id: "sheltered-grazer:0",
      identity: "sheltered-grazer",
      previousStatus: "not-established",
      status: "not-established",
      moved: 0,
    };
    const html = buildLineageReportHtml([vacant], undefined, new Map([["sheltered-grazer:2", { x: 1, y: 2, z: 3 }]]), [{
      id: "sheltered-grazer:2",
      identity: "sheltered-grazer",
      status: "active",
      visible: true,
      site: { x: 1, y: 2, z: 3, habitat: {} as never },
    }]);
    expect(html).toContain("Sheltered grazer");
    expect(html).toContain("sheltered-grazer:2");
  });

  it("names the living drifter root as the species label", () => {
    const vacant: LineageChange = {
      id: "sheltered-grazer:0",
      identity: "sheltered-grazer",
      previousStatus: "not-established",
      status: "not-established",
      moved: 0,
    };
    const founder: LineageChange = {
      id: "sheltered-grazer:2",
      identity: "sheltered-grazer",
      previousStatus: "not-established",
      status: "active",
      moved: 0,
      event: "established",
    };
    expect(populationDisplayName(founder, [vacant, founder])).toBe("Sheltered grazer");
    expect(populationDisplayName(vacant, [vacant, founder])).toBe("Sheltered grazer (vacant)");
  });

  it("marks a row goto when the population is active even without a focus target", () => {
    const change: LineageChange = {
      id: "sheltered-grazer:2",
      identity: "sheltered-grazer",
      previousStatus: "not-established",
      status: "active",
      moved: 0,
      event: "established",
    };
    const html = buildLineageReportHtml([change], undefined, new Map(), [{
      id: "sheltered-grazer:2",
      identity: "sheltered-grazer",
      status: "active",
      visible: true,
      site: { x: 10, y: 5, z: -20, habitat: {} as never },
    }]);
    expect(html).toContain("lineage-node-goto");
    expect(html).toContain('role="button"');
  });
});
