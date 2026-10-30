import { hexToRgb } from "./colors";
import { srgbToLinear, type MeshArrays } from "./mesh";

function formatNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}

function objVertexLines(array: Float32Array, prefix: string): string[] {
  const lines: string[] = [];
  for (let i = 0; i < array.length; i += 3) {
    lines.push(`${prefix} ${formatNumber(array[i])} ${formatNumber(array[i + 1])} ${formatNumber(array[i + 2])}`);
  }
  return lines;
}

function faceLines(mesh: MeshArrays, group: MeshArrays["groups"][number]): string[] {
  const lines: string[] = [];
  for (let i = group.start; i < group.start + group.count; i += 3) {
    const [a, b, c] = [mesh.indices[i] + 1, mesh.indices[i + 1] + 1, mesh.indices[i + 2] + 1];
    lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
  }
  return lines;
}

export function toObj(mesh: MeshArrays, colors: string[], name: string): { obj: string; mtl: string } {
  const obj = [
    `mtllib ${name}.mtl`,
    `o ${name}`,
    ...objVertexLines(mesh.positions, "v"),
    ...objVertexLines(mesh.normals, "vn"),
  ];
  const mtl: string[] = [];
  for (const group of mesh.groups) {
    const [r, g, b] = hexToRgb(colors[group.value - 1] ?? "#ffffff").map((channel) => formatNumber(srgbToLinear(channel)));
    mtl.push(`newmtl c${group.value}`, `Kd ${r} ${g} ${b}`, "");
    obj.push(`usemtl c${group.value}`, ...faceLines(mesh, group));
  }
  return { obj: obj.join("\n") + "\n", mtl: mtl.join("\n") };
}
