import { getVoxel, type Vec3, type VoxelGrid } from "./grid";

export interface RayHit {
  cell: Vec3 | null;
  normal: Vec3;
  place: Vec3;
}

interface BoxEntry {
  tEnter: number;
  entryAxis: number;
}

function intersectGridBox(origin: Vec3, dir: Vec3, size: Vec3): BoxEntry | null {
  let tEnter = -Infinity;
  let tExit = Infinity;
  let entryAxis = 1;
  for (let axis = 0; axis < 3; axis++) {
    if (dir[axis] === 0) {
      if (origin[axis] < 0 || origin[axis] > size[axis]) return null;
      continue;
    }
    const near = (0 - origin[axis]) / dir[axis];
    const far = (size[axis] - origin[axis]) / dir[axis];
    const lower = Math.min(near, far);
    if (lower > tEnter) {
      tEnter = lower;
      entryAxis = axis;
    }
    tExit = Math.min(tExit, Math.max(near, far));
  }
  return tExit < 0 || tEnter > tExit ? null : { tEnter, entryAxis };
}

function groundHit(origin: Vec3, dir: Vec3, size: Vec3): RayHit | null {
  if (origin[1] <= 0 || dir[1] >= 0) return null;
  const t = -origin[1] / dir[1];
  const x = origin[0] + dir[0] * t;
  const z = origin[2] + dir[2] * t;
  if (x < 0 || x > size[0] || z < 0 || z > size[2]) return null;
  const place: Vec3 = [Math.min(Math.floor(x), size[0] - 1), 0, Math.min(Math.floor(z), size[2] - 1)];
  return { cell: null, normal: [0, 1, 0], place };
}

function makeHit(cell: Vec3, axis: number, step: number): RayHit {
  const normal: Vec3 = [0, 0, 0];
  normal[axis] = -step;
  return { cell, normal, place: [cell[0] + normal[0], cell[1] + normal[1], cell[2] + normal[2]] };
}

function marchVoxels(origin: Vec3, dir: Vec3, grid: VoxelGrid, entry: BoxEntry): RayHit | null {
  const size = grid.size;
  const tStart = Math.max(entry.tEnter, 0);
  const cell: Vec3 = [0, 1, 2].map((axis) => {
    const position = origin[axis] + dir[axis] * tStart;
    return Math.min(Math.max(Math.floor(position), 0), size[axis] - 1);
  }) as Vec3;
  const step = dir.map((component) => Math.sign(component));
  const tDelta = dir.map((component) => (component === 0 ? Infinity : Math.abs(1 / component)));
  const tMax = [0, 1, 2].map((axis) => {
    if (step[axis] === 0) return Infinity;
    const boundary = cell[axis] + (step[axis] > 0 ? 1 : 0);
    return (boundary - origin[axis]) / dir[axis];
  });
  let axis = entry.tEnter > 0 ? entry.entryAxis : 1;
  if (getVoxel(grid, ...cell) !== 0) return makeHit([...cell], axis, step[axis] || -1);
  for (;;) {
    axis = tMax[0] <= tMax[1] && tMax[0] <= tMax[2] ? 0 : tMax[1] <= tMax[2] ? 1 : 2;
    cell[axis] += step[axis];
    if (cell[axis] < 0 || cell[axis] >= size[axis]) return null;
    tMax[axis] += tDelta[axis];
    if (getVoxel(grid, ...cell) !== 0) return makeHit([...cell], axis, step[axis]);
  }
}

export function raycastGrid(origin: Vec3, dir: Vec3, grid: VoxelGrid): RayHit | null {
  const entry = intersectGridBox(origin, dir, grid.size);
  if (!entry) return null;
  return marchVoxels(origin, dir, grid, entry) ?? groundHit(origin, dir, grid.size);
}
