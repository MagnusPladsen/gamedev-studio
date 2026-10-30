"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useHistory } from "@/hooks/useHistory";
import { UndoRedoButtons } from "@/components/UndoRedoButtons";
import { useParams } from "next/navigation";
import {
  Plus,
  Trash2,
  Play,
  Save,
  Download,
  ChevronLeft,
  MessageSquare,
  Circle,
  Diamond,
  Hexagon,
  Square,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { v4 as uuid } from "uuid";
import { storage } from "@/lib/storage";
import type { DialogueTree, DialogueNode } from "@/types";
import { useOpenParam } from "@/hooks/useStorage";
import { LinkedAssets } from "@/components/LinkedAssets";

type NodeType = DialogueNode["type"];

const NODE_COLORS: Record<NodeType, string> = {
  start: "var(--green)",
  dialogue: "var(--accent)",
  choice: "var(--yellow, #fbbf24)",
  condition: "var(--pink, #f472b6)",
  action: "var(--blue, #60a5fa)",
  end: "var(--red)",
};

const NODE_LABELS: Record<NodeType, string> = {
  start: "Start",
  dialogue: "Dialogue",
  choice: "Choice",
  condition: "Condition",
  action: "Action",
  end: "End",
};

function makeExampleTree(projectId: string): DialogueTree {
  const startId = uuid();
  const greetId = uuid();
  const choiceId = uuid();
  const friendlyId = uuid();
  const rudeId = uuid();
  const endFriendlyId = uuid();
  const endRudeId = uuid();

  return {
    id: uuid(),
    projectId,
    name: "Example NPC Conversation",
    nodes: [
      { id: startId, type: "start", x: 80, y: 200, nextId: greetId },
      {
        id: greetId,
        type: "dialogue",
        x: 280,
        y: 180,
        speaker: "Merchant",
        text: "Welcome, traveler! Looking for supplies?",
        nextId: choiceId,
      },
      {
        id: choiceId,
        type: "choice",
        x: 560,
        y: 160,
        text: "Player responds:",
        choices: [
          { text: "Yes, show me what you have!", targetId: friendlyId },
          { text: "No, get out of my way.", targetId: rudeId },
        ],
      },
      {
        id: friendlyId,
        type: "dialogue",
        x: 840,
        y: 80,
        speaker: "Merchant",
        text: "Wonderful! Take a look at my finest wares.",
        nextId: endFriendlyId,
      },
      {
        id: rudeId,
        type: "dialogue",
        x: 840,
        y: 300,
        speaker: "Merchant",
        text: "Hmph! Fine, but you'll regret it when you need potions!",
        nextId: endRudeId,
      },
      { id: endFriendlyId, type: "end", x: 1100, y: 80 },
      { id: endRudeId, type: "end", x: 1100, y: 300 },
    ],
    tags: ["example"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function getNodeWidth(node: DialogueNode): number {
  if (node.type === "start" || node.type === "end") return 60;
  if (node.type === "condition") return 140;
  return 200;
}

function getNodeHeight(node: DialogueNode): number {
  if (node.type === "start" || node.type === "end") return 60;
  if (node.type === "choice") return 80 + (node.choices?.length || 1) * 28;
  if (node.type === "condition") return 80;
  return 90;
}

function getOutputPoint(
  node: DialogueNode,
  choiceIdx?: number
): { x: number; y: number } {
  const w = getNodeWidth(node);
  const h = getNodeHeight(node);
  if (node.type === "start" || node.type === "end") {
    return { x: node.x + w, y: node.y + h / 2 };
  }
  if (node.type === "choice" && choiceIdx !== undefined) {
    const yOff = 52 + choiceIdx * 28 + 10;
    return { x: node.x + w, y: node.y + yOff };
  }
  return { x: node.x + w, y: node.y + h / 2 };
}

function getInputPoint(node: DialogueNode): { x: number; y: number } {
  const h = getNodeHeight(node);
  if (node.type === "start" || node.type === "end") {
    return { x: node.x, y: node.y + h / 2 };
  }
  return { x: node.x, y: node.y + h / 2 };
}

function bezierPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  const dx = Math.abs(x2 - x1) * 0.5;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export default function DialoguePage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const [trees, setTrees] = useState<DialogueTree[]>([]);
  const [activeTree, setActiveTree] = useState<DialogueTree | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<{
    fromId: string;
    choiceIdx?: number;
    mx: number;
    my: number;
  } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [preview, setPreview] = useState<{
    currentId: string;
    history: string[];
  } | null>(null);
  const [editingNode, setEditingNode] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const flashTimer = useRef<number | null>(null);
  const [characters, setCharacters] = useState<string[]>([]);

  useEffect(() => {
    setTrees(storage.getAll("dialogues", projectId));
    setCharacters(
      storage
        .getAll("stories", projectId)
        .filter((s) => s.type === "character")
        .map((s) => s.title)
    );
    setLoaded(true);
  }, [projectId]);

  useOpenParam((id) => {
    const tree = storage.getById("dialogues", id, projectId);
    if (tree) {
      setActiveTree(tree);
      setSelectedNode(null);
      setEditingNode(null);
      setPreview(null);
    }
  }, loaded);

  const saveTree = useCallback(
    (tree: DialogueTree) => {
      const updated = { ...tree, updatedAt: new Date().toISOString() };
      storage.save("dialogues", updated, projectId);
      setActiveTree(updated);
      setTrees(storage.getAll("dialogues", projectId));
      setSavedFlash(true);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setSavedFlash(false), 1500);
    },
    [projectId]
  );

  // Undo history tracks content only; a node drag counts once, when released.
  const content = useMemo(
    () => (activeTree ? { name: activeTree.name, nodes: activeTree.nodes } : null),
    [activeTree?.name, activeTree?.nodes] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const [stableContent, setStableContent] = useState(content);
  if (!draggingNode && stableContent !== content) setStableContent(content);
  const history = useHistory(
    draggingNode ? stableContent : content,
    (v) => {
      if (!v || !activeTree) return;
      saveTree({ ...activeTree, ...v });
      setSelectedNode(null);
      setEditingNode(null);
    },
    activeTree?.id
  );

  function createTree() {
    const tree: DialogueTree = {
      id: uuid(),
      projectId,
      name: "New Dialogue",
      nodes: [{ id: uuid(), type: "start", x: 100, y: 200 }],
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    storage.save("dialogues", tree, projectId);
    setTrees(storage.getAll("dialogues", projectId));
    setActiveTree(tree);
  }

  function loadExample() {
    const tree = makeExampleTree(projectId);
    storage.save("dialogues", tree, projectId);
    setTrees(storage.getAll("dialogues", projectId));
    setActiveTree(tree);
  }

  function deleteTree(id: string) {
    storage.delete("dialogues", id, projectId);
    setTrees(storage.getAll("dialogues", projectId));
    if (activeTree?.id === id) setActiveTree(null);
  }

  function addNode(type: NodeType) {
    if (!activeTree) return;
    const node: DialogueNode = {
      id: uuid(),
      type,
      x: (-pan.x + 300) / zoom,
      y: (-pan.y + 200) / zoom,
      speaker: type === "dialogue" ? "Speaker" : undefined,
      text:
        type === "dialogue"
          ? "Enter dialogue text..."
          : type === "choice"
          ? "Choose:"
          : type === "condition"
          ? "condition"
          : type === "action"
          ? "do_action"
          : undefined,
      choices:
        type === "choice"
          ? [
              { text: "Option 1", targetId: "" },
              { text: "Option 2", targetId: "" },
            ]
          : undefined,
    };
    saveTree({ ...activeTree, nodes: [...activeTree.nodes, node] });
  }

  function deleteNode(id: string) {
    if (!activeTree) return;
    const nodes = activeTree.nodes
      .filter((n) => n.id !== id)
      .map((n) => {
        const updated = { ...n };
        if (updated.nextId === id) updated.nextId = undefined;
        if (updated.choices) {
          updated.choices = updated.choices.map((c) =>
            c.targetId === id ? { ...c, targetId: "" } : c
          );
        }
        return updated;
      });
    saveTree({ ...activeTree, nodes });
    if (selectedNode === id) setSelectedNode(null);
    if (editingNode === id) setEditingNode(null);
  }

  function updateNode(id: string, patch: Partial<DialogueNode>, persist = true) {
    if (!activeTree) return;
    const nodes = activeTree.nodes.map((n) =>
      n.id === id ? { ...n, ...patch } : n
    );
    if (persist) saveTree({ ...activeTree, nodes });
    else setActiveTree({ ...activeTree, nodes });
  }

  function clientToCanvas(cx: number, cy: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: cx, y: cy };
    return {
      x: (cx - rect.left - pan.x) / zoom,
      y: (cy - rect.top - pan.y) / zoom,
    };
  }

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === "svg") {
      setSelectedNode(null);
      setEditingNode(null);
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }

  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
    if (draggingNode && activeTree) {
      const pt = clientToCanvas(e.clientX, e.clientY);
      // Move locally while dragging; persisted once on mouse up.
      updateNode(
        draggingNode,
        { x: pt.x - dragOffset.x, y: pt.y - dragOffset.y },
        false
      );
    }
    if (connecting) {
      setConnecting({ ...connecting, mx: e.clientX, my: e.clientY });
    }
  }

  function handleCanvasMouseUp(e: React.MouseEvent) {
    setIsPanning(false);
    if (draggingNode && activeTree) saveTree(activeTree);
    setDraggingNode(null);
    if (connecting && activeTree) {
      const pt = clientToCanvas(e.clientX, e.clientY);
      const target = activeTree.nodes.find((n) => {
        const ip = getInputPoint(n);
        const dist = Math.sqrt((pt.x - ip.x) ** 2 + (pt.y - ip.y) ** 2);
        return dist < 30;
      });
      if (target && target.id !== connecting.fromId) {
        const fromNode = activeTree.nodes.find(
          (n) => n.id === connecting.fromId
        );
        if (fromNode) {
          if (
            fromNode.type === "choice" &&
            connecting.choiceIdx !== undefined
          ) {
            const choices = [...(fromNode.choices || [])];
            choices[connecting.choiceIdx] = {
              ...choices[connecting.choiceIdx],
              targetId: target.id,
            };
            updateNode(fromNode.id, { choices });
          } else {
            updateNode(fromNode.id, { nextId: target.id });
          }
        }
      }
      setConnecting(null);
    }
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const newZoom = Math.min(
      Math.max(zoom - e.deltaY * 0.001, 0.25),
      3
    );
    setZoom(newZoom);
  }

  function exportTree() {
    if (!activeTree) return;
    const blob = new Blob([JSON.stringify(activeTree, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTree.name}.dialogue.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function startPreview() {
    if (!activeTree) return;
    const startNode = activeTree.nodes.find((n) => n.type === "start");
    if (!startNode) return;
    const firstId = startNode.nextId;
    if (firstId) {
      setPreview({ currentId: firstId, history: [] });
    }
  }

  function previewAdvance(nextId?: string) {
    if (!preview || !nextId) {
      setPreview(null);
      return;
    }
    setPreview({
      currentId: nextId,
      history: [...preview.history, preview.currentId],
    });
  }

  // Render connections
  function renderEdges() {
    if (!activeTree) return null;
    const edges: React.ReactNode[] = [];

    for (const node of activeTree.nodes) {
      if (node.type === "choice" && node.choices) {
        for (let i = 0; i < node.choices.length; i++) {
          const c = node.choices[i];
          if (!c.targetId) continue;
          const target = activeTree.nodes.find((n) => n.id === c.targetId);
          if (!target) continue;
          const from = getOutputPoint(node, i);
          const to = getInputPoint(target);
          edges.push(
            <path
              key={`${node.id}-c${i}`}
              d={bezierPath(from.x, from.y, to.x, to.y)}
              stroke={NODE_COLORS.choice}
              strokeWidth={2}
              fill="none"
              opacity={0.6}
            />
          );
        }
      } else if (node.nextId) {
        const target = activeTree.nodes.find((n) => n.id === node.nextId);
        if (!target) continue;
        const from = getOutputPoint(node);
        const to = getInputPoint(target);
        edges.push(
          <path
            key={`${node.id}-next`}
            d={bezierPath(from.x, from.y, to.x, to.y)}
            stroke={NODE_COLORS[node.type]}
            strokeWidth={2}
            fill="none"
            opacity={0.6}
          />
        );
      }
    }

    if (connecting) {
      const fromNode = activeTree.nodes.find(
        (n) => n.id === connecting.fromId
      );
      if (fromNode) {
        const from = getOutputPoint(fromNode, connecting.choiceIdx);
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const mx = (connecting.mx - rect.left - pan.x) / zoom;
          const my = (connecting.my - rect.top - pan.y) / zoom;
          edges.push(
            <path
              key="connecting"
              d={bezierPath(from.x, from.y, mx, my)}
              stroke="white"
              strokeWidth={2}
              fill="none"
              strokeDasharray="6 4"
              opacity={0.5}
            />
          );
        }
      }
    }

    return edges;
  }

  function renderNodeShape(node: DialogueNode) {
    const w = getNodeWidth(node);
    const h = getNodeHeight(node);
    const color = NODE_COLORS[node.type];
    const isSelected = selectedNode === node.id;
    const borderCol = isSelected ? "white" : color;

    if (node.type === "start" || node.type === "end") {
      return (
        <div
          style={{
            width: w,
            height: h,
            borderRadius: "50%",
            background: `${color}25`,
            border: `2px solid ${borderCol}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {node.type === "start" ? "START" : "END"}
        </div>
      );
    }

    if (node.type === "condition") {
      return (
        <div
          style={{
            width: w,
            height: h,
            background: `${color}15`,
            border: `2px solid ${borderCol}`,
            borderRadius: 8,
            transform: "rotate(0deg)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "8px",
            gap: 2,
          }}
        >
          <Diamond
            className="w-3.5 h-3.5"
            style={{ color, flexShrink: 0 }}
          />
          <span
            style={{
              color: "var(--text-primary)",
              fontSize: 11,
              textAlign: "center",
              wordBreak: "break-word",
            }}
          >
            {node.condition || node.text || "if..."}
          </span>
        </div>
      );
    }

    return (
      <div
        style={{
          width: w,
          minHeight: h,
          background: `${color}10`,
          border: `2px solid ${borderCol}`,
          borderRadius: 10,
          padding: "8px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {node.type === "dialogue" && (
          <>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {node.speaker || "Speaker"}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-primary)",
                lineHeight: 1.3,
                wordBreak: "break-word",
              }}
            >
              {node.text || "..."}
            </div>
          </>
        )}
        {node.type === "choice" && (
          <>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Choice
            </div>
            {node.choices?.map((c, i) => (
              <div
                key={i}
                style={{
                  fontSize: 11,
                  color: "var(--text-primary)",
                  padding: "3px 6px",
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.05)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span style={{ flex: 1, wordBreak: "break-word" }}>
                  {c.text}
                </span>
                <div
                  className="output-handle"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: color,
                    cursor: "crosshair",
                    flexShrink: 0,
                    marginLeft: 4,
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setConnecting({
                      fromId: node.id,
                      choiceIdx: i,
                      mx: e.clientX,
                      my: e.clientY,
                    });
                  }}
                />
              </div>
            ))}
          </>
        )}
        {node.type === "action" && (
          <>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Action
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-primary)",
                wordBreak: "break-word",
              }}
            >
              {node.text || "action"}
            </div>
          </>
        )}
      </div>
    );
  }

  // ============ Main render ============

  // LIST VIEW
  if (!activeTree) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              Dialogue Trees
            </h1>
            <p
              className="text-sm mt-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Create branching conversations for NPCs
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadExample}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              <Play className="w-4 h-4" />
              Load Example
            </button>
            <button
              onClick={createTree}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--accent)", color: "white" }}
            >
              <Plus className="w-4 h-4" />
              New Dialogue
            </button>
          </div>
        </div>

        {trees.length === 0 ? (
          <div
            className="text-center py-20 rounded-xl border border-dashed"
            style={{ borderColor: "var(--border)" }}
          >
            <MessageSquare
              className="w-12 h-12 mx-auto mb-4"
              style={{ color: "var(--text-muted, #555570)" }}
            />
            <p
              className="text-lg font-medium mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              No dialogues yet
            </p>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--text-secondary)" }}
            >
              Create a dialogue tree or load the example
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {trees.map((t) => (
              <div
                key={t.id}
                className="group flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors"
                style={{
                  background: "var(--bg-card)",
                  borderColor: "var(--border)",
                }}
                onClick={() => setActiveTree(t)}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-hover)";
                  e.currentTarget.style.background = "var(--bg-hover)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.background = "var(--bg-card)";
                }}
              >
                <div>
                  <h3
                    className="font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {t.name}
                  </h3>
                  <p
                    className="text-xs mt-1"
                    style={{ color: "var(--text-muted, #555570)" }}
                  >
                    {t.nodes.length} nodes &middot; Updated{" "}
                    {new Date(t.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTree(t.id);
                  }}
                  className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
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

  // EDITOR VIEW
  const currentPreviewNode = preview
    ? activeTree.nodes.find((n) => n.id === preview.currentId)
    : null;

  return (
    <div className="flex flex-col h-screen">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 h-12 border-b shrink-0"
        style={{
          background: "var(--bg-secondary)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTree(null);
              setSelectedNode(null);
              setEditingNode(null);
              setPreview(null);
            }}
            className="p-1.5 rounded-lg"
            style={{ color: "var(--text-secondary)" }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <UndoRedoButtons history={history} />
          <input
            className="bg-transparent text-sm font-medium outline-none w-48"
            style={{ color: "var(--text-primary)" }}
            value={activeTree.name}
            onChange={(e) =>
              saveTree({ ...activeTree, name: e.target.value })
            }
          />
          <span
            className="text-xs transition-opacity"
            style={{ color: "var(--green)", opacity: savedFlash ? 1 : 0 }}
          >
            Saved
          </span>
          <div className="hidden lg:block">
            <LinkedAssets projectId={projectId} type="dialogue" id={activeTree.id} layout="row" />
          </div>
        </div>

        <div className="flex items-center gap-1">
          {(
            ["start", "dialogue", "choice", "condition", "action", "end"] as NodeType[]
          ).map((type) => (
            <button
              key={type}
              onClick={() => addNode(type)}
              className="px-2 py-1 rounded text-xs font-medium"
              style={{
                background: `${NODE_COLORS[type]}20`,
                color: NODE_COLORS[type],
                border: `1px solid ${NODE_COLORS[type]}40`,
              }}
              title={`Add ${NODE_LABELS[type]} node`}
            >
              {NODE_LABELS[type]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom(Math.min(zoom + 0.2, 3))}
            className="p-1.5 rounded-lg"
            style={{ color: "var(--text-secondary)" }}
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(Math.max(zoom - 0.2, 0.25))}
            className="p-1.5 rounded-lg"
            style={{ color: "var(--text-secondary)" }}
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setPan({ x: 0, y: 0 });
              setZoom(1);
            }}
            className="p-1.5 rounded-lg"
            style={{ color: "var(--text-secondary)" }}
            title="Reset view"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <div
            className="w-px h-5 mx-1"
            style={{ background: "var(--border)" }}
          />
          <button
            onClick={startPreview}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{
              background: "var(--green)",
              color: "black",
            }}
            title="Preview dialogue"
          >
            <Play className="w-3 h-3" />
            Preview
          </button>
          <button
            onClick={exportTree}
            className="p-1.5 rounded-lg"
            style={{ color: "var(--text-secondary)" }}
            title="Export JSON"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden" style={{ background: "var(--bg-primary)" }}>
        <div
          ref={canvasRef}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={() => {
            setIsPanning(false);
            setDraggingNode(null);
            setConnecting(null);
          }}
          onWheel={handleWheel}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          >
            {/* Edges SVG */}
            <svg
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 4000,
                height: 4000,
                pointerEvents: "none",
              }}
            >
              {renderEdges()}
            </svg>

            {/* Nodes */}
            {activeTree.nodes.map((node) => (
              <div
                key={node.id}
                style={{
                  position: "absolute",
                  left: node.x,
                  top: node.y,
                  cursor: "move",
                  userSelect: "none",
                }}
                onMouseDown={(e) => {
                  if (
                    (e.target as HTMLElement).classList.contains(
                      "output-handle"
                    )
                  )
                    return;
                  e.stopPropagation();
                  setSelectedNode(node.id);
                  setDraggingNode(node.id);
                  const pt = clientToCanvas(e.clientX, e.clientY);
                  setDragOffset({
                    x: pt.x - node.x,
                    y: pt.y - node.y,
                  });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditingNode(node.id);
                }}
              >
                {renderNodeShape(node)}

                {/* Input handle */}
                {node.type !== "start" && (
                  <div
                    style={{
                      position: "absolute",
                      left: -6,
                      top: getNodeHeight(node) / 2 - 6,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: "var(--bg-primary)",
                      border: `2px solid ${NODE_COLORS[node.type]}`,
                      cursor: "crosshair",
                    }}
                  />
                )}

                {/* Output handle (non-choice) */}
                {node.type !== "end" && node.type !== "choice" && (
                  <div
                    className="output-handle"
                    style={{
                      position: "absolute",
                      right: -6,
                      top: getNodeHeight(node) / 2 - 6,
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: NODE_COLORS[node.type],
                      cursor: "crosshair",
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      setConnecting({
                        fromId: node.id,
                        mx: e.clientX,
                        my: e.clientY,
                      });
                    }}
                  />
                )}

                {/* Delete button on hover */}
                {selectedNode === node.id && node.type !== "start" && (
                  <button
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: "var(--red)",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 10,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNode(node.id);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Edit panel */}
        {editingNode && activeTree && (
          <EditPanel
            node={activeTree.nodes.find((n) => n.id === editingNode)!}
            onUpdate={(patch) => updateNode(editingNode, patch)}
            onClose={() => setEditingNode(null)}
            characters={characters}
          />
        )}

        {/* Preview overlay */}
        {preview && currentPreviewNode && (
          <div
            className="absolute bottom-6 left-1/2 -translate-x-1/2 w-96 max-w-[90vw] rounded-xl border p-5"
            style={{
              background: "var(--bg-card)",
              borderColor: "var(--accent)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-xs font-semibold uppercase"
                style={{ color: "var(--accent)" }}
              >
                Preview
              </span>
              <button
                onClick={() => setPreview(null)}
                style={{ color: "var(--text-secondary)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {currentPreviewNode.type === "end" ? (
              <div>
                <p
                  className="text-sm italic"
                  style={{ color: "var(--text-secondary)" }}
                >
                  — End of dialogue —
                </p>
                <button
                  onClick={() => setPreview(null)}
                  className="mt-3 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: "var(--accent)", color: "white" }}
                >
                  Close
                </button>
              </div>
            ) : currentPreviewNode.type === "dialogue" ? (
              <div>
                <div
                  className="text-xs font-bold mb-1"
                  style={{ color: "var(--green)" }}
                >
                  {currentPreviewNode.speaker}
                </div>
                <p
                  className="text-sm mb-3"
                  style={{ color: "var(--text-primary)" }}
                >
                  {currentPreviewNode.text}
                </p>
                <button
                  onClick={() =>
                    previewAdvance(currentPreviewNode.nextId)
                  }
                  className="px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: "var(--accent)", color: "white" }}
                >
                  Continue →
                </button>
              </div>
            ) : currentPreviewNode.type === "choice" ? (
              <div>
                <p
                  className="text-sm mb-3"
                  style={{ color: "var(--text-primary)" }}
                >
                  {currentPreviewNode.text}
                </p>
                <div className="space-y-1.5">
                  {currentPreviewNode.choices?.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => previewAdvance(c.targetId)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
                      style={{
                        background: "var(--bg-hover)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {c.text}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  [{currentPreviewNode.type}: {currentPreviewNode.text || currentPreviewNode.condition}]
                </p>
                <button
                  onClick={() =>
                    previewAdvance(currentPreviewNode.nextId)
                  }
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: "var(--accent)", color: "white" }}
                >
                  Continue →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EditPanel({
  node,
  onUpdate,
  onClose,
  characters,
}: {
  node: DialogueNode;
  onUpdate: (patch: Partial<DialogueNode>) => void;
  onClose: () => void;
  characters: string[];
}) {
  return (
    <div
      className="absolute top-2 right-2 w-72 rounded-xl border p-4 overflow-y-auto max-h-[80vh]"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-bold uppercase"
          style={{ color: NODE_COLORS[node.type] }}
        >
          Edit {NODE_LABELS[node.type]}
        </span>
        <button onClick={onClose} style={{ color: "var(--text-secondary)" }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {node.type === "dialogue" && (
        <>
          <label
            className="block text-xs mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Speaker
          </label>
          <input
            className="w-full px-2.5 py-1.5 rounded-lg text-sm mb-3 outline-none"
            style={{
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
            value={node.speaker || ""}
            onChange={(e) => onUpdate({ speaker: e.target.value })}
            list="dialogue-speakers"
            placeholder={characters.length ? "Pick a story character or type a name" : "Speaker name"}
          />
          <datalist id="dialogue-speakers">
            {characters.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <label
            className="block text-xs mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Text
          </label>
          <textarea
            className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none resize-none"
            style={{
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              minHeight: 60,
            }}
            value={node.text || ""}
            onChange={(e) => onUpdate({ text: e.target.value })}
          />
        </>
      )}

      {node.type === "choice" && (
        <>
          <label
            className="block text-xs mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Prompt
          </label>
          <input
            className="w-full px-2.5 py-1.5 rounded-lg text-sm mb-3 outline-none"
            style={{
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
            value={node.text || ""}
            onChange={(e) => onUpdate({ text: e.target.value })}
          />
          <label
            className="block text-xs mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            Choices
          </label>
          {node.choices?.map((c, i) => (
            <div key={i} className="flex gap-1 mb-1.5">
              <input
                className="flex-1 px-2 py-1 rounded text-xs outline-none"
                style={{
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
                value={c.text}
                onChange={(e) => {
                  const choices = [...(node.choices || [])];
                  choices[i] = { ...choices[i], text: e.target.value };
                  onUpdate({ choices });
                }}
              />
              <button
                onClick={() => {
                  const choices = (node.choices || []).filter(
                    (_, j) => j !== i
                  );
                  onUpdate({ choices });
                }}
                style={{ color: "var(--red)", fontSize: 12 }}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              onUpdate({
                choices: [
                  ...(node.choices || []),
                  { text: "New option", targetId: "" },
                ],
              })
            }
            className="text-xs mt-1"
            style={{ color: "var(--accent)" }}
          >
            + Add choice
          </button>
        </>
      )}

      {node.type === "condition" && (
        <>
          <label
            className="block text-xs mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Condition
          </label>
          <input
            className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none"
            style={{
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
            value={node.condition || node.text || ""}
            onChange={(e) =>
              onUpdate({ condition: e.target.value, text: e.target.value })
            }
          />
        </>
      )}

      {node.type === "action" && (
        <>
          <label
            className="block text-xs mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Action
          </label>
          <input
            className="w-full px-2.5 py-1.5 rounded-lg text-sm outline-none"
            style={{
              background: "var(--bg-primary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
            value={node.text || ""}
            onChange={(e) => onUpdate({ text: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
