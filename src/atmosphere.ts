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

export interface ClimateMood {
  readonly keyTint: Color;
  readonly keyIntensityScale: number;
  readonly ambientTint: Color;
  readonly ambientIntensityScale: number;
  readonly hazeColor: Color;
  readonly hazeDensityScale: number;
  readonly waterTint: Color;
  readonly gradeTint: readonly [number, number, number];
  readonly gradeSaturation: number;
  readonly gradeContrast: number;
}

export interface ResolvedAtmosphere extends AtmosphereState {
  readonly mood: ClimateMood;
}

const WHITE = 0xffffff;

/** Pure render expression of authoritative climate forces. Mild/temperate is identity. */
export function climateMood(climate: Readonly<ClimateForces>): ClimateMood {
  const temperature = climate.temperature === "cold" ? -1 : climate.temperature === "warm" ? 1 : 0;
  const moisture = climate.rainfall === "arid" ? -1 : climate.rainfall === "wet" ? 1 : 0;
  const calmHumidity = climate.wind === "calm" && moisture > 0 ? 0.08 : 0;

  const keyTint = new Color(WHITE);
  if (temperature < 0) keyTint.setRGB(0.88, 0.95, 1.08);
  if (temperature > 0) keyTint.setRGB(1.09, 1.015, 0.88);
  const ambientTint = new Color(WHITE);
  if (temperature < 0) ambientTint.setRGB(0.88, 0.96, 1.09);
  if (temperature > 0) ambientTint.setRGB(1.04, 1.02, 0.94);
  if (moisture > 0) ambientTint.multiply(new Color().setRGB(0.94, 1.035, 1.025));

  const hazeColor = new Color(0xb9ced9);
  if (temperature < 0) hazeColor.set(0xaabfce);
  if (temperature > 0 && moisture < 0) hazeColor.set(0xdac9a7);
  if (temperature > 0 && moisture > 0) hazeColor.set(0x91c9c2);
  if (temperature < 0 && moisture < 0) hazeColor.set(0xaebbc5);

  const waterTint = new Color(WHITE);
  if (temperature < 0) waterTint.setRGB(0.72, 0.86, 1.0);
  if (temperature > 0 && moisture > 0) waterTint.setRGB(0.83, 1.12, 1.12);
  if (temperature > 0 && moisture < 0) waterTint.setRGB(0.88, 1.02, 1.04);

  return {
    keyTint,
    keyIntensityScale: MathUtils.clamp(1 + temperature * 0.06 - moisture * 0.07, 0.82, 1.14),
    ambientTint,
    ambientIntensityScale: MathUtils.clamp(1 + moisture * 0.08 - Math.max(0, -temperature) * 0.04, 0.86, 1.14),
    hazeColor,
    hazeDensityScale: MathUtils.clamp(1 + moisture * 0.22 + calmHumidity, 0.72, 1.3),
    waterTint,
    gradeTint: temperature < 0 ? [0.965, 0.99, 1.035] : temperature > 0 ? [1.035, 1.005, 0.965] : [1, 1, 1],
    gradeSaturation: MathUtils.clamp(1 - Math.max(0, moisture) * 0.035 + Math.max(0, -moisture) * 0.025, 0.94, 1.04),
    gradeContrast: MathUtils.clamp(1 - moisture * 0.045, 0.94, 1.05),
  };
}

export function resolveAtmosphere(
  elapsed: number,
  profile: AtmosphereProfile,
  climate: Readonly<ClimateForces>,
): ResolvedAtmosphere {
  const base = sampleAtmosphere(elapsed, profile);
  const mood = climateMood(climate);
  return {
    ...base,
    mood,
    sunColor: base.sunColor.clone().multiply(mood.keyTint),
    ambientColor: base.ambientColor.clone().multiply(mood.ambientTint),
    fogColor: climate.temperature === "mild" && climate.rainfall === "temperate"
      ? base.fogColor.clone()
      : base.fogColor.clone().lerp(mood.hazeColor, 0.58),
    sunIntensity: base.sunIntensity * mood.keyIntensityScale,
    ambientIntensity: base.ambientIntensity * mood.ambientIntensityScale,
  };
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

/** Re-anchor a live cycle so `now` samples at a chosen normalized phase. */
export function cycleOriginForPhase(now: number, phase: number): number {
  return now - phase * CYCLE_SECONDS;
}
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
