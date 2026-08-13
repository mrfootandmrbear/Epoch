import { AmbientLight, Color, DirectionalLight, Group, Matrix4, PerspectiveCamera, Scene, WebGPURenderer } from "three/webgpu";
import { createFishRenderer } from "./fish-renderer";

type PreviewView = "front" | "side" | "top" | "game-distance" | "swim";
const requested = new URLSearchParams(location.search).get("view");
const view: PreviewView = requested === "side" || requested === "top" || requested === "game-distance" || requested === "swim" ? requested : "front";
document.querySelector("#view-label")!.textContent = view.replace("-", " ");

const scene = new Scene();
scene.background = new Color(0x42636a);
const camera = new PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 80);
const renderer = new WebGPURenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const group = new Group();
scene.add(group);
const fish = createFishRenderer(group);
const openFish = createFishRenderer(group);
const reefTraits = { bodySize: 0.58, streamlining: 0.18, depthPreference: 0.64, thermalTolerance: 0.74, maneuverability: 0.94, depthControl: 0.82, propulsionPlan: "tail" as const };
const openTraits = { bodySize: 0.58, streamlining: 0.94, depthPreference: 0.42, thermalTolerance: 0.48, maneuverability: 0.12, depthControl: 0.28, propulsionPlan: "tail" as const };
const sampleCount = view === "game-distance" ? 4 : 2;
const reefSamples = Array.from({ length: sampleCount }, (_, index) => ({
  x: view === "game-distance" ? index * 1.7 + 0.9 : 1.2,
  y: view === "game-distance" ? -0.8 : (index - 0.5) * 1.65,
  z: 0,
  heading: 0,
  scale: 1,
}));
const openSamples = reefSamples.map((sample) => ({ ...sample, x: sample.x - (view === "game-distance" ? 5.2 : 2.4) }));
fish.setPopulation({ id: "reef-preview", status: "active", visible: true, traits: reefTraits, abundance: 0.8, energy: 0.72 }, reefSamples);
openFish.setPopulation({ id: "open-preview", status: "active", visible: true, traits: openTraits, abundance: 0.8, energy: 0.72 }, openSamples);
if (view !== "swim") {
  const matrix = new Matrix4();
  reefSamples.forEach((sample, index) => {
    matrix.makeScale(0.29, 0.29, 0.29); matrix.setPosition(sample.x, sample.y, sample.z);
    fish.mesh.setMatrixAt(index, matrix);
    const open = openSamples[index]!;
    matrix.makeScale(0.29, 0.29, 0.29); matrix.setPosition(open.x, open.y, open.z);
    openFish.mesh.setMatrixAt(index, matrix);
  });
  fish.mesh.instanceMatrix.needsUpdate = true;
  openFish.mesh.instanceMatrix.needsUpdate = true;
}

scene.add(new AmbientLight(0xd8f0e9, 2.2));
const sun = new DirectionalLight(0xffefd0, 4.5);
sun.position.set(5, 8, 10);
scene.add(sun);
if (view === "front") camera.position.set(8, 0, 0);
if (view === "side" || view === "swim") camera.position.set(0, 0, 10);
if (view === "top") camera.position.set(0, 11, 0.1);
if (view === "game-distance") camera.position.set(7, 6, 14);
camera.lookAt(0, view === "game-distance" ? -0.5 : 0, 0);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

await renderer.init();
renderer.setAnimationLoop(() => {
  if (view === "swim") fish.update(performance.now() / 1000);
  if (view === "swim") openFish.update(performance.now() / 1000);
  renderer.render(scene, camera);
});
