import { hexToRgb } from "./colors";
import { countVoxels, voxelIndex, type VoxelGrid } from "./grid";

const VOX_VERSION = 150;
const PALETTE_ENTRIES = 256;

function writeChunk(id: string, content: Uint8Array, children: Uint8Array = new Uint8Array(0)): Uint8Array {
  const bytes = new Uint8Array(12 + content.length + children.length);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < 4; i++) bytes[i] = id.charCodeAt(i);
  view.setInt32(4, content.length, true);
  view.setInt32(8, children.length, true);
  bytes.set(content, 12);
  bytes.set(children, 12 + content.length);
  return bytes;
}

function sizeChunk(grid: VoxelGrid): Uint8Array {
  const content = new Uint8Array(12);
  const view = new DataView(content.buffer);
  view.setInt32(0, grid.size[0], true);
  view.setInt32(4, grid.size[2], true);
  view.setInt32(8, grid.size[1], true);
  return writeChunk("SIZE", content);
}

function voxelsChunk(grid: VoxelGrid): Uint8Array {
  const [sx, sy, sz] = grid.size;
  const content = new Uint8Array(4 + countVoxels(grid) * 4);
  new DataView(content.buffer).setInt32(0, countVoxels(grid), true);
  let offset = 4;
  for (let z = 0; z < sz; z++) {
    for (let y = 0; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const value = grid.data[voxelIndex(grid.size, x, y, z)];
        if (value === 0) continue;
        content.set([x, sz - 1 - z, y, value], offset);
        offset += 4;
      }
    }
  }
  return writeChunk("XYZI", content);
}

function paletteChunk(colors: string[]): Uint8Array {
  const content = new Uint8Array(PALETTE_ENTRIES * 4);
  for (let i = 0; i < PALETTE_ENTRIES; i++) {
    const color = colors[i];
    content.set(color ? [...hexToRgb(color), 255] : [0, 0, 0, 255], i * 4);
  }
  return writeChunk("RGBA", content);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function toVox(grid: VoxelGrid, colors: string[]): Uint8Array {
  const header = new Uint8Array(8);
  for (let i = 0; i < 4; i++) header[i] = "VOX ".charCodeAt(i);
  new DataView(header.buffer).setInt32(4, VOX_VERSION, true);
  const main = writeChunk("MAIN", new Uint8Array(0), concat([sizeChunk(grid), voxelsChunk(grid), paletteChunk(colors)]));
  return concat([header, main]);
}
