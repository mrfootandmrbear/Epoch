#!/usr/bin/env node
// Deterministic capture harness for Epoch.
//
// Drives the existing in-app capture mode (`?shot=&years=&time=`, which freezes
// simulation time, pins the RNG seed, applies a fixed golden camera, and hides
// all UI) through headless Chromium, then tiles the results into one contact
// sheet so a review costs a single image read instead of N.
//
// Requires `playwright`, which is deliberately NOT yet declared in
// package.json: adding a dependency means regenerating the lockfile, and the
// committed lockfile is currently corrupt (docs/polish/BACKLOG.md P0-1). Until
// that Work Unit lands, install it alongside the workaround install:
//
//   npm install --no-package-lock --no-save playwright
//
// Usage:
//   node scripts/capture.mjs --out docs/polish/evidence/baseline
//   node scripts/capture.mjs --set ui --out docs/polish/evidence/ui
//   node scripts/capture.mjs --width 1280 --height 720 --settle 2000
//
// The shot sets below are the fixed comparison basis for every A/B in
// docs/polish/. Changing one invalidates prior comparisons, so add a new set
// rather than editing an existing one.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

const CHROMIUM_PATH =
  process.env.EPOCH_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const SHOT_SETS = {
  // Nine states covering the epoch ladder plus the first-impression surfaces:
  // whole-island composition, shoreline, forest, herd, and two lighting moods.
  baseline: [
    { label: "01-island-1yr", query: "shot=whole-island&years=1&time=42" },
    { label: "02-island-1kyr", query: "shot=whole-island&years=1000&time=42" },
    { label: "03-island-100kyr", query: "shot=whole-island&years=100000&time=42" },
    { label: "04-island-1myr", query: "shot=whole-island&years=1000000&time=42" },
    { label: "05-shoreline", query: "shot=shoreline&years=1000&time=42" },
    { label: "06-forest-interior", query: "shot=forest-interior&years=1000&time=42" },
    { label: "07-herd", query: "shot=herd&years=1000&time=42" },
    { label: "08-dawn", query: "shot=dawn&years=1000&time=42" },
    { label: "09-storm", query: "shot=storm&years=1000&time=42" },
  ],
  // Secondary composition set: the remaining golden cameras.
  detail: [
    { label: "01-ridge-silhouette", query: "shot=ridge-silhouette&years=1000&time=42" },
    { label: "02-wave-height", query: "shot=wave-height&years=1000&time=42" },
    { label: "03-seagrass-meadow", query: "shot=seagrass-meadow&years=1000&time=42" },
    { label: "04-volcano-vigorous", query: "shot=whole-island&years=1000&time=42&volcano=vigorous" },
    { label: "05-volcano-active", query: "shot=whole-island&years=1000&time=42&volcano=active" },
    { label: "06-volcano-waning", query: "shot=whole-island&years=1000&time=42&volcano=waning" },
    { label: "07-volcano-extinct", query: "shot=whole-island&years=1000&time=42&volcano=extinct" },
    { label: "08-island-10kyr", query: "shot=whole-island&years=10000&time=42" },
    { label: "09-shoreline-1myr", query: "shot=shoreline&years=1000000&time=42" },
  ],
  // UI/HUD review runs WITHOUT capture mode, because `?shot=` hides every
  // panel. These are the surfaces a new player actually sees first.
  ui: [
    { label: "01-cold-open", query: "", settle: 3000 },
    { label: "02-after-idle", query: "", settle: 3000 },
  ],
};

function parseArgs(argv) {
  const args = {
    set: "baseline",
    out: null,
    width: 1600,
    height: 900,
    settle: 2500,
    port: 5178,
    keepFrames: true,
    // Hides navigator.gpu so WebGPURenderer takes its WebGL2 backend. Needed
    // while the three 0.185 / Chromium 141 `swizzle` incompatibility black-
    // screens the WebGPU path (see docs/polish/BACKLOG.md).
    webgl: false,
    // Off by default on purpose: --enable-unsafe-webgpu exposes experimental
    // WebGPU IDL members that a shipping browser does not, which changes
    // validation behaviour. Captures must reproduce what a real player's
    // browser does, not a superset of it.
    unsafeWebgpu: false,
    only: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    if (name === "keep-frames") { args.keepFrames = true; continue; }
    if (name === "no-keep-frames") { args.keepFrames = false; continue; }
    if (name === "webgl") { args.webgl = true; continue; }
    if (name === "unsafe-webgpu") { args.unsafeWebgpu = true; continue; }
    const value = argv[i + 1];
    i += 1;
    if (name === "width" || name === "height" || name === "settle" || name === "port") {
      args[name] = Number(value);
    } else {
      args[name] = value;
    }
  }
  if (!SHOT_SETS[args.set]) {
    throw new Error(`unknown shot set "${args.set}" (have: ${Object.keys(SHOT_SETS).join(", ")})`);
  }
  args.out ??= path.join("docs/polish/evidence", args.set);
  return args;
}

async function startDevServer(port) {
  const server = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--port", String(port), "--strictPort"],
    { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
  );
  const origin = `http://localhost:${port}`;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("vite did not start within 60s")), 60_000);
    const onData = (chunk) => {
      if (/Local:|ready in/.test(String(chunk))) {
        clearTimeout(timer);
        resolve();
      }
    };
    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
    server.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`vite exited early with code ${code}`));
    });
  });
  return { server, origin };
}

async function capture(args) {
  const shots = args.only
    ? SHOT_SETS[args.set].filter((s) => s.label.includes(args.only))
    : SHOT_SETS[args.set];
  if (shots.length === 0) throw new Error(`no shots matched --only ${args.only}`);
  const outDir = path.resolve(args.out);
  const framesDir = path.join(outDir, "frames");
  await mkdir(framesDir, { recursive: true });

  const { server, origin } = await startDevServer(args.port);
  const browser = await chromium.launch({
    // The sandbox image ships a pinned Chromium that may not match the
    // playwright package's expected build, so prefer it explicitly and let
    // playwright fall back to its own download only when it is absent.
    executablePath: existsSync(CHROMIUM_PATH) ? CHROMIUM_PATH : undefined,
    args: [
      ...(args.unsafeWebgpu ? ["--enable-unsafe-webgpu"] : []),
      "--enable-features=Vulkan,UseSkiaRenderer",
      "--use-angle=swiftshader",
      "--disable-vulkan-surface",
      "--ignore-gpu-blocklist",
      "--use-gl=angle",
    ],
  });

  const results = [];
  try {
    const page = await browser.newPage({
      viewport: { width: args.width, height: args.height },
      deviceScaleFactor: 1,
    });
    if (args.webgl) {
      // WebGPURenderer probes navigator.gpu and falls back to WebGL2 when it
      // is absent. Chromium's own --disable-features=WebGPU loses to the
      // --enable-unsafe-webgpu flag above, so hide the property instead.
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "gpu", { get: () => undefined, configurable: true });
      });
    }
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

    for (const shot of shots) {
      const url = shot.query ? `${origin}/?${shot.query}` : origin;
      const started = Date.now();
      await page.goto(url, { waitUntil: "load", timeout: 120_000 });

      if (shot.query) {
        await page.waitForFunction(
          () => document.documentElement.dataset.captureReady === "true",
          undefined,
          { timeout: 180_000 },
        );
      }
      // Simulation time is frozen in capture mode, so this settle window only
      // needs to cover lazy geometry/texture upload, not animation.
      await page.waitForTimeout(shot.settle ?? args.settle);

      const backend = await page.evaluate(() => document.getElementById("status")?.textContent ?? "");
      const file = path.join(framesDir, `${shot.label}.png`);
      await page.screenshot({ path: file, type: "png" });
      results.push({
        label: shot.label,
        file,
        url,
        backend: backend.trim(),
        ms: Date.now() - started,
      });
      process.stdout.write(`  ${shot.label}  ${Date.now() - started}ms  ${backend.trim()}\n`);
    }

    const sheet = await buildContactSheet(browser, results, args, outDir);
    await writeFile(
      path.join(outDir, "manifest.json"),
      `${JSON.stringify(
        {
          set: args.set,
          capturedAt: new Date().toISOString(),
          viewport: { width: args.width, height: args.height },
          settleMs: args.settle,
          contactSheet: path.relative(outDir, sheet),
          consoleErrors,
          shots: results.map((r) => ({
            label: r.label,
            url: r.url,
            backend: r.backend,
            ms: r.ms,
            frame: path.relative(outDir, r.file),
          })),
        },
        null,
        2,
      )}\n`,
    );

    if (consoleErrors.length > 0) {
      process.stdout.write(`\n  ${consoleErrors.length} console error(s):\n`);
      for (const e of [...new Set(consoleErrors)].slice(0, 10)) {
        process.stdout.write(`    ${e.slice(0, 200)}\n`);
      }
    }
    if (!args.keepFrames) await rm(framesDir, { recursive: true, force: true });
    process.stdout.write(`\ncontact sheet: ${sheet}\n`);
  } finally {
    await browser.close();
    server.kill("SIGTERM");
  }
}

// Tiles the frames into one downscaled sheet using a canvas in the same
// browser, which avoids adding an image-processing dependency.
async function buildContactSheet(browser, results, args, outDir) {
  const columns = Math.ceil(Math.sqrt(results.length));
  const rows = Math.ceil(results.length / columns);
  const tileWidth = Math.round(args.width / 3);
  const tileHeight = Math.round(args.height / 3);
  const labelBand = 22;

  const tiles = [];
  for (const result of results) {
    const data = await readFile(result.file);
    tiles.push({ label: result.label, dataUrl: `data:image/png;base64,${data.toString("base64")}` });
  }

  const page = await browser.newPage({
    viewport: {
      width: columns * tileWidth,
      height: rows * (tileHeight + labelBand),
    },
    deviceScaleFactor: 1,
  });
  await page.setContent("<body style='margin:0;background:#0b0d10'></body>");
  await page.evaluate(
    async ({ tiles, columns, tileWidth, tileHeight, labelBand }) => {
      const canvas = document.createElement("canvas");
      canvas.width = columns * tileWidth;
      canvas.height = Math.ceil(tiles.length / columns) * (tileHeight + labelBand);
      canvas.style.display = "block";
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#0b0d10";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingQuality = "high";

      for (let i = 0; i < tiles.length; i += 1) {
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = tiles[i].dataUrl;
        });
        const x = (i % columns) * tileWidth;
        const y = Math.floor(i / columns) * (tileHeight + labelBand);
        ctx.drawImage(image, x, y + labelBand, tileWidth, tileHeight);
        ctx.fillStyle = "#0b0d10";
        ctx.fillRect(x, y, tileWidth, labelBand);
        ctx.fillStyle = "#9fe8d8";
        ctx.font = "13px ui-monospace, Menlo, monospace";
        ctx.fillText(tiles[i].label, x + 6, y + 15);
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.strokeRect(x + 0.5, y + 0.5, tileWidth - 1, tileHeight + labelBand - 1);
      }
      document.body.appendChild(canvas);
    },
    { tiles, columns, tileWidth, tileHeight, labelBand },
  );

  const sheetPath = path.join(outDir, "contact-sheet.png");
  await page.locator("canvas").screenshot({ path: sheetPath });
  await page.close();
  return sheetPath;
}

const args = parseArgs(process.argv);
process.stdout.write(`capturing set "${args.set}" at ${args.width}x${args.height}\n`);
await capture(args);
