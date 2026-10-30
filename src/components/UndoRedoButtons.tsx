"use client";

import { Redo2, Undo2 } from "lucide-react";
import type { History } from "@/hooks/useHistory";

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export function UndoRedoButtons({ history }: { history: Pick<History, "undo" | "redo" | "canUndo" | "canRedo"> }) {
  const mod = isMac() ? "⌘" : "Ctrl+";
  const style = { color: "var(--text-secondary)", border: "1px solid var(--border)" };
  return (
    <div className="flex items-center gap-1">
      <button onClick={history.undo} disabled={!history.canUndo} className="p-1.5 rounded-md disabled:opacity-30" style={style} title={`Undo (${mod}Z)`} aria-label="Undo">
        <Undo2 className="w-4 h-4" />
      </button>
      <button onClick={history.redo} disabled={!history.canRedo} className="p-1.5 rounded-md disabled:opacity-30" style={style} title={`Redo (${mod}${isMac() ? "⇧Z" : "Y"})`} aria-label="Redo">
        <Redo2 className="w-4 h-4" />
      </button>
    </div>
  );
}
