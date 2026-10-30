import { createGrid, voxelIndex, type Vec3, type VoxelGrid } from "../voxels/grid";
import { encodeVoxels } from "../voxels/codec";
import { renderThumbnail } from "../voxels/thumbnail";
import type { ExampleContext, ExampleModule } from "./types";

// Same hex values as the example sprites (art.ts) and the meadow palette (levels.ts).
const SPRITE_COLORS: Record<string, string> = {
  K: "#1d1a2b", W: "#f4f4ec", S: "#f2c39b", Y: "#f6c945", y: "#c98a2b",
  N: "#8b5a3c", n: "#5c3a28", B: "#5aa9e6", b: "#2f5f9e", P: "#9b5de5", p: "#5e3a9e",
};
const TREE_COLORS: Record<string, string> = {
  s: "#2f6b2e", g: "#4f9d3a", G: "#7ac74f", t: "#6b4430", T: "#a9744f",
};

// Front views are drawn like the sprites (top row first); the sprite faces the +Z side the "Front" view shows.
const PIP_FRONT = [
  ".......KK.......",
  "......KKKK......",
  ".....KNNNNK.....",
  "....KNNNNNNK....",
  "....KNSSSSNK....",
  "....KSKSSKSK....",
  "....KSSSSSSK....",
  ".....KSSSSK.....",
  "....KBBBBBBK....",
  "...KSKBBBBKSK...",
  "...KSKBBBBKSK...",
  "....KbbbbbbK....",
  ".....KbbbbK.....",
  ".....KbKKbK.....",
  ".....KnnnnK.....",
  ".....KKKKKK.....",
];
const COIN_FRONT = [
  ".....KKKKKK.....",
  "....KYYYYYYK....",
  "...KYWWYYYYyK...",
  "...KYWYyyYYyK...",
  "...KYYYyYYYyK...",
  "...KYYYyYYYyK...",
  "...KYYYyYYYyK...",
  "...KYYyyyYYyK...",
  "...KYYYYYYYyK...",
  "....KyYYYYyK....",
  ".....KKKKKK.....",
];
const CHEST_FRONT = [
  "..KKKKKKKKKKKK..",
  ".KNNNNNNNNNNNNK.",
  ".KNnYNNNNNNYnNK.",
  ".KNnNNNNNNNNnNK.",
  ".KKKKKKYYKKKKKK.",
  ".KNnNNNYyNNNnNK.",
  ".KNnNNNNNNNNnNK.",
  ".KNnNNNNNNNNnNK.",
  ".KNnNNNNNNNNnNK.",
  ".KnnnnnnnnnnnnK.",
  "..KKKKKKKKKKKK..",
];
const SLIME_FRONT = [
  "......KKKK......",
  "....KKPPPPKK....",
  "...KPPWPPPPPK...",
  "..KPPWWPPPPPPK..",
  "..KPPPPPPPPPPK..",
  "..KPPKPPPPKPPK..",
  "..KPPKPPPPKPPK..",
  "..KPPPPPPPPPPK..",
  "..KpPPPPPPPPpK..",
  "...KppppppppK...",
  "....KKKKKKKK....",
];

// Tree canopy and trunk as 8x8 slices (row per Z, front last), centred in the grid.
const TREE_SLICES: string[][] = [
  ...Array(5).fill(["........", "........", "........", "...tt...", "...tT...", "........", "........", "........"]),
  ["..ssss..", ".ssssss.", "ssssssss", "sssttsss", "sssttsss", "ssssssss", ".ssssss.", "..ssss.."],
  ["..gggg..", ".gggggg.", "gggggggg", "gggttggg", "gggttggg", "gggggggg", ".gggggg.", "..gggg.."],
  ["..gggg..", ".gggggg.", "gggggggg", "gggggggg", "gggggggg", "gggggggg", ".gggggg.", "..gggg.."],
  ["..gggg..", ".gGGGGg.", "gGGGGGGg", "gGGGGGGg", "gGGGGGGg", "gGGGGGGg", ".gGGGGg.", "..gggg.."],
  ["........", "..gggg..", ".gGGGGg.", ".gGGGGg.", ".gGGGGg.", ".gGGGGg.", "..gggg..", "........"],
  ["........", "........", "...gg...", "..gGGg..", "..gGGg..", "...gg...", "........", "........"],
  ["........", "........", "........", "...GG...", "...GG...", "........", "........", "........"],
];

/** One layer per Y from the bottom, one row per Z, one char per X; "." is empty. */
export function layersToGrid(size: Vec3, layers: string[][], key: Record<string, number>): VoxelGrid {
  const grid = createGrid(size);
  layers.forEach((rows, y) => {
    rows.forEach((row, z) => {
      [...row].forEach((char, x) => {
        if (key[char]) grid.data[voxelIndex(size, x, y, z)] = key[char];
      });
    });
  });
  return grid;
}

const isDetail = (row: string, x: number) =>
  row[x] === "K" && /[^.K]/.test(row[x - 1] ?? ".") && /[^.K]/.test(row[x + 1] ?? ".");

/** Back slices of an extruded sprite: eyes and other inner outlines take the colour next to them. */
function withoutDetail(row: string): string {
  const chars = [...row];
  chars.forEach((char, x) => {
    if (isDetail(row, x)) chars[x] = chars[x - 1];
  });
  return chars.join("");
}

/** Extrudes a bottom-aligned front view `depth` voxels deep; only the front slice keeps the face. */
function extrudeFront(rows: string[], depth: number, size: number): string[][] {
  const front = size / 2 + Math.ceil(depth / 2) - 1;
  const empty = ".".repeat(size);
  return Array.from({ length: size }, (_, y) => {
    const source = rows[rows.length - 1 - y];
    return Array.from({ length: size }, (_, z) => {
      if (!source || z > front || z <= front - depth) return empty;
      return z === front ? source : withoutDetail(source);
    });
  });
}

const centredSlices = (slices: string[][], size: number): string[][] => {
  const offset = (size - slices[0].length) / 2;
  const pad = ".".repeat(offset);
  return Array.from({ length: size }, (_, y) => {
    const slice = slices[y];
    return Array.from({ length: size }, (_, z) => {
      const row = slice?.[z - offset];
      return row ? pad + row + pad : ".".repeat(size);
    });
  });
};

function model(ctx: ExampleContext, slug: string, name: string, size: number, layers: string[][], palette: Record<string, string>) {
  const used = Object.keys(palette).filter((char) => layers.some((rows) => rows.some((row) => row.includes(char))));
  const key = Object.fromEntries(used.map((char, index) => [char, index + 1]));
  const colors = used.map((char) => palette[char]);
  const gridSize: Vec3 = [size, size, size];
  const grid = layersToGrid(gridSize, layers, key);
  return {
    id: ctx.id(slug),
    name,
    size: gridSize,
    colors,
    voxels: encodeVoxels(grid.data),
    thumbnail: renderThumbnail(grid, colors) || undefined,
    tags: ["example"],
  };
}

export const modelExamples: ExampleModule[] = [
  {
    collection: "models",
    build: (ctx) => [
      model(ctx, "hero-3d", "Pip (3D)", 16, extrudeFront(PIP_FRONT, 6, 16), SPRITE_COLORS),
      model(ctx, "coin-3d", "Coin (3D)", 16, extrudeFront(COIN_FRONT, 2, 16), SPRITE_COLORS),
      model(ctx, "chest-3d", "Chest (3D)", 16, extrudeFront(CHEST_FRONT, 8, 16), SPRITE_COLORS),
      model(ctx, "slime-3d", "Slime (3D)", 16, extrudeFront(SLIME_FRONT, 10, 16), SPRITE_COLORS),
      model(ctx, "tree-3d", "Meadow tree (3D)", 16, centredSlices(TREE_SLICES, 16), TREE_COLORS),
    ],
  },
];
