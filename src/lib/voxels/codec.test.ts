import { describe, expect, it } from "vitest";
import { decodeVoxels, encodeVoxels } from "./codec";

describe("encodeVoxels / decodeVoxels", () => {
  it("compresses empty grids to short strings", () => {
    const small = new Uint8Array(16 ** 3);
    const large = new Uint8Array(64 ** 3);
    expect(encodeVoxels(small).length).toBeLessThan(60);
    expect(encodeVoxels(large).length).toBeLessThan(3000);
    expect(decodeVoxels(encodeVoxels(large), large.length)).toEqual(large);
  });

  it("round-trips random data", () => {
    const data = new Uint8Array(4096).map(() => Math.floor(Math.random() * 256));
    expect(decodeVoxels(encodeVoxels(data), data.length)).toEqual(data);
  });

  it("returns zeros for invalid base64", () => {
    expect(decodeVoxels("!!not base64", 64)).toEqual(new Uint8Array(64));
  });

  it("pads short data with zeros and truncates long data", () => {
    const encoded = encodeVoxels(new Uint8Array(10).fill(7));
    const padded = decodeVoxels(encoded, 20);
    expect(Array.from(padded.slice(0, 10))).toEqual(Array(10).fill(7));
    expect(Array.from(padded.slice(10))).toEqual(Array(10).fill(0));
    expect(decodeVoxels(encoded, 5)).toEqual(new Uint8Array(5).fill(7));
  });

  it("splits runs longer than 255 into pairs", () => {
    const encoded = encodeVoxels(new Uint8Array(600).fill(2));
    const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
    expect(Array.from(bytes)).toEqual([255, 2, 255, 2, 90, 2]);
  });
});
