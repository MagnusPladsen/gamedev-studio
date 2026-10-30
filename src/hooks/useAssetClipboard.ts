"use client";

import { useSyncExternalStore } from "react";
import { readClipboard, subscribeClipboard, type AssetClipboard } from "@/lib/asset-clipboard";

export function useAssetClipboard(): AssetClipboard | null {
  return useSyncExternalStore(subscribeClipboard, readClipboard, () => null);
}
