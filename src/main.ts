import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  MOUSE,
  PerspectiveCamera,
  Raycaster,
  Scene,
  TOUCH,
  Vector2,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { exponentialHeightFogFactor, fog, uniform } from "three/tsl";
import { FFTOcean } from "./fft-ocean";
import { createFFTOceanMesh } from "./fft-water";
import { createLandingState } from "./landing-state";
import { loadTreeGeometryAssets } from "./tree-geometry-assets";
import { loadSeagrassGeometryAssets } from "./seagrass-geometry-assets";
import type { LineageChange } from "./lineage-history";
import { buildLineageReportHtml } from "./lineage-report";
import { buildMarineLineageReportHtml } from "./marine-lineage-report";
import type { MarineLineageChange } from "./marine-lineage";
import { buildEpochStory } from "./epoch-story";
import { createPresentationController, isGoldenShotName } from "./presentation";
import {
  createRevealController,
  isRevealTreatmentName,
  revealTreatmentOptions,
  type RevealTreatmentName,
} from "./reveal";
import { resolveHeightFog, sampleAtmosphere, type AtmosphereProfile } from "./atmosphere";
import { createAtmosphereBackground } from "./atmosphere-renderer";
import { createEpochRenderPipeline, readPostProcessingOptions } from "./post-processing";
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
import { RENDER_SCALE } from "./render-scale";

const statusEl = document.getElementById("status")!;
const lineagePanelEl = document.getElementById("lineage-panel")!;
const appEl = document.getElementById("app")!;
const experienceEl = document.getElementById("experience")!;
const epochCardEl = document.getElementById("epoch-card")!;
const jumpVeilEl = document.getElementById("jump-veil")!;
const revealTreatmentEl = document.getElementById("reveal-treatment") as HTMLSelectElement;
const formHintEl = document.getElementById("form-hint")!;
const formTitleEl = document.getElementById("form-title")!;
const jumpYearsEl = document.getElementById("jump-years") as HTMLSelectElement;
const jumpButtonEl = document.getElementById("jump") as HTMLButtonElement;
const distantDrifterEl = document.getElementById("distant-drifter") as HTMLButtonElement;
const worldAgeEl = document.getElementById("world-age")!;
const landingSummaryEl = document.getElementById("landing-summary")!;
const epochStoryEl = document.getElementById("epoch-story")!;
const rainfallEl = document.getElementById("rainfall") as HTMLSelectElement;
const temperatureEl = document.getElementById("temperature") as HTMLSelectElement;
const windEl = document.getElementById("wind") as HTMLSelectElement;
const seaLevelEl = document.getElementById("sea-level") as HTMLSelectElement;

for (const option of revealTreatmentOptions()) {
  const element = document.createElement("option");
  element.value = option.value;
  element.textContent = `${option.philosophy} — ${option.label}`;
  revealTreatmentEl.appendChild(element);
}
const requestedTreatment = new URLSearchParams(window.location.search).get("reveal");
if (isRevealTreatmentName(requestedTreatment)) revealTreatmentEl.value = requestedTreatment;
if (new URLSearchParams(window.location.search).get("lab") === "1") {
  document.body.classList.add("reveal-lab-mode");
}
const reveal = createRevealController(jumpVeilEl);

const sunDirection = new Vector3(0.55, 0.42, 0.35).normalize();

const scene = new Scene();
scene.fog = null;
const initialAtmosphere = sampleAtmosphere(0, "day");
const atmosphereBackground = createAtmosphereBackground(initialAtmosphere);
scene.backgroundNode = atmosphereBackground.node;
const heightFogColor = uniform(initialAtmosphere.fogColor.clone());
const heightFogDensity = uniform(0.0002);
const heightFogCeiling = uniform(10);
scene.fogNode = fog(heightFogColor, exponentialHeightFogFactor(heightFogDensity, heightFogCeiling));

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
controls.dampingFactor = 0.08;
controls.minDistance = 1.25;
controls.maxDistance = 800;
// Stay above the horizon — past 0.49π the camera swings under the seabed and
// the world renders from its underside.
controls.maxPolarAngle = Math.PI * 0.49;
controls.zoomToCursor = true;
controls.zoomSpeed = 1.25;

const captureParams = new URLSearchParams(window.location.search);
const captureShot = captureParams.get("shot");
const captureMode = isGoldenShotName(captureShot);
const captureTime = Number(captureParams.get("time") ?? 42);
const postProcessingOptions = readPostProcessingOptions(captureParams);
let lastInteraction = performance.now() / 1000;
const presentation = createPresentationController(camera, controls, (active) => {
  document.body.classList.toggle("attract-mode", active);
});
if (captureMode) {
  presentation.applyShot(captureShot);
  document.body.classList.add("capture-mode");
}

for (const eventName of ["pointerdown", "wheel", "keydown", "touchstart"] as const) {
  window.addEventListener(eventName, () => {
    lastInteraction = performance.now() / 1000;
    if (presentation.active) presentation.setActive(false);
  }, { passive: true });
}

const sunLight = new DirectionalLight(new Color(0xfff2d9), 2.0);
sunLight.position.copy(sunDirection).multiplyScalar(420);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -245;
sunLight.shadow.camera.right = 245;
sunLight.shadow.camera.top = 245;
sunLight.shadow.camera.bottom = -245;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 900;
sunLight.shadow.bias = -0.00018;
scene.add(sunLight, sunLight.target);

// A second, tightly fitted solar map preserves contact shadows around the
// current camera focus while the broad map keeps the entire island grounded.
// Their intensities sum to the authored atmosphere intensity, so this adds
// coverage and resolution rather than a second sun.
const detailSunLight = new DirectionalLight(new Color(0xfff2d9), 0.6);
detailSunLight.castShadow = true;
detailSunLight.shadow.mapSize.set(1536, 1536);
detailSunLight.shadow.camera.left = -62;
detailSunLight.shadow.camera.right = 62;
detailSunLight.shadow.camera.top = 62;
detailSunLight.shadow.camera.bottom = -62;
detailSunLight.shadow.camera.near = 1;
detailSunLight.shadow.camera.far = 320;
detailSunLight.shadow.bias = -0.00012;
detailSunLight.shadow.normalBias = 0.025;
scene.add(detailSunLight, detailSunLight.target);
const ambientLight = new AmbientLight(0x8eacc0, 0.42);
scene.add(ambientLight);
const hemisphereLight = new HemisphereLight(0xaed7ee, 0x5b4938, 0.28);
scene.add(hemisphereLight);

function updateAtmosphere(elapsed: number): void {
  const profile: AtmosphereProfile = captureShot === "dawn"
    ? "dawn"
    : captureShot === "storm"
      ? "storm"
      : captureMode
        ? "day"
        : "cycle";
  const state = sampleAtmosphere(elapsed, profile);
  sunDirection.copy(state.sunDirection);
  atmosphereBackground.update(state);
  sunLight.color.copy(state.sunColor);
  sunLight.intensity = state.sunIntensity * 0.68;
  detailSunLight.color.copy(state.sunColor);
  detailSunLight.intensity = state.sunIntensity * 0.32;
  ambientLight.color.copy(state.ambientColor);
  ambientLight.intensity = state.ambientIntensity;
  hemisphereLight.color.copy(state.ambientColor).offsetHSL(0.01, 0.04, 0.12);
  hemisphereLight.groundColor.set(0x5b4938);
  hemisphereLight.intensity = state.ambientIntensity * 0.95;
  heightFogColor.value.copy(state.fogColor);
  const heightFog = resolveHeightFog(climate);
  heightFogDensity.value = heightFog.density;
  heightFogCeiling.value = heightFog.ceiling;
  renderer.toneMappingExposure = state.exposure;
  renderPipeline?.setProfile(profile);
}

const broadShadowCenter = new Vector3(0, 10, 0);
const detailShadowCenter = new Vector3();
function updateShadowCoverage(): void {
  sunLight.target.position.copy(broadShadowCenter);
  sunLight.position.copy(broadShadowCenter).addScaledVector(sunDirection, 420);
  detailShadowCenter.copy(controls.target);
  detailSunLight.target.position.copy(detailShadowCenter);
  detailSunLight.position.copy(detailShadowCenter).addScaledVector(sunDirection, 155);
  sunLight.target.updateMatrixWorld();
  detailSunLight.target.updateMatrixWorld();
}

await Promise.all([loadTreeGeometryAssets(), loadSeagrassGeometryAssets()]);
const landingState = createLandingState(scene);
const raycaster = new Raycaster();
const pointer = new Vector2();
type FormTool = "look" | "raise" | "carve";
let formTool: FormTool = "look";
let jumped = false;

// Gesture arbitration. A shaping tool takes the primary gesture (left-drag /
// one finger) and nothing else, so the camera is never taken away mid-sculpt:
// right-drag still pans, the wheel still zooms, two fingers still pinch-pan.
// `controls.enabled` is left alone here — presentation mode owns that flag.
const activePointers = new Set<number>();
let strokePointerId: number | null = null;
// Where a stroke started, held until we know it is a stroke and not the first
// finger of a pinch. Flushed on the first move (drag) or on release (tap).
let strokeOrigin: { x: number; y: number } | null = null;

function syncCameraGestures(): void {
  const painting = formTool !== "look" && !jumped;
  controls.mouseButtons.LEFT = painting ? null : MOUSE.ROTATE;
  controls.touches.ONE = painting ? null : TOUCH.ROTATE;
}
let totalYears = 0;
let climate: ClimateForces = { ...DEFAULT_CLIMATE };

function formatYears(years: number): string {
  if (years >= 1_000_000) return `${years / 1_000_000} million years`;
  return `${years.toLocaleString()} ${years === 1 ? "year" : "years"}`;
}

function landingSummary(years: number, forces: ClimateForces, hasTerrestrialFounders: boolean): string {
  if (years < 10) return "Fresh weathering · pioneer growth beginning";
  if (years < 100) return "Young communities · channels and slopes settling";
  if (years < 1000) return `Maturing communities · ${climateLabel(forces)} climate`;
  if (!hasTerrestrialFounders) return `Ocean arrivals and visiting birds · ${climateLabel(forces)} coast`;
  if (years < 100_000) return `Diverged grazers · ${climateLabel(forces)} coast`;
  return `Ancient descendants · ${climateLabel(forces)} deep-time coast`;
}

function renderLineageReport(changes: readonly LineageChange[], marineChanges: readonly MarineLineageChange[], traitDistance?: number): void {
  lineagePanelEl.innerHTML = buildLineageReportHtml(changes, traitDistance) + buildMarineLineageReportHtml(marineChanges);
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
  syncCameraGestures();
  document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => {
    button.classList.toggle("active", button.dataset.tool === tool);
  });
  formHintEl.textContent =
    tool === "look"
      ? "Drag to orbit. Scroll to move closer. Choose a shaping tool when the form calls for it."
      : tool === "raise"
        ? "Drag across the land to build ridges and refuges — right-drag or two fingers still move the camera."
        : "Drag across the land to cut valleys and channels — right-drag or two fingers still move the camera.";
}

function sculptAt(clientX: number, clientY: number): void {
  if (jumped || formTool === "look") return;
  pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(landingState.terrain, false)[0];
  if (hit) landingState.sculpt(hit.point, formTool === "raise" ? 1 : -1);
}

function endStroke(): void {
  if (strokePointerId !== null && renderer.domElement.hasPointerCapture(strokePointerId)) {
    // OrbitControls captures the first pointer too and may have released it
    // already, so never release blind — that throws NotFoundError.
    renderer.domElement.releasePointerCapture(strokePointerId);
  }
  strokePointerId = null;
  strokeOrigin = null;
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  activePointers.add(event.pointerId);
  if (jumped || formTool === "look" || event.button !== 0) return;
  if (activePointers.size > 1) {
    // A second finger means the camera, not the terrain. Drop the pending
    // stroke unsculpted and let OrbitControls take the pinch.
    endStroke();
    return;
  }
  strokePointerId = event.pointerId;
  strokeOrigin = { x: event.clientX, y: event.clientY };
  renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (event.pointerId !== strokePointerId) return;
  if (activePointers.size > 1) {
    endStroke();
    return;
  }
  strokeOrigin = null;
  sculptAt(event.clientX, event.clientY);
});

function finishPointer(event: PointerEvent): void {
  activePointers.delete(event.pointerId);
  if (event.pointerId !== strokePointerId) return;
  // A press with no movement is still a deliberate dab — apply it on release,
  // once we know no second finger arrived.
  if (strokeOrigin && event.type === "pointerup") sculptAt(strokeOrigin.x, strokeOrigin.y);
  endStroke();
}

renderer.domElement.addEventListener("pointerup", finishPointer);
renderer.domElement.addEventListener("pointercancel", finishPointer);

document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => {
  button.addEventListener("click", () => setTool(button.dataset.tool as FormTool));
});

jumpYearsEl.addEventListener("change", () => {
  jumpButtonEl.textContent = `Jump ${formatYears(Number(jumpYearsEl.value))}`;
});

distantDrifterEl.addEventListener("click", () => {
  if (!landingState.introduceDistantDrifter(totalYears)) return;
  distantDrifterEl.textContent = "Drifter approaching";
  distantDrifterEl.classList.add("active");
  distantDrifterEl.disabled = true;
  formHintEl.textContent = "A vegetation raft carries a tiny founder cohort. Arrival is not establishment; local food will decide whether it survives.";
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
  endStroke();
  syncCameraGestures();
  experienceEl.classList.add("committed");
  formHintEl.textContent = `Resolving ${formatYears(jumpYears)} of water, weather, and selection…`;
  const treatment = revealTreatmentEl.value as RevealTreatmentName;
  reveal.captureBefore(renderer.domElement);
  reveal.play(treatment, jumpYears, () => {
    const previousAge = totalYears;
    totalYears += jumpYears;
    const lineageReport = landingState.advance(jumpYears, totalYears, committedClimate);
    renderLineageReport(lineageReport.changes, lineageReport.marineChanges, lineageReport.traitDistance);
    applyOceanForces(committedClimate);
    worldAgeEl.textContent = `Year ${totalYears.toLocaleString()}`;
    const hasEstablishedTerrestrialPopulation = lineageReport.changes.some((change) => change.status === "active");
    landingSummaryEl.textContent = landingSummary(totalYears, committedClimate, hasEstablishedTerrestrialPopulation);
    epochStoryEl.textContent = buildEpochStory(previousAge, lineageReport.changes, committedClimate, lineageReport.marineChanges);
    if (lineageReport.changes.length > 0 && lineageReport.changes.every((change) => change.status === "extinct")) {
      distantDrifterEl.textContent = "Distant Drifter";
      distantDrifterEl.classList.remove("active");
      distantDrifterEl.disabled = false;
    }
    epochCardEl.classList.add("visible");
  }, () => {
    jumped = false;
    experienceEl.classList.remove("committed");
    formTitleEl.textContent = "Shape what remains";
    setTool("look");
    formHintEl.textContent = "Explore the landing state, reshape it, or choose another span of time.";
  });
});

let fftOcean: FFTOcean | undefined;
let oceanMesh: ReturnType<typeof createFFTOceanMesh> | undefined;
let rendererReady = false;
let renderPipeline: ReturnType<typeof createEpochRenderPipeline> | undefined;
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
      patchSize: RENDER_SCALE.oceanPatch,
      windSpeed: wind.speed,
      windDirectionDeg: wind.x < 0 ? 180 : 0,
      fetch: 800000,
      // Keep the broad FFT component below the fine wind chop. At island
      // scale a full-amplitude low-frequency heightfield reads as gelatinous.
      amplitudeScale: RENDER_SCALE.swellAmplitudeScale,
      randomSeed: captureMode ? 0xe90c4 : undefined,
    });
    const mesh = createFFTOceanMesh(ocean, {
      size: RENDER_SCALE.oceanExtent,
      sunDirection,
      sunColor: new Color(0xfff2d9),
      terrainHeightTexture: landingState.terrainHeightTexture,
      oceanMaskTexture: landingState.oceanMaskTexture,
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
    renderPipeline = createEpochRenderPipeline(renderer, scene, camera, postProcessingOptions);
    const isWebGPU = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true;
    statusEl.textContent = `backend: ${isWebGPU ? "WebGPU" : "WebGL2 (fallback)"}`;
  } catch (err) {
    statusEl.textContent = `renderer init failed: ${String(err)}`;
    console.error(err);
    return;
  }

  rendererReady = true;
  applyOceanForces(DEFAULT_CLIMATE);
  if (captureMode) {
    const captureYears = Number(captureParams.get("years") ?? 10_000);
    landingState.advance(captureYears, captureYears, DEFAULT_CLIMATE);
    landingState.update(captureTime, camera.position);
  }

  let frameCount = 0;
  let fpsWindowStart = performance.now();

  renderer.setAnimationLoop(() => {
    const elapsed = captureMode ? captureTime : performance.now() / 1000;
    if (!captureMode && !presentation.active && elapsed - lastInteraction >= 25 && formTool === "look" && !jumped) {
      presentation.setActive(true, elapsed);
    }
    fftOcean?.update(elapsed);
    updateAtmosphere(elapsed);
    landingState.update(elapsed, camera.position);
    presentation.update(elapsed);
    if (!presentation.active) controls.update();
    updateShadowCoverage();
    renderPipeline!.render();
    if (captureMode) document.documentElement.dataset.captureReady = "true";

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
