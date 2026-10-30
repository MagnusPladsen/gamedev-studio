import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetRef, Board, Issue, Project, Sprite, TilemapData } from "@/types";

const now = "2026-01-01T00:00:00.000Z";
const pip: AssetRef = { type: "sprite", id: "sprite-pip" };
const huge: AssetRef = { type: "sprite", id: "sprite-huge" };
const meadow: AssetRef = { type: "tilemap", id: "meadow" };
const issueRef: AssetRef = { type: "issue", id: "issue-1" };

function mapBackedStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, String(value)),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
}

const sprite: Sprite = {
  id: pip.id,
  projectId: "p1",
  name: "Pip",
  width: 16,
  height: 16,
  frames: [{ id: "f1", pixels: "data:image/png;base64,AAA", layers: [] } as unknown as Sprite["frames"][number]],
  fps: 8,
  tags: [],
  createdAt: now,
  updatedAt: now,
  example: true,
} as Sprite;

function board(projectId: string, keyPrefix: string, nextNumber: number): Board {
  return {
    id: `board-${projectId}`,
    projectId,
    name: "Task Board",
    keyPrefix,
    nextNumber,
    columns: [
      { id: "todo", name: "To do", color: "#000", category: "todo" },
      { id: "done", name: "Done", color: "#000", category: "done" },
    ],
    sprints: [],
    createdAt: now,
    updatedAt: now,
  };
}

async function load() {
  vi.resetModules();
  const storageModule = await import("./storage");
  storageModule.replaceCache(new Map());
  const clipboard = await import("./asset-clipboard");
  const actions = await import("./asset-actions");
  const links = await import("./links");
  const { storage } = storageModule;
  for (const [id, name] of [["p1", "Pip's Quest"], ["p2", "Other"]]) {
    const project: Project = { id, name, description: "", createdAt: now, updatedAt: now };
    storage.save("projects", project);
  }
  storage.save("sprites", sprite, "p1");
  const huge1 = structuredClone(sprite);
  huge1.id = huge.id;
  huge1.name = "Huge";
  huge1.frames[0].pixels = "a".repeat(2 * 1024 * 1024 + 1);
  storage.save("sprites", huge1, "p1");
  const map: TilemapData = {
    id: meadow.id, projectId: "p1", name: "Meadow", width: 1, height: 1, tileSize: 16,
    layers: [{ id: "l1", name: "Ground", visible: true, tiles: [[pip.id]] }],
    tilesetSpriteIds: [], tags: [], createdAt: now, updatedAt: now,
  };
  storage.save("tilemaps", map, "p1");
  storage.save("boards", board("p1", "PIP", 2), "p1");
  storage.save("boards", board("p2", "OTH", 5), "p2");
  const issue: Issue = {
    id: issueRef.id, projectId: "p1", key: "PIP-1", title: "Fix jump", description: "", type: "task",
    priority: "medium", status: "done", sprintId: "s1", labels: [], order: 1000, tags: [], createdAt: now, updatedAt: now,
  };
  storage.save("issues", issue, "p1");
  return { ...clipboard, ...actions, ...links, storage };
}

beforeEach(() => {
  vi.stubGlobal("sessionStorage", mapBackedStorage());
});

describe("asset clipboard", () => {
  it("should keep a snapshot that survives deleting the source", async () => {
    const c = await load();
    const clip = c.copyAsset("p1", pip)!;
    expect(c.readClipboard()).toMatchObject({ name: "Pip", sourceProjectName: "Pip's Quest", type: "sprite" });
    c.deleteAsset("p1", pip);
    const a = c.pasteAsset(clip, "p1")!;
    const b = c.pasteAsset(clip, "p1")!;
    expect(a.id).not.toBe(b.id);
    expect([a, b].map((r) => c.storage.getById("sprites", r.id, "p1")!.name)).toEqual(["Pip", "Pip copy"]);
  });

  it("should paste into another project without example flag or links", async () => {
    const c = await load();
    const other = c.pasteAsset(c.copyAsset("p1", pip)!, "p2")!;
    const stored = c.storage.getById("sprites", other.id, "p2")!;
    expect(stored).toMatchObject({ name: "Pip", projectId: "p2" });
    expect("example" in stored).toBe(false);
    expect(c.getRelated("p2", "sprite", other.id)).toEqual([]);
  });

  it("should refuse id-referencing types in another project", async () => {
    const c = await load();
    const tm = c.copyAsset("p1", meadow)!;
    expect(c.canPaste(tm, "p2")).toEqual({ ok: false, reason: "Only in Pip's Quest: it uses that project's assets" });
    expect(c.canPaste(tm, "p1")).toEqual({ ok: true });
    expect(c.pasteAsset(tm, "p2")).toBeNull();
    expect(c.storage.getAll("tilemaps", "p2")).toEqual([]);
  });

  it("should paste an issue with the target board key in the first column", async () => {
    const c = await load();
    const ref = c.pasteAsset(c.copyAsset("p1", issueRef)!, "p2")!;
    expect(c.storage.getById("issues", ref.id, "p2")).toMatchObject({ key: "OTH-5", status: "todo", sprintId: null });
  });

  it("should mirror to sessionStorage and restore after reload", async () => {
    const c = await load();
    c.copyAsset("p1", pip);
    expect(sessionStorage.getItem(c.CLIPBOARD_KEY)).not.toBeNull();
    vi.resetModules();
    expect((await import("./asset-clipboard")).readClipboard()?.name).toBe("Pip");
  });

  it("should skip the mirror above 2 MB but keep memory", async () => {
    const c = await load();
    c.copyAsset("p1", pip);
    c.copyAsset("p1", huge);
    expect(sessionStorage.getItem(c.CLIPBOARD_KEY)).toBeNull();
    expect(c.readClipboard()?.name).toBe("Huge");
  });

  it("should treat corrupt session data as empty", async () => {
    await load();
    sessionStorage.setItem("gds-asset-clipboard", "{not json");
    vi.resetModules();
    expect((await import("./asset-clipboard")).readClipboard()).toBeNull();
  });

  it("should notify subscribers on copy", async () => {
    const c = await load();
    const listener = vi.fn();
    c.subscribeClipboard(listener);
    c.copyAsset("p1", pip);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
