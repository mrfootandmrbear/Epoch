import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
} from "three/webgpu";
import {
  abs, attribute, clamp, color, float, length, mix, sin, smoothstep, uniform, uv, vec2,
} from "three/tsl";
import type { TerrainHistory } from "./terrain-history";
import {
  classifyReach,
  reachAeration,
  resolveStreamSegments,
  type StreamSegment,
} from "./stream-network";
import { sampleTerrainHeight, sampleTerrainNormal, type TerrainField } from "./terrain-sampling";

const MAX_REACHES = 600;
// A steep reach spans one grid cell horizontally but several metres vertically,
// so it needs far more lengthwise subdivision than a creek to stay glued to the
// face instead of cutting a chord through it.
const SUBDIVISIONS = 8;
const VERTICES_PER_QUAD = 6;
// A flat ribbon laid on a slope reads as a painted stripe. Splitting the width
// into strips with a raised centre gives the water a rounded cross-section, so
// it catches a highlight down its spine and reads as volume instead of decal.
const CROSS_STRIPS = 4;
const MAX_CASCADE_VERTICES = MAX_REACHES * SUBDIVISIONS * CROSS_STRIPS * VERTICES_PER_QUAD;

const MAX_PLUNGES = 360;
/** A trickle can wet a cliff, but it cannot excavate a readable plunge pool. */
export const MIN_PLUNGE_DISCHARGE = 0.36;
// A plunge patch spans several metres, so it has to be subdivided to drape onto
// the bed instead of cutting a flat lid through it.
const PLUNGE_CELLS = 5;
const MAX_PLUNGE_VERTICES = MAX_PLUNGES * PLUNGE_CELLS * PLUNGE_CELLS * VERTICES_PER_QUAD;

export interface CascadeRenderer {
  setTerrain(terrain: TerrainHistory, seaLevel: number, retainedWaterSurface?: Float32Array): void;
  update(elapsed: number): void;
}

export interface PlungeSite {
  /** Cell index where falling water lands. */
  readonly cell: number;
  /** Total drop feeding this landing, in metres. */
  readonly drop: number;
  readonly discharge: number;
}

function cellX(terrain: TerrainField, cell: number): number {
  return (cell % terrain.side) * (terrain.extent / (terrain.side - 1)) - terrain.extent / 2;
}

function cellZ(terrain: TerrainField, cell: number): number {
  return Math.floor(cell / terrain.side) * (terrain.extent / (terrain.side - 1)) - terrain.extent / 2;
}

/**
 * Steep reaches whose downstream continuation is gentler — the only places a
 * plunge pool belongs. A cliff resolved as several stacked fall reaches would
 * otherwise grow a pool on every intermediate step.
 */
export function resolvePlungeSites(
  terrain: TerrainField,
  segments: readonly StreamSegment[],
  seaLevel: number,
): PlungeSite[] {
  const byFrom = new Map<number, StreamSegment>();
  for (const segment of segments) if (!byFrom.has(segment.from)) byFrom.set(segment.from, segment);

  const sites: PlungeSite[] = [];
  for (const segment of segments) {
    if (classifyReach(segment) !== "fall") continue;
    if (segment.discharge < MIN_PLUNGE_DISCHARGE) continue;
    const next = byFrom.get(segment.to);
    if (next && classifyReach(next) === "fall") continue;
    if (terrain.elevations[segment.to]! <= seaLevel + 0.2) continue;

    // Accumulate the stacked drop above this landing so a tall multi-step face
    // reads as one deep pool rather than the last step's shallow splash.
    let drop = segment.drop;
    let upstream = segments.find((candidate) => candidate.to === segment.from);
    for (let guard = 0; guard < 12 && upstream && classifyReach(upstream) === "fall"; guard++) {
      drop += upstream.drop;
      const current = upstream;
      upstream = segments.find((candidate) => candidate.to === current.from);
    }
    sites.push({ cell: segment.to, drop, discharge: segment.discharge });
  }
  return sites.slice(0, MAX_PLUNGES);
}

export interface CascadeProfile {
  /** Multiplier on the reach's water width. */
  readonly widthScale: number;
  /** Multiplier on the rounded cross-section bulge; 0 drapes flat on the bed. */
  readonly depthScale: number;
  /** Extra lift off the terrain, in metres. */
  readonly lift: number;
}

/** The moving water surface itself. */
export const CASCADE_WATER: CascadeProfile = { widthScale: 1.16, depthScale: 0.42, lift: 0 };
/**
 * The scoured channel the water runs in. Water laid on unbroken hillside reads
 * as a hose on a lawn; a wider wet-rock band underneath gives it a bed without
 * touching the authoritative heightfield.
 */
export const CASCADE_BED: CascadeProfile = { widthScale: 1.82, depthScale: 0, lift: -0.03 };

/**
 * Grade says how violently a reach could aerate; discharge says whether there
 * is enough water for that aeration to be visible. Keeping those axes separate
 * stops tiny hillside trickles from turning into full-strength white jets.
 */
export function visibleCascadeAeration(segment: StreamSegment): number {
  const volume = Math.max(0, Math.min(1, (segment.discharge - 0.16) / 0.58));
  const easedVolume = volume * volume * (3 - 2 * volume);
  return reachAeration(segment) * easedVolume;
}

/** Write terrain-hugging ribbons along steep reaches for one surface profile. */
export function writeCascadeGeometry(
  terrain: TerrainField,
  reaches: readonly StreamSegment[],
  positions: Float32Array,
  normals: Float32Array,
  uvs: Float32Array,
  aerations: Float32Array,
  profile: CascadeProfile = CASCADE_WATER,
): number {
  const half = terrain.extent / 2;
  const cellStep = terrain.extent / (terrain.side - 1);
  const surfaceNormal: [number, number, number] = [0, 1, 0];
  let vertex = 0;

  // Perfectly parallel banks are the strongest tell that a channel was drawn
  // rather than cut. Keyed off the cell index so a reach keeps the same banks
  // between rebuilds instead of shimmering when terrain is resculpted.
  const bankJitter = (cell: number, station: number): number => {
    const n = Math.sin(cell * 12.9898 + station * 78.233) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  };

  // One station on the water surface: a point across the channel at a given
  // distance along it, lifted off the bed by the channel's rounded profile.
  const station = (
    centerX: number, centerZ: number, px: number, pz: number,
    halfWidth: number, depth: number, clearance: number, u: number,
  ) => {
    const offset = (u - 0.5) * 2 * halfWidth;
    const x = centerX + px * offset;
    const z = centerZ + pz * offset;
    const bulge = Math.sin(Math.PI * u);
    const lift = clearance + depth * bulge;
    sampleTerrainNormal(terrain, x, z, surfaceNormal);
    // Tilt the shading normal away from the spine by the profile's cross-slope,
    // so the raised centre carries a highlight the flat banks do not.
    const crossSlope = (depth * Math.PI * Math.cos(Math.PI * u)) / Math.max(1e-3, 2 * halfWidth);
    const nx = surfaceNormal[0] - px * crossSlope;
    const ny = surfaceNormal[1];
    const nz = surfaceNormal[2] - pz * crossSlope;
    const scale = 1 / Math.max(1e-6, Math.hypot(nx, ny, nz));
    const shiftedX = x + surfaceNormal[0] * lift;
    const shiftedZ = z + surfaceNormal[2] * lift;
    return {
      x: shiftedX,
      // The normal offset changes x/z on steep faces. Resample at that final
      // footprint before applying vertical clearance; otherwise the vertex can
      // still end below the very terrain point it is rendered over.
      y: sampleTerrainHeight(terrain, shiftedX, shiftedZ) + Math.max(0.012, surfaceNormal[1] * lift),
      z: shiftedZ,
      nx: nx * scale, ny: ny * scale, nz: nz * scale,
      u,
    };
  };

  type Station = ReturnType<typeof station>;
  const writeVertex = (point: Station, v: number, aeration: number) => {
    const p = vertex * 3;
    positions[p] = point.x; positions[p + 1] = point.y; positions[p + 2] = point.z;
    normals[p] = point.nx; normals[p + 1] = point.ny; normals[p + 2] = point.nz;
    uvs[vertex * 2] = point.u; uvs[vertex * 2 + 1] = v;
    aerations[vertex] = aeration;
    vertex++;
  };

  for (const segment of reaches.slice(0, MAX_REACHES)) {
    const fromX = (segment.from % terrain.side) * cellStep - half;
    const fromZ = Math.floor(segment.from / terrain.side) * cellStep - half;
    const toX = (segment.to % terrain.side) * cellStep - half;
    const toZ = Math.floor(segment.to / terrain.side) * cellStep - half;
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    const horizontalLength = Math.max(0.001, Math.hypot(dx, dz));
    const px = -dz / horizontalLength;
    const pz = dx / horizontalLength;
    const aeration = visibleCascadeAeration(segment);
    // Falling water accelerates, so a steep reach runs narrower than the creek
    // feeding it and narrows further toward its base.
    // Width must approach a narrow thread at the visibility threshold. The old
    // 0.36 m floor made the weakest legal reach almost as broad as a creek and
    // was the main reason isolated steep cells read as water being spat out of
    // the hillside.
    const waterWidth = (0.1 + Math.min(1.5, Math.sqrt(segment.discharge) * 0.62))
      * (1 - aeration * 0.24);
    const width = waterWidth * profile.widthScale;
    const depth = (0.07 + waterWidth * 0.34) * profile.depthScale;
    const clearance = 0.05 + Math.min(0.1, segment.drop * 0.014) + profile.lift;

    for (let subdivision = 0; subdivision < SUBDIVISIONS; subdivision++) {
      const t0 = subdivision / SUBDIVISIONS;
      const t1 = (subdivision + 1) / SUBDIVISIONS;
      const j0 = 1 + bankJitter(segment.from, subdivision) * 0.22;
      const j1 = 1 + bankJitter(segment.from, subdivision + 1) * 0.22;
      const w0 = (width * (1 - aeration * 0.3 * t0) * j0) / 2;
      const w1 = (width * (1 - aeration * 0.3 * t1) * j1) / 2;
      // Bow each reach between its fixed endpoints. This preserves network
      // continuity while breaking the ruler-straight chord that made cascades
      // look painted onto the terrain.
      const bend = bankJitter(segment.from, 97) * Math.min(width * 0.34, horizontalLength * 0.1);
      const bend0 = Math.sin(Math.PI * t0) * bend;
      const bend1 = Math.sin(Math.PI * t1) * bend;
      const ax = fromX + dx * t0 + px * bend0; const az = fromZ + dz * t0 + pz * bend0;
      const bx = fromX + dx * t1 + px * bend1; const bz = fromZ + dz * t1 + pz * bend1;
      const d0 = segment.fromDistance + (segment.toDistance - segment.fromDistance) * t0;
      const d1 = segment.fromDistance + (segment.toDistance - segment.fromDistance) * t1;

      for (let strip = 0; strip < CROSS_STRIPS; strip++) {
        const u0 = strip / CROSS_STRIPS;
        const u1 = (strip + 1) / CROSS_STRIPS;
        const a0 = station(ax, az, px, pz, w0, depth, clearance, u0);
        const a1 = station(ax, az, px, pz, w0, depth, clearance, u1);
        const b0 = station(bx, bz, px, pz, w1, depth, clearance, u0);
        const b1 = station(bx, bz, px, pz, w1, depth, clearance, u1);
        writeVertex(a0, d0, aeration);
        writeVertex(a1, d0, aeration);
        writeVertex(b0, d1, aeration);
        writeVertex(a1, d0, aeration);
        writeVertex(b1, d1, aeration);
        writeVertex(b0, d1, aeration);
      }
    }
  }
  return vertex;
}

/** Write one horizontal foam patch per plunge site, draped just above terrain. */
export function writePlungeGeometry(
  terrain: TerrainField,
  sites: readonly PlungeSite[],
  positions: Float32Array,
  normals: Float32Array,
  uvs: Float32Array,
): number {
  let vertex = 0;
  const writeVertex = (x: number, z: number, u: number, v: number, lift: number) => {
    const p = vertex * 3;
    positions[p] = x;
    positions[p + 1] = sampleTerrainHeight(terrain, x, z) + lift;
    positions[p + 2] = z;
    normals[p] = 0; normals[p + 1] = 1; normals[p + 2] = 0;
    uvs[vertex * 2] = u; uvs[vertex * 2 + 1] = v;
    vertex++;
  };

  for (const site of sites.slice(0, MAX_PLUNGES)) {
    const centerX = cellX(terrain, site.cell);
    const centerZ = cellZ(terrain, site.cell);
    const radius = 0.7 + Math.min(1.9, Math.sqrt(site.discharge) * 0.6 + site.drop * 0.12);
    const lift = 0.08;
    for (let row = 0; row < PLUNGE_CELLS; row++) {
      for (let column = 0; column < PLUNGE_CELLS; column++) {
        const u0 = column / PLUNGE_CELLS; const u1 = (column + 1) / PLUNGE_CELLS;
        const v0 = row / PLUNGE_CELLS; const v1 = (row + 1) / PLUNGE_CELLS;
        const x0 = centerX + (u0 - 0.5) * 2 * radius; const x1 = centerX + (u1 - 0.5) * 2 * radius;
        const z0 = centerZ + (v0 - 0.5) * 2 * radius; const z1 = centerZ + (v1 - 0.5) * 2 * radius;
        writeVertex(x0, z0, u0, v0, lift);
        writeVertex(x1, z0, u1, v0, lift);
        writeVertex(x0, z1, u0, v1, lift);
        writeVertex(x1, z0, u1, v0, lift);
        writeVertex(x1, z1, u1, v1, lift);
        writeVertex(x0, z1, u0, v1, lift);
      }
    }
  }
  return vertex;
}

function createDynamicGeometry(maxVertices: number, withAeration: boolean) {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(maxVertices * 3);
  const normals = new Float32Array(maxVertices * 3);
  const uvs = new Float32Array(maxVertices * 2);
  const aerations = new Float32Array(withAeration ? maxVertices : 0);
  const positionAttribute = new BufferAttribute(positions, 3).setUsage(DynamicDrawUsage);
  const normalAttribute = new BufferAttribute(normals, 3).setUsage(DynamicDrawUsage);
  const uvAttribute = new BufferAttribute(uvs, 2).setUsage(DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setAttribute("normal", normalAttribute);
  geometry.setAttribute("uv", uvAttribute);
  let aerationAttribute: BufferAttribute | undefined;
  if (withAeration) {
    aerationAttribute = new BufferAttribute(aerations, 1).setUsage(DynamicDrawUsage);
    geometry.setAttribute("aeration", aerationAttribute);
  }
  geometry.setDrawRange(0, 0);
  return {
    geometry, positions, normals, uvs, aerations,
    markUpdated() {
      positionAttribute.needsUpdate = true;
      normalAttribute.needsUpdate = true;
      uvAttribute.needsUpdate = true;
      if (aerationAttribute) aerationAttribute.needsUpdate = true;
    },
  };
}

export function createCascadeRenderer(scene: Group): CascadeRenderer {
  const time = uniform(0);
  const creekColor = color(0x397985);
  // Foam in shadow and overcast light is blue-grey rather than paper white.
  const foamColor = color(0xb8d7da);

  const bed = createDynamicGeometry(MAX_CASCADE_VERTICES, true);
  const bedMaterial = new MeshStandardNodeMaterial({
    transparent: true,
    depthWrite: false,
    metalness: 0.02,
  });
  // Scour holds full strength under the water and out past its edges, then
  // feathers into the hillside. Fading from the channel centre instead would
  // put the only visible scour exactly where the water already covers it.
  const bedCross = clamp(abs(uv().x.sub(0.5)).mul(2), 0, 1);
  const bedScour = float(1).sub(smoothstep(0.18, 1, bedCross));
  bedMaterial.colorNode = mix(color(0x706554), color(0x554f45), bedScour);
  // Spray keeps a channel's bed damp, so it is darker and a little glossier than
  // the ground beside it — but not so glossy that it mirrors sky and reads as a
  // second body of water competing with the stream it carries.
  bedMaterial.roughnessNode = mix(float(0.86), float(0.68), bedScour);
  bedMaterial.opacityNode = clamp(bedScour.mul(0.66), 0, 1);

  const bedMesh = new Mesh(bed.geometry, bedMaterial);
  bedMesh.name = "drainage-channel-bed";
  bedMesh.renderOrder = 3;
  bedMesh.receiveShadow = true;
  bedMesh.frustumCulled = false;
  scene.add(bedMesh);

  const cascade = createDynamicGeometry(MAX_CASCADE_VERTICES, true);
  const cascadeMaterial = new MeshStandardNodeMaterial({
    transparent: true,
    depthWrite: false,
  });
  // uv.y is metres-to-outlet, so adding time moves a fixed pattern value to a
  // smaller distance each frame: the water reads as travelling downstream, and
  // it shares the creek layer's phase convention across the seam.
  const aeration = attribute<"float">("aeration", "float");
  const travel = uv().y.add(time.mul(6.4));
  const streak = sin(travel.mul(2.9).add(uv().x.mul(4.7))).mul(0.5).add(0.5);
  const spray = sin(travel.mul(8.7).sub(uv().x.mul(3.1))).mul(0.5).add(0.5);
  // Shear against the rock aerates the edges of a chute before its core.
  const shear = abs(uv().x.sub(0.5)).mul(2);
  const whitewater = clamp(
    aeration.mul(streak.mul(0.31).add(spray.mul(0.18)).add(0.035).add(shear.mul(0.14))),
    0,
    1,
  );
  cascadeMaterial.colorNode = mix(creekColor, foamColor, whitewater);
  // Aerated water scatters instead of reflecting, so foam must lose the creek's
  // gloss or a cascade reads as wet plastic.
  cascadeMaterial.roughnessNode = mix(float(0.15), float(0.86), whitewater);
  cascadeMaterial.metalnessNode = float(0.02);
  cascadeMaterial.opacityNode = clamp(float(0.72).add(whitewater.mul(0.2)), 0, 1);

  const cascadeMesh = new Mesh(cascade.geometry, cascadeMaterial);
  cascadeMesh.name = "drainage-cascades";
  cascadeMesh.renderOrder = 5;
  cascadeMesh.receiveShadow = true;
  cascadeMesh.frustumCulled = false;
  scene.add(cascadeMesh);

  const plunge = createDynamicGeometry(MAX_PLUNGE_VERTICES, false);
  const plungeMaterial = new MeshStandardNodeMaterial({
    transparent: true,
    depthWrite: false,
    roughness: 0.78,
    metalness: 0.02,
  });
  const radial = clamp(length(vec2(uv().x.sub(0.5), uv().y.sub(0.5))).mul(2), 0, 1);
  // Rings travel outward from the impact point, so the churn visibly originates
  // where the water lands rather than hovering over the pool.
  const ripple = sin(radial.mul(9.5).sub(time.mul(4.6))).mul(0.5).add(0.5);
  const impact = float(1).sub(clamp(radial.mul(2.4), 0, 1));
  const falloff = float(1).sub(radial);
  // Foam concentrates on the impact and on the ring crests. Filling the whole
  // disc with white reads as a snow patch rather than a pool.
  const churn = clamp(impact.mul(impact).mul(0.62).add(ripple.mul(falloff).mul(0.26)), 0, 1);
  plungeMaterial.colorNode = mix(creekColor, foamColor, churn);
  plungeMaterial.opacityNode = clamp(
    falloff.mul(falloff).mul(float(0.34).add(churn.mul(0.44))),
    0,
    1,
  );

  const plungeMesh = new Mesh(plunge.geometry, plungeMaterial);
  plungeMesh.name = "drainage-plunge-pools";
  plungeMesh.renderOrder = 5;
  plungeMesh.receiveShadow = true;
  plungeMesh.frustumCulled = false;
  scene.add(plungeMesh);

  return {
    setTerrain(terrain, seaLevel, retainedWaterSurface) {
      const segments = resolveStreamSegments(terrain, seaLevel, { retainedWaterSurface });
      const steep = segments.filter((segment) => {
        const kind = classifyReach(segment);
        return kind === "rapid" || kind === "fall";
      });
      // The bed spans the whole flowing network, not just the steep part, so a
      // river reads as one continuous channel rather than scour that appears
      // and vanishes wherever the grade crosses a threshold.
      const carrying = segments.filter((segment) => classifyReach(segment) !== "dry");
      const bedVertices = writeCascadeGeometry(
        terrain, carrying, bed.positions, bed.normals, bed.uvs, bed.aerations, CASCADE_BED,
      );
      bed.geometry.setDrawRange(0, bedVertices);
      bed.markUpdated();
      bedMesh.visible = bedVertices > 0;

      const cascadeVertices = writeCascadeGeometry(
        terrain, steep, cascade.positions, cascade.normals, cascade.uvs, cascade.aerations,
        CASCADE_WATER,
      );
      cascade.geometry.setDrawRange(0, cascadeVertices);
      cascade.markUpdated();
      cascadeMesh.visible = cascadeVertices > 0;

      const sites = resolvePlungeSites(terrain, segments, seaLevel);
      const plungeVertices = writePlungeGeometry(
        terrain, sites, plunge.positions, plunge.normals, plunge.uvs,
      );
      plunge.geometry.setDrawRange(0, plungeVertices);
      plunge.markUpdated();
      plungeMesh.visible = plungeVertices > 0;
    },
    update(elapsed) { time.value = elapsed; },
  };
}
