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
  // The 2 km world, added with the `islandExtent` change on 2026-08-15. This
  // is a *new baseline*, not a continuation of `baseline`: the sets above were
  // framed for a 380 m world and their images are not comparable with these.
  // Nothing above was edited, so prior evidence stays readable on its own terms.
  baseline2km: [
    { label: "01-island-1yr", query: "shot=w2k-whole-island&years=1&time=42" },
    { label: "02-island-1kyr", query: "shot=w2k-whole-island&years=1000&time=42" },
    { label: "03-island-100kyr", query: "shot=w2k-whole-island&years=100000&time=42" },
    { label: "04-island-1myr", query: "shot=w2k-whole-island&years=1000000&time=42" },
    { label: "05-shield-profile", query: "shot=w2k-shield-profile&years=1000&time=42" },
    { label: "06-saddle", query: "shot=w2k-saddle&years=1000&time=42" },
    { label: "07-shoreline", query: "shot=w2k-shoreline&years=1000&time=42" },
    { label: "08-dawn", query: "shot=w2k-dawn&years=1000&time=42" },
    { label: "09-storm", query: "shot=w2k-storm&years=1000&time=42" },
  ],
  // Shield construction across the volcanic lifecycle, at the radius the
  // 2 km grid can actually contain.
  shield2km: [
    { label: "01-vigorous", query: "shot=w2k-shield-profile&years=1000&time=42&volcano=vigorous" },
    { label: "02-active", query: "shot=w2k-shield-profile&years=1000&time=42&volcano=active" },
    { label: "03-waning", query: "shot=w2k-shield-profile&years=1000&time=42&volcano=waning" },
    { label: "04-extinct", query: "shot=w2k-shield-profile&years=1000&time=42&volcano=extinct" },
    { label: "05-vigorous-overview", query: "shot=w2k-whole-island&years=1000&time=42&volcano=vigorous" },
    { label: "06-vigorous-1myr", query: "shot=w2k-whole-island&years=1000000&time=42&volcano=vigorous" },
    { label: "07-reef-above", query: "shot=w2k-reef-above&fixture=mature-warm-reef&time=42" },
  ],
  // Multi-shield accretion, added 2026-08-15. The before/after for pointing
  // `resolveVolcanicAccretion` at the archipelago shield record.
  //
  // `plume=dormant` IS the "before": a dormant plume freezes the chain at the
  // authored island and resolves exactly the terrain the old single-vent path
  // produced, so 01/02 against 03/04 is a like-for-like A/B of the seam rather
  // than a comparison against a differently-framed historical capture.
  //
  // `jumps=` is required — the chain is a sequence, and one long jump does not
  // reproduce it (see the note at the `jumps` parameter in `main.ts`).
  chain2km: [
    { label: "01-dormant-chain-3myr", query: "shot=w2k-chain&years=1000000&jumps=3&time=42&plume=dormant" },
    { label: "02-dormant-saddle-3myr", query: "shot=w2k-chain-saddle&years=1000000&jumps=3&time=42&plume=dormant" },
    { label: "03-active-chain-3myr", query: "shot=w2k-chain&years=1000000&jumps=3&time=42&plume=active" },
    { label: "04-active-saddle-3myr", query: "shot=w2k-chain-saddle&years=1000000&jumps=3&time=42&plume=active" },
    { label: "05-active-chain-1myr", query: "shot=w2k-chain&years=1000000&jumps=1&time=42&plume=active" },
    { label: "06-active-chain-2myr", query: "shot=w2k-chain&years=1000000&jumps=2&time=42&plume=active" },
    { label: "07-active-saddle-2myr", query: "shot=w2k-chain-saddle&years=1000000&jumps=2&time=42&plume=active" },
    { label: "08-hyperactive-chain-3myr", query: "shot=w2k-chain&years=1000000&jumps=3&time=42&plume=hyperactive" },
    { label: "09-hyperactive-saddle-3myr", query: "shot=w2k-chain-saddle&years=1000000&jumps=3&time=42&plume=hyperactive" },
    { label: "10-active-overview-3myr", query: "shot=w2k-whole-island&years=1000000&jumps=3&time=42&plume=active" },
  ],
  // Serialized proof sequence: geology → isolation → adaptation chain from a
  // single Distant Drifter founder on the default weathered island with an
  // active plume. The three fixtures demonstrate establishment, island dispersal
  // speciation, and continued diversification. Population-level cameras will be
  // added with item 4 (render descendant populations); these currently show the
  // geological context.
  //
  // Proof URLs (live app):
  //   Established:  ?founders=drifter&plume=active&years=1000000&jumps=2
  //   Speciated:    ?founders=drifter&plume=active&years=1000000&jumps=3
  //   Diversified:  ?founders=drifter&plume=active&years=1000000&jumps=5
  proofSequence: [
    { label: "01-geology-1myr", query: "shot=w2k-chain&years=1000000&jumps=1&time=42&plume=active&founders=drifter" },
    { label: "02-established-2myr", query: "shot=w2k-chain&years=1000000&jumps=2&time=42&plume=active&founders=drifter" },
    { label: "03-established-saddle", query: "shot=w2k-chain-saddle&years=1000000&jumps=2&time=42&plume=active&founders=drifter" },
    { label: "04-speciated-3myr", query: "shot=w2k-chain&years=1000000&jumps=3&time=42&plume=active&founders=drifter" },
    { label: "05-speciated-saddle", query: "shot=w2k-chain-saddle&years=1000000&jumps=3&time=42&plume=active&founders=drifter" },
    { label: "06-diversified-5myr", query: "shot=w2k-chain&years=1000000&jumps=5&time=42&plume=active&founders=drifter" },
    { label: "07-diversified-overview", query: "shot=w2k-whole-island&years=1000000&jumps=5&time=42&plume=active&founders=drifter" },
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
  // Shared underwater-medium regression: organisms must inherit the accepted
  // reef's extinction, haze, caustics, and depth lighting without changing the
  // protected coral/seabed composition itself.
  underwaterOptics: [
    { label: "01-fish", query: "shot=fish&fixture=mature-warm-reef&fish=candidate&time=42" },
    { label: "02-seagrass-meadow", query: "shot=seagrass-meadow&time=42" },
    { label: "03-accepted-reef", query: "shot=reef&fixture=mature-warm-reef&time=42" },
  ],
  nextReview: [
    { label: "01-volcano-fresh", query: "shot=whole-island&volcanoPhase=fresh&time=42" },
    { label: "02-volcano-recovered", query: "shot=whole-island&volcanoPhase=recovered&time=42" },
    { label: "03-volcano-carved", query: "shot=whole-island&volcanoPhase=carved&time=42" },
    { label: "04-volcano-drowned", query: "shot=whole-island&volcanoPhase=drowned&time=42" },
    { label: "05-island-100kyr", query: "shot=whole-island&years=100000&time=42" },
    { label: "06-island-1myr", query: "shot=whole-island&years=1000000&time=42" },
    { label: "07-storm", query: "shot=storm&years=1000&time=42" },
    { label: "08-storm-wave-height", query: "shot=wave-height&seaState=storm&years=1000&time=42" },
  ],
  // WU-4a land-iguana founder family. New set; existing comparison sets are
  // unedited. Creature-preview shots set captureReady after renderer.init().
  proofFounder: [
    { label: "01-front", path: "/creature-preview.html", query: "view=front" },
    { label: "02-side", path: "/creature-preview.html", query: "view=side" },
    { label: "03-top", path: "/creature-preview.html", query: "view=top" },
    { label: "04-game-distance", path: "/creature-preview.html", query: "view=game-distance" },
    { label: "05-landing-showcase", query: "shot=proof-founder&herd=candidate&years=10000&time=42" },
    { label: "06-established-proof", query: "shot=proof-founder&founders=drifter&plume=active&years=1000000&jumps=2&time=42" },
  ],
  // WU-4b: live lineages on the islands the resolver named. New set; existing
  // comparison sets and GOLDEN_SHOTS are unedited. Capture queries use the
  // same advance path as the live proof URLs, without herd=candidate.
  //
  // Live look (UI + lineage report, overview framed):
  //   Established:  ?founders=drifter&plume=active&years=1000000&jumps=2
  //   Speciated:    ?founders=drifter&plume=active&years=1000000&jumps=3
  //   Diversified:  ?founders=drifter&plume=active&years=1000000&jumps=5
  proofPlacement: [
    { label: "01-established-overview", query: "shot=proof-established-overview&founders=drifter&plume=active&years=1000000&jumps=2&time=42" },
    { label: "02-established-mid", query: "shot=proof-established-mid&founders=drifter&plume=active&years=1000000&jumps=2&time=42" },
    { label: "03-speciated-overview", query: "shot=proof-speciated-overview&founders=drifter&plume=active&years=1000000&jumps=3&time=42" },
    { label: "04-speciated-parent-mid", query: "shot=proof-speciated-parent-mid&founders=drifter&plume=active&years=1000000&jumps=3&time=42" },
    { label: "05-speciated-branch-mid", query: "shot=proof-speciated-branch-mid&founders=drifter&plume=active&years=1000000&jumps=3&time=42" },
    { label: "06-diversified-overview", query: "shot=proof-diversified-overview&founders=drifter&plume=active&years=1000000&jumps=5&time=42" },
    { label: "07-diversified-parent-mid", query: "shot=proof-diversified-parent-mid&founders=drifter&plume=active&years=1000000&jumps=5&time=42" },
    { label: "08-diversified-branch-mid", query: "shot=proof-diversified-branch-mid&founders=drifter&plume=active&years=1000000&jumps=5&time=42" },
    { label: "09-diversified-child-mid", query: "shot=proof-diversified-child-mid&founders=drifter&plume=active&years=1000000&jumps=5&time=42" },
  ],
  // WU-4c: matched mid/near framings of parent vs branch so ancestry and
  // habitat split can be judged on the shared iguana rig. New set; existing
  // comparison sets are unedited.
  proofAncestry: [
    { label: "01-speciated-parent-mid", query: "shot=proof-speciated-parent-mid&founders=drifter&plume=active&years=1000000&jumps=3&time=42" },
    { label: "02-speciated-branch-mid", query: "shot=proof-speciated-branch-mid&founders=drifter&plume=active&years=1000000&jumps=3&time=42" },
    { label: "03-speciated-parent-near", query: "shot=proof-speciated-parent-near&founders=drifter&plume=active&years=1000000&jumps=3&time=42" },
    { label: "04-speciated-branch-near", query: "shot=proof-speciated-branch-near&founders=drifter&plume=active&years=1000000&jumps=3&time=42" },
    { label: "05-diversified-parent-near", query: "shot=proof-diversified-parent-near&founders=drifter&plume=active&years=1000000&jumps=5&time=42" },
    { label: "06-diversified-branch-near", query: "shot=proof-diversified-branch-near&founders=drifter&plume=active&years=1000000&jumps=5&time=42" },
    { label: "07-diversified-child-near", query: "shot=proof-diversified-child-near&founders=drifter&plume=active&years=1000000&jumps=5&time=42" },
  ],
  // WU-5: integrated proof gates. Same three landings as items 3–4. Reuses
  // existing proof cameras plus the 2 km reef/shoreline/saddle framings; does
  // not edit GOLDEN_SHOTS or prior proof sets. Capture mode freezes time
  // (`time=42`); motion is a live WebGPU look, not these stills.
  //
  // Live look (UI + epoch story + lineage report — not `?shot=`):
  //   Established:  ?founders=drifter&plume=active&years=1000000&jumps=2
  //   Speciated:    ?founders=drifter&plume=active&years=1000000&jumps=3
  //   Diversified:  ?founders=drifter&plume=active&years=1000000&jumps=5
  proofGates: [
    { label: "01-established-overview", query: "shot=proof-established-overview&founders=drifter&plume=active&years=1000000&jumps=2&time=42" },
    { label: "02-established-shoreline", query: "shot=w2k-shoreline&founders=drifter&plume=active&years=1000000&jumps=2&time=42" },
    { label: "03-established-reef-edge", query: "shot=w2k-reef-above&founders=drifter&plume=active&years=1000000&jumps=2&time=42" },
    { label: "04-established-mid", query: "shot=proof-established-mid&founders=drifter&plume=active&years=1000000&jumps=2&time=42" },
    { label: "05-established-near", query: "shot=proof-established-near&founders=drifter&plume=active&years=1000000&jumps=2&time=42" },
    { label: "06-speciated-overview", query: "shot=proof-speciated-overview&founders=drifter&plume=active&years=1000000&jumps=3&time=42" },
    { label: "07-speciated-saddle", query: "shot=w2k-chain-saddle&founders=drifter&plume=active&years=1000000&jumps=3&time=42" },
    { label: "08-speciated-parent-mid", query: "shot=proof-speciated-parent-mid&founders=drifter&plume=active&years=1000000&jumps=3&time=42" },
    { label: "09-speciated-branch-mid", query: "shot=proof-speciated-branch-mid&founders=drifter&plume=active&years=1000000&jumps=3&time=42" },
    { label: "10-speciated-parent-near", query: "shot=proof-speciated-parent-near&founders=drifter&plume=active&years=1000000&jumps=3&time=42" },
    { label: "11-speciated-branch-near", query: "shot=proof-speciated-branch-near&founders=drifter&plume=active&years=1000000&jumps=3&time=42" },
    { label: "12-diversified-overview", query: "shot=proof-diversified-overview&founders=drifter&plume=active&years=1000000&jumps=5&time=42" },
    { label: "13-diversified-reef-edge", query: "shot=w2k-reef-above&founders=drifter&plume=active&years=1000000&jumps=5&time=42" },
    { label: "14-diversified-parent-mid", query: "shot=proof-diversified-parent-mid&founders=drifter&plume=active&years=1000000&jumps=5&time=42" },
    { label: "15-diversified-branch-mid", query: "shot=proof-diversified-branch-mid&founders=drifter&plume=active&years=1000000&jumps=5&time=42" },
    { label: "16-diversified-child-mid", query: "shot=proof-diversified-child-mid&founders=drifter&plume=active&years=1000000&jumps=5&time=42" },
    { label: "17-diversified-parent-near", query: "shot=proof-diversified-parent-near&founders=drifter&plume=active&years=1000000&jumps=5&time=42" },
    { label: "18-diversified-branch-near", query: "shot=proof-diversified-branch-near&founders=drifter&plume=active&years=1000000&jumps=5&time=42" },
    { label: "19-diversified-child-near", query: "shot=proof-diversified-child-near&founders=drifter&plume=active&years=1000000&jumps=5&time=42" },
  ],
  // WU-N1: underwater camera navigation. New set; existing comparison sets and
  // GOLDEN_SHOTS are unedited. Fixture seats the review shelf so the stills
  // have seabed in frame. Live look is any empty start — double-click the
  // water and keep scrolling.
  underwaterNav: [
    { label: "01-shallow", query: "shot=w2k-underwater-shallow&fixture=mature-warm-reef&time=42" },
    { label: "02-shelf", query: "shot=w2k-underwater-shelf&fixture=mature-warm-reef&time=42" },
    { label: "03-slope", query: "shot=w2k-underwater-slope&fixture=mature-warm-reef&time=42" },
    { label: "04-look-up", query: "shot=w2k-underwater-look-up&fixture=mature-warm-reef&time=42" },
  ],
  // Splash-zone crab occupancy (WU-M1). Added; existing sets are unedited.
  // Live seats on the default Young volcano landing, plus a candidate
  // cluster for the package showcase. Headless --webgl is fallback evidence.
  splashCrab: [
    { label: "01-mid", query: "shot=w2k-splash-crab-mid&time=42" },
    { label: "02-near", query: "shot=w2k-splash-crab-near&time=42" },
  ],
  crabPreview: [
    { label: "01-front", path: "/crab-preview.html", query: "view=front" },
    { label: "02-side", path: "/crab-preview.html", query: "view=side" },
    { label: "03-top", path: "/crab-preview.html", query: "view=top" },
    { label: "04-game-distance", path: "/crab-preview.html", query: "view=game-distance" },
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
      const pagePath = shot.path ?? "/";
      const url = shot.query ? `${origin}${pagePath}?${shot.query}` : `${origin}${pagePath}`;
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
      // GPU-backed canvases can take longer than Playwright's 30 s default to
      // read back under software/WebGPU CI backends, even after captureReady.
      await page.screenshot({ path: file, type: "png", timeout: 120_000 });
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
