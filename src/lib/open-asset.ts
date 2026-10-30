import type { AssetRef } from "@/types";

let openAsset: AssetRef | null = null;

/** The asset the editor on screen has open, so the menu can keep it open across a re-mount. */
export function setOpenAsset(ref: AssetRef | null): void {
  openAsset = ref;
}

export function getOpenAsset(): AssetRef | null {
  return openAsset;
}
