"use client";

import { Check, Loader2 } from "lucide-react";
import type { SaveState } from "@/hooks/useAutosave";

/** Shared "Unsaved / Saving… / Saved" status shown in every editor toolbar. */
export function SaveIndicator({ state, className = "" }: { state: SaveState; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap ${className}`}
      style={{ color: state === "unsaved" ? "var(--yellow)" : "var(--text-muted)" }}
      role="status"
      aria-live="polite"
    >
      {state === "saving" ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" /> Saving…
        </>
      ) : state === "unsaved" ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--yellow)" }} /> Unsaved
        </>
      ) : (
        <>
          <Check className="w-3 h-3" style={{ color: "var(--green)" }} /> Saved
        </>
      )}
    </span>
  );
}
