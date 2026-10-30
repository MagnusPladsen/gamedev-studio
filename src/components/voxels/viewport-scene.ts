import {
  AxesHelper,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  HemisphereLight,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  MOUSE,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Scene,
  TOUCH,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Vec3, VoxelGrid } from "@/lib/voxels/grid";
import { buildMesh, greedyQuads } from "@/lib/voxels/mesh";
import { raycastGrid, type RayHit } from "@/lib/voxels/raycast";
import { CAMERA_FOV, cellCentreToWorld, getFitDistance, worldToGrid, type CameraPose } from "./viewport-helpers";

const GROUND_COLOR = 0x8a8aa6;
const PREVIEW_ADD_COLOR = 0xffffff;
const PREVIEW_ERASE_COLOR = 0xff4d5e;
const PREVIEW_OPACITY = 0.4;
const GIZMO_SIZE = 72;
const GIZMO_MARGIN = 8;

interface PreviewLayer {
  mesh: InstancedMesh | null;
  geometry: BoxGeometry;
  material: MeshBasicMaterial;
}

interface AxisGizmo {
  scene: Scene;
  camera: OrthographicCamera;
  axes: AxesHelper;
}

export interface ViewportScene {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  voxels: Mesh<BufferGeometry, MeshLambertMaterial>;
  ground: LineSegments<BufferGeometry, LineBasicMaterial>;
  preview: PreviewLayer;
  gizmo: AxisGizmo;
  frame: number;
}

function createAxisGizmo(): AxisGizmo {
  const scene = new Scene();
  const axes = new AxesHelper(1);
  scene.add(axes);
  const camera = new OrthographicCamera(-1.3, 1.3, 1.3, -1.3, 0.1, 10);
  return { scene, camera, axes };
}

function addLights(scene: Scene): void {
  scene.add(new HemisphereLight(0xffffff, 0x8a8aa6, 1.4));
  const sun = new DirectionalLight(0xffffff, 1.8);
  sun.position.set(0.5, 1, 0.75);
  scene.add(sun);
}

export function createViewportScene(canvas: HTMLCanvasElement): ViewportScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new Scene();
  addLights(scene);
  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.1, 1000);
  const controls = new OrbitControls(camera, canvas);
  const voxels = new Mesh(new BufferGeometry(), new MeshLambertMaterial({ vertexColors: true }));
  const ground = new LineSegments(
    new BufferGeometry(),
    new LineBasicMaterial({ color: GROUND_COLOR, transparent: true, opacity: 0.35 }),
  );
  const preview: PreviewLayer = {
    mesh: null,
    geometry: new BoxGeometry(1.04, 1.04, 1.04),
    material: new MeshBasicMaterial({ transparent: true, opacity: PREVIEW_OPACITY, depthWrite: false }),
  };
  scene.add(voxels, ground);
  return { renderer, scene, camera, controls, voxels, ground, preview, gizmo: createAxisGizmo(), frame: 0 };
}

export function applyControlScheme(controls: OrbitControls, oneFingerOrbit: boolean): void {
  controls.mouseButtons = { LEFT: oneFingerOrbit ? MOUSE.ROTATE : null, MIDDLE: MOUSE.ROTATE, RIGHT: MOUSE.ROTATE };
  controls.touches = { ONE: oneFingerOrbit ? TOUCH.ROTATE : null, TWO: TOUCH.DOLLY_ROTATE };
}

export function applyCameraPose(viewport: ViewportScene, pose: CameraPose, size: Vec3): void {
  const { camera, controls } = viewport;
  const distance = getFitDistance(size);
  camera.near = Math.max(distance / 200, 0.05);
  camera.far = distance * 20;
  camera.position.set(...pose.position);
  camera.updateProjectionMatrix();
  controls.minDistance = 2;
  controls.maxDistance = distance * 4;
  controls.target.set(...pose.target);
  controls.update();
}

export function setVoxelMesh(viewport: ViewportScene, grid: VoxelGrid, colors: string[]): void {
  const arrays = buildMesh(greedyQuads(grid), colors, grid.size, 1);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(arrays.positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(arrays.normals, 3));
  geometry.setAttribute("color", new BufferAttribute(arrays.colors, 3));
  geometry.setIndex(new BufferAttribute(arrays.indices, 1));
  viewport.voxels.geometry.dispose();
  viewport.voxels.geometry = geometry;
}

function buildGroundPositions(size: Vec3): number[] {
  const [halfX, halfZ] = [size[0] / 2, size[2] / 2];
  const positions: number[] = [];
  for (let x = 0; x <= size[0]; x++) positions.push(x - halfX, 0, -halfZ, x - halfX, 0, halfZ);
  for (let z = 0; z <= size[2]; z++) positions.push(-halfX, 0, z - halfZ, halfX, 0, z - halfZ);
  return positions;
}

export function setGroundGrid(viewport: ViewportScene, size: Vec3): void {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(buildGroundPositions(size), 3));
  viewport.ground.geometry.dispose();
  viewport.ground.geometry = geometry;
}

function ensurePreviewCapacity(viewport: ViewportScene, count: number): InstancedMesh {
  const { preview, scene } = viewport;
  if (preview.mesh && preview.mesh.instanceMatrix.count >= count) return preview.mesh;
  if (preview.mesh) {
    scene.remove(preview.mesh);
    preview.mesh.dispose();
  }
  const capacity = 2 ** Math.ceil(Math.log2(Math.max(count, 64)));
  const mesh = new InstancedMesh(preview.geometry, preview.material, capacity);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  scene.add(mesh);
  preview.mesh = mesh;
  return mesh;
}

export function setPreviewCells(viewport: ViewportScene, cells: Vec3[], size: Vec3, isErase: boolean): void {
  if (cells.length === 0 && !viewport.preview.mesh) return;
  const mesh = ensurePreviewCapacity(viewport, cells.length);
  const matrix = new Matrix4();
  cells.forEach((cell, index) => {
    const [x, y, z] = cellCentreToWorld(cell, size);
    mesh.setMatrixAt(index, matrix.makeTranslation(x, y, z));
  });
  mesh.count = cells.length;
  mesh.visible = cells.length > 0;
  mesh.instanceMatrix.needsUpdate = true;
  viewport.preview.material.color.set(isErase ? PREVIEW_ERASE_COLOR : PREVIEW_ADD_COLOR);
}

export function resizeViewport(viewport: ViewportScene, width: number, height: number): void {
  if (width === 0 || height === 0) return;
  viewport.renderer.setSize(width, height, false);
  viewport.camera.aspect = width / height;
  viewport.camera.updateProjectionMatrix();
}

function renderGizmo(viewport: ViewportScene): void {
  const { renderer, camera, controls, gizmo } = viewport;
  const offset = new Vector3().subVectors(camera.position, controls.target).normalize().multiplyScalar(3);
  gizmo.camera.position.copy(offset);
  gizmo.camera.up.copy(camera.up);
  gizmo.camera.lookAt(0, 0, 0);
  renderer.setViewport(GIZMO_MARGIN, GIZMO_MARGIN, GIZMO_SIZE, GIZMO_SIZE);
  renderer.setScissor(GIZMO_MARGIN, GIZMO_MARGIN, GIZMO_SIZE, GIZMO_SIZE);
  renderer.setScissorTest(true);
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(gizmo.scene, gizmo.camera);
  renderer.autoClear = true;
  renderer.setScissorTest(false);
}

export function renderViewport(viewport: ViewportScene, withHelpers: boolean = true): void {
  const { renderer, scene, camera, ground, preview } = viewport;
  const size = renderer.getSize(new Vector2());
  ground.visible = withHelpers;
  if (preview.mesh) preview.mesh.visible = withHelpers && preview.mesh.count > 0;
  renderer.setViewport(0, 0, size.x, size.y);
  renderer.render(scene, camera);
  if (withHelpers) renderGizmo(viewport);
  renderer.setViewport(0, 0, size.x, size.y);
}

export function requestRender(viewport: ViewportScene): void {
  if (viewport.frame) return;
  viewport.frame = requestAnimationFrame(() => {
    viewport.frame = 0;
    renderViewport(viewport);
  });
}

export function snapshotViewportPng(viewport: ViewportScene): string {
  renderViewport(viewport, false);
  const png = viewport.renderer.domElement.toDataURL("image/png");
  renderViewport(viewport);
  return png;
}

const raycaster = new Raycaster();
const pointer = new Vector2();

export function pickGridHit(viewport: ViewportScene, clientX: number, clientY: number, grid: VoxelGrid): RayHit | null {
  const rect = viewport.renderer.domElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, viewport.camera);
  const { origin, direction } = raycaster.ray;
  if (direction.lengthSq() === 0) return null;
  const gridOrigin = worldToGrid([origin.x, origin.y, origin.z], grid.size);
  return raycastGrid(gridOrigin, [direction.x, direction.y, direction.z], grid);
}

export function disposeViewportScene(viewport: ViewportScene): void {
  if (viewport.frame) cancelAnimationFrame(viewport.frame);
  viewport.controls.dispose();
  viewport.voxels.geometry.dispose();
  viewport.voxels.material.dispose();
  viewport.ground.geometry.dispose();
  viewport.ground.material.dispose();
  viewport.preview.mesh?.dispose();
  viewport.preview.geometry.dispose();
  viewport.preview.material.dispose();
  viewport.gizmo.axes.dispose();
  viewport.renderer.dispose();
  viewport.renderer.forceContextLoss();
}
