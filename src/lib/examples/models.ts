import { createGrid, voxelIndex, type Vec3, type VoxelGrid } from "../voxels/grid";
import { encodeVoxels } from "../voxels/codec";
import { renderThumbnail } from "../voxels/thumbnail";
import type { VoxelModel } from "@/types";
import type { ExampleContext, ExampleModule } from "./types";

type ExampleModel = Omit<VoxelModel, "projectId" | "createdAt" | "updatedAt">;

// Same hex values as the example sprites (art.ts) and the meadow palette (levels.ts).
const SPRITE_COLORS: Record<string, string> = {
  K: "#1d1a2b", W: "#f4f4ec", S: "#f2c39b", Y: "#f6c945", y: "#c98a2b", D: "#5b6270",
  N: "#8b5a3c", n: "#5c3a28", B: "#5aa9e6", b: "#2f5f9e", P: "#9b5de5", p: "#5e3a9e",
};
const TREE_COLORS: Record<string, string> = {
  s: "#2f6b2e", g: "#4f9d3a", G: "#7ac74f", t: "#6b4430", T: "#a9744f",
};

// Hand-placed solids: [colour, x0, y0, z0, x1, y1, z1], inclusive, later boxes paint over earlier ones.
// Models face +Z, which is the side the "Front" view shows.
type Box = [string, number, number, number, number, number, number];

const PIP_BOXES: Box[] = [
  ["n", 4, 0, 6, 6, 1, 10], ["n", 9, 0, 6, 11, 1, 10], // boots, toes forward
  ["b", 4, 2, 6, 6, 4, 9], ["b", 9, 2, 6, 11, 4, 9], // legs
  ["B", 4, 5, 6, 11, 9, 9], // shirt
  ["B", 2, 7, 7, 3, 9, 8], ["B", 12, 7, 7, 13, 9, 8], // arms
  ["S", 2, 5, 7, 3, 6, 8], ["S", 12, 5, 7, 13, 6, 8], // hands
  ["S", 4, 10, 5, 11, 14, 10], // head
  ["N", 4, 10, 5, 11, 14, 5], ["N", 4, 13, 5, 4, 14, 10], ["N", 11, 13, 5, 11, 14, 10], // hair: back and sides
  ["N", 4, 14, 5, 11, 14, 10], ["N", 5, 15, 6, 10, 15, 9], // hair: top and fringe
  ["K", 6, 12, 10, 6, 12, 10], ["K", 9, 12, 10, 9, 12, 10], // eyes
];

const COIN_BOXES: Box[] = [
  ["y", 5, 0, 7, 10, 0, 8], ["y", 4, 1, 7, 11, 1, 8], ["y", 3, 2, 7, 12, 9, 8], ["y", 4, 10, 7, 11, 10, 8], ["y", 5, 11, 7, 10, 11, 8], // rim
  ["Y", 5, 1, 7, 10, 1, 8], ["Y", 4, 2, 7, 11, 9, 8], ["Y", 5, 10, 7, 10, 10, 8], // faces
  ["y", 7, 3, 7, 8, 8, 8], // emblem slot
  ["W", 5, 8, 8, 5, 8, 8], // glint
];

const CHEST_BOXES: Box[] = [
  ["N", 2, 0, 4, 13, 4, 11], ["n", 2, 0, 4, 13, 0, 11], // body, darker base
  ["n", 2, 5, 4, 13, 5, 11], // seam between body and lid
  ["N", 2, 6, 4, 13, 8, 11], ["N", 3, 9, 4, 12, 9, 11], // lid
  ["D", 4, 0, 4, 5, 8, 11], ["D", 10, 0, 4, 11, 8, 11], ["D", 4, 9, 4, 5, 9, 11], ["D", 10, 9, 4, 11, 9, 11], // iron bands
  ["Y", 7, 4, 11, 8, 6, 11], ["K", 7, 5, 11, 7, 5, 11], // lock
];

const SLIME_BOXES: Box[] = [
  ["p", 2, 0, 4, 13, 0, 11], ["p", 4, 0, 2, 11, 0, 13], // darker base, as wide as the body so it shows as a ring
  ["P", 2, 1, 4, 13, 4, 11], ["P", 4, 1, 2, 11, 4, 13],
  ["P", 3, 5, 4, 12, 5, 11], ["P", 4, 5, 3, 11, 5, 12],
  ["P", 4, 6, 4, 11, 6, 11], ["P", 5, 7, 5, 10, 7, 10], ["P", 6, 8, 6, 9, 8, 9],
  ["W", 6, 7, 6, 7, 7, 7], ["W", 4, 6, 11, 4, 6, 11], // highlights
  ["K", 5, 3, 13, 5, 4, 13], ["K", 10, 3, 13, 10, 4, 13], // eyes, on the outermost front face
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

function boxesToLayers(size: number, boxes: Box[]): string[][] {
  const layers = Array.from({ length: size }, () => Array.from({ length: size }, () => Array<string>(size).fill(".")));
  for (const [char, x0, y0, z0, x1, y1, z1] of boxes) {
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) layers[y][z][x] = char;
      }
    }
  }
  return layers.map((rows) => rows.map((row) => row.join("")));
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

function model(ctx: ExampleContext, slug: string, name: string, size: number, layers: string[][], palette: Record<string, string>): ExampleModel {
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
      model(ctx, "hero-3d", "Pip (3D)", 16, boxesToLayers(16, PIP_BOXES), SPRITE_COLORS),
      model(ctx, "coin-3d", "Coin (3D)", 16, boxesToLayers(16, COIN_BOXES), SPRITE_COLORS),
      model(ctx, "chest-3d", "Chest (3D)", 16, boxesToLayers(16, CHEST_BOXES), SPRITE_COLORS),
      model(ctx, "slime-3d", "Slime (3D)", 16, boxesToLayers(16, SLIME_BOXES), SPRITE_COLORS),
      model(ctx, "tree-3d", "Meadow tree (3D)", 16, centredSlices(TREE_SLICES, 16), TREE_COLORS),
    ],
  },
];
