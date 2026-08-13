import { Mesh } from "three/webgpu";
import { describe, expect, it } from "vitest";
import {
  createCreatureExpressionSpike,
  createMarshGrazerGeometry,
  GRAZER_MORPH_CHANNELS,
} from "./creature-expression-spike";

describe("creature expression architecture spike", () => {
  it("loads one topology-stable source across five shape and two pose channels", () => {
    const geometry = createMarshGrazerGeometry();
    const count = geometry.getAttribute("position").count;
    expect(count).toBeGreaterThan(0);
    expect(geometry.morphTargetsRelative).toBe(true);
    expect(geometry.morphAttributes.position).toHaveLength(GRAZER_MORPH_CHANNELS.length);
    for (const morph of geometry.morphAttributes.position!) expect(morph.count).toBe(count);
  });

  it("stores distinct per-instance weights in InstancedMesh.morphTexture", () => {
    const spike = createCreatureExpressionSpike([
      { shape: [0, 0, 0, 0, 0], coatWarmth: 0, coatLightness: 0, walkPhase: 0 },
      { shape: [1, 0.8, 0.6, 0.4, 0.2], coatWarmth: 1, coatLightness: 1, walkPhase: 0.75 },
    ]);
    const probe = new Mesh(spike.geometry, spike.material);
    spike.getMorphAt(0, probe);
    expect(probe.morphTargetInfluences!.slice(0, 5)).toEqual([0, 0, 0, 0, 0]);
    spike.getMorphAt(1, probe);
    [1, 0.8, 0.6, 0.4, 0.2].forEach((value, index) => {
      expect(probe.morphTargetInfluences![index]).toBeCloseTo(value, 5);
    });
    expect(probe.morphTargetInfluences![5]).toBe(0);
    expect(probe.morphTargetInfluences![6]).toBe(0.5);
    expect(spike.morphTexture?.isDataTexture).toBe(true);
    expect(spike.instanceColor?.count).toBe(2);
  });
});
