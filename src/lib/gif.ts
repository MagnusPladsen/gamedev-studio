/**
 * Small animated-GIF encoder for pixel art (GIF89a, looping, LZW).
 * Pixel art rarely has more than a few dozen colours, so we build an exact palette;
 * if a sprite somehow has more than 255, colours are reduced by trimming low bits.
 */

export interface GifFrame {
  image: ImageData;
  /** How long the frame shows, in milliseconds (GIF stores 1/100 s, minimum 20 ms in browsers). */
  delay: number;
}

export interface GifOptions {
  /** Whole-number upscale with hard pixel edges, e.g. 8 turns 16×16 into 128×128. */
  scale?: number;
  /** Fill colour behind transparent pixels; omit to keep them transparent. */
  background?: string;
  /** 0 = loop forever (default). */
  loops?: number;
}

class ByteWriter {
  private buf = new Uint8Array(4096);
  length = 0;
  byte(b: number) {
    if (this.length === this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this.length++] = b & 0xff;
  }
  word(w: number) {
    this.byte(w & 0xff);
    this.byte((w >> 8) & 0xff);
  }
  bytes(arr: ArrayLike<number>) {
    for (let i = 0; i < arr.length; i++) this.byte(arr[i]);
  }
  string(s: string) {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }
  result() {
    return this.buf.slice(0, this.length);
  }
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Builds the palette and per-frame colour indices. Index 0 is reserved for transparency. */
function indexFrames(frames: GifFrame[], background?: [number, number, number]) {
  const transparent = !background;
  for (let shift = 0; shift <= 7; shift++) {
    const mask = (0xff << shift) & 0xff;
    const palette: number[] = [];
    const lookup = new Map<number, number>();
    const first = transparent ? 1 : 0;
    if (transparent) palette.push(0);
    let overflow = false;
    const indexed = frames.map(({ image }) => {
      const { data } = image;
      const out = new Uint8Array(image.width * image.height);
      for (let p = 0, i = 0; p < out.length; p++, i += 4) {
        let r = data[i], g = data[i + 1], b = data[i + 2];
        const a = data[i + 3];
        if (a < 128) {
          if (transparent) {
            out[p] = 0;
            continue;
          }
          [r, g, b] = background!;
        }
        const key = ((r & mask) << 16) | ((g & mask) << 8) | (b & mask);
        let idx = lookup.get(key);
        if (idx === undefined) {
          idx = first + lookup.size;
          if (idx > 255) {
            overflow = true;
            break;
          }
          lookup.set(key, idx);
          palette.push(key);
        }
        out[p] = idx;
      }
      return out;
    });
    if (!overflow) return { palette, indexed, transparent };
  }
  throw new Error("Too many colours for a GIF");
}

function lzw(indices: Uint8Array, minCodeSize: number, w: ByteWriter) {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  const dict = new Map<number, number>();

  // bits are packed LSB-first into 255-byte sub-blocks
  const block: number[] = [];
  let acc = 0;
  let accBits = 0;
  const flushBlock = () => {
    w.byte(block.length);
    w.bytes(block);
    block.length = 0;
  };
  const emit = (code: number) => {
    acc |= code << accBits;
    accBits += codeSize;
    while (accBits >= 8) {
      block.push(acc & 0xff);
      acc >>>= 8;
      accBits -= 8;
      if (block.length === 255) flushBlock();
    }
  };

  w.byte(minCodeSize);
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      dict.clear();
      codeSize = minCodeSize + 1;
      next = eoi + 1;
    } else {
      if (next >= 1 << codeSize) codeSize++;
      dict.set(key, next++);
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (accBits > 0) {
    block.push(acc & 0xff);
    if (block.length === 255) flushBlock();
  }
  if (block.length) flushBlock();
  w.byte(0);
}

function upscale(src: Uint8Array, width: number, height: number, scale: number): Uint8Array {
  if (scale === 1) return src;
  const W = width * scale;
  const out = new Uint8Array(W * height * scale);
  for (let y = 0; y < height * scale; y++) {
    const sy = Math.floor(y / scale) * width;
    for (let x = 0; x < W; x++) out[y * W + x] = src[sy + Math.floor(x / scale)];
  }
  return out;
}

export function encodeGif(frames: GifFrame[], opts: GifOptions = {}): Blob {
  if (!frames.length) throw new Error("No frames to export");
  const scale = Math.max(1, Math.floor(opts.scale ?? 1));
  const { width, height } = frames[0].image;
  const bg = opts.background ? parseHex(opts.background) : undefined;
  const { palette, indexed, transparent } = indexFrames(frames, bg);

  let tableBits = 1;
  while (1 << tableBits < Math.max(2, palette.length)) tableBits++;
  const tableSize = 1 << tableBits;
  const minCodeSize = Math.max(2, tableBits);

  const w = new ByteWriter();
  w.string("GIF89a");
  w.word(width * scale);
  w.word(height * scale);
  w.byte(0x80 | 0x70 | (tableBits - 1)); // global table, 8-bit colour resolution
  w.byte(0); // background index
  w.byte(0); // pixel aspect
  for (let i = 0; i < tableSize; i++) {
    const c = palette[i] ?? 0;
    w.byte((c >> 16) & 255);
    w.byte((c >> 8) & 255);
    w.byte(c & 255);
  }
  // loop forever (NETSCAPE2.0 application extension)
  w.bytes([0x21, 0xff, 0x0b]);
  w.string("NETSCAPE2.0");
  w.bytes([0x03, 0x01]);
  w.word(opts.loops ?? 0);
  w.byte(0);

  frames.forEach((frame, i) => {
    const delay = Math.max(2, Math.round(frame.delay / 10));
    // graphic control: dispose to background so transparent frames don't smear
    w.bytes([0x21, 0xf9, 0x04, (2 << 2) | (transparent ? 1 : 0)]);
    w.word(delay);
    w.byte(0); // transparent colour index
    w.byte(0);
    w.byte(0x2c);
    w.word(0);
    w.word(0);
    w.word(width * scale);
    w.word(height * scale);
    w.byte(0);
    lzw(upscale(indexed[i], width, height, scale), minCodeSize, w);
  });
  w.byte(0x3b);
  return new Blob([w.result()], { type: "image/gif" });
}
