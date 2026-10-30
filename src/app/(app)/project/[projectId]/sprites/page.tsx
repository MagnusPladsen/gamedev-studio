"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Download, Package, Check, FileJson } from "lucide-react";
import { storage } from "@/lib/storage";
import { loadImage, spriteFrameSrc } from "@/lib/pixels";
import { useOpenParam, useStorageVersion } from "@/hooks/useStorage";
import { LinkedAssets } from "@/components/LinkedAssets";
import { UndoRedoButtons } from "@/components/UndoRedoButtons";
import { useHistory } from "@/hooks/useHistory";
import type { Sprite, SpriteSheet } from "@/types";
import { v4 as uuid } from "uuid";

interface AtlasFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Layout {
  width: number;
  height: number;
  frames: { key: string; src: string; rect: AtlasFrame }[];
}

function safeName(name: string): string {
  return name.trim().replace(/[^\w-]+/g, "_") || "sprite";
}

/** One row per sprite, its frames left to right. */
function computeLayout(sprites: Sprite[], padding: number): Layout {
  const frames: Layout["frames"] = [];
  const usedKeys = new Set<string>();
  let y = padding;
  let width = 0;
  for (const sprite of sprites) {
    let base = safeName(sprite.name);
    if (usedKeys.has(base)) base = `${base}_${sprite.id.slice(0, 4)}`;
    usedKeys.add(base);
    let x = padding;
    sprite.frames.forEach((frame, i) => {
      if (!frame.pixels) return;
      frames.push({ key: `${base}_${i}`, src: frame.pixels, rect: { x, y, w: sprite.width, h: sprite.height } });
      x += sprite.width + padding;
    });
    width = Math.max(width, x);
    y += sprite.height + padding;
  }
  return { width: Math.max(width, 1), height: Math.max(y, 1), frames };
}

const inputStyle = { background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" };

export default function SpriteSheetPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const version = useStorageVersion();

  const [current, setCurrent] = useState<SpriteSheet | null>(null);
  const [selectedSpriteIds, setSelectedSpriteIds] = useState<string[]>([]);
  const [padding, setPadding] = useState(1);
  const selection = useMemo(() => ({ spriteIds: selectedSpriteIds, padding }), [selectedSpriteIds, padding]);
  const history = useHistory(
    selection,
    (v) => {
      setSelectedSpriteIds(v.spriteIds);
      setPadding(v.padding);
    },
    current?.id
  );
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [rendering, setRendering] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const sprites = useMemo(
    () => storage.getAll("sprites", projectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, version]
  );
  const sheets = useMemo(
    () => storage.getAll("spritesheets", projectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, version]
  );

  const sheetSprites = useMemo(
    () => selectedSpriteIds.map((id) => sprites.find((s) => s.id === id)).filter((s): s is Sprite => !!s),
    [selectedSpriteIds, sprites]
  );
  const layout = useMemo(() => computeLayout(sheetSprites, padding), [sheetSprites, padding]);

  useOpenParam((id) => {
    const sheet = storage.getById("spritesheets", id, projectId);
    if (sheet) selectSheet(sheet);
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !current) return;
    let cancelled = false;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    (async () => {
      setRendering(true);
      const images = await Promise.all(layout.frames.map((f) => loadImage(f.src).catch(() => null)));
      if (cancelled) return;
      canvas.width = layout.width;
      canvas.height = layout.height;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      layout.frames.forEach((f, i) => {
        const img = images[i];
        if (img) ctx.drawImage(img, f.rect.x, f.rect.y, f.rect.w, f.rect.h);
      });
      setRendering(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [current, layout]);

  function selectSheet(sheet: SpriteSheet) {
    setCurrent(sheet);
    setSelectedSpriteIds(sheet.spriteIds);
    setPadding(sheet.padding);
  }

  function createSheet() {
    if (!newName.trim()) return;
    const sheet: SpriteSheet = {
      id: uuid(),
      projectId,
      name: newName.trim(),
      spriteIds: selectedSpriteIds,
      padding,
      powerOfTwo: false,
      createdAt: new Date().toISOString(),
    };
    storage.save("spritesheets", sheet, projectId);
    selectSheet(sheet);
    setShowNew(false);
    setNewName("");
  }

  function toggleSprite(id: string) {
    setSelectedSpriteIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  }

  function updateSheet() {
    if (!current) return;
    const updated = { ...current, spriteIds: selectedSpriteIds, padding };
    storage.save("spritesheets", updated, projectId);
    setCurrent(updated);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  function deleteSheet(id: string) {
    if (!confirm("Delete this sprite sheet?")) return;
    storage.delete("spritesheets", id, projectId);
    if (current?.id === id) setCurrent(null);
  }

  function download(href: string, filename: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
  }

  function exportPNG() {
    const canvas = canvasRef.current;
    if (!canvas || rendering) return;
    download(canvas.toDataURL("image/png"), `${safeName(current?.name || "spritesheet")}.png`);
  }

  function exportAtlas() {
    const name = safeName(current?.name || "spritesheet");
    const atlas = {
      frames: Object.fromEntries(layout.frames.map((f) => [f.key, f.rect])),
      meta: { image: `${name}.png`, size: { w: layout.width, h: layout.height } },
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(atlas, null, 2)], { type: "application/json" }));
    download(url, `${name}.json`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const dirty = !!current && (current.padding !== padding || current.spriteIds.join() !== selectedSpriteIds.join());

  return (
    <div className="flex h-full" style={{ background: "var(--bg-primary)" }}>
      {/* Left: sheet list + sprite selector */}
      <div className="w-60 shrink-0 border-r flex flex-col overflow-y-auto" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Sprite Sheets</span>
            <button onClick={() => setShowNew(true)} className="p-1 rounded" style={{ color: "var(--accent)" }} title="New sprite sheet">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {showNew && (
            <div className="mb-2 space-y-1.5">
              <input
                placeholder="Sheet name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createSheet()}
                className="w-full px-2 py-1 rounded text-xs outline-none"
                style={inputStyle}
                autoFocus
              />
              <div className="flex gap-1">
                <button onClick={createSheet} className="flex-1 px-2 py-1 rounded text-xs font-medium" style={{ background: "var(--accent)", color: "white" }}>Create</button>
                <button onClick={() => setShowNew(false)} className="px-2 py-1 rounded text-xs" style={{ color: "var(--text-secondary)" }}>Cancel</button>
              </div>
            </div>
          )}
          <div className="space-y-0.5">
            {sheets.map((s) => (
              <div
                key={s.id}
                className="group flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer"
                style={{ background: current?.id === s.id ? "var(--bg-hover)" : "transparent", color: "var(--text-primary)" }}
                onClick={() => selectSheet(s)}
              >
                <span className="truncate">{s.name}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteSheet(s.id); }} className="opacity-0 group-hover:opacity-100" style={{ color: "var(--red)" }} title="Delete">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 flex-1 overflow-y-auto">
          <span className="text-xs font-medium block mb-2" style={{ color: "var(--text-secondary)" }}>
            Sprites ({sprites.length})
          </span>
          {sprites.length === 0 ? (
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              No sprites yet. Draw some in{" "}
              <Link href={`/project/${projectId}/pixel-art`} className="underline" style={{ color: "var(--accent)" }}>Pixel Art</Link>.
            </p>
          ) : (
            <div className="space-y-0.5">
              {sprites.map((s) => {
                const selected = selectedSpriteIds.includes(s.id);
                const src = spriteFrameSrc(s, 0);
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSprite(s.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left"
                    style={{ background: selected ? "var(--accent-glow)" : "transparent", color: "var(--text-primary)" }}
                  >
                    {selected ? (
                      <Check className="w-3 h-3 shrink-0" style={{ color: "var(--accent)" }} />
                    ) : (
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ border: "1px solid var(--border)" }} />
                    )}
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="w-5 h-5 shrink-0 object-contain" style={{ imageRendering: "pixelated" }} />
                    ) : (
                      <span className="w-5 h-5 shrink-0" />
                    )}
                    <span className="truncate">{s.name}</span>
                    <span className="ml-auto shrink-0" style={{ color: "var(--text-muted)" }}>
                      {s.width}×{s.height}
                      {s.frames.length > 1 ? ` ·${s.frames.length}f` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {current && (
            <button
              onClick={updateSheet}
              disabled={!dirty && !savedFlash}
              className="w-full mt-3 px-2 py-1.5 rounded text-xs font-medium"
              style={{ background: dirty ? "var(--accent)" : "var(--bg-card)", color: dirty ? "white" : "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              {savedFlash ? "Saved" : dirty ? "Save changes" : "Up to date"}
            </button>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-10 flex items-center gap-3 px-3 border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <UndoRedoButtons history={history} />
          <div className="w-px h-5" style={{ background: "var(--border)" }} />
          <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            Padding
            <input
              type="number"
              min={0}
              max={16}
              value={padding}
              onChange={(e) => setPadding(Math.max(0, Math.min(16, +e.target.value || 0)))}
              className="w-12 px-1 py-0.5 rounded text-xs outline-none"
              style={inputStyle}
            />
            px
          </label>
          <button onClick={exportPNG} disabled={!current || rendering} className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            <Download className="w-3 h-3" />
            PNG
          </button>
          <button onClick={exportAtlas} disabled={!current} className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            <FileJson className="w-3 h-3" />
            Atlas JSON
          </button>
          {current && (
            <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
              {layout.frames.length} frames · {layout.width}×{layout.height}px
            </span>
          )}
        </div>

        <div className="flex-1 overflow-auto flex">
          <div className="flex-1 overflow-auto flex items-center justify-center p-6">
            {current ? (
              layout.frames.length === 0 ? (
                <div className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
                  Pick sprites on the left to add them to this sheet.
                </div>
              ) : (
                <canvas
                  ref={canvasRef}
                  className="border"
                  style={{
                    borderColor: "var(--border)",
                    imageRendering: "pixelated",
                    width: Math.min(layout.width * 4, 1024),
                    maxWidth: "100%",
                    background: "repeating-conic-gradient(#1a1a2e 0% 25%, #222238 0% 50%) 0 0 / 16px 16px",
                  }}
                />
              )
            ) : (
              <div className="text-center" style={{ color: "var(--text-muted)" }}>
                <Package className="w-12 h-12 mx-auto mb-3" />
                <p>Select or create a sprite sheet</p>
                <p className="text-xs mt-1">Each sprite gets its own row, with its animation frames left to right</p>
              </div>
            )}
          </div>
          {current && (
            <div className="w-56 shrink-0 border-l p-3 overflow-y-auto" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
              <LinkedAssets projectId={projectId} type="spritesheet" id={current.id} layout="panel" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
