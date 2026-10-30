"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { storage } from "@/lib/storage";
import { getOpenAsset, setOpenAsset } from "@/lib/open-asset";
import type { AssetRef } from "@/types";

/** Re-renders the component whenever any stored data changes. */
export function useStorageVersion(): number {
  return useSyncExternalStore(
    (cb) => storage.subscribe(cb),
    () => storage.version(),
    () => 0
  );
}

/**
 * Calls `open(id)` once for the `?open=<id>` query parameter, so links from other tools
 * land on the right asset. Pass `ready` = true once the editor's list is loaded.
 */
export function useOpenParam(open: (id: string) => void, ready = true) {
  const params = useSearchParams();
  const id = params.get("open");
  const handled = useRef<string | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!ready || !id || handled.current === id) return;
    handled.current = id;
    openRef.current(id);
  }, [id, ready]);
}

/**
 * Hands the `?<name>=<value>` query parameter to `consume` and removes it from the URL (other
 * parameters stay), so a re-mount, reload or back navigation cannot act on it a second time.
 */
export function useConsumedParam(name: string, consume: (value: string) => void): void {
  const router = useRouter();
  const pathname = usePathname();
  const value = useSearchParams().get(name);
  const handled = useRef<string | null>(null);
  const consumeRef = useRef(consume);
  useEffect(() => {
    consumeRef.current = consume;
  });

  useEffect(() => {
    if (!value || handled.current === value) return;
    handled.current = value;
    consumeRef.current(value);
    const params = new URLSearchParams(window.location.search);
    params.delete(name);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [value, name, pathname, router]);
}

/** Reports the asset an editor has open, so the asset menu can keep it open when it re-mounts the editor. */
export function useTrackOpenAsset(ref: AssetRef | null): void {
  const type = ref?.type;
  const id = ref?.id;
  useEffect(() => {
    if (!type || !id) return;
    const own: AssetRef = { type, id };
    setOpenAsset(own);
    return () => {
      const held = getOpenAsset();
      if (held?.type === own.type && held.id === own.id) setOpenAsset(null);
    };
  }, [type, id]);
}
