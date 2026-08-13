import { BufferAttribute, BufferGeometry } from "three/webgpu";
import type { CoralGuild } from "./reef-succession";

/**
 * Procedural geometry for each coral growth form.
 *
 * Generated rather than authored because growth form is simulation output, not
 * art direction: a branching colony and a massive one differ because the water
 * over them differs, and the meshes have to be able to say that. Every form is
 * built in a unit box — one metre of radius, one metre of height — so the
 * renderer can scale each instance by the radius and height succession gave it.
 *
 * These are real surfaces with real silhouettes, not billboards. A staghorn
 * thicket reads as branches from any angle and a bommie occludes what is
 * behind it, which is the whole reason coral can share a frame with the ocean
 * renderer without looking pasted on.
 */

export type CoralGeometryLevel = "near" | "far";

/** Accumulates a triangle soup and hands back an indexed BufferGeometry. */
class MeshBuilder {
  private readonly positions: number[] = [];
  private readonly indices: number[] = [];

  vertex(x: number, y: number, z: number): number {
    this.positions.push(x, y, z);
    return this.positions.length / 3 - 1;
  }

  triangle(a: number, b: number, c: number): void {
    this.indices.push(a, b, c);
  }

  quad(a: number, b: number, c: number, d: number): void {
    this.triangle(a, b, c);
    this.triangle(a, c, d);
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(this.positions), 3));
    geometry.setIndex(new BufferAttribute(new Uint16Array(this.indices), 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

function hash1(n: number): number {
  const value = Math.sin(n * 127.1) * 43758.5453;
  return value - Math.floor(value);
}

function hash3(x: number, y: number, z: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return value - Math.floor(value);
}

function smoothstep01(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise over a direction, for lumpy colony surfaces. */
function valueNoise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const tx = smoothstep01(x - xi);
  const ty = smoothstep01(y - yi);
  const tz = smoothstep01(z - zi);
  const corner = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const x00 = lerp(corner(0, 0, 0), corner(1, 0, 0), tx);
  const x10 = lerp(corner(0, 1, 0), corner(1, 1, 0), tx);
  const x01 = lerp(corner(0, 0, 1), corner(1, 0, 1), tx);
  const x11 = lerp(corner(0, 1, 1), corner(1, 1, 1), tx);
  return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz) * 2 - 1;
}

/**
 * A dome of unit radius and unit height, displaced by a surface field.
 *
 * Both massive Porites and brain coral are this shape; what separates them is
 * entirely what `displace` does to it, which is also true of the real animals.
 */
function dome(
  builder: MeshBuilder,
  segments: number,
  rings: number,
  displace: (nx: number, ny: number, nz: number) => number,
): void {
  const rows: number[][] = [];
  for (let ring = 0; ring <= rings; ring++) {
    const v = ring / rings;
    // Latitude from the pole down to the seabed.
    const polar = (v * Math.PI) / 2;
    const row: number[] = [];
    for (let segment = 0; segment < segments; segment++) {
      const theta = (segment / segments) * Math.PI * 2;
      const nx = Math.sin(polar) * Math.cos(theta);
      const ny = Math.cos(polar);
      const nz = Math.sin(polar) * Math.sin(theta);
      // The skirt is pinned so the colony always meets the substrate cleanly;
      // a displaced rim would float or sink into the seabed.
      const rim = smoothstep01(Math.min(1, v * 2.4));
      const offset = displace(nx, ny, nz) * (1 - rim * 0.72);
      row.push(builder.vertex(
        nx * (1 + offset),
        Math.max(0, ny * (1 + offset)),
        nz * (1 + offset),
      ));
    }
    rows.push(row);
  }
  for (let ring = 0; ring < rings; ring++) {
    const upper = rows[ring]!;
    const lower = rows[ring + 1]!;
    for (let segment = 0; segment < segments; segment++) {
      const next = (segment + 1) % segments;
      builder.quad(upper[segment]!, lower[segment]!, lower[next]!, upper[next]!);
    }
  }
}

/** A tapered prism from `from` to `to`. The branch primitive. */
function limb(
  builder: MeshBuilder,
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  radiusFrom: number,
  radiusTo: number,
  sides: number,
): void {
  const axis: [number, number, number] = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
  const length = Math.hypot(axis[0], axis[1], axis[2]);
  if (length < 1e-5) return;
  const dir: [number, number, number] = [axis[0] / length, axis[1] / length, axis[2] / length];
  // Any vector not parallel to the branch works as a reference for the frame.
  const reference: [number, number, number] = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u: [number, number, number] = [
    reference[1] * dir[2] - reference[2] * dir[1],
    reference[2] * dir[0] - reference[0] * dir[2],
    reference[0] * dir[1] - reference[1] * dir[0],
  ];
  const uLength = Math.hypot(u[0], u[1], u[2]) || 1;
  u[0] /= uLength; u[1] /= uLength; u[2] /= uLength;
  const v: [number, number, number] = [
    dir[1] * u[2] - dir[2] * u[1],
    dir[2] * u[0] - dir[0] * u[2],
    dir[0] * u[1] - dir[1] * u[0],
  ];

  const lower: number[] = [];
  const upper: number[] = [];
  for (let side = 0; side < sides; side++) {
    const theta = (side / sides) * Math.PI * 2;
    const cx = Math.cos(theta);
    const cz = Math.sin(theta);
    const ox = u[0] * cx + v[0] * cz;
    const oy = u[1] * cx + v[1] * cz;
    const oz = u[2] * cx + v[2] * cz;
    lower.push(builder.vertex(
      from[0] + ox * radiusFrom, from[1] + oy * radiusFrom, from[2] + oz * radiusFrom,
    ));
    upper.push(builder.vertex(
      to[0] + ox * radiusTo, to[1] + oy * radiusTo, to[2] + oz * radiusTo,
    ));
  }
  for (let side = 0; side < sides; side++) {
    const next = (side + 1) % sides;
    builder.quad(lower[side]!, upper[side]!, upper[next]!, lower[next]!);
  }
  // Cap the tip so a branch end is a rounded stub rather than an open tube.
  const tip = builder.vertex(to[0], to[1], to[2]);
  for (let side = 0; side < sides; side++) {
    builder.triangle(upper[side]!, tip, upper[(side + 1) % sides]!);
  }
}

interface BranchParams {
  readonly depth: number;
  readonly sides: number;
  readonly splits: number;
  readonly spread: number;
  /** Fraction of the parent's length each child keeps. */
  readonly shorten: number;
  /** Fraction of the parent's thickness each child keeps. */
  readonly taper: number;
  /** Keeps a planar form planar, as a sea fan is. */
  readonly planar: boolean;
}

function growBranch(
  builder: MeshBuilder,
  origin: readonly [number, number, number],
  direction: readonly [number, number, number],
  length: number,
  radius: number,
  depth: number,
  seed: number,
  params: BranchParams,
): void {
  const end: [number, number, number] = [
    origin[0] + direction[0] * length,
    origin[1] + direction[1] * length,
    origin[2] + direction[2] * length,
  ];
  const childRadius = radius * params.taper;
  limb(builder, origin, end, radius, childRadius, params.sides);
  if (depth <= 0) return;

  for (let child = 0; child < params.splits; child++) {
    const roll = hash1(seed * 7.3 + child * 3.1);
    // Children fan off the parent axis. Spread opens the colony out; without
    // it a branching coral reads as a bundle of parallel sticks.
    const azimuth = params.planar
      ? (child % 2 === 0 ? 1 : -1) * (0.6 + roll * 0.5)
      : (child / params.splits) * Math.PI * 2 + roll * 1.4;
    const tiltAngle = params.spread * (0.62 + roll * 0.7);
    const nextDirection = tiltFrom(direction, azimuth, tiltAngle, params.planar);
    growBranch(
      builder,
      end,
      nextDirection,
      length * params.shorten * (0.78 + hash1(seed * 2.9 + child) * 0.42),
      childRadius,
      depth - 1,
      seed * 3.7 + child * 11.3,
      params,
    );
  }
}

/** Rotate `direction` away from its axis by `tiltAngle`, rolled to `azimuth`. */
function tiltFrom(
  direction: readonly [number, number, number],
  azimuth: number,
  tiltAngle: number,
  planar: boolean,
): [number, number, number] {
  if (planar) {
    // A fan's plane has to be fixed in advance, not derived from the parent
    // branch: the local frame swaps which axis it picks as the parent swings
    // past vertical, so a frame-relative tilt walks the colony out of its own
    // plane one generation later. Rotating about a constant Z keeps every
    // descendant in XY exactly, which is what lets the fan stand across a flow.
    const angle = (azimuth < 0 ? -1 : 1) * tiltAngle;
    const cosAngle = Math.cos(angle);
    const sinAngle = Math.sin(angle);
    const x = direction[0] * cosAngle - direction[1] * sinAngle;
    const y = direction[0] * sinAngle + direction[1] * cosAngle;
    const length = Math.hypot(x, y) || 1;
    return [x / length, y / length, 0];
  }
  const reference: readonly [number, number, number] = Math.abs(direction[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u: [number, number, number] = [
    reference[1] * direction[2] - reference[2] * direction[1],
    reference[2] * direction[0] - reference[0] * direction[2],
    reference[0] * direction[1] - reference[1] * direction[0],
  ];
  const uLength = Math.hypot(u[0], u[1], u[2]) || 1;
  u[0] /= uLength; u[1] /= uLength; u[2] /= uLength;
  const v: [number, number, number] = [
    direction[1] * u[2] - direction[2] * u[1],
    direction[2] * u[0] - direction[0] * u[2],
    direction[0] * u[1] - direction[1] * u[0],
  ];
  // A fan grows in one plane, so its children may only tilt within that plane.
  const offsetX = planar ? Math.sign(azimuth) : Math.cos(azimuth);
  const offsetZ = planar ? 0 : Math.sin(azimuth);
  const sinTilt = Math.sin(tiltAngle);
  const cosTilt = Math.cos(tiltAngle);
  const result: [number, number, number] = [
    direction[0] * cosTilt + (u[0] * offsetX + v[0] * offsetZ) * sinTilt,
    direction[1] * cosTilt + (u[1] * offsetX + v[1] * offsetZ) * sinTilt,
    direction[2] * cosTilt + (u[2] * offsetX + v[2] * offsetZ) * sinTilt,
  ];
  const length = Math.hypot(result[0], result[1], result[2]) || 1;
  return [result[0] / length, result[1] / length, result[2] / length];
}

/** Crustose coralline algae: a thin irregular crust hugging the rock. */
function buildCrust(level: CoralGeometryLevel): BufferGeometry {
  const builder = new MeshBuilder();
  const segments = level === "near" ? 22 : 12;
  const rings = level === "near" ? 4 : 2;
  const centre = builder.vertex(0, 1, 0);
  const rows: number[][] = [];
  for (let ring = 1; ring <= rings; ring++) {
    const radial = ring / rings;
    const row: number[] = [];
    for (let segment = 0; segment < segments; segment++) {
      const theta = (segment / segments) * Math.PI * 2;
      // A lobed, uneven margin. Crust spreads outward from where it settled,
      // so a perfectly circular patch would be the one wrong silhouette.
      const lobe = 1 + valueNoise3(Math.cos(theta) * 2.4, 0, Math.sin(theta) * 2.4) * 0.34;
      const radius = radial * lobe;
      row.push(builder.vertex(
        Math.cos(theta) * radius,
        (1 - radial * radial) * (0.7 + valueNoise3(Math.cos(theta) * 3, radial * 3, Math.sin(theta) * 3) * 0.3),
        Math.sin(theta) * radius,
      ));
    }
    rows.push(row);
  }
  const first = rows[0]!;
  for (let segment = 0; segment < segments; segment++) {
    builder.triangle(centre, first[segment]!, first[(segment + 1) % segments]!);
  }
  for (let ring = 0; ring < rows.length - 1; ring++) {
    const inner = rows[ring]!;
    const outer = rows[ring + 1]!;
    for (let segment = 0; segment < segments; segment++) {
      const next = (segment + 1) % segments;
      builder.quad(inner[segment]!, outer[segment]!, outer[next]!, inner[next]!);
    }
  }
  return builder.build();
}

/** Acropora staghorn: open, antler-like branching. */
function buildStaghorn(level: CoralGeometryLevel): BufferGeometry {
  const builder = new MeshBuilder();
  const params: BranchParams = {
    depth: level === "near" ? 3 : 2,
    sides: level === "near" ? 6 : 4,
    splits: 3,
    spread: 0.62,
    shorten: 0.72,
    taper: 0.66,
    planar: false,
  };
  // Several trunks from one base: a staghorn stand is a thicket of colonies,
  // not a single tree.
  const trunks = level === "near" ? 3 : 2;
  for (let trunk = 0; trunk < trunks; trunk++) {
    const theta = (trunk / trunks) * Math.PI * 2 + 0.7;
    const lean = 0.26 + hash1(trunk * 5.1) * 0.2;
    growBranch(
      builder,
      [Math.cos(theta) * 0.16, 0, Math.sin(theta) * 0.16],
      [Math.cos(theta) * lean, 1 - lean * 0.4, Math.sin(theta) * lean],
      0.46,
      0.088,
      params.depth,
      trunk * 13.7 + 1.3,
      params,
    );
  }
  return builder.build();
}

/** Acropora plate: a horizontal table on a short stalk, chasing light. */
function buildTable(level: CoralGeometryLevel): BufferGeometry {
  const builder = new MeshBuilder();
  const segments = level === "near" ? 26 : 14;
  const rings = level === "near" ? 4 : 2;
  limb(builder, [0, 0, 0], [0, 0.62, 0], 0.13, 0.1, level === "near" ? 7 : 5);

  const top: number[][] = [];
  const bottom: number[][] = [];
  for (let ring = 0; ring <= rings; ring++) {
    const radial = 0.16 + (ring / rings) * 0.84;
    const topRow: number[] = [];
    const bottomRow: number[] = [];
    for (let segment = 0; segment < segments; segment++) {
      const theta = (segment / segments) * Math.PI * 2;
      const lobe = 1 + valueNoise3(Math.cos(theta) * 2.1, 7.3, Math.sin(theta) * 2.1) * 0.2;
      const radius = radial * lobe;
      // The plate lifts at its margin, which is what makes a table read as a
      // table from below rather than as a flat disc.
      const lift = 0.62 + radial * radial * 0.3;
      const thickness = 0.055 * (1 - radial * 0.6);
      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;
      topRow.push(builder.vertex(x, lift + thickness, z));
      bottomRow.push(builder.vertex(x, lift - thickness, z));
    }
    top.push(topRow);
    bottom.push(bottomRow);
  }
  for (let ring = 0; ring < rings; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const next = (segment + 1) % segments;
      builder.quad(top[ring]![segment]!, top[ring + 1]![segment]!, top[ring + 1]![next]!, top[ring]![next]!);
      builder.quad(bottom[ring]![next]!, bottom[ring + 1]![next]!, bottom[ring + 1]![segment]!, bottom[ring]![segment]!);
    }
  }
  const outerTop = top[rings]!;
  const outerBottom = bottom[rings]!;
  for (let segment = 0; segment < segments; segment++) {
    const next = (segment + 1) % segments;
    builder.quad(outerTop[segment]!, outerBottom[segment]!, outerBottom[next]!, outerTop[next]!);
  }
  return builder.build();
}

/** Massive Porites: a lumpy hemispherical boulder. The framework builder. */
function buildMassive(level: CoralGeometryLevel): BufferGeometry {
  const builder = new MeshBuilder();
  const segments = level === "near" ? 30 : 16;
  const rings = level === "near" ? 14 : 7;
  dome(builder, segments, rings, (nx, ny, nz) => (
    valueNoise3(nx * 2.3, ny * 2.3, nz * 2.3) * 0.19
    + valueNoise3(nx * 6.1 + 12.3, ny * 6.1, nz * 6.1 - 4.2) * 0.075
  ));
  return builder.build();
}

/** Diploria brain coral: a dome carved by meandering grooves. */
function buildBrain(level: CoralGeometryLevel): BufferGeometry {
  const builder = new MeshBuilder();
  const segments = level === "near" ? 40 : 18;
  const rings = level === "near" ? 20 : 9;
  dome(builder, segments, rings, (nx, ny, nz) => {
    // Taking the sine of a smooth field turns it into winding parallel bands
    // that never close on themselves — which is exactly what a brain coral's
    // surface is, and what no amount of plain noise will produce.
    const field = valueNoise3(nx * 2.6, ny * 2.6, nz * 2.6);
    const meander = Math.sin(field * 13.5);
    return meander * 0.1 + valueNoise3(nx * 7, ny * 7, nz * 7) * 0.02;
  });
  return builder.build();
}

/** Gorgonian sea fan: a planar branching lattice standing across the flow. */
function buildSeaFan(level: CoralGeometryLevel): BufferGeometry {
  const builder = new MeshBuilder();
  const params: BranchParams = {
    depth: level === "near" ? 4 : 3,
    sides: level === "near" ? 4 : 3,
    splits: 2,
    spread: 0.54,
    shorten: 0.76,
    taper: 0.72,
    planar: true,
  };
  growBranch(builder, [0, 0, 0], [0, 1, 0], 0.34, 0.032, params.depth, 4.7, params);
  return builder.build();
}

const BUILDERS: Record<CoralGuild, (level: CoralGeometryLevel) => BufferGeometry> = {
  "crustose-algae": buildCrust,
  staghorn: buildStaghorn,
  table: buildTable,
  "massive-porites": buildMassive,
  brain: buildBrain,
  "sea-fan": buildSeaFan,
};

const cache = new Map<string, BufferGeometry>();

/** Unit-scale geometry for one growth form. Built once, then shared. */
export function coralGeometry(guild: CoralGuild, level: CoralGeometryLevel): BufferGeometry {
  const key = `${guild}:${level}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const geometry = BUILDERS[guild](level);
  cache.set(key, geometry);
  return geometry;
}
