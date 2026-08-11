import { Color, MathUtils, Vector3 } from "three/webgpu";

export type AtmosphereProfile = "cycle" | "day" | "dawn" | "storm";

export interface AtmosphereState {
  readonly sunDirection: Vector3;
  readonly sunColor: Color;
  readonly ambientColor: Color;
  readonly fogColor: Color;
  readonly sunIntensity: number;
  readonly ambientIntensity: number;
  readonly exposure: number;
}

const DAY_SECONDS = 8 * 60;
const daySun = new Color(0xfff2d9);
const dawnSun = new Color(0xffa563);
const dayAmbient = new Color(0x8eacc0);
const dawnAmbient = new Color(0x705f77);
const dayFog = new Color(0xb9ced9);
const dawnFog = new Color(0x9a7180);
const stormFog = new Color(0x697b82);

function smoothstep(min: number, max: number, value: number): number {
  const x = MathUtils.clamp((value - min) / (max - min), 0, 1);
  return x * x * (3 - 2 * x);
}

export function sampleAtmosphere(elapsed: number, profile: AtmosphereProfile = "cycle"): AtmosphereState {
  const phase = (elapsed / DAY_SECONDS + 0.08) % 1;
  const azimuth = phase * Math.PI * 2;
  const rawElevation = Math.sin(phase * Math.PI * 2);
  // Keep the world readable through the short night portion while still
  // allowing sunrise and sunset to reach the horizon.
  const elevation = Math.max(-0.12, rawElevation);
  const storm = profile === "storm" ? 1 : 0;
  const sunDirection = profile === "day"
    ? new Vector3(0.55, 0.42, 0.35).normalize()
    : profile === "dawn"
      ? new Vector3(0.72, 0.2, -0.6).normalize()
      : profile === "storm"
        ? new Vector3(-0.4, 0.34, -0.5).normalize()
        : new Vector3(Math.cos(azimuth), elevation, Math.sin(azimuth)).normalize();
  const profileElevation = sunDirection.y;
  const profileDaylight = smoothstep(-0.08, 0.28, profileElevation);
  const profileHorizon = 1 - smoothstep(0.08, 0.55, profileElevation);
  const sunColor = daySun.clone().lerp(dawnSun, profileHorizon * 0.82);
  const ambientColor = dayAmbient.clone().lerp(dawnAmbient, profileHorizon * 0.72);
  const fogColor = dayFog.clone().lerp(dawnFog, profileHorizon * 0.62).lerp(stormFog, storm * 0.84);

  return {
    sunDirection,
    sunColor,
    ambientColor,
    fogColor,
    sunIntensity: (0.12 + profileDaylight * 1.88) * (1 - storm * 0.58),
    ambientIntensity: (0.25 + profileDaylight * 0.34) * (1 - storm * 0.22),
    exposure: (0.48 + profileDaylight * 0.18) * (1 - storm * 0.16),
  };
}
