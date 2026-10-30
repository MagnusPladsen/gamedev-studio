"use client";

import Link from "next/link";
import { AssetMenuButton } from "@/components/AssetMenuButton";
import { useAssetMenu } from "@/components/AssetContextMenu";
import { ASSET_ICONS } from "@/components/asset-icons";
import { ASSET_KINDS, assetHref } from "@/lib/assets";
import { resolvePinnedAssets } from "@/lib/pins";
import { useStorageVersion } from "@/hooks/useStorage";

/** Pinned assets above the tool list; renders nothing without pins. */
export function SidebarPins({ projectId, onNavigate }: { projectId: string; onNavigate(): void }): React.JSX.Element | null {
  useStorageVersion();
  const { assetTriggerProps } = useAssetMenu();
  const pinned = resolvePinnedAssets(projectId);
  if (pinned.length === 0) return null;
  return (
    <div className="px-2 mb-1">
      <div className="px-3 pt-1 pb-0.5 text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        Pinned
      </div>
      <div className="space-y-0.5">
        {pinned.map((asset) => {
          const Icon = ASSET_ICONS[asset.type];
          return (
            <div key={`${asset.type}:${asset.id}`} className="relative">
              <Link
                href={assetHref(projectId, asset.type, asset.id)}
                onClick={onNavigate}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
                style={{ color: "var(--text-secondary)" }}
                {...assetTriggerProps(asset)}
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: ASSET_KINDS[asset.type].color }} />
                <span className="truncate">{asset.name}</span>
              </Link>
              <div className="absolute right-1 top-1/2 -translate-y-1/2 md:hidden">
                <AssetMenuButton asset={asset} label={asset.name} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
