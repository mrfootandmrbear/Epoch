import { Color, DataTexture, MeshStandardNodeMaterial } from "three/webgpu";
import {
  cameraPosition,
  clamp,
  float,
  max,
  mix,
  mx_noise_float,
  normalWorld,
  positionLocal,
  positionWorld,
  smoothstep,
  texture,
  vec2,
  vec3,
  vertexColor,
} from "three/tsl";
import { proceduralBump } from "./procedural-bump";
import {
  causticLight,
  downwelling,
  opticalPath,
  waterHaze,
  waterTransmission,
  type ReefWaterUniforms,
} from "./reef-water";

export interface TerrainMaterialOptions {
  readonly stateTexture: DataTexture;
  readonly volcanicTexture: DataTexture;
  readonly environmentTexture: DataTexture;
  readonly terrainExtent: number;
  readonly seaLevel: number;
  /**
   * Shared submerged shading state. The seabed and the colonies standing on it
   * have to run the same caustics off the same clock, or the light net stops
   * at the base of every colony.
   */
  readonly water: ReefWaterUniforms;
}

export type TerrainMaterial = MeshStandardNodeMaterial & {
  setSeaLevel(value: number): void;
};

/** World-space terrain identity layered over authoritative simulation geometry. */
export function createTerrainMaterial(options: TerrainMaterialOptions): TerrainMaterial {
  const material = new MeshStandardNodeMaterial({ roughness: 0.91, metalness: 0 });
  // One sea level for the shoreline band and for the caustics, taken from the
  // shared submerged state rather than kept privately here: two copies of the
  // same number is two chances for the waterline and the light net to disagree.
  const seaLevel = options.water.seaLevel;
  seaLevel.value = options.seaLevel;
  // The terrain mesh is world-aligned at the origin, so local XZ is also its
  // stable history-texture coordinate. Keeping lookup independent of vertex
  // displacement lets reef relief rise without sliding through its own field.
  const terrainUv = positionLocal.xz.div(options.terrainExtent).add(0.5);
  const state = texture(options.stateTexture, terrainUv);
  const volcanic = texture(options.volcanicTexture, terrainUv);
  const environment = texture(options.environmentTexture, terrainUv);
  const disturbance = state.r;
  const protection = state.g;
  const runoff = state.b;
  const forage = state.a;
  const basalt = volcanic.r;
  const ash = volcanic.g;
  const carbonateDeposit = volcanic.b;
  const substrateAge = volcanic.a;
  const localMoisture = environment.r;
  const localExposure = environment.g;
  const sediment = environment.b;
  const frost = environment.a;

  const slope = float(1).sub(smoothstep(0.7, 0.91, normalWorld.y));
  const shore = float(1).sub(smoothstep(seaLevel.add(0.45), seaLevel.add(2.2), positionWorld.y));
  const groundCover = clamp(max(protection, forage.mul(0.72)).mul(localMoisture.mul(0.55).add(0.55)).mul(float(1).sub(slope)), 0, 1);
  const erosion = clamp(max(disturbance, runoff.mul(0.78)), 0, 1);

  // MaterialX Perlin avoids the large-coordinate precision and grid artifacts
  // of the previous sine hash. Shared world coordinates keep material detail
  // correlatable with runoff and other terrain fields.
  const metres = positionWorld.xz;
  const macro = mx_noise_float(metres.mul(0.075));
  const medium = mx_noise_float(metres.mul(0.42).add(vec2(17.3, -9.1)));
  const grain = mx_noise_float(metres.mul(1.55).add(vec2(-31.7, 22.4)));
  const micro = mx_noise_float(metres.mul(4.4).add(vec2(53.1, 11.8)));
  const carbonateMottle = mx_noise_float(metres.mul(1.55).add(vec2(83.7, -47.2)));
  const carbonateFleck = mx_noise_float(metres.mul(5.2).add(vec2(-121.3, 68.9)));
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

  const drySoil = mix(vertexColor(), new Color(0x8a6740), float(1).sub(localMoisture).mul(0.42));
  const soil = drySoil.mul(macro.mul(0.11).add(0.97));
  const vegetationFloor = mix(soil, new Color(0x2d4827), visibleCover.mul(0.42));
  const exposedRock = mix(vegetationFloor, new Color(0x777064), rockExposure.add(localExposure.mul(0.08)));
  const erodedSoil = mix(exposedRock, new Color(0x75543a), erosion.mul(float(1).sub(slope)).mul(0.38));
  const volcanicGround = mix(erodedSoil, new Color(0x17191a), basalt.mul(0.88));
  const ashGround = mix(volcanicGround, new Color(0x625f59), ash.mul(0.58));
  const sedimentGround = mix(ashGround, new Color(0x806b4d), sediment.mul(0.42).mul(float(1).sub(basalt)));
  const wetGround = mix(sedimentGround, new Color(0x302b22), shore.mul(0.44).add(runoff.mul(0.12)).add(localMoisture.mul(0.08)));
  const groundDetail = wetGround.mul(medium.mul(0.055).mul(mediumFade).add(0.975));

  // Mature reefs manufacture their own pale substrate from coral skeleton,
  // shell and coralline debris. Keep the accepted volcanic shoreline intact:
  // carbonate starts below the surf band, favours shelf-like upward faces,
  // and yields wherever fresh basalt still dominates.
  const waterDepth = max(float(0), seaLevel.sub(positionWorld.y));
  // The history texture stores accumulated carbonate as a deliberately soft
  // field. Lift that field into a legible continuous shelf here rather than
  // representing each reef site with a separate rock mesh: adjoining deposits
  // should visually merge into one reef pavement before colonies are drawn.
  const visibleCarbonate = smoothstep(0.001, 0.06, carbonateDeposit);
  const reefDepthMask = smoothstep(0.9, 2.6, max(float(0), seaLevel.sub(positionLocal.y)))
    .mul(float(1).sub(smoothstep(15, 25, max(float(0), seaLevel.sub(positionLocal.y)))));
  // Carbonate reef is built rock, not pale sand. Broad connected lobes lift
  // the existing terrain into pavement and low ledges; the colony renderer
  // contributes no matching prop rocks. Keeping the lift under a metre lets
  // colony bases remain embedded in rather than buried by the framework.
  const reefMass = smoothstep(-0.38, 0.42, macro.add(medium.mul(0.38)));
  const reefRelief = visibleCarbonate
    .mul(reefDepthMask)
    .mul(float(1).sub(basalt.mul(0.9)))
    .mul(float(0.06).add(reefMass.mul(0.3)));
  material.positionNode = positionLocal.add(vec3(0, reefRelief, 0));
  const carbonateShelf = smoothstep(0.9, 2.6, waterDepth)
    .mul(float(1).sub(smoothstep(15, 25, waterDepth)))
    .mul(smoothstep(0.56, 0.88, normalWorld.y))
    .mul(float(1).sub(basalt.mul(0.86)))
    .mul(visibleCarbonate)
    .mul(float(1).sub(sediment.mul(0.62)));
  // Reef pavement is a mosaic of dead framework, limestone chips, boring
  // holes and coralline films. Cell noise breaks the broad colour wash into
  // fragments; narrow Worley valleys supply dark crevices rather than dunes.
  const fragmentTone = carbonateMottle.mul(0.13).add(carbonateFleck.mul(0.045));
  const carbonateVariation = macro.mul(0.045)
    .add(medium.mul(0.04).mul(mediumFade))
    .add(fragmentTone.mul(grainFade));
  // Submerged carbonate is filtered toward slate/cyan; keep the warm channel
  // below green and blue so it never reads as sunlit brown earth.
  const limestone = vec3(0.43, 0.47, 0.49).add(carbonateVariation);
  const corallineFilm = smoothstep(0.42, 0.78, carbonateMottle.add(medium.mul(0.24)));
  const carbonate = mix(limestone, vec3(0.39, 0.36, 0.45), corallineFilm.mul(0.3));
  const carbonateGround = mix(groundDetail, carbonate, carbonateShelf.mul(0.94));
  const frostCover = frost.mul(float(1).sub(slope.mul(0.72))).mul(float(1).sub(shore));
  const frostColor = mix(new Color(0xb9c0bb), new Color(0xd9dfdc), substrateAge.mul(0.25));
  const groundColor = mix(carbonateGround, frostColor, frostCover.mul(0.72));

  // The moving light net the surface focuses onto the seabed. It is the same
  // function the coral runs, on the same clock and sea level, so a caustic
  // filament crosses from open sand onto a colony without breaking.
  const caustic = causticLight(
    options.water.time,
    options.water.seaLevel,
    normalWorld.y,
    options.water.causticStrength,
  );
  // Bright broad caustics on a smooth low-frequency base were doing most of
  // the "Mario sand" read. They stay visible on reef rock, but subordinate to
  // its fixed material structure.
  const causticGain = mix(float(1.35), float(0.52), carbonateShelf);
  const litGround = groundColor.mul(float(1).add(caustic.mul(causticGain)));

  // The seabed is under the same water as everything standing on it. Without
  // this the sand kept its dry warm brown while the colonies on it were being
  // stripped of red, so coral read as green stones on a beach; and the floor
  // ran to the horizon at full contrast instead of dissolving into open water.
  // Above the waterline every term here collapses to identity, so dry land is
  // untouched.
  const path = opticalPath(options.water.seaLevel);
  const haze = waterHaze(path);
  material.colorNode = litGround.mul(waterTransmission(path)).mul(float(1).sub(haze));
  material.emissiveNode = options.water.hazeColor.mul(haze).mul(downwelling(seaLevel));

  const bumpHeight = macro.mul(0.32)
    .add(medium.mul(0.24).mul(mediumFade).mul(float(1).sub(rockExposure)))
    .add(grain.mul(0.105).mul(grainFade).mul(float(1).sub(rockExposure)))
    .add(micro.mul(0.035).mul(microFade).mul(float(1).sub(rockExposure)))
    .add(rockNoise.mul(0.2).mul(rockExposure).mul(grainFade))
    .add(medium.mul(0.34).mul(carbonateShelf).mul(mediumFade))
    .add(grain.mul(0.16).mul(carbonateShelf).mul(grainFade))
    .add(carbonateMottle.mul(0.28).mul(carbonateShelf).mul(grainFade))
    .add(carbonateFleck.mul(0.11).mul(carbonateShelf).mul(microFade));
  const bumpStrength = mix(float(1.45), float(2.65), rockExposure)
    .mul(float(1).sub(shore.mul(0.38)))
    .add(carbonateShelf.mul(1.65))
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
