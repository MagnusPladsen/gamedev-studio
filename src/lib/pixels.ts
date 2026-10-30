import type { Sprite } from "@/types";

const images = new Map<string, HTMLImageElement>();

/** Load a data URL into a decoded image. Cached, so repeated calls are cheap. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = images.get(src);
  if (cached?.complete && cached.naturalWidth) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = cached ?? new window.Image();
    img.addEventListener("load", () => resolve(img), { once: true });
    img.addEventListener("error", () => reject(new Error("Could not decode image")), { once: true });
    if (!cached) {
      images.set(src, img);
      img.src = src;
    }
  });
}

/**
 * Returns the image if it is already decoded; otherwise starts loading it and calls
 * onReady when done so the caller can redraw. Use this inside synchronous canvas draws.
 */
export function getLoadedImage(src: string, onReady?: () => void): HTMLImageElement | null {
  const img = images.get(src);
  if (img?.complete && img.naturalWidth) return img;
  loadImage(src).then(() => onReady?.(), () => {});
  return null;
}

/** All images decoded? Useful before a one-shot export. */
export async function preloadImages(srcs: string[]): Promise<void> {
  await Promise.all(srcs.filter(Boolean).map((s) => loadImage(s).catch(() => null)));
}

export function spriteFrameSrc(sprite: Sprite, frame = 0): string | undefined {
  return sprite.frames[frame]?.pixels || sprite.frames[0]?.pixels;
}
