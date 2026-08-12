import { Color, DataTexture, MeshStandardNodeMaterial, Node } from "three/webgpu";
import {
  Fn,
  abs,
  cameraPosition,
  clamp,
  faceDirection,
  float,
  max,
  mix,
  mx_noise_float,
  normalView,
  normalWorld,
  positionView,
  positionWorld,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vertexColor,
} from "three/tsl";

export interface TerrainMaterialOptions {
  readonly stateTexture: DataTexture;
  readonly terrainExtent: number;
  readonly seaLevel: number;
}

export type TerrainMaterial = MeshStandardNodeMaterial & {
  setSeaLevel(value: number): void;
};

/** Perturb a procedural surface without requiring UV-addressable bump textures. */
const proceduralBump = Fn(([height, strength]: [Node<"float">, Node<"float">]) => {
  const sigmaX = positionView.dFdx().normalize();
  const sigmaY = positionView.dFdy().normalize();
  const heightDerivative = vec2(height.dFdx(), height.dFdy()).mul(strength);
  const r1 = sigmaY.cross(normalView);
  const r2 = normalView.cross(sigmaX);
  const determinant = sigmaX.dot(r1).mul(faceDirection);
  const gradient = determinant.sign().mul(heightDerivative.x.mul(r1).add(heightDerivative.y.mul(r2)));
  return abs(determinant).mul(normalView).sub(gradient).normalize();
});

/** World-space terrain identity layered over authoritative simulation geometry. */
export function createTerrainMaterial(options: TerrainMaterialOptions): TerrainMaterial {
  const material = new MeshStandardNodeMaterial({ roughness: 0.91, metalness: 0 });
  const seaLevel = uniform(options.seaLevel);
  const terrainUv = positionWorld.xz.div(options.terrainExtent).add(0.5);
  const state = texture(options.stateTexture, terrainUv);
  const disturbance = state.r;
  const protection = state.g;
  const runoff = state.b;
  const forage = state.a;

  const slope = float(1).sub(smoothstep(0.7, 0.91, normalWorld.y));
  const shore = float(1).sub(smoothstep(seaLevel.add(0.45), seaLevel.add(2.2), positionWorld.y));
  const groundCover = clamp(max(protection, forage.mul(0.72)).mul(float(1).sub(slope)), 0, 1);
  const erosion = clamp(max(disturbance, runoff.mul(0.78)), 0, 1);

  // MaterialX Perlin avoids the large-coordinate precision and grid artifacts
  // of the previous sine hash. UVs map exactly to the 380 m simulation domain.
  const metres = uv().sub(0.5).mul(options.terrainExtent);
  const macro = mx_noise_float(metres.mul(0.075));
  const medium = mx_noise_float(metres.mul(0.42).add(vec2(17.3, -9.1)));
  const grain = mx_noise_float(metres.mul(1.55).add(vec2(-31.7, 22.4)));
  const micro = mx_noise_float(metres.mul(4.4).add(vec2(53.1, 11.8)));
  // Volume noise is orientation independent on exposed faces, avoiding the
  // contour bands that fine XZ projection creates on steep heightfield walls.
  const rockNoise = mx_noise_float(positionWorld.mul(0.58).add(19.7));
  const distance = cameraPosition.sub(positionWorld).length();
  const mediumFade = float(1).sub(smoothstep(95, 330, distance));
  const grainFade = float(1).sub(smoothstep(34, 105, distance));
  const microFade = float(1).sub(smoothstep(16, 52, distance));

  const coverPatches = smoothstep(-0.42, 0.34, macro.add(medium.mul(0.24)));
  const visibleCover = groundCover.mul(mix(float(0.48), float(1), coverPatches));
  const rockPatches = smoothstep(-0.2, 0.52, rockNoise.add(macro.mul(0.28)));
  const rockExposure = clamp(
    slope.mul(mix(float(0.62), float(0.94), rockPatches)).add(erosion.mul(0.2)),
    0,
    0.9,
  );

  const soil = vertexColor().mul(macro.mul(0.11).add(0.97));
  const vegetationFloor = mix(soil, new Color(0x2d4827), visibleCover.mul(0.42));
  const exposedRock = mix(vegetationFloor, new Color(0x777064), rockExposure);
  const erodedSoil = mix(exposedRock, new Color(0x75543a), erosion.mul(float(1).sub(slope)).mul(0.38));
  const wetGround = mix(erodedSoil, new Color(0x302b22), shore.mul(0.44).add(runoff.mul(0.12)));
  material.colorNode = wetGround.mul(medium.mul(0.055).mul(mediumFade).add(0.975));

  const bumpHeight = macro.mul(0.32)
    .add(medium.mul(0.24).mul(mediumFade).mul(float(1).sub(rockExposure)))
    .add(grain.mul(0.105).mul(grainFade).mul(float(1).sub(rockExposure)))
    .add(micro.mul(0.035).mul(microFade).mul(float(1).sub(rockExposure)))
    .add(rockNoise.mul(0.2).mul(rockExposure).mul(grainFade));
  const bumpStrength = mix(float(1.45), float(2.65), rockExposure)
    .mul(float(1).sub(shore.mul(0.38)))
    .mul(float(1).sub(smoothstep(250, 520, distance)));
  material.normalNode = proceduralBump(bumpHeight, bumpStrength);
  material.roughnessNode = clamp(
    float(0.76).add(visibleCover.mul(0.14)).add(grain.mul(0.08).mul(grainFade)).sub(shore.mul(0.12)),
    0.62,
    0.98,
  );

  return Object.assign(material, {
    setSeaLevel(value: number) {
      seaLevel.value = value;
    },
  });
}
