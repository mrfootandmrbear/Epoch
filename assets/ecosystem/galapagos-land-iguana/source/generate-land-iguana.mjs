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

function tube(name, kind, centers, radii, sides = 7) {
  const center = centers[Math.floor(centers.length / 2)];
  part(name, kind, center, () => {
    const base = positions.length / 3;
    for (let ring = 0; ring < centers.length; ring++) {
      const [cx, cy, cz] = centers[ring];
      for (let side = 0; side < sides; side++) {
        const angle = Math.PI * 2 * side / sides;
        positions.push(cx + Math.cos(angle) * radii[ring], cy, cz + Math.sin(angle) * radii[ring]);
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

// Metre-true large adult Conolophus: ~1.34 m snout-to-tail, ~0.26 m hip.
ellipsoid("body", "body", [-0.06, 0.205, 0], [0.30, 0.115, 0.105], 6, 12);
ellipsoid("shoulders", "body", [0.18, 0.215, 0], [0.14, 0.105, 0.115], 5, 10);
ellipsoid("pelvis", "body", [-0.28, 0.20, 0], [0.13, 0.10, 0.11], 5, 10);
ellipsoid("neck", "head", [0.34, 0.235, 0], [0.11, 0.085, 0.075], 5, 9);
ellipsoid("head", "head", [0.48, 0.25, 0], [0.115, 0.075, 0.085], 5, 10);
ellipsoid("jowl", "head", [0.44, 0.205, 0], [0.08, 0.055, 0.095], 4, 9);
ellipsoid("snout", "head", [0.60, 0.225, 0], [0.075, 0.048, 0.055], 4, 9);
ellipsoid("dewlap", "head", [0.42, 0.105, 0], [0.07, 0.09, 0.022], 4, 8, 1);
ellipsoid("left-eye", "head", [0.52, 0.285, -0.055], [0.028, 0.022, 0.018], 3, 6);
ellipsoid("right-eye", "head", [0.52, 0.285, 0.055], [0.028, 0.022, 0.018], 3, 6);

// Sagittal crest: nuchal spikes taller than the dorsal keel. kind "horn"
// so hornLength morphs crest height, never mammal horn pairs.
const crest = [
  ["nuchal-1", [0.42, 0.325, 0], [0.028, 0.038, 0.018]],
  ["nuchal-2", [0.36, 0.345, 0], [0.03, 0.048, 0.02]],
  ["nuchal-3", [0.30, 0.335, 0], [0.028, 0.04, 0.018]],
  ["nuchal-4", [0.24, 0.32, 0], [0.03, 0.032, 0.016]],
  ["dorsal-1", [0.14, 0.315, 0], [0.036, 0.024, 0.014]],
  ["dorsal-2", [0.02, 0.305, 0], [0.038, 0.02, 0.013]],
  ["dorsal-3", [-0.10, 0.298, 0], [0.034, 0.016, 0.012]],
  ["dorsal-4", [-0.22, 0.29, 0], [0.03, 0.012, 0.01]],
];
for (const [name, center, radii] of crest) {
  ellipsoid(name, "horn", center, radii, 3, 6, 1);
}

for (const [side, z] of [["left", -1], ["right", 1]]) {
  const hipZ = z * 0.10;
  const footZ = z * 0.13;
  tube(`front-${side}-leg`, "leg", [
    [0.16, 0.175, hipZ],
    [0.18, 0.10, z * 0.135],
    [0.20, 0.04, footZ],
  ], [0.042, 0.032, 0.026], 7);
  ellipsoid(`front-${side}-foot`, "hoof", [0.235, 0.02, footZ], [0.055, 0.016, 0.038], 3, 7);
  tube(`rear-${side}-leg`, "leg", [
    [-0.26, 0.175, hipZ],
    [-0.24, 0.10, z * 0.14],
    [-0.22, 0.04, footZ],
  ], [0.048, 0.036, 0.028], 7);
  ellipsoid(`rear-${side}-foot`, "hoof", [-0.185, 0.02, footZ], [0.06, 0.016, 0.042], 3, 7);
}

tube("tail", "tail", [
  [-0.40, 0.185, 0],
  [-0.55, 0.15, 0],
  [-0.68, 0.11, 0],
  [-0.78, 0.07, 0],
], [0.055, 0.038, 0.024, 0.012], 7);

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

const HIP = 0.26;

const morphTargets = {
  bodyMass: morph((entry, point) => entry.kind === "body"
    ? scaleAround(point, entry.center, [1.10, 1.16, 1.18])
    : entry.kind === "head"
      ? scaleAround(point, entry.center, [1.04, 1.06, 1.10])
      : point),
  legLength: morph((entry, point) => {
    if (entry.kind === "leg" || entry.kind === "hoof") return [point[0], point[1] * 1.32, point[2]];
    return [point[0], point[1] + 0.07, point[2]];
  }),
  footWidth: morph((entry, point) => entry.kind === "hoof"
    ? scaleAround(point, entry.center, [1.25, 1, 1.55]) : point),
  insulation: morph((entry, point) => ["body", "head"].includes(entry.kind)
    ? scaleAround(point, entry.center, [1.03, 1.08, 1.10]) : point),
  hornLength: morph((entry, point) => {
    if (entry.kind !== "horn") return point;
    const base = [entry.center[0], entry.center[1] - 0.018, 0];
    return scaleAround(point, base, [1.12, 1.55, 1.18]);
  }),
  walkA: morph((entry, point) => {
    if (entry.kind !== "leg" && entry.kind !== "hoof") return point;
    const diagonalA = entry.name.includes("front-left") || entry.name.includes("rear-right");
    const swing = (1 - point[1] / HIP);
    return [point[0] + (diagonalA ? 0.07 : -0.07) * swing, point[1], point[2]];
  }),
  walkB: morph((entry, point) => {
    if (entry.kind !== "leg" && entry.kind !== "hoof") return point;
    const diagonalA = entry.name.includes("front-left") || entry.name.includes("rear-right");
    const swing = (1 - point[1] / HIP);
    return [point[0] + (diagonalA ? -0.07 : 0.07) * swing, point[1], point[2]];
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
