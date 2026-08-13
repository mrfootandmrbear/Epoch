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
if (view === "front") {
  const matrix = new Matrix4();
  for (let index = 0; index < samples.length; index++) {
    matrix.makeTranslation(0, 0, (index - 1) * 3.2);
    herd.setMatrixAt(index, matrix);
  }
  herd.instanceMatrix.needsUpdate = true;
} else if (view === "game-distance") {
  const matrix = new Matrix4();
  for (let index = 0; index < samples.length; index++) {
    const row = Math.floor(index / 4);
    const column = index % 4;
    matrix.makeTranslation(column * 3.4 - 5.1 + row * 0.35, 0, row * -3.2);
    herd.setMatrixAt(index, matrix);
  }
  herd.instanceMatrix.needsUpdate = true;
}
scene.add(herd);

const ground = new Mesh(
  new PlaneGeometry(60, 60),
  new MeshStandardMaterial({ color: 0x566342, roughness: 0.94 }),
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

if (view === "front") camera.position.set(13, 3.3, 0);
if (view === "side") camera.position.set(4.2, 3.3, 15);
if (view === "top") camera.position.set(4.2, 20, 0.5);
if (view === "game-distance") camera.position.set(17, 12, 25);
camera.lookAt(
  view === "front" || view === "game-distance" ? 0 : 4.2,
  view === "top" ? 0 : 1.35,
  view === "game-distance" ? -3.2 : 0,
);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

await renderer.init();
renderer.setAnimationLoop(() => renderer.render(scene, camera));
