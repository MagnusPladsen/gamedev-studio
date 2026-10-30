import { getVoxel, inBounds, voxelIndex, type Vec3, type VoxelGrid } from "./grid";

export interface Symmetry {
  x: boolean;
  y: boolean;
  z: boolean;
}

export function mirrorCells(cells: Vec3[], size: Vec3, symmetry: Symmetry): Vec3[] {
  const flips = [symmetry.x, symmetry.y, symmetry.z];
  const seen = new Map<string, Vec3>();
  for (const cell of cells) {
    let variants: Vec3[] = [cell];
    for (let axis = 0; axis < 3; axis++) {
      if (!flips[axis]) continue;
      variants = variants.flatMap((variant) => {
        const mirrored: Vec3 = [...variant];
        mirrored[axis] = size[axis] - 1 - variant[axis];
        return [variant, mirrored];
      });
    }
    for (const variant of variants) seen.set(variant.join(","), variant);
  }
  return [...seen.values()];
}

function writeCells(grid: VoxelGrid, cells: Vec3[], pickValue: (current: number) => number): VoxelGrid {
  let next: VoxelGrid | null = null;
  for (const [x, y, z] of cells) {
    if (!inBounds(grid.size, x, y, z)) continue;
    const index = voxelIndex(grid.size, x, y, z);
    const current = (next ?? grid).data[index];
    const value = pickValue(current);
    if (value === current) continue;
    next ??= { size: grid.size, data: grid.data.slice() };
    next.data[index] = value;
  }
  return next ?? grid;
}

export function setCells(grid: VoxelGrid, cells: Vec3[], value: number): VoxelGrid {
  return writeCells(grid, cells, () => value);
}

export function paintCells(grid: VoxelGrid, cells: Vec3[], value: number): VoxelGrid {
  return writeCells(grid, cells, (current) => (current === 0 ? 0 : value));
}

export function boxCells(a: Vec3, b: Vec3): Vec3[] {
  const cells: Vec3[] = [];
  for (let z = Math.min(a[2], b[2]); z <= Math.max(a[2], b[2]); z++) {
    for (let y = Math.min(a[1], b[1]); y <= Math.max(a[1], b[1]); y++) {
      for (let x = Math.min(a[0], b[0]); x <= Math.max(a[0], b[0]); x++) cells.push([x, y, z]);
    }
  }
  return cells;
}

export function fillFaceCells(grid: VoxelGrid, start: Vec3, normal: Vec3): Vec3[] {
  const normalAxis = normal.findIndex((component) => component !== 0);
  const target = getVoxel(grid, ...start);
  if (normalAxis < 0 || target === 0) return [];
  const planeAxes = [0, 1, 2].filter((axis) => axis !== normalAxis);
  const isExposed = (cell: Vec3): boolean => {
    if (getVoxel(grid, ...cell) !== target) return false;
    const above: Vec3 = [cell[0] + normal[0], cell[1] + normal[1], cell[2] + normal[2]];
    return getVoxel(grid, ...above) === 0;
  };
  if (!isExposed(start)) return [];
  const visited = new Set<string>([start.join(",")]);
  const result: Vec3[] = [];
  const queue: Vec3[] = [start];
  while (queue.length > 0) {
    const cell = queue.pop() as Vec3;
    result.push(cell);
    for (const axis of planeAxes) {
      for (const step of [-1, 1]) {
        const neighbour: Vec3 = [...cell];
        neighbour[axis] += step;
        const key = neighbour.join(",");
        if (visited.has(key) || !isExposed(neighbour)) continue;
        visited.add(key);
        queue.push(neighbour);
      }
    }
  }
  return result;
}
