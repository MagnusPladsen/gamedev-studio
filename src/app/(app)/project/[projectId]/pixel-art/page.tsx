"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  Pencil,
  Eraser,
  PaintBucket,
  Minus,
  Square,
  Circle,
  Pipette,
  Move,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Play,
  Pause,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  ChevronUp,
  ChevronDown,
  Download,
  Save,
  Undo2,
  Redo2,
  FilePlus,
  Layers,
  Image as ImageIcon,
} from "lucide-react";
import { v4 as uuid } from "uuid";
import { storage } from "@/lib/storage";
import type { Sprite, SpriteFrame } from "@/types";

// ─── types ───────────────────────────────────────────────────────────
type Tool = "pencil" | "eraser" | "fill" | "line" | "rect" | "circle" | "picker" | "move";

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  pixels: string; // base64 of ImageData
}

interface FrameData {
  id: string;
  layers: Layer[];
  duration: number;
}

interface HistoryEntry {
  frames: FrameData[];
  activeFrame: number;
  activeLayer: number;
}

// ─── example sprites ─────────────────────────────────────────────────
function makePixelData(w: number, h: number, fn: (x: number, y: number) => [number, number, number, number]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = fn(x, y);
      const i = (y * w + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
    }
  }
  return d;
}

const EXAMPLES: { name: string; w: number; h: number; build: () => Uint8ClampedArray }[] = [
  {
    name: "Sword",
    w: 16, h: 16,
    build() {
      // prettier-ignore
      const map = [
        "................",
        "..............X.",
        ".............XX.",
        "............XGX.",
        "...........XGX..",
        "..........XGX...",
        ".........XGX....",
        "........XGX.....",
        ".......XGX......",
        "......XGX.......",
        ".B...XGX........",
        "..B.XGX.........",
        "...BGX..........",
        "..BBBB..........",
        ".B..BB..........",
        "................",
      ];
      return makePixelData(16, 16, (x, y) => {
        const c = map[y]?.[x];
        if (c === "X") return [180, 180, 200, 255];
        if (c === "G") return [220, 220, 240, 255];
        if (c === "B") return [120, 80, 40, 255];
        return [0, 0, 0, 0];
      });
    },
  },
  {
    name: "Heart",
    w: 16, h: 16,
    build() {
      // prettier-ignore
      const map = [
        "................",
        "..RRR....RRR....",
        ".RRRRR..RRRRR...",
        ".RRHRRRRRRRRR...",
        ".RRRRRRRRRRRR...",
        ".RRRRRRRRRRRR...",
        "..RRRRRRRRRR....",
        "...RRRRRRRR.....",
        "....RRRRRR......",
        ".....RRRR.......",
        "......RR........",
        "................",
        "................",
        "................",
        "................",
        "................",
      ];
      return makePixelData(16, 16, (x, y) => {
        const c = map[y]?.[x];
        if (c === "R") return [220, 40, 60, 255];
        if (c === "H") return [255, 120, 140, 255];
        return [0, 0, 0, 0];
      });
    },
  },
  {
    name: "Coin",
    w: 16, h: 16,
    build() {
      // prettier-ignore
      const map = [
        "................",
        ".....YYYY.......",
        "....YGGGYY.....",
        "...YGGGGGYY....",
        "...YGGYYGYY....",
        "...YGGYYGGY....",
        "...YGGGGGYY....",
        "...YGGGGGYY....",
        "...YGGYYGGY....",
        "...YGGYYGYY....",
        "...YGGGGGYY....",
        "....YGGGYY.....",
        ".....YYYY.......",
        "................",
        "................",
        "................",
      ];
      return makePixelData(16, 16, (x, y) => {
        const c = map[y]?.[x];
        if (c === "Y") return [200, 160, 40, 255];
        if (c === "G") return [255, 210, 80, 255];
        return [0, 0, 0, 0];
      });
    },
  },
];

// ─── helpers ─────────────────────────────────────────────────────────
function imageDataToBase64(data: ImageData): string {
  const c = document.createElement("canvas");
  c.width = data.width;
  c.height = data.height;
  c.getContext("2d")!.putImageData(data, 0, 0);
  return c.toDataURL();
}

function base64ToImageData(b64: string, w: number, h: number): Promise<ImageData> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, w, h));
    };
    img.src = b64;
  });
}

function blankBase64(w: number, h: number): string {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c.toDataURL();
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.replace("#", ""), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function floodFill(data: ImageData, sx: number, sy: number, fillR: number, fillG: number, fillB: number, fillA: number) {
  const { width, height, data: d } = data;
  const idx = (sy * width + sx) * 4;
  const tR = d[idx], tG = d[idx + 1], tB = d[idx + 2], tA = d[idx + 3];
  if (tR === fillR && tG === fillG && tB === fillB && tA === fillA) return;
  const stack: [number, number][] = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    const i = (y * width + x) * 4;
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (d[i] !== tR || d[i + 1] !== tG || d[i + 2] !== tB || d[i + 3] !== tA) continue;
    d[i] = fillR; d[i + 1] = fillG; d[i + 2] = fillB; d[i + 3] = fillA;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

function bresenhamLine(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const pts: [number, number][] = [];
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return pts;
}

function midpointCircle(cx: number, cy: number, r: number): [number, number][] {
  const pts: [number, number][] = [];
  let x = r, y = 0, d = 1 - r;
  const add = (px: number, py: number) => pts.push([px, py]);
  while (x >= y) {
    add(cx + x, cy + y); add(cx - x, cy + y);
    add(cx + x, cy - y); add(cx - x, cy - y);
    add(cx + y, cy + x); add(cx - y, cy + x);
    add(cx + y, cy - x); add(cx - y, cy - x);
    y++;
    if (d <= 0) { d += 2 * y + 1; } else { x--; d += 2 * (y - x) + 1; }
  }
  return pts;
}

// ─── component ───────────────────────────────────────────────────────
const DEFAULT_PALETTE = [
  "#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff",
  "#ffff00", "#ff00ff", "#00ffff", "#ff8800", "#8800ff",
  "#0088ff", "#88ff00", "#ff0088", "#ff4444", "#44ff44",
  "#4444ff", "#884422", "#228844", "#224488", "#888888",
  "#cccccc", "#444444", "#ffcc00", "#cc00ff", "#00ffcc",
  "#ff6644", "#44ff66", "#6644ff", "#aaaaaa", "#553311",
  "#335511", "#113355",
];

const SIZES = [
  { label: "16×16", w: 16, h: 16 },
  { label: "32×32", w: 32, h: 32 },
  { label: "64×64", w: 64, h: 64 },
];

const TOOL_ICONS: Record<Tool, typeof Pencil> = {
  pencil: Pencil, eraser: Eraser, fill: PaintBucket, line: Minus,
  rect: Square, circle: Circle, picker: Pipette, move: Move,
};

export default function PixelArtPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  // ── sprite list ──
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [activeSpriteId, setActiveSpriteId] = useState<string | null>(null);

  // ── canvas size ──
  const [canvasW, setCanvasW] = useState(32);
  const [canvasH, setCanvasH] = useState(32);

  // ── frames / layers ──
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [activeFrame, setActiveFrame] = useState(0);
  const [activeLayer, setActiveLayer] = useState(0);

  // ── tool state ──
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#000000");
  const [palette, setPalette] = useState<string[]>(DEFAULT_PALETTE);
  const [zoom, setZoom] = useState(12);
  const [showGrid, setShowGrid] = useState(true);
  const [onionSkin, setOnionSkin] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState(8);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [customW, setCustomW] = useState("32");
  const [customH, setCustomH] = useState("32");

  // ── history ──
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIdxRef = useRef(-1);

  // ── drawing refs ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const lastPixelRef = useRef<{ x: number; y: number } | null>(null);
  const overlayRef = useRef<ImageData | null>(null);

  // ── init: load sprites ──
  useEffect(() => {
    const list = storage.getAll("sprites", projectId);
    setSprites(list);
  }, [projectId]);

  // ── build initial blank frame ──
  function makeBlankFrame(w: number, h: number): FrameData {
    return {
      id: uuid(),
      layers: [{ id: uuid(), name: "Layer 1", visible: true, pixels: blankBase64(w, h) }],
      duration: 100,
    };
  }

  // ── new sprite ──
  function createNewSprite(name: string, w: number, h: number, exampleData?: Uint8ClampedArray) {
    setCanvasW(w);
    setCanvasH(h);
    const frame = makeBlankFrame(w, h);
    if (exampleData) {
      const id = new ImageData(exampleData as unknown as Uint8ClampedArray<ArrayBuffer>, w, h);
      frame.layers[0].pixels = imageDataToBase64(id);
    }
    setFrames([frame]);
    setActiveFrame(0);
    setActiveLayer(0);
    setActiveSpriteId(null);
    setNewName(name);
    historyRef.current = [];
    historyIdxRef.current = -1;
    pushHistory([frame], 0, 0);
  }

  // ── load sprite ──
  async function loadSprite(sprite: Sprite) {
    setCanvasW(sprite.width);
    setCanvasH(sprite.height);
    setActiveSpriteId(sprite.id);
    setNewName(sprite.name);
    setFps(sprite.fps);

    const loaded: FrameData[] = [];
    for (const sf of sprite.frames) {
      const layer: Layer = { id: uuid(), name: "Layer 1", visible: true, pixels: sf.pixels };
      loaded.push({ id: sf.id, layers: [layer], duration: sf.duration });
    }
    if (loaded.length === 0) loaded.push(makeBlankFrame(sprite.width, sprite.height));
    setFrames(loaded);
    setActiveFrame(0);
    setActiveLayer(0);
    historyRef.current = [];
    historyIdxRef.current = -1;
    pushHistory(loaded, 0, 0);
  }

  // ── save sprite ──
  function saveSprite() {
    const name = newName.trim() || "Untitled";
    const spriteFrames: SpriteFrame[] = frames.map((f) => ({
      id: f.id,
      pixels: compositeFrame(f),
      duration: f.duration,
    }));
    const sprite: Sprite = {
      id: activeSpriteId || uuid(),
      projectId,
      name,
      width: canvasW,
      height: canvasH,
      frames: spriteFrames,
      fps,
      tags: [],
      createdAt: activeSpriteId
        ? sprites.find((s) => s.id === activeSpriteId)?.createdAt || new Date().toISOString()
        : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storage.save("sprites", sprite, projectId);
    setActiveSpriteId(sprite.id);
    setSprites(storage.getAll("sprites", projectId));
  }

  // ── composite all visible layers into one base64 ──
  function compositeFrame(frame: FrameData): string {
    const c = document.createElement("canvas");
    c.width = canvasW;
    c.height = canvasH;
    const ctx = c.getContext("2d")!;
    for (const layer of frame.layers) {
      if (!layer.visible) continue;
      const img = new window.Image();
      img.src = layer.pixels;
      ctx.drawImage(img, 0, 0);
    }
    return c.toDataURL();
  }

  // ── history ──
  function pushHistory(f: FrameData[], af: number, al: number) {
    const entry: HistoryEntry = {
      frames: JSON.parse(JSON.stringify(f)),
      activeFrame: af,
      activeLayer: al,
    };
    historyRef.current = historyRef.current.slice(0, historyIdxRef.current + 1);
    historyRef.current.push(entry);
    if (historyRef.current.length > 50) historyRef.current.shift();
    historyIdxRef.current = historyRef.current.length - 1;
  }

  function undo() {
    if (historyIdxRef.current <= 0) return;
    historyIdxRef.current--;
    const e = historyRef.current[historyIdxRef.current];
    setFrames(JSON.parse(JSON.stringify(e.frames)));
    setActiveFrame(e.activeFrame);
    setActiveLayer(e.activeLayer);
  }

  function redo() {
    if (historyIdxRef.current >= historyRef.current.length - 1) return;
    historyIdxRef.current++;
    const e = historyRef.current[historyIdxRef.current];
    setFrames(JSON.parse(JSON.stringify(e.frames)));
    setActiveFrame(e.activeFrame);
    setActiveLayer(e.activeLayer);
  }

  // ── keyboard shortcuts ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveSprite(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, activeFrame, activeLayer, activeSpriteId, newName, canvasW, canvasH, fps]);

  // ── render canvas ──
  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || frames.length === 0) return;
    const displayFrame = playing ? previewFrame : activeFrame;
    const frame = frames[displayFrame];
    if (!frame) return;

    const ctx = canvas.getContext("2d")!;
    const pw = canvasW * zoom;
    const ph = canvasH * zoom;
    canvas.width = pw;
    canvas.height = ph;

    ctx.clearRect(0, 0, pw, ph);

    // checkerboard
    const cs = zoom;
    for (let y = 0; y < canvasH; y++) {
      for (let x = 0; x < canvasW; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#1a1a2a" : "#222238";
        ctx.fillRect(x * zoom, y * zoom, zoom, zoom);
      }
    }

    // onion skin
    if (onionSkin && !playing && displayFrame > 0) {
      const prev = frames[displayFrame - 1];
      if (prev) {
        ctx.globalAlpha = 0.25;
        for (const layer of prev.layers) {
          if (!layer.visible) continue;
          const img = new window.Image();
          img.src = layer.pixels;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, 0, canvasW, canvasH, 0, 0, pw, ph);
        }
        ctx.globalAlpha = 1;
      }
    }

    // layers
    for (const layer of frame.layers) {
      if (!layer.visible) continue;
      const img = new window.Image();
      img.src = layer.pixels;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, canvasW, canvasH, 0, 0, pw, ph);
    }

    // overlay (line/rect/circle preview)
    if (overlayRef.current && !playing) {
      const oc = document.createElement("canvas");
      oc.width = canvasW;
      oc.height = canvasH;
      oc.getContext("2d")!.putImageData(overlayRef.current, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(oc, 0, 0, canvasW, canvasH, 0, 0, pw, ph);
    }

    // grid
    if (showGrid && zoom >= 4) {
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= canvasW; x++) {
        ctx.beginPath();
        ctx.moveTo(x * zoom + 0.5, 0);
        ctx.lineTo(x * zoom + 0.5, ph);
        ctx.stroke();
      }
      for (let y = 0; y <= canvasH; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * zoom + 0.5);
        ctx.lineTo(pw, y * zoom + 0.5);
        ctx.stroke();
      }
    }
  }, [frames, activeFrame, previewFrame, playing, canvasW, canvasH, zoom, showGrid, onionSkin]);

  useEffect(() => { renderCanvas(); }, [renderCanvas]);

  // ── animation playback ──
  useEffect(() => {
    if (!playing || frames.length <= 1) return;
    const interval = setInterval(() => {
      setPreviewFrame((p) => (p + 1) % frames.length);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [playing, fps, frames.length]);

  // ── get active layer image data ──
  async function getActiveLayerData(): Promise<ImageData> {
    const frame = frames[activeFrame];
    if (!frame) return new ImageData(canvasW, canvasH);
    const layer = frame.layers[activeLayer];
    if (!layer) return new ImageData(canvasW, canvasH);
    return base64ToImageData(layer.pixels, canvasW, canvasH);
  }

  // ── set active layer image data ──
  function setActiveLayerData(imgData: ImageData) {
    const b64 = imageDataToBase64(imgData);
    setFrames((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as FrameData[];
      const frame = next[activeFrame];
      if (frame && frame.layers[activeLayer]) {
        frame.layers[activeLayer].pixels = b64;
      }
      return next;
    });
  }

  // ── pixel coords from mouse ──
  function getPixelCoords(e: React.MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / zoom);
    const y = Math.floor((e.clientY - rect.top) / zoom);
    if (x < 0 || x >= canvasW || y < 0 || y >= canvasH) return null;
    return { x, y };
  }

  // ── set pixel on imagedata ──
  function setPixel(data: ImageData, x: number, y: number, r: number, g: number, b: number, a: number) {
    if (x < 0 || x >= data.width || y < 0 || y >= data.height) return;
    const i = (y * data.width + x) * 4;
    data.data[i] = r;
    data.data[i + 1] = g;
    data.data[i + 2] = b;
    data.data[i + 3] = a;
  }

  // ── mouse handlers ──
  async function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (playing) return;
    const p = getPixelCoords(e);
    if (!p) return;
    isDrawingRef.current = true;
    drawStartRef.current = p;
    lastPixelRef.current = p;

    if (tool === "pencil" || tool === "eraser") {
      const data = await getActiveLayerData();
      const [r, g, b] = tool === "eraser" ? [0, 0, 0] : hexToRgb(color);
      const a = tool === "eraser" ? 0 : 255;
      setPixel(data, p.x, p.y, r, g, b, a);
      setActiveLayerData(data);
    } else if (tool === "fill") {
      const data = await getActiveLayerData();
      const [r, g, b] = hexToRgb(color);
      floodFill(data, p.x, p.y, r, g, b, 255);
      setActiveLayerData(data);
      pushHistory(
        frames.map((f, fi) =>
          fi === activeFrame
            ? { ...f, layers: f.layers.map((l, li) => (li === activeLayer ? { ...l, pixels: imageDataToBase64(data) } : l)) }
            : f
        ),
        activeFrame,
        activeLayer
      );
      isDrawingRef.current = false;
    } else if (tool === "picker") {
      const data = await getActiveLayerData();
      const i = (p.y * canvasW + p.x) * 4;
      const r = data.data[i], g = data.data[i + 1], b = data.data[i + 2];
      if (data.data[i + 3] > 0) setColor(rgbToHex(r, g, b));
      isDrawingRef.current = false;
    }
  }

  async function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current || playing) return;
    const p = getPixelCoords(e);
    if (!p) return;

    if (tool === "pencil" || tool === "eraser") {
      const data = await getActiveLayerData();
      const [r, g, b] = tool === "eraser" ? [0, 0, 0] : hexToRgb(color);
      const a = tool === "eraser" ? 0 : 255;
      const last = lastPixelRef.current || p;
      const pts = bresenhamLine(last.x, last.y, p.x, p.y);
      for (const [px, py] of pts) setPixel(data, px, py, r, g, b, a);
      lastPixelRef.current = p;
      setActiveLayerData(data);
    } else if (tool === "line" || tool === "rect" || tool === "circle") {
      const start = drawStartRef.current;
      if (!start) return;
      const overlay = new ImageData(canvasW, canvasH);
      const [r, g, b] = hexToRgb(color);
      if (tool === "line") {
        for (const [px, py] of bresenhamLine(start.x, start.y, p.x, p.y)) setPixel(overlay, px, py, r, g, b, 255);
      } else if (tool === "rect") {
        const x1 = Math.min(start.x, p.x), x2 = Math.max(start.x, p.x);
        const y1 = Math.min(start.y, p.y), y2 = Math.max(start.y, p.y);
        for (let x = x1; x <= x2; x++) { setPixel(overlay, x, y1, r, g, b, 255); setPixel(overlay, x, y2, r, g, b, 255); }
        for (let y = y1; y <= y2; y++) { setPixel(overlay, x1, y, r, g, b, 255); setPixel(overlay, x2, y, r, g, b, 255); }
      } else if (tool === "circle") {
        const rad = Math.round(Math.sqrt((p.x - start.x) ** 2 + (p.y - start.y) ** 2));
        for (const [px, py] of midpointCircle(start.x, start.y, rad)) setPixel(overlay, px, py, r, g, b, 255);
      }
      overlayRef.current = overlay;
      renderCanvas();
    }
  }

  async function handleMouseUp() {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    if (tool === "line" || tool === "rect" || tool === "circle") {
      if (overlayRef.current) {
        const data = await getActiveLayerData();
        const ov = overlayRef.current;
        for (let i = 0; i < ov.data.length; i += 4) {
          if (ov.data[i + 3] > 0) {
            data.data[i] = ov.data[i];
            data.data[i + 1] = ov.data[i + 1];
            data.data[i + 2] = ov.data[i + 2];
            data.data[i + 3] = ov.data[i + 3];
          }
        }
        setActiveLayerData(data);
        overlayRef.current = null;
      }
    }
    pushHistory(frames, activeFrame, activeLayer);
  }

  // ── zoom ──
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setZoom((z) => Math.max(2, Math.min(40, z + (e.deltaY < 0 ? 1 : -1))));
  }

  // ── frame management ──
  function addFrame() {
    const newFrame = makeBlankFrame(canvasW, canvasH);
    const next = [...frames, newFrame];
    setFrames(next);
    setActiveFrame(next.length - 1);
    pushHistory(next, next.length - 1, activeLayer);
  }

  function duplicateFrame() {
    const clone: FrameData = JSON.parse(JSON.stringify(frames[activeFrame]));
    clone.id = uuid();
    clone.layers = clone.layers.map((l) => ({ ...l, id: uuid() }));
    const next = [...frames];
    next.splice(activeFrame + 1, 0, clone);
    setFrames(next);
    setActiveFrame(activeFrame + 1);
    pushHistory(next, activeFrame + 1, activeLayer);
  }

  function deleteFrame() {
    if (frames.length <= 1) return;
    const next = frames.filter((_, i) => i !== activeFrame);
    const newActive = Math.min(activeFrame, next.length - 1);
    setFrames(next);
    setActiveFrame(newActive);
    pushHistory(next, newActive, activeLayer);
  }

  // ── layer management ──
  function addLayer() {
    const next = JSON.parse(JSON.stringify(frames)) as FrameData[];
    const newLayer: Layer = { id: uuid(), name: `Layer ${next[activeFrame].layers.length + 1}`, visible: true, pixels: blankBase64(canvasW, canvasH) };
    next[activeFrame].layers.push(newLayer);
    setFrames(next);
    setActiveLayer(next[activeFrame].layers.length - 1);
    pushHistory(next, activeFrame, next[activeFrame].layers.length - 1);
  }

  function deleteLayer() {
    const frame = frames[activeFrame];
    if (frame.layers.length <= 1) return;
    const next = JSON.parse(JSON.stringify(frames)) as FrameData[];
    next[activeFrame].layers.splice(activeLayer, 1);
    const newAL = Math.min(activeLayer, next[activeFrame].layers.length - 1);
    setFrames(next);
    setActiveLayer(newAL);
    pushHistory(next, activeFrame, newAL);
  }

  function toggleLayerVisibility(idx: number) {
    const next = JSON.parse(JSON.stringify(frames)) as FrameData[];
    next[activeFrame].layers[idx].visible = !next[activeFrame].layers[idx].visible;
    setFrames(next);
  }

  function moveLayerUp() {
    if (activeLayer >= frames[activeFrame].layers.length - 1) return;
    const next = JSON.parse(JSON.stringify(frames)) as FrameData[];
    const layers = next[activeFrame].layers;
    [layers[activeLayer], layers[activeLayer + 1]] = [layers[activeLayer + 1], layers[activeLayer]];
    setFrames(next);
    setActiveLayer(activeLayer + 1);
  }

  function moveLayerDown() {
    if (activeLayer <= 0) return;
    const next = JSON.parse(JSON.stringify(frames)) as FrameData[];
    const layers = next[activeFrame].layers;
    [layers[activeLayer], layers[activeLayer - 1]] = [layers[activeLayer - 1], layers[activeLayer]];
    setFrames(next);
    setActiveLayer(activeLayer - 1);
  }

  // ── export ──
  function exportPNG() {
    const c = document.createElement("canvas");
    c.width = canvasW;
    c.height = canvasH;
    const ctx = c.getContext("2d")!;
    const frame = frames[activeFrame];
    for (const layer of frame.layers) {
      if (!layer.visible) continue;
      const img = new window.Image();
      img.src = layer.pixels;
      ctx.drawImage(img, 0, 0);
    }
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `${newName || "sprite"}_frame${activeFrame}.png`;
    a.click();
  }

  function exportSpriteSheet() {
    const cols = Math.ceil(Math.sqrt(frames.length));
    const rows = Math.ceil(frames.length / cols);
    const c = document.createElement("canvas");
    c.width = canvasW * cols;
    c.height = canvasH * rows;
    const ctx = c.getContext("2d")!;
    frames.forEach((frame, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      for (const layer of frame.layers) {
        if (!layer.visible) continue;
        const img = new window.Image();
        img.src = layer.pixels;
        ctx.drawImage(img, col * canvasW, row * canvasH);
      }
    });
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `${newName || "sprite"}_sheet.png`;
    a.click();
  }

  // ── init with blank if no frames ──
  useEffect(() => {
    if (frames.length === 0) {
      const initial = [makeBlankFrame(canvasW, canvasH)];
      setFrames(initial);
      pushHistory(initial, 0, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── render ──
  const btnStyle = (active?: boolean): React.CSSProperties => ({
    background: active ? "var(--accent)" : "var(--bg-card)",
    color: active ? "#fff" : "var(--text-secondary)",
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    borderRadius: 6,
    padding: "6px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
  });

  const panelStyle: React.CSSProperties = {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: 10,
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "var(--bg-primary)" }}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 h-12 shrink-0 border-b"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Sprite name"
            className="bg-transparent text-sm font-medium outline-none w-40"
            style={{ color: "var(--text-primary)" }}
          />
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {canvasW}×{canvasH}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={undo} style={btnStyle()} title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4" /></button>
          <button onClick={redo} style={btnStyle()} title="Redo (Ctrl+Y)"><Redo2 className="w-4 h-4" /></button>
          <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
          <button onClick={saveSprite} style={btnStyle()} title="Save (Ctrl+S)"><Save className="w-4 h-4" /></button>
          <button onClick={exportPNG} style={btnStyle()} title="Export frame as PNG"><Download className="w-4 h-4" /></button>
          <button onClick={exportSpriteSheet} style={btnStyle()} title="Export sprite sheet"><ImageIcon className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: sprites + tools + palette */}
        <div className="w-52 shrink-0 flex flex-col gap-2 p-2 overflow-y-auto border-r" style={{ borderColor: "var(--border)" }}>
          {/* Sprites list */}
          <div style={panelStyle}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Sprites</span>
              <button onClick={() => setShowNewDialog(true)} style={{ ...btnStyle(), padding: 3 }}><Plus className="w-3 h-3" /></button>
            </div>
            {showNewDialog && (
              <div className="mb-2 space-y-1.5">
                <div className="flex gap-1 flex-wrap">
                  {SIZES.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => { createNewSprite("Untitled", s.w, s.h); setShowNewDialog(false); }}
                      className="text-xs px-2 py-1 rounded"
                      style={{ background: "var(--bg-hover)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <input type="number" value={customW} onChange={(e) => setCustomW(e.target.value)} className="w-12 text-xs px-1 py-0.5 rounded outline-none" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>×</span>
                  <input type="number" value={customH} onChange={(e) => setCustomH(e.target.value)} className="w-12 text-xs px-1 py-0.5 rounded outline-none" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }} />
                  <button
                    onClick={() => { createNewSprite("Untitled", Number(customW) || 32, Number(customH) || 32); setShowNewDialog(false); }}
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ background: "var(--accent)", color: "white" }}
                  >
                    Go
                  </button>
                </div>
                <div className="border-t pt-1.5 mt-1" style={{ borderColor: "var(--border)" }}>
                  <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Examples:</div>
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.name}
                      onClick={() => { createNewSprite(ex.name, ex.w, ex.h, ex.build()); setShowNewDialog(false); }}
                      className="block w-full text-left text-xs px-2 py-1 rounded mb-0.5"
                      style={{ color: "var(--text-secondary)", background: "var(--bg-hover)" }}
                    >
                      {ex.name} ({ex.w}×{ex.h})
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-0.5 max-h-32 overflow-y-auto">
              {sprites.map((s) => (
                <button
                  key={s.id}
                  onClick={() => loadSprite(s)}
                  className="block w-full text-left text-xs px-2 py-1 rounded truncate"
                  style={{
                    color: activeSpriteId === s.id ? "var(--text-primary)" : "var(--text-secondary)",
                    background: activeSpriteId === s.id ? "var(--bg-hover)" : "transparent",
                  }}
                >
                  {s.name}
                </button>
              ))}
              {sprites.length === 0 && (
                <div className="text-xs py-1" style={{ color: "var(--text-muted)" }}>No sprites yet</div>
              )}
            </div>
          </div>

          {/* Tools */}
          <div style={panelStyle}>
            <div className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Tools</div>
            <div className="grid grid-cols-4 gap-1">
              {(Object.keys(TOOL_ICONS) as Tool[]).map((t) => {
                const Icon = TOOL_ICONS[t];
                return (
                  <button key={t} onClick={() => setTool(t)} style={btnStyle(tool === t)} title={t}>
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => setShowGrid(!showGrid)} style={btnStyle(showGrid)} title="Toggle grid">
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button onClick={() => setOnionSkin(!onionSkin)} style={btnStyle(onionSkin)} title="Onion skin">
                <Layers className="w-4 h-4" />
              </button>
              <button onClick={() => setZoom((z) => Math.min(40, z + 2))} style={btnStyle()} title="Zoom in">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={() => setZoom((z) => Math.max(2, z - 2))} style={btnStyle()} title="Zoom out">
                <ZoomOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Color */}
          <div style={panelStyle}>
            <div className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Color</div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded border" style={{ background: color, borderColor: "var(--border)" }} />
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 cursor-pointer"
                style={{ background: "transparent", border: "none" }}
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="flex-1 text-xs px-2 py-1 rounded outline-none"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {palette.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setColor(c)}
                  className="w-5 h-5 rounded-sm border"
                  style={{
                    background: c,
                    borderColor: color === c ? "var(--accent)" : "var(--border)",
                    outline: color === c ? "1px solid var(--accent)" : "none",
                  }}
                />
              ))}
              <button
                onClick={() => {
                  if (!palette.includes(color)) setPalette([...palette, color]);
                }}
                className="w-5 h-5 rounded-sm flex items-center justify-center"
                style={{ border: "1px dashed var(--border)", color: "var(--text-muted)" }}
                title="Add current color to palette"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Center: canvas */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-4">
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className="pixel-grid"
            style={{ cursor: tool === "picker" ? "crosshair" : tool === "move" ? "grab" : "crosshair", imageRendering: "pixelated" }}
          />
        </div>

        {/* Right panel: layers */}
        <div className="w-48 shrink-0 flex flex-col gap-2 p-2 overflow-y-auto border-l" style={{ borderColor: "var(--border)" }}>
          <div style={panelStyle}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Layers</span>
              <div className="flex gap-0.5">
                <button onClick={addLayer} style={{ ...btnStyle(), padding: 3 }} title="Add layer"><Plus className="w-3 h-3" /></button>
                <button onClick={deleteLayer} style={{ ...btnStyle(), padding: 3 }} title="Delete layer"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
            <div className="space-y-0.5">
              {frames[activeFrame]?.layers.map((layer, i) => (
                <div
                  key={layer.id}
                  onClick={() => setActiveLayer(i)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-xs cursor-pointer"
                  style={{
                    background: activeLayer === i ? "var(--bg-hover)" : "transparent",
                    color: activeLayer === i ? "var(--text-primary)" : "var(--text-secondary)",
                  }}
                >
                  <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(i); }} style={{ color: layer.visible ? "var(--text-secondary)" : "var(--text-muted)" }}>
                    {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                  <span className="flex-1 truncate">{layer.name}</span>
                </div>
              )).reverse()}
            </div>
            <div className="flex gap-0.5 mt-1">
              <button onClick={moveLayerUp} style={{ ...btnStyle(), padding: 3 }} title="Move up"><ChevronUp className="w-3 h-3" /></button>
              <button onClick={moveLayerDown} style={{ ...btnStyle(), padding: 3 }} title="Move down"><ChevronDown className="w-3 h-3" /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: timeline */}
      <div
        className="shrink-0 border-t px-4 py-2"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setPlaying(!playing)} style={btnStyle(playing)}>
              {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-1 ml-2">
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>FPS</span>
              <input
                type="number"
                value={fps}
                onChange={(e) => setFps(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
                className="w-10 text-xs px-1 py-0.5 rounded outline-none text-center"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
            </div>
          </div>

          <div className="flex-1 flex items-center gap-1 overflow-x-auto py-1">
            {frames.map((frame, i) => (
              <button
                key={frame.id}
                onClick={() => { setActiveFrame(i); setPlaying(false); }}
                className="shrink-0 w-12 h-12 rounded border flex items-center justify-center text-xs relative"
                style={{
                  background: activeFrame === i && !playing ? "var(--bg-hover)" : "var(--bg-card)",
                  borderColor: activeFrame === i && !playing ? "var(--accent)" : "var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button onClick={addFrame} style={btnStyle()} title="Add frame"><FilePlus className="w-4 h-4" /></button>
            <button onClick={duplicateFrame} style={btnStyle()} title="Duplicate frame"><Copy className="w-4 h-4" /></button>
            <button onClick={deleteFrame} style={btnStyle()} title="Delete frame"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
