import { describe, expect, it } from "vitest";
import { Group, Matrix4, Quaternion, Vector3 } from "three/webgpu";
import { createCoastalForagerGeometry, createFishRenderer, fishExpression, FISH_MORPH_CHANNELS } from "./fish-renderer";

describe("coastal forager renderer", () => {
  it("ships one topology-stable channel for every visible shape and swim axis", () => {
    const geometry = createCoastalForagerGeometry();
    expect(geometry.getAttribute("position").count).toBeGreaterThan(100);
    expect(geometry.index?.count).toBeGreaterThan(600);
    expect(geometry.morphAttributes.position).toHaveLength(FISH_MORPH_CHANNELS.length);
    expect(geometry.morphTargetsRelative).toBe(true);
  });

  it("maps inherited marine traits and energy without inventing individual state", () => {
    const expression = fishExpression({
      bodySize: 0.3, streamlining: 0.92, depthPreference: 0.75,
      thermalTolerance: 0.21, maneuverability: 0.18, depthControl: 0.67,
      propulsionPlan: "tail",
    }, 0.26);
    expect(expression).toEqual({
      bodySize: 0.3, streamlining: 0.92, maneuverability: 0.18,
      depthControl: 0.67, thermalTolerance: 0.21, energy: 0.26,
    });
  });

  it("uses resolved population visibility, water-band height, and sample scale", () => {
    const renderer = createFishRenderer(new Group());
    const traits = {
      bodySize: 0.5, streamlining: 0.5, depthPreference: 0.5,
      thermalTolerance: 0.5, maneuverability: 0.5, depthControl: 0,
      propulsionPlan: "tail" as const,
    };
    renderer.setPopulation({ id: "fish", status: "active", visible: true, traits, energy: 0.6 }, [
      { x: 4, y: -6, z: 8, heading: 0.4, scale: 0.5 },
    ]);
    expect(renderer.mesh.count).toBe(1);
    const matrix = new Matrix4();
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    renderer.mesh.getMatrixAt(0, matrix);
    matrix.decompose(position, quaternion, scale);
    expect(position.y).toBeGreaterThan(-6.1);
    expect(position.y).toBeLessThan(-5.9);
    expect(scale.x).toBeGreaterThan(0.1);
    expect(scale.x).toBeLessThan(0.2);

    renderer.setPopulation(undefined, []);
    expect(renderer.mesh.count).toBe(0);
    expect(renderer.mesh.visible).toBe(false);
  });
});
