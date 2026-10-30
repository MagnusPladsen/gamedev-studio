import { describe, expect, it } from "vitest";
import { createGrid, voxelIndex } from "./grid";
import { toVox } from "./export-vox";

function chunks(bytes: Uint8Array): Map<string, { start: number; size: number }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const found = new Map<string, { start: number; size: number }>();
  let offset = 8;
  while (offset < bytes.length) {
    const id = String.fromCharCode(...bytes.slice(offset, offset + 4));
    const size = view.getInt32(offset + 4, true);
    found.set(id, { start: offset + 12, size });
    offset += id === "MAIN" ? 12 : 12 + size;
  }
  return found;
}

describe("toVox", () => {
  it("writes the header and rotates axes to Z-up", () => {
    const grid = createGrid([4, 4, 4]);
    grid.data[voxelIndex(grid.size, 1, 2, 3)] = 5;
    const bytes = toVox(grid, ["#ff0000", "#00ff00", "#0000ff", "#ffffff", "#123456"]);
    const view = new DataView(bytes.buffer);
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe("VOX ");
    expect(view.getInt32(4, true)).toBe(150);
    const found = chunks(bytes);
    const xyzi = found.get("XYZI")!;
    expect(view.getInt32(xyzi.start, true)).toBe(1);
    expect(Array.from(bytes.slice(xyzi.start + 4, xyzi.start + 8))).toEqual([1, 0, 2, 5]);
    const size = found.get("SIZE")!;
    expect([0, 4, 8].map((o) => view.getInt32(size.start + o, true))).toEqual([4, 4, 4]);
  });

  it("writes a 1024 byte palette with entry i-1 for value i", () => {
    const bytes = toVox(createGrid([2, 2, 2]), ["#102030"]);
    const rgba = chunks(bytes).get("RGBA")!;
    expect(rgba.size).toBe(1024);
    expect(Array.from(bytes.slice(rgba.start, rgba.start + 8))).toEqual([0x10, 0x20, 0x30, 255, 0, 0, 0, 255]);
  });

  it("is valid for an empty grid", () => {
    const bytes = toVox(createGrid([2, 2, 2]), []);
    const view = new DataView(bytes.buffer);
    const xyzi = chunks(bytes).get("XYZI")!;
    expect(view.getInt32(xyzi.start, true)).toBe(0);
    expect(view.getInt32(12, true)).toBe(0);
    expect(view.getInt32(16, true)).toBe(bytes.length - 20);
  });
});
