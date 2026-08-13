import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(packageDir, "source/marsh-grazer.geometry.json");
const runtimeOutput = resolve(packageDir, "exports/marsh-grazer.runtime.json");
const positions = [];
const indices = [];
const parts = [];

function part(name, kind, center, build) {
  const start = positions.length / 3;
  build();
  parts.push({ name, kind, start, count: positions.length / 3 - start, center });
}

function ellipsoid(name, kind, center, radii, rings = 5, sides = 10) {
  part(name, kind, center, () => {
    const base = positions.length / 3;
    for (let ring = 0; ring <= rings; ring++) {
      const phi = Math.PI * ring / rings;
      for (let side = 0; side < sides; side++) {
        const theta = Math.PI * 2 * side / sides;
        positions.push(
          center[0] + Math.cos(phi) * radii[0],
          center[1] + Math.sin(phi) * Math.cos(theta) * radii[1],
          center[2] + Math.sin(phi) * Math.sin(theta) * radii[2],
        );
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

ellipsoid("body", "body", [-0.15, 1.62, 0], [1.55, 0.72, 0.68], 6, 12);
ellipsoid("shoulders", "body", [0.72, 1.72, 0], [0.82, 0.68, 0.64], 5, 10);
ellipsoid("neck", "head", [1.22, 1.92, 0], [0.56, 0.62, 0.5], 5, 9);
ellipsoid("head", "head", [1.72, 2.08, 0], [0.66, 0.48, 0.48], 5, 10);
ellipsoid("muzzle", "head", [2.25, 1.94, 0], [0.5, 0.3, 0.34], 4, 9);
ellipsoid("left-ear", "head", [1.62, 2.47, -0.43], [0.22, 0.11, 0.28], 3, 7);
ellipsoid("right-ear", "head", [1.62, 2.47, 0.43], [0.22, 0.11, 0.28], 3, 7);

for (const [side, z] of [["left", -0.46], ["right", 0.46]]) {
  for (const [end, x] of [["front", 0.82], ["rear", -0.94]]) {
    tube(`${end}-${side}-leg`, "leg", [[x, 1.48, z], [x - 0.04, 0.82, z], [x + 0.02, 0.22, z]], [0.2, 0.15, 0.12]);
    ellipsoid(`${end}-${side}-hoof`, "hoof", [x + 0.09, 0.11, z], [0.25, 0.11, 0.18], 3, 7);
  }
}

for (const [side, z] of [["left", -0.25], ["right", 0.25]]) {
  tube(`${side}-horn`, "horn", [[1.69, 2.42, z], [1.58, 2.72, z * 1.12], [1.36, 2.93, z * 1.22]], [0.12, 0.085, 0.025], 7);
}
tube("tail", "tail", [[-1.55, 1.86, 0], [-1.82, 1.56, 0], [-1.87, 1.3, 0]], [0.09, 0.065, 0.035], 6);

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
    ? scaleAround(point, entry.center, [1.12, 1.18, 1.16]) : point),
  legLength: morph((entry, point) => {
    if (entry.kind === "leg" || entry.kind === "hoof") return [point[0], point[1] * 1.28, point[2]];
    return [point[0], point[1] + 0.38, point[2]];
  }),
  footWidth: morph((entry, point) => entry.kind === "hoof"
    ? scaleAround(point, entry.center, [1.4, 1, 1.55]) : point),
  insulation: morph((entry, point) => ["body", "head"].includes(entry.kind)
    ? scaleAround(point, entry.center, [1.025, 1.1, 1.12]) : point),
  hornLength: morph((entry, point) => entry.kind === "horn"
    ? scaleAround(point, [1.69, 2.42, entry.center[2]], [1.55, 1.55, 1.1]) : point),
  walkA: morph((entry, point) => {
    if (entry.kind !== "leg" && entry.kind !== "hoof") return point;
    const diagonalA = entry.name.includes("front-left") || entry.name.includes("rear-right");
    return [point[0] + (diagonalA ? 0.18 : -0.18) * (1 - point[1] / 1.5), point[1], point[2]];
  }),
  walkB: morph((entry, point) => {
    if (entry.kind !== "leg" && entry.kind !== "hoof") return point;
    const diagonalA = entry.name.includes("front-left") || entry.name.includes("rear-right");
    return [point[0] + (diagonalA ? -0.18 : 0.18) * (1 - point[1] / 1.5), point[1], point[2]];
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
