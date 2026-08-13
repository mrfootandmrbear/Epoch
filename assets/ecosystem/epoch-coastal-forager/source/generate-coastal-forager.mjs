import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const positions = [];
const indices = [];
const tags = [];

function vertex(x, y, z, tag = "body") {
  positions.push(x, y, z);
  tags.push(tag);
  return positions.length / 3 - 1;
}

function triangle(a, b, c) { indices.push(a, b, c); }
function quad(a, b, c, d) { triangle(a, b, c); triangle(a, c, d); }

// Forward is +X. The body is an ellipsoid with a pinched caudal peduncle.
const rings = 13;
const sides = 10;
const rows = [];
for (let ring = 0; ring <= rings; ring++) {
  const u = ring / rings;
  const x = -1.25 + u * 2.65;
  const profile = Math.sin(Math.PI * Math.pow(u, 0.94));
  const head = 0.78 + 0.22 * Math.sin(Math.PI * Math.min(1, u * 1.3));
  const row = [];
  for (let side = 0; side < sides; side++) {
    const angle = side / sides * Math.PI * 2;
    row.push(vertex(x, Math.sin(angle) * profile * 0.62 * head, Math.cos(angle) * profile * 0.32, "body"));
  }
  rows.push(row);
}
for (let ring = 0; ring < rings; ring++) {
  for (let side = 0; side < sides; side++) quad(rows[ring][side], rows[ring + 1][side], rows[ring + 1][(side + 1) % sides], rows[ring][(side + 1) % sides]);
}

function fin(rootA, rootB, tip, tag) {
  const a = vertex(...rootA, tag); const b = vertex(...rootB, tag); const c = vertex(...tip, tag);
  // Double-sided geometry with a small thickness offset.
  const d = vertex(rootA[0], rootA[1], rootA[2] + 0.018, tag);
  const e = vertex(rootB[0], rootB[1], rootB[2] + 0.018, tag);
  const f = vertex(tip[0], tip[1], tip[2] + 0.018, tag);
  triangle(a, b, c); triangle(f, e, d); quad(a, d, e, b); quad(b, e, f, c); quad(c, f, d, a);
}
fin([-0.42, 0.42, 0], [0.48, 0.34, 0], [0.02, 0.76, 0], "verticalFin");
fin([-0.18, -0.37, 0], [0.38, -0.31, 0], [0.04, -0.55, 0], "verticalFin");
fin([0.34, -0.04, 0.26], [0.78, -0.08, 0.2], [0.46, -0.15, 0.58], "pairedFin");
fin([0.34, -0.04, -0.26], [0.78, -0.08, -0.2], [0.46, -0.15, -0.58], "pairedFin");
fin([-1.25, 0.03, 0], [-1.17, 0.03, 0], [-1.82, 0.54, 0], "tail");
fin([-1.25, -0.03, 0], [-1.17, -0.03, 0], [-1.82, -0.54, 0], "tail");

function morph(fn) {
  return positions.map((value, i) => {
    const axis = i % 3; const vertexIndex = Math.floor(i / 3);
    const p = positions.slice(vertexIndex * 3, vertexIndex * 3 + 3);
    return fn(p, axis, tags[vertexIndex]);
  });
}

const morphTargets = {
  bodySize: morph((p, a) => p[a] * 0.34),
  streamlining: morph((p, a, tag) => a === 0 ? p[a] * 0.22 : (tag === "body" ? p[a] * -0.24 : p[a] * -0.12)),
  maneuverability: morph((p, a, tag) => a === 1 ? p[a] * (tag === "pairedFin" ? 0.55 : 0.2) : a === 2 && tag === "pairedFin" ? p[a] * 0.38 : 0),
  depthControl: morph((p, a, tag) => a === 1 && tag === "verticalFin" ? p[a] * 0.5 : 0),
  swimLeft: morph((p, a) => a === 2 ? Math.max(0, (-p[0] - 0.15) / 1.8) * 0.42 : 0),
  swimRight: morph((p, a) => a === 2 ? Math.max(0, (-p[0] - 0.15) / 1.8) * -0.42 : 0)
};

const output = { positions, indices, morphTargets, morphTargetsRelative: true };
writeFileSync(resolve(here, "coastal-forager.geometry.json"), JSON.stringify(output));
mkdirSync(resolve(here, "../exports"), { recursive: true });
writeFileSync(resolve(here, "../exports/coastal-forager.runtime.json"), JSON.stringify(output));
console.log(`generated ${positions.length / 3} vertices and ${indices.length / 3} triangles`);
