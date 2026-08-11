#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from "node:path";

const stages = ["brief", "source", "preview", "candidate", "accepted"];
const categories = ["animal", "fish", "bird", "plant", "coral"];
const target = resolve(process.argv[2] ?? "");
const manifestPath = statSafe(target)?.isDirectory() ? join(target, "asset.json") : target;
const packageDir = dirname(manifestPath);
const errors = [];
const warnings = [];
let asset;

function statSafe(path) {
  try { return statSync(path); } catch { return undefined; }
}

function need(condition, message) {
  if (!condition) errors.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function list(value) {
  return Array.isArray(value) && value.length > 0;
}

function localFile(path, label) {
  need(text(path), `${label} must be a non-empty relative path`);
  if (!text(path)) return;
  need(!isAbsolute(path), `${label} must be relative to the package`);
  const resolved = resolve(packageDir, path);
  need(relative(packageDir, resolved) !== ".." && !relative(packageDir, resolved).startsWith(`..${process.platform === "win32" ? "\\" : "/"}`), `${label} must stay inside the package`);
  need(existsSync(resolved), `${label} does not exist: ${path}`);
}

if (!text(process.argv[2])) {
  console.error("Usage: npm run asset:check -- assets/ecosystem/<asset-id>");
  process.exit(2);
}

need(existsSync(manifestPath), `manifest not found: ${manifestPath}`);
if (errors.length) finish();

try {
  asset = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  errors.push(`invalid JSON: ${error.message}`);
  finish();
}

need(asset.schemaVersion === 1, "schemaVersion must be 1");
need(typeof asset.id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset.id), "id must be lowercase kebab-case");
need(asset.id === basename(normalize(packageDir)), "id must match the package directory name");
need(text(asset.displayName), "displayName is required");
need(categories.includes(asset.category), `category must be one of: ${categories.join(", ")}`);
need(stages.includes(asset.stage), `stage must be one of: ${stages.join(", ")}`);
need(text(asset.role), "role is required");
need(list(asset.habitats), "habitats must contain at least one entry");
need(list(asset.realWorldReferents), "realWorldReferents must contain at least one entry");
need(text(asset.silhouette), "silhouette is required");
need(text(asset.paletteFamily), "paletteFamily is required");
need(Number.isFinite(asset.scaleMeters?.min) && asset.scaleMeters.min > 0, "scaleMeters.min must be positive");
need(Number.isFinite(asset.scaleMeters?.max) && asset.scaleMeters.max >= asset.scaleMeters?.min, "scaleMeters.max must be >= min");
need(Array.isArray(asset.traits?.continuous), "traits.continuous must be an array");
need(Array.isArray(asset.traits?.discrete), "traits.discrete must be an array");
need(existsSync(join(packageDir, "morphology.md")), "morphology.md is required");

for (const [index, trait] of (asset.traits?.continuous ?? []).entries()) {
  need(text(trait.name) && text(trait.driver) && Array.isArray(trait.range) && trait.range.length === 2, `continuous trait ${index} needs name, driver, and a two-value range`);
}
for (const [index, trait] of (asset.traits?.discrete ?? []).entries()) {
  need(text(trait.name) && text(trait.driver) && Array.isArray(trait.variants) && trait.variants.length >= 2, `discrete trait ${index} needs name, driver, and at least two variants`);
}

const stageIndex = stages.indexOf(asset.stage);
if (stageIndex >= stages.indexOf("source")) {
  need(text(asset.source?.tool) && asset.source.tool !== "unselected", "source.tool must name the authoring tool");
  need(text(asset.source?.procedure), "source.procedure is required");
  need(list(asset.source?.files), "source.files must contain at least one editable source");
  for (const [index, file] of (asset.source?.files ?? []).entries()) localFile(file, `source.files[${index}]`);
}

if (stageIndex >= stages.indexOf("preview")) {
  const required = ["front", "side", "top", "game-distance"];
  if (asset.category === "bird") required.push("flight");
  if (asset.category === "fish") required.push("swim");
  if (asset.category === "plant") required.push("wind");
  if (asset.category === "coral") required.push("colony");
  need(list(asset.previews), "previews are required");
  for (const label of required) need(asset.previews?.some((path) => path.toLowerCase().includes(label)), `previews must include ${label}`);
  for (const [index, file] of (asset.previews ?? []).entries()) localFile(file, `previews[${index}]`);
}

if (stageIndex >= stages.indexOf("candidate")) {
  need(list(asset.exports), "exports must contain at least one runtime file");
  for (const [index, file] of (asset.exports ?? []).entries()) localFile(file, `exports[${index}]`);
  need(list(asset.lods), "lods must contain at least one budgeted level");
  for (const [index, lod] of (asset.lods ?? []).entries()) {
    need(text(lod.name) && Number.isFinite(lod.maxTriangles) && lod.maxTriangles > 0, `lods[${index}] needs a name and positive maxTriangles`);
    localFile(lod.file, `lods[${index}].file`);
  }
  need(text(asset.showcase), "showcase is required");
  if (text(asset.showcase)) localFile(asset.showcase, "showcase");
  if (["animal", "fish", "bird"].includes(asset.category)) need(list(asset.animations?.required), "animated fauna must declare required clips");
}

if (asset.stage === "accepted") need(text(asset.acceptance?.verdict), "accepted assets require acceptance.verdict");

warn((asset.traits?.continuous?.length ?? 0) + (asset.traits?.discrete?.length ?? 0) > 0, "asset has no evolution or habitat-driven traits");
finish();

function finish() {
  for (const warning of warnings) console.warn(`WARN ${warning}`);
  for (const error of errors) console.error(`ERROR ${error}`);
  if (errors.length) {
    console.error(`Asset check failed with ${errors.length} error(s).`);
    process.exit(1);
  }
  console.log(`Asset check passed${warnings.length ? ` with ${warnings.length} warning(s)` : ""}: ${manifestPath}`);
  if (asset && stages.indexOf(asset.stage) > 0 && warnings.length) process.exit(1);
}
