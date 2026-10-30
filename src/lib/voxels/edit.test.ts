import { describe, expect, it } from "vitest";
import { boxCells, fillFaceCells, mirrorCells, paintCells, setCells } from "./edit";
import { createGrid, getVoxel, type Vec3 } from "./grid";

const sorted = (cells: Vec3[]): string[] => cells.map((cell) => cell.join(",")).sort();

describe("mirrorCells", () => {
  it("mirrors across x", () => {
    expect(sorted(mirrorCells([[0, 0, 0]], [4, 4, 4], { x: true, y: false, z: false }))).toEqual(["0,0,0", "3,0,0"]);
  });

  it("deduplicates the centre cell", () => {
    expect(mirrorCells([[2, 1, 1]], [5, 5, 5], { x: true, y: false, z: false })).toHaveLength(1);
  });

  it("combines axes", () => {
    expect(mirrorCells([[0, 0, 0]], [4, 4, 4], { x: true, y: false, z: true })).toHaveLength(4);
  });
});

describe("setCells", () => {
  it("returns the same grid when nothing changes", () => {
    const grid = createGrid([4, 4, 4]);
    expect(setCells(grid, [[1, 1, 1]], 0)).toBe(grid);
    expect(setCells(grid, [[-1, 0, 0]], 3)).toBe(grid);
  });

  it("writes into a new grid", () => {
    const grid = createGrid([4, 4, 4]);
    const next = setCells(grid, [[1, 1, 1], [-1, 0, 0]], 3);
    expect(next).not.toBe(grid);
    expect(getVoxel(next, 1, 1, 1)).toBe(3);
    expect(getVoxel(grid, 1, 1, 1)).toBe(0);
  });
});

describe("paintCells", () => {
  it("recolours solid cells only", () => {
    const grid = setCells(createGrid([4, 4, 4]), [[0, 0, 0]], 1);
    const next = paintCells(grid, [[0, 0, 0], [1, 0, 0]], 5);
    expect(getVoxel(next, 0, 0, 0)).toBe(5);
    expect(getVoxel(next, 1, 0, 0)).toBe(0);
  });
});

describe("boxCells", () => {
  it("is inclusive and corner-order independent", () => {
    expect(boxCells([0, 0, 0], [1, 1, 1])).toHaveLength(8);
    expect(sorted(boxCells([1, 1, 1], [0, 0, 0]))).toEqual(sorted(boxCells([0, 0, 0], [1, 1, 1])));
  });
});

describe("fillFaceCells", () => {
  const slab = (): ReturnType<typeof createGrid> => {
    const cells: Vec3[] = [];
    for (let z = 0; z < 3; z++) for (let x = 0; x < 3; x++) cells.push([x, 0, z]);
    return setCells(createGrid([3, 3, 3]), cells, 1);
  };

  it("floods the same-coloured exposed face", () => {
    const grid = setCells(slab(), [[1, 0, 1]], 2);
    expect(fillFaceCells(grid, [0, 0, 0], [0, 1, 0])).toHaveLength(8);
  });

  it("excludes voxels covered along the normal", () => {
    const grid = setCells(slab(), [[1, 1, 1]], 1);
    expect(fillFaceCells(grid, [0, 0, 0], [0, 1, 0])).toHaveLength(8);
  });
});
