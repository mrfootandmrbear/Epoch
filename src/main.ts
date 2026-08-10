import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SkyMesh } from "three/addons/objects/SkyMesh.js";
import { FFTOcean } from "./fft-ocean";
import { createFFTOceanMesh } from "./fft-water";

const statusEl = document.getElementById("status")!;
const appEl = document.getElementById("app")!;

const sunDirection = new Vector3(0.55, 0.42, 0.35).normalize();

const scene = new Scene();

const camera = new PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.5,
  20000,
);
camera.position.set(0, 14, 250);

const renderer = new WebGPURenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
appEl.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 2, 0);
controls.enableDamping = true;
controls.minDistance = 4;
controls.maxDistance = 800;
controls.maxPolarAngle = Math.PI / 2 + 0.3;

const sky = new SkyMesh();
sky.scale.setScalar(10000);
sky.sunPosition.value.copy(sunDirection).multiplyScalar(400000);
scene.add(sky);

const sunLight = new DirectionalLight(new Color(0xfff2d9), 2.0);
sunLight.position.copy(sunDirection).multiplyScalar(200);
scene.add(sunLight);

let fftOcean: FFTOcean | undefined;

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

  fftOcean = new FFTOcean(renderer, { patchSize: 500, windSpeed: 18, fetch: 800000 });
  scene.add(
    createFFTOceanMesh(fftOcean, {
      sunDirection,
      sunColor: new Color(0xfff2d9),
    }),
  );

  let frameCount = 0;
  let fpsWindowStart = performance.now();

  renderer.setAnimationLoop(() => {
    fftOcean?.update();
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
