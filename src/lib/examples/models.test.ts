import { describe, expect, it, vi } from "vitest";
import { decodeVoxels } from "../voxels/codec";
import { voxelIndex } from "../voxels/grid";
import { layersToGrid, modelExamples } from "./models";

vi.mock("../voxels/thumbnail", () => ({ renderThumbnail: () => "data:image/png;base64,AA==" }));

const ctx = { projectId: "p1", id: (slug: string) => `p1--ex--${slug}` };

describe("layersToGrid", () => {
  it("reads one layer per Y from the bottom, one row per Z and one char per X", () => {
    const grid = layersToGrid([2, 2, 2], [["a.", ".."], ["..", ".b"]], { a: 1, b: 2 });
    expect(grid.data[voxelIndex(grid.size, 0, 0, 0)]).toBe(1);
    expect(grid.data[voxelIndex(grid.size, 1, 1, 1)]).toBe(2);
    expect(grid.data.filter((value) => value !== 0)).toHaveLength(2);
  });

  it("leaves unknown characters empty", () => {
    const grid = layersToGrid([2, 2, 2], [["?x", ".."]], { x: 1 });
    expect(grid.data.filter((value) => value !== 0)).toHaveLength(1);
  });
});

describe("modelExamples", () => {
  const items = modelExamples[0].build(ctx) as {
    id: string;
    size: [number, number, number];
    colors: string[];
    voxels: string;
  }[];

  it("builds the five Pip's Quest models with example ids", () => {
    expect(modelExamples[0].collection).toBe("models");
    expect(items.map((item) => item.id)).toEqual(
      ["hero-3d", "coin-3d", "chest-3d", "slime-3d", "tree-3d"].map(ctx.id),
    );
  });

  it("keeps every voxel inside its palette and grid", () => {
    for (const item of items) {
      const length = item.size[0] * item.size[1] * item.size[2];
      const data = decodeVoxels(item.voxels, length);
      expect(data.length).toBe(length);
      expect(Math.max(...data)).toBeLessThanOrEqual(item.colors.length);
      expect(data.some((value) => value !== 0)).toBe(true);
    }
  });

  it("makes Pip exactly 16 voxels tall in a 16 cube", () => {
    const pip = items[0];
    expect(pip.size).toEqual([16, 16, 16]);
    const data = decodeVoxels(pip.voxels, 16 ** 3);
    const heights = [...data.keys()].filter((index) => data[index] !== 0).map((index) => Math.floor(index / 16) % 16);
    expect(Math.min(...heights)).toBe(0);
    expect(Math.max(...heights)).toBe(15);
  });
});
