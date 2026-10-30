"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Plus,
  Trash2,
  Save,
  Download,
  MousePointer,
  Link2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Square,
  Circle,
  Diamond,
  Hexagon,
  StickyNote,
  ChevronDown,
  FileText,
  ArrowRight,
  GitBranch,
  Check,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { v4 as uuid } from "uuid";
import { storage } from "@/lib/storage";
import type { Diagram, DiagramNode, DiagramEdge, AssetRef } from "@/types";
import { useOpenParam } from "@/hooks/useStorage";
import { LinkedAssets } from "@/components/LinkedAssets";
import { ASSET_KINDS, ASSET_TYPES, assetHref, getAsset, listAssets } from "@/lib/assets";

// Literal colors: these are also used on the canvas, which can't resolve CSS variables.
const NODE_COLORS: Record<DiagramNode["type"], string> = {
  state: "#60a5fa",
  action: "#34d399",
  condition: "#fbbf24",
  event: "#f472b6",
  note: "#666680",
  custom: "#7c5cfc",
};

function nodeAsset(node: DiagramNode): AssetRef | undefined {
  const a = node.data?.asset as AssetRef | undefined;
  return a && typeof a.id === "string" && typeof a.type === "string" ? a : undefined;
}

const NODE_LABELS: Record<DiagramNode["type"], string> = {
  state: "State",
  action: "Action",
  condition: "Condition",
  event: "Event",
  note: "Note",
  custom: "Custom",
};

const NODE_ICONS: Record<DiagramNode["type"], typeof Square> = {
  state: Circle,
  action: Square,
  condition: Diamond,
  event: Hexagon,
  note: StickyNote,
  custom: Square,
};

function makeExampleDiagram(projectId: string): Diagram {
  const idIdle = uuid();
  const idWalk = uuid();
  const idJump = uuid();
  const idLand = uuid();
  return {
    id: uuid(),
    projectId,
    name: "Player State Machine (Example)",
    nodes: [
      { id: idIdle, type: "state", x: 120, y: 200, width: 140, height: 56, label: "Idle" },
      { id: idWalk, type: "action", x: 360, y: 100, width: 140, height: 56, label: "Walking" },
      { id: idJump, type: "event", x: 360, y: 300, width: 140, height: 56, label: "Jumping" },
      { id: idLand, type: "condition", x: 600, y: 200, width: 140, height: 56, label: "On Ground?" },
    ],
    edges: [
      { id: uuid(), from: idIdle, to: idWalk, label: "Move key", type: "arrow" },
      { id: uuid(), from: idIdle, to: idJump, label: "Space", type: "arrow" },
      { id: uuid(), from: idWalk, to: idIdle, label: "Stop", type: "dashed" },
      { id: uuid(), from: idJump, to: idLand, label: "", type: "arrow" },
      { id: uuid(), from: idLand, to: idIdle, label: "Yes", type: "arrow" },
      { id: uuid(), from: idLand, to: idJump, label: "No", type: "dashed" },
    ],
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

type Mode = "select" | "connect";

export default function DiagramsPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [diagrams, setDiagrams] = useState<Diagram[]>([]);
  const [current, setCurrent] = useState<Diagram | null>(null);
  const [showList, setShowList] = useState(true);

  const [mode, setMode] = useState<Mode>("select");
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ nodeId: string; offX: number; offY: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showNodeMenu, setShowNodeMenu] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const stateRef = useRef({ pan, zoom, current, dragging, panning, mode, connectFrom, selectedNodeId, selectedEdgeId });
  stateRef.current = { pan, zoom, current, dragging, panning, mode, connectFrom, selectedNodeId, selectedEdgeId };

  useEffect(() => {
    const all = storage.getAll("diagrams", projectId);
    setDiagrams(all);
    if (all.length > 0) {
      setCurrent(all[0]);
      setShowList(false);
    }
    setLoaded(true);
  }, [projectId]);

  useOpenParam((id) => {
    const d = storage.getById("diagrams", id, projectId);
    if (d) loadDiagram(d);
  }, loaded);

  // --- Drawing ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { current: diagram } = stateRef.current;
    const { pan: p, zoom: z, selectedNodeId: selNode, selectedEdgeId: selEdge, connectFrom: cf } = stateRef.current;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Grid
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(z, z);
    const gridSize = 30;
    const startX = Math.floor(-p.x / z / gridSize) * gridSize - gridSize;
    const startY = Math.floor(-p.y / z / gridSize) * gridSize - gridSize;
    const endX = startX + rect.width / z + gridSize * 2;
    const endY = startY + rect.height / z + gridSize * 2;
    ctx.strokeStyle = "#1a1a28";
    ctx.lineWidth = 0.5;
    for (let x = startX; x < endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
    for (let y = startY; y < endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }

    if (!diagram) {
      ctx.restore();
      return;
    }

    // Edges
    for (const edge of diagram.edges) {
      const fromNode = diagram.nodes.find((n) => n.id === edge.from);
      const toNode = diagram.nodes.find((n) => n.id === edge.to);
      if (!fromNode || !toNode) continue;

      const fx = fromNode.x + fromNode.width / 2;
      const fy = fromNode.y + fromNode.height / 2;
      const tx = toNode.x + toNode.width / 2;
      const ty = toNode.y + toNode.height / 2;

      const isSel = edge.id === selEdge;
      ctx.strokeStyle = isSel ? "#ffffff" : "#555570";
      ctx.lineWidth = isSel ? 2.5 : 1.5;

      if (edge.type === "dashed") {
        ctx.setLineDash([6, 4]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead
      if (edge.type !== "line") {
        const angle = Math.atan2(ty - fy, tx - fx);
        const headLen = 12;
        // clip arrow to node boundary
        const dx = tx - fx;
        const dy = ty - fy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const clipDist = Math.max(0, dist - toNode.width / 2 - 4);
        const cx2 = fx + (dx / dist) * clipDist;
        const cy2 = fy + (dy / dist) * clipDist;
        ctx.fillStyle = isSel ? "#ffffff" : "#555570";
        ctx.beginPath();
        ctx.moveTo(cx2, cy2);
        ctx.lineTo(cx2 - headLen * Math.cos(angle - 0.4), cy2 - headLen * Math.sin(angle - 0.4));
        ctx.lineTo(cx2 - headLen * Math.cos(angle + 0.4), cy2 - headLen * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fill();
      }

      // Edge label
      if (edge.label) {
        const mx = (fx + tx) / 2;
        const my = (fy + ty) / 2;
        ctx.font = "11px system-ui, sans-serif";
        const m = ctx.measureText(edge.label);
        ctx.fillStyle = "#12121a";
        ctx.fillRect(mx - m.width / 2 - 4, my - 8, m.width + 8, 16);
        ctx.fillStyle = "#aaaacc";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(edge.label, mx, my);
      }
    }

    // Connect-mode line
    if (cf) {
      const fromN = diagram.nodes.find((n) => n.id === cf);
      if (fromN && (window as unknown as { __mouseCanvas?: { x: number; y: number } }).__mouseCanvas) {
        const mc = (window as unknown as { __mouseCanvas: { x: number; y: number } }).__mouseCanvas;
        ctx.strokeStyle = "#7c5cfc";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(fromN.x + fromN.width / 2, fromN.y + fromN.height / 2);
        ctx.lineTo(mc.x, mc.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Nodes
    for (const node of diagram.nodes) {
      const isSel = node.id === selNode;
      const col = NODE_COLORS[node.type] || "#7c5cfc";
      const isConnSrc = node.id === cf;

      ctx.save();
      // Shadow
      ctx.shadowColor = isSel ? col : "rgba(0,0,0,0.3)";
      ctx.shadowBlur = isSel ? 12 : 6;
      ctx.shadowOffsetY = 2;

      // Shape
      ctx.fillStyle = "#16161f";
      ctx.strokeStyle = isConnSrc ? "#ffffff" : col;
      ctx.lineWidth = isSel ? 2.5 : 1.5;

      if (node.type === "condition") {
        // Diamond
        const cx = node.x + node.width / 2;
        const cy = node.y + node.height / 2;
        ctx.beginPath();
        ctx.moveTo(cx, node.y - 4);
        ctx.lineTo(node.x + node.width + 4, cy);
        ctx.lineTo(cx, node.y + node.height + 4);
        ctx.lineTo(node.x - 4, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (node.type === "event") {
        // Hexagon
        const cx = node.x + node.width / 2;
        const cy = node.y + node.height / 2;
        const hw = node.width / 2;
        const hh = node.height / 2;
        const inset = 16;
        ctx.beginPath();
        ctx.moveTo(node.x + inset, node.y);
        ctx.lineTo(node.x + node.width - inset, node.y);
        ctx.lineTo(node.x + node.width, cy);
        ctx.lineTo(node.x + node.width - inset, node.y + node.height);
        ctx.lineTo(node.x + inset, node.y + node.height);
        ctx.lineTo(node.x, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (node.type === "note") {
        const fold = 12;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y);
        ctx.lineTo(node.x + node.width - fold, node.y);
        ctx.lineTo(node.x + node.width, node.y + fold);
        ctx.lineTo(node.x + node.width, node.y + node.height);
        ctx.lineTo(node.x, node.y + node.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // fold triangle
        ctx.beginPath();
        ctx.moveTo(node.x + node.width - fold, node.y);
        ctx.lineTo(node.x + node.width - fold, node.y + fold);
        ctx.lineTo(node.x + node.width, node.y + fold);
        ctx.strokeStyle = isConnSrc ? "#ffffff" : col;
        ctx.stroke();
      } else {
        // State or Action — rounded rect vs sharp
        const r = node.type === "state" ? 12 : 4;
        ctx.beginPath();
        ctx.roundRect(node.x, node.y, node.width, node.height, r);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();

      // Label
      ctx.fillStyle = "#f0f0f5";
      ctx.font = "13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.label, node.x + node.width / 2, node.y + node.height / 2, node.width - 12);

      // Linked-asset badge
      const linked = nodeAsset(node);
      if (linked) {
        const bx = node.x + node.width - 2;
        const by = node.y + 2;
        ctx.fillStyle = ASSET_KINDS[linked.type]?.color ?? "#7c5cfc";
        ctx.beginPath();
        ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0a0a0f";
        ctx.font = "bold 9px system-ui, sans-serif";
        ctx.fillText("↗", bx, by + 0.5);
      }

      // Connection handles
      if (isSel || isConnSrc) {
        const hSize = 5;
        const positions = [
          { x: node.x + node.width / 2, y: node.y },
          { x: node.x + node.width, y: node.y + node.height / 2 },
          { x: node.x + node.width / 2, y: node.y + node.height },
          { x: node.x, y: node.y + node.height / 2 },
        ];
        for (const pos of positions) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, hSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();

    // Zoom indicator
    ctx.fillStyle = "#1e1e2a";
    ctx.fillRect(rect.width - 80, rect.height - 32, 70, 24);
    ctx.fillStyle = "#8888a0";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(z * 100)}%`, rect.width - 45, rect.height - 20);
  }, []);

  // Animation loop
  useEffect(() => {
    let raf: number;
    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [draw]);

  // --- Helpers ---
  function screenToCanvas(sx: number, sy: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (sx - rect.left - pan.x) / zoom,
      y: (sy - rect.top - pan.y) / zoom,
    };
  }

  function hitTestNode(cx: number, cy: number): DiagramNode | null {
    if (!current) return null;
    for (let i = current.nodes.length - 1; i >= 0; i--) {
      const n = current.nodes[i];
      if (cx >= n.x && cx <= n.x + n.width && cy >= n.y && cy <= n.y + n.height) {
        return n;
      }
    }
    return null;
  }

  function hitTestEdge(cx: number, cy: number): DiagramEdge | null {
    if (!current) return null;
    for (const edge of current.edges) {
      const fromNode = current.nodes.find((n) => n.id === edge.from);
      const toNode = current.nodes.find((n) => n.id === edge.to);
      if (!fromNode || !toNode) continue;
      const fx = fromNode.x + fromNode.width / 2;
      const fy = fromNode.y + fromNode.height / 2;
      const tx = toNode.x + toNode.width / 2;
      const ty = toNode.y + toNode.height / 2;
      const dist = pointToSegDist(cx, cy, fx, fy, tx, ty);
      if (dist < 8) return edge;
    }
    return null;
  }

  function pointToSegDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function updateCurrent(fn: (d: Diagram) => Diagram) {
    setCurrent((prev) => {
      if (!prev) return prev;
      const next = fn({ ...prev, updatedAt: new Date().toISOString() });
      return next;
    });
  }

  // --- Mouse handlers ---
  function handleMouseDown(e: React.MouseEvent) {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    (window as unknown as { __mouseCanvas: { x: number; y: number } }).__mouseCanvas = { x, y };

    if (mode === "connect") {
      const node = hitTestNode(x, y);
      if (node) {
        if (!connectFrom) {
          setConnectFrom(node.id);
        } else if (connectFrom !== node.id) {
          updateCurrent((d) => ({
            ...d,
            edges: [...d.edges, { id: uuid(), from: connectFrom!, to: node.id, label: "", type: "arrow" }],
          }));
          setConnectFrom(null);
        }
      } else {
        setConnectFrom(null);
      }
      return;
    }

    const node = hitTestNode(x, y);
    if (node) {
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
      setDragging({ nodeId: node.id, offX: x - node.x, offY: y - node.y });
      return;
    }

    const edge = hitTestEdge(x, y);
    if (edge) {
      setSelectedEdgeId(edge.id);
      setSelectedNodeId(null);
      return;
    }

    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    // Pan
    setPanning({ startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    (window as unknown as { __mouseCanvas: { x: number; y: number } }).__mouseCanvas = { x, y };

    if (dragging && current) {
      updateCurrent((d) => ({
        ...d,
        nodes: d.nodes.map((n) =>
          n.id === dragging.nodeId ? { ...n, x: x - dragging.offX, y: y - dragging.offY } : n
        ),
      }));
    } else if (panning) {
      setPan({
        x: panning.panX + (e.clientX - panning.startX),
        y: panning.panY + (e.clientY - panning.startY),
      });
    }
  }

  function handleMouseUp() {
    setDragging(null);
    setPanning(null);
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(3, zoom * delta));
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setPan({
        x: mx - ((mx - pan.x) / zoom) * newZoom,
        y: my - ((my - pan.y) / zoom) * newZoom,
      });
    }
    setZoom(newZoom);
  }

  function handleDoubleClick(e: React.MouseEvent) {
    const { x, y } = screenToCanvas(e.clientX, e.clientY);
    const node = hitTestNode(x, y);
    if (node) {
      setEditingNodeId(node.id);
      setEditingEdgeId(null);
      setEditText(node.label);
      return;
    }
    const edge = hitTestEdge(x, y);
    if (edge) {
      setEditingEdgeId(edge.id);
      setEditingNodeId(null);
      setEditText(edge.label || "");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (editingNodeId || editingEdgeId) return;
    if ((e.target as HTMLElement).closest("input, select, textarea")) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectedNodeId) {
        updateCurrent((d) => ({
          ...d,
          nodes: d.nodes.filter((n) => n.id !== selectedNodeId),
          edges: d.edges.filter((edge) => edge.from !== selectedNodeId && edge.to !== selectedNodeId),
        }));
        setSelectedNodeId(null);
      }
      if (selectedEdgeId) {
        updateCurrent((d) => ({
          ...d,
          edges: d.edges.filter((edge) => edge.id !== selectedEdgeId),
        }));
        setSelectedEdgeId(null);
      }
    }
    if (e.key === "Escape") {
      setConnectFrom(null);
      setMode("select");
    }
  }

  function commitEdit() {
    if (editingNodeId) {
      updateCurrent((d) => ({
        ...d,
        nodes: d.nodes.map((n) => (n.id === editingNodeId ? { ...n, label: editText } : n)),
      }));
      setEditingNodeId(null);
    }
    if (editingEdgeId) {
      updateCurrent((d) => ({
        ...d,
        edges: d.edges.map((edge) => (edge.id === editingEdgeId ? { ...edge, label: editText } : edge)),
      }));
      setEditingEdgeId(null);
    }
  }

  // --- Actions ---
  function addNode(type: DiagramNode["type"]) {
    const cx = (-pan.x + (containerRef.current?.clientWidth || 600) / 2) / zoom;
    const cy = (-pan.y + (containerRef.current?.clientHeight || 400) / 2) / zoom;
    const node: DiagramNode = {
      id: uuid(),
      type,
      x: cx - 70,
      y: cy - 28,
      width: 140,
      height: 56,
      label: NODE_LABELS[type],
    };
    updateCurrent((d) => ({ ...d, nodes: [...d.nodes, node] }));
    setSelectedNodeId(node.id);
    setShowNodeMenu(false);
  }

  function saveDiagram() {
    if (!current) return;
    const saved = { ...current, updatedAt: new Date().toISOString() };
    storage.save("diagrams", saved, projectId);
    setCurrent(saved);
    setDiagrams(storage.getAll("diagrams", projectId));
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  function setNodeAsset(nodeId: string, value: string) {
    updateCurrent((d) => ({
      ...d,
      nodes: d.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const data = { ...(n.data ?? {}) };
        if (value) {
          const [type, ...rest] = value.split(":");
          data.asset = { type, id: rest.join(":") };
        } else {
          delete data.asset;
        }
        return { ...n, data };
      }),
    }));
  }

  function loadDiagram(d: Diagram) {
    setCurrent(d);
    setShowList(false);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }

  function newDiagram() {
    const d: Diagram = {
      id: uuid(),
      projectId,
      name: "Untitled Diagram",
      nodes: [],
      edges: [],
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCurrent(d);
    setShowList(false);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }

  function createExample() {
    const ex = makeExampleDiagram(projectId);
    storage.save("diagrams", ex, projectId);
    setDiagrams(storage.getAll("diagrams", projectId));
    loadDiagram(ex);
  }

  function deleteDiagram(id: string) {
    storage.delete("diagrams", id, projectId);
    const all = storage.getAll("diagrams", projectId);
    setDiagrams(all);
    if (current?.id === id) {
      setCurrent(all[0] || null);
      if (all.length === 0) setShowList(true);
    }
  }

  function toggleEdgeType() {
    if (!selectedEdgeId) return;
    updateCurrent((d) => ({
      ...d,
      edges: d.edges.map((edge) => {
        if (edge.id !== selectedEdgeId) return edge;
        const types: DiagramEdge["type"][] = ["arrow", "dashed", "line"];
        const idx = types.indexOf(edge.type);
        return { ...edge, type: types[(idx + 1) % types.length] };
      }),
    }));
  }

  function exportPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${current?.name || "diagram"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // --- List view ---
  if (showList) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Diagrams
          </h1>
          <div className="flex gap-2">
            <button
              onClick={createExample}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
              style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              <FileText className="w-4 h-4" />
              Load Example
            </button>
            <button
              onClick={newDiagram}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--accent)", color: "white" }}
            >
              <Plus className="w-4 h-4" />
              New Diagram
            </button>
          </div>
        </div>
        {diagrams.length === 0 ? (
          <div className="text-center py-20 rounded-xl border border-dashed" style={{ borderColor: "var(--border)" }}>
            <GitBranch className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <p className="text-lg font-medium mb-2" style={{ color: "var(--text-primary)" }}>
              No diagrams yet
            </p>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
              Plan your game logic with flow charts and state machines
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={createExample}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                Load Example
              </button>
              <button
                onClick={newDiagram}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--accent)", color: "white" }}
              >
                New Diagram
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {diagrams.map((d) => (
              <div
                key={d.id}
                className="group flex items-center justify-between p-4 rounded-xl border transition-colors cursor-pointer"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
                onClick={() => loadDiagram(d)}
                onMouseOver={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; }}
                onMouseOut={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                <div>
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{d.name}</span>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {d.nodes.length} nodes · {d.edges.length} edges
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteDiagram(d.id); }}
                  className="p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "var(--red)" }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const selectedNode = current?.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedAsset = selectedNode ? nodeAsset(selectedNode) : undefined;
  const projectAssets = selectedNode ? listAssets(projectId) : [];

  // --- Editor view ---
  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Top toolbar */}
      <div
        className="flex items-center justify-between px-3 h-12 border-b shrink-0"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowList(true)}
            className="px-2 py-1 rounded text-xs"
            style={{ color: "var(--text-secondary)" }}
          >
            ← Back
          </button>
          <input
            className="bg-transparent text-sm font-medium outline-none px-2 py-1 rounded"
            style={{ color: "var(--text-primary)" }}
            value={current?.name || ""}
            onChange={(e) => updateCurrent((d) => ({ ...d, name: e.target.value }))}
          />
          {current && (
            <div className="ml-2 hidden md:block">
              <LinkedAssets
                projectId={projectId}
                type="diagram"
                id={diagrams.some((d) => d.id === current.id) ? current.id : null}
                layout="row"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setMode("select"); setConnectFrom(null); }}
            className="p-1.5 rounded text-xs"
            style={{
              background: mode === "select" ? "var(--bg-hover)" : "transparent",
              color: mode === "select" ? "var(--text-primary)" : "var(--text-secondary)",
            }}
            title="Select & Move (Esc)"
          >
            <MousePointer className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMode("connect")}
            className="p-1.5 rounded text-xs"
            style={{
              background: mode === "connect" ? "var(--bg-hover)" : "transparent",
              color: mode === "connect" ? "var(--text-primary)" : "var(--text-secondary)",
            }}
            title="Connect nodes"
          >
            <Link2 className="w-4 h-4" />
          </button>

          <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />

          {/* Add node dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNodeMenu(!showNodeMenu)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs"
              style={{ background: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Node
              <ChevronDown className="w-3 h-3" />
            </button>
            {showNodeMenu && (
              <div
                className="absolute top-full left-0 mt-1 py-1 rounded-lg border z-20 w-40"
                style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
              >
                {(["state", "action", "condition", "event", "note"] as DiagramNode["type"][]).map((t) => {
                  const Icon = NODE_ICONS[t];
                  return (
                    <button
                      key={t}
                      onClick={() => addNode(t)}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--bg-hover)]"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <Icon className="w-4 h-4" style={{ color: NODE_COLORS[t] }} />
                      {NODE_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedEdgeId && (
            <button
              onClick={toggleEdgeType}
              className="px-2 py-1 rounded text-xs"
              style={{ color: "var(--text-secondary)", background: "var(--bg-card)", border: "1px solid var(--border)" }}
              title="Toggle edge type"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />

          <button onClick={() => setZoom((z) => Math.min(3, z * 1.2))} className="p-1.5 rounded" style={{ color: "var(--text-secondary)" }} title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => setZoom((z) => Math.max(0.2, z / 1.2))} className="p-1.5 rounded" style={{ color: "var(--text-secondary)" }} title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-1.5 rounded" style={{ color: "var(--text-secondary)" }} title="Reset view">
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="w-px h-5 mx-1" style={{ background: "var(--border)" }} />

          <button onClick={saveDiagram} className="flex items-center gap-1 p-1.5 rounded text-xs" style={{ color: "var(--green)" }} title="Save">
            {savedFlash ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {savedFlash && "Saved"}
          </button>
          <button onClick={exportPng} className="p-1.5 rounded" style={{ color: "var(--text-secondary)" }} title="Export PNG">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full outline-none"
          style={{ cursor: mode === "connect" ? "crosshair" : dragging ? "grabbing" : panning ? "grabbing" : "default" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
        />

        {/* Inline text editor overlay */}
        {(editingNodeId || editingEdgeId) && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/40" onClick={commitEdit}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="p-4 rounded-xl border"
              style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
            >
              <input
                autoFocus
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") { setEditingNodeId(null); setEditingEdgeId(null); } }}
                className="px-3 py-2 rounded-lg text-sm outline-none w-60"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              />
              <div className="flex justify-end mt-2 gap-2">
                <button onClick={() => { setEditingNodeId(null); setEditingEdgeId(null); }} className="px-3 py-1 rounded text-xs" style={{ color: "var(--text-secondary)" }}>Cancel</button>
                <button onClick={commitEdit} className="px-3 py-1 rounded text-xs" style={{ background: "var(--accent)", color: "white" }}>OK</button>
              </div>
            </div>
          </div>
        )}

        {/* Selected node: linked asset */}
        {selectedNode && (
          <div
            className="absolute top-3 right-3 z-10 w-64 p-3 rounded-xl border space-y-2"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
              {NODE_LABELS[selectedNode.type]}: {selectedNode.label}
            </div>
            <label className="block text-xs" style={{ color: "var(--text-secondary)" }}>
              Linked asset
              <select
                value={selectedAsset ? `${selectedAsset.type}:${selectedAsset.id}` : ""}
                onChange={(e) => setNodeAsset(selectedNode.id, e.target.value)}
                className="mt-1 w-full px-2 py-1 rounded text-xs outline-none"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                <option value="">None</option>
                {ASSET_TYPES.map((t) => {
                  const group = projectAssets.filter((a) => a.type === t);
                  if (!group.length) return null;
                  return (
                    <optgroup key={t} label={ASSET_KINDS[t].label}>
                      {group.map((a) => (
                        <option key={a.id} value={`${a.type}:${a.id}`}>
                          {a.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
            </label>
            {selectedAsset && (
              <Link
                href={assetHref(projectId, selectedAsset.type, selectedAsset.id)}
                className="flex items-center gap-1 text-xs hover:underline"
                style={{ color: "var(--accent)" }}
              >
                <ExternalLink className="w-3 h-3" />
                Open {getAsset(projectId, selectedAsset.type, selectedAsset.id)?.name ?? "asset"}
              </Link>
            )}
          </div>
        )}

        {/* Mode hint */}
        {mode === "connect" && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg text-xs"
            style={{ background: "var(--bg-card)", color: "var(--accent)", border: "1px solid var(--accent)" }}
          >
            {connectFrom ? "Click a target node to connect" : "Click a source node to start connection"} · Esc to cancel
          </div>
        )}
      </div>
    </div>
  );
}
