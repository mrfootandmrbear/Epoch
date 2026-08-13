import {
  Color,
  RenderPipeline,
  type Camera,
  type Node,
  type Scene,
  type WebGPURenderer,
} from "three/webgpu";
import {
  float,
  luminance,
  mix,
  mrt,
  normalView,
  output,
  pass,
  saturation,
  uniform,
  vec3,
  vec4,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import type { AtmosphereProfile, ClimateMood } from "./atmosphere";

export interface PostProcessingOptions {
  enabled: boolean;
  gtao: boolean;
}

export interface ColorTreatment {
  tint: readonly [number, number, number];
  saturation: number;
  contrast: number;
}

export const COLOR_TREATMENTS: Readonly<Record<Exclude<AtmosphereProfile, "cycle">, ColorTreatment>> = {
  day: {
    tint: [1.0, 1.0, 1.0],
    saturation: 1.01,
    contrast: 1.015,
  },
  dawn: {
    tint: [1.045, 1.0, 0.93],
    saturation: 1.04,
    contrast: 1.025,
  },
  storm: {
    tint: [0.94, 0.985, 1.045],
    saturation: 0.9,
    contrast: 0.9,
  },
};

export function readPostProcessingOptions(params: URLSearchParams): PostProcessingOptions {
  return {
    enabled: params.get("post") !== "0",
    gtao: params.get("gtao") === "1",
  };
}

export function colorTreatmentFor(profile: AtmosphereProfile): ColorTreatment {
  return COLOR_TREATMENTS[profile === "cycle" ? "day" : profile];
}

export function composeColorTreatment(profile: AtmosphereProfile, mood: ClimateMood): ColorTreatment {
  const base = colorTreatmentFor(profile);
  return {
    tint: [
      base.tint[0] * mood.gradeTint[0],
      base.tint[1] * mood.gradeTint[1],
      base.tint[2] * mood.gradeTint[2],
    ],
    saturation: base.saturation * mood.gradeSaturation,
    contrast: base.contrast * mood.gradeContrast,
  };
}

export interface EpochRenderPipeline {
  render(): void;
  setProfile(profile: AtmosphereProfile, mood?: ClimateMood): void;
}

export function createEpochRenderPipeline(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
  options: PostProcessingOptions,
): EpochRenderPipeline {
  const scenePass = pass(scene, camera);
  const sceneColor = scenePass.getTextureNode("output");
  let treatedColor: Node<"vec4"> = sceneColor;

  const tint = uniform(new Color());
  const saturationAmount = uniform(1);
  const contrastAmount = uniform(1);

  if (options.enabled) {
    const tinted = sceneColor.rgb.mul(tint);
    const saturated = saturation(tinted, saturationAmount);
    const pivot = luminance(saturated);
    const contrasted = saturated.sub(vec3(pivot)).mul(contrastAmount).add(vec3(pivot));
    const graded = vec4(contrasted, sceneColor.a);

    // Keep bloom confined to exceptional HDR highlights such as sun glint.
    // Foam and pale shoreline materials remain below this extraction threshold.
    const bloomPass = bloom(graded, 0.12, 0.18, 1.35);
    bloomPass.smoothWidth.value = 0.12;
    bloomPass.setResolutionScale(0.5);
    treatedColor = graded.add(bloomPass);
  }

  if (options.gtao) {
    scenePass.setMRT(mrt({ output, normal: normalView }));
    const sceneNormal = scenePass.getTextureNode("normal");
    const sceneDepth = scenePass.getTextureNode("depth");
    const aoPass = ao(sceneDepth, sceneNormal, camera);
    // Half-resolution GTAO visibly bands across Epoch's broad primitive slopes.
    // Keep the optional evaluation path full-resolution so its visual verdict is fair.
    aoPass.resolutionScale = 1;
    aoPass.samples.value = 8;
    aoPass.radius.value = 0.22;
    aoPass.thickness.value = 1.25;
    aoPass.distanceFallOff.value = 0.72;
    aoPass.distanceExponent.value = 1.5;
    aoPass.useTemporalFiltering = false;
    const ambientOcclusion = aoPass.getTextureNode().r;
    const restrainedOcclusion = mix(float(1), ambientOcclusion, 0.32);
    treatedColor = vec4(treatedColor.rgb.mul(restrainedOcclusion), treatedColor.a);
  }

  const pipeline = new RenderPipeline(renderer, treatedColor);

  function setProfile(profile: AtmosphereProfile, mood?: ClimateMood): void {
    const treatment = mood ? composeColorTreatment(profile, mood) : colorTreatmentFor(profile);
    tint.value.setRGB(...treatment.tint);
    saturationAmount.value = treatment.saturation;
    contrastAmount.value = treatment.contrast;
  }

  setProfile("day");

  return {
    render: () => pipeline.render(),
    setProfile,
  };
}
