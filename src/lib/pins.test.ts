import { beforeEach, describe, expect, it } from "vitest";
import type { AssetRef, Project, Sprite } from "@/types";
import { replaceCache, storage } from "./storage";
import {
  getPins,
  isAssetPinned,
  isToolPinned,
  orderTools,
  removeAssetPin,
  resolvePinnedAssets,
  toggleAssetPin,
  toggleToolPin,
} from "./pins";

const now = "2026-01-01T00:00:00.000Z";
const pip: AssetRef = { type: "sprite", id: "sprite-pip" };

beforeEach(() => {
  replaceCache(new Map());
  const project: Project = { id: "p1", name: "Pip's Quest", description: "", createdAt: now, updatedAt: now };
  storage.save("projects", project);
  const sprite: Sprite = {
    id: pip.id,
    projectId: "p1",
    name: "Pip",
    width: 16,
    height: 16,
    frames: [],
    fps: 8,
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
  storage.save("sprites", sprite, "p1");
});

describe("tool pins", () => {
  it("defaults to nothing pinned", () => {
    expect(getPins("p1")).toEqual({ tools: [], assets: [] });
  });

  it("appends on pin and removes on second toggle", () => {
    toggleToolPin("p1", "music");
    toggleToolPin("p1", "board");
    expect(getPins("p1").tools).toEqual(["music", "board"]);
    toggleToolPin("p1", "music");
    expect(isToolPinned("p1", "music")).toBe(false);
  });

  it("stamps the project with a newer updatedAt", () => {
    toggleToolPin("p1", "music");
    expect(storage.getById("projects", "p1")!.updatedAt).not.toBe(now);
  });

  it("orders tools: assets first, pinned in pin order, rest unchanged", () => {
    const tools = ["assets", "board", "pixel-art", "music"].map((path) => ({ path }));
    expect(orderTools(tools, ["music", "gone", "assets", "board"]).map((t) => t.path)).toEqual([
      "assets",
      "music",
      "board",
      "pixel-art",
    ]);
  });
});

describe("asset pins", () => {
  it("pins, resolves in pin order and skips missing assets", () => {
    toggleAssetPin("p1", pip);
    expect(isAssetPinned("p1", pip)).toBe(true);
    toggleAssetPin("p1", { type: "note", id: "missing" });
    expect(resolvePinnedAssets("p1").map((a) => a.name)).toEqual(["Pip"]);
  });

  it("unpins on second toggle", () => {
    toggleAssetPin("p1", pip);
    toggleAssetPin("p1", pip);
    expect(isAssetPinned("p1", pip)).toBe(false);
  });

  it("does not write when removing a pin that does not exist", () => {
    const version = storage.version();
    removeAssetPin("p1", { type: "sound", id: "never-pinned" });
    expect(storage.version()).toBe(version);
  });
});
