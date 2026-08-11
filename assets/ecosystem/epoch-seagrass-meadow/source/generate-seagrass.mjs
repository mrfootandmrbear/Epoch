import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function tuft(bladeCount) {
  const position = [];
  const index = [];
  for (let blade = 0; blade < bladeCount; blade++) {
    const angle = blade * 2.399963229728653 + 0.37;
    const radius = blade === 0 ? 0 : 0.18 + ((blade * 37) % 11) * 0.027;
    const centerX = Math.cos(angle) * radius;
    const centerZ = Math.sin(angle) * radius;
    const acrossX = Math.cos(angle + Math.PI / 2);
    const acrossZ = Math.sin(angle + Math.PI / 2);
    const bendX = Math.cos(angle) * (0.04 + (blade % 3) * 0.015);
    const bendZ = Math.sin(angle) * (0.04 + (blade % 3) * 0.015);
    const widths = [0.07, 0.052, 0.012];
    const heights = [0, 0.52 + (blade % 4) * 0.055, 0.88 + (blade % 5) * 0.03];
    const start = position.length / 3;
    for (let section = 0; section < 3; section++) {
      const bend = section * section;
      for (const side of [-1, 1]) {
        position.push(
          centerX + acrossX * widths[section] * side + bendX * bend,
          heights[section],
          centerZ + acrossZ * widths[section] * side + bendZ * bend,
        );
      }
    }
    index.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
    index.push(start + 2, start + 3, start + 4, start + 3, start + 5, start + 4);
  }
  return { position, index };
}

const output = {
  schemaVersion: 1,
  levels: {
    near: tuft(13),
    far: tuft(5),
  },
};
const outputPath = resolve(packageRoot, "runtime/seagrass-geometries.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output)}\n`);
console.log(`wrote ${outputPath}`);
