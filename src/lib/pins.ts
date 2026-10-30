import type { AssetRef, ProjectPins } from "@/types";
import { getAsset, type AssetSummary } from "./assets";
import { storage } from "./storage";

const EMPTY_PINS: ProjectPins = { tools: [], assets: [] };
const ALWAYS_FIRST_TOOL = "assets";

export function getPins(projectId: string): ProjectPins {
  const pins = storage.getById("projects", projectId)?.pins;
  return { tools: pins?.tools ?? EMPTY_PINS.tools, assets: pins?.assets ?? EMPTY_PINS.assets };
}

function writePins(projectId: string, pins: ProjectPins): void {
  const project = storage.getById("projects", projectId);
  if (!project) return;
  storage.save("projects", { ...project, pins, updatedAt: new Date().toISOString() });
}

function sameAsset(a: AssetRef, b: AssetRef): boolean {
  return a.type === b.type && a.id === b.id;
}

export function isToolPinned(projectId: string, path: string): boolean {
  return getPins(projectId).tools.includes(path);
}

export function toggleToolPin(projectId: string, path: string): void {
  const pins = getPins(projectId);
  const tools = pins.tools.includes(path) ? pins.tools.filter((p) => p !== path) : [...pins.tools, path];
  writePins(projectId, { ...pins, tools });
}

export function orderTools<T extends { path: string }>(tools: T[], pinned: string[]): T[] {
  const first = tools.filter((t) => t.path === ALWAYS_FIRST_TOOL);
  const movable = tools.filter((t) => t.path !== ALWAYS_FIRST_TOOL);
  const pinnedTools = pinned.flatMap((path) => movable.filter((t) => t.path === path));
  const rest = movable.filter((t) => !pinned.includes(t.path));
  return [...first, ...pinnedTools, ...rest];
}

export function isAssetPinned(projectId: string, ref: AssetRef): boolean {
  return getPins(projectId).assets.some((a) => sameAsset(a, ref));
}

export function toggleAssetPin(projectId: string, ref: AssetRef): void {
  if (isAssetPinned(projectId, ref)) {
    removeAssetPin(projectId, ref);
    return;
  }
  const pins = getPins(projectId);
  writePins(projectId, { ...pins, assets: [...pins.assets, { type: ref.type, id: ref.id }] });
}

export function removeAssetPin(projectId: string, ref: AssetRef): void {
  if (!isAssetPinned(projectId, ref)) return;
  const pins = getPins(projectId);
  writePins(projectId, { ...pins, assets: pins.assets.filter((a) => !sameAsset(a, ref)) });
}

export function resolvePinnedAssets(projectId: string): AssetSummary[] {
  return getPins(projectId).assets.flatMap((ref) => getAsset(projectId, ref.type, ref.id) ?? []);
}
