import { Color, MeshStandardNodeMaterial, Vector3 } from "three/webgpu";
import {
  attribute,
  cameraPosition,
  clamp,
  dot,
  float,
  mix,
  mx_noise_float,
  normalWorld,
  normalize,
  positionLocal,
  positionWorld,
  pow,
  sin,
  smoothstep,
  uniform,
  vec3,
} from "three/tsl";
import { proceduralBump } from "./procedural-bump";
import {
  causticLight,
  downwelling,
  opticalPath,
  waterHaze,
  waterTransmission,
  type ReefWaterUniforms,
} from "./reef-water";

/** Per-instance tissue colour. */
export const CORAL_TINT_ATTRIBUTE = "coralTint";
/** Per-instance `(translucency, health, age, seed)`. */
export const CORAL_DETAIL_ATTRIBUTE = "coralDetail";
/** Per-instance `(localFlowX, localFlowZ, swayAmount, flowSpeed)`. */
export const CORAL_SWAY_ATTRIBUTE = "coralSway";

export interface CoralMaterialOptions {
  readonly water: ReefWaterUniforms;
  readonly sunDirection: Vector3;
}

export type CoralMaterial = MeshStandardNodeMaterial & {
  setSunDirection(direction: Vector3): void;
};

/**
 * Shading for living coral tissue.
 *
 * Four things have to be true at once for a reef to sit convincingly in this
 * ocean. Tissue is translucent, so thin branches glow when the sun is behind
 * them. Water eats red before it eats blue, so colour is a function of how
 * much water the light crossed rather than a property of the colony. The
 * surface focuses light into a moving net across everything facing upward. And
 * the column between the eye and the reef is itself visible, so distant coral
 * turns into water rather than staying a small sharp shape.
 *
 * Absorption and haze are split across albedo and emissive deliberately.
 * Absorption is multiplicative and belongs on the albedo, where the scene's
 * own lights still act on it. In-scattered haze is light that never touched
 * the colony, so it must not be modulated by the colony's normal — it goes on
 * emissive and stays flat, which is exactly how a distant colony behaves.
 */
export function createCoralMaterial(options: CoralMaterialOptions): CoralMaterial {
  const material = new MeshStandardNodeMaterial({
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0,
  });
  const sunDirection = uniform(options.sunDirection.clone());
  const { seaLevel, time, hazeColor, causticStrength } = options.water;

  const tint = attribute<"vec3">(CORAL_TINT_ATTRIBUTE, "vec3");
  const detail = attribute<"vec4">(CORAL_DETAIL_ATTRIBUTE, "vec4");
  const sway = attribute<"vec4">(CORAL_SWAY_ATTRIBUTE, "vec4");
  const translucency = clamp(detail.x, 0, 1);
  const health = clamp(detail.y, 0, 1);
  const seed = detail.w;

  // Soft corals bend with the water. The profile is squared so the holdfast
  // stays put and the tip carries the motion, and a steady lean rides under
  // the oscillation because a fan in a current is not merely oscillating about
  // vertical — it is held over, and breathes around that.
  const heightFraction = clamp(positionLocal.y, 0, 1);
  const profile = heightFraction.mul(heightFraction);
  const flowSpeed = sway.w;
  const oscillation = sin(time.mul(float(0.85).add(flowSpeed.mul(0.9))).add(seed.mul(6.283)))
    .mul(float(0.35).add(flowSpeed.mul(0.4)));
  const bend = sway.z.mul(flowSpeed.mul(0.55).add(oscillation)).mul(profile);
  material.positionNode = positionLocal.add(vec3(sway.x, float(0), sway.y).mul(bend));

  const viewDistance = cameraPosition.sub(positionWorld).length();
  const path = opticalPath(seaLevel);
  const transmission = waterTransmission(path);
  const haze = waterHaze(path);
  const light = downwelling(seaLevel);

  // Bleaching is loss of the symbionts that carry the colour, so tissue does
  // not darken toward death, it pales toward the bare white skeleton under it.
  const skeleton = vec3(0.94, 0.92, 0.88);
  const mottle = mx_noise_float(positionLocal.mul(9.3).add(seed.mul(17.1)))
    .mul(0.5).add(0.5);
  const tissue = mix(skeleton, tint, health)
    .mul(float(0.88).add(mottle.mul(0.24)));

  const caustic = causticLight(time, seaLevel, normalWorld.y, causticStrength);
  const litTissue = tissue.mul(light).mul(float(1).add(caustic.mul(1.5)));
  material.colorNode = litTissue.mul(transmission).mul(float(1).sub(haze));

  // Subsurface scattering. Wrapped diffuse fills the shadowed side the way a
  // solid opaque colony never would, and the back-lit lobe is the light that
  // came through the branch toward the eye — the term that separates a living
  // thin-tissue coral from a painted rock.
  const eyeDirection = normalize(cameraPosition.sub(positionWorld));
  const wrapped = clamp(dot(normalWorld, sunDirection).mul(0.5).add(0.5), 0, 1);
  const throughLight = pow(clamp(dot(eyeDirection, sunDirection.negate()), 0, 1), 3.5);
  const scatter = tissue
    .mul(translucency)
    .mul(throughLight.mul(0.85).add(wrapped.mul(0.3)))
    .mul(light)
    .mul(transmission)
    .mul(float(1).sub(haze));
  // In-scattered light is still light: it has to dim with depth alongside
  // everything else, or a deep colony ends up sitting in brighter water than
  // the shallow one next to it.
  material.emissiveNode = scatter.add(hazeColor.mul(haze).mul(light));

  // Polyp relief, retired once it stops resolving. Corallite structure is most
  // of what a colony looks like within touching distance and none of what it
  // looks like from across the reef.
  const polypFade = float(1).sub(smoothstep(10, 34, viewDistance));
  const polyps = mx_noise_float(positionLocal.mul(34).add(seed.mul(9.7)));
  material.normalNode = proceduralBump(polyps, polypFade.mul(0.85));

  // Living tissue is wet and slightly waxy; bare bleached skeleton is chalk.
  material.roughnessNode = clamp(
    mix(float(0.94), float(0.78), health).sub(caustic.mul(0.06)),
    0.6,
    0.98,
  );

  return Object.assign(material, {
    setSunDirection(direction: Vector3) {
      sunDirection.value.copy(direction);
    },
  });
}

/**
 * Haze colour that keeps the reef agreeing with the open-water renderer.
 *
 * Sunlit shallow water scatters a bright tropical cyan, not the near-navy of
 * the deep-water term the surface shader uses for its own base. It carries a
 * good share of the sun's colour, so the reef goes warm at dawn with the sky
 * above it rather than staying midday-blue under a red sun.
 */
export function reefHazeColor(target: Color, sunColor: Color): Color {
  return target.set(0x008ca8).lerp(sunColor, 0.06);
}
