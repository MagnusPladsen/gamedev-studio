import { addColor } from "./colors";
import { createGrid, GRID_SIZES, MAX_GRID_SIZE, voxelIndex, type VoxelGrid } from "./grid";

export interface PixelImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type SpriteImport =
  | { ok: true; grid: VoxelGrid; colors: string[] }
  | { ok: false; reason: "too-large" | "empty" };

const OPAQUE_ALPHA = 128;

function toHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function spriteToVoxels(image: PixelImage, colors: string[]): SpriteImport {
  const { width, height, data } = image;
  if (width > MAX_GRID_SIZE || height > MAX_GRID_SIZE) return { ok: false, reason: "too-large" };

  const side = GRID_SIZES.find((candidate) => candidate >= Math.max(width, height)) ?? MAX_GRID_SIZE;
  const grid = createGrid([side, side, side]);
  const offsetX = Math.floor((side - width) / 2);
  const z = Math.floor(side / 2);
  let palette = colors;
  let hasVoxels = false;

  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const offset = (row * width + column) * 4;
      if (data[offset + 3] < OPAQUE_ALPHA) continue;
      const added = addColor(palette, toHex(data[offset], data[offset + 1], data[offset + 2]));
      palette = added.colors;
      grid.data[voxelIndex(grid.size, offsetX + column, height - 1 - row, z)] = added.value;
      hasVoxels = true;
    }
  }

  return hasVoxels ? { ok: true, grid, colors: palette } : { ok: false, reason: "empty" };
}
