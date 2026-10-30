"use client";

import { useRef } from "react";
import { Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import { setPreviewVolume, usePreviewVolume } from "@/hooks/usePreviewVolume";

export function VolumeControl() {
  const volume = usePreviewVolume();
  const beforeMute = useRef(0.5);
  const Icon = volume === 0 ? VolumeX : volume < 0.34 ? Volume : volume < 0.67 ? Volume1 : Volume2;

  return (
    <div className="flex items-center gap-1.5" title="Listening volume. Exported files are not affected.">
      <button
        onClick={() => {
          if (volume > 0) {
            beforeMute.current = volume;
            setPreviewVolume(0);
          } else {
            setPreviewVolume(beforeMute.current || 0.5);
          }
        }}
        className="p-1 rounded"
        style={{ color: volume === 0 ? "var(--red)" : "var(--text-secondary)" }}
        aria-label={volume === 0 ? "Unmute" : "Mute"}
      >
        <Icon className="w-4 h-4" />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(e) => setPreviewVolume(Number(e.target.value) / 100)}
        className="w-20 accent-[var(--accent)]"
        aria-label="Listening volume"
      />
      <span className="text-[10px] w-7 tabular-nums" style={{ color: "var(--text-muted)" }}>
        {Math.round(volume * 100)}%
      </span>
    </div>
  );
}
