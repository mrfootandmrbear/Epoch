import { InstancedBufferAttribute, Mesh, MeshBasicMaterial } from "three/webgpu";
import { describe, expect, it } from "vitest";
import {
  createCreatureExpressionSpike,
  createLandIguanaGeometry,
  setCreatureExpressionAt,
  GRAZER_MORPH_CHANNELS,
} from "./creature-expression-spike";
import { COAT_DETAIL_ATTRIBUTE } from "./creature-material";

describe("creature expression architecture spike", () => {
  it("loads one topology-stable source across five shape and two pose channels", () => {
    const geometry = createLandIguanaGeometry();
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

  it("carries insulation per instance for the coat shader to read", () => {
    // A fragment shader cannot reach the morph texture, so the same insulation
    // that drives body bulk is mirrored onto an instanced attribute. Surface
    // and silhouette must never disagree about how thick the hide is.
    const spike = createCreatureExpressionSpike([
      { shape: [0.5, 0.5, 0.5, 0.05, 0.5], coatWarmth: 0.5, coatLightness: 0.5, walkPhase: 0 },
      { shape: [0.5, 0.5, 0.5, 0.92, 0.5], coatWarmth: 0.5, coatLightness: 0.5, walkPhase: 0 },
    ]);
    const detail = spike.geometry.getAttribute(COAT_DETAIL_ATTRIBUTE);

    // Instanced, not per-vertex: WebGPU keys the attribute's step mode off this.
    expect(detail).toBeInstanceOf(InstancedBufferAttribute);
    expect(detail.count).toBe(2);
    expect(detail.getX(0)).toBeCloseTo(0.05, 5);
    expect(detail.getX(1)).toBeCloseTo(0.92, 5);
    // The seed differs per animal so neighbours do not share identical hide.
    expect(detail.getY(0)).not.toBeCloseTo(detail.getY(1), 5);
  });

  it("keeps the coat attribute in step when an instance is re-expressed", () => {
    const spike = createCreatureExpressionSpike([
      { shape: [0.5, 0.5, 0.5, 0.1, 0.5], coatWarmth: 0.5, coatLightness: 0.5, walkPhase: 0 },
    ]);
    setCreatureExpressionAt(spike, 0, {
      shape: [0.5, 0.5, 0.5, 0.87, 0.5], coatWarmth: 0.5, coatLightness: 0.5, walkPhase: 0,
    });

    expect(spike.geometry.getAttribute(COAT_DETAIL_ATTRIBUTE).getX(0)).toBeCloseTo(0.87, 5);
  });

  it("swaps the founder hide for an unlit material when flatHide is set", () => {
    const spike = createCreatureExpressionSpike(
      [{ shape: [0.5, 0.5, 0.5, 0.5, 0.5], coatWarmth: 0.5, coatLightness: 0.5, walkPhase: 0 }],
      { flatHide: true },
    );
    expect(spike.material).toBeInstanceOf(MeshBasicMaterial);
  });
});
