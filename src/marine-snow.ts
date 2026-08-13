import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  NodeMaterial,
  Vector3,
} from "three/webgpu";
import {
  attribute,
  cameraProjectionMatrix,
  cameraViewMatrix,
  clamp,
  float,
  length,
  smoothstep,
  vec3,
  vec4,
} from "three/tsl";
import { sampleCurrent, type CurrentField } from "./ocean-currents";
import { downwelling, opticalPath, underwater, type ReefWaterUniforms } from "./reef-water";

/**
 * Marine snow: the drifting organic particulate that fills real reef water.
 *
 * Clear water renders as vacuum. Suspended matter is most of what tells the
 * eye there is a medium between it and the reef, and it is the only element
 * here that makes the current legible as motion rather than as an arrangement
 * of coral — the flow field is doing the same work on both, but only the snow
 * is free to move.
 *
 * Particles are advected by the same solved current the reef was scored
 * against, so they slow and gather in the leeward wake for the same reason the
 * massive corals are there.
 */

const PARTICLE_COUNT = 2200;
/** Half-extent of the drifting box carried with the camera, in metres. */
const BOX_RADIUS = 34;
const BOX_HEIGHT = 22;
/** Metres per second a fleck settles under its own weight. */
const SINK_RATE = 0.021;
/** Snow is suspended in the flow but lags it; this reads as drift, not wind. */
const DRIFT_SCALE = 0.62;

export interface MarineSnow {
  setField: (
    field: CurrentField | undefined,
    heightAt: (x: number, z: number) => number,
    seaLevel: number,
  ) => void;
  update: (delta: number, viewPosition: Readonly<Vector3>) => void;
  setVisible: (visible: boolean) => void;
}

function hash(n: number): number {
  const value = Math.sin(n * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Four camera-facing corners per particle, positioned entirely in the vertex
 * stage from an explicit world-space centre.
 *
 * Written as a quad soup rather than instanced billboards on purpose: the
 * built-in billboard node orients by the mesh's world matrix, which for an
 * instanced mesh would swing every particle about one shared origin instead of
 * about its own.
 */
export function createMarineSnow(scene: Group, water: ReefWaterUniforms): MarineSnow {
  const centers = new Float32Array(PARTICLE_COUNT * 4 * 3);
  const corners = new Float32Array(PARTICLE_COUNT * 4 * 2);
  const details = new Float32Array(PARTICLE_COUNT * 4 * 2);
  const indices = new Uint32Array(PARTICLE_COUNT * 6);
  const CORNERS: readonly (readonly [number, number])[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let particle = 0; particle < PARTICLE_COUNT; particle++) {
    for (let corner = 0; corner < 4; corner++) {
      const vertex = particle * 4 + corner;
      corners[vertex * 2] = CORNERS[corner]![0];
      corners[vertex * 2 + 1] = CORNERS[corner]![1];
    }
    const base = particle * 4;
    indices.set([base, base + 1, base + 2, base, base + 2, base + 3], particle * 6);
  }

  const geometry = new BufferGeometry();
  const centerAttribute = new BufferAttribute(centers, 3);
  centerAttribute.setUsage(35048 /* DynamicDrawUsage */);
  const detailAttribute = new BufferAttribute(details, 2);
  detailAttribute.setUsage(35048 /* DynamicDrawUsage */);
  geometry.setAttribute("position", centerAttribute);
  geometry.setAttribute("snowCorner", new BufferAttribute(corners, 2));
  geometry.setAttribute("snowDetail", detailAttribute);
  geometry.setIndex(new BufferAttribute(indices, 1));

  const material = new NodeMaterial();
  material.transparent = true;
  material.depthWrite = false;

  const corner = attribute<"vec2">("snowCorner", "vec2");
  const detail = attribute<"vec2">("snowDetail", "vec2");
  const size = detail.x;
  const alpha = detail.y;
  // Billboard in view space, where right and up are the axes by definition, so
  // the quad faces the camera without any matrix taken apart to find them.
  // Projecting explicitly also means nothing here depends on a model matrix,
  // and the particles are unaffected by whatever group they are parented to.
  const viewCenter = cameraViewMatrix.mul(vec4(attribute<"vec3">("position", "vec3"), 1));
  const viewOffset = vec3(corner.x.mul(size), corner.y.mul(size), float(0));
  material.vertexNode = cameraProjectionMatrix.mul(vec4(viewCenter.xyz.add(viewOffset), 1));

  const path = opticalPath(water.seaLevel);
  const fleck = vec3(0.84, 0.86, 0.82).mul(downwelling(water.seaLevel));
  const haze = vec3(water.hazeColor.r, water.hazeColor.g, water.hazeColor.b);
  material.colorNode = underwater(fleck, path, haze);
  // A round soft mote rather than a visible square, and one that fades out
  // before it reaches the far plane of its own drifting box.
  const radial = float(1).sub(smoothstep(0.35, 1, length(corner)));
  material.opacityNode = clamp(alpha.mul(radial), 0, 1);

  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  // After the opaque reef so the motes composite over it correctly.
  mesh.renderOrder = 2;
  mesh.visible = false;
  scene.add(mesh);

  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  let currentField: CurrentField | undefined;
  let seabedAt: (x: number, z: number) => number = () => -40;
  let seaLevel = 0;
  let seeded = false;

  function respawn(particle: number, viewPosition: Readonly<Vector3>, scatterY: boolean): void {
    positions[particle * 3] = viewPosition.x + (hash(particle * 3.1) - 0.5) * BOX_RADIUS * 2;
    positions[particle * 3 + 2] = viewPosition.z + (hash(particle * 7.7) - 0.5) * BOX_RADIUS * 2;
    positions[particle * 3 + 1] = scatterY
      ? viewPosition.y + (hash(particle * 5.3) - 0.5) * BOX_HEIGHT
      : viewPosition.y + BOX_HEIGHT * 0.5;
    sizes[particle] = 0.018 + hash(particle * 11.9) * 0.036;
  }

  function write(particle: number, alphaValue: number): void {
    const x = positions[particle * 3]!;
    const y = positions[particle * 3 + 1]!;
    const z = positions[particle * 3 + 2]!;
    const size = sizes[particle]!;
    for (let corner = 0; corner < 4; corner++) {
      const vertex = particle * 4 + corner;
      centers[vertex * 3] = x;
      centers[vertex * 3 + 1] = y;
      centers[vertex * 3 + 2] = z;
      details[vertex * 2] = size;
      details[vertex * 2 + 1] = alphaValue;
    }
  }

  return {
    setField(field, heightAt, level) {
      currentField = field;
      seabedAt = heightAt;
      seaLevel = level;
      seeded = false;
      mesh.visible = field !== undefined;
    },
    setVisible(visible) {
      mesh.visible = visible && currentField !== undefined;
    },
    update(delta, viewPosition) {
      if (!currentField || !mesh.visible) return;
      if (!seeded) {
        for (let particle = 0; particle < PARTICLE_COUNT; particle++) {
          respawn(particle, viewPosition, true);
        }
        seeded = true;
      }
      const step = Math.min(0.06, Math.max(0, delta));

      for (let particle = 0; particle < PARTICLE_COUNT; particle++) {
        let x = positions[particle * 3]!;
        let y = positions[particle * 3 + 1]!;
        let z = positions[particle * 3 + 2]!;

        const flow = sampleCurrent(currentField, x, z);
        x += flow.x * DRIFT_SCALE * step;
        z += flow.z * DRIFT_SCALE * step;
        y -= SINK_RATE * step;

        // The box travels with the camera and wraps, which holds the visible
        // density steady however far the viewer swims.
        const offsetX = x - viewPosition.x;
        const offsetZ = z - viewPosition.z;
        if (offsetX > BOX_RADIUS) x -= BOX_RADIUS * 2;
        else if (offsetX < -BOX_RADIUS) x += BOX_RADIUS * 2;
        if (offsetZ > BOX_RADIUS) z -= BOX_RADIUS * 2;
        else if (offsetZ < -BOX_RADIUS) z += BOX_RADIUS * 2;

        const seabed = seabedAt(x, z);
        // Settled snow is gone: it lands, and what the eye sees is replenished
        // from above, which is the direction the flux actually comes from.
        if (y < seabed + 0.05 || y > seaLevel - 0.15 || y - viewPosition.y < -BOX_HEIGHT * 0.5) {
          respawn(particle, viewPosition, false);
          x = positions[particle * 3]!;
          y = Math.min(positions[particle * 3 + 1]!, seaLevel - 0.2);
          z = positions[particle * 3 + 2]!;
        }

        positions[particle * 3] = x;
        positions[particle * 3 + 1] = y;
        positions[particle * 3 + 2] = z;

        // Slack water holds its load and swept water does not, so the lee of
        // the island silts up. Both the count drawn and their opacity follow
        // shelter, because thickening only the opacity reads as fog rather
        // than as more matter suspended in the same water.
        const shelter = sampleCurrent(currentField, x, z).shelter;
        const present = hash(particle * 2.3) < 0.25 + shelter * 0.85;
        const submerged = y < seaLevel - 0.1;
        write(particle, present && submerged ? 0.16 + shelter * 0.42 : 0);
      }

      centerAttribute.needsUpdate = true;
      detailAttribute.needsUpdate = true;
    },
  };
}
