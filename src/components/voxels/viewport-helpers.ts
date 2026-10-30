import type { Vec3 } from "@/lib/voxels/grid";
import type { RayHit } from "@/lib/voxels/raycast";
import type { ViewPreset } from "./types";

export const CAMERA_FOV = 45;

const PRESET_DIRECTIONS: Record<ViewPreset, Vec3> = {
  reset: [0.9, 0.75, 1.2],
  front: [0, 0, 1],
  side: [1, 0, 0],
  top: [0, 1, 0.001],
};

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

export function getCameraTarget(size: Vec3): Vec3 {
  return [0, size[1] / 2, 0];
}

export function getFitDistance(size: Vec3): number {
  const radius = Math.hypot(size[0], size[1], size[2]) / 2;
  return (radius / Math.sin((CAMERA_FOV * Math.PI) / 360)) * 1.05;
}

export function getPresetPose(preset: ViewPreset, size: Vec3): CameraPose {
  const target = getCameraTarget(size);
  const direction = PRESET_DIRECTIONS[preset];
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  const distance = getFitDistance(size);
  const position = direction.map((component, axis) => target[axis] + (component / length) * distance) as Vec3;
  return { position, target };
}

export function worldToGrid(point: Vec3, size: Vec3): Vec3 {
  return [point[0] + size[0] / 2, point[1], point[2] + size[2] / 2];
}

export function cellCentreToWorld(cell: Vec3, size: Vec3): Vec3 {
  return [cell[0] + 0.5 - size[0] / 2, cell[1] + 0.5, cell[2] + 0.5 - size[2] / 2];
}

export function getHitKey(hit: RayHit | null): string {
  if (!hit) return "none";
  return `${hit.cell?.join(",") ?? "ground"}|${hit.place.join(",")}|${hit.normal.join(",")}`;
}
