import { Color, type Node } from "three/webgpu";
import {
  Fn,
  abs,
  cameraPosition,
  clamp,
  exp,
  float,
  max,
  mix,
  mx_noise_float,
  positionWorld,
  pow,
  smoothstep,
  uniform,
  vec2,
  vec3,
} from "three/tsl";

/**
 * Shared underwater shading for everything standing on the seabed.
 *
 * The reef and the open ocean have to agree, or the reef reads as a diorama
 * sitting inside the water rather than as part of it. Both surfaces run the
 * same extinction, the same caustics, and the same haze colour out of this
 * module, so a colony at the edge of the reef dissolves into open water on
 * exactly the curve the water itself is using.
 */

/**
 * Extinction per metre of seawater, per channel.
 *
 * Red is absorbed several times faster than blue, which is the entire reason a
 * reef goes blue-grey with depth and why a diver's torch restores colour that
 * was there all along. The ratio between the channels is what sells the
 * effect; the absolute rate is deliberately gentler than clear tropical water
 * really is.
 *
 * That is a considered trade, not an oversight. At true coefficients a colony
 * twenty metres away has lost about ninety percent of its red, so every
 * species arrives at the eye as the same green-grey and the per-species colour
 * this renderer exists to show becomes invisible past the first few metres.
 * These rates keep a reef readable across a whole shot while still turning the
 * far side of it blue.
 */
export const EXTINCTION = Object.freeze({ red: 0.032, green: 0.011, blue: 0.006 });

/** Depth at which downwelling light has effectively stopped driving shading. */
const LIGHT_DEPTH = 26;

/**
 * Shared uniforms every submerged material reads.
 *
 * One set is created per scene and handed to each material, so the seabed and
 * the colonies standing on it cannot disagree about the sea level, the clock,
 * or the colour of the water between them and the camera.
 */
export function createReefWaterUniforms(seaLevel = 0) {
  return {
    seaLevel: uniform(seaLevel),
    time: uniform(0),
    /** Colour the water column adds back as it scatters. */
    hazeColor: uniform(new Color(0x1b5f72)),
    /** Strength of the caustic pattern, so a dull sky can turn it off. */
    causticStrength: uniform(1),
  };
}

export type ReefWaterUniforms = ReturnType<typeof createReefWaterUniforms>;

/**
 * Length of the light path through water reaching the eye from this fragment:
 * down from the surface to the seabed, then back out along the view ray.
 *
 * The view leg is computed as the submerged fraction of the camera-to-fragment
 * segment, so the same expression is correct whether the camera is swimming on
 * the reef or looking down at it from above the surface.
 */
export const opticalPath = Fn(([seaLevel]: [Node<"float">]) => {
  const fragmentY = positionWorld.y;
  const depth = max(float(0), seaLevel.sub(fragmentY));
  const viewDistance = cameraPosition.sub(positionWorld).length();
  const submergedFraction = clamp(
    seaLevel.sub(fragmentY).div(max(abs(cameraPosition.y.sub(fragmentY)), 0.001)),
    0,
    1,
  );
  return vec2(depth, viewDistance.mul(submergedFraction));
});

/**
 * Beer-Lambert survival per channel over the full light path.
 *
 * This is where the reds and oranges go. A colony that is scarlet at two
 * metres is brown at eight and grey-blue at twenty, without its albedo ever
 * changing — the water took the wavelengths, not the animal.
 */
export const waterTransmission = Fn(([path]: [Node<"vec2">]) => {
  const total = path.x.add(path.y);
  return vec3(
    exp(total.mul(-EXTINCTION.red)),
    exp(total.mul(-EXTINCTION.green)),
    exp(total.mul(-EXTINCTION.blue)),
  );
});

/**
 * How much of the view is water rather than what is behind it, 0..1.
 *
 * Only the view leg counts: light scattered into the eye comes from the column
 * between the eye and the surface it is looking at. Saturating this is what
 * makes far coral become water instead of staying a small hard silhouette, and
 * so what removes the boundary between the reef and the open sea.
 *
 * This carries more of the underwater look than absorption does. A submerged
 * scene reads blue because the column between the eye and the subject is
 * itself glowing, not because the subject's own colour curdled — leaning on
 * absorption alone turns warm sand and gold coral the same olive and leaves
 * the scene murky rather than submerged.
 */
export const waterHaze = Fn(([path]: [Node<"vec2">]) => {
  return float(1).sub(exp(path.y.mul(-0.013)));
});

/** Absorption and in-scattered haze applied to an unlit surface colour. */
export const underwater = Fn(([albedo, path, hazeColor]: [
  Node<"vec3">, Node<"vec2">, Node<"vec3">,
]) => {
  return mix(albedo.mul(waterTransmission(path)), hazeColor, waterHaze(path));
});

/**
 * Scrolling caustics: the moving light net the surface casts on the seabed.
 *
 * Two drifting noise fields differenced and sharpened. The ridge where they
 * cross is a thin bright filament, and because the two layers move at
 * different rates the filaments wander and re-form instead of cycling on a
 * visible beat. A full refractive solve against the FFT surface is the honest
 * version of this and is deferred; at reef distance this is not the term that
 * gives the trick away.
 */
export const caustics = Fn(([time, worldPosition]: [Node<"float">, Node<"vec3">]) => {
  const p = worldPosition.xz.mul(0.24);
  const first = mx_noise_float(vec3(
    p.x.add(time.mul(0.09)),
    p.y.sub(time.mul(0.07)),
    time.mul(0.05),
  ));
  const second = mx_noise_float(vec3(
    p.x.mul(1.37).sub(time.mul(0.06)),
    p.y.mul(1.37).add(time.mul(0.1)),
    time.mul(0.04).add(11.7),
  ));
  const ridge = float(1).sub(abs(first.sub(second)));
  // A second, much broader layer gives the slow bright patches that ride under
  // the fine net; without it the caustics read as uniform sparkle.
  const swell = mx_noise_float(vec3(
    p.x.mul(0.31).add(time.mul(0.03)),
    p.y.mul(0.31).sub(time.mul(0.025)),
    time.mul(0.017).add(4.3),
  )).mul(0.5).add(0.5);
  return pow(clamp(ridge, 0, 1), 11).mul(0.75).add(pow(clamp(ridge, 0, 1), 4).mul(0.25))
    .mul(swell.mul(0.7).add(0.45));
});

/**
 * Caustic light delivered to a surface, already faded for depth and facing.
 *
 * Caustics are focused surface light, so they only land on what the surface
 * can see: they fade out with depth and vanish on a downward face.
 */
export const causticLight = Fn(([time, seaLevel, upFacing, strength]: [
  Node<"float">, Node<"float">, Node<"float">, Node<"float">,
]) => {
  const depth = max(float(0), seaLevel.sub(positionWorld.y));
  // Dry ground is at zero depth, which is also the depth at which the net is
  // brightest — so without an explicit waterline the pattern climbs straight
  // out of the sea and plays across the grass.
  const submerged = smoothstep(0, 0.5, depth);
  const depthFade = float(1).sub(smoothstep(2, LIGHT_DEPTH, depth));
  // The pattern also blurs out with depth, so shallow water gets the sharp net
  // and deeper water only the broad bright patches.
  const focus = mix(float(0.45), float(1), depthFade);
  return caustics(time, positionWorld)
    .mul(submerged).mul(depthFade).mul(focus).mul(clamp(upFacing, 0, 1)).mul(strength);
});

/**
 * Downwelling light remaining at this fragment's depth, 0..1.
 * Everything on the seabed dims with depth before anything else happens to it.
 */
export const downwelling = Fn(([seaLevel]: [Node<"float">]) => {
  const depth = max(float(0), seaLevel.sub(positionWorld.y));
  return exp(depth.mul(-1 / LIGHT_DEPTH)).mul(0.82).add(0.18);
});
