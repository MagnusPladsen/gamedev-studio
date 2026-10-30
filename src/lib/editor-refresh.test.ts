import { describe, expect, it } from "vitest";
import { decideEditorRefresh, willOpenParamChange } from "./editor-refresh";

const ref = (id: string) => ({ id });

describe("decideEditorRefresh", () => {
  it("navigates to a created asset", () => {
    expect(decideEditorRefresh({ kind: "created", ref: ref("new") }, "a", ref("a"))).toEqual({ kind: "navigate", open: "new" });
  });

  it("clears the editor when the deleted asset is the tracked one and the URL has no open param", () => {
    expect(decideEditorRefresh({ kind: "deleted", ref: ref("a") }, null, ref("a"))).toEqual({ kind: "navigate", open: null });
  });

  it("clears the editor when the deleted asset is the open param and nothing is tracked", () => {
    expect(decideEditorRefresh({ kind: "deleted", ref: ref("a") }, "a", null)).toEqual({ kind: "navigate", open: null });
  });

  it("keeps the tracked asset open when another asset changes and the URL differs", () => {
    expect(decideEditorRefresh({ kind: "changed", ref: ref("b") }, null, ref("a"))).toEqual({ kind: "navigate", open: "a" });
  });

  it("reloads when the tracked asset already matches the URL", () => {
    expect(decideEditorRefresh({ kind: "changed", ref: ref("b") }, "a", ref("a"))).toEqual({ kind: "reload" });
  });

  it("ignores an untracked asset when another asset is deleted", () => {
    expect(decideEditorRefresh({ kind: "deleted", ref: ref("b") }, null, null)).toEqual({ kind: "reload" });
  });
});

describe("willOpenParamChange", () => {
  it("is false when the target equals the current open param", () => {
    expect(willOpenParamChange(null, null)).toBe(false);
    expect(willOpenParamChange("a", "a")).toBe(false);
  });

  it("is true when it differs", () => {
    expect(willOpenParamChange("a", null)).toBe(true);
    expect(willOpenParamChange(null, "a")).toBe(true);
  });
});
