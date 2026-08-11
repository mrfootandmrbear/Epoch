import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SkyMesh } from "three/addons/objects/SkyMesh.js";
import { FFTOcean } from "./fft-ocean";
import { createFFTOceanMesh } from "./fft-water";
import { createLandingState } from "./landing-state";
import type { LineageChange } from "./lineage-history";
import { populationArchetype } from "./population-archetypes";
import { POPULATION_TRAIT_KEYS } from "./population-traits";
import {
  DEFAULT_CLIMATE,
  SEA_LEVEL,
  WIND,
  climateLabel,
  type ClimateForces,
  type RainfallRegime,
  type SeaLevelRegime,
  type TemperatureRegime,
  type WindRegime,
} from "./climate";

const statusEl = document.getElementById("status")!;
const lineagePanelEl = document.getElementById("lineage-panel")!;
const appEl = document.getElementById("app")!;
const experienceEl = document.getElementById("experience")!;
const epochCardEl = document.getElementById("epoch-card")!;
const jumpVeilEl = document.getElementById("jump-veil")!;
const formHintEl = document.getElementById("form-hint")!;
const formTitleEl = document.getElementById("form-title")!;
const jumpYearsEl = document.getElementById("jump-years") as HTMLSelectElement;
const jumpButtonEl = document.getElementById("jump") as HTMLButtonElement;
const worldAgeEl = document.getElementById("world-age")!;
const landingSummaryEl = document.getElementById("landing-summary")!;
const rainfallEl = document.getElementById("rainfall") as HTMLSelectElement;
const temperatureEl = document.getElementById("temperature") as HTMLSelectElement;
const windEl = document.getElementById("wind") as HTMLSelectElement;
const seaLevelEl = document.getElementById("sea-level") as HTMLSelectElement;

const sunDirection = new Vector3(0.55, 0.42, 0.35).normalize();

const scene = new Scene();
scene.fog = new FogExp2(0xb9ced9, 0.00042);

const camera = new PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  20000,
);
camera.position.set(155, 78, 178);

const renderer = new WebGPURenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = true;
appEl.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 14, 0);
controls.enableDamping = true;
controls.minDistance = 1.25;
controls.maxDistance = 800;
controls.maxPolarAngle = Math.PI / 2 + 0.3;
controls.zoomToCursor = true;
controls.zoomSpeed = 1.25;

const sky = new SkyMesh();
sky.scale.setScalar(10000);
sky.sunPosition.value.copy(sunDirection).multiplyScalar(400000);
scene.add(sky);

const sunLight = new DirectionalLight(new Color(0xfff2d9), 2.0);
sunLight.position.copy(sunDirection).multiplyScalar(200);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -220;
sunLight.shadow.camera.right = 220;
sunLight.shadow.camera.top = 220;
sunLight.shadow.camera.bottom = -220;
sunLight.shadow.camera.far = 650;
scene.add(sunLight);
scene.add(new AmbientLight(0x8eacc0, 0.55));

const landingState = createLandingState(scene);
const raycaster = new Raycaster();
const pointer = new Vector2();
type FormTool = "look" | "raise" | "carve";
let formTool: FormTool = "look";
let sculpting = false;
let jumped = false;
let totalYears = 0;
let climate: ClimateForces = { ...DEFAULT_CLIMATE };

function formatYears(years: number): string {
  if (years >= 1_000_000) return `${years / 1_000_000} million years`;
  return `${years.toLocaleString()} ${years === 1 ? "year" : "years"}`;
}

function landingSummary(years: number, forces: ClimateForces): string {
  if (years < 10) return "Fresh weathering · pioneer growth beginning";
  if (years < 100) return "Young communities · channels and slopes settling";
  if (years < 1000) return `Maturing communities · ${climateLabel(forces)} climate`;
  if (years < 100_000) return `Diverged grazers · ${climateLabel(forces)} coast`;
  return `Ancient descendants · ${climateLabel(forces)} deep-time coast`;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(4)}`;
}

function renderLineageReport(changes: readonly LineageChange[], traitDistance?: number): void {
  const lineageName = (change: LineageChange): string => {
    const label = populationArchetype(change.identity).label;
    return change.id === `${change.identity}:0` ? label : `${label} · ${change.id}`;
  };
  const rows = changes.map((change) => {
    if (change.status !== "active") {
      return `<section><strong>${lineageName(change)}</strong><span>${change.status.replace("-", " ")}</span></section>`;
    }
    const movement = change.event === "speciated"
      ? `branched from ${change.parentId} · isolated ${change.moved.toFixed(1)} units`
      : change.previousStatus === "active"
      ? `${change.reanchored ? "site re-anchored" : "site moved"} ${change.moved.toFixed(1)} units`
      : "lineage established";
    const traitLabels = {
      bodyMass: "mass",
      legLength: "legs",
      footWidth: "feet",
      insulation: "insulation",
      coatLightness: "coat lightness",
      coatWarmth: "coat warmth",
      hornLength: "horns",
    } as const;
    const traits = POPULATION_TRAIT_KEYS
      .flatMap((key) => change.traits?.[key] ? [[key, change.traits[key]] as const] : [])
      .map(([key, trait]) => (
        `<span>${traitLabels[key]}: ${trait.before.toFixed(3)} → ${trait.after.toFixed(3)} (${signed(trait.after - trait.before)})</span>`
      )).join("");
    return `<section><strong>${lineageName(change)}</strong><span>${movement}</span>${traits}</section>`;
  }).join("");
  const divergence = traitDistance === undefined ? "" : `<footer>trait distance ${traitDistance.toFixed(3)}</footer>`;
  lineagePanelEl.innerHTML = rows + divergence;
  lineagePanelEl.classList.add("visible");
}

function readClimate(): ClimateForces {
  return {
    rainfall: rainfallEl.value as RainfallRegime,
    temperature: temperatureEl.value as TemperatureRegime,
    wind: windEl.value as WindRegime,
    seaLevel: seaLevelEl.value as SeaLevelRegime,
  };
}

function setTool(tool: FormTool): void {
  formTool = tool;
  controls.enabled = tool === "look";
  document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === tool);
  });
  formHintEl.textContent =
    tool === "look"
      ? "Drag to orbit. Scroll to move closer. Choose a shaping tool when the form calls for it."
      : tool === "raise"
        ? "Drag across the land to build ridges and refuges."
        : "Drag across the land to cut valleys and channels.";
}

function sculptAt(clientX: number, clientY: number): void {
  if (jumped || formTool === "look") return;
  pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(landingState.terrain, false)[0];
  if (hit) landingState.sculpt(hit.point, formTool === "raise" ? 1 : -1);
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (jumped || formTool === "look" || event.button !== 0) return;
  sculpting = true;
  controls.enabled = false;
  renderer.domElement.setPointerCapture(event.pointerId);
  sculptAt(event.clientX, event.clientY);
});
renderer.domElement.addEventListener("pointermove", (event) => {
  if (sculpting) sculptAt(event.clientX, event.clientY);
});
renderer.domElement.addEventListener("pointerup", (event) => {
  sculpting = false;
  controls.enabled = formTool === "look";
  renderer.domElement.releasePointerCapture(event.pointerId);
});

document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => {
  button.addEventListener("click", () => setTool(button.dataset.tool as FormTool));
});

jumpYearsEl.addEventListener("change", () => {
  jumpButtonEl.textContent = `Jump ${formatYears(Number(jumpYearsEl.value))}`;
});

for (const select of [rainfallEl, temperatureEl, windEl, seaLevelEl]) {
  select.addEventListener("change", () => {
    climate = readClimate();
    formHintEl.textContent = `${climateLabel(climate)} — these forces will act across the next jump.`;
  });
}

jumpButtonEl.addEventListener("click", () => {
  if (jumped) return;
  const jumpYears = Number(jumpYearsEl.value);
  climate = readClimate();
  const committedClimate = { ...climate };
  jumped = true;
  controls.enabled = true;
  experienceEl.classList.add("committed");
  formHintEl.textContent = `Resolving ${formatYears(jumpYears)} of water, weather, and selection…`;
  jumpVeilEl.classList.remove("active");
  void jumpVeilEl.offsetWidth;
  jumpVeilEl.classList.add("active");
  window.setTimeout(() => {
    totalYears += jumpYears;
    const lineageReport = landingState.advance(jumpYears, totalYears, committedClimate);
    renderLineageReport(lineageReport.changes, lineageReport.traitDistance);
    applyOceanForces(committedClimate);
    worldAgeEl.textContent = `Year ${totalYears.toLocaleString()}`;
    landingSummaryEl.textContent = landingSummary(totalYears, committedClimate);
    epochCardEl.classList.add("visible");
  }, 1050);
  window.setTimeout(() => {
    jumped = false;
    jumpVeilEl.classList.remove("active");
    experienceEl.classList.remove("committed");
    formTitleEl.textContent = "Shape what remains";
    setTool("look");
    formHintEl.textContent = "Explore the landing state, reshape it, or choose another span of time.";
  }, 2100);
});

let fftOcean: FFTOcean | undefined;
let oceanMesh: ReturnType<typeof createFFTOceanMesh> | undefined;
let rendererReady = false;
const oceanCache = new Map<WindRegime, {
  ocean: FFTOcean;
  mesh: ReturnType<typeof createFFTOceanMesh>;
}>();

function applyOceanForces(forces: ClimateForces): void {
  if (!rendererReady) return;
  if (oceanMesh) scene.remove(oceanMesh);
  let entry = oceanCache.get(forces.wind);
  if (!entry) {
    const wind = WIND[forces.wind];
    const ocean = new FFTOcean(renderer, {
      patchSize: 500,
      windSpeed: wind.speed,
      windDirectionDeg: wind.x < 0 ? 180 : 0,
      fetch: 800000,
      amplitudeScale: 1,
    });
    const mesh = createFFTOceanMesh(ocean, {
      sunDirection,
      sunColor: new Color(0xfff2d9),
      terrainHeightTexture: landingState.terrainHeightTexture,
    });
    entry = { ocean, mesh };
    oceanCache.set(forces.wind, entry);
  }
  fftOcean = entry.ocean;
  oceanMesh = entry.mesh;
  oceanMesh.position.y = SEA_LEVEL[forces.seaLevel];
  scene.add(oceanMesh);
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
window.addEventListener("resize", resize);

async function start() {
  try {
    await renderer.init();
    const isWebGPU = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true;
    statusEl.textContent = `backend: ${isWebGPU ? "WebGPU" : "WebGL2 (fallback)"}`;
  } catch (err) {
    statusEl.textContent = `renderer init failed: ${String(err)}`;
    console.error(err);
    return;
  }

  rendererReady = true;
  applyOceanForces(DEFAULT_CLIMATE);

  let frameCount = 0;
  let fpsWindowStart = performance.now();

  renderer.setAnimationLoop(() => {
    fftOcean?.update();
    landingState.update(performance.now() / 1000);
    controls.update();
    renderer.render(scene, camera);

    // requestAnimationFrame (which this runs on) is suspended by the browser
    // for hidden/unfocused tabs, so this reading is only meaningful in a
    // normal foreground browser tab, not an automated/headless one.
    frameCount++;
    const now = performance.now();
    if (now - fpsWindowStart >= 1000) {
      const fps = Math.round((frameCount * 1000) / (now - fpsWindowStart));
      frameCount = 0;
      fpsWindowStart = now;
      statusEl.textContent = `backend: ${(renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? "WebGPU" : "WebGL2"} · ${fps} fps`;
    }
  });
}

start();
