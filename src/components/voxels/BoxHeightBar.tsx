"use client";

import { Minus, Plus } from "lucide-react";

interface Props {
  height: number;
  maxHeight: number;
  isErase: boolean;
  onHeightChange(height: number): void;
  onConfirm(): void;
  onCancel(): void;
}

const secondaryStyle: React.CSSProperties = { color: "var(--text-primary)", border: "1px solid var(--border)" };

/** Second step of the box tool: choose how many layers deep the box goes, then place it. */
export function BoxHeightBar({ height, maxHeight, isErase, onHeightChange, onConfirm, onCancel }: Props): React.JSX.Element {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 bottom-3 z-10 flex items-center gap-2 px-3 py-2 rounded-lg shadow-xl max-w-[calc(100%-24px)] flex-wrap justify-center"
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
    >
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Height</span>
      <button onClick={() => onHeightChange(height - 1)} disabled={height <= 1} className="p-1 rounded-md disabled:opacity-40" style={secondaryStyle} title="One layer less (↓)" aria-label="One layer less">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <input
        type="range"
        min={1}
        max={maxHeight}
        value={height}
        onChange={(event) => onHeightChange(Number(event.target.value))}
        className="w-28 accent-[var(--accent)]"
        aria-label="Box height"
      />
      <button onClick={() => onHeightChange(height + 1)} disabled={height >= maxHeight} className="p-1 rounded-md disabled:opacity-40" style={secondaryStyle} title="One layer more (↑)" aria-label="One layer more">
        <Plus className="w-3.5 h-3.5" />
      </button>
      <span className="text-xs w-6 text-center tabular-nums" style={{ color: "var(--text-primary)" }}>{height}</span>
      <button onClick={onConfirm} className="px-3 py-1 rounded-md text-xs font-medium" style={{ background: "var(--accent)", color: "var(--on-accent, #fff)" }} title="Or click the model, or press Enter">
        {isErase ? "Erase box" : "Place box"}
      </button>
      <button onClick={onCancel} className="px-2 py-1 rounded-md text-xs" style={secondaryStyle} title="Or press Escape">
        Cancel
      </button>
    </div>
  );
}
