import { DEFAULT_GRID_SIZE, GRID_SIZES, type Vec3 } from "./grid";
import { FALLBACK_COLORS } from "./colors";

function nearestGridSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_GRID_SIZE;
  return GRID_SIZES.reduce((best, size) => (Math.abs(size - value) < Math.abs(best - value) ? size : best));
}

/** A stored model's size with every axis snapped to an allowed grid size, so a corrupt value can't crash the editor. */
export function sanitizeSize(size: unknown): Vec3 {
  const axes: unknown[] = Array.isArray(size) ? size : [];
  return [nearestGridSize(axes[0]), nearestGridSize(axes[1]), nearestGridSize(axes[2])];
}

/** A stored model's colours, or the fallback palette when the stored value isn't a list of strings. */
export function sanitizeColors(colors: unknown): string[] {
  const isValid = Array.isArray(colors) && colors.every((color) => typeof color === "string");
  return isValid ? colors : FALLBACK_COLORS;
}
