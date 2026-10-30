"use client";

import { MoreHorizontal } from "lucide-react";
import type { AssetRef, AssetType } from "@/types";
import { useAssetMenu } from "@/components/AssetContextMenu";
import { useAssetClipboard } from "@/hooks/useAssetClipboard";
import { canPaste } from "@/lib/asset-clipboard";
import { anchorPoint } from "@/lib/menu-position";

/** Phone-only `⋯` that opens the asset's context menu. */
export function AssetMenuButton({ asset, label }: { asset: AssetRef; label: string }): React.JSX.Element {
  const { openAssetMenu } = useAssetMenu();
  const title = `More actions for ${label}`;
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const button = event.currentTarget;
        openAssetMenu(anchorPoint(event, button.getBoundingClientRect()), asset, button);
      }}
      className="md:hidden w-8 h-8 -my-1 shrink-0 flex items-center justify-center rounded-md"
      style={{ color: "var(--text-primary)" }}
    >
      <MoreHorizontal className="w-3.5 h-3.5" />
    </button>
  );
}

/** Pastes the copied asset into this list; hidden unless the clipboard holds a fitting asset. */
export function PasteButton({ type }: { type?: AssetType }): React.JSX.Element | null {
  const clip = useAssetClipboard();
  const { projectId, paste } = useAssetMenu();
  if (!clip || !projectId || (type && clip.type !== type)) return null;
  const check = canPaste(clip, projectId);
  return (
    <button
      type="button"
      disabled={!check.ok}
      title={check.ok ? undefined : check.reason}
      onClick={() => void paste(type)}
      className="px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-50"
      style={{ color: "var(--text-primary)", border: "1px solid var(--border)" }}
    >
      Paste
    </button>
  );
}
