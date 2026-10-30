import { describe, expect, it } from "vitest";
import { createGrid } from "./grid";
import { setCells } from "./edit";
import { raycastGrid } from "./raycast";

describe("raycastGrid", () => {
  it("hits the top of a voxel", () => {
    const grid = setCells(createGrid([4, 4, 4]), [[0, 0, 0]], 1);
    expect(raycastGrid([0.5, 10, 0.5], [0, -1, 0], grid)).toEqual({
      cell: [0, 0, 0],
      normal: [0, 1, 0],
      place: [0, 1, 0],
    });
  });

  it("hits the ground on an empty grid", () => {
    const hit = raycastGrid([0.5, 10, 0.5], [0, -1, 0], createGrid([4, 4, 4]));
    expect(hit).toEqual({ cell: null, normal: [0, 1, 0], place: [0, 0, 0] });
  });

  it("misses when pointing away", () => {
    expect(raycastGrid([0.5, 10, 0.5], [0, 1, 0], createGrid([4, 4, 4]))).toBeNull();
  });

  it("hits a side face", () => {
    const grid = setCells(createGrid([4, 4, 4]), [[2, 1, 1]], 1);
    expect(raycastGrid([-3, 1.5, 1.5], [1, 0, 0], grid)).toEqual({
      cell: [2, 1, 1],
      normal: [-1, 0, 0],
      place: [1, 1, 1],
    });
  });
});
