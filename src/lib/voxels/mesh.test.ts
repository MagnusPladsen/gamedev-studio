import { describe, expect, it } from "vitest";
import { createGrid, voxelIndex, type Vec3, type VoxelGrid } from "./grid";
import { buildMesh, EXPORT_SCALE, greedyQuads, type Quad } from "./mesh";

function gridWith(size: Vec3, voxels: [number, number, number, number][]): VoxelGrid {
  const grid = createGrid(size);
  for (const [x, y, z, value] of voxels) grid.data[voxelIndex(size, x, y, z)] = value;
  return grid;
}

function quadArea(quad: Quad): number {
  const [a, b, , d] = quad.corners;
  const edgeU = b.map((value, i) => value - a[i]);
  const edgeV = d.map((value, i) => value - a[i]);
  return Math.hypot(...edgeU) * Math.hypot(...edgeV);
}

function exposedFaces(grid: VoxelGrid): number {
  const [sx, sy, sz] = grid.size;
  const at = (x: number, y: number, z: number): number =>
    x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz ? 0 : grid.data[voxelIndex(grid.size, x, y, z)];
  let faces = 0;
  for (let z = 0; z < sz; z++)
    for (let y = 0; y < sy; y++)
      for (let x = 0; x < sx; x++) {
        if (!at(x, y, z)) continue;
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]])
          if (!at(x + dx, y + dy, z + dz)) faces++;
      }
  return faces;
}

describe("greedyQuads", () => {
  it("emits 6 quads for one voxel", () => {
    expect(greedyQuads(gridWith([4, 4, 4], [[1, 1, 1, 1]]))).toHaveLength(6);
  });

  it("merges a 2x1x1 bar of one colour into 6 quads", () => {
    expect(greedyQuads(gridWith([4, 4, 4], [[0, 0, 0, 1], [1, 0, 0, 1]]))).toHaveLength(6);
  });

  it("splits two colours side by side into 10 quads", () => {
    expect(greedyQuads(gridWith([4, 4, 4], [[0, 0, 0, 1], [1, 0, 0, 2]]))).toHaveLength(10);
  });

  it("merges a solid 4 cube into 6 quads", () => {
    const voxels: [number, number, number, number][] = [];
    for (let z = 0; z < 4; z++) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) voxels.push([x, y, z, 1]);
    expect(greedyQuads(gridWith([4, 4, 4], voxels))).toHaveLength(6);
  });

  it("covers exactly the exposed faces of a random grid", () => {
    let seed = 12345;
    const random = (): number => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const grid = createGrid([8, 8, 8]);
    for (let i = 0; i < grid.data.length; i++) grid.data[i] = random() < 0.4 ? 1 + Math.floor(random() * 3) : 0;
    const area = greedyQuads(grid).reduce((sum, quad) => sum + quadArea(quad), 0);
    expect(area).toBe(exposedFaces(grid));
  });

  it("winds counter-clockwise seen from outside", () => {
    for (const quad of greedyQuads(gridWith([4, 4, 4], [[1, 1, 1, 1]]))) {
      const [a, b, c] = quad.corners;
      const ab = b.map((v, i) => v - a[i]);
      const ac = c.map((v, i) => v - a[i]);
      const cross = [
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
      ];
      expect(cross.map((v) => v || 0)).toEqual(quad.normal.map((v) => v || 0));
    }
  });

  it("returns nothing for an empty grid", () => {
    expect(greedyQuads(createGrid([4, 4, 4]))).toEqual([]);
  });
});

describe("buildMesh", () => {
  it("scales a 16-high column to 1.6 and centres X/Z", () => {
    const voxels: [number, number, number, number][] = [];
    for (let y = 0; y < 16; y++) voxels.push([8, y, 8, 1]);
    const size: Vec3 = [16, 16, 16];
    const mesh = buildMesh(greedyQuads(gridWith(size, voxels)), ["#ff0000"], size);
    const axis = (offset: number): number[] =>
      Array.from({ length: mesh.positions.length / 3 }, (_, i) => mesh.positions[i * 3 + offset]);
    expect(Math.min(...axis(1))).toBeCloseTo(0);
    expect(Math.max(...axis(1))).toBeCloseTo(16 * EXPORT_SCALE);
    expect(Math.min(...axis(0))).toBeCloseTo(0);
    expect(Math.max(...axis(0))).toBeCloseTo(0.1);
    expect(Math.min(...axis(2))).toBeCloseTo(0);
  });

  it("converts sRGB hex to linear colours", () => {
    const mesh = buildMesh(greedyQuads(gridWith([2, 2, 2], [[0, 0, 0, 1]])), ["#808080"], [2, 2, 2]);
    expect(mesh.colors[0]).toBeCloseTo(0.2158, 3);
  });

  it("groups index ranges per colour value, sorted", () => {
    const grid = gridWith([4, 4, 4], [[0, 0, 0, 2], [2, 0, 0, 1]]);
    const mesh = buildMesh(greedyQuads(grid), ["#ff0000", "#00ff00"], grid.size);
    expect(mesh.groups.map((group) => group.value)).toEqual([1, 2]);
    expect(mesh.groups[0]).toEqual({ value: 1, start: 0, count: 36 });
    expect(mesh.groups[1]).toEqual({ value: 2, start: 36, count: 36 });
    expect(mesh.indices).toHaveLength(72);
  });

  it("produces empty arrays for an empty grid", () => {
    const mesh = buildMesh([], [], [4, 4, 4]);
    expect(mesh.positions).toHaveLength(0);
    expect(mesh.indices).toHaveLength(0);
    expect(mesh.groups).toEqual([]);
  });
});
