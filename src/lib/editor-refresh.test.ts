import { describe, expect, it } from "vitest";
import { decideEditorRefresh, editorListFollowsStorage, willOpenParamChange } from "./editor-refresh";

const ref = (id: string) => ({ id });

describe("decideEditorRefresh for editors that hold their list in state", () => {
  it("navigates to a created asset", () => {
    expect(decideEditorRefresh({ kind: "created", ref: ref("new") }, "a", ref("a"), false)).toEqual({ kind: "navigate", open: "new" });
  });

  it("clears the editor when the deleted asset is the tracked one and the URL has no open param", () => {
    expect(decideEditorRefresh({ kind: "deleted", ref: ref("a") }, null, ref("a"), false)).toEqual({ kind: "navigate", open: null });
  });

  it("clears the editor when the deleted asset is the open param and nothing is tracked", () => {
    expect(decideEditorRefresh({ kind: "deleted", ref: ref("a") }, "a", null, false)).toEqual({ kind: "navigate", open: null });
  });

  it("keeps the tracked asset open when another asset changes and the URL differs", () => {
    expect(decideEditorRefresh({ kind: "changed", ref: ref("b") }, null, ref("a"), false)).toEqual({ kind: "navigate", open: "a" });
  });

  it("reloads when the tracked asset already matches the URL", () => {
    expect(decideEditorRefresh({ kind: "changed", ref: ref("b") }, "a", ref("a"), false)).toEqual({ kind: "reload" });
  });

  it("ignores an untracked asset when another asset is deleted", () => {
    expect(decideEditorRefresh({ kind: "deleted", ref: ref("b") }, null, null, false)).toEqual({ kind: "reload" });
  });
});

describe("decideEditorRefresh for editors whose list follows storage", () => {
  it("leaves the editor alone when another asset is renamed", () => {
    expect(decideEditorRefresh({ kind: "changed", ref: ref("b") }, null, ref("a"), true)).toEqual({ kind: "none" });
  });

  it("leaves the editor alone when another asset is deleted", () => {
    expect(decideEditorRefresh({ kind: "deleted", ref: ref("b") }, "a", ref("a"), true)).toEqual({ kind: "none" });
  });

  it("still re-mounts when the open asset itself changes", () => {
    expect(decideEditorRefresh({ kind: "changed", ref: ref("a") }, "a", ref("a"), true)).toEqual({ kind: "reload" });
  });

  it("still clears the editor when the open asset is deleted", () => {
    expect(decideEditorRefresh({ kind: "deleted", ref: ref("a") }, null, ref("a"), true)).toEqual({ kind: "navigate", open: null });
  });

  it("re-mounts when it can't tell which asset is open", () => {
    expect(decideEditorRefresh({ kind: "changed", ref: ref("b") }, null, null, true)).toEqual({ kind: "reload" });
  });

  it("still opens a created asset", () => {
    expect(decideEditorRefresh({ kind: "created", ref: ref("new") }, "a", ref("a"), true)).toEqual({ kind: "navigate", open: "new" });
  });
});

describe("editorListFollowsStorage", () => {
  it("is false for editors that hold their list in state", () => {
    expect(editorListFollowsStorage("diagram")).toBe(false);
    expect(editorListFollowsStorage("dialogue")).toBe(false);
    expect(editorListFollowsStorage("music")).toBe(false);
  });

  it("is true for editors that read their list from storage", () => {
    expect(editorListFollowsStorage("sprite")).toBe(true);
    expect(editorListFollowsStorage("note")).toBe(true);
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
