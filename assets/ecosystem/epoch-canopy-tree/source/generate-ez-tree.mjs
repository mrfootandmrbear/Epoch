import { build } from "esbuild";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  BufferGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const PACKAGE_DIR = new URL("..", import.meta.url);
const RUNTIME_DIR = new URL("../runtime/", import.meta.url);
const EZ_TREE_ENTRY = new URL(
  "../../../../node_modules/@dgreenheck/ez-tree/src/lib/tree.js",
  import.meta.url,
);
const EZ_TREE_COMMIT = "dcf309bd86bd521083d9c70f01f2de45fdc7c457";
const UP = new Vector3(0, 1, 0);

const families = {
  broadleaf: {
    preset: "oak_medium.json",
    seed: 41_101,
    tune(options) {
      options.branch.children[0] = 6;
      options.branch.children[1] = 3;
      options.branch.gnarliness[0] = 0.1;
      options.leaves.count = 10;
      options.leaves.size = 1.35;
    },
  },
  conifer: {
    preset: "pine_small.json",
    seed: 41_203,
    tune(options) {
      options.branch.children[0] = 28;
      options.branch.angle[1] = 104;
      options.leaves.count = 12;
      options.leaves.size = 0.86;
    },
  },
  windswept: {
    preset: "oak_medium.json",
    seed: 41_309,
    tune(options) {
      options.branch.children[0] = 5;
      options.branch.children[1] = 2;
      options.branch.force.direction = { x: 1, y: 0.18, z: 0.06 };
      options.branch.force.strength = 0.085;
      options.branch.gnarliness[0] = 0.14;
      options.leaves.count = 8;
      options.leaves.size = 1.2;
    },
  },
  mangrove: {
    preset: "ash_medium.json",
    seed: 41_417,
    tune(options) {
      options.branch.length[0] *= 0.72;
      options.branch.children[0] = 7;
      options.branch.children[1] = 3;
      options.branch.start[1] = 0.42;
      options.branch.force.direction = { x: 0.12, y: 1, z: 0.08 };
      options.branch.force.strength = 0.025;
      options.leaves.count = 12;
      options.leaves.size = 1.25;
    },
    stiltRoots: true,
  },
};

const details = {
  near: {
    sectionStride: 2,
    segmentFactor: 0.65,
    leafStride: 1,
    leafScale: 1.2,
    billboard: "single",
  },
  far: {
    sectionStride: 4,
    segmentFactor: 0.5,
    leafStride: 1,
    leafScale: 1.55,
    billboard: "single",
  },
};

function geometryRecord(geometry) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv");
  const index = geometry.getIndex();
  const encode = (attribute) => Buffer.from(
    attribute.array.buffer,
    attribute.array.byteOffset,
    attribute.array.byteLength,
  ).toString("base64");
  return {
    position: encode(position),
    normal: normal ? encode(normal) : "",
    uv: uv ? encode(uv) : "",
    index: index ? encode(index) : "",
    indexType: index?.array instanceof Uint32Array ? "uint32" : "uint16",
    triangles: index ? index.count / 3 : position.count / 3,
  };
}

function stiltRootGeometry(radius, height) {
  const parts = [];
  const start = new Vector3(0, height * 0.2, 0);
  const end = new Vector3();
  const direction = new Vector3();
  const midpoint = new Vector3();
  const quaternion = new Quaternion();
  const matrix = new Matrix4();
  for (let root = 0; root < 9; root++) {
    const angle = root / 9 * Math.PI * 2 + (root % 2) * 0.18;
    const reach = radius * (3.4 + (root % 3) * 0.38);
    end.set(Math.cos(angle) * reach, -height * 0.03, Math.sin(angle) * reach);
    direction.copy(end).sub(start);
    const length = direction.length();
    midpoint.copy(start).add(end).multiplyScalar(0.5);
    quaternion.setFromUnitVectors(UP, direction.normalize());
    matrix.compose(midpoint, quaternion, new Vector3(1, 1, 1));
    const geometry = new CylinderGeometry(radius * 0.16, radius * 0.42, length, 5);
    geometry.applyMatrix4(matrix);
    parts.push(geometry);
  }
  return mergeGeometries(parts, false);
}

function clusteredFoliage(leaves, guild, level) {
  const positions = leaves.getAttribute("position");
  const leafCount = Math.floor(positions.count / 4);
  const maxClusters = level === "near" ? 180 : 100;
  const stride = Math.max(1, Math.ceil(leafCount / maxClusters));
  const parts = [];
  const center = new Vector3();
  const first = new Vector3();
  const second = new Vector3();
  for (let leaf = 0; leaf < leafCount; leaf += stride) {
    center.set(0, 0, 0);
    for (let corner = 0; corner < 4; corner++) {
      const vertex = leaf * 4 + corner;
      center.x += positions.getX(vertex);
      center.y += positions.getY(vertex);
      center.z += positions.getZ(vertex);
    }
    center.multiplyScalar(0.25);
    first.fromBufferAttribute(positions, leaf * 4);
    second.fromBufferAttribute(positions, leaf * 4 + 1);
    const radiusMultiplier = level === "far"
      ? guild === "conifer" ? 1.45 : 1.95
      : guild === "conifer" ? 0.9 : 1.24;
    const radius = Math.max(0.3, first.distanceTo(second) * radiusMultiplier);
    const cluster = new IcosahedronGeometry(radius, 0);
    if (guild === "conifer") cluster.scale(0.62, 1.42, 0.62);
    if (guild === "windswept") cluster.scale(1.18, 0.62, 0.74);
    if (guild === "mangrove") cluster.scale(1.12, 0.7, 1.05);
    if (guild === "broadleaf") cluster.scale(0.92, 0.84, 0.92);
    cluster.rotateY((leaf * 1.618) % Math.PI);
    cluster.translate(center.x, center.y, center.z);
    parts.push(cluster);
  }
  return mergeGeometries(parts, false);
}

function normalizePair(branches, leaves, addStiltRoots) {
  branches.computeBoundingBox();
  const bounds = branches.boundingBox;
  const size = new Vector3();
  const center = new Vector3();
  bounds.getSize(size);
  bounds.getCenter(center);
  if (addStiltRoots) {
    const roots = stiltRootGeometry(Math.max(0.08, size.x * 0.025), size.y);
    branches = mergeGeometries([branches, roots], false);
    branches.computeBoundingBox();
    branches.boundingBox.getSize(size);
    branches.boundingBox.getCenter(center);
  }
  const transform = new Matrix4()
    .makeTranslation(-center.x, -bounds.min.y, -center.z)
    .premultiply(new Matrix4().makeScale(1 / size.y, 1 / size.y, 1 / size.y));
  branches.applyMatrix4(transform);
  leaves.applyMatrix4(transform);
  branches.computeVertexNormals();
  if (!leaves.getAttribute("normal")) leaves.computeVertexNormals();
  return { branches, leaves };
}

const tempDir = await mkdtemp(join(tmpdir(), "epoch-ez-tree-"));
const bundledEntry = join(tempDir, "ez-tree.mjs");
try {
  await build({
    entryPoints: [EZ_TREE_ENTRY.pathname],
    outfile: bundledEntry,
    bundle: true,
    platform: "node",
    format: "esm",
    logLevel: "silent",
  });
  const { Tree } = await import(pathToFileURL(bundledEntry));
  const output = {
    schemaVersion: 1,
    generator: "@dgreenheck/ez-tree",
    commit: EZ_TREE_COMMIT,
    normalization: "uniform height=1, trunk base y=0, centered on x/z",
    families: {},
  };

  for (const [guild, family] of Object.entries(families)) {
    const presetUrl = new URL(
      `../../../../node_modules/@dgreenheck/ez-tree/src/lib/presets/${family.preset}`,
      import.meta.url,
    );
    const preset = JSON.parse(await readFile(presetUrl, "utf8"));
    const tree = new Tree();
    tree.options.copy(preset);
    tree.options.seed = family.seed;
    tree.options.bark.textured = false;
    tree.options.bark.maps = { color: null, ao: null, normal: null, roughness: null };
    tree.options.leaves.map = null;
    family.tune(tree.options);
    output.families[guild] = {};
    for (const [level, detail] of Object.entries(details)) {
      const generated = tree.createGeometry(detail);
      const foliage = clusteredFoliage(generated.leaves, guild, level);
      const normalized = normalizePair(generated.branches, foliage, family.stiltRoots === true);
      output.families[guild][level] = {
        branches: geometryRecord(normalized.branches),
        leaves: geometryRecord(normalized.leaves),
      };
    }
  }

  await mkdir(RUNTIME_DIR, { recursive: true });
  await writeFile(new URL("ez-tree-geometries.json", RUNTIME_DIR), JSON.stringify(output));
  const summary = Object.fromEntries(Object.entries(output.families).map(([guild, levels]) => [
    guild,
    Object.fromEntries(Object.entries(levels).map(([level, pair]) => [
      level,
      Math.round(pair.branches.triangles + pair.leaves.triangles),
    ])),
  ]));
  await writeFile(new URL("ez-tree-summary.json", RUNTIME_DIR), JSON.stringify({ commit: EZ_TREE_COMMIT, triangles: summary }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
