import type { Diagram, DiagramEdge, DiagramNode } from "@/types";
import {
  borderColor,
  checklistItems,
  hostname,
  imageSrc,
  isFlowShape,
  linkPreview,
  linkUrl,
} from "./cards";
import { embedFor } from "./embeds";
import { boundsOf, edgeEndpoints, edgeLabelPos, type Rect } from "./geometry";

export interface AssetLook {
  name: string;
  kind: string;
  color: string;
  thumbnail?: string;
}

interface RenderInput {
  diagram: Diagram;
  rectOf(node: DiagramNode): Rect;
  describeAsset(node: DiagramNode): AssetLook | null;
}

const PAD = 40;
const SCALE = 2;
const MAX_SIDE = 8000;
const CARD_BG = "#16161f";
const TEXT = "#f0f0f5";
const MUTED = "#8888a0";
const FONT = "system-ui, sans-serif";

function loadForCanvas(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (!src.startsWith("data:")) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function imageSources(input: RenderInput): string[] {
  return input.diagram.nodes.flatMap((node) => {
    if (node.type === "image") return [imageSrc(node) ?? ""];
    if (node.type === "link") {
      const url = linkUrl(node);
      return [linkPreview(node).image ?? (url ? embedFor(url)?.thumbnail : undefined) ?? ""];
    }
    if (node.type === "asset") return [input.describeAsset(node)?.thumbnail ?? ""];
    return [];
  }).filter(Boolean);
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

function drawLines(ctx: CanvasRenderingContext2D, lines: string[], x: number, y: number, lineHeight: number, maxY: number) {
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  for (const line of lines) {
    if (y + lineHeight > maxY + 2) break;
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function tint(color: string | undefined, alpha: string): string {
  return color ? `${color}${alpha}` : CARD_BG;
}

function cardBox(ctx: CanvasRenderingContext2D, rect: Rect, node: DiagramNode, radius = 10) {
  ctx.fillStyle = CARD_BG;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
  ctx.fill();
  if (node.color) {
    ctx.fillStyle = tint(node.color, "26");
    ctx.fill();
  }
  ctx.strokeStyle = node.color ?? "#2e2e40";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, rect: Rect, radius: number) {
  const scale = Math.max(rect.width / img.naturalWidth, rect.height / img.naturalHeight);
  const width = img.naturalWidth * scale;
  const height = img.naturalHeight * scale;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radius);
  ctx.clip();
  ctx.drawImage(img, rect.x + (rect.width - width) / 2, rect.y + (rect.height - height) / 2, width, height);
  ctx.restore();
}

function shapePath(ctx: CanvasRenderingContext2D, node: DiagramNode, r: Rect) {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  ctx.beginPath();
  if (node.type === "condition") {
    ctx.moveTo(cx, r.y - 4);
    ctx.lineTo(r.x + r.width + 4, cy);
    ctx.lineTo(cx, r.y + r.height + 4);
    ctx.lineTo(r.x - 4, cy);
    ctx.closePath();
  } else if (node.type === "event") {
    const inset = 16;
    ctx.moveTo(r.x + inset, r.y);
    ctx.lineTo(r.x + r.width - inset, r.y);
    ctx.lineTo(r.x + r.width, cy);
    ctx.lineTo(r.x + r.width - inset, r.y + r.height);
    ctx.lineTo(r.x + inset, r.y + r.height);
    ctx.lineTo(r.x, cy);
    ctx.closePath();
  } else {
    ctx.roundRect(r.x, r.y, r.width, r.height, node.type === "state" ? 12 : 4);
  }
}

function drawShape(ctx: CanvasRenderingContext2D, node: DiagramNode, r: Rect) {
  shapePath(ctx, node, r);
  ctx.fillStyle = CARD_BG;
  ctx.fill();
  ctx.strokeStyle = borderColor(node);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = TEXT;
  ctx.font = `13px ${FONT}`;
  const lines = wrapText(ctx, node.label, r.width - 20).slice(0, 3);
  const lineHeight = 16;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const top = r.y + r.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, r.x + r.width / 2, top + i * lineHeight));
}

function drawGroup(ctx: CanvasRenderingContext2D, node: DiagramNode, r: Rect) {
  const color = node.color ?? "#666680";
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.width, r.height, 14);
  ctx.fillStyle = `${color}1a`;
  ctx.fill();
  ctx.strokeStyle = `${color}80`;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = TEXT;
  ctx.font = `600 14px ${FONT}`;
  drawLines(ctx, [node.label], r.x + 16, r.y + 13, 18, r.y + r.height);
}

function drawNote(ctx: CanvasRenderingContext2D, node: DiagramNode, r: Rect) {
  cardBox(ctx, r, node);
  ctx.fillStyle = TEXT;
  ctx.font = `14px ${FONT}`;
  drawLines(ctx, wrapText(ctx, node.label, r.width - 28), r.x + 14, r.y + 12, 20, r.y + r.height - 8);
}

function drawChecklist(ctx: CanvasRenderingContext2D, node: DiagramNode, r: Rect) {
  cardBox(ctx, r, node);
  ctx.fillStyle = TEXT;
  ctx.font = `600 14px ${FONT}`;
  let y = drawLines(ctx, [node.label || "To-do"], r.x + 14, r.y + 12, 22, r.y + r.height);
  ctx.font = `13px ${FONT}`;
  for (const item of checklistItems(node)) {
    if (y + 20 > r.y + r.height) break;
    ctx.strokeStyle = item.done ? "#4ade80" : MUTED;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(r.x + 14, y + 2, 12, 12);
    if (item.done) {
      ctx.fillStyle = "#4ade80";
      ctx.fillRect(r.x + 17, y + 5, 6, 6);
    }
    ctx.fillStyle = item.done ? MUTED : TEXT;
    y = drawLines(ctx, wrapText(ctx, item.text, r.width - 50), r.x + 34, y, 18, r.y + r.height) + 4;
  }
}

function drawImageCard(ctx: CanvasRenderingContext2D, node: DiagramNode, r: Rect, images: Map<string, HTMLImageElement | null>) {
  cardBox(ctx, r, node, 8);
  const src = imageSrc(node);
  const img = src ? images.get(src) : null;
  const aspect = typeof node.data?.aspect === "number" ? node.data.aspect : 4 / 3;
  const imageRect = { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, r.width / aspect) };
  if (img) drawCover(ctx, img, imageRect, 8);
  if (node.label) {
    ctx.fillStyle = TEXT;
    ctx.font = `13px ${FONT}`;
    drawLines(ctx, wrapText(ctx, node.label, r.width - 24), r.x + 12, imageRect.y + imageRect.height + 8, 18, r.y + r.height);
  }
}

function drawLink(ctx: CanvasRenderingContext2D, node: DiagramNode, r: Rect, images: Map<string, HTMLImageElement | null>) {
  cardBox(ctx, r, node);
  const url = linkUrl(node) ?? "";
  const preview = linkPreview(node);
  const embed = url ? embedFor(url) : null;
  const thumb = preview.image ?? embed?.thumbnail;
  const img = thumb ? images.get(thumb) : null;
  let y = r.y + 12;
  if (thumb || embed) {
    // Same 16:9 media area as on screen; a thumbnail the host won't share stays a dark panel.
    const media = { x: r.x, y: r.y, width: r.width, height: Math.min(r.width / (16 / 9), r.height - 60) };
    ctx.fillStyle = "#0a0a0f";
    ctx.beginPath();
    ctx.roundRect(media.x, media.y, media.width, media.height, [10, 10, 0, 0]);
    ctx.fill();
    if (img) drawCover(ctx, img, media, 10);
    y = r.y + media.height + 10;
  }
  ctx.fillStyle = TEXT;
  ctx.font = `600 13px ${FONT}`;
  y = drawLines(ctx, wrapText(ctx, preview.title || node.label || url, r.width - 28).slice(0, 2), r.x + 14, y, 18, r.y + r.height);
  ctx.fillStyle = MUTED;
  ctx.font = `12px ${FONT}`;
  drawLines(ctx, [preview.siteName || hostname(url)], r.x + 14, y + 2, 16, r.y + r.height);
}

function drawAssetCard(ctx: CanvasRenderingContext2D, node: DiagramNode, r: Rect, look: AssetLook | null, images: Map<string, HTMLImageElement | null>) {
  cardBox(ctx, r, node);
  ctx.fillStyle = look?.color ?? MUTED;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, 5, r.height, [10, 0, 0, 10]);
  ctx.fill();
  const img = look?.thumbnail ? images.get(look.thumbnail) : null;
  let x = r.x + 16;
  if (img) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x, r.y + (r.height - 36) / 2, 36, 36);
    ctx.imageSmoothingEnabled = true;
    x += 46;
  }
  ctx.fillStyle = look?.color ?? MUTED;
  ctx.font = `11px ${FONT}`;
  drawLines(ctx, [look?.kind ?? "Deleted asset"], x, r.y + 14, 14, r.y + r.height);
  ctx.fillStyle = TEXT;
  ctx.font = `600 14px ${FONT}`;
  drawLines(ctx, [look?.name ?? node.label], x, r.y + 30, 18, r.y + r.height);
}

function drawEdge(ctx: CanvasRenderingContext2D, edge: DiagramEdge, from: Rect, to: Rect) {
  const { start, end } = edgeEndpoints(from, to);
  ctx.strokeStyle = "#555570";
  ctx.fillStyle = "#555570";
  ctx.lineWidth = 1.5;
  ctx.setLineDash(edge.type === "dashed" ? [6, 4] : []);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);
  if (edge.type !== "line") {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - 12 * Math.cos(angle - 0.4), end.y - 12 * Math.sin(angle - 0.4));
    ctx.lineTo(end.x - 12 * Math.cos(angle + 0.4), end.y - 12 * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
  }
  if (!edge.label) return;
  const pos = edgeLabelPos(start, end);
  ctx.font = `11px ${FONT}`;
  const width = ctx.measureText(edge.label).width + 12;
  ctx.fillStyle = "#14141d";
  ctx.strokeStyle = "#2e2e40";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(pos.x - width / 2, pos.y - 9, width, 18, 9);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#c4c4dc";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(edge.label, pos.x, pos.y + 0.5);
}

function drawNode(ctx: CanvasRenderingContext2D, node: DiagramNode, input: RenderInput, images: Map<string, HTMLImageElement | null>) {
  const rect = input.rectOf(node);
  if (isFlowShape(node.type)) drawShape(ctx, node, rect);
  else if (node.type === "note") drawNote(ctx, node, rect);
  else if (node.type === "checklist") drawChecklist(ctx, node, rect);
  else if (node.type === "image") drawImageCard(ctx, node, rect, images);
  else if (node.type === "link") drawLink(ctx, node, rect, images);
  else if (node.type === "asset") drawAssetCard(ctx, node, rect, input.describeAsset(node), images);
}

/** Draws the whole board, cropped to its cards, onto a canvas for a PNG download. */
export async function renderDiagramPng(input: RenderInput): Promise<HTMLCanvasElement> {
  const { diagram } = input;
  const bounds = boundsOf(diagram.nodes.map(input.rectOf)) ?? { x: 0, y: 0, width: 400, height: 300 };
  const width = bounds.width + PAD * 2;
  const height = bounds.height + PAD * 2;
  const scale = Math.min(SCALE, MAX_SIDE / width, MAX_SIDE / height);
  const sources = [...new Set(imageSources(input))];
  const images = new Map(await Promise.all(sources.map(async (src) => [src, await loadForCanvas(src)] as const)));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(0, 0, width, height);
  ctx.translate(PAD - bounds.x, PAD - bounds.y);

  const byId = new Map(diagram.nodes.map((node) => [node.id, node]));
  for (const node of diagram.nodes) if (node.type === "group") drawGroup(ctx, node, input.rectOf(node));
  for (const edge of diagram.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (from && to) drawEdge(ctx, edge, input.rectOf(from), input.rectOf(to));
  }
  for (const node of diagram.nodes) if (node.type !== "group") drawNode(ctx, node, input, images);
  return canvas;
}
