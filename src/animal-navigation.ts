import { Vector3 } from "three/webgpu";
import { sampleHabitat } from "./outcome-resolver";
import { SEA_LEVEL, type ClimateForces } from "./climate";

type HeightAt = (x: number, z: number) => number;

const CELL = 6;
const LIMIT = 150;
const WIDTH = Math.floor((LIMIT * 2) / CELL) + 1;

function grid(value: number): number {
  return Math.max(0, Math.min(WIDTH - 1, Math.round((value + LIMIT) / CELL)));
}

function world(cell: number): number {
  return cell * CELL - LIMIT;
}

function index(x: number, z: number): number {
  return z * WIDTH + x;
}

function movementCost(
  heightAt: HeightAt,
  x: number,
  z: number,
  climate: ClimateForces,
): number {
  const habitat = sampleHabitat(heightAt, world(x), world(z), climate);
  if (habitat.elevation < SEA_LEVEL[climate.seaLevel] + 1.3 || habitat.slope > 1.05) {
    return Infinity;
  }
  return 1 + habitat.slope * 3.2 + habitat.exposure * 0.18;
}

/** Finds a coarse terrain-aware route. Jumps use population outcomes; this is only for visible life. */
export function findTerrainPath(
  heightAt: HeightAt,
  start: Vector3,
  goal: Vector3,
  climate: ClimateForces,
): Vector3[] {
  const sx = grid(start.x);
  const sz = grid(start.z);
  const gx = grid(goal.x);
  const gz = grid(goal.z);
  const startIndex = index(sx, sz);
  const goalIndex = index(gx, gz);
  const open = new Set<number>([startIndex]);
  const cameFrom = new Int32Array(WIDTH * WIDTH).fill(-1);
  const gScore = new Float32Array(WIDTH * WIDTH).fill(Infinity);
  const fScore = new Float32Array(WIDTH * WIDTH).fill(Infinity);
  gScore[startIndex] = 0;
  fScore[startIndex] = Math.hypot(gx - sx, gz - sz);

  while (open.size) {
    let current = -1;
    let best = Infinity;
    for (const candidate of open) {
      if (fScore[candidate] < best) {
        best = fScore[candidate];
        current = candidate;
      }
    }
    if (current === goalIndex) break;
    open.delete(current);
    const cx = current % WIDTH;
    const cz = Math.floor(current / WIDTH);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= WIDTH || nz >= WIDTH) continue;
      const stepCost = movementCost(heightAt, nx, nz, climate);
      if (!Number.isFinite(stepCost)) continue;
      const neighbor = index(nx, nz);
      const tentative = gScore[current] + stepCost;
      if (tentative >= gScore[neighbor]) continue;
      cameFrom[neighbor] = current;
      gScore[neighbor] = tentative;
      fScore[neighbor] = tentative + Math.hypot(gx - nx, gz - nz);
      open.add(neighbor);
    }
  }

  if (goalIndex !== startIndex && cameFrom[goalIndex] < 0) return [];
  const reversed: Vector3[] = [];
  let current = goalIndex;
  while (current !== startIndex && current >= 0) {
    const x = world(current % WIDTH);
    const z = world(Math.floor(current / WIDTH));
    reversed.push(new Vector3(x, heightAt(x, z), z));
    current = cameFrom[current];
  }
  return reversed.reverse();
}

export function isWalkable(
  heightAt: HeightAt,
  x: number,
  z: number,
  climate: ClimateForces,
): boolean {
  const habitat = sampleHabitat(heightAt, x, z, climate);
  return habitat.elevation >= SEA_LEVEL[climate.seaLevel] + 1.3 && habitat.slope <= 1.05;
}
