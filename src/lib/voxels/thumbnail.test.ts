import { describe, expect, it } from "vitest";
import { createGrid, voxelIndex, type Vec3, type VoxelGrid } from "./grid";
import { isoFaces } from "./thumbnail";

function gridWith(size: Vec3, voxels: [number, number, number, number][]): VoxelGrid {
  const grid = createGrid(size);
  for (const [x, y, z, value] of voxels) grid.data[voxelIndex(size, x, y, z)] = value;
  return grid;
}

describe("isoFaces", () => {
  it("returns nothing for an empty grid", () => {
    expect(isoFaces(createGrid([2, 2, 2]), ["#ff8040"])).toEqual([]);
  });

  it("draws one voxel as left, right and top faces shaded 0.8, 0.6 and 1.0", () => {
    const faces = isoFaces(gridWith([1, 1, 1], [[0, 0, 0, 1]]), ["#ff8040"]);
    expect(faces.map((face) => face.fill)).toEqual(["#cc6633", "#994d26", "#ff8040"]);
    for (const face of faces) expect(face.points).toHaveLength(4);
  });

  it("hides faces shared between stacked voxels", () => {
    const faces = isoFaces(gridWith([1, 2, 1], [[0, 0, 0, 1], [0, 1, 0, 1]]), ["#ff8040"]);
    expect(faces).toHaveLength(5);
  });

  it("draws a top face last for a solid cube", () => {
    const voxels: [number, number, number, number][] = [];
    for (let z = 0; z < 2; z++) for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) voxels.push([x, y, z, 1]);
    const faces = isoFaces(gridWith([2, 2, 2], voxels), ["#ff8040"]);
    expect(faces[faces.length - 1].fill).toBe("#ff8040");
  });
});
