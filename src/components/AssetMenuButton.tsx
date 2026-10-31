"use client";

import { MoreHorizontal, Pin } from "lucide-react";
import type { AssetRef, AssetType } from "@/types";
import { useAssetMenu } from "@/components/AssetContextMenu";
import { useAssetClipboard } from "@/hooks/useAssetClipboard";
import { canPaste } from "@/lib/asset-clipboard";
import { anchorPoint } from "@/lib/menu-position";
import { isAssetPinned, toggleAssetPin } from "@/lib/pins";
import { useStorageVersion } from "@/hooks/useStorage";

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

/**
 * Desktop-only sidebar pin at the right of a row: fades in while the row (the nearest `group`) is hovered or
 * focused, and stays visible, filled, while the asset is pinned, unless `shouldHideUntilHover` (rows that are
 * all pinned anyway). Clicking pins or unpins it.
 */
export function AssetPinButton({
  asset,
  label,
  className = "",
  shouldHideUntilHover = false,
}: {
  asset: AssetRef;
  label: string;
  className?: string;
  shouldHideUntilHover?: boolean;
}): React.JSX.Element {
  useStorageVersion();
  const { projectId } = useAssetMenu();
  const isPinned = !!projectId && isAssetPinned(projectId, asset);
  const isFaded = shouldHideUntilHover || !isPinned;
  const title = isPinned ? `Unpin ${label} from the sidebar` : `Pin ${label} to the sidebar`;
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={isPinned}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (projectId) toggleAssetPin(projectId, asset);
      }}
      className={`max-md:hidden p-0.5 rounded shrink-0 ${isFaded ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100" : ""} ${className}`}
      style={{ color: isPinned ? "var(--accent)" : "var(--text-primary)" }}
    >
      <Pin className="w-3 h-3" fill={isPinned ? "currentColor" : "none"} />
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
