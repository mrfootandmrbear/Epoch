import { CircleGeometry, Color, Mesh, MeshStandardMaterial } from "three/webgpu";

/**
 * Overview occupancy is a presentation mark, not an animal. A metre-true
 * land iguana is a few pixels on the 2 km proof overviews; this disc is the
 * read for which islands are inhabited. Simulation still owns site, island,
 * abundance, and identity.
 *
 * Radius is beach-scale, not island-scale, and not a second creature mesh.
 */
export const OCCUPANCY_MARK_RADIUS = 9;

/**
 * Hide the mark once the camera is close enough that the herd itself is the
 * occupancy read. Mid proof cameras and the 38 m lineage fly sit well inside
 * this; overview cameras sit well outside it.
 */
export const OCCUPANCY_HIDE_DISTANCE = 64;

export function occupancyMarkVisible(distanceMeters: number): boolean {
  return Number.isFinite(distanceMeters) && distanceMeters >= OCCUPANCY_HIDE_DISTANCE;
}

export function createOccupancyMark(color: Color): Mesh {
  const mark = new Mesh(
    new CircleGeometry(OCCUPANCY_MARK_RADIUS, 24),
    new MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.55,
      roughness: 0.82,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
  );
  mark.rotation.x = -Math.PI / 2;
  mark.visible = false;
  mark.renderOrder = 2;
  return mark;
}
