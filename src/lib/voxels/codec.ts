const MAX_RUN = 255;
const CHUNK_SIZE = 0x8000;

function runLengthEncode(data: Uint8Array): number[] {
  const pairs: number[] = [];
  let index = 0;
  while (index < data.length) {
    const value = data[index];
    let count = 1;
    while (count < MAX_RUN && index + count < data.length && data[index + count] === value) count++;
    pairs.push(count, value);
    index += count;
  }
  return pairs;
}

function bytesToBase64(bytes: number[]): string {
  let binary = "";
  for (let start = 0; start < bytes.length; start += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.slice(start, start + CHUNK_SIZE));
  }
  return btoa(binary);
}

export function encodeVoxels(data: Uint8Array): string {
  return bytesToBase64(runLengthEncode(data));
}

export function decodeVoxels(encoded: string, length: number): Uint8Array {
  const result = new Uint8Array(length);
  let binary: string;
  try {
    binary = atob(encoded);
  } catch {
    return result;
  }
  let position = 0;
  for (let index = 0; index + 1 < binary.length && position < length; index += 2) {
    const count = binary.charCodeAt(index);
    const value = binary.charCodeAt(index + 1);
    const end = Math.min(position + count, length);
    result.fill(value, position, end);
    position = end;
  }
  return result;
}
