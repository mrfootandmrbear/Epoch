import { describe, expect, it } from "vitest";
import { Color, Group, InstancedMesh, Matrix4, Quaternion, Vector3 } from "three/webgpu";
import { createCoralRenderer } from "./coral-renderer";
import { CORAL_SWAY_ATTRIBUTE, CORAL_DETAIL_ATTRIBUTE, CORAL_TINT_ATTRIBUTE } from "./coral-material";
import { MAX_REEF_COLONIES, type CoralColony, type CoralGuild } from "./reef-succession";

function colony(overrides: Partial<CoralColony> = {}): CoralColony {
  return {
    x: 0, y: -6, z: 0,
    guild: "massive-porites",
    radius: 1, height: 0.7,
    rotation: 0, tilt: 0,
    age: 0.5, health: 1,
    hue: 0.1, saturation: 0.4, lightness: 0.45,
    flowX: 1, flowZ: 0, flowSpeed: 0.8,
    depth: 6,
    ...overrides,
  };
}

function meshes(scene: Group): InstancedMesh[] {
  return scene.children.filter((child): child is InstancedMesh => child instanceof InstancedMesh);
}

function totalInstances(scene: Group): number {
  return meshes(scene).reduce((sum, mesh) => sum + mesh.count, 0);
}

function meshFor(scene: Group, guild: CoralGuild, level: "near" | "far"): InstancedMesh {
  // Batches are added guild-major, near before far, in CORAL_GUILDS order.
  const order: CoralGuild[] = [
    "crustose-algae", "staghorn", "table", "massive-porites", "brain", "sea-fan",
  ];
  const index = order.indexOf(guild) * 2 + (level === "near" ? 0 : 1);
  return meshes(scene)[index]!;
}

function setup() {
  const scene = new Group();
  const renderer = createCoralRenderer(scene, new Vector3(0.3, 0.8, 0.2).normalize());
  return { scene, renderer };
}

describe("coral renderer", () => {
  it("draws one instanced batch per growth form and detail level", () => {
    const { scene } = setup();
    expect(meshes(scene).length).toBe(12);
  });

  it("seats every colony it is given", () => {
    const { scene, renderer } = setup();
    renderer.setReef([
      colony({ x: 1 }),
      colony({ x: 2, guild: "staghorn" }),
      colony({ x: 3, guild: "sea-fan" }),
    ]);
    renderer.update(0, new Vector3(0, 0, 0));
    expect(totalInstances(scene)).toBe(3);
  });

  it("splits colonies between detail levels by camera distance", () => {
    const { scene, renderer } = setup();
    renderer.setReef([colony({ x: 5 }), colony({ x: 400 })]);
    renderer.update(0, new Vector3(0, 0, 0));
    expect(meshFor(scene, "massive-porites", "near").count).toBe(1);
    expect(meshFor(scene, "massive-porites", "far").count).toBe(1);
  });

  it("repartitions only once the camera has actually moved", () => {
    const { scene, renderer } = setup();
    renderer.setReef([colony({ x: 400 })]);
    renderer.update(0, new Vector3(0, 0, 0));
    expect(meshFor(scene, "massive-porites", "near").count).toBe(0);

    // A step too small to change any colony's band must not rebuild anything.
    renderer.update(1, new Vector3(1, 0, 0));
    expect(meshFor(scene, "massive-porites", "near").count).toBe(0);

    // Swimming out to the colony promotes it.
    renderer.update(2, new Vector3(400, 0, 0));
    expect(meshFor(scene, "massive-porites", "near").count).toBe(1);
  });

  it("seats a colony at its own position and size", () => {
    const { scene, renderer } = setup();
    renderer.setReef([colony({ x: 12, y: -8, z: -4, radius: 2.5, height: 1.6 })]);
    renderer.update(0, new Vector3(12, 0, -4));

    const matrix = new Matrix4();
    meshFor(scene, "massive-porites", "near").getMatrixAt(0, matrix);
    const position = new Vector3();
    const scale = new Vector3();
    matrix.decompose(position, new Quaternion(), scale);
    expect(position.x).toBeCloseTo(12);
    expect(position.y).toBeCloseTo(-8);
    expect(position.z).toBeCloseTo(-4);
    // Unit-box geometry scaled by the radius and height succession resolved.
    expect(scale.x).toBeCloseTo(2.5);
    expect(scale.y).toBeCloseTo(1.6);
  });

  it("carries per-instance tissue colour rather than one colour per form", () => {
    const { scene, renderer } = setup();
    renderer.setReef([
      colony({ x: 1, hue: 0.05, saturation: 0.6, lightness: 0.5 }),
      colony({ x: 2, hue: 0.6, saturation: 0.2, lightness: 0.3 }),
    ]);
    renderer.update(0, new Vector3(0, 0, 0));

    const tints = meshFor(scene, "massive-porites", "near").geometry.getAttribute(CORAL_TINT_ATTRIBUTE);
    const first = new Color(tints.getX(0), tints.getY(0), tints.getZ(0));
    const second = new Color(tints.getX(1), tints.getY(1), tints.getZ(1));
    expect(first.getHex()).not.toBe(second.getHex());
    expect(first.getHex()).toBe(new Color().setHSL(0.05, 0.6, 0.5).getHex());
  });

  it("gives thin forms translucency and solid ones almost none", () => {
    const { scene, renderer } = setup();
    renderer.setReef([colony({ guild: "sea-fan" }), colony({ guild: "massive-porites" })]);
    renderer.update(0, new Vector3(0, 0, 0));

    const fan = meshFor(scene, "sea-fan", "near").geometry.getAttribute(CORAL_DETAIL_ATTRIBUTE);
    const bommie = meshFor(scene, "massive-porites", "near").geometry.getAttribute(CORAL_DETAIL_ATTRIBUTE);
    expect(fan.getX(0)).toBeGreaterThan(0.8);
    expect(bommie.getX(0)).toBeLessThan(0.2);
  });

  it("sways soft corals and leaves stony ones rigid", () => {
    const { scene, renderer } = setup();
    renderer.setReef([
      colony({ guild: "sea-fan" }),
      colony({ guild: "massive-porites" }),
      colony({ guild: "brain" }),
    ]);
    renderer.update(0, new Vector3(0, 0, 0));

    expect(meshFor(scene, "sea-fan", "near").geometry.getAttribute(CORAL_SWAY_ATTRIBUTE).getZ(0))
      .toBeGreaterThan(0.1);
    expect(meshFor(scene, "massive-porites", "near").geometry.getAttribute(CORAL_SWAY_ATTRIBUTE).getZ(0))
      .toBe(0);
    expect(meshFor(scene, "brain", "near").geometry.getAttribute(CORAL_SWAY_ATTRIBUTE).getZ(0))
      .toBe(0);
  });

  it("stands sea fans across the current whatever direction it runs", () => {
    const { scene, renderer } = setup();
    for (const [flowX, flowZ] of [[1, 0], [0, 1], [-0.6, 0.8], [0.3, -0.95]]) {
      renderer.setReef([colony({ guild: "sea-fan", flowX: flowX!, flowZ: flowZ! })]);
      renderer.update(0, new Vector3(0, 0, 0));

      const mesh = meshFor(scene, "sea-fan", "near");
      const matrix = new Matrix4();
      mesh.getMatrixAt(0, matrix);
      const rotation = new Quaternion();
      matrix.decompose(new Vector3(), rotation, new Vector3());
      // The fan is built in the XY plane, so its face normal is local +Z.
      // Standing across the flow means that normal lies along the current.
      const normal = new Vector3(0, 0, 1).applyQuaternion(rotation);
      const flow = new Vector3(flowX, 0, flowZ).normalize();
      expect(Math.abs(normal.dot(flow))).toBeGreaterThan(0.97);

      // ...and the shader is handed that same flow in the fan's own frame, so
      // it bends out of its plane rather than sideways within it.
      const sway = mesh.geometry.getAttribute(CORAL_SWAY_ATTRIBUTE);
      expect(sway.getX(0)).toBeCloseTo(0, 5);
      expect(sway.getY(0)).toBeCloseTo(1, 5);
    }
  });

  it("survives a colony sitting in dead-still water", () => {
    const { scene, renderer } = setup();
    renderer.setReef([colony({ guild: "sea-fan", flowX: 0, flowZ: 0, flowSpeed: 0 })]);
    renderer.update(0, new Vector3(0, 0, 0));

    const matrix = new Matrix4();
    meshFor(scene, "sea-fan", "near").getMatrixAt(0, matrix);
    for (const element of matrix.elements) expect(Number.isFinite(element)).toBe(true);
  });

  it("retains a resolver-sized reef even when one guild dominates one LOD band", () => {
    const { scene, renderer } = setup();
    const crowd = Array.from(
      { length: MAX_REEF_COLONIES },
      (_, i) => colony({ x: (i % 90) * 0.1, z: Math.floor(i / 90) * 0.1 }),
    );
    renderer.setReef(crowd);
    renderer.update(0, new Vector3(0, 0, 0));

    expect(totalInstances(scene)).toBe(MAX_REEF_COLONIES);
    expect(meshFor(scene, "massive-porites", "near").count).toBe(MAX_REEF_COLONIES);
  });

  it("shares one set of water uniforms and updates them from the scene", () => {
    const { renderer } = setup();
    renderer.setSeaLevel(3);
    expect(renderer.water.seaLevel.value).toBe(3);

    renderer.update(4.5, new Vector3(0, 0, 0));
    expect(renderer.water.time.value).toBe(4.5);

    renderer.setLighting(new Vector3(0, 1, 0), new Color(1, 0.95, 0.9), new Color(0x14566a));
    expect(renderer.water.hazeColor.value.getHex()).toBe(0x14566a);
    expect(renderer.water.causticStrength.value).toBeGreaterThan(0.5);
  });

  it("puts the caustic net away when the sun is on the horizon", () => {
    const { renderer } = setup();
    renderer.setLighting(new Vector3(1, 0, 0), new Color(1, 0.4, 0.2), new Color(0x14566a));
    expect(renderer.water.causticStrength.value).toBe(0);
  });
});
