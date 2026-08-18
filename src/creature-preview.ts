import {
  AmbientLight,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  Matrix4,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGPURenderer,
} from "three/webgpu";
import { createCreatureExpressionSpike, type CreatureExpressionSample } from "./creature-expression-spike";

type PreviewView = "front" | "side" | "top" | "game-distance";
const requested = new URLSearchParams(location.search).get("view");
const view: PreviewView = requested === "side" || requested === "top" || requested === "game-distance" ? requested : "front";
document.querySelector("#view-label")!.textContent = view.replace("-", " ");

const scene = new Scene();
scene.background = new Color(0xc9c0a8);
const camera = new PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 120);
const renderer = new WebGPURenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.body.prepend(renderer.domElement);

const low: CreatureExpressionSample = { shape: [0.08, 0.12, 0.1, 0.08, 0.08], coatWarmth: 0.15, coatLightness: 0.72, walkPhase: 0.12 };
const mean: CreatureExpressionSample = { shape: [0.5, 0.5, 0.5, 0.5, 0.5], coatWarmth: 0.5, coatLightness: 0.5, walkPhase: 0.48 };
const high: CreatureExpressionSample = { shape: [0.92, 0.9, 0.9, 0.92, 0.9], coatWarmth: 0.9, coatLightness: 0.24, walkPhase: 0.82 };
const samples = view === "game-distance"
  ? Array.from({ length: 12 }, (_, index) => [low, mean, high][index % 3]!)
  : [low, mean, high];
const herd = createCreatureExpressionSpike(samples);
const gap = 1.45;
if (view === "front") {
  const matrix = new Matrix4();
  for (let index = 0; index < samples.length; index++) {
    matrix.makeTranslation(0, 0, (1 - index) * gap);
    herd.setMatrixAt(index, matrix);
  }
  herd.instanceMatrix.needsUpdate = true;
} else if (view === "game-distance") {
  const matrix = new Matrix4();
  for (let index = 0; index < samples.length; index++) {
    const row = Math.floor(index / 4);
    const column = index % 4;
    matrix.makeTranslation(column * 1.55 - 2.3 + row * 0.18, 0, row * -1.45);
    herd.setMatrixAt(index, matrix);
  }
  herd.instanceMatrix.needsUpdate = true;
}
scene.add(herd);

const ground = new Mesh(
  new PlaneGeometry(24, 24),
  new MeshStandardMaterial({ color: 0x8a7a58, roughness: 0.94 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);
scene.add(new AmbientLight(0xdde5db, 1.8));
const sun = new DirectionalLight(0xffedcc, 4.2);
sun.position.set(-8, 14, 9);
sun.castShadow = true;
scene.add(sun);

if (view === "front") camera.position.set(6.4, 0.85, 0);
if (view === "side") camera.position.set(1.55, 0.85, 6.6);
if (view === "top") camera.position.set(1.55, 8.2, 0.12);
if (view === "game-distance") camera.position.set(7.2, 4.4, 9.2);
camera.lookAt(
  view === "front" ? 0 : view === "game-distance" ? 0.1 : 1.55,
  view === "top" ? 0 : 0.22,
  view === "game-distance" ? -0.8 : 0,
);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

await renderer.init();
document.documentElement.dataset.captureReady = "true";
renderer.setAnimationLoop(() => renderer.render(scene, camera));
