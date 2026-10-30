import type { Vec3, VoxelGrid } from "./grid";
import { hexToRgb } from "./colors";

export const EXPORT_SCALE = 0.1;

export interface Quad {
  corners: [Vec3, Vec3, Vec3, Vec3];
  normal: Vec3;
  value: number;
}

export interface MeshGroup {
  value: number;
  start: number;
  count: number;
}

export interface MeshArrays {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  groups: MeshGroup[];
}

function buildMask(grid: VoxelGrid, axis: number, direction: 1 | -1, slice: number): Uint8Array {
  const u = (axis + 1) % 3;
  const v = (axis + 2) % 3;
  const [width, height] = [grid.size[u], grid.size[v]];
  const strides: Vec3 = [1, grid.size[0], grid.size[0] * grid.size[1]];
  const neighbourSlice = slice + direction;
  const neighbourOffset = neighbourSlice >= 0 && neighbourSlice < grid.size[axis] ? direction * strides[axis] : 0;
  const mask = new Uint8Array(width * height);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const index = slice * strides[axis] + i * strides[u] + j * strides[v];
      const neighbour = neighbourOffset === 0 ? 0 : grid.data[index + neighbourOffset];
      mask[i + j * width] = neighbour === 0 ? grid.data[index] : 0;
    }
  }
  return mask;
}

function rectangleSize(mask: Uint8Array, width: number, height: number, i: number, j: number): [number, number] {
  const value = mask[i + j * width];
  let w = 1;
  while (i + w < width && mask[i + w + j * width] === value) w++;
  let h = 1;
  while (j + h < height && rowMatches(mask, width, value, i, j + h, w)) h++;
  return [w, h];
}

function rowMatches(mask: Uint8Array, width: number, value: number, i: number, j: number, length: number): boolean {
  for (let k = 0; k < length; k++) if (mask[i + k + j * width] !== value) return false;
  return true;
}

function makeQuad(axis: number, direction: 1 | -1, plane: number, i: number, j: number, w: number, h: number, value: number): Quad {
  const u = (axis + 1) % 3;
  const v = (axis + 2) % 3;
  const corner = (du: number, dv: number): Vec3 => {
    const point: Vec3 = [0, 0, 0];
    point[axis] = plane;
    point[u] = i + du;
    point[v] = j + dv;
    return point;
  };
  const corners: Quad["corners"] =
    direction === 1
      ? [corner(0, 0), corner(w, 0), corner(w, h), corner(0, h)]
      : [corner(0, 0), corner(0, h), corner(w, h), corner(w, 0)];
  const normal: Vec3 = [0, 0, 0];
  normal[axis] = direction;
  return { corners, normal, value };
}

function sliceQuads(grid: VoxelGrid, axis: number, direction: 1 | -1, slice: number): Quad[] {
  const u = (axis + 1) % 3;
  const v = (axis + 2) % 3;
  const [width, height] = [grid.size[u], grid.size[v]];
  const mask = buildMask(grid, axis, direction, slice);
  const plane = direction === 1 ? slice + 1 : slice;
  const quads: Quad[] = [];
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const value = mask[i + j * width];
      if (value === 0) continue;
      const [w, h] = rectangleSize(mask, width, height, i, j);
      quads.push(makeQuad(axis, direction, plane, i, j, w, h, value));
      for (let dj = 0; dj < h; dj++) mask.fill(0, i + (j + dj) * width, i + w + (j + dj) * width);
    }
  }
  return quads;
}

export function greedyQuads(grid: VoxelGrid): Quad[] {
  const quads: Quad[] = [];
  for (let axis = 0; axis < 3; axis++) {
    for (const direction of [1, -1] as const) {
      for (let slice = 0; slice < grid.size[axis]; slice++) {
        quads.push(...sliceQuads(grid, axis, direction, slice));
      }
    }
  }
  return quads;
}

export function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function groupQuadsByValue(quads: Quad[]): Map<number, Quad[]> {
  const byValue = new Map<number, Quad[]>();
  for (const quad of quads) {
    const list = byValue.get(quad.value);
    if (list) list.push(quad);
    else byValue.set(quad.value, [quad]);
  }
  return new Map([...byValue.entries()].sort((a, b) => a[0] - b[0]));
}

export function buildMesh(quads: Quad[], colors: string[], size: Vec3, scale: number = EXPORT_SCALE): MeshArrays {
  const positions = new Float32Array(quads.length * 12);
  const normals = new Float32Array(quads.length * 12);
  const vertexColors = new Float32Array(quads.length * 12);
  const indices = new Uint32Array(quads.length * 6);
  const groups: MeshGroup[] = [];
  const offset: Vec3 = [size[0] / 2, 0, size[2] / 2];
  let quadIndex = 0;
  for (const [value, valueQuads] of groupQuadsByValue(quads)) {
    const linear = hexToRgb(colors[value - 1] ?? "#ffffff").map(srgbToLinear);
    groups.push({ value, start: quadIndex * 6, count: valueQuads.length * 6 });
    for (const quad of valueQuads) {
      quad.corners.forEach((corner, k) => {
        const base = quadIndex * 12 + k * 3;
        for (let axis = 0; axis < 3; axis++) {
          positions[base + axis] = (corner[axis] - offset[axis]) * scale;
          normals[base + axis] = quad.normal[axis];
          vertexColors[base + axis] = linear[axis];
        }
      });
      const first = quadIndex * 4;
      indices.set([first, first + 1, first + 2, first, first + 2, first + 3], quadIndex * 6);
      quadIndex++;
    }
  }
  return { positions, normals, colors: vertexColors, indices, groups };
}
