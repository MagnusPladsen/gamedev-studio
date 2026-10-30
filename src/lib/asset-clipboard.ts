import type { AssetRef, AssetType } from "@/types";
import { ASSET_KINDS } from "./assets";
import { cloneAsset, getAssetName, getStoredAsset, type StoredAsset } from "./asset-actions";
import { storage } from "./storage";

export const CLIPBOARD_KEY = "gds-asset-clipboard";
export const CLIPBOARD_SESSION_LIMIT = 2 * 1024 * 1024;
export const SAME_PROJECT_ONLY: AssetType[] = ["tilemap", "spritesheet", "diagram"];

export interface AssetClipboard {
  type: AssetType;
  name: string;
  item: StoredAsset;
  sourceProjectId: string;
  sourceProjectName: string;
  copiedAt: string;
}

export type PasteCheck = { ok: true } | { ok: false; reason: string };

let memory: AssetClipboard | null = null;
const listeners = new Set<() => void>();

function writeSessionMirror(clip: AssetClipboard): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const json = JSON.stringify(clip);
    if (new TextEncoder().encode(json).length < CLIPBOARD_SESSION_LIMIT) sessionStorage.setItem(CLIPBOARD_KEY, json);
    else sessionStorage.removeItem(CLIPBOARD_KEY);
  } catch {
    // storage full or unavailable: the in-memory copy still works
  }
}

function readSessionMirror(): AssetClipboard | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CLIPBOARD_KEY);
    return raw ? (JSON.parse(raw) as AssetClipboard) : null;
  } catch {
    return null;
  }
}

export function copyAsset(projectId: string, ref: AssetRef): AssetClipboard | null {
  const item = getStoredAsset(projectId, ref);
  if (!item) return null;
  memory = {
    type: ref.type,
    name: getAssetName(ref.type, item),
    item: structuredClone(item),
    sourceProjectId: projectId,
    sourceProjectName: storage.getById("projects", projectId)?.name ?? "another project",
    copiedAt: new Date().toISOString(),
  };
  writeSessionMirror(memory);
  for (const listener of [...listeners]) listener();
  return memory;
}

export function readClipboard(): AssetClipboard | null {
  memory ??= readSessionMirror();
  return memory;
}

export function subscribeClipboard(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function canPaste(clip: AssetClipboard, targetProjectId: string): PasteCheck {
  if (SAME_PROJECT_ONLY.includes(clip.type) && clip.sourceProjectId !== targetProjectId) {
    return { ok: false, reason: `Only in ${clip.sourceProjectName}: it uses that project's assets` };
  }
  return { ok: true };
}

export function pasteAsset(clip: AssetClipboard, targetProjectId: string): AssetRef | null {
  if (!canPaste(clip, targetProjectId).ok) return null;
  const copy = cloneAsset(clip.type, clip.item, targetProjectId, "backlog");
  storage.save(ASSET_KINDS[clip.type].collection, copy as never, targetProjectId);
  return { type: clip.type, id: copy.id };
}
