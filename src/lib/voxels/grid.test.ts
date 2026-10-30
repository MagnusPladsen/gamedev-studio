import { describe, expect, it } from "vitest";
import { createGrid, getVoxel, resizeGrid, voxelIndex } from "./grid";

describe("createGrid", () => {
  it("allocates one byte per voxel", () => {
    expect(createGrid([4, 4, 4]).data.length).toBe(64);
  });
});

describe("getVoxel", () => {
  it("returns 0 out of bounds", () => {
    const grid = createGrid([4, 4, 4]);
    expect(getVoxel(grid, -1, 0, 0)).toBe(0);
    expect(getVoxel(grid, 0, 4, 0)).toBe(0);
    expect(getVoxel(grid, 0, 0, 99)).toBe(0);
  });
});

describe("resizeGrid", () => {
  it("centres X/Z when growing", () => {
    const grid = createGrid([8, 8, 8]);
    grid.data[voxelIndex(grid.size, 0, 0, 0)] = 3;
    const result = resizeGrid(grid, [16, 16, 16]);
    expect(getVoxel(result.grid, 4, 0, 4)).toBe(3);
    expect(result.lost).toBe(0);
  });

  it("reports voxels cropped when shrinking", () => {
    const grid = createGrid([16, 16, 16]);
    grid.data[voxelIndex(grid.size, 0, 0, 0)] = 3;
    expect(resizeGrid(grid, [8, 8, 8]).lost).toBe(1);
  });

  it("keeps the centre voxel when shrinking", () => {
    const grid = createGrid([16, 16, 16]);
    grid.data[voxelIndex(grid.size, 8, 0, 8)] = 5;
    const result = resizeGrid(grid, [8, 8, 8]);
    expect(getVoxel(result.grid, 4, 0, 4)).toBe(5);
    expect(result.lost).toBe(0);
  });
});
