import {
  AnimationAction,
  AnimationMixer,
  Group,
  MeshStandardNodeMaterial,
  Object3D,
  Vector3,
} from "three/webgpu";
import { float, mix, uniform, vec3, vertexColor } from "three/tsl";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import type { AnimationClip } from "three";
import glbUrl from "../assets/ecosystem/epoch-intertidal-crab/exports/sally-lightfoot.glb";
import type { IntertidalCrabOutcome } from "./outcome-resolver";

const MAX_CRABS = 40;
const CRYPTIC = vec3(0.30, 0.25, 0.17);

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** Authored GLB is already in metres. Trait 0.5 is the mean adult. */
export function crabInstanceScale(bodySize: number): number {
  return 0.82 + clamp01(bodySize) * 0.28;
}

type RednessUniform = { value: number };

interface CrabActor {
  root: Object3D;
  mixer: AnimationMixer;
  idleAction: AnimationAction | undefined;
  walkAction: AnimationAction | undefined;
  redness: RednessUniform;
  wetness: RednessUniform;
  visible: boolean;
  agility: number;
  energy: number;
}

export interface CrabRenderer {
  readonly mesh: Group;
  readonly ready: Promise<void>;
  setSeats: (seats: readonly IntertidalCrabOutcome[]) => void;
  update: (elapsed: number, viewPosition?: Readonly<Vector3>) => void;
}

function makeHideMaterial(rednessValue: number, wetnessValue: number) {
  const redness = uniform(rednessValue);
  const wetness = uniform(wetnessValue);
  const material = new MeshStandardNodeMaterial({
    roughness: 0.66,
    metalness: 0,
    vertexColors: true,
  });
  material.colorNode = mix(CRYPTIC, vertexColor(), redness.mul(redness)).mul(float(1).sub(wetness.mul(0.16)));
  return { material, redness, wetness };
}

function poseActor(actor: CrabActor, seat: IntertidalCrabOutcome): void {
  actor.visible = true;
  actor.root.visible = true;
  actor.root.position.set(seat.x, seat.y, seat.z);
  actor.root.rotation.set(0, seat.heading, 0);
  actor.root.scale.setScalar(crabInstanceScale(seat.bodySize));
  actor.redness.value = clamp01(seat.redness);
  actor.wetness.value = clamp01(seat.wetness);
  actor.agility = clamp01(seat.agility);
  actor.energy = clamp01(seat.energy);
  const scuttle = actor.agility * 0.55 + actor.energy * 0.45 > 0.42;
  if (actor.idleAction && actor.walkAction && actor.idleAction !== actor.walkAction) {
    actor.idleAction.setEffectiveWeight(scuttle ? 0.15 : 1);
    actor.walkAction.setEffectiveWeight(scuttle ? 1 : 0);
  }
}

export function createCrabRenderer(parent: Group): CrabRenderer {
  const mesh = new Group();
  mesh.visible = false;
  parent.add(mesh);
  const actors: CrabActor[] = [];
  let pending: IntertidalCrabOutcome[] | null = [];
  let lastElapsed = 0;
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => { resolveReady = resolve; });

  function applySeats(seats: readonly IntertidalCrabOutcome[]): void {
    actors.forEach((actor, index) => {
      const seat = seats[index];
      if (!seat) {
        actor.visible = false;
        actor.root.visible = false;
        return;
      }
      poseActor(actor, seat);
    });
    mesh.visible = seats.length > 0;
  }

  if (typeof document !== "undefined") {
    new GLTFLoader().load(glbUrl, (gltf) => {
      const idleClip = gltf.animations.find((clip: AnimationClip) => clip.name === "idle") ?? gltf.animations[0];
      const walkClip = gltf.animations.find((clip: AnimationClip) => clip.name === "walk") ?? idleClip;
      for (let index = 0; index < MAX_CRABS; index += 1) {
        const root = cloneSkinned(gltf.scene);
        const { material, redness, wetness } = makeHideMaterial(0.7, 0.6);
        root.traverse((object) => {
          const node = object as Object3D & { isMesh?: boolean; material?: unknown };
          if (node.isMesh) node.material = material;
        });
        root.visible = false;
        mesh.add(root);
        const mixer = new AnimationMixer(root);
        const idleAction = idleClip ? mixer.clipAction(idleClip) : undefined;
        const walkAction = walkClip && walkClip !== idleClip ? mixer.clipAction(walkClip) : idleAction;
        idleAction?.play();
        if (walkAction && walkAction !== idleAction) walkAction.play();
        actors.push({
          root, mixer, idleAction, walkAction, redness, wetness,
          visible: false, agility: 0.5, energy: 0.4,
        });
      }
      if (pending) applySeats(pending);
      pending = null;
      resolveReady();
    }, () => undefined, () => resolveReady());
  } else {
    resolveReady();
  }

  return {
    mesh,
    ready,
    setSeats(seats) {
      if (actors.length === 0) {
        pending = [...seats];
        return;
      }
      applySeats(seats);
    },
    update(elapsed, viewPosition) {
      void viewPosition;
      const dt = lastElapsed === 0 ? 0 : Math.max(0, elapsed - lastElapsed);
      lastElapsed = elapsed;
      actors.forEach((actor) => {
        if (!actor.visible) return;
        actor.mixer.update(dt);
      });
    },
  };
}
