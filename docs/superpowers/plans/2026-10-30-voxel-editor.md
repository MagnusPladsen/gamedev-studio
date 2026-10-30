# Voxels Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a MagicaVoxel-style "Voxels" tool to GameDev Studio with full editing, glb/obj/vox/png export,
symmetry, sprite → voxels, Pip's Quest examples, thumbnails, phone touch editing and a Blender recommendation card.

**Architecture:** Pure, unit-tested voxel logic lives in `src/lib/voxels/` (grid, RLE codec, edit ops, raycast,
colours, sprite import, greedy mesher, OBJ/VOX writers, 2D isometric thumbnails). A three.js viewport component,
loaded with `next/dynamic` (`ssr: false`), renders and picks. A client page under `project/[projectId]/voxels/`
wires it to the storage cache with the studio's shared editor pieces.

**Tech Stack:** Next.js 16.4.3, React 19.3, Tailwind 4, `three@0.187.0` (exact), `@types/three@0.186.0`,
`vitest@^5.0.5` (new, unit tests for `src/lib/voxels/` only).

**Spec:** `docs/superpowers/specs/2026-10-30-voxel-editor-design.md` (research: `docs/research/3d-tool-feasibility.md`)

## Global Constraints

- Work on branch `feature/voxels`; commit with the `/commit` skill after each task; never push without asking.
- Asset type `model`, collection `models`, route `/project/[projectId]/voxels`, label "Voxel model", tool name
  "Voxels", lucide `Box` icon, colour `#d4a373`, `--on-accent` dark (`#0b0b10`). Locked: these go into the
  migration and saved data.
- `VoxelModel.voxels` = RLE of palette indices (0 empty, 1–255 = `colors[i-1]`) as base64. Max 255 colours.
- Grid sizes 8, 16, 32, 64 (cubic in UI, `size: [x, y, z]` in data); default 16; cap 64.
- Export: 1 voxel = 0.1 m, Y-up, centred on X/Z, base on Y = 0; greedy-meshed, hidden faces removed.
- three.js only on the Voxels route: never import `three` from `src/lib/voxels/*` except `export-glb.ts`, and only
  import that file with dynamic `import()`.
- Every studio convention from `CLAUDE.md`: autosave + `SaveIndicator`, undo/redo + `UndoRedoButtons` + shortcuts,
  `ExportMenu` at the right of the toolbar, `ExamplesBar`, `LinkedAssets`, `useOpenParam`, `var(--accent)` for
  primary buttons, secondary buttons with `var(--text-primary)` text, icon-only buttons with `title` + `aria-label`,
  phone fixes via `max-md:` only, "free, no watermark" wording at export.
- No AI-generated content; examples are hand-placed data. No code copied from GPL projects (Goxel, Blockbench,
  Voxel Builder).
- Read `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md` before writing the `next/dynamic` call.
- Don't change desktop layout or behaviour of any existing tool.

## Review Focus

1. **Corrupt or truncated `voxels` string** (old sync, hand-edited folder JSON) — the model must still open: decode
   never throws, pads/truncates to the grid length. Pinned in Task 1.
2. **Resizing to a smaller grid** — the user is told how many voxels would be lost and can cancel; cancelling
   leaves the model untouched. Pinned in Task 1 (`lost` count) and Task 8 (confirm).
3. **Symmetry on odd vs even sizes** — the centre slice on an odd axis mirrors onto itself without duplicates;
   on even sizes `x ↔ size-1-x`. Pinned in Task 3.
4. **Too many colours** — a palette or sprite with more than 255 colours caps at 255 and maps the rest to the
   nearest colour, never producing a value > 255. Pinned in Task 4.
5. **Empty model** — export items are disabled with the description "Add some voxels first"; the mesher and
   writers return valid empty output instead of throwing. Pinned in Task 5 and Task 9.

---

### Task 1: Test harness, grid and RLE codec

**Files:**
- Modify: `package.json` (add `"test": "vitest run"`, devDependency `vitest`)
- Create: `vitest.config.ts` (node environment, alias `@` → `./src`, include `src/**/*.test.ts`)
- Create: `src/lib/voxels/grid.ts`, `src/lib/voxels/codec.ts`
- Test: `src/lib/voxels/grid.test.ts`, `src/lib/voxels/codec.test.ts`

**Interfaces:**
- Produces (`grid.ts`):
  - `type Vec3 = [number, number, number]`
  - `interface VoxelGrid { size: Vec3; data: Uint8Array }` — index `x + y*sx + z*sx*sy`
  - `GRID_SIZES = [8, 16, 32, 64] as const`, `DEFAULT_GRID_SIZE = 16`, `MAX_GRID_SIZE = 64`
  - `createGrid(size: Vec3): VoxelGrid`, `inBounds(size: Vec3, x: number, y: number, z: number): boolean`,
    `voxelIndex(size: Vec3, x: number, y: number, z: number): number`,
    `getVoxel(grid: VoxelGrid, x: number, y: number, z: number): number` (0 out of bounds),
    `countVoxels(grid: VoxelGrid): number`,
    `resizeGrid(grid: VoxelGrid, size: Vec3): { grid: VoxelGrid; lost: number }` (anchor bottom-centre:
    offset X/Z by `Math.floor((new - old) / 2)`, Y by 0)
- Produces (`codec.ts`): `encodeVoxels(data: Uint8Array): string`, `decodeVoxels(encoded: string, length: number): Uint8Array`
  - RLE bytes are pairs `[count 1..255, value]`, then base64 (`btoa` over chunked `String.fromCharCode`).

- [ ] **Step 1: Branch and install** — `git switch -c feature/voxels`; `npm install -D vitest@^5.0.5`; add the
  script and `vitest.config.ts`.
- [ ] **Step 2: Write failing tests**
  - `grid.test.ts`: `createGrid([4,4,4]).data.length === 64`; `getVoxel` returns 0 out of bounds;
    `resizeGrid` 8³→16³ moves voxel `(0,0,0)` to `(4,0,4)` with `lost === 0`; 16³→8³ with a voxel at `(0,0,0)`
    reports `lost === 1`; voxel at `(8,0,8)` in 16³ lands at `(4,0,4)` in 8³.
  - `codec.test.ts`: round-trips an empty 64³ grid to a string under 20 chars; round-trips random data of length
    4096; `decodeVoxels("!!not base64", 64)` returns 64 zeros; a valid string for 10 voxels decoded with
    `length = 20` pads with zeros, with `length = 5` truncates; run of 600 equal values encodes as 3 pairs.
- [ ] **Step 3: Run** `npm test` — Expected: FAIL (modules missing).
- [ ] **Step 4: Implement** `grid.ts` and `codec.ts`.
- [ ] **Step 5: Run** `npm test` — Expected: all pass. `npx tsc --noEmit -p .` passes.
- [ ] **Step 6: Commit** (`/commit`): package.json, package-lock.json, vitest.config.ts, src/lib/voxels/*.

### Task 2: Register the `model` asset type and `models` collection

**Files:**
- Modify: `src/types/index.ts` (`AssetType` union + `VoxelModel` interface)
- Modify: `src/lib/storage.ts` (`StorableTypes.models`, `PROJECT_COLLECTIONS` before `"links"`)
- Modify: `src/lib/assets.ts` (`ASSET_KINDS.model`; `summarize()` returns `thumbnail` for `model` from `a.thumbnail`)
- Modify: `src/app/(app)/project/[projectId]/assets/page.tsx` (`ICONS.model = Box`, `DESCRIPTIONS.model`)
- Create: `supabase/migrations/20261031090000_add_models_collection.sql`

**Interfaces:**
- Produces:
  ```ts
  interface VoxelModel {
    id: string; projectId: string; name: string;
    size: [number, number, number]; paletteId?: string; colors: string[]; voxels: string;
    thumbnail?: string; tags: string[]; example?: boolean; createdAt: string; updatedAt: string;
  }
  ```
  `ASSET_KINDS.model = { type: "model", collection: "models", label: "Voxel model", path: "voxels", color: "#d4a373" }`
- Migration: same shape as `20261030170000_add_board_collections.sql`, list plus `'models'`.

- [ ] **Step 1: Implement** the edits; `DESCRIPTIONS.model = "Chunky 3D props and characters"`.
- [ ] **Step 2: Verify** `npx tsc --noEmit -p .` passes (it flags every `Record<AssetType, …>` that needs the new key).
- [ ] **Step 3: Verify** `npm run dev` (port 4317): dashboard of an example project renders with no errors; the
  "Size test" project still loads.
- [ ] **Step 4: Commit** (`/commit`).

### Task 3: Edit operations and raycasting

**Files:**
- Create: `src/lib/voxels/edit.ts`, `src/lib/voxels/raycast.ts`
- Test: `src/lib/voxels/edit.test.ts`, `src/lib/voxels/raycast.test.ts`

**Interfaces:**
- Consumes: Task 1 `Vec3`, `VoxelGrid`, `inBounds`, `voxelIndex`, `getVoxel`.
- Produces (`edit.ts`):
  - `interface Symmetry { x: boolean; y: boolean; z: boolean }`
  - `mirrorCells(cells: Vec3[], size: Vec3, symmetry: Symmetry): Vec3[]` — mirror `c ↔ size-1-c` per enabled
    axis, all combinations, deduplicated.
  - `setCells(grid: VoxelGrid, cells: Vec3[], value: number): VoxelGrid` — new grid; ignores out-of-bounds;
    returns the **same object** if nothing changed (so history/autosave skip no-ops).
  - `paintCells(grid: VoxelGrid, cells: Vec3[], value: number): VoxelGrid` — recolours solid cells only.
  - `boxCells(a: Vec3, b: Vec3): Vec3[]` — inclusive cuboid.
  - `fillFaceCells(grid: VoxelGrid, start: Vec3, normal: Vec3): Vec3[]` — flood from `start` through solid voxels of
    the same value that lie in the plane perpendicular to `normal` through `start`, 4-connected, whose neighbour in
    the `normal` direction is empty or out of bounds.
- Produces (`raycast.ts`):
  - `interface RayHit { cell: Vec3 | null; normal: Vec3; place: Vec3 }` — `cell` null for a ground hit;
    `place` is where an added voxel goes.
  - `raycastGrid(origin: Vec3, dir: Vec3, grid: VoxelGrid): RayHit | null` — grid space (voxel `(x,y,z)` spans
    `[x, x+1]`); Amanatides–Woo DDA; falls back to the `y = 0` plane inside `[0, sx] × [0, sz]`
    (`place = [floor x, 0, floor z]`, `normal = [0,1,0]`); null when nothing is hit.

- [ ] **Step 1: Write failing tests**
  - `mirrorCells([[0,0,0]], [4,4,4], {x:true,y:false,z:false})` → `[[0,0,0],[3,0,0]]`;
    on `[5,5,5]` the centre `[2,1,1]` with x-symmetry → one cell; x+z → 4 cells for `[0,0,0]`.
  - `setCells` returns same object when writing the existing value; ignores `[-1,0,0]`.
  - `paintCells` leaves empty cells empty.
  - `boxCells([0,0,0],[1,1,1]).length === 8`, order-independent of corners.
  - `fillFaceCells` on a 3×1×3 red slab with one blue voxel, `normal [0,1,0]` from a red corner → 8 cells;
    a red voxel covered by another voxel above is excluded.
  - `raycastGrid` from `[0.5, 10, 0.5]` down onto a voxel at `(0,0,0)` → `cell [0,0,0]`, `normal [0,1,0]`,
    `place [0,1,0]`; on an empty grid → ground hit `place [0,0,0]`; a ray pointing up from above → null.
- [ ] **Step 2: Run** `npm test` — FAIL.
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** (`/commit`).

### Task 4: Colours and sprite → voxels

**Files:**
- Create: `src/lib/voxels/colors.ts`, `src/lib/voxels/sprite.ts`
- Test: `src/lib/voxels/colors.test.ts`, `src/lib/voxels/sprite.test.ts`

**Interfaces:**
- Consumes: Task 1 grid helpers; Task 3 `setCells`.
- Produces (`colors.ts`):
  - `MAX_COLORS = 255`; `FALLBACK_COLORS: string[]` — copy the hex list of the `meadow-palette` example in
    `src/lib/examples/art.ts` (or wherever palettes are built).
  - `nearestColorValue(colors: string[], hex: string): number` — 1-based, squared RGB distance.
  - `addColor(colors: string[], hex: string): { colors: string[]; value: number }` — case-insensitive exact
    match reuses; append if fewer than 255; else nearest.
  - `remapToPalette(grid: VoxelGrid, from: string[], to: string[]): { grid: VoxelGrid; colors: string[] }` —
    `colors = to.slice(0, 255)`; each voxel value → nearest in the new list.
- Produces (`sprite.ts`):
  - `interface PixelImage { width: number; height: number; data: Uint8ClampedArray }`
  - `type SpriteImport = { ok: true; grid: VoxelGrid; colors: string[] } | { ok: false; reason: "too-large" | "empty" }`
  - `spriteToVoxels(image: PixelImage, colors: string[]): SpriteImport` — alpha < 128 skipped; image row `r` → `y =
    height-1-r`; grid = smallest `GRID_SIZES` entry ≥ `max(w, h)`; centred on X (`floor((size-w)/2)`), `z =
    floor(size/2)`, base at `y = 0`; colours via `addColor`. Width or height > 64 → `too-large`; no opaque pixel →
    `empty`.

- [ ] **Step 1: Write failing tests**
  - `addColor` reuses `#AABBCC` for `#aabbcc`; with 255 colours returns the nearest value and the list stays 255.
  - `remapToPalette` with 300 target colours yields 255 colours and no voxel value > 255; a red voxel maps to the
    reddest target.
  - `spriteToVoxels` 2×3 image with top-left opaque red → 8³ grid, voxel at `(3, 2, 4)`; 65×10 → `too-large`;
    fully transparent → `empty`; 300 distinct opaque colours → `colors.length === 255`.
- [ ] **Step 2: Run** `npm test` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** (`/commit`).

### Task 5: Greedy mesher, OBJ and VOX writers

**Files:**
- Create: `src/lib/voxels/mesh.ts`, `src/lib/voxels/export-obj.ts`, `src/lib/voxels/export-vox.ts`
- Test: `src/lib/voxels/mesh.test.ts`, `src/lib/voxels/export-obj.test.ts`, `src/lib/voxels/export-vox.test.ts`

**Interfaces:**
- Consumes: Task 1 grid.
- Produces (`mesh.ts`):
  - `EXPORT_SCALE = 0.1`
  - `interface Quad { corners: [Vec3, Vec3, Vec3, Vec3]; normal: Vec3; value: number }` — counter-clockwise seen
    from outside, grid units.
  - `greedyQuads(grid: VoxelGrid): Quad[]` — per axis/direction slice, merge same-value exposed faces into maximal
    rectangles.
  - `interface MeshArrays { positions: Float32Array; normals: Float32Array; colors: Float32Array; indices:
    Uint32Array; groups: { value: number; start: number; count: number }[] }` — `colors` are **linear** RGB (sRGB
    hex → linear), `groups` index ranges per colour value, sorted by value.
  - `buildMesh(quads: Quad[], colors: string[], size: Vec3, scale = EXPORT_SCALE): MeshArrays` — subtract
    `[sx/2, 0, sz/2]`, multiply by `scale`, 4 vertices + 2 triangles per quad.
- Produces (`export-obj.ts`): `toObj(mesh: MeshArrays, colors: string[], name: string): { obj: string; mtl: string }`
  — `mtllib <name>.mtl`, `usemtl c<value>` per group, `Kd` from the sRGB hex / 255 (verify in Task 9).
- Produces (`export-vox.ts`): `toVox(grid: VoxelGrid, colors: string[]): Uint8Array` — `"VOX "`, version 150,
  `MAIN` with `SIZE`, `XYZI`, `RGBA` (256 entries, entry `i-1` is value `i`, unused `#000000ff`). Axis rotation
  three Y-up → MagicaVoxel Z-up: `voxX = x`, `voxY = sz-1-z`, `voxZ = y`.

- [ ] **Step 1: Write failing tests**
  - one voxel → 6 quads; a 2×1×1 bar of one colour → 6 quads; two colours side by side → 10 quads; a 4³ solid cube
    → 6 quads; sum of quad areas equals the number of exposed unit faces for a random 8³ grid.
  - `buildMesh` of a 16-high column: Y span of positions is `0..1.6`, X/Z centred around 0.
  - empty grid → `greedyQuads` `[]`, `buildMesh` arrays of length 0, `toObj` valid with no faces, `toVox` valid with
    `XYZI` count 0.
  - `toObj`: `v ` lines = positions/3, `f ` lines = indices/3, one `newmtl` per used colour.
  - `toVox`: bytes 0–3 `"VOX "`, int32 at 4 = 150; voxel `(1,2,3)` in 4³ writes `(1, 0, 2, value)`; `RGBA` chunk
    content is 1024 bytes.
- [ ] **Step 2: Run** `npm test` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** (`/commit`).

### Task 6: Isometric thumbnails (no three.js)

**Files:**
- Create: `src/lib/voxels/thumbnail.ts`
- Test: `src/lib/voxels/thumbnail.test.ts`

**Interfaces:**
- Consumes: Task 1 grid.
- Produces:
  - `interface IsoFace { points: [number, number][]; fill: string }`
  - `isoFaces(grid: VoxelGrid, colors: string[]): IsoFace[]` — 3/4 view from `+x, +y, +z`; only top/left/right faces
    whose neighbour is empty; painter-sorted back to front; shade top 1.0, left 0.8, right 0.6 of the colour.
  - `renderThumbnail(grid: VoxelGrid, colors: string[], px = 96): string` — fits faces into a `px` square canvas
    (transparent), returns a PNG data URL; `""` for an empty grid. Uses `document.createElement("canvas")`.

- [ ] **Step 1: Write failing tests** (`isoFaces` only, it's pure): one voxel → 3 faces with shades 1.0/0.8/0.6 of
  its colour; two stacked → 5 faces; empty → `[]`; the last face drawn for a 2×2×2 cube is a top face.
- [ ] **Step 2: Run** `npm test` — FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** (`/commit`).

### Task 7: three.js viewport

**Files:**
- Modify: `package.json` (`"three": "0.187.0"` exact, devDependency `"@types/three": "0.186.0"`)
- Create: `src/components/voxels/VoxelViewport.tsx`, `src/components/voxels/types.ts`

**Interfaces:**
- Consumes: Task 1 grid, Task 3 `RayHit` + `raycastGrid`, Task 5 `greedyQuads` + `buildMesh` (with `scale = 1`, so
  viewport units are voxels).
- Produces (`types.ts`):
  - `type VoxelTool = "add" | "erase" | "paint" | "pick" | "fill" | "box"`
  - `type ViewPreset = "reset" | "front" | "side" | "top"`
  - `interface StrokeEvent { phase: "start" | "move" | "end"; hit: RayHit | null; shiftKey: boolean }`
- Produces (`VoxelViewport.tsx`, default export, client-only):
  ```ts
  interface VoxelViewportProps {
    grid: VoxelGrid; colors: string[]; tool: VoxelTool;
    preview: Vec3[];                       // cells to ghost (hover / box drag), drawn translucent
    oneFingerOrbit: boolean;
    view: { preset: ViewPreset; nonce: number };
    onStroke(event: StrokeEvent): void;
    onReady?(api: { snapshotPng(): string }): void;
    onUnsupported?(): void;                // no WebGL2
  }
  ```
- Behaviour: `WebGLRenderer({ preserveDrawingBuffer: true })` (for PNG), `setPixelRatio(min(dpr, 2))`; render on
  demand only (after prop change, controls `change`, resize); `OrbitControls` with mouse right/middle drag and two
  fingers orbit/pinch; one finger (or left mouse) emits strokes unless `oneFingerOrbit`; canvas `touch-action:
  none`; ground grid + axis gizmo; mesh rebuilt from `greedyQuads` when `grid`/`colors` change; dispose geometry,
  materials, renderer and controls on unmount.

- [ ] **Step 1: Install** `npm install three@0.187.0 && npm install -D @types/three@0.186.0` (check
  `package.json` shows the exact `0.187.0`).
- [ ] **Step 2: Implement** `types.ts` and `VoxelViewport.tsx`.
- [ ] **Step 3: Verify** `npx tsc --noEmit -p .` and `npm test` pass. (Visual check happens in Task 8.)
- [ ] **Step 4: Commit** (`/commit`).

### Task 8: Voxels editor page

**Files:**
- Create: `src/app/(app)/project/[projectId]/voxels/page.tsx` (orchestration only)
- Create: `src/components/voxels/VoxelToolbar.tsx` (tools, symmetry toggles, view buttons, size select, one-finger
  orbit toggle), `src/components/voxels/ColorStrip.tsx` (model colours, palette picker), 
  `src/components/voxels/SpriteImportDialog.tsx`, `src/components/voxels/BlenderCard.tsx`
- Create: `src/lib/download.ts` — `downloadBlob(filename: string, blob: Blob): void`
- Modify: `src/app/(app)/layout.tsx` (nav entry `{ icon: Box, name: "Voxels", path: "voxels", color:
  ASSET_KINDS.model.color, onAccent: "#0b0b10" }` after Pixel Art), `src/app/page.tsx` (`tools` entry `{ icon: Box,
  name: "Voxel Models", description: "Build chunky 3D props and characters with your palettes. Export to Blender,
  Godot and Unity." }`)

**Interfaces:**
- Consumes: Tasks 1–7; `useAutosave`, `useHistory`, `useUndoShortcuts`, `UndoRedoButtons`, `SaveIndicator`,
  `ExportMenu`, `ExamplesBar collections={["models"]}`, `LinkedAssets` (type `model`), `useOpenParam`,
  `useStorageVersion`, `storage.save/getAll/delete("models", …)`, `addLink`, `spriteFrameSrc` + `loadImage` from
  `src/lib/pixels.ts`.
- Produces: `BlenderCard({ variant }: { variant: "full" | "compact" })` — dismiss stored under
  `localStorage["gds-ui:blender-card-dismissed"]` in try/catch; full wording from the research doc's
  "Recommendation card wording".
- Page state: `doc = { name, grid, colors, paletteId? }` (immutable updates); history over `{ voxels: string, size,
  colors }` snapshots (encode with `encodeVoxels`); autosave `persist` writes `size`, `voxels`, `colors`,
  `paletteId`, `thumbnail = renderThumbnail(...)`, `updatedAt`, keyed by `resetKey = activeModelId`.
- Page loads the viewport with `next/dynamic(() => import("@/components/voxels/VoxelViewport"), { ssr: false })`.
- Behaviour decided by the spec: new model 16³ with the project's first palette else `FALLBACK_COLORS`; tool
  semantics (add at `hit.place`, erase/paint/pick/fill at `hit.cell`, box = drag on the hit plane then confirm
  height with a second drag/click — exact gesture is the builder's call); symmetry applied via `mirrorCells` to
  every add/erase/paint/box; size change via `resizeGrid` with `confirm()` showing `lost` when > 0; "Use palette"
  via `remapToPalette` as one undo step; sprite import creates a new model named `"<sprite name> 3D"` and calls
  `addLink(projectId, {type:"model", id}, {type:"sprite", id: spriteId})`; WebGL2 missing → `BlenderCard
  variant="full"` with a one-line explanation; empty state (no models) shows the "New model", "From sprite" buttons
  and `BlenderCard variant="full"`.
- Keyboard (when not typing), matching Pixel Art's `TOOL_BY_KEY` where tools overlap: `B` add, `E` erase,
  `P` paint, `I` pick, `G` fill, `R` box; Ctrl/⌘+S calls `flush()` like Pixel Art.

- [ ] **Step 1: Implement** `download.ts`, `BlenderCard`, `ColorStrip`, `VoxelToolbar`, `SpriteImportDialog`, page,
  nav and landing entries.
- [ ] **Step 2: Verify** `npx tsc --noEmit -p .`, `npm test`, `npm run lint` (no new findings vs `main`).
- [ ] **Step 3: Verify in the browser pane** (dev server on 4317): create a model, add/erase/paint/pick/fill/box
  with and without symmetry, undo/redo by button and Ctrl/⌘+Z, reload and see it saved, dashboard shows the
  thumbnail, sprite → voxels from the `hero` example, shrink 16→8 with voxels outside shows the confirm and Cancel
  keeps them, `/project/<id>/voxels?open=<id>` opens the model, no console errors.
- [ ] **Step 4: Verify bundle split:** `npm run build`, then `grep -l "WebGLRenderer" .next/static/chunks/*.js`
  and confirm no chunk listed is loaded by `/projects` or `/project/<id>/pixel-art` (check network tab in the pane).
- [ ] **Step 5: Commit** (`/commit`).

### Task 9: Exports and Blender/Godot checks

**Files:**
- Create: `src/lib/voxels/export-glb.ts` — `exportGlb(mesh: MeshArrays, name: string): Promise<Blob>` (dynamic
  `import("three")` + `three/examples/jsm/exporters/GLTFExporter.js`; `BufferGeometry` with position, normal,
  color, index; `MeshStandardMaterial({ vertexColors: true })`; `parseAsync(scene, { binary: true })`)
- Modify: `src/app/(app)/project/[projectId]/voxels/page.tsx` (`ExportMenu` items)

**Interfaces:**
- Consumes: Task 5 `greedyQuads`, `buildMesh`, `toObj`, `toVox`; Task 7 `snapshotPng`; Task 8 `downloadBlob`,
  `BlenderCard`.
- Export menu items, in order: "3D model (.glb)" — "For Blender, Godot, Unity and the web"; "OBJ + MTL" — two
  downloads; "MagicaVoxel (.vox)"; "Image (.png)" — current view; last: "Open in Blender (free)" item whose
  description is the compact card text and which opens `https://www.blender.org/download/` in a new tab.
  All export items disabled with description "Add some voxels first" when `countVoxels(grid) === 0`. Menu footer
  / descriptions keep "free, no watermark" wording consistent with other tools.

- [ ] **Step 1: Implement** `export-glb.ts` and the menu.
- [ ] **Step 2: Install Blender** `brew install --cask blender` (owner approved).
- [ ] **Step 3: Verify glb in Blender:** export a 16-high test column (or Pip after Task 10), then
  `/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python-expr "import bpy; [bpy.data.objects.remove(o) for o in list(bpy.data.objects)]; bpy.ops.import_scene.gltf(filepath='<file>.glb'); o=[o for o in bpy.data.objects if o.type=='MESH'][0]; print('DIMS', tuple(round(d,3) for d in o.dimensions), 'COLORS', len(o.data.color_attributes))"`
  — Expected: `DIMS` Z ≈ 1.6 (Blender is Z-up), `COLORS` ≥ 1.
- [ ] **Step 4: Verify obj in Blender:** same with `bpy.ops.wm.obj_import(filepath='<file>.obj')` — Expected same
  dimensions and one material per colour; render or inspect `Kd` vs the hex values and switch `toObj` to linear
  `Kd` only if Blender shows them too light.
- [ ] **Step 5: Verify glb in Godot 4:** temp project in the scratchpad with the `.glb`; `godot --headless --path
  <dir> --import`; a `-s` script that loads it, instantiates, and prints the merged mesh AABB — Expected size Y ≈
  1.6, upright.
- [ ] **Step 6: Note** for the owner: `.vox` check in MagicaVoxel by hand (model upright, not mirrored, colours
  right).
- [ ] **Step 7: Commit** (`/commit`).

### Task 10: Pip's Quest examples

**Files:**
- Create: `src/lib/examples/models.ts`
- Modify: `src/lib/examples/types.ts` (`EXAMPLE_SLUGS.models = ["hero-3d", "coin-3d", "chest-3d", "slime-3d",
  "tree-3d"]` — suffixed because example ids are `<projectId>--ex--<slug>` and `hero`, `coin`, … are already
  sprite slugs), `src/lib/examples/index.ts` (`MODULES`, `EXAMPLE_LINKS`: model hero-3d→sprite hero, coin-3d→sprite
  coin, chest-3d→sprite chest, slime-3d→sprite slime, tree-3d→tilemap meadow)

**Interfaces:**
- Consumes: Task 1 grid/codec, Task 6 `renderThumbnail`, `ExampleModule` (`collection: "models"`).
- Produces: `modelExamples: ExampleModule[]`; helper `layersToGrid(size: Vec3, layers: string[][], key:
  Record<string, number>): VoxelGrid` (layer per Y from bottom, row per Z, char per X, `.` empty) local to the file.
- Data: Pip exactly 16 voxels tall in 16³ (so the Blender check reads 1.6 m); colours taken from the matching
  sprites in `art.ts`; each item `{ id: ctx.id(slug), name, size, colors, voxels, thumbnail }`.

- [ ] **Step 1: Implement** the module and registrations.
- [ ] **Step 2: Verify** in the pane: new project with examples shows five voxel models with thumbnails on the
  dashboard and links to their sprites/tilemap; "Remove examples" in Voxels removes only them; adding examples to
  the existing "Size test" project works.
- [ ] **Step 3: Verify** re-run Task 9 Step 3 with Pip: `DIMS` Z = 1.6.
- [ ] **Step 4: Commit** (`/commit`).

### Task 11: Phone layout, full verification and docs

**Files:**
- Modify: Voxels components (`max-md:` classes only), `README.md` (tool list), `CHANGELOG.md` (Unreleased: Voxels),
  `HANDOVER.md` (tool table, known gaps, `.vox` hand-check), `docs/research/3d-tool-feasibility.md` (status line:
  built)

- [ ] **Step 1: Phone pass** at 390×844 in the pane: tool and colour strips collapse like Pixel Art, one finger
  paints, two fingers orbit/pinch, the one-finger-orbit toggle works, no horizontal overflow
  (`document.documentElement.scrollWidth <= innerWidth`).
- [ ] **Step 2: Full check** per `CLAUDE.md` → Testing: `npm run build`, `next start` on 4317, Playwright (or the
  pane) at 1440×900 and 390×844 — create project with examples, open every tool, no page errors, no phone overflow;
  desktop screenshots of Pixel Art and Tilemap unchanged vs `main`.
- [ ] **Step 3: Docs** updated.
- [ ] **Step 4: Verify** `npm test`, `npx tsc --noEmit -p .`, `npm run lint` (no new findings).
- [ ] **Step 5: Commit** (`/commit`); ask the owner before pushing or opening a PR (title
  `feat: Voxels tool`, body with what/why/how to test, migration note).
