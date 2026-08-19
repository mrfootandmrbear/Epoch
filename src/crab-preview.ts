import { AmbientLight, Color, DirectionalLight, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, PlaneGeometry, Scene, WebGPURenderer } from "three/webgpu";
import { createCrabRenderer } from "./crab-renderer";
import type { IntertidalCrabOutcome } from "./outcome-resolver";

type PreviewView = "front" | "side" | "top" | "game-distance";
const requested = new URLSearchParams(location.search).get("view");
const view: PreviewView = requested === "side" || requested === "top" || requested === "game-distance" ? requested : "front";
document.querySelector("#view-label")!.textContent = view.replace("-", " ");

const scene = new Scene();
scene.background = new Color(0x5a5048);
const camera = new PerspectiveCamera(32, innerWidth / innerHeight, 0.02, 40);
const renderer = new WebGPURenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const group = new Group();
scene.add(group);
const crabs = createCrabRenderer(group);

const juvenile: IntertidalCrabOutcome = {
  x: 0, y: 0, z: 0, heading: 0, bodySize: 0.22, redness: 0.12, wetness: 0.55, agility: 0.4, energy: 0.35,
};
const mean: IntertidalCrabOutcome = {
  x: 0, y: 0, z: 0, heading: 0, bodySize: 0.5, redness: 0.62, wetness: 0.7, agility: 0.55, energy: 0.45,
};
const adult: IntertidalCrabOutcome = {
  x: 0, y: 0, z: 0, heading: 0, bodySize: 0.88, redness: 0.94, wetness: 0.8, agility: 0.7, energy: 0.55,
};

const gap = 0.16;
const lineSeats = view === "front"
  ? [
    { ...juvenile, z: gap },
    { ...mean, z: 0 },
    { ...adult, z: -gap },
  ]
  : [
    { ...juvenile, x: -gap },
    { ...mean, x: 0 },
    { ...adult, x: gap },
  ];
const seats: IntertidalCrabOutcome[] = view === "game-distance"
  ? Array.from({ length: 12 }, (_, index) => {
    const row = Math.floor(index / 4);
    const column = index % 4;
    const trait = [juvenile, mean, adult][index % 3]!;
    return {
      ...trait,
      x: column * 0.16 - 0.24 + row * 0.02,
      z: row * -0.14,
      heading: (index % 5) * 0.4,
    };
  })
  : lineSeats;
crabs.setSeats(seats);

const ground = new Mesh(
  new PlaneGeometry(4, 4),
  new MeshStandardMaterial({ color: 0x17191a, roughness: 0.92 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.001;
ground.receiveShadow = true;
scene.add(ground);
scene.add(new AmbientLight(0xdde4db, 1.8));
const sun = new DirectionalLight(0xffedcc, 4.4);
sun.position.set(-1.4, 2.6, 1.8);
scene.add(sun);

if (view === "front") camera.position.set(0.22, 0.05, 0);
if (view === "side") camera.position.set(0, 0.05, 0.22);
if (view === "top") camera.position.set(0, 0.28, 0.01);
if (view === "game-distance") camera.position.set(0.38, 0.22, 0.42);
camera.lookAt(0, 0.02, 0);

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

await renderer.init();
await crabs.ready;
document.documentElement.dataset.captureReady = "true";
renderer.setAnimationLoop(() => {
  crabs.update(performance.now() / 1000, camera.position);
  renderer.render(scene, camera);
});
