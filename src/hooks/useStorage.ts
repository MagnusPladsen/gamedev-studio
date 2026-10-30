"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { storage } from "@/lib/storage";

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
