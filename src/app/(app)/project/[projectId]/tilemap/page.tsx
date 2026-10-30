"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Plus,
  Trash2,
  Save,
  Download,
  Eye,
  EyeOff,
  Paintbrush,
  Eraser,
  Grid3X3,
  Layers,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { storage } from "@/lib/storage";
import type { TilemapData, TilemapLayer, Sprite } from "@/types";
import { v4 as uuid } from "uuid";

const DEFAULT_TILE_SIZE = 16;

function createEmptyLayer(name: string, w: number, h: number): TilemapLayer {
  const tiles: (number | null)[][] = [];
  for (let r = 0; r < h; r++) {
    tiles.push(new Array(w).fill(null));
  }
  return { id: uuid(), name, visible: true, tiles };
}

const EXAMPLE_TILESET_COLORS = [
  "#4a7c59", "#6b8f3c", "#8b6914", "#a0522d",
  "#708090", "#4682b4", "#2e8b57", "#daa520",
  "#cd853f", "#8fbc8f", "#556b2f", "#b8860b",
  "#d2691e", "#bc8f8f", "#f4a460", "#c0c0c0",
];

export default function TilemapPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [tilemaps, setTilemaps] = useState<TilemapData[]>([]);
  const [current, setCurrent] = useState<TilemapData | null>(null);
  const [selectedTile, setSelectedTile] = useState<number>(0);
  const [selectedLayer, setSelectedLayer] = useState(0);
  const [tool, setTool] = useState<"paint" | "erase">("paint");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newWidth, setNewWidth] = useState(20);
  const [newHeight, setNewHeight] = useState(15);
  const [isPainting, setIsPainting] = useState(false);
  const [sprites, setSprites] = useState<Sprite[]>([]);

  useEffect(() => {
    setTilemaps(storage.getAll("tilemaps", projectId));
    setSprites(storage.getAll("sprites", projectId));
  }, [projectId]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ts = current.tileSize;
    canvas.width = current.width * ts;
    canvas.height = current.height * ts;

    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const layer of current.layers) {
      if (!layer.visible) continue;
      for (let r = 0; r < current.height; r++) {
        for (let c = 0; c < current.width; c++) {
          const tile = layer.tiles[r]?.[c];
          if (tile !== null && tile !== undefined) {
            ctx.fillStyle = EXAMPLE_TILESET_COLORS[tile % EXAMPLE_TILESET_COLORS.length];
            ctx.fillRect(c * ts, r * ts, ts, ts);
          }
        }
      }
    }

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= current.height; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * ts);
      ctx.lineTo(current.width * ts, r * ts);
      ctx.stroke();
    }
    for (let c = 0; c <= current.width; c++) {
      ctx.beginPath();
      ctx.moveTo(c * ts, 0);
      ctx.lineTo(c * ts, current.height * ts);
      ctx.stroke();
    }
  }, [current]);

  useEffect(() => {
    draw();
  }, [draw]);

  function createTilemap() {
    if (!newName.trim()) return;
    const tm: TilemapData = {
      id: uuid(),
      projectId,
      name: newName.trim(),
      width: newWidth,
      height: newHeight,
      tileSize: DEFAULT_TILE_SIZE,
      layers: [createEmptyLayer("Ground", newWidth, newHeight)],
      tilesetSpriteIds: [],
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storage.save("tilemaps", tm, projectId);
    setTilemaps(storage.getAll("tilemaps", projectId));
    setCurrent(tm);
    setShowNew(false);
    setNewName("");
  }

  function paintTile(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX / current.tileSize);
    const y = Math.floor((e.clientY - rect.top) * scaleY / current.tileSize);
    if (x < 0 || x >= current.width || y < 0 || y >= current.height) return;

    const layer = current.layers[selectedLayer];
    if (!layer) return;

    const newTiles = layer.tiles.map((row) => [...row]);
    newTiles[y][x] = tool === "paint" ? selectedTile : null;

    const updated = {
      ...current,
      layers: current.layers.map((l, i) =>
        i === selectedLayer ? { ...l, tiles: newTiles } : l
      ),
      updatedAt: new Date().toISOString(),
    };
    setCurrent(updated);
  }

  function saveTilemap() {
    if (!current) return;
    storage.save("tilemaps", current, projectId);
    setTilemaps(storage.getAll("tilemaps", projectId));
  }

  function deleteTilemap(id: string) {
    storage.delete("tilemaps", id, projectId);
    setTilemaps(storage.getAll("tilemaps", projectId));
    if (current?.id === id) setCurrent(null);
  }

  function addLayer() {
    if (!current) return;
    const updated = {
      ...current,
      layers: [...current.layers, createEmptyLayer(`Layer ${current.layers.length + 1}`, current.width, current.height)],
    };
    setCurrent(updated);
    setSelectedLayer(updated.layers.length - 1);
  }

  function toggleLayerVisibility(i: number) {
    if (!current) return;
    const updated = {
      ...current,
      layers: current.layers.map((l, idx) =>
        idx === i ? { ...l, visible: !l.visible } : l
      ),
    };
    setCurrent(updated);
  }

  function moveLayer(i: number, dir: -1 | 1) {
    if (!current) return;
    const j = i + dir;
    if (j < 0 || j >= current.layers.length) return;
    const layers = [...current.layers];
    [layers[i], layers[j]] = [layers[j], layers[i]];
    setCurrent({ ...current, layers });
    setSelectedLayer(j);
  }

  function exportPNG() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${current?.name || "tilemap"}.png`;
    a.click();
  }

  return (
    <div className="flex h-full" style={{ background: "var(--bg-primary)" }}>
      {/* Left panel - tilemap list + tileset */}
      <div
        className="w-56 shrink-0 border-r flex flex-col overflow-y-auto"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              Tilemaps
            </span>
            <button
              onClick={() => setShowNew(true)}
              className="p-1 rounded"
              style={{ color: "var(--accent)" }}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {showNew && (
            <div className="space-y-1.5 mb-2">
              <input
                placeholder="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-2 py-1 rounded text-xs outline-none"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                autoFocus
              />
              <div className="flex gap-1">
                <input
                  type="number"
                  value={newWidth}
                  onChange={(e) => setNewWidth(+e.target.value)}
                  className="w-full px-2 py-1 rounded text-xs outline-none"
                  style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  placeholder="W"
                />
                <input
                  type="number"
                  value={newHeight}
                  onChange={(e) => setNewHeight(+e.target.value)}
                  className="w-full px-2 py-1 rounded text-xs outline-none"
                  style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  placeholder="H"
                />
              </div>
              <button
                onClick={createTilemap}
                className="w-full px-2 py-1 rounded text-xs font-medium"
                style={{ background: "var(--accent)", color: "white" }}
              >
                Create
              </button>
            </div>
          )}
          <div className="space-y-0.5">
            {tilemaps.map((tm) => (
              <div
                key={tm.id}
                className="group flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer"
                style={{
                  background: current?.id === tm.id ? "var(--bg-hover)" : "transparent",
                  color: "var(--text-primary)",
                }}
                onClick={() => setCurrent(tm)}
              >
                <span className="truncate">{tm.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTilemap(tm.id);
                  }}
                  className="opacity-0 group-hover:opacity-100"
                  style={{ color: "var(--red)" }}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tile palette */}
        <div className="p-3">
          <span className="text-xs font-medium block mb-2" style={{ color: "var(--text-secondary)" }}>
            Tile Palette
          </span>
          <div className="grid grid-cols-4 gap-1">
            {EXAMPLE_TILESET_COLORS.map((color, i) => (
              <button
                key={i}
                className="w-full aspect-square rounded"
                style={{
                  background: color,
                  outline: selectedTile === i ? "2px solid var(--accent)" : "1px solid var(--border)",
                  outlineOffset: selectedTile === i ? "1px" : "0",
                }}
                onClick={() => setSelectedTile(i)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main canvas area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div
          className="h-10 flex items-center gap-2 px-3 border-b shrink-0"
          style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
        >
          <button
            onClick={() => setTool("paint")}
            className="p-1.5 rounded"
            style={{
              background: tool === "paint" ? "var(--accent)" : "transparent",
              color: tool === "paint" ? "white" : "var(--text-secondary)",
            }}
            title="Paint"
          >
            <Paintbrush className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTool("erase")}
            className="p-1.5 rounded"
            style={{
              background: tool === "erase" ? "var(--accent)" : "transparent",
              color: tool === "erase" ? "white" : "var(--text-secondary)",
            }}
            title="Erase"
          >
            <Eraser className="w-4 h-4" />
          </button>
          <div className="w-px h-5" style={{ background: "var(--border)" }} />
          <button onClick={saveTilemap} className="p-1.5 rounded" style={{ color: "var(--text-secondary)" }} title="Save">
            <Save className="w-4 h-4" />
          </button>
          <button onClick={exportPNG} className="p-1.5 rounded" style={{ color: "var(--text-secondary)" }} title="Export PNG">
            <Download className="w-4 h-4" />
          </button>
          {current && (
            <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
              {current.width}x{current.height} tiles
            </span>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4">
          {current ? (
            <canvas
              ref={canvasRef}
              className="border cursor-crosshair"
              style={{ borderColor: "var(--border)", imageRendering: "pixelated", maxWidth: "100%", maxHeight: "100%" }}
              onMouseDown={(e) => {
                setIsPainting(true);
                paintTile(e);
              }}
              onMouseMove={(e) => isPainting && paintTile(e)}
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

      {/* Right panel - layers */}
      {current && (
        <div
          className="w-48 shrink-0 border-l flex flex-col overflow-y-auto"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
        >
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                <Layers className="w-3 h-3 inline mr-1" />
                Layers
              </span>
              <button onClick={addLayer} className="p-1 rounded" style={{ color: "var(--accent)" }}>
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-0.5">
              {current.layers.map((layer, i) => (
                <div
                  key={layer.id}
                  className="flex items-center gap-1 px-2 py-1.5 rounded text-xs cursor-pointer"
                  style={{
                    background: selectedLayer === i ? "var(--bg-hover)" : "transparent",
                    color: "var(--text-primary)",
                  }}
                  onClick={() => setSelectedLayer(i)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLayerVisibility(i);
                    }}
                    style={{ color: layer.visible ? "var(--text-secondary)" : "var(--text-muted)" }}
                  >
                    {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                  <span className="flex-1 truncate">{layer.name}</span>
                  <div className="flex flex-col">
                    <button
                      onClick={(e) => { e.stopPropagation(); moveLayer(i, -1); }}
                      style={{ color: "var(--text-muted)" }}
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveLayer(i, 1); }}
                      style={{ color: "var(--text-muted)" }}
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
