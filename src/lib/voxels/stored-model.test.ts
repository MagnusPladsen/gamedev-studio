import { describe, expect, it } from "vitest";
import { FALLBACK_COLORS } from "./colors";
import { sanitizeColors, sanitizeSize } from "./stored-model";

describe("sanitizeSize", () => {
  it("keeps allowed sizes", () => {
    expect(sanitizeSize([8, 32, 64])).toEqual([8, 32, 64]);
  });

  it("falls back to 16 for a missing or malformed size", () => {
    expect(sanitizeSize(undefined)).toEqual([16, 16, 16]);
    expect(sanitizeSize([32])).toEqual([32, 16, 16]);
    expect(sanitizeSize(["x", NaN, null])).toEqual([16, 16, 16]);
  });

  it("clamps huge and tiny axes to the allowed range", () => {
    expect(sanitizeSize([100000, -5, 20])).toEqual([64, 8, 16]);
  });
});

describe("sanitizeColors", () => {
  it("keeps a valid list", () => {
    expect(sanitizeColors(["#ffffff"])).toEqual(["#ffffff"]);
  });

  it("uses the fallback palette when colours are missing or not a list of strings", () => {
    expect(sanitizeColors(undefined)).toBe(FALLBACK_COLORS);
    expect(sanitizeColors("red")).toBe(FALLBACK_COLORS);
    expect(sanitizeColors([1, 2])).toBe(FALLBACK_COLORS);
  });
});
