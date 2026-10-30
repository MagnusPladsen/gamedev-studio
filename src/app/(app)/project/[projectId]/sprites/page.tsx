"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Plus, Trash2, Download, Package, Check } from "lucide-react";
import { storage } from "@/lib/storage";
import type { Sprite, SpriteSheet } from "@/types";
import { v4 as uuid } from "uuid";

export default function SpriteSheetPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [sheets, setSheets] = useState<SpriteSheet[]>([]);
  const [current, setCurrent] = useState<SpriteSheet | null>(null);
  const [selectedSpriteIds, setSelectedSpriteIds] = useState<Set<string>>(new Set());
  const [padding, setPadding] = useState(1);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    setSprites(storage.getAll("sprites", projectId));
    setSheets(storage.getAll("spritesheets", projectId));
  }, [projectId]);

  const renderSheet = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sheetSprites = sprites.filter((s) => current.spriteIds.includes(s.id));
    if (sheetSprites.length === 0) {
      canvas.width = 128;
      canvas.height = 128;
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = "#555570";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No sprites", 64, 68);
      return;
    }

    const cols = Math.ceil(Math.sqrt(sheetSprites.length));
    const maxW = Math.max(...sheetSprites.map((s) => s.width));
    const maxH = Math.max(...sheetSprites.map((s) => s.height));
    const cellW = maxW + padding * 2;
    const cellH = maxH + padding * 2;
    const rows = Math.ceil(sheetSprites.length / cols);

    canvas.width = cols * cellW;
    canvas.height = rows * cellH;
    ctx.fillStyle = "transparent";
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    sheetSprites.forEach((sprite, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellW + padding;
      const y = row * cellH + padding;

      if (sprite.frames.length > 0 && sprite.frames[0].pixels) {
        try {
          const imgData = atob(sprite.frames[0].pixels);
          const arr = new Uint8ClampedArray(imgData.length);
          for (let j = 0; j < imgData.length; j++) arr[j] = imgData.charCodeAt(j);
          if (arr.length === sprite.width * sprite.height * 4) {
            const imageData = new ImageData(arr, sprite.width, sprite.height);
            ctx.putImageData(imageData, x, y);
          }
        } catch {
          ctx.fillStyle = "var(--accent)";
          ctx.fillRect(x, y, sprite.width, sprite.height);
        }
      }
    });
  }, [current, sprites, padding]);

  useEffect(() => {
    renderSheet();
  }, [renderSheet]);

  function createSheet() {
    if (!newName.trim()) return;
    const sheet: SpriteSheet = {
      id: uuid(),
      projectId,
      name: newName.trim(),
      spriteIds: Array.from(selectedSpriteIds),
      padding,
      powerOfTwo: false,
      createdAt: new Date().toISOString(),
    };
    storage.save("spritesheets", sheet, projectId);
    setSheets(storage.getAll("spritesheets", projectId));
    setCurrent(sheet);
    setShowNew(false);
    setNewName("");
    setSelectedSpriteIds(new Set());
  }

  function toggleSprite(id: string) {
    const next = new Set(selectedSpriteIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSpriteIds(next);
  }

  function updateSheet() {
    if (!current) return;
    const updated = { ...current, spriteIds: Array.from(selectedSpriteIds), padding };
    storage.save("spritesheets", updated, projectId);
    setCurrent(updated);
    setSheets(storage.getAll("spritesheets", projectId));
  }

  function deleteSheet(id: string) {
    storage.delete("spritesheets", id, projectId);
    setSheets(storage.getAll("spritesheets", projectId));
    if (current?.id === id) setCurrent(null);
  }

  function exportPNG() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${current?.name || "spritesheet"}.png`;
    a.click();
  }

  function selectSheet(sheet: SpriteSheet) {
    setCurrent(sheet);
    setSelectedSpriteIds(new Set(sheet.spriteIds));
    setPadding(sheet.padding);
  }

  return (
    <div className="flex h-full" style={{ background: "var(--bg-primary)" }}>
      {/* Left: sheet list + sprite selector */}
      <div
        className="w-60 shrink-0 border-r flex flex-col overflow-y-auto"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Sprite Sheets
            </span>
            <button onClick={() => setShowNew(true)} className="p-1 rounded" style={{ color: "var(--accent)" }}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {showNew && (
            <div className="mb-2 space-y-1.5">
              <input
                placeholder="Sheet name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-2 py-1 rounded text-xs outline-none"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                autoFocus
              />
              <button
                onClick={createSheet}
                className="w-full px-2 py-1 rounded text-xs font-medium"
                style={{ background: "var(--accent)", color: "white" }}
              >
                Create
              </button>
            </div>
          )}
          <div className="space-y-0.5">
            {sheets.map((s) => (
              <div
                key={s.id}
                className="group flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer"
                style={{
                  background: current?.id === s.id ? "var(--bg-hover)" : "transparent",
                  color: "var(--text-primary)",
                }}
                onClick={() => selectSheet(s)}
              >
                <span className="truncate">{s.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSheet(s.id); }}
                  className="opacity-0 group-hover:opacity-100"
                  style={{ color: "var(--red)" }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Sprite selector */}
        <div className="p-3 flex-1 overflow-y-auto">
          <span className="text-xs font-medium block mb-2" style={{ color: "var(--text-secondary)" }}>
            Available Sprites ({sprites.length})
          </span>
          {sprites.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Create sprites in Pixel Art first
            </p>
          ) : (
            <div className="space-y-0.5">
              {sprites.map((s) => (
                <button
                  key={s.id}
                  onClick={() => toggleSprite(s.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left"
                  style={{
                    background: selectedSpriteIds.has(s.id) ? "var(--accent-glow)" : "transparent",
                    color: "var(--text-primary)",
                  }}
                >
                  {selectedSpriteIds.has(s.id) ? (
                    <Check className="w-3 h-3 shrink-0" style={{ color: "var(--accent)" }} />
                  ) : (
                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ border: "1px solid var(--border)" }} />
                  )}
                  <span className="truncate">{s.name}</span>
                  <span className="ml-auto" style={{ color: "var(--text-muted)" }}>
                    {s.width}x{s.height}
                  </span>
                </button>
              ))}
            </div>
          )}
          {current && (
            <button
              onClick={updateSheet}
              className="w-full mt-3 px-2 py-1.5 rounded text-xs font-medium"
              style={{ background: "var(--accent)", color: "white" }}
            >
              Update Sheet
            </button>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          className="h-10 flex items-center gap-3 px-3 border-b shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
        >
          <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            Padding:
            <input
              type="number"
              min={0}
              max={16}
              value={padding}
              onChange={(e) => setPadding(+e.target.value)}
              className="w-12 px-1 py-0.5 rounded text-xs outline-none"
              style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            />
            px
          </label>
          <button
            onClick={exportPNG}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs"
            style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            <Download className="w-3 h-3" />
            Export PNG
          </button>
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center p-6">
          {current ? (
            <canvas
              ref={canvasRef}
              className="border"
              style={{ borderColor: "var(--border)", imageRendering: "pixelated", maxWidth: "100%", background: "repeating-conic-gradient(#1a1a2e 0% 25%, #222238 0% 50%) 0 0 / 16px 16px" }}
            />
          ) : (
            <div className="text-center" style={{ color: "var(--text-muted)" }}>
              <Package className="w-12 h-12 mx-auto mb-3" />
              <p>Select or create a sprite sheet</p>
              <p className="text-xs mt-1">Pick sprites from the left to combine them</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
