import { describe, expect, it } from "vitest";
import { coralGeometry, type CoralGeometryLevel } from "./coral-geometry-assets";
import { CORAL_GUILDS, type CoralGuild } from "./reef-succession";

const LEVELS: readonly CoralGeometryLevel[] = ["near", "far"];

function bounds(guild: CoralGuild, level: CoralGeometryLevel) {
  const box = coralGeometry(guild, level).boundingBox;
  if (!box) throw new Error(`${guild} has no bounding box`);
  return box;
}

function vertexCount(guild: CoralGuild, level: CoralGeometryLevel): number {
  return coralGeometry(guild, level).getAttribute("position").count;
}

describe("coral geometry assets", () => {
  it("builds real indexed geometry with normals for every growth form", () => {
    for (const guild of CORAL_GUILDS) {
      for (const level of LEVELS) {
        const geometry = coralGeometry(guild, level);
        expect(geometry.getAttribute("position").count, `${guild}/${level}`).toBeGreaterThan(20);
        expect(geometry.getAttribute("normal"), `${guild}/${level}`).toBeDefined();
        expect(geometry.getIndex(), `${guild}/${level}`).not.toBeNull();
        expect(geometry.getIndex()!.count % 3, `${guild}/${level}`).toBe(0);
      }
    }
  });

  it("shares one geometry per form and level rather than rebuilding", () => {
    expect(coralGeometry("brain", "near")).toBe(coralGeometry("brain", "near"));
    expect(coralGeometry("brain", "near")).not.toBe(coralGeometry("brain", "far"));
  });

  it("keeps every form inside the unit box the renderer scales from", () => {
    for (const guild of CORAL_GUILDS) {
      for (const level of LEVELS) {
        const box = bounds(guild, level);
        expect(box.min.y, `${guild}/${level} sinks below the substrate`).toBeGreaterThan(-0.06);
        expect(box.max.y, `${guild}/${level} is taller than its unit box`).toBeLessThan(1.5);
        expect(Math.max(box.max.x, box.max.z), `${guild}/${level} is wider than its unit box`)
          .toBeLessThan(1.5);
      }
    }
  });

  it("seats every form on the substrate rather than floating above it", () => {
    for (const guild of CORAL_GUILDS) {
      expect(bounds(guild, "near").min.y, guild).toBeLessThan(0.06);
    }
  });

  it("spends its vertices where the silhouette needs them", () => {
    // A brain coral is a dome whose entire identity is surface relief, and a
    // crust is a film on rock. They should not cost the same.
    expect(vertexCount("brain", "near")).toBeGreaterThan(vertexCount("crustose-algae", "near") * 3);
  });

  it("gives every form a cheaper far level", () => {
    for (const guild of CORAL_GUILDS) {
      expect(vertexCount(guild, "far"), guild).toBeLessThan(vertexCount(guild, "near"));
    }
  });

  it("builds branching forms wider than they are tall at the base", () => {
    // A staghorn stand spreads. If the recursion collapsed to a vertical
    // bundle the branch spread would be near zero and it would read as sticks.
    const box = bounds("staghorn", "near");
    expect(box.max.x - box.min.x).toBeGreaterThan(0.4);
    expect(box.max.z - box.min.z).toBeGreaterThan(0.4);
  });

  it("keeps the sea fan planar so it can stand across the current", () => {
    const box = bounds("sea-fan", "near");
    const thickness = box.max.z - box.min.z;
    const width = box.max.x - box.min.x;
    expect(thickness).toBeLessThan(width * 0.35);
    expect(width).toBeGreaterThan(0.3);
  });

  it("lifts the table plate clear of the seabed on its stalk", () => {
    const geometry = coralGeometry("table", "near");
    const position = geometry.getAttribute("position");
    // The widest ring must sit well above the substrate, or it is not a table.
    let highestWide = 0;
    for (let i = 0; i < position.count; i++) {
      const radius = Math.hypot(position.getX(i), position.getZ(i));
      if (radius > 0.7) highestWide = Math.max(highestWide, position.getY(i));
    }
    expect(highestWide).toBeGreaterThan(0.5);
  });

  it("produces finite vertices everywhere", () => {
    for (const guild of CORAL_GUILDS) {
      for (const level of LEVELS) {
        const position = coralGeometry(guild, level).getAttribute("position");
        for (let i = 0; i < position.count; i++) {
          expect(Number.isFinite(position.getX(i)), `${guild}/${level}[${i}].x`).toBe(true);
          expect(Number.isFinite(position.getY(i)), `${guild}/${level}[${i}].y`).toBe(true);
          expect(Number.isFinite(position.getZ(i)), `${guild}/${level}[${i}].z`).toBe(true);
        }
      }
    }
  });

  it("indexes only vertices it actually built", () => {
    for (const guild of CORAL_GUILDS) {
      for (const level of LEVELS) {
        const geometry = coralGeometry(guild, level);
        const index = geometry.getIndex()!;
        const count = geometry.getAttribute("position").count;
        for (let i = 0; i < index.count; i++) {
          expect(index.getX(i), `${guild}/${level}`).toBeLessThan(count);
        }
      }
    }
  });
});
