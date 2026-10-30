"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "saved" | "unsaved" | "saving";

/**
 * Saves `value` a moment after it stops changing, and immediately when the editor switches
 * asset (`resetKey` changes), unmounts, or the tab is hidden — so leaving a page never loses work.
 * `save` must only use the value it is given (it can be called for the previous asset).
 */
export function useAutosave<T>(
  value: T,
  save: (v: T) => void | Promise<void>,
  { delay = 800, enabled = true, resetKey }: { delay?: number; enabled?: boolean; resetKey?: unknown } = {}
): { state: SaveState; flush: () => void } {
  const [state, setState] = useState<SaveState>("saved");
  const saveRef = useRef(save);
  saveRef.current = save;
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseline = useRef(value);
  const keyRef = useRef(resetKey);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    setState("saving");
    Promise.resolve(saveRef.current(p.value))
      .then(() => setState(pending.current ? "unsaved" : "saved"))
      .catch(() => setState("unsaved"));
  }, []);

  useEffect(() => {
    if (!Object.is(keyRef.current, resetKey)) {
      // switched asset: save what was pending for the old one, then start clean
      flush();
      keyRef.current = resetKey;
      baseline.current = value;
      setState("saved");
      return;
    }
    if (Object.is(value, baseline.current) || !enabled) return;
    baseline.current = value;
    pending.current = { value };
    setState("unsaved");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
  }, [value, resetKey, enabled, delay, flush]);

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  return { state, flush };
}
