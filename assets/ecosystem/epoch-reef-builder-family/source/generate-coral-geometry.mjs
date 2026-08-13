#!/usr/bin/env node

import { build } from "vite";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const packageDir = resolve(import.meta.dirname, "..");
const temporaryDir = resolve(packageDir, ".generator-cache");
const outputDir = resolve(packageDir, "exports");

await rm(temporaryDir, { recursive: true, force: true });
await mkdir(temporaryDir, { recursive: true });
await mkdir(outputDir, { recursive: true });

await build({
  configFile: false,
  logLevel: "silent",
  build: {
    ssr: true,
    emptyOutDir: true,
    lib: {
      entry: resolve(packageDir, "../../../src/coral-geometry-assets.ts"),
      formats: ["es"],
      fileName: () => "authoring.mjs",
    },
    outDir: temporaryDir,
    rollupOptions: { external: (id) => id.startsWith("three") },
  },
});

const { coralGeometry } = await import(`${pathToFileURL(resolve(temporaryDir, "coral-geometry-assets.js")).href}?generated=${Date.now()}`);
const guilds = ["crustose-algae", "staghorn", "table", "massive-porites", "brain", "sea-fan"];

for (const level of ["near", "far"]) {
  const payload = {};
  for (const guild of guilds) {
    const geometry = coralGeometry(guild, level);
    payload[guild] = {
      position: Array.from(geometry.attributes.position.array),
      normal: Array.from(geometry.attributes.normal.array),
      index: Array.from(geometry.index.array),
      triangles: geometry.index.count / 3,
    };
  }
  await writeFile(resolve(outputDir, `reef-builder-${level}.json`), `${JSON.stringify(payload)}\n`);
}

await rm(temporaryDir, { recursive: true, force: true });
console.log(`Wrote deterministic reef geometry to ${outputDir}`);
