import type { VoxelGrid } from "./grid";

export const MAX_COLORS = 255;

export const FALLBACK_COLORS: string[] = [
  "#1b1f2a",
  "#cfefff",
  "#8fd3ff",
  "#f4f7ff",
  "#7ac74f",
  "#4f9d3a",
  "#2f6b2e",
  "#a9744f",
  "#6b4430",
  "#8b8f98",
  "#3a8fd9",
  "#235a9c",
  "#f6c445",
];

function parseHex(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1, 7), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function squaredDistance(a: [number, number, number], b: [number, number, number]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

export function nearestColorValue(colors: string[], hex: string): number {
  const target = parseHex(hex);
  let bestValue = 1;
  let bestDistance = Infinity;
  colors.forEach((color, index) => {
    const distance = squaredDistance(parseHex(color), target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestValue = index + 1;
    }
  });
  return bestValue;
}

export function addColor(colors: string[], hex: string): { colors: string[]; value: number } {
  const existing = colors.findIndex((color) => color.toLowerCase() === hex.toLowerCase());
  if (existing >= 0) return { colors, value: existing + 1 };
  if (colors.length < MAX_COLORS) return { colors: [...colors, hex], value: colors.length + 1 };
  return { colors, value: nearestColorValue(colors, hex) };
}

export function remapToPalette(
  grid: VoxelGrid,
  from: string[],
  to: string[],
): { grid: VoxelGrid; colors: string[] } {
  const colors = to.slice(0, MAX_COLORS);
  const valueMap = from.map((color) => nearestColorValue(colors, color));
  const data = grid.data.map((value) => (value === 0 ? 0 : valueMap[value - 1]));
  return { grid: { size: grid.size, data }, colors };
}
