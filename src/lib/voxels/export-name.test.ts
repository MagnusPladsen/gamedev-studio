import { describe, expect, it } from "vitest";
import { exportFileBase } from "./export-name";

describe("exportFileBase", () => {
  it("lowercases and joins words with dashes", () => {
    expect(exportFileBase("Pip The Fox")).toBe("pip-the-fox");
  });

  it("collapses symbols and trims dashes", () => {
    expect(exportFileBase("  ../My *Model*!  ")).toBe("my-model");
  });

  it("falls back to model when nothing usable is left", () => {
    expect(exportFileBase("")).toBe("model");
    expect(exportFileBase("???")).toBe("model");
    expect(exportFileBase("ключ")).toBe("model");
  });
});
