import { hexToRgb } from "./colors";
import { getVoxel, type Vec3, type VoxelGrid } from "./grid";

export interface IsoFace {
  points: [number, number][];
  fill: string;
}

type Point = [number, number];

const LEFT_SHADE = 0.8;
const RIGHT_SHADE = 0.6;
const TOP_SHADE = 1;

function project(x: number, y: number, z: number): Point {
  return [x - z, (x + z) * 0.5 - y];
}

function shadeColor(hex: string, shade: number): string {
  const channels = hexToRgb(hex).map((channel) =>
    Math.round(channel * shade).toString(16).padStart(2, "0"),
  );
  return `#${channels.join("")}`;
}

function facePoints(corners: Vec3[]): Point[] {
  return corners.map(([x, y, z]) => project(x, y, z));
}

function voxelFaces(grid: VoxelGrid, x: number, y: number, z: number, color: string): IsoFace[] {
  const faces: IsoFace[] = [];
  if (getVoxel(grid, x, y, z + 1) === 0) {
    faces.push({
      points: facePoints([[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]]),
      fill: shadeColor(color, LEFT_SHADE),
    });
  }
  if (getVoxel(grid, x + 1, y, z) === 0) {
    faces.push({
      points: facePoints([[x + 1, y, z], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x + 1, y + 1, z]]),
      fill: shadeColor(color, RIGHT_SHADE),
    });
  }
  if (getVoxel(grid, x, y + 1, z) === 0) {
    faces.push({
      points: facePoints([[x, y + 1, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]]),
      fill: shadeColor(color, TOP_SHADE),
    });
  }
  return faces;
}

export function isoFaces(grid: VoxelGrid, colors: string[]): IsoFace[] {
  const [sizeX, sizeY, sizeZ] = grid.size;
  const voxels: { x: number; y: number; z: number; value: number }[] = [];
  for (let z = 0; z < sizeZ; z++) {
    for (let y = 0; y < sizeY; y++) {
      for (let x = 0; x < sizeX; x++) {
        const value = getVoxel(grid, x, y, z);
        if (value !== 0) voxels.push({ x, y, z, value });
      }
    }
  }
  voxels.sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z));
  return voxels.flatMap(({ x, y, z, value }) =>
    voxelFaces(grid, x, y, z, colors[value - 1] ?? "#ffffff"),
  );
}

function faceBounds(faces: IsoFace[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const face of faces) {
    for (const [x, y] of face.points) {
      bounds.minX = Math.min(bounds.minX, x);
      bounds.maxX = Math.max(bounds.maxX, x);
      bounds.minY = Math.min(bounds.minY, y);
      bounds.maxY = Math.max(bounds.maxY, y);
    }
  }
  return bounds;
}

export function renderThumbnail(grid: VoxelGrid, colors: string[], px = 96): string {
  const faces = isoFaces(grid, colors);
  if (faces.length === 0) return "";
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const { minX, minY, maxX, maxY } = faceBounds(faces);
  const scale = px / Math.max(maxX - minX, maxY - minY);
  const offsetX = (px - (maxX - minX) * scale) / 2 - minX * scale;
  const offsetY = (px - (maxY - minY) * scale) / 2 - minY * scale;
  context.lineWidth = 0.5;
  context.lineJoin = "round";
  for (const face of faces) {
    context.fillStyle = face.fill;
    context.strokeStyle = face.fill;
    context.beginPath();
    face.points.forEach(([x, y], index) => {
      const drawX = x * scale + offsetX;
      const drawY = y * scale + offsetY;
      if (index === 0) context.moveTo(drawX, drawY);
      else context.lineTo(drawX, drawY);
    });
    context.closePath();
    context.fill();
    context.stroke();
  }
  return canvas.toDataURL("image/png");
}
