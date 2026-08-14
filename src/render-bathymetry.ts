/**
 * Render-only descent that hides the finite terrain support beneath open water.
 * Simulation elevations remain authoritative; this is only the unseen seabed
 * continuation needed by a transparent ocean renderer.
 */
export const RENDER_BATHYMETRY_DROP = 38;
export const RENDER_BOUNDARY_BAND = 14;

export function renderBathymetryOffset(distanceFromLand: number): number {
  const t = Math.max(0, Math.min(1, (distanceFromLand - 6) / 22));
  return t * t * RENDER_BATHYMETRY_DROP;
}

/** Guaranteed abyssal retirement at the finite renderer boundary. */
export function renderBoundaryHeight(height: number, edgeDistance: number, abyssHeight = -40): number {
  const t = Math.max(0, Math.min(1, (RENDER_BOUNDARY_BAND - edgeDistance) / RENDER_BOUNDARY_BAND));
  const blend = t * t;
  return height + (abyssHeight - height) * blend;
}
