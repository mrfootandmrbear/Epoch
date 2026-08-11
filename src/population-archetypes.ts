export interface PopulationArchetype {
  readonly label: string;
  readonly emergenceAge: number;
  readonly seed: number;
  readonly shelteredAffinity: number;
  readonly niche: Readonly<{
    moisture: number;
    moistureDeepTime: number;
    drainage: number;
    slope: number;
    slopeDeepTime: number;
    exposure: number;
    exposureDeepTime: number;
  }>;
}

export const POPULATION_ARCHETYPES = {
  "sheltered-grazer": {
    label: "Sheltered grazer",
    emergenceAge: 100,
    seed: 401,
    shelteredAffinity: 1,
    niche: {
      moisture: 1.7,
      moistureDeepTime: 0.35,
      drainage: 0.45,
      slope: -0.9,
      slopeDeepTime: 0,
      exposure: -0.25,
      exposureDeepTime: -0.2,
    },
  },
  "ridge-grazer": {
    label: "Ridge grazer",
    emergenceAge: 1_000,
    seed: 409,
    shelteredAffinity: 0,
    niche: {
      moisture: -0.3,
      moistureDeepTime: 0,
      drainage: 0,
      slope: 0.8,
      slopeDeepTime: 0.3,
      exposure: 1.25,
      exposureDeepTime: 0.45,
    },
  },
} as const satisfies Record<string, PopulationArchetype>;

export type PopulationIdentity = keyof typeof POPULATION_ARCHETYPES;

export function isPopulationIdentity(value: unknown): value is PopulationIdentity {
  return typeof value === "string" && Object.hasOwn(POPULATION_ARCHETYPES, value);
}

export function populationArchetype(identity: PopulationIdentity): PopulationArchetype {
  return POPULATION_ARCHETYPES[identity];
}

export function lineageSeed(identity: PopulationIdentity, lineageId: string): number {
  const archetypeSeed = POPULATION_ARCHETYPES[identity].seed;
  if (lineageId === `${identity}:0`) return archetypeSeed;
  let seed: number = archetypeSeed;
  for (let index = 0; index < lineageId.length; index++) {
    seed = Math.imul(seed ^ lineageId.charCodeAt(index), 16_777_619);
  }
  return seed >>> 0;
}
