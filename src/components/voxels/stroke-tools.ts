import { inBounds, type Vec3, type VoxelGrid } from "@/lib/voxels/grid";
import { boxCells, mirrorCells, paintCells, setCells, type Symmetry } from "@/lib/voxels/edit";
import type { RayHit } from "@/lib/voxels/raycast";
import type { VoxelTool } from "./types";

/** A box being drawn: a rectangle on the plane of `normal`, then `height` layers deep. */
export interface BoxDraft {
  start: Vec3;
  end: Vec3;
  normal: Vec3;
  isErase: boolean;
  height: number;
}

export function getNormalAxis(normal: Vec3): number {
  return Math.max(0, normal.findIndex((component) => component !== 0));
}

/** The cell a tool acts on: the empty cell in front of the face for adding, the voxel itself otherwise. */
export function getTargetCell(hit: RayHit, isAdding: boolean): Vec3 {
  return isAdding ? hit.place : (hit.cell ?? hit.place);
}

export function applyBrush(grid: VoxelGrid, tool: VoxelTool, cell: Vec3, value: number, symmetry: Symmetry): VoxelGrid {
  const cells = mirrorCells([cell], grid.size, symmetry);
  if (tool === "add") return setCells(grid, cells, value);
  if (tool === "erase") return setCells(grid, cells, 0);
  if (tool === "paint") return paintCells(grid, cells, value);
  return grid;
}

export function startBoxDraft(hit: RayHit, isErase: boolean): BoxDraft {
  const start = getTargetCell(hit, !isErase);
  return { start, end: start, normal: hit.normal, isErase, height: 1 };
}

/** Moves the far corner of the rectangle, kept on the plane it started on. */
export function moveBoxDraft(draft: BoxDraft, hit: RayHit): BoxDraft {
  const axis = getNormalAxis(draft.normal);
  const end: Vec3 = [...getTargetCell(hit, !draft.isErase)];
  end[axis] = draft.start[axis];
  return { ...draft, end };
}

function getExtrudeStep(draft: BoxDraft): number {
  const axis = getNormalAxis(draft.normal);
  const outward = Math.sign(draft.normal[axis]) || 1;
  return draft.isErase ? -outward : outward;
}

export function getMaxBoxHeight(draft: BoxDraft, size: Vec3): number {
  const axis = getNormalAxis(draft.normal);
  const base = draft.start[axis];
  const room = getExtrudeStep(draft) > 0 ? size[axis] - base : base + 1;
  return Math.max(1, room);
}

export function getBoxCorners(draft: BoxDraft): [Vec3, Vec3] {
  const axis = getNormalAxis(draft.normal);
  const far: Vec3 = [...draft.end];
  far[axis] = draft.start[axis] + getExtrudeStep(draft) * (draft.height - 1);
  return [draft.start, far];
}

function isOnShell(cell: Vec3, low: Vec3, high: Vec3): boolean {
  return cell.some((component, axis) => component === low[axis] || component === high[axis]);
}

/** Only the outer cells of the box, so a large box stays cheap to preview. */
export function getBoxShellCells(draft: BoxDraft, size: Vec3): Vec3[] {
  const [a, b] = getBoxCorners(draft);
  const low = a.map((component, axis) => Math.max(0, Math.min(component, b[axis]))) as Vec3;
  const high = a.map((component, axis) => Math.min(size[axis] - 1, Math.max(component, b[axis]))) as Vec3;
  const cells: Vec3[] = [];
  for (let z = low[2]; z <= high[2]; z++) {
    for (let y = low[1]; y <= high[1]; y++) {
      for (let x = low[0]; x <= high[0]; x++) {
        const cell: Vec3 = [x, y, z];
        if (isOnShell(cell, low, high)) cells.push(cell);
      }
    }
  }
  return cells;
}

export function applyBox(grid: VoxelGrid, draft: BoxDraft, value: number, symmetry: Symmetry): VoxelGrid {
  const [a, b] = getBoxCorners(draft);
  const cells = mirrorCells(boxCells(a, b), grid.size, symmetry);
  return setCells(grid, cells, draft.isErase ? 0 : value);
}

export function mirrorInBounds(cells: Vec3[], size: Vec3, symmetry: Symmetry): Vec3[] {
  const inside = cells.filter((cell) => inBounds(size, ...cell));
  return mirrorCells(inside, size, symmetry);
}
