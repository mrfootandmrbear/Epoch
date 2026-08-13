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

/**
 * Min-heap over cell indices keyed by f-score. A linear scan over an open Set
 * costs O(open) per pop, which a seven-animal herd never noticed and a
 * ninety-six-animal herd cannot afford.
 */
class OpenHeap {
  private readonly cells: number[] = [];
  private readonly keys: number[] = [];

  get size(): number {
    return this.cells.length;
  }

  push(cell: number, key: number): void {
    this.cells.push(cell);
    this.keys.push(key);
    let child = this.cells.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (this.keys[parent]! <= this.keys[child]!) break;
      this.swap(parent, child);
      child = parent;
    }
  }

  pop(): number {
    const top = this.cells[0]!;
    const cell = this.cells.pop()!;
    const key = this.keys.pop()!;
    if (this.cells.length === 0) return top;
    this.cells[0] = cell;
    this.keys[0] = key;
    let parent = 0;
    for (;;) {
      const left = parent * 2 + 1;
      const right = left + 1;
      let smallest = parent;
      if (left < this.keys.length && this.keys[left]! < this.keys[smallest]!) smallest = left;
      if (right < this.keys.length && this.keys[right]! < this.keys[smallest]!) smallest = right;
      if (smallest === parent) break;
      this.swap(parent, smallest);
      parent = smallest;
    }
    return top;
  }

  private swap(a: number, b: number): void {
    const cell = this.cells[a]!;
    this.cells[a] = this.cells[b]!;
    this.cells[b] = cell;
    const key = this.keys[a]!;
    this.keys[a] = this.keys[b]!;
    this.keys[b] = key;
  }
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
  const open = new OpenHeap();
  const cameFrom = new Int32Array(WIDTH * WIDTH).fill(-1);
  const gScore = new Float32Array(WIDTH * WIDTH).fill(Infinity);
  const closed = new Uint8Array(WIDTH * WIDTH);
  gScore[startIndex] = 0;
  open.push(startIndex, Math.hypot(gx - sx, gz - sz));

  while (open.size) {
    const current = open.pop();
    if (current === goalIndex) break;
    // Stale heap entries are cheaper to skip on pop than to decrease in place.
    if (closed[current]) continue;
    closed[current] = 1;
    const cx = current % WIDTH;
    const cz = Math.floor(current / WIDTH);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= WIDTH || nz >= WIDTH) continue;
      const neighbor = index(nx, nz);
      if (closed[neighbor]) continue;
      const stepCost = movementCost(heightAt, nx, nz, climate);
      if (!Number.isFinite(stepCost)) continue;
      const tentative = gScore[current] + stepCost;
      if (tentative >= gScore[neighbor]) continue;
      cameFrom[neighbor] = current;
      gScore[neighbor] = tentative;
      open.push(neighbor, tentative + Math.hypot(gx - nx, gz - nz));
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
