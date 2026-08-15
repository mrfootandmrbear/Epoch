import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MOUSE,
  type Node,
  PerspectiveCamera,
  Raycaster,
  RingGeometry,
  Scene,
  TOUCH,
  Vector2,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { exponentialHeightFogFactor, fog, positionWorld, smoothstep, uniform } from "three/tsl";
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
import { climateMood, cycleOriginForPhase, resolveAtmosphere, resolveHeightFog, sampleAtmosphere, type AtmosphereProfile } from "./atmosphere";
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
import { resolveOceanSeaState } from "./ocean-sea-state";
import type { VolcanicOutput } from "./volcanism";
import { isVolcanicLifecyclePhase, volcanicLifecyclePrefix } from "./volcanic-lifecycle";
import { ENVIRONMENT_FIXTURES, isEnvironmentFixtureName } from "./environment-fixtures";
import { STARTING_WORLD_PRESETS, startingWorldPreset } from "./starting-world-presets";
import {
  DEFAULT_FOUNDER_CHOICES,
  founderProfileLabel,
  type FounderChoices,
  type FounderFoodSource,
  type FounderOriginClimate,
  type FounderSizeBand,
} from "./founder-profile";

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
const drifterFoodEl = document.getElementById("drifter-food") as HTMLSelectElement;
const drifterSizeEl = document.getElementById("drifter-size") as HTMLSelectElement;
const drifterClimateEl = document.getElementById("drifter-climate") as HTMLSelectElement;
const drifterPreviewEl = document.getElementById("drifter-preview")!;
const worldAgeEl = document.getElementById("world-age")!;
const landingSummaryEl = document.getElementById("landing-summary")!;
const epochStoryEl = document.getElementById("epoch-story")!;
const rainfallEl = document.getElementById("rainfall") as HTMLSelectElement;
const temperatureEl = document.getElementById("temperature") as HTMLSelectElement;
const windEl = document.getElementById("wind") as HTMLSelectElement;
const seaLevelEl = document.getElementById("sea-level") as HTMLSelectElement;
const volcanicOutputEl = document.getElementById("volcanic-output") as HTMLSelectElement;
const brushControlsEl = document.getElementById("brush-controls")!;
const brushSizeEl = document.getElementById("brush-size") as HTMLInputElement;
const brushStrengthEl = document.getElementById("brush-strength") as HTMLInputElement;
const brushSizeValueEl = document.getElementById("brush-size-value") as HTMLOutputElement;
const brushStrengthValueEl = document.getElementById("brush-strength-value") as HTMLOutputElement;
const undoSculptEl = document.getElementById("undo-sculpt") as HTMLButtonElement;
const redoSculptEl = document.getElementById("redo-sculpt") as HTMLButtonElement;
const playerShellEl = experienceEl;
const shellToggleEl = document.getElementById("shell-toggle") as HTMLButtonElement;
const startingWorldEl = document.getElementById("starting-world") as HTMLSelectElement;
const startingWorldDescriptionEl = document.getElementById("starting-world-description")!;
const screensaverEnabledEl = document.getElementById("screensaver-enabled") as HTMLInputElement;
const screensaverDelayEl = document.getElementById("screensaver-delay") as HTMLSelectElement;

for (const preset of STARTING_WORLD_PRESETS) {
  const option = document.createElement("option");
  option.value = preset.id;
  option.textContent = preset.name;
  startingWorldEl.appendChild(option);
}

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
const fogSeaLevel = uniform(SEA_LEVEL[DEFAULT_CLIMATE.seaLevel]);
// Atmospheric moisture ends at the waterline. Submerged materials already
// resolve spectral extinction and in-scatter; applying aerial fog again turns
// clear tropical water into a grey-brown double-fogged volume.
const aboveWaterFog = smoothstep(fogSeaLevel.sub(0.35), fogSeaLevel.add(0.35), positionWorld.y);
const atmosphericFog = exponentialHeightFogFactor(heightFogDensity, heightFogCeiling) as Node<"float">;
scene.fogNode = fog(
  heightFogColor,
  atmosphericFog.mul(aboveWaterFog),
);

const camera = new PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  20000,
);
// Default gameplay framing: the whole island group, from the seaward quarter
// the reef-edge composition is judged from. Keyed to the extent for the same
// reason as the zoom clamp.
camera.position.set(
  RENDER_SCALE.islandExtent * 0.41,
  RENDER_SCALE.islandExtent * 0.205,
  RENDER_SCALE.islandExtent * 0.47,
);

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
// Far enough out to hold the whole 2 km world in frame with margin. Keyed to
// the extent so a future resize does not silently crop the overview.
controls.maxDistance = RENDER_SCALE.islandExtent * 1.6;
// Stay above the horizon — past 0.49π the camera swings under the seabed and
// the world renders from its underside.
controls.maxPolarAngle = Math.PI * 0.49;
controls.zoomToCursor = true;
controls.zoomSpeed = 1.25;
// Keep the camera vocabulary predictable across devices. Terrain tools only
// borrow the primary gesture; secondary mouse and multi-touch navigation stay
// in these conventional OrbitControls positions.
controls.mouseButtons.LEFT = MOUSE.ROTATE;
controls.mouseButtons.MIDDLE = MOUSE.DOLLY;
controls.mouseButtons.RIGHT = MOUSE.PAN;
controls.touches.ONE = TOUCH.ROTATE;
controls.touches.TWO = TOUCH.DOLLY_PAN;
renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());

const captureParams = new URLSearchParams(window.location.search);
const captureShot = captureParams.get("shot");
const captureMode = isGoldenShotName(captureShot);
const liveHerdShowcase = captureParams.get("showcase") === "herd";
const liveHerdContrast = captureParams.get("showcase") === "herd-contrast";
const captureTime = Number(captureParams.get("time") ?? 42);
const captureSky = captureParams.get("sky");
const captureFixtureName = captureParams.get("fixture");
const captureFixture = isEnvironmentFixtureName(captureFixtureName)
  ? ENVIRONMENT_FIXTURES[captureFixtureName]
  : undefined;
const requestedVolcanicPhase = captureParams.get("volcanoPhase");
const captureStormSea = captureShot === "storm" || captureParams.get("seaState") === "storm";
const captureVolcanicPhase = isVolcanicLifecyclePhase(requestedVolcanicPhase)
  ? requestedVolcanicPhase
  : null;
const postProcessingOptions = readPostProcessingOptions(captureParams);
let lastInteraction = performance.now() / 1000;
// Deep-time jumps land in a readable morning instead of inheriting whichever
// real-time solar phase happened to be active when the player clicked. Keep
// this offset local to atmosphere rendering: water and living-world motion
// should remain continuous across the reveal.
const POST_JUMP_MORNING_PHASE = 0.12;
let atmosphereCycleOrigin = 0;
const storedScreensaverEnabled = window.localStorage.getItem("epoch:screensaver-enabled");
const storedScreensaverDelay = window.localStorage.getItem("epoch:screensaver-delay");
screensaverEnabledEl.checked = storedScreensaverEnabled !== "false";
if (storedScreensaverDelay && screensaverDelayEl.querySelector(`option[value="${storedScreensaverDelay}"]`)) {
  screensaverDelayEl.value = storedScreensaverDelay;
}
let screensaverEnabled = screensaverEnabledEl.checked;
let screensaverDelay = Number(screensaverDelayEl.value);
let presentationTerrainHeightAt = (_x: number, _z: number) => -Infinity;
const presentation = createPresentationController(camera, controls, (active) => {
  document.body.classList.toggle("attract-mode", active);
}, (x, z) => presentationTerrainHeightAt(x, z));
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

screensaverEnabledEl.addEventListener("change", () => {
  screensaverEnabled = screensaverEnabledEl.checked;
  window.localStorage.setItem("epoch:screensaver-enabled", String(screensaverEnabled));
  lastInteraction = performance.now() / 1000;
  if (!screensaverEnabled && presentation.active) presentation.setActive(false);
});

screensaverDelayEl.addEventListener("change", () => {
  screensaverDelay = Number(screensaverDelayEl.value);
  window.localStorage.setItem("epoch:screensaver-delay", screensaverDelayEl.value);
  lastInteraction = performance.now() / 1000;
});

const sunLight = new DirectionalLight(new Color(0xfff2d9), 2.0);
sunLight.position.copy(sunDirection).multiplyScalar(RENDER_SCALE.islandExtent * 1.1);
sunLight.castShadow = true;
// The shadow frustum covers the land, not the whole grid. At 2 km the world is
// mostly open water, and sizing the map to the water would spend three
// quarters of the texels on sea that casts and receives nothing — the map
// resolution is the budget here, so it is spent on the island group.
const SHADOW_RADIUS = RENDER_SCALE.islandExtent * 0.3;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -SHADOW_RADIUS;
sunLight.shadow.camera.right = SHADOW_RADIUS;
sunLight.shadow.camera.top = SHADOW_RADIUS;
sunLight.shadow.camera.bottom = -SHADOW_RADIUS;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = RENDER_SCALE.islandExtent * 2.4;
sunLight.shadow.bias = -0.00018;
sunLight.shadow.normalBias = 0.035;
scene.add(sunLight, sunLight.target);
const ambientLight = new AmbientLight(0x8eacc0, 0.42);
scene.add(ambientLight);
const hemisphereLight = new HemisphereLight(0xaed7ee, 0x5b4938, 0.28);
scene.add(hemisphereLight);

/** Direction the shadow-casting key light comes from — the sun by day, an antisolar moon at night. */
const keyLightDirection = new Vector3().copy(sunDirection);
const MOONLIGHT_INTENSITY = 0.13;

function clampedSmoothstep(min: number, max: number, value: number): number {
  const x = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

function updateAtmosphere(elapsed: number): void {
  const profile: AtmosphereProfile = captureSky === "dawn" || captureShot === "dawn"
    ? "dawn"
    : captureStormSea
      ? "storm"
      : captureMode
        ? "day"
        : "cycle";
  const state = resolveAtmosphere(elapsed, profile, committedClimate);
  sunDirection.copy(state.sunDirection);
  atmosphereBackground.update(state);
  sunLight.color.copy(state.sunColor);
  // Below the horizon the sun sits under the seabed, so pointing the key light
  // along it lights nothing and re-renders the shadow map from beneath the
  // island every night frame. Night is keyed from the antisolar direction
  // instead. The swap happens well after sunset, where both contributions are
  // near zero, so no lighting pops at the horizon crossing.
  const moon = 1 - clampedSmoothstep(-0.25, -0.05, state.sunDirection.y);
  keyLightDirection.copy(state.sunDirection);
  if (moon > 0.5) keyLightDirection.negate();
  sunLight.intensity = state.sunIntensity * (1 - moon) + MOONLIGHT_INTENSITY * moon;
  oceanMesh?.updateAtmosphere(state);
  // The reef sits under this same sky. Sharing the sun keeps the caustic net
  // and the water haze in step with the surface instead of lighting the seabed
  // from a sun the water above it no longer has.
  landingState.setAtmosphere(state.sunDirection, state.sunColor);
  ambientLight.color.copy(state.ambientColor);
  ambientLight.intensity = state.ambientIntensity;
  hemisphereLight.color.copy(state.ambientColor).offsetHSL(0.01, 0.04, 0.12);
  hemisphereLight.groundColor.set(0x405866);
  hemisphereLight.intensity = state.ambientIntensity * 0.95;
  heightFogColor.value.copy(state.fogColor);
  renderer.toneMappingExposure = state.exposure;
  renderPipeline?.setProfile(profile, state.mood);
}

const broadShadowCenter = new Vector3(0, 10, 0);
function updateShadowCoverage(): void {
  sunLight.target.position.copy(broadShadowCenter);
  sunLight.position.copy(broadShadowCenter).addScaledVector(keyLightDirection, 420);
  sunLight.target.updateMatrixWorld();
}

await Promise.all([loadTreeGeometryAssets(), loadSeagrassGeometryAssets()]);
const landingState = createLandingState(scene);
presentationTerrainHeightAt = landingState.heightAt;
if (captureMode && captureVolcanicPhase) {
  landingState.resetStartingWorld(startingWorldPreset("young-volcano"));
}
const terrainCursor = new Mesh(
  new RingGeometry(0.92, 1, 64),
  new MeshBasicMaterial({ color: 0xe5edbc, transparent: true, opacity: 0.82, depthTest: false }),
);
terrainCursor.rotation.x = -Math.PI / 2;
terrainCursor.renderOrder = 100;
terrainCursor.visible = false;
scene.add(terrainCursor);
const cliffPreview = new Line(
  new BufferGeometry(),
  new LineBasicMaterial({ color: 0xffd98b, transparent: true, opacity: 0.92, depthTest: false }),
);
cliffPreview.renderOrder = 101;
cliffPreview.visible = false;
scene.add(cliffPreview);
const captureVolcanism = (
  captureParams.get("volcano")
  ?? (captureFixture && "volcano" in captureFixture ? captureFixture.volcano : null)
) as VolcanicOutput | null;
if (captureMode && captureVolcanism && ["vigorous", "active", "waning", "extinct"].includes(captureVolcanism)) {
  const hotSpot = captureFixture && "hotSpot" in captureFixture
    ? captureFixture.hotSpot
    : { x: 0, z: 0 };
  landingState.placeHotSpot(new Vector3(hotSpot.x, 0, hotSpot.z), captureVolcanism);
}
const raycaster = new Raycaster();
const pointer = new Vector2();
type FormTool = "look" | "raise" | "carve" | "level" | "cliff" | "hotspot";
let formTool: FormTool = "look";
let jumped = false;

function brushSettings() {
  return { radius: Number(brushSizeEl.value), strength: Number(brushStrengthEl.value) };
}

function syncBrushControls(): void {
  const sculpting = formTool === "raise" || formTool === "carve" || formTool === "level" || formTool === "cliff";
  brushControlsEl.hidden = !sculpting;
  brushSizeValueEl.value = `${brushSizeEl.value} m`;
  brushStrengthValueEl.value = Number(brushStrengthEl.value).toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  terrainCursor.scale.setScalar(Number(brushSizeEl.value));
  const history = landingState.sculptHistory();
  undoSculptEl.disabled = !history.canUndo || jumped;
  redoSculptEl.disabled = !history.canRedo || jumped;
  if (!sculpting || formTool === "cliff") terrainCursor.visible = false;
}

// Gesture arbitration. A shaping tool takes the primary gesture (left-drag /
// one finger) and nothing else, so the camera is never taken away mid-sculpt:
// right-drag still pans, the wheel still zooms, two fingers still pinch-pan.
// `controls.enabled` is left alone here — presentation mode owns that flag.
const activePointers = new Set<number>();
let strokePointerId: number | null = null;
let lastSculptPoint: Vector3 | null = null;
let cliffStart: Vector3 | null = null;
let cliffEnd: Vector3 | null = null;
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
let committedClimate: ClimateForces = { ...DEFAULT_CLIMATE };

function applyCommittedHeightFog(): void {
  const heightFog = resolveHeightFog(committedClimate);
  heightFogDensity.value = heightFog.density * climateMood(committedClimate).hazeDensityScale;
  heightFogCeiling.value = heightFog.ceiling;
  fogSeaLevel.value = SEA_LEVEL[committedClimate.seaLevel];
}
applyCommittedHeightFog();

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

function writeClimate(forces: Readonly<ClimateForces>): void {
  rainfallEl.value = forces.rainfall;
  temperatureEl.value = forces.temperature;
  windEl.value = forces.wind;
  seaLevelEl.value = forces.seaLevel;
  climate = { ...forces };
}

function setTool(tool: FormTool): void {
  formTool = tool;
  syncCameraGestures();
  syncBrushControls();
  document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => {
    const active = button.dataset.tool === tool;
    button.classList.toggle("active", active);
    if (button.matches("#camera-dock [data-tool]")) button.setAttribute("aria-pressed", String(active));
  });
  formHintEl.textContent =
    tool === "look"
      ? "Explore with left-drag or one finger. Pan with right-drag or two fingers; zoom with the wheel or a pinch."
      : tool === "raise"
        ? "Drag across the land to build ridges and refuges — right-drag or two fingers still move the camera."
        : tool === "carve"
          ? "Drag across the land to cut valleys and channels — right-drag or two fingers still move the camera."
          : tool === "level"
            ? "Brush across rough ground to form shelves, plains, and level valley floors."
            : tool === "cliff"
              ? "Drag along the cliff edge. The terrain on the left side of the stroke rises on release."
              : "Tap once to place the island's fixed volcanic source.";
}

function terrainHit(clientX: number, clientY: number) {
  pointer.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(landingState.terrain, false)[0];
}

function updateTerrainCursor(clientX: number, clientY: number): void {
  if (jumped || (formTool !== "raise" && formTool !== "carve" && formTool !== "level")) {
    terrainCursor.visible = false;
    return;
  }
  const hit = terrainHit(clientX, clientY);
  terrainCursor.visible = hit !== undefined;
  if (hit) terrainCursor.position.set(hit.point.x, hit.point.y + 0.18, hit.point.z);
}

function sculptAt(clientX: number, clientY: number): void {
  if (jumped || formTool === "look") return;
  const hit = terrainHit(clientX, clientY);
  if (!hit) return;
  if (formTool === "hotspot") {
    landingState.placeHotSpot(hit.point, volcanicOutputEl.value as VolcanicOutput);
    setTool("look");
    formHintEl.textContent = "The hot spot is fixed here. Jump time to let its shield grow.";
    return;
  }
  const settings = brushSettings();
  const direction = formTool === "raise" ? 1 : -1;
  const applyDab = (point: Vector3) => {
    if (formTool === "level") landingState.level(point, settings);
    else landingState.sculpt(point, direction, settings);
  };
  if (!lastSculptPoint) {
    applyDab(hit.point);
    lastSculptPoint = hit.point.clone();
    return;
  }
  const dx = hit.point.x - lastSculptPoint.x;
  const dz = hit.point.z - lastSculptPoint.z;
  const distance = Math.hypot(dx, dz);
  const spacing = Math.max(1, settings.radius * 0.18);
  const steps = Math.floor(distance / spacing);
  for (let step = 1; step <= steps; step++) {
    const amount = (step * spacing) / distance;
    applyDab(new Vector3(
      lastSculptPoint.x + dx * amount,
      hit.point.y,
      lastSculptPoint.z + dz * amount,
    ));
  }
  if (steps > 0) {
    const amount = (steps * spacing) / distance;
    lastSculptPoint.set(
      lastSculptPoint.x + dx * amount,
      hit.point.y,
      lastSculptPoint.z + dz * amount,
    );
  }
}

function endStroke(): void {
  if (strokePointerId !== null) landingState.finishSculpt();
  if (strokePointerId !== null && renderer.domElement.hasPointerCapture(strokePointerId)) {
    // OrbitControls captures the first pointer too and may have released it
    // already, so never release blind — that throws NotFoundError.
    renderer.domElement.releasePointerCapture(strokePointerId);
  }
  strokePointerId = null;
  strokeOrigin = null;
  lastSculptPoint = null;
  cliffStart = null;
  cliffEnd = null;
  cliffPreview.visible = false;
  syncBrushControls();
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
  landingState.beginSculpt();
  if (formTool === "cliff") {
    const hit = terrainHit(event.clientX, event.clientY);
    cliffStart = hit?.point.clone() ?? null;
    cliffEnd = cliffStart?.clone() ?? null;
  }
  renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener("pointermove", (event) => {
  updateTerrainCursor(event.clientX, event.clientY);
  if (event.pointerId !== strokePointerId) return;
  if (activePointers.size > 1) {
    endStroke();
    return;
  }
  if (formTool === "cliff") {
    const hit = terrainHit(event.clientX, event.clientY);
    if (!cliffStart || !hit) return;
    cliffEnd = hit.point.clone();
    cliffPreview.geometry.setFromPoints([
      new Vector3(cliffStart.x, cliffStart.y + 0.35, cliffStart.z),
      new Vector3(cliffEnd.x, cliffEnd.y + 0.35, cliffEnd.z),
    ]);
    cliffPreview.visible = cliffStart.distanceTo(cliffEnd) >= 1;
    strokeOrigin = null;
    return;
  }
  strokeOrigin = null;
  sculptAt(event.clientX, event.clientY);
});

function finishPointer(event: PointerEvent): void {
  activePointers.delete(event.pointerId);
  if (event.pointerId !== strokePointerId) return;
  if (formTool === "cliff" && event.type === "pointerup" && cliffStart && cliffEnd) {
    landingState.cliff(cliffStart, cliffEnd, brushSettings());
  }
  // A press with no movement is still a deliberate dab — apply it on release,
  // once we know no second finger arrived.
  if (formTool !== "cliff" && strokeOrigin && event.type === "pointerup") sculptAt(strokeOrigin.x, strokeOrigin.y);
  endStroke();
}

renderer.domElement.addEventListener("pointerup", finishPointer);
renderer.domElement.addEventListener("pointercancel", finishPointer);
renderer.domElement.addEventListener("pointerleave", () => { terrainCursor.visible = false; });

document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => {
  button.addEventListener("click", () => setTool(button.dataset.tool as FormTool));
});

for (const input of [brushSizeEl, brushStrengthEl]) input.addEventListener("input", syncBrushControls);
undoSculptEl.addEventListener("click", () => {
  if (landingState.undoSculpt()) formHintEl.textContent = "Undid the last terrain stroke.";
  syncBrushControls();
});
redoSculptEl.addEventListener("click", () => {
  if (landingState.redoSculpt()) formHintEl.textContent = "Restored the terrain stroke.";
  syncBrushControls();
});
window.addEventListener("keydown", (event) => {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z" || jumped) return;
  event.preventDefault();
  const changed = event.shiftKey ? landingState.redoSculpt() : landingState.undoSculpt();
  if (changed) formHintEl.textContent = event.shiftKey ? "Restored the terrain stroke." : "Undid the last terrain stroke.";
  syncBrushControls();
});

shellToggleEl.addEventListener("click", () => {
  const compact = playerShellEl.classList.toggle("compact");
  shellToggleEl.setAttribute("aria-expanded", String(!compact));
  shellToggleEl.textContent = compact ? "Expand" : "Compact";
});

startingWorldEl.addEventListener("change", () => {
  const preset = startingWorldPreset(startingWorldEl.value);
  endStroke();
  setTool("look");
  landingState.resetStartingWorld(preset);
  writeClimate(preset.climate);
  volcanicOutputEl.value = preset.volcanicOutput;
  committedClimate = { ...preset.climate };
  applyCommittedHeightFog();
  applyOceanForces(preset.climate);
  startingWorldDescriptionEl.textContent = preset.description;
  formHintEl.textContent = `${preset.name} loaded. Shape it further or set the forces for its first jump.`;
  syncBrushControls();
});

jumpYearsEl.addEventListener("change", () => {
  jumpButtonEl.textContent = `Jump ${formatYears(Number(jumpYearsEl.value))}`;
});

function readFounderChoices(): FounderChoices {
  return {
    foodSource: drifterFoodEl.value as FounderFoodSource,
    size: drifterSizeEl.value as FounderSizeBand,
    originClimate: drifterClimateEl.value as FounderOriginClimate,
  };
}

function updateDrifterPreview(): void {
  drifterPreviewEl.textContent = `${founderProfileLabel({ ...readFounderChoices(), generationSeed: 0 })}. Exact anatomy will be generated when the raft is launched.`;
}

for (const select of [drifterFoodEl, drifterSizeEl, drifterClimateEl]) {
  select.addEventListener("change", updateDrifterPreview);
}

distantDrifterEl.addEventListener("click", () => {
  const choices = readFounderChoices();
  if (!landingState.introduceDistantDrifter(totalYears, choices)) return;
  distantDrifterEl.textContent = "Drifter approaching";
  distantDrifterEl.classList.add("active");
  distantDrifterEl.disabled = true;
  drifterFoodEl.disabled = true;
  drifterSizeEl.disabled = true;
  drifterClimateEl.disabled = true;
  drifterPreviewEl.textContent = `${founderProfileLabel({ ...choices, generationSeed: 0 })}. The generated founders are now fixed.`;
  formHintEl.textContent = "A vegetation raft carries a tiny founder cohort. Arrival is not establishment; food supply, body cost, and climate fit will decide whether it survives.";
});

for (const select of [rainfallEl, temperatureEl, windEl, seaLevelEl]) {
  select.addEventListener("change", () => {
    climate = readClimate();
    formHintEl.textContent = `${climateLabel(climate)} — these forces will act across the next jump.`;
  });
}

volcanicOutputEl.addEventListener("change", () => {
  const output = volcanicOutputEl.value as VolcanicOutput;
  const outputLabel = volcanicOutputEl.selectedOptions[0]?.textContent?.replace(/^Volcano:\s*/, "") ?? output;
  landingState.setVolcanicOutput(output);
  formHintEl.textContent = output === "extinct"
    ? "The island stops growing; erosion and subsidence will take over."
    : `${outputLabel} volcanic output will act across the next jump.`;
});

jumpButtonEl.addEventListener("click", () => {
  if (jumped) return;
  const jumpYears = Number(jumpYearsEl.value);
  climate = readClimate();
  const nextClimate = { ...climate };
  jumped = true;
  startingWorldEl.disabled = true;
  endStroke();
  syncCameraGestures();
  experienceEl.classList.add("committed");
  formHintEl.textContent = `Resolving ${formatYears(jumpYears)} of water, weather, and selection…`;
  const treatment = revealTreatmentEl.value as RevealTreatmentName;
  reveal.captureBefore(renderer.domElement);
  reveal.play(treatment, jumpYears, () => {
    committedClimate = nextClimate;
    atmosphereCycleOrigin = cycleOriginForPhase(performance.now() / 1000, POST_JUMP_MORNING_PHASE);
    applyCommittedHeightFog();
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
      drifterFoodEl.disabled = false;
      drifterSizeEl.disabled = false;
      drifterClimateEl.disabled = false;
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
const oceanCache = new Map<string, {
  ocean: FFTOcean;
  mesh: ReturnType<typeof createFFTOceanMesh>;
}>();

function applyOceanForces(forces: ClimateForces, storm = captureStormSea): void {
  if (!rendererReady) return;
  if (oceanMesh) scene.remove(oceanMesh);
  const cacheKey = `${forces.wind}:${storm ? "storm" : "fair"}`;
  let entry = oceanCache.get(cacheKey);
  if (!entry) {
    const wind = WIND[forces.wind];
    const seaState = resolveOceanSeaState(wind.speed, storm);
    const ocean = new FFTOcean(renderer, {
      patchSize: RENDER_SCALE.oceanPatch,
      windSpeed: seaState.windSpeed,
      windDirectionDeg: wind.x < 0 ? 180 : 0,
      fetch: 800000,
      // Keep the broad FFT component below the fine wind chop. At island
      // scale a full-amplitude low-frequency heightfield reads as gelatinous.
      amplitudeScale: seaState.amplitudeScale,
      randomSeed: captureMode ? 0xe90c4 : undefined,
    });
    const mesh = createFFTOceanMesh(ocean, {
      size: RENDER_SCALE.oceanExtent,
      terrainSize: RENDER_SCALE.islandExtent,
      sunDirection,
      atmosphere: sampleAtmosphere(captureTime, captureMode ? "day" : "cycle"),
      terrainHeightTexture: landingState.terrainHeightTexture,
      oceanMaskTexture: landingState.oceanMaskTexture,
      seaState,
    });
    entry = { ocean, mesh };
    oceanCache.set(cacheKey, entry);
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
  const captureClimate: ClimateForces = captureFixture
    ? { ...captureFixture.climate }
    : { ...DEFAULT_CLIMATE };
  applyOceanForces(captureClimate);
  if (liveHerdShowcase || liveHerdContrast) {
    landingState.advance(10_000, 10_000, DEFAULT_CLIMATE);
    if (liveHerdContrast) landingState.showcaseHerdContrast();
    else landingState.showcaseGrazerHerd();
    presentation.applyShot(liveHerdContrast ? "herd-contrast" : "herd");
  }
  if (captureMode) {
    const captureYears = Number(captureParams.get("years") ?? captureFixture?.years ?? 10_000);
    if (captureParams.get("founders") === "drifter") landingState.introduceDistantDrifter(0, DEFAULT_FOUNDER_CHOICES);
    if (captureVolcanicPhase) {
      let lifecycleAge = 0;
      for (const step of volcanicLifecyclePrefix(captureVolcanicPhase)) {
        lifecycleAge += step.years;
        landingState.setVolcanicOutput(step.output);
        landingState.advance(step.years, lifecycleAge, step.climate);
        committedClimate = { ...step.climate };
      }
      applyCommittedHeightFog();
      applyOceanForces(committedClimate);
    } else {
      committedClimate = captureClimate;
      applyCommittedHeightFog();
      landingState.advance(captureYears, captureYears, captureClimate);
    }
    if (captureParams.get("herd") === "candidate") landingState.showcaseGrazerHerd();
    if (captureParams.get("herd") === "contrast") landingState.showcaseHerdContrast();
    if (captureParams.get("fish") === "candidate") landingState.showcaseFish();
    landingState.update(captureTime, camera.position);
  }

  let frameCount = 0;
  let fpsWindowStart = performance.now();
  let frameDraws = 0;

  renderer.setAnimationLoop(() => {
    const elapsed = captureMode ? captureTime : performance.now() / 1000;
    if (screensaverEnabled && !captureMode && !presentation.active && elapsed - lastInteraction >= screensaverDelay && formTool === "look" && !jumped) {
      presentation.setActive(true, elapsed);
    }
    fftOcean?.update(elapsed);
    updateAtmosphere(captureMode ? elapsed : elapsed - atmosphereCycleOrigin);
    landingState.update(elapsed, camera.position);
    presentation.update(elapsed);
    if (!presentation.active) controls.update();
    updateShadowCoverage();
    const callsBeforeRender = renderer.info.render.calls;
    renderPipeline!.render();
    frameDraws = renderer.info.render.calls - callsBeforeRender;
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
      statusEl.textContent = `backend: ${(renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend ? "WebGPU" : "WebGL2"} · ${fps} fps · ${frameDraws} draws`;
    }
  });
}

start();
