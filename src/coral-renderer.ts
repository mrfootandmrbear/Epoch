import {
  Color,
  DoubleSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three/webgpu";
import { coralGeometry, type CoralGeometryLevel } from "./coral-geometry-assets";
import {
  createCoralMaterial,
  CORAL_DETAIL_ATTRIBUTE,
  CORAL_SWAY_ATTRIBUTE,
  CORAL_TINT_ATTRIBUTE,
  type CoralMaterial,
} from "./coral-material";
import { CORAL_GUILDS, type CoralColony, type CoralGuild } from "./reef-succession";
import { createReefWaterUniforms, type ReefWaterUniforms } from "./reef-water";
import { RENDER_SCALE } from "./render-scale";

const MAX_PER_GUILD = 1000;
const NEAR_DISTANCE = RENDER_SCALE.lod.coralNear;
const LOD_REPARTITION_DISTANCE = RENDER_SCALE.lod.coralRepartition;
const UP = new Vector3(0, 1, 0);

/**
 * How much of the colony is thin enough for light to pass through it.
 *
 * A sea fan is almost entirely membrane and a Porites bommie is a solid block
 * of carbonate; the same subsurface term applied to both would make the
 * boulder glow like a lampshade.
 */
const TRANSLUCENCY: Readonly<Record<CoralGuild, number>> = {
  "crustose-algae": 0.12,
  staghorn: 0.62,
  table: 0.5,
  "massive-porites": 0.1,
  brain: 0.14,
  "sea-fan": 0.92,
};

/** How far each form bends in moving water. Stony corals do not. */
const SWAY: Readonly<Record<CoralGuild, number>> = {
  "crustose-algae": 0,
  staghorn: 0.045,
  table: 0.02,
  "massive-porites": 0,
  brain: 0,
  "sea-fan": 0.3,
};

export interface CoralRenderer {
  setReef: (colonies: readonly CoralColony[]) => void;
  update: (elapsed: number, viewPosition: Readonly<Vector3>) => void;
  setSeaLevel: (seaLevel: number) => void;
  setLighting: (sunDirection: Vector3, sunColor: Color, hazeColor: Color) => void;
  readonly water: ReefWaterUniforms;
}

interface GuildBatch {
  readonly near: InstancedMesh;
  readonly far: InstancedMesh;
}

function makeInstanced(
  scene: Group,
  guild: CoralGuild,
  level: CoralGeometryLevel,
  material: CoralMaterial,
): InstancedMesh {
  // Cloned because each mesh carries its own per-instance attributes, and the
  // geometry cache hands the same object to anyone who asks for this form.
  const geometry = coralGeometry(guild, level).clone();
  geometry.setAttribute(
    CORAL_TINT_ATTRIBUTE,
    new InstancedBufferAttribute(new Float32Array(MAX_PER_GUILD * 3), 3),
  );
  geometry.setAttribute(
    CORAL_DETAIL_ATTRIBUTE,
    new InstancedBufferAttribute(new Float32Array(MAX_PER_GUILD * 4), 4),
  );
  geometry.setAttribute(
    CORAL_SWAY_ATTRIBUTE,
    new InstancedBufferAttribute(new Float32Array(MAX_PER_GUILD * 4), 4),
  );
  const mesh = new InstancedMesh(geometry, material, MAX_PER_GUILD);
  mesh.count = 0;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  // Colonies are seated on simulation terrain that the renderer does not own,
  // so a colony near the domain edge can sit outside the mesh's own bounds.
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}

/**
 * Instanced reef rendering.
 *
 * One draw per growth form per detail level: twelve draws for the whole reef,
 * however many thousand colonies it holds. The arrangement follows the
 * vegetation renderer — colonies are repartitioned between detail levels only
 * when the camera has actually moved — because a reef is static once resolved
 * and only the camera changes what it needs.
 */
export function createCoralRenderer(scene: Group, sunDirection: Vector3): CoralRenderer {
  const water = createReefWaterUniforms();
  const material = createCoralMaterial({ water, sunDirection });
  // Fans and plates are single-sided surfaces seen from both sides.
  material.side = DoubleSide;

  const batches = {} as Record<CoralGuild, GuildBatch>;
  for (const guild of CORAL_GUILDS) {
    batches[guild] = {
      near: makeInstanced(scene, guild, "near", material),
      far: makeInstanced(scene, guild, "far", material),
    };
  }

  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const tiltRotation = new Quaternion();
  const position = new Vector3();
  const scale = new Vector3();
  const tiltAxis = new Vector3();
  const color = new Color();
  const lastViewPosition = new Vector3(Number.POSITIVE_INFINITY, 0, 0);
  let colonies: readonly CoralColony[] = [];

  function seat(mesh: InstancedMesh, index: number, colony: CoralColony): void {
    const swayAmount = SWAY[colony.guild];
    const flowLength = Math.hypot(colony.flowX, colony.flowZ);
    const flowX = flowLength > 1e-5 ? colony.flowX / flowLength : 1;
    const flowZ = flowLength > 1e-5 ? colony.flowZ / flowLength : 0;
    // A sea fan stands across the flow so the whole membrane filters moving
    // water; its geometry is built in the XY plane, so aligning local +Z with
    // the current puts the fan face-on to it. Everything else takes the
    // rotation succession gave it.
    const heading = colony.guild === "sea-fan"
      ? Math.atan2(flowX, flowZ)
      : colony.rotation;
    // Flow expressed in the instance's own frame, so the shader can bend the
    // colony downstream without knowing how the instance is oriented.
    const localFlowX = flowX * Math.cos(heading) - flowZ * Math.sin(heading);
    const localFlowZ = flowX * Math.sin(heading) + flowZ * Math.cos(heading);

    position.set(colony.x, colony.y, colony.z);
    rotation.setFromAxisAngle(UP, heading);
    if (colony.tilt !== 0) {
      // Lean across the flow rather than about an arbitrary axis, so a colony
      // on a slope leans the way the water pushed it.
      tiltAxis.set(-localFlowZ, 0, localFlowX).normalize();
      tiltRotation.setFromAxisAngle(tiltAxis, colony.tilt);
      rotation.multiply(tiltRotation);
    }
    scale.set(colony.radius, colony.height, colony.radius);
    matrix.compose(position, rotation, scale);
    mesh.setMatrixAt(index, matrix);

    color.setHSL(colony.hue, colony.saturation, colony.lightness);
    const tints = mesh.geometry.getAttribute(CORAL_TINT_ATTRIBUTE) as InstancedBufferAttribute;
    tints.setXYZ(index, color.r, color.g, color.b);

    const details = mesh.geometry.getAttribute(CORAL_DETAIL_ATTRIBUTE) as InstancedBufferAttribute;
    details.setXYZW(
      index,
      TRANSLUCENCY[colony.guild],
      colony.health,
      colony.age,
      // A stable per-colony seed so neighbours never sway in lockstep or carry
      // the same polyp pattern.
      (colony.x * 0.137 + colony.z * 0.311) % 1,
    );

    const sways = mesh.geometry.getAttribute(CORAL_SWAY_ATTRIBUTE) as InstancedBufferAttribute;
    sways.setXYZW(index, localFlowX, localFlowZ, swayAmount, colony.flowSpeed);
  }

  function repartition(viewPosition: Readonly<Vector3>): void {
    const counts = {} as Record<CoralGuild, { near: number; far: number }>;
    for (const guild of CORAL_GUILDS) counts[guild] = { near: 0, far: 0 };

    for (const colony of colonies) {
      const tally = counts[colony.guild];
      const distance = Math.hypot(colony.x - viewPosition.x, colony.z - viewPosition.z);
      const level: CoralGeometryLevel = distance < NEAR_DISTANCE ? "near" : "far";
      if (tally[level] >= MAX_PER_GUILD) continue;
      const mesh = batches[colony.guild][level];
      seat(mesh, tally[level]++, colony);
    }

    for (const guild of CORAL_GUILDS) {
      for (const level of ["near", "far"] as const) {
        const mesh = batches[guild][level];
        mesh.count = counts[guild][level];
        mesh.instanceMatrix.needsUpdate = true;
        mesh.geometry.getAttribute(CORAL_TINT_ATTRIBUTE).needsUpdate = true;
        mesh.geometry.getAttribute(CORAL_DETAIL_ATTRIBUTE).needsUpdate = true;
        mesh.geometry.getAttribute(CORAL_SWAY_ATTRIBUTE).needsUpdate = true;
      }
    }
  }

  return {
    water,
    setReef(next) {
      colonies = next;
      lastViewPosition.set(Number.POSITIVE_INFINITY, 0, 0);
    },
    setSeaLevel(seaLevel) {
      water.seaLevel.value = seaLevel;
    },
    setLighting(direction, sunColor, hazeColor) {
      material.setSunDirection(direction);
      water.hazeColor.value.copy(hazeColor);
      // A low or overcast sun cannot focus a caustic net, so the pattern has
      // to leave with the light rather than persisting into dusk.
      water.causticStrength.value = Math.min(
        1,
        Math.max(0, direction.y * 1.6) * (0.35 + sunColor.r * 0.75),
      );
    },
    update(elapsed, viewPosition) {
      water.time.value = elapsed;
      if (lastViewPosition.distanceTo(viewPosition) < LOD_REPARTITION_DISTANCE) return;
      lastViewPosition.copy(viewPosition);
      repartition(viewPosition);
    },
  };
}
