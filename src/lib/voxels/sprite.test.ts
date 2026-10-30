import { describe, expect, it } from "vitest";
import { getVoxel } from "./grid";
import { spriteToVoxels, type PixelImage } from "./sprite";

const blank = (width: number, height: number): PixelImage => ({
  width,
  height,
  data: new Uint8ClampedArray(width * height * 4),
});

const setPixel = (image: PixelImage, x: number, y: number, rgba: number[]): void => {
  image.data.set(rgba, (y * image.width + x) * 4);
};

describe("spriteToVoxels", () => {
  it("places the top-left pixel at the top of the model, centred", () => {
    const image = blank(2, 3);
    setPixel(image, 0, 0, [255, 0, 0, 255]);
    const result = spriteToVoxels(image, []);
    if (!result.ok) throw new Error("expected ok");
    expect(result.grid.size).toEqual([8, 8, 8]);
    expect(getVoxel(result.grid, 3, 2, 4)).toBe(1);
    expect(result.colors).toEqual(["#ff0000"]);
  });

  it("rejects sprites larger than 64", () => {
    expect(spriteToVoxels(blank(65, 10), [])).toEqual({ ok: false, reason: "too-large" });
  });

  it("rejects fully transparent sprites", () => {
    expect(spriteToVoxels(blank(4, 4), [])).toEqual({ ok: false, reason: "empty" });
  });

  it("skips pixels with alpha below 128", () => {
    const image = blank(1, 1);
    setPixel(image, 0, 0, [255, 0, 0, 127]);
    expect(spriteToVoxels(image, [])).toEqual({ ok: false, reason: "empty" });
  });

  it("caps the palette at 255 colours", () => {
    const image = blank(20, 15);
    for (let index = 0; index < 300; index++) {
      setPixel(image, index % 20, Math.floor(index / 20), [index % 256, Math.floor(index / 256), 7, 255]);
    }
    const result = spriteToVoxels(image, []);
    if (!result.ok) throw new Error("expected ok");
    expect(result.colors).toHaveLength(255);
    const solid = Array.from(result.grid.data).filter((value) => value !== 0);
    expect(solid).toHaveLength(300);
    expect(Math.min(...solid)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...solid)).toBeLessThanOrEqual(255);
  });
});
