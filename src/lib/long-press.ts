import type { Point } from "@/lib/menu-position";

export const LONG_PRESS_MS = 500;
export const LONG_PRESS_TOLERANCE_PX = 8;

export interface LongPress {
  down(point: Point & { pointerType: string }): void;
  move(point: Point): void;
  up(): void;
  cancel(): void;
  consumeClick(): boolean;
}

export function createLongPress(onLongPress: (point: Point) => void): LongPress {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let origin: Point | null = null;
  let hasFired = false;

  const cancel = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    origin = null;
  };

  return {
    down({ x, y, pointerType }) {
      cancel();
      hasFired = false;
      if (pointerType !== "touch" && pointerType !== "pen") return;
      origin = { x, y };
      timer = setTimeout(() => {
        timer = null;
        hasFired = true;
        onLongPress({ x, y });
      }, LONG_PRESS_MS);
    },
    move(point) {
      if (!origin) return;
      if (Math.hypot(point.x - origin.x, point.y - origin.y) > LONG_PRESS_TOLERANCE_PX) cancel();
    },
    up: cancel,
    cancel,
    consumeClick() {
      const wasFired = hasFired;
      hasFired = false;
      return wasFired;
    },
  };
}
