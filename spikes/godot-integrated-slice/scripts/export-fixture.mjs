import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const output = resolve(here, "../fixture/landing-state.json");
const side = 97;
const extent = 380;
const seaLevel = 0;

function heightAt(x, z) {
  const d = Math.hypot(x * 0.92, z * 1.08);
  const island = Math.max(0, 1 - Math.pow(d / 165, 2.25));
  const ridge = 20 * Math.exp(-Math.pow((x + 24 + z * 0.16) / 38, 2));
  const highlands = 13 * Math.sin(x * 0.038 + z * 0.016) + 7 * Math.sin(z * 0.071);
  const river = 9 * Math.exp(-Math.pow((x - 18 - 16 * Math.sin(z * 0.025)) / 10, 2));
  const noise = Math.sin(x * 0.17) * Math.cos(z * 0.13);
  return island * (7 + ridge + highlands * island + noise * 3.5) - river * island - 3.2;
}

function hash(a, b, salt = 0) {
  const n = Math.sin(a * 127.1 + b * 311.7 + salt * 71.9) * 43758.5453;
  return n - Math.floor(n);
}

const heights = [];
for (let z = 0; z < side; z++) {
  for (let x = 0; x < side; x++) {
    heights.push(Number(heightAt(x / (side - 1) * extent - extent / 2, z / (side - 1) * extent - extent / 2).toFixed(4)));
  }
}

const trees = [];
const understory = [];
for (let gz = 0; gz < 52; gz++) {
  for (let gx = 0; gx < 52; gx++) {
    const x = -165 + (gx + hash(gx, gz, 1)) * 330 / 52;
    const z = -150 + (gz + hash(gx, gz, 2)) * 300 / 52;
    const y = heightAt(x, z);
    const moisture = 0.5 + Math.sin(x * 0.021 - z * 0.017) * 0.28;
    if (y > 1.3 && y < 31 && hash(gx, gz, 3) < 0.15 + moisture * 0.2) {
      trees.push([+x.toFixed(2), +y.toFixed(2), +z.toFixed(2), +(0.72 + hash(gx, gz, 4) * 0.72).toFixed(2), +(hash(gx, gz, 5) * 6.283).toFixed(3)]);
      for (let i = 0; i < 3; i++) {
        const angle = hash(gx, gz, 10 + i) * Math.PI * 2;
        const radius = 2 + hash(gx, gz, 20 + i) * 6;
        const ux = x + Math.cos(angle) * radius;
        const uz = z + Math.sin(angle) * radius;
        understory.push([+ux.toFixed(2), +heightAt(ux, uz).toFixed(2), +uz.toFixed(2), +(0.5 + hash(gx, gz, 30 + i) * 0.8).toFixed(2)]);
      }
    }
  }
}

const animals = Array.from({ length: 48 }, (_, i) => {
  const angle = i * 2.399;
  const radius = 5 + Math.sqrt(i) * 3.4;
  const x = 18 + Math.cos(angle) * radius;
  const z = 8 + Math.sin(angle) * radius * 0.62;
  return [+x.toFixed(2), +heightAt(x, z).toFixed(2), +z.toFixed(2), +(0.78 + hash(i, 4) * 0.32).toFixed(2), +(angle + 1.4).toFixed(3)];
});

const fixture = {
  schemaVersion: 1,
  metresPerUnit: 1,
  source: { preset: "weathered-island", years: 1000, captureTime: 42 },
  climate: { rainfall: "temperate", temperature: "mild", wind: "westerly", seaLevel },
  terrain: { side, extent, heights },
  trees,
  understory,
  animals,
  cameras: {
    wholeIsland: { position: [155, 78, 178], target: [0, 14, 0], fov: 55 },
    shoreline: { position: [82, 7, 119], target: [26, 3, 20], fov: 55 },
  },
};

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(fixture)}\n`);
console.log(`wrote ${output}: ${heights.length} heights, ${trees.length} trees, ${understory.length} understory, ${animals.length} animals`);

