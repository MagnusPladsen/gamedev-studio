import { afterEach, describe, expect, it } from "vitest";
import { getOpenAsset, setOpenAsset } from "@/lib/open-asset";

describe("open asset store", () => {
  afterEach(() => setOpenAsset(null));

  it("returns what was set", () => {
    setOpenAsset({ type: "note", id: "n1" });
    expect(getOpenAsset()).toEqual({ type: "note", id: "n1" });
  });

  it("clears with null", () => {
    setOpenAsset({ type: "note", id: "n1" });
    setOpenAsset(null);
    expect(getOpenAsset()).toBeNull();
  });
});
