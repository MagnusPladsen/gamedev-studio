"use client";

import { useSyncExternalStore } from "react";

/** Listening volume for Music and SFX playback (0–1). Exports are not affected. Shared and remembered. */
const KEY = "gds-preview-volume";
const DEFAULT = 0.5;
const listeners = new Set<() => void>();
let volume: number | null = null;

function read(): number {
  if (volume !== null) return volume;
  try {
    const stored = parseFloat(localStorage.getItem(KEY) ?? "");
    volume = Number.isFinite(stored) ? Math.min(1, Math.max(0, stored)) : DEFAULT;
  } catch {
    volume = DEFAULT;
  }
  return volume;
}

export function setPreviewVolume(v: number) {
  volume = Math.min(1, Math.max(0, v));
  try {
    localStorage.setItem(KEY, String(volume));
  } catch {}
  for (const l of listeners) l();
}

/** Slider position → gain. Squared so the low end of the slider is usable. */
export function previewGain(v = read()): number {
  return v * v;
}

export function usePreviewVolume(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => DEFAULT
  );
}
