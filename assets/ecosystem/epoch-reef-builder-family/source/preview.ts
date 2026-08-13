import { AmbientLight, Color, DirectionalLight, Mesh, MeshStandardMaterial, OrthographicCamera, PlaneGeometry, Scene, WebGLRenderer } from "three";
import { coralGeometry } from "../../../../src/coral-geometry-assets";
import { CORAL_GUILDS } from "../../../../src/reef-succession";

const scene = new Scene();
scene.background = new Color(0xd9e3df);
const aspect = innerWidth / innerHeight;
const camera = new OrthographicCamera(-6.5 * aspect, 6.5 * aspect, 6.5, -6.5, 0.1, 100);
const view = new URLSearchParams(location.search).get("view") ?? "front";
camera.position.set(view === "side" ? 9 : view === "top" ? 0.01 : 7.8, view === "top" ? 11 : 4.4, view === "side" ? 0.01 : 9);
camera.lookAt(0, 0.8, 0);
scene.add(new AmbientLight(0xffffff, 1.8));
const sun = new DirectionalLight(0xfff4dc, 3.2); sun.position.set(-5, 9, 6); scene.add(sun);
const floor = new Mesh(new PlaneGeometry(18, 12), new MeshStandardMaterial({ color: 0x877962, roughness: 0.95 }));
floor.rotation.x = -Math.PI / 2; scene.add(floor);
const colors = [0xa94c83, 0xc99a68, 0x7996d4, 0xd7bd70, 0x88a47c, 0x9a5bb6];
CORAL_GUILDS.forEach((guild, index) => {
  const mesh = new Mesh(coralGeometry(guild, "near"), new MeshStandardMaterial({ color: colors[index], roughness: 0.78 }));
  mesh.position.set((index % 3 - 1) * 3.4, 0, (Math.floor(index / 3) - 0.5) * 3.2);
  const scale = guild === "crustose-algae" ? [1.5, 0.5, 1.5] : guild === "table" ? [1.25, 1, 1.25] : [1.15, 1.55, 1.15];
  mesh.scale.set(scale[0]!, scale[1]!, scale[2]!); scene.add(mesh);
});
const renderer = new WebGLRenderer({ antialias: true }); renderer.setPixelRatio(devicePixelRatio); renderer.setSize(innerWidth, innerHeight); renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement); renderer.render(scene, camera); document.documentElement.dataset.captureReady = "true";
