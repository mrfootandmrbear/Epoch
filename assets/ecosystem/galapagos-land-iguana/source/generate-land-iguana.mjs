import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(packageDir, "source/land-iguana.geometry.json");
const runtimeOutput = resolve(packageDir, "exports/land-iguana.runtime.json");
const positions = [];
const indices = [];
const parts = [];

function part(name, kind, center, build) {
  const start = positions.length / 3;
  build();
  parts.push({ name, kind, start, count: positions.length / 3 - start, center });
}

function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function len(a) { return Math.hypot(a[0], a[1], a[2]); }
function norm(a) {
  const l = len(a) || 1;
  return mul(a, 1 / l);
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function rotX(v, deg) {
  const t = deg * Math.PI / 180;
  const c = Math.cos(t), s = Math.sin(t);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

function rotZ(v, deg) {
  const t = deg * Math.PI / 180;
  const c = Math.cos(t), s = Math.sin(t);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}

/**
 * Pole-axis ellipsoid. pole 0 = X (spine-aligned body), 1 = Y (upright crest).
 */
function ellipsoid(name, kind, center, radii, rings = 5, sides = 10, pole = 0) {
  part(name, kind, center, () => {
    const base = positions.length / 3;
    for (let ring = 0; ring <= rings; ring++) {
      const phi = Math.PI * ring / rings;
      for (let side = 0; side < sides; side++) {
        const theta = Math.PI * 2 * side / sides;
        const along = Math.cos(phi);
        const radial = Math.sin(phi);
        const a = radial * Math.cos(theta);
        const b = radial * Math.sin(theta);
        const local = pole === 1
          ? [a * radii[0], along * radii[1], b * radii[2]]
          : [along * radii[0], a * radii[1], b * radii[2]];
        positions.push(center[0] + local[0], center[1] + local[1], center[2] + local[2]);
      }
    }
    for (let ring = 0; ring < rings; ring++) for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides;
      const a = base + ring * sides + side;
      const b = base + ring * sides + next;
      const c = base + (ring + 1) * sides + side;
      const d = base + (ring + 1) * sides + next;
      indices.push(a, c, b, b, c, d);
    }
  });
}

function orientedTube(name, kind, centers, radii, sides = 7) {
  const mid = centers[Math.floor(centers.length / 2)];
  part(name, kind, mid, () => {
    const base = positions.length / 3;
    for (let ring = 0; ring < centers.length; ring++) {
      const prev = centers[Math.max(0, ring - 1)];
      const next = centers[Math.min(centers.length - 1, ring + 1)];
      const dir = ring === 0
        ? norm(sub(centers[1] ?? centers[0], centers[0]))
        : ring === centers.length - 1
          ? norm(sub(centers[ring], centers[ring - 1]))
          : norm(sub(next, prev));
      let binormal = cross(dir, [0, 1, 0]);
      if (len(binormal) < 0.15) binormal = cross(dir, [1, 0, 0]);
      binormal = norm(binormal);
      const normal = norm(cross(binormal, dir));
      const r = radii[ring];
      for (let side = 0; side < sides; side++) {
        const angle = Math.PI * 2 * side / sides;
        const offset = add(mul(normal, Math.cos(angle) * r), mul(binormal, Math.sin(angle) * r));
        const p = add(centers[ring], offset);
        positions.push(p[0], p[1], p[2]);
      }
    }
    for (let ring = 0; ring < centers.length - 1; ring++) for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides;
      const a = base + ring * sides + side;
      const b = base + ring * sides + next;
      const c = base + (ring + 1) * sides + side;
      const d = base + (ring + 1) * sides + next;
      indices.push(a, b, c, b, d, c);
    }
  });
}

function cone(name, kind, base, tip, radius, sides = 4) {
  const center = [(base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2, (base[2] + tip[2]) / 2];
  part(name, kind, center, () => {
    const start = positions.length / 3;
    positions.push(tip[0], tip[1], tip[2]);
    for (let i = 0; i < sides; i++) {
      const angle = Math.PI * 2 * i / sides;
      positions.push(
        base[0] + Math.cos(angle) * radius,
        base[1],
        base[2] + Math.sin(angle) * radius,
      );
    }
    for (let i = 0; i < sides; i++) {
      indices.push(start, start + 1 + i, start + 1 + ((i + 1) % sides));
    }
  });
}

// Proportions follow MarineIguana's metre-true blockout (sprawl, ~0.85 m tail,
// dense midline spines) adapted for Conolophus: round tail, modest nuchal keel,
// ochre land-iguana job. Do not copy that project's GLB.
ellipsoid("body", "body", [0.06, 0.20, 0], [0.28, 0.11, 0.12], 6, 12);
ellipsoid("shoulders", "body", [0.28, 0.22, 0], [0.13, 0.105, 0.125], 5, 10);
ellipsoid("pelvis", "body", [-0.16, 0.20, 0], [0.14, 0.10, 0.12], 5, 10);
ellipsoid("neck", "head", [0.46, 0.245, 0], [0.11, 0.08, 0.075], 5, 9);
ellipsoid("head", "head", [0.64, 0.26, 0], [0.12, 0.08, 0.09], 5, 10);
ellipsoid("jowl", "head", [0.60, 0.205, 0], [0.08, 0.055, 0.10], 4, 9);
ellipsoid("snout", "head", [0.76, 0.235, 0], [0.07, 0.05, 0.06], 4, 8);
ellipsoid("dewlap", "head", [0.54, 0.10, 0], [0.08, 0.095, 0.024], 4, 8, 1);
ellipsoid("left-eye", "head", [0.68, 0.30, -0.06], [0.026, 0.02, 0.016], 3, 6);
ellipsoid("right-eye", "head", [0.68, 0.30, 0.06], [0.026, 0.02, 0.016], 3, 6);

let spineIndex = 0;
for (let sx = 0.58; sx > -0.32; sx -= 0.048) {
  const t = (0.58 - sx) / 0.90;
  const height = 0.058 * (1 - 0.52 * t);
  const backY = sx > 0.42 ? 0.31 : 0.295 - 0.04 * t;
  cone(`crest-${spineIndex}`, "horn", [sx, backY, 0], [sx - 0.01, backY + height, 0], 0.016);
  spineIndex += 1;
}

const UPPER_LEN = 0.18;
const LOWER_LEN = 0.16;
const HIP_Y = 0.27;

function sprawlLeg(prefix, hip, outSign, fwdLean) {
  const upperDir = rotZ(rotX([0, -1, 0], 55 * outSign), fwdLean);
  const lowerDir = rotZ(rotX([0, -1, 0], 18 * outSign), fwdLean);
  const elbow = add(hip, mul(upperDir, UPPER_LEN));
  const ankle = add(elbow, mul(lowerDir, LOWER_LEN));
  orientedTube(`${prefix}-leg`, "leg", [hip, elbow, ankle], [0.048, 0.034, 0.024], 7);
  const side = Math.sign(hip[2]) || outSign;
  const forward = norm([Math.cos(fwdLean * Math.PI / 180), 0, 0.12 * side]);
  ellipsoid(`${prefix}-pad`, "hoof", [ankle[0] + 0.02, 0.018, ankle[2]], [0.04, 0.012, 0.028], 3, 6);
  for (let toe = 0; toe < 4; toe++) {
    const spread = (toe - 1.5) * 0.28;
    const dir = [
      Math.cos(spread),
      0,
      side * Math.sin(spread) * 0.85,
    ];
    const tip = [ankle[0] + 0.035 + dir[0] * 0.05, 0.012, ankle[2] + dir[2] * 0.05];
    ellipsoid(`${prefix}-toe-${toe}`, "hoof", tip, [0.02, 0.007, 0.009], 2, 5);
  }
}

sprawlLeg("front-left", [0.24, HIP_Y, -0.12], 1, 10);
sprawlLeg("front-right", [0.24, HIP_Y, 0.12], -1, 10);
sprawlLeg("rear-left", [-0.12, HIP_Y, -0.14], 1, -6);
sprawlLeg("rear-right", [-0.12, HIP_Y, 0.14], -1, -6);

const tailCenters = [];
const tailRadii = [];
const TAIL_LEN = 0.85;
const TAIL_SEGS = 8;
for (let i = 0; i <= TAIL_SEGS; i++) {
  const t = i / TAIL_SEGS;
  tailCenters.push([-0.22 - TAIL_LEN * t, 0.195 - 0.08 * t, 0]);
  tailRadii.push(0.07 * (1 - t) + 0.008 * t);
}
orientedTube("tail", "tail", tailCenters, tailRadii, 7);

function morph(transform) {
  const result = new Array(positions.length).fill(0);
  for (const entry of parts) for (let i = entry.start; i < entry.start + entry.count; i++) {
    const offset = i * 3;
    const point = [positions[offset], positions[offset + 1], positions[offset + 2]];
    const next = transform(entry, point);
    result[offset] = next[0] - point[0];
    result[offset + 1] = next[1] - point[1];
    result[offset + 2] = next[2] - point[2];
  }
  return result;
}

function scaleAround(point, center, scale) {
  return point.map((value, axis) => center[axis] + (value - center[axis]) * scale[axis]);
}

const morphTargets = {
  bodyMass: morph((entry, point) => entry.kind === "body"
    ? scaleAround(point, entry.center, [1.16, 1.28, 1.32])
    : entry.kind === "head"
      ? scaleAround(point, entry.center, [1.06, 1.10, 1.16])
      : point),
  legLength: morph((entry, point) => {
    if (entry.kind === "leg" || entry.kind === "hoof") return [point[0], point[1] * 1.48, point[2]];
    return [point[0], point[1] + 0.10, point[2]];
  }),
  footWidth: morph((entry, point) => entry.kind === "hoof"
    ? scaleAround(point, entry.center, [1.22, 1, 2.05]) : point),
  insulation: morph((entry, point) => ["body", "head"].includes(entry.kind)
    ? scaleAround(point, entry.center, [1.05, 1.16, 1.18]) : point),
  hornLength: morph((entry, point) => {
    if (entry.kind !== "horn") return point;
    const base = [entry.center[0], entry.center[1] - 0.02, 0];
    return scaleAround(point, base, [1.12, 2.35, 1.22]);
  }),
  walkA: morph((entry, point) => {
    if (entry.kind !== "leg" && entry.kind !== "hoof") return point;
    const diagonalA = entry.name.includes("front-left") || entry.name.includes("rear-right");
    const swing = Math.max(0, 1 - point[1] / HIP_Y);
    const step = diagonalA ? 1 : -1;
    return [
      point[0] + 0.09 * step * swing,
      point[1] + (diagonalA ? 0.028 : 0) * swing,
      point[2] + 0.025 * step * swing,
    ];
  }),
  walkB: morph((entry, point) => {
    if (entry.kind !== "leg" && entry.kind !== "hoof") return point;
    const diagonalA = entry.name.includes("front-left") || entry.name.includes("rear-right");
    const swing = Math.max(0, 1 - point[1] / HIP_Y);
    const step = diagonalA ? 1 : -1;
    return [
      point[0] - 0.09 * step * swing,
      point[1] + (diagonalA ? 0 : 0.028) * swing,
      point[2] - 0.025 * step * swing,
    ];
  }),
};

mkdirSync(dirname(output), { recursive: true });
const geometry = { schemaVersion: 1, morphTargetsRelative: true, positions, indices, parts, morphTargets };
writeFileSync(output, `${JSON.stringify(geometry, null, 2)}\n`);
mkdirSync(dirname(runtimeOutput), { recursive: true });
writeFileSync(runtimeOutput, `${JSON.stringify({
  ...geometry,
  animations: {
    idle: { durationSeconds: 2.4, channels: [] },
    walk: { durationSeconds: 1.1, channels: ["walkA", "walkB"], loop: true },
  },
}, null, 2)}\n`);
console.log(`Wrote ${output} (${positions.length / 3} vertices, ${indices.length / 3} triangles, ${Object.keys(morphTargets).length} morph targets)`);
