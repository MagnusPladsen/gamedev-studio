"use client";

import { useRef, useState } from "react";
import type { DiagramEdge, DiagramNode } from "@/types";
import { borderPoint, edgeEndpoints, edgeLabelPos, type Point, type Rect } from "@/lib/diagrams/geometry";

interface EdgeLayerProps {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  rectOf(node: DiagramNode): Rect;
  selectedEdgeId: string | null;
  editingEdgeId: string | null;
  draft: { fromId: string; to: Point } | null;
  onLabelCommit(edgeId: string, label: string): void;
  onLabelCancel(): void;
}

const LINE = "#555570";
const SELECTED = "#ffffff";

function Arrowhead({ id, color }: { id: string; color: string }) {
  return (
    <marker id={id} viewBox="0 0 12 10" refX="11" refY="5" markerWidth="12" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
      <path d="M0,0 L12,5 L0,10 Z" fill={color} />
    </marker>
  );
}

function EdgeLabel({ label, at, isSelected }: { label: string; at: Point; isSelected: boolean }) {
  const width = label.length * 6.2 + 14;
  return (
    <g style={{ pointerEvents: "all" }}>
      <rect x={at.x - width / 2} y={at.y - 9} width={width} height={18} rx={9} fill="#14141d" stroke={isSelected ? SELECTED : "#2e2e40"} />
      <text x={at.x} y={at.y + 0.5} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#c4c4dc" fontFamily="system-ui, sans-serif">
        {label}
      </text>
    </g>
  );
}

function LabelEditor({ edge, at, onCommit, onCancel }: { edge: DiagramEdge; at: Point; onCommit(label: string): void; onCancel(): void }) {
  const [text, setText] = useState(edge.label ?? "");
  const isCancelled = useRef(false);
  return (
    <input
      data-card-control=""
      autoFocus
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => (isCancelled.current ? onCancel() : onCommit(text))}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          isCancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      placeholder="Label"
      aria-label="Line label"
      className="absolute px-2 py-0.5 rounded-full text-xs outline-none w-36 -translate-x-1/2 -translate-y-1/2"
      style={{ left: at.x, top: at.y, background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--accent)" }}
    />
  );
}

/** Lines between cards, drawn under the cards. Each line has a wide invisible stroke for easy clicking. */
export function EdgeLayer({ nodes, edges, rectOf, selectedEdgeId, editingEdgeId, draft, onLabelCommit, onLabelCancel }: EdgeLayerProps) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const lines = edges.flatMap((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) return [];
    const { start, end } = edgeEndpoints(rectOf(from), rectOf(to));
    return [{ edge, start, end, labelAt: edgeLabelPos(start, end) }];
  });
  const draftFrom = draft ? byId.get(draft.fromId) : undefined;
  const draftStart = draftFrom && draft ? borderPoint(rectOf(draftFrom), draft.to) : null;
  const editing = lines.find((line) => line.edge.id === editingEdgeId);

  return (
    <>
      <svg className="absolute left-0 top-0 overflow-visible pointer-events-none" width="1" height="1" aria-hidden>
        <defs>
          <Arrowhead id="diagram-arrow" color={LINE} />
          <Arrowhead id="diagram-arrow-selected" color={SELECTED} />
        </defs>
        {lines.map(({ edge, start, end, labelAt }) => {
          const isSelected = edge.id === selectedEdgeId;
          const color = isSelected ? SELECTED : LINE;
          return (
            <g key={edge.id} data-edge-id={edge.id} style={{ cursor: "pointer" }}>
              <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="transparent" strokeWidth={14} style={{ pointerEvents: "stroke" }} />
              <line
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke={color}
                strokeWidth={isSelected ? 2.5 : 1.5}
                strokeDasharray={edge.type === "dashed" ? "6 4" : undefined}
                markerEnd={edge.type === "line" ? undefined : `url(#${isSelected ? "diagram-arrow-selected" : "diagram-arrow"})`}
              />
              {edge.label && edge.id !== editingEdgeId && <EdgeLabel label={edge.label} at={labelAt} isSelected={isSelected} />}
            </g>
          );
        })}
        {draftStart && draft && (
          <line x1={draftStart.x} y1={draftStart.y} x2={draft.to.x} y2={draft.to.y} stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 4" />
        )}
      </svg>
      {editing && (
        <LabelEditor
          key={editing.edge.id}
          edge={editing.edge}
          at={editing.labelAt}
          onCommit={(label) => onLabelCommit(editing.edge.id, label)}
          onCancel={onLabelCancel}
        />
      )}
    </>
  );
}
