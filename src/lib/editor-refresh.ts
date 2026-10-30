import type { AssetType } from "@/types";

export type EditorRefreshOutcome = { kind: "created" | "changed" | "deleted"; ref: { id: string } };

export type EditorRefresh = { kind: "none" } | { kind: "reload" } | { kind: "navigate"; open: string | null };

/** Editors that copy their asset list into component state only see outside changes after a re-mount. */
const EDITORS_WITH_STATE_LISTS: ReadonlySet<AssetType> = new Set(["diagram", "dialogue", "music"]);

/** Whether the type's editor re-reads its list from storage on every change, so it can skip a re-mount. */
export function editorListFollowsStorage(type: AssetType): boolean {
  return !EDITORS_WITH_STATE_LISTS.has(type);
}

/**
 * What the editor on screen needs after a menu change: nothing, a plain re-mount, or a new `?open=` first.
 * Skipping the re-mount keeps the open asset's undo history and view.
 */
export function decideEditorRefresh(
  outcome: EditorRefreshOutcome,
  openId: string | null,
  tracked: { id: string } | null,
  listFollowsStorage: boolean,
): EditorRefresh {
  if (outcome.kind === "created") return { kind: "navigate", open: outcome.ref.id };
  const current = tracked?.id ?? openId;
  if (outcome.kind === "deleted" && outcome.ref.id === current) return { kind: "navigate", open: null };
  if (listFollowsStorage && current && outcome.ref.id !== current) return { kind: "none" };
  if (tracked && tracked.id !== openId) return { kind: "navigate", open: tracked.id };
  return { kind: "reload" };
}

/** A navigation only re-mounts through the `?open=` effect when it actually changes `?open=`. */
export function willOpenParamChange(target: string | null, openId: string | null): boolean {
  return target !== openId;
}
