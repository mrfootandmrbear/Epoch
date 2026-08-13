import { Color, MathUtils, Vector3 } from "three/webgpu";
import type { ClimateForces } from "./climate";

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

export interface HeightFogState {
  readonly density: number;
  readonly ceiling: number;
}

/** Climate expressed as bounded lower-atmosphere optical depth. */
export function resolveHeightFog(climate: Readonly<ClimateForces>): HeightFogState {
  const rainfallDensity = climate.rainfall === "wet" ? 0.00016
    : climate.rainfall === "temperate" ? 0.00014
      : 0.000045;
  const windRetention = climate.wind === "calm" ? 1.25 : 0.72;
  const temperatureRetention = climate.temperature === "cold" ? 1.2
    : climate.temperature === "warm" ? 0.68
      : 1;
  return {
    density: rainfallDensity * windRetention * temperatureRetention,
    ceiling: climate.temperature === "cold" ? 14
      : climate.temperature === "warm" ? 5
        : 9,
  };
}

/** One full day and night of the observed sky. */
export const CYCLE_SECONDS = 12 * 60;
/** Share of the cycle spent above the horizon. Night is real, but compressed. */
const DAYLIGHT_SHARE = 0.72;
// A fixed mid-latitude and season. These two angles are what give the sun an
// arc: it rises in the east, crosses the sky on a tilted plane, and sets in
// the west, instead of orbiting the compass at a constant tilt.
const LATITUDE = (34 * Math.PI) / 180;
const DECLINATION = (20 * Math.PI) / 180;

const daySun = new Color(0xfff2d9);
const dawnSun = new Color(0xffa563);
const nightSun = new Color(0x9fb4d6);
const dayAmbient = new Color(0x8eacc0);
const dawnAmbient = new Color(0x705f77);
const nightAmbient = new Color(0x2f4059);
const dayFog = new Color(0xb9ced9);
const dawnFog = new Color(0x9a7180);
const nightFog = new Color(0x1e2c3d);
const stormFog = new Color(0x697b82);

function smoothstep(min: number, max: number, value: number): number {
  const x = MathUtils.clamp((value - min) / (max - min), 0, 1);
  return x * x * (3 - 2 * x);
}

const SUNSET_HOUR_ANGLE = Math.acos(
  MathUtils.clamp(-Math.tan(LATITUDE) * Math.tan(DECLINATION), -1, 1),
);
// Warp amplitude that slows the clock through daylight and hurries it through
// night, chosen so the sun is above the horizon for exactly `DAYLIGHT_SHARE`
// of the cycle. Splicing two linear ramps would hit the same mark, but the
// rate would jump discontinuously at sunrise and sunset — the sun visibly
// changing speed the instant it touched the horizon. A single sinusoid is
// smooth everywhere including the wrap. It stays monotonic while
// |HOUR_ANGLE_WARP| < 1; at these angles it is about 0.57.
const HOUR_ANGLE_WARP = (SUNSET_HOUR_ANGLE - Math.PI * DAYLIGHT_SHARE)
  / Math.sin(Math.PI * DAYLIGHT_SHARE);

/**
 * Solar position for one point on the cycle. Phase 0 is sunrise.
 *
 * The clock is warped, not the geometry: altitude and azimuth still come from
 * the standard spherical relations, so the path stays a believable arc rather
 * than a constant-altitude sweep around the compass.
 */
function solarDirection(phase: number): Vector3 {
  // Measured from local noon, which sits half a daylight span after sunrise.
  const fromNoon = (phase - DAYLIGHT_SHARE / 2) * Math.PI * 2;
  const hourAngle = fromNoon + HOUR_ANGLE_WARP * Math.sin(fromNoon);

  const sinAltitude = Math.sin(LATITUDE) * Math.sin(DECLINATION)
    + Math.cos(LATITUDE) * Math.cos(DECLINATION) * Math.cos(hourAngle);
  const altitude = Math.asin(MathUtils.clamp(sinAltitude, -1, 1));
  const cosAzimuth = MathUtils.clamp(
    (Math.sin(DECLINATION) - Math.sin(LATITUDE) * sinAltitude)
      / Math.max(1e-6, Math.cos(LATITUDE) * Math.cos(altitude)),
    -1,
    1,
  );
  // Azimuth is measured clockwise from north. `acos` cannot tell east from
  // west, so the hour angle picks the side: the sun is east of the meridian
  // while climbing and west of it while descending, which is what makes it
  // rise in the east, set in the west, and keep going the same way at night.
  const azimuth = Math.sin(hourAngle) > 0 ? -Math.acos(cosAzimuth) : Math.acos(cosAzimuth);
  const horizontal = Math.cos(altitude);
  return new Vector3(
    Math.sin(azimuth) * horizontal,
    Math.sin(altitude),
    -Math.cos(azimuth) * horizontal,
  ).normalize();
}

export function sampleAtmosphere(elapsed: number, profile: AtmosphereProfile = "cycle"): AtmosphereState {
  const phase = ((elapsed / CYCLE_SECONDS) % 1 + 1) % 1;
  const storm = profile === "storm" ? 1 : 0;
  const sunDirection = profile === "day"
    ? new Vector3(0.55, 0.42, 0.35).normalize()
    : profile === "dawn"
      ? new Vector3(0.72, 0.2, -0.6).normalize()
      : profile === "storm"
        ? new Vector3(-0.4, 0.34, -0.5).normalize()
        : solarDirection(phase);
  const profileElevation = sunDirection.y;
  const profileDaylight = smoothstep(-0.06, 0.34, profileElevation);
  const profileHorizon = 1 - smoothstep(0.05, 0.55, profileElevation);
  const night = 1 - smoothstep(-0.16, 0.02, profileElevation);
  const sunColor = daySun.clone().lerp(dawnSun, profileHorizon * 0.85).lerp(nightSun, night);
  const ambientColor = dayAmbient.clone().lerp(dawnAmbient, profileHorizon * 0.72).lerp(nightAmbient, night);
  const fogColor = dayFog.clone().lerp(dawnFog, profileHorizon * 0.62)
    .lerp(nightFog, night)
    .lerp(stormFog, storm * 0.84);

  return {
    sunDirection,
    sunColor,
    ambientColor,
    fogColor,
    // Direct light falls to nothing as the sun reaches the horizon. A floor
    // here would be wasted: the light is placed along `sunDirection`, so below
    // the horizon it shines up at the seabed and reaches no surface. Night
    // fill is the caller's job — see the moonlight key in main.ts.
    sunIntensity: profileDaylight * 2 * (1 - storm * 0.58),
    // Skylight only falls away once the sun is properly below the horizon — at
    // sunrise the sky is still the dominant source, and dropping it there
    // turns the island into a cutout.
    ambientIntensity: (0.3 + profileDaylight * 0.44) * (1 - night * 0.32) * (1 - storm * 0.22),
    // Monotonic with daylight. Lifting exposure at night would make the
    // dimmest tone-mapping point of the whole cycle the moment of sunset, and
    // then brighten as it got darker outside.
    exposure: (0.62 + profileDaylight * 0.2) * (1 - storm * 0.18),
  };
}
