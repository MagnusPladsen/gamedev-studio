import { describe, expect, it } from "vitest";
import { addColor, MAX_COLORS, nearestColorValue, remapToPalette } from "./colors";
import { createGrid, getVoxel } from "./grid";
import { setCells } from "./edit";

const manyColors = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => `#${index.toString(16).padStart(6, "0")}`);

describe("nearestColorValue", () => {
  it("returns the 1-based index of the closest colour", () => {
    expect(nearestColorValue(["#000000", "#ff0000", "#0000ff"], "#f01010")).toBe(2);
  });
});

describe("addColor", () => {
  it("reuses an exact match regardless of case", () => {
    expect(addColor(["#AABBCC"], "#aabbcc")).toEqual({ colors: ["#AABBCC"], value: 1 });
  });

  it("appends a new colour", () => {
    expect(addColor(["#000000"], "#ffffff")).toEqual({ colors: ["#000000", "#ffffff"], value: 2 });
  });

  it("returns the nearest value when the list is full", () => {
    const colors = manyColors(MAX_COLORS);
    const result = addColor(colors, "#000005");
    expect(result.colors).toHaveLength(MAX_COLORS);
    expect(result.value).toBe(6);
  });
});

describe("remapToPalette", () => {
  it("caps the new palette at 255 colours", () => {
    const grid = setCells(createGrid([4, 4, 4]), [[0, 0, 0]], 1);
    const result = remapToPalette(grid, ["#ff0000"], manyColors(300));
    expect(result.colors).toHaveLength(MAX_COLORS);
    expect(Math.max(...result.grid.data)).toBeLessThanOrEqual(MAX_COLORS);
  });

  it("maps a red voxel to the reddest target", () => {
    const grid = setCells(createGrid([4, 4, 4]), [[1, 1, 1]], 1);
    const result = remapToPalette(grid, ["#ff0000"], ["#0000ff", "#00ff00", "#ee1111"]);
    expect(getVoxel(result.grid, 1, 1, 1)).toBe(3);
  });
});
