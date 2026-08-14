import { RENDER_SCALE } from "./render-scale";

export interface OceanSeaState {
  readonly windSpeed: number;
  readonly amplitudeScale: number;
  readonly chopScale: number;
  readonly crestFoamStrength: number;
}

/** Rendering sea state; storm is presentation weather, not a new climate authority. */
export function resolveOceanSeaState(baseWindSpeed: number, storm: boolean): OceanSeaState {
  return storm
    ? {
      windSpeed: Math.max(32, baseWindSpeed * 1.7),
      amplitudeScale: 0.62,
      chopScale: 2.25,
      crestFoamStrength: 1,
    }
    : {
      windSpeed: baseWindSpeed,
      amplitudeScale: RENDER_SCALE.swellAmplitudeScale,
      chopScale: 1,
      crestFoamStrength: 0.06,
    };
}
