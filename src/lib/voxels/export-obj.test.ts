import { describe, expect, it } from "vitest";
import { createGrid, voxelIndex } from "./grid";
import { toObj } from "./export-obj";
import { buildMesh, greedyQuads } from "./mesh";

const COLORS = ["#ff0000", "#00ff00", "#0000ff"];

function lines(text: string, prefix: string): string[] {
  return text.split("\n").filter((line) => line.startsWith(prefix));
}

describe("toObj", () => {
  it("writes vertices, faces and one material per used colour", () => {
    const grid = createGrid([4, 4, 4]);
    grid.data[voxelIndex(grid.size, 0, 0, 0)] = 1;
    grid.data[voxelIndex(grid.size, 2, 0, 0)] = 3;
    const mesh = buildMesh(greedyQuads(grid), COLORS, grid.size);
    const { obj, mtl } = toObj(mesh, COLORS, "model");
    expect(obj).toContain("mtllib model.mtl");
    expect(lines(obj, "v ")).toHaveLength(mesh.positions.length / 3);
    expect(lines(obj, "f ")).toHaveLength(mesh.indices.length / 3);
    expect(lines(mtl, "newmtl ")).toEqual(["newmtl c1", "newmtl c3"]);
    expect(lines(mtl, "Kd ")).toEqual(["Kd 1 0 0", "Kd 0 0 1"]);
    expect(lines(obj, "usemtl ")).toEqual(["usemtl c1", "usemtl c3"]);
  });

  it("writes Kd as linear values, which is how Blender reads it", () => {
    const grid = createGrid([2, 2, 2]);
    grid.data[voxelIndex(grid.size, 0, 0, 0)] = 1;
    const mesh = buildMesh(greedyQuads(grid), ["#808080"], grid.size);
    expect(lines(toObj(mesh, ["#808080"], "model").mtl, "Kd ")).toEqual(["Kd 0.215861 0.215861 0.215861"]);
  });

  it("is valid for an empty mesh", () => {
    const mesh = buildMesh([], [], [4, 4, 4]);
    const { obj, mtl } = toObj(mesh, [], "empty");
    expect(lines(obj, "f ")).toHaveLength(0);
    expect(lines(mtl, "newmtl ")).toHaveLength(0);
  });
});
