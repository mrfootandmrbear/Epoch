import { Color, ConeGeometry, Group, Mesh, MeshBasicMaterial, RingGeometry } from "three/webgpu";
import type { VolcanicOutput } from "./volcanism";

export function hotSpotVisualStyle(output: VolcanicOutput): Readonly<{ color: number; opacity: number; pulse: number }> {
  if (output === "vigorous") return { color: 0xff4b16, opacity: 0.94, pulse: 1 };
  if (output === "active") return { color: 0xff7426, opacity: 0.86, pulse: 0.72 };
  if (output === "waning") return { color: 0xd95d2a, opacity: 0.68, pulse: 0.38 };
  return { color: 0x5c3028, opacity: 0.42, pulse: 0 };
}

/** Restrained world-space cue for the fixed source behind later lava flows. */
export function createVolcanicHotSpotMarker(): Readonly<{
  group: Group;
  setOutput: (output: VolcanicOutput) => void;
  update: (elapsed: number) => void;
}> {
  const group = new Group();
  group.name = "volcanic-hotspot-marker";
  group.visible = false;
  const material = new MeshBasicMaterial({
    color: new Color(0xff7426), transparent: true, opacity: 0.86,
    depthWrite: false, toneMapped: false,
  });
  const ring = new Mesh(new RingGeometry(1.05, 1.72, 28), material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);
  const ember = new Mesh(new ConeGeometry(0.34, 1.25, 8), material.clone());
  ember.position.y = 0.62;
  group.add(ember);
  let pulse = 0.72;
  return {
    group,
    setOutput(output) {
      const style = hotSpotVisualStyle(output);
      material.color.setHex(style.color);
      material.opacity = style.opacity;
      const emberMaterial = ember.material as MeshBasicMaterial;
      emberMaterial.color.setHex(style.color);
      emberMaterial.opacity = Math.min(1, style.opacity + 0.08);
      pulse = style.pulse;
    },
    update(elapsed) {
      ring.scale.setScalar(1 + Math.sin(elapsed * 3.4) * 0.08 * pulse);
      ember.scale.y = 1 + Math.sin(elapsed * 4.1 + 0.7) * 0.12 * pulse;
    },
  };
}
