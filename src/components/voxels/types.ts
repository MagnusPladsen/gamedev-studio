import type { RayHit } from "@/lib/voxels/raycast";

export type VoxelTool = "add" | "erase" | "paint" | "pick" | "fill" | "box";

export type ViewPreset = "reset" | "front" | "side" | "top";

export interface StrokeEvent {
  phase: "start" | "move" | "end" | "cancel";
  hit: RayHit | null;
  shiftKey: boolean;
}
