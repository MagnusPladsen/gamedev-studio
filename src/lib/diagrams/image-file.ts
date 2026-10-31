const MAX_SIDE = 1600;
const KEEP_AS_IS_BYTES = 400 * 1024;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export interface CardImage {
  src: string;
  aspect: number;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

function decode(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file is not an image this browser can show"));
    img.src = src;
  });
}

/**
 * Reads a picture for an image card. Small files and GIFs (to keep animation) are stored as they are;
 * big photos are scaled down so the diagram stays light enough for browser storage and sync.
 */
export async function readImageFile(file: File): Promise<CardImage> {
  if (!file.type.startsWith("image/")) throw new Error("Only image files can go on an image card");
  if (file.size > MAX_FILE_BYTES) throw new Error("That image is bigger than 25 MB");
  const original = await readAsDataUrl(file);
  const img = await decode(original);
  const aspect = img.naturalWidth / img.naturalHeight || 1;
  const isSmall = file.size <= KEEP_AS_IS_BYTES && Math.max(img.naturalWidth, img.naturalHeight) <= MAX_SIDE;
  if (isSmall || file.type === "image/gif" || file.type === "image/svg+xml") return { src: original, aspect };

  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  const webp = canvas.toDataURL("image/webp", 0.85);
  const src = webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
  return { src: src.length < original.length ? src : original, aspect };
}

export function imageFilesFrom(data: DataTransfer | null): File[] {
  return data ? Array.from(data.files).filter((file) => file.type.startsWith("image/")) : [];
}
