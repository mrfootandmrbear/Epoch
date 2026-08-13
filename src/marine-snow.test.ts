import { describe, expect, it } from "vitest";
import { Group, Mesh, Vector3 } from "three/webgpu";
import { createMarineSnow } from "./marine-snow";
import { createReefWaterUniforms } from "./reef-water";
import { buildCurrentField } from "./ocean-currents";
import type { WorldSnapshot } from "./world-snapshot";
import type { ClimateForces } from "./climate";

const CLIMATE: ClimateForces = {
  rainfall: "temperate", temperature: "warm", wind: "westerly", seaLevel: "present",
};

const SIDE = 65;
const EXTENT = 320;

/** A conical island on a shelf: the shape that produces a leeward wake. */
function islandSnapshot(): WorldSnapshot {
  const half = (SIDE - 1) / 2;
  const elevations = new Float32Array(SIDE * SIDE);
  for (let z = 0; z < SIDE; z++) {
    for (let x = 0; x < SIDE; x++) {
      const d = Math.hypot(x - half, z - half) / half;
      elevations[z * SIDE + x] = -14 + 34 * Math.max(0, 1 - d * 2.4);
    }
  }
  return { gridSize: SIDE, extent: EXTENT, elevations, climate: CLIMATE, totalYears: 5000 };
}

function setup() {
  const scene = new Group();
  const water = createReefWaterUniforms();
  const snow = createMarineSnow(scene, water);
  const field = buildCurrentField(islandSnapshot(), CLIMATE);
  const mesh = scene.children[0] as Mesh;
  return { scene, snow, field, mesh, water };
}

function centers(mesh: Mesh): Float32Array {
  return mesh.geometry.getAttribute("position").array as Float32Array;
}

function alphas(mesh: Mesh): number[] {
  const detail = mesh.geometry.getAttribute("snowDetail");
  const values: number[] = [];
  // One value per particle; the four corners of a quad share it.
  for (let vertex = 0; vertex < detail.count; vertex += 4) values.push(detail.getY(vertex));
  return values;
}

describe("marine snow", () => {
  it("stays hidden until it has a current field to drift in", () => {
    const { snow, mesh } = setup();
    expect(mesh.visible).toBe(false);
    snow.setField(buildCurrentField(islandSnapshot(), CLIMATE), () => -30, 0);
    expect(mesh.visible).toBe(true);
    snow.setField(undefined, () => -30, 0);
    expect(mesh.visible).toBe(false);
  });

  it("builds four camera-facing corners per particle", () => {
    const { mesh } = setup();
    const corner = mesh.geometry.getAttribute("snowCorner");
    expect(corner.count % 4).toBe(0);
    expect(mesh.geometry.getIndex()!.count).toBe((corner.count / 4) * 6);
    // Corners span a centred unit quad, so the radial falloff is symmetric.
    expect(corner.getX(0)).toBe(-1);
    expect(corner.getY(0)).toBe(-1);
    expect(corner.getX(2)).toBe(1);
    expect(corner.getY(2)).toBe(1);
  });

  it("drifts particles along the current rather than leaving them hanging", () => {
    const { snow, mesh, field } = setup();
    snow.setField(field, () => -30, 0);
    // Offshore of the island, where there is actually a current. Over the
    // landmass the solved flow is zero and nothing should drift.
    const view = new Vector3(110, -8, 0);
    snow.update(0.016, view);
    const before = centers(mesh).slice();

    for (let frame = 0; frame < 30; frame++) snow.update(0.05, view);
    const after = centers(mesh);

    let moved = 0;
    for (let particle = 0; particle < before.length / 12; particle++) {
      const vertex = particle * 4;
      const dx = after[vertex * 3]! - before[vertex * 3]!;
      const dz = after[vertex * 3 + 2]! - before[vertex * 3 + 2]!;
      if (Math.hypot(dx, dz) > 0.05) moved++;
    }
    expect(moved).toBeGreaterThan(before.length / 12 * 0.5);
  });

  it("settles particles downward under their own weight", () => {
    const { snow, mesh, field } = setup();
    snow.setField(field, () => -300, 0);
    const view = new Vector3(0, -8, 0);
    snow.update(0.016, view);
    const before = centers(mesh)[1]!;
    for (let frame = 0; frame < 60; frame++) snow.update(0.05, view);
    // Deep seabed and a low ceiling mean nothing respawns; it can only sink.
    expect(centers(mesh)[1]!).toBeLessThan(before);
  });

  it("keeps every particle inside the box it carries with the camera", () => {
    const { snow, mesh, field } = setup();
    snow.setField(field, () => -60, 0);
    const view = new Vector3(20, -10, -14);
    for (let frame = 0; frame < 80; frame++) snow.update(0.05, view);

    const data = centers(mesh);
    for (let particle = 0; particle < data.length / 12; particle++) {
      const vertex = particle * 4;
      expect(Math.abs(data[vertex * 3]! - view.x)).toBeLessThanOrEqual(35);
      expect(Math.abs(data[vertex * 3 + 2]! - view.z)).toBeLessThanOrEqual(35);
    }
  });

  it("never shows a fleck above the surface", () => {
    const { snow, mesh, field } = setup();
    const seaLevel = 0;
    snow.setField(field, () => -40, seaLevel);
    const view = new Vector3(0, -2, 0);
    for (let frame = 0; frame < 40; frame++) snow.update(0.05, view);

    const data = centers(mesh);
    const visible = alphas(mesh);
    for (let particle = 0; particle < visible.length; particle++) {
      if (visible[particle]! <= 0) continue;
      expect(data[particle * 4 * 3 + 1]!).toBeLessThan(seaLevel);
    }
  });

  it("gathers thicker in the sheltered lee than in the swept windward water", () => {
    const { snow, mesh, field } = setup();
    snow.setField(field, () => -60, 0);

    const measure = (view: Vector3) => {
      snow.setField(field, () => -60, 0);
      for (let frame = 0; frame < 12; frame++) snow.update(0.05, view);
      const visible = alphas(mesh);
      const drawn = visible.filter((alpha) => alpha > 0);
      return { count: drawn.length, load: drawn.reduce((sum, a) => sum + a, 0) };
    };

    const downstream = 62;
    const lee = measure(new Vector3(
      field.prevailing.x * downstream, -8, field.prevailing.z * downstream,
    ));
    const windward = measure(new Vector3(
      -field.prevailing.x * downstream, -8, -field.prevailing.z * downstream,
    ));

    // Both the number drawn and the total load rise in the wake: slack water
    // holds its suspended matter and swept water does not.
    expect(lee.count).toBeGreaterThan(windward.count);
    expect(lee.load).toBeGreaterThan(windward.load * 1.15);
  });

  it("does nothing at all when switched off", () => {
    const { snow, mesh, field } = setup();
    snow.setField(field, () => -30, 0);
    snow.setVisible(false);
    expect(mesh.visible).toBe(false);
    const before = centers(mesh).slice();
    for (let frame = 0; frame < 20; frame++) snow.update(0.05, new Vector3(0, -8, 0));
    expect([...centers(mesh)]).toEqual([...before]);
  });
});
