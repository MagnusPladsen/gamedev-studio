export type Vec3 = [number, number, number];

export interface VoxelGrid {
  size: Vec3;
  data: Uint8Array;
}

export const GRID_SIZES = [8, 16, 32, 64] as const;
export const DEFAULT_GRID_SIZE = 16;
export const MAX_GRID_SIZE = 64;

export function createGrid(size: Vec3): VoxelGrid {
  return { size, data: new Uint8Array(size[0] * size[1] * size[2]) };
}

export function inBounds(size: Vec3, x: number, y: number, z: number): boolean {
  return x >= 0 && y >= 0 && z >= 0 && x < size[0] && y < size[1] && z < size[2];
}

export function voxelIndex(size: Vec3, x: number, y: number, z: number): number {
  return x + y * size[0] + z * size[0] * size[1];
}

export function getVoxel(grid: VoxelGrid, x: number, y: number, z: number): number {
  if (!inBounds(grid.size, x, y, z)) return 0;
  return grid.data[voxelIndex(grid.size, x, y, z)];
}

export function countVoxels(grid: VoxelGrid): number {
  let count = 0;
  for (const value of grid.data) if (value !== 0) count++;
  return count;
}

export function resizeGrid(grid: VoxelGrid, size: Vec3): { grid: VoxelGrid; lost: number } {
  const resized = createGrid(size);
  const offsetX = Math.floor((size[0] - grid.size[0]) / 2);
  const offsetZ = Math.floor((size[2] - grid.size[2]) / 2);
  let lost = 0;
  for (let z = 0; z < grid.size[2]; z++) {
    for (let y = 0; y < grid.size[1]; y++) {
      for (let x = 0; x < grid.size[0]; x++) {
        const value = grid.data[voxelIndex(grid.size, x, y, z)];
        if (value === 0) continue;
        const targetX = x + offsetX;
        const targetZ = z + offsetZ;
        if (inBounds(size, targetX, y, targetZ)) {
          resized.data[voxelIndex(size, targetX, y, targetZ)] = value;
        } else {
          lost++;
        }
      }
    }
  }
  return { grid: resized, lost };
}
