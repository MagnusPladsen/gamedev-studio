import type { MeshArrays } from "./mesh";

/** Builds a binary glTF from the mesh. Import this file only with dynamic import() so three.js stays out of other bundles. */
export async function exportGlb(mesh: MeshArrays, name: string): Promise<Blob> {
  const [THREE, { GLTFExporter }] = await Promise.all([
    import("three"),
    import("three/examples/jsm/exporters/GLTFExporter.js"),
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(mesh.positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(mesh.normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(mesh.colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
  const model = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true }));
  model.name = name;
  const scene = new THREE.Scene();
  scene.add(model);
  const result = await new GLTFExporter().parseAsync(scene, { binary: true });
  geometry.dispose();
  return new Blob([result as ArrayBuffer], { type: "model/gltf-binary" });
}
