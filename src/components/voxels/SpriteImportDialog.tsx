"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import { loadImage, spriteFrameSrc } from "@/lib/pixels";
import type { VoxelGrid } from "@/lib/voxels/grid";
import { spriteToVoxels, type PixelImage } from "@/lib/voxels/sprite";
import type { Sprite } from "@/types";

export interface SpriteVoxels {
  sprite: Sprite;
  grid: VoxelGrid;
  colors: string[];
}

interface Props {
  projectId: string;
  sprites: Sprite[];
  onCreate(result: SpriteVoxels): void;
  onClose(): void;
}

const FAILURE_MESSAGES = {
  "too-large": "That sprite is bigger than 64 pixels. Pick one that is 64×64 or smaller.",
  empty: "That sprite has no visible pixels yet.",
  unreadable: "That sprite's image could not be read.",
};

async function readFirstFrame(sprite: Sprite): Promise<PixelImage | null> {
  const src = spriteFrameSrc(sprite, 0);
  if (!src) return null;
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = sprite.width;
  canvas.height = sprite.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, sprite.width, sprite.height);
}

function SpriteButton({ sprite, isBusy, onPick }: { sprite: Sprite; isBusy: boolean; onPick(): void }): React.JSX.Element {
  const src = spriteFrameSrc(sprite, 0);
  return (
    <button
      onClick={onPick}
      disabled={isBusy}
      className="flex flex-col items-center gap-1 p-2 rounded-lg text-xs hover:bg-[var(--bg-hover)] disabled:opacity-40"
      style={{ color: "var(--text-primary)", border: "1px solid var(--border)" }}
      title={`${sprite.name}, ${sprite.width}×${sprite.height}`}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-12 h-12 object-contain" style={{ imageRendering: "pixelated" }} />
      )}
      <span className="w-full truncate">{sprite.name}</span>
    </button>
  );
}

/** Pick a sprite; its first frame becomes a new one-voxel-deep model standing upright. */
export function SpriteImportDialog({ projectId, sprites, onCreate, onClose }: Props): React.JSX.Element {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function convert(sprite: Sprite): Promise<void> {
    setBusyId(sprite.id);
    setMessage(null);
    try {
      const image = await readFirstFrame(sprite);
      const result = image ? spriteToVoxels(image, []) : null;
      if (result?.ok) onCreate({ sprite, grid: result.grid, colors: result.colors });
      else setMessage(FAILURE_MESSAGES[result ? result.reason : "unreadable"]);
    } catch {
      setMessage(FAILURE_MESSAGES.unreadable);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true" aria-label="Make a model from a sprite">
      <div className="w-full max-w-md rounded-2xl p-5 shadow-2xl max-h-full overflow-y-auto" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Make a model from a sprite</h2>
          <button onClick={onClose} className="p-1 rounded-md" style={{ color: "var(--text-secondary)" }} title="Close" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          The first frame becomes a new model, one voxel deep, standing up. Your sprite stays as it is.
        </p>
        {message && <p className="text-xs mb-3" style={{ color: "var(--red)" }} role="alert">{message}</p>}
        {sprites.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            No sprites yet. Draw one in{" "}
            <Link href={`/project/${projectId}/pixel-art`} className="underline" style={{ color: "var(--accent)" }}>Pixel Art</Link>{" "}
            first.
          </p>
        ) : (
          <div className="grid grid-cols-4 max-md:grid-cols-3 gap-2">
            {sprites.map((sprite) => (
              <SpriteButton key={sprite.id} sprite={sprite} isBusy={busyId !== null} onPick={() => void convert(sprite)} />
            ))}
          </div>
        )}
        {busyId && (
          <p className="flex items-center gap-1.5 text-xs mt-3" style={{ color: "var(--text-muted)" }}>
            <Loader2 className="w-3 h-3 animate-spin" /> Building voxels…
          </p>
        )}
      </div>
    </div>
  );
}
