export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface MenuPlacement {
  left: number;
  top: number;
  maxHeight: number;
}

export const MENU_MARGIN = 8;
const SUBMENU_OVERLAP = 4;
const NATIVE_TARGET_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

function placeOnAxis(start: number, length: number, viewport: number): number {
  const flipped = start + length > viewport - MENU_MARGIN ? start - length : start;
  return Math.max(MENU_MARGIN, Math.min(flipped, viewport - length - MENU_MARGIN));
}

function clampTop(top: number, height: number, viewportHeight: number): number {
  return Math.max(MENU_MARGIN, Math.min(top, viewportHeight - height - MENU_MARGIN));
}

export function positionMenu(anchor: Point, size: Size, viewport: Size): MenuPlacement {
  return {
    left: placeOnAxis(anchor.x, size.width, viewport.width),
    top: placeOnAxis(anchor.y, size.height, viewport.height),
    maxHeight: viewport.height - 2 * MENU_MARGIN,
  };
}

export function positionSubmenu(
  parent: { left: number; right: number; top: number },
  size: Size,
  viewport: Size,
): MenuPlacement {
  const preferred = parent.right - SUBMENU_OVERLAP;
  const fits = preferred + size.width <= viewport.width - MENU_MARGIN;
  const left = fits ? preferred : parent.left - size.width + SUBMENU_OVERLAP;
  return {
    left: Math.max(MENU_MARGIN, Math.min(left, viewport.width - size.width - MENU_MARGIN)),
    top: clampTop(parent.top, size.height, viewport.height),
    maxHeight: viewport.height - 2 * MENU_MARGIN,
  };
}

export function nextEnabledIndex(
  disabled: boolean[],
  current: number,
  key: "ArrowDown" | "ArrowUp" | "Home" | "End",
): number {
  const count = disabled.length;
  const forward = key === "ArrowDown" || key === "Home";
  const start = key === "Home" ? -1 : key === "End" ? count : current;
  const step = forward ? 1 : -1;
  for (let offset = 1; offset <= count; offset++) {
    const index = (((start + step * offset) % count) + count) % count;
    if (!disabled[index]) return index;
  }
  return -1;
}

export function anchorPoint(
  event: { clientX: number; clientY: number; pointerType?: string },
  rect: { left: number; bottom: number },
): Point {
  const isKeyboard = (event.clientX === 0 && event.clientY === 0) || event.pointerType === "";
  return isKeyboard ? { x: rect.left, y: rect.bottom } : { x: event.clientX, y: event.clientY };
}

export function shouldUseNativeMenu(target: { closest(selector: string): unknown } | null, selectedText: string): boolean {
  if (selectedText.length > 0) return true;
  return target !== null && Boolean(target.closest(NATIVE_TARGET_SELECTOR));
}

export function contextMenuDecision(input: {
  isNativeTarget: boolean;
  lastPointerType: string | null;
}): "native" | "ignore" | "open" {
  if (input.isNativeTarget) return "native";
  if (input.lastPointerType === "touch" || input.lastPointerType === "pen") return "ignore";
  return "open";
}
