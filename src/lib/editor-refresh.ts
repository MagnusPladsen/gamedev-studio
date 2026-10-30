export type EditorRefreshOutcome = { kind: "created" | "changed" | "deleted"; ref: { id: string } };

export type EditorRefresh = { kind: "reload" } | { kind: "navigate"; open: string | null };

/** What the editor on screen needs after a menu change: a plain re-mount, or a new `?open=` first. */
export function decideEditorRefresh(
  outcome: EditorRefreshOutcome,
  openId: string | null,
  tracked: { id: string } | null,
): EditorRefresh {
  if (outcome.kind === "created") return { kind: "navigate", open: outcome.ref.id };
  const current = tracked?.id ?? openId;
  if (outcome.kind === "deleted" && outcome.ref.id === current) return { kind: "navigate", open: null };
  if (tracked && tracked.id !== openId) return { kind: "navigate", open: tracked.id };
  return { kind: "reload" };
}

/** A navigation only re-mounts through the `?open=` effect when it actually changes `?open=`. */
export function willOpenParamChange(target: string | null, openId: string | null): boolean {
  return target !== openId;
}
