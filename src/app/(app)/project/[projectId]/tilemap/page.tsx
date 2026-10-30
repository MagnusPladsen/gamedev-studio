"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Trash2,
  Save,
  Download,
  Eye,
  EyeOff,
  Paintbrush,
  Eraser,
  PaintBucket,
  Grid3X3,
  Layers,
  ChevronUp,
  ChevronDown,
  Check,
} from "lucide-react";
import { storage } from "@/lib/storage";
import { getLoadedImage, preloadImages, spriteFrameSrc } from "@/lib/pixels";
import { useOpenParam, useStorageVersion } from "@/hooks/useStorage";
import { LinkedAssets } from "@/components/LinkedAssets";
import type { TilemapData, TilemapLayer, Sprite } from "@/types";
import { v4 as uuid } from "uuid";

type Tile = number | string | null;
type Tool = "paint" | "erase" | "fill";

const TILE_SIZES = [8, 16, 32];

const BASIC_TILES = [
  "#4a7c59", "#6b8f3c", "#8b6914", "#a0522d",
  "#708090", "#4682b4", "#2e8b57", "#daa520",
  "#cd853f", "#8fbc8f", "#556b2f", "#b8860b",
  "#d2691e", "#bc8f8f", "#f4a460", "#c0c0c0",
];

function createEmptyLayer(name: string, w: number, h: number): TilemapLayer {
  return { id: uuid(), name, visible: true, tiles: Array.from({ length: h }, () => new Array<Tile>(w).fill(null)) };
}

function referencedSprites(tm: TilemapData): string[] {
  const ids = new Set<string>();
  for (const layer of tm.layers) for (const row of layer.tiles) for (const t of row) if (typeof t === "string") ids.add(t);
  return [...ids];
}

function drawTilemap(
  ctx: CanvasRenderingContext2D,
  tm: TilemapData,
  spriteById: Map<string, Sprite>,
  opts: { grid: boolean; background: boolean; onImageReady?: () => void }
) {
  const ts = tm.tileSize;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, tm.width * ts, tm.height * ts);
  if (opts.background) {
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, tm.width * ts, tm.height * ts);
  }

  for (const layer of tm.layers) {
    if (!layer.visible) continue;
    for (let r = 0; r < tm.height; r++) {
      for (let c = 0; c < tm.width; c++) {
        const tile = layer.tiles[r]?.[c];
        if (tile === null || tile === undefined) continue;
        if (typeof tile === "number") {
          ctx.fillStyle = BASIC_TILES[tile % BASIC_TILES.length];
          ctx.fillRect(c * ts, r * ts, ts, ts);
          continue;
        }
        const sprite = spriteById.get(tile);
        const src = sprite && spriteFrameSrc(sprite, 0);
        if (!src) {
          ctx.strokeStyle = "rgba(248,113,113,0.5)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(c * ts + 2, r * ts + 2);
          ctx.lineTo(c * ts + ts - 2, r * ts + ts - 2);
          ctx.moveTo(c * ts + ts - 2, r * ts + 2);
          ctx.lineTo(c * ts + 2, r * ts + ts - 2);
          ctx.stroke();
          continue;
        }
        const img = getLoadedImage(src, opts.onImageReady);
        if (img) ctx.drawImage(img, c * ts, r * ts, ts, ts);
      }
    }
  }

  if (opts.grid) {
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= tm.height; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * ts);
      ctx.lineTo(tm.width * ts, r * ts);
      ctx.stroke();
    }
    for (let c = 0; c <= tm.width; c++) {
      ctx.beginPath();
      ctx.moveTo(c * ts, 0);
      ctx.lineTo(c * ts, tm.height * ts);
      ctx.stroke();
    }
  }
}

const inputStyle = { background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" };

export default function TilemapPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const version = useStorageVersion();

  const [current, setCurrent] = useState<TilemapData | null>(null);
  const [selectedTile, setSelectedTile] = useState<number | string>(0);
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [tool, setTool] = useState<Tool>("paint");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWidth, setNewWidth] = useState(20);
  const [newHeight, setNewHeight] = useState(15);
  const [newTileSize, setNewTileSize] = useState(16);
  const [isPainting, setIsPainting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [redrawTick, setRedrawTick] = useState(0);
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sprites = useMemo(
    () => storage.getAll("sprites", projectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, version]
  );
  const spriteById = useMemo(() => new Map(sprites.map((s) => [s.id, s])), [sprites]);

  const tilemaps = useMemo(
    () => storage.getAll("tilemaps", projectId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, version]
  );

  useOpenParam((id) => {
    const tm = storage.getById("tilemaps", id, projectId);
    if (tm) selectTilemap(tm);
  });

  const requestRedraw = useCallback(() => setRedrawTick((t) => t + 1), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = current.width * current.tileSize;
    canvas.height = current.height * current.tileSize;
    drawTilemap(ctx, current, spriteById, { grid: true, background: true, onImageReady: requestRedraw });
  }, [current, spriteById, redrawTick, requestRedraw]);

  const persist = useCallback(
    (tm: TilemapData, flash: boolean) => {
      const toSave = { ...tm, tilesetSpriteIds: referencedSprites(tm), updatedAt: new Date().toISOString() };
      storage.save("tilemaps", toSave, projectId);
      setDirty(false);
      if (flash) {
        setSavedFlash(true);
        if (flashRef.current) clearTimeout(flashRef.current);
        flashRef.current = setTimeout(() => setSavedFlash(false), 1500);
      }
    },
    [projectId]
  );

  useEffect(() => {
    if (!dirty || !current || isPainting) return;
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => persist(current, false), 800);
    return () => {
      if (autosaveRef.current) clearTimeout(autosaveRef.current);
    };
  }, [dirty, current, isPainting, persist]);

  function selectTilemap(tm: TilemapData) {
    if (dirty && current) persist(current, false);
    setCurrent(tm);
    setSelectedLayer(0);
    setDirty(false);
  }

  function update(tm: TilemapData) {
    setCurrent(tm);
    setDirty(true);
  }

  function createTilemap() {
    if (!newName.trim()) return;
    const w = Math.max(1, Math.min(256, newWidth || 1));
    const h = Math.max(1, Math.min(256, newHeight || 1));
    const now = new Date().toISOString();
    const tm: TilemapData = {
      id: uuid(),
      projectId,
      name: newName.trim(),
      width: w,
      height: h,
      tileSize: newTileSize,
      layers: [createEmptyLayer("Ground", w, h)],
      tilesetSpriteIds: [],
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    storage.save("tilemaps", tm, projectId);
    selectTilemap(tm);
    setShowNew(false);
    setNewName("");
  }

  function cellFromEvent(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas || !current) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) * (canvas.width / rect.width)) / current.tileSize);
    const y = Math.floor(((e.clientY - rect.top) * (canvas.height / rect.height)) / current.tileSize);
    if (x < 0 || x >= current.width || y < 0 || y >= current.height) return null;
    return { x, y };
  }

  function setLayerTiles(tiles: Tile[][]) {
    if (!current) return;
    update({ ...current, layers: current.layers.map((l, i) => (i === selectedLayer ? { ...l, tiles } : l)) });
  }

  function paintAt(e: React.MouseEvent<HTMLCanvasElement>) {
    const cell = cellFromEvent(e);
    const layer = current?.layers[selectedLayer];
    if (!cell || !layer) return;
    const value: Tile = tool === "erase" ? null : selectedTile;
    if (layer.tiles[cell.y][cell.x] === value) return;
    const tiles = layer.tiles.map((row) => [...row]);
    tiles[cell.y][cell.x] = value;
    setLayerTiles(tiles);
  }

  function fillAt(e: React.MouseEvent<HTMLCanvasElement>) {
    const cell = cellFromEvent(e);
    const layer = current?.layers[selectedLayer];
    if (!cell || !layer || !current) return;
    const target = layer.tiles[cell.y][cell.x];
    const value: Tile = selectedTile;
    if (target === value) return;
    const tiles = layer.tiles.map((row) => [...row]);
    const stack = [[cell.x, cell.y]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      if (x < 0 || y < 0 || x >= current.width || y >= current.height || tiles[y][x] !== target) continue;
      tiles[y][x] = value;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    setLayerTiles(tiles);
  }

  function deleteTilemap(id: string) {
    if (!confirm("Delete this tilemap?")) return;
    storage.delete("tilemaps", id, projectId);
    if (current?.id === id) setCurrent(null);
  }

  function addLayer() {
    if (!current) return;
    const layers = [...current.layers, createEmptyLayer(`Layer ${current.layers.length + 1}`, current.width, current.height)];
    update({ ...current, layers });
    setSelectedLayer(layers.length - 1);
  }

  function deleteLayer(i: number) {
    if (!current || current.layers.length <= 1) return;
    update({ ...current, layers: current.layers.filter((_, idx) => idx !== i) });
    setSelectedLayer(Math.max(0, Math.min(selectedLayer, current.layers.length - 2)));
  }

  function toggleLayerVisibility(i: number) {
    if (!current) return;
    update({ ...current, layers: current.layers.map((l, idx) => (idx === i ? { ...l, visible: !l.visible } : l)) });
  }

  function moveLayer(i: number, dir: -1 | 1) {
    if (!current) return;
    const j = i + dir;
    if (j < 0 || j >= current.layers.length) return;
    const layers = [...current.layers];
    [layers[i], layers[j]] = [layers[j], layers[i]];
    update({ ...current, layers });
    setSelectedLayer(j);
  }

  async function exportPNG() {
    if (!current) return;
    const srcs = referencedSprites(current)
      .map((id) => spriteById.get(id))
      .map((s) => (s ? spriteFrameSrc(s, 0) : undefined))
      .filter((s): s is string => !!s);
    await preloadImages(srcs);
    const c = document.createElement("canvas");
    c.width = current.width * current.tileSize;
    c.height = current.height * current.tileSize;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawTilemap(ctx, current, spriteById, { grid: false, background: false });
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `${current.name || "tilemap"}.png`;
    a.click();
  }

  const toolBtn = (t: Tool, Icon: typeof Paintbrush, title: string) => (
    <button
      onClick={() => setTool(t)}
      className="p-1.5 rounded"
      style={{ background: tool === t ? "var(--accent)" : "transparent", color: tool === t ? "white" : "var(--text-secondary)" }}
      title={title}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <div className="flex h-full" style={{ background: "var(--bg-primary)" }}>
      {/* Left panel */}
      <div className="w-56 shrink-0 border-r flex flex-col overflow-y-auto" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
        <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Tilemaps</span>
            <button onClick={() => setShowNew(true)} className="p-1 rounded" style={{ color: "var(--accent)" }} title="New tilemap">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {showNew && (
            <div className="space-y-1.5 mb-2">
              <input
                placeholder="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createTilemap()}
                className="w-full px-2 py-1 rounded text-xs outline-none"
                style={inputStyle}
                autoFocus
              />
              <div className="flex gap-1 items-center text-xs" style={{ color: "var(--text-muted)" }}>
                <input type="number" min={1} max={256} value={newWidth} onChange={(e) => setNewWidth(+e.target.value)} className="w-full px-2 py-1 rounded text-xs outline-none" style={inputStyle} title="Width in tiles" />
                ×
                <input type="number" min={1} max={256} value={newHeight} onChange={(e) => setNewHeight(+e.target.value)} className="w-full px-2 py-1 rounded text-xs outline-none" style={inputStyle} title="Height in tiles" />
              </div>
              <select value={newTileSize} onChange={(e) => setNewTileSize(+e.target.value)} className="w-full px-2 py-1 rounded text-xs outline-none" style={inputStyle}>
                {TILE_SIZES.map((s) => (
                  <option key={s} value={s}>{s}×{s} px tiles</option>
                ))}
              </select>
              <div className="flex gap-1">
                <button onClick={createTilemap} className="flex-1 px-2 py-1 rounded text-xs font-medium" style={{ background: "var(--accent)", color: "white" }}>Create</button>
                <button onClick={() => setShowNew(false)} className="px-2 py-1 rounded text-xs" style={{ color: "var(--text-secondary)" }}>Cancel</button>
              </div>
            </div>
          )}
          <div className="space-y-0.5">
            {tilemaps.map((tm) => (
              <div
                key={tm.id}
                className="group flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer"
                style={{ background: current?.id === tm.id ? "var(--bg-hover)" : "transparent", color: "var(--text-primary)" }}
                onClick={() => selectTilemap(tm)}
              >
                <span className="truncate">{tm.name}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteTilemap(tm.id); }} className="opacity-0 group-hover:opacity-100" style={{ color: "var(--red)" }} title="Delete">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
          <span className="text-xs font-medium block mb-2" style={{ color: "var(--text-secondary)" }}>Your sprites</span>
          {sprites.length === 0 ? (
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              No sprites yet. Draw tiles in{" "}
              <Link href={`/project/${projectId}/pixel-art`} className="underline" style={{ color: "var(--accent)" }}>Pixel Art</Link>{" "}
              and they show up here.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-1">
              {sprites.map((s) => {
                const src = spriteFrameSrc(s, 0);
                const active = selectedTile === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedTile(s.id); if (tool === "erase") setTool("paint"); }}
                    className="w-full aspect-square rounded flex items-center justify-center overflow-hidden"
                    style={{
                      background: "repeating-conic-gradient(#1a1a2e 0% 25%, #222238 0% 50%) 0 0 / 8px 8px",
                      outline: active ? "2px solid var(--accent)" : "1px solid var(--border)",
                      outlineOffset: active ? "1px" : "0",
                    }}
                    title={s.name}
                  >
                    {src && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt={s.name} className="w-full h-full object-contain" style={{ imageRendering: "pixelated" }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3">
          <span className="text-xs font-medium block mb-2" style={{ color: "var(--text-secondary)" }}>Basic tiles</span>
          <div className="grid grid-cols-4 gap-1">
            {BASIC_TILES.map((color, i) => (
              <button
                key={i}
                className="w-full aspect-square rounded"
                style={{
                  background: color,
                  outline: selectedTile === i ? "2px solid var(--accent)" : "1px solid var(--border)",
                  outlineOffset: selectedTile === i ? "1px" : "0",
                }}
                onClick={() => { setSelectedTile(i); if (tool === "erase") setTool("paint"); }}
                title={color}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main canvas area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-10 flex items-center gap-2 px-3 border-b shrink-0" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          {toolBtn("paint", Paintbrush, "Paint")}
          {toolBtn("fill", PaintBucket, "Fill area")}
          {toolBtn("erase", Eraser, "Erase")}
          <div className="w-px h-5" style={{ background: "var(--border)" }} />
          <button
            onClick={() => current && persist(current, true)}
            disabled={!current}
            className="flex items-center gap-1 p-1.5 rounded text-xs"
            style={{ color: savedFlash ? "var(--green)" : "var(--text-secondary)" }}
            title="Save"
          >
            {savedFlash ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {savedFlash ? "Saved" : dirty ? "Unsaved" : ""}
          </button>
          <button onClick={exportPNG} disabled={!current} className="p-1.5 rounded" style={{ color: "var(--text-secondary)" }} title="Export PNG">
            <Download className="w-4 h-4" />
          </button>
          {current && (
            <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
              {current.width}×{current.height} tiles · {current.tileSize}px
            </span>
          )}
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center p-4">
          {current ? (
            <canvas
              ref={canvasRef}
              className="border cursor-crosshair"
              style={{ borderColor: "var(--border)", imageRendering: "pixelated", maxWidth: "100%", maxHeight: "100%", minWidth: Math.min(current.width * current.tileSize * 2, 960) }}
              onMouseDown={(e) => {
                if (tool === "fill") {
                  fillAt(e);
                  return;
                }
                setIsPainting(true);
                paintAt(e);
              }}
              onMouseMove={(e) => isPainting && paintAt(e)}
              onMouseUp={() => setIsPainting(false)}
              onMouseLeave={() => setIsPainting(false)}
            />
          ) : (
            <div className="text-center" style={{ color: "var(--text-muted)" }}>
              <Grid3X3 className="w-12 h-12 mx-auto mb-3" />
              <p>Select or create a tilemap to start painting</p>
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      {current && (
        <div className="w-56 shrink-0 border-l flex flex-col overflow-y-auto" style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}>
          <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                <Layers className="w-3 h-3" />
                Layers
              </span>
              <button onClick={addLayer} className="p-1 rounded" style={{ color: "var(--accent)" }} title="Add layer">
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-0.5">
              {current.layers.map((layer, i) => (
                <div
                  key={layer.id}
                  className="group flex items-center gap-1 px-2 py-1.5 rounded text-xs cursor-pointer"
                  style={{ background: selectedLayer === i ? "var(--bg-hover)" : "transparent", color: "var(--text-primary)" }}
                  onClick={() => setSelectedLayer(i)}
                >
                  <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(i); }} style={{ color: layer.visible ? "var(--text-secondary)" : "var(--text-muted)" }} title="Toggle visibility">
                    {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                  <span className="flex-1 truncate">{layer.name}</span>
                  {current.layers.length > 1 && (
                    <button onClick={(e) => { e.stopPropagation(); deleteLayer(i); }} className="opacity-0 group-hover:opacity-100" style={{ color: "var(--red)" }} title="Delete layer">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  <div className="flex flex-col">
                    <button onClick={(e) => { e.stopPropagation(); moveLayer(i, -1); }} style={{ color: "var(--text-muted)" }} title="Move up">
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); moveLayer(i, 1); }} style={{ color: "var(--text-muted)" }} title="Move down">
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-3">
            <LinkedAssets projectId={projectId} type="tilemap" id={current.id} layout="panel" />
          </div>
        </div>
      )}
    </div>
  );
}
