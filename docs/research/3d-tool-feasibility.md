# 3D tool feasibility

Research, 30 Oct 2026. Status: built as the Voxels tool (branch `feature/voxels`, Oct 2026).

## Verdict

**Build a small voxel editor, plus a "for real 3D modelling, use Blender (free)" card. Don't build a Blender clone.**

- A Blender clone is both very hard and pointless. Blender is free, open source (GPL) and has 25+ years of work
  behind it. A browser copy would take person-years and still lose on every point.
- A voxel editor (MagicaVoxel style) fits the studio well:
  - it is grid-based like Pixel Art and Tilemap, and uses the project palettes;
  - beginners can make a usable game asset in minutes;
  - it exports glTF, which Blender, Godot and three.js all import directly.
- An MVP is roughly **2–3 weeks** of focused work (10–15 developer-days). The extra code is about 180 KB gzipped
  and loads on the 3D route only.
- The card makes the tool's scope clear. It also turns "this can't do X" into "here's the free tool that can, and
  your model opens in it".

## Options compared

Effort means focused developer-days for an MVP that meets the studio's conventions: autosave, undo/redo, export,
examples and a phone layout.

| Option | What it is | Effort | Beginner value | Fit with the studio | Verdict |
| --- | --- | --- | --- | --- | --- |
| **A. Primitive blockout** | Place, move, scale and rotate cubes, spheres, cylinders and cones; colour them; export glTF/OBJ | 6–9 days | Medium. Good for greyboxing levels and props, but Godot (CSG) and Unity (ProBuilder) already do this inside the engine | Weak link to other tools; the look is "programmer art" | Possible later, as a mode of B |
| **B. Voxel editor** | Paint, erase, fill and box tools on a 3D grid; palette colours; mirror; export glTF, OBJ, `.vox` and PNG | 10–15 days | **High.** Nothing to learn about topology; results look intentional (like Crossy Road or Minecraft); works for characters, props and tiles | **Strong.** Same mental model as Pixel Art; uses project palettes; can turn a sprite into a voxel model | **Build** |
| **C. Low-poly mesh editor** | Select vertices, edges and faces; extrude; move; merge; UVs | 5–8 weeks for a fragile MVP, then a long tail | Low to medium. Mesh editing is exactly where beginners struggle, and Blender teaches it better | Weak: the studio would have to explain topology, normals and UVs | Don't build; point to Blender |
| **D. Blender-like** | Modelling, sculpting, UV unwrapping, materials, rigging, animation, rendering | Person-years | Negative: a worse Blender | None | Out of scope |

Why D is out of scope: each Blender subsystem (half-edge mesh editing with modifiers, UV unwrapping, a node-based
material system, armatures with weight painting, an animation graph, a path tracer) is a product of its own. The
studio's strength is many small tools that link together, not one deep one.

## Proposed MVP (option B, "Voxels" tool)

**Editing**
- Grid sizes 8³, 16³, 32³ and 64³; resizable later. 64³ is the cap for the MVP; MagicaVoxel goes up to 256³.
- Tools: add, erase, paint (recolour), colour picker, fill (face flood), box (drag a cuboid to add or erase).
- Symmetry on X / Y / Z, like the pixel-art mirror item in `HANDOVER.md`.
- Colours come from a project palette (`?palette=` as in Pixel Art). Up to 255 colours, which matches `.vox`.
- Camera: orbit, pan, zoom, reset, and views snapped to front, side and top.
- Ground grid, axis gizmo, and a hover preview of the voxel about to be placed.

**Fits the studio**
- Autosave + `SaveIndicator`, undo/redo + `UndoRedoButtons` + shortcuts, `ExamplesBar`, `LinkedAssets`, own colour.
- **Sprite → voxels:** pick a Pixel Art sprite and extrude it one voxel deep, as a quick start for a 3D version of
  a 2D character. It reads `frames[0].pixels` through `src/lib/pixels.ts`.
- Thumbnail: a small PNG render stored on the asset, so the dashboard, links and story hovers show it.

**Export (via `ExportMenu`, free and with no watermark)**
- `.glb` (glTF binary) as the main format. Blender, Godot 4, three.js, Babylon, Bevy and Unity (with glTFast) all
  import it.
- `.obj` + `.mtl`, for older pipelines and Unity's built-in import.
- `.vox` (MagicaVoxel), so users can take the model further in MagicaVoxel or vengi.
- PNG render of the current view.
- Merge faces with greedy meshing and drop hidden faces before export, so a 32³ model is hundreds of triangles
  rather than tens of thousands.

**Examples (hand-made data, never AI)**
- Pip, the coin, the chest, a slime and a meadow tree, matching the existing Pip's Quest slugs and linked to the
  same-named sprites.

**Not in the MVP**
- Animation, rigging, textures or UVs, lighting or rendering settings, scenes holding several models, and importing
  meshes (only `.vox` import, if it's cheap).

## Tech

**Library: vanilla Three.js** (`three@0.187.0`, MIT), with its bundled addons:
`OrbitControls`, `GLTFExporter`, `OBJExporter` and optionally `TransformControls` for option A later.

| Setup | Minified | Gzipped |
| --- | --- | --- |
| three (renderer, meshes, materials, lights, raycaster, `InstancedMesh`) + Orbit/TransformControls + GLTF/OBJ exporters + GLTFLoader | 712 KB | **179 KB** |
| `@react-three/fiber@9.8.2` + `@react-three/drei@10.7.9` (Canvas, OrbitControls, TransformControls, Grid) + exporters | 1,027 KB | 273 KB |

Measured with esbuild in a scratch folder (React excluded).

- **Prefer vanilla three over react-three-fiber.**
  - r3f+drei add about 95 KB gzipped.
  - r3f pins React minors (peer `react >=19 <19.4`; the app is on 19.3.0), so it would block React upgrades.
  - The existing editors already drive `<canvas>` imperatively from effects, so vanilla three matches that style.
  - r3f is only worth it if a future scene editor nests a lot of declarative objects.
- **Lazy loading:** App Router already splits code per route, so `three` only ships with the 3D page. To be safe,
  load the viewport with `next/dynamic(() => import(...), { ssr: false })` from the client page
  (`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`). WebGL needs `window`, and this keeps three
  out of any prerender. Load the exporters with `import()` when an `ExportMenu` item is clicked, which keeps about
  20 KB off first paint.
- **Pin `three` exactly.** It ships a breaking "r" release roughly every month.
- **Rendering:**
  - one merged `BufferGeometry` per model, with hidden faces culled and vertex colours, rebuilt incrementally per
    8³ chunk on edit; or `InstancedMesh` for a first version;
  - render on demand (only after a change or camera move), not in a constant `requestAnimationFrame` loop, to save
    phone batteries;
  - cap `devicePixelRatio` at 2;
  - pick voxels with a grid DDA raycast, which is cheaper and more exact than raycasting meshes.
- **Phone controls:**
  - one finger paints, two fingers orbit and pinch-zoom (MagicaVoxel mobile style);
  - a toggle switches one finger to orbit for people who prefer that;
  - `touch-action: none` on the canvas; tool and palette strips collapse under `max-md:` like Pixel Art;
  - `OrbitControls` already supports pointer and touch events.
- **Data model:**
  - `VoxelModel { id, projectId, name, size: [x,y,z], paletteId?, colors: string[], voxels: string, thumbnail?, tags, createdAt, updatedAt }`;
  - `voxels` is a run-length-encoded `Uint8Array` of palette indices, stored as base64;
  - a 64³ grid is 262 KB raw but mostly empty, so RLE makes it a few KB. That keeps it well under the 5 MB row
    trigger in the init migration and kind to the guest `localStorage` quota.
- **Axes and units:** glTF is Y-up and in metres. Blender converts to Z-up on import, so export with 1 voxel =
  0.1 m (configurable) and centre the model on its base. Check this by importing into Blender and Godot.

### Existing open-source tools (to compare with, link to, or borrow ideas from)

| Tool | Runs in | Licence | Activity | Use to us |
| --- | --- | --- | --- | --- |
| [three.js](https://github.com/mrdoob/three.js) (+ its [editor](https://threejs.org/editor/)) | Browser | MIT | Very active | **The base.** The editor is a useful reference for gizmos and export code |
| [react-three-fiber](https://github.com/pmndrs/react-three-fiber) / [drei](https://github.com/pmndrs/drei) | Browser | MIT | Active | Possible but not recommended (see above) |
| [vengi](https://github.com/vengi-voxel/vengi) | Desktop + older web build | MIT | Very active | Reference for voxel formats and tools; code could legally be borrowed (with attribution) |
| [Goxel](https://github.com/guillaumechereau/goxel) | Desktop (C) | GPL-3.0 (+ commercial) | Active | Reference only. GPL can't be copied into this MIT repo |
| [Blockbench](https://github.com/JannisX11/blockbench) ([web app](https://web.blockbench.net)) | Browser + desktop | GPL-3.0 | Very active | Reference only; **a great tool to recommend** for boxy low-poly models with pixel-art textures |
| [Voxel Builder](https://github.com/nimadez/voxel-builder) | Browser | GPL-3.0 | Active | Reference only |
| [SculptGL](https://github.com/stephomi/sculptgl) | Browser | MIT | Archived | Shows sculpting in the browser is possible; not a base |
| [Online3DViewer](https://github.com/kovacsv/Online3DViewer) | Browser | MIT | Active | Reference for import/preview of many formats |
| MagicaVoxel, VoxEdit, Spline | Desktop / browser | Proprietary (freeware / freemium) | — | Comparison only; MagicaVoxel is the UX benchmark |

Licence rule: the studio is MIT (`LICENSE`). MIT code (three.js, vengi, SculptGL, Online3DViewer) may be reused
with its copyright notice kept. GPL-3.0 code (Goxel, Blockbench, Voxel Builder) must not be copied in; read it and
link to it only. There's no tool worth forking as a whole: none would fit the storage cache, the conventions or the
React shell. Building on three.js directly is cheaper.

## Integration checklist

Mirrors how the Task Board added `boards` / `issues`. Many pieces read the registries and pick the new type up
on their own; these are marked *(auto)*.

- [ ] `src/types/index.ts`: add `"model"` to `AssetType`; add the `VoxelModel` interface.
- [ ] `src/lib/storage.ts`: `models: VoxelModel` in `StorableTypes`; `"models"` in `PROJECT_COLLECTIONS`
      (before `"links"`).
- [ ] `src/lib/assets.ts`: `model: { type: "model", collection: "models", label: "Voxel model", path: "voxels",
      color: … }`. Every hue is close to taken already; a warm clay `#d4a373` is the most distinct. Check it as
      `--accent` and pick `--on-accent` (dark text).
- [ ] `src/lib/assets.ts` `summarize()`: return `thumbnail` for `"model"` too (today it only does sprites).
- [ ] `supabase/migrations/<timestamp>_add_models_collection.sql`: drop and re-add `assets_collection_check` with
      `'models'` added to the list in `20261030170000_add_board_collections.sql`.
- [ ] Sync: `src/lib/sync/cloud.ts` and `src/lib/sync/folder.ts` iterate `PROJECT_COLLECTIONS` *(auto)*; the folder
      gets `models.json`.
- [ ] Dashboard (`assets/page.tsx`), `LinkedAssets`, `getRelated`, export/import project *(auto via `ASSET_KINDS` /
      `PROJECT_COLLECTIONS`)*.
- [ ] `src/app/(app)/layout.tsx`: add a nav entry with a lucide `Box` icon and `ASSET_KINDS.model.color`.
- [ ] `src/app/page.tsx`: add to the landing `tools` list ("Voxel Models — build chunky 3D props and characters
      with your palettes; export to Blender, Godot, Unity").
- [ ] Route `src/app/(app)/project/[projectId]/voxels/page.tsx` (client page; viewport via `next/dynamic`,
      `ssr: false`). The project layout already sets `instant = false`.
- [ ] Editor parts: `useAutosave` + `SaveIndicator`; `useHistory` / `useUndoShortcuts` + `UndoRedoButtons`;
      `ExportMenu` at the right of the toolbar; `ExamplesBar collections={["models"]}`; `LinkedAssets`;
      `useOpenParam`; icon-only buttons with `title` + `aria-label`; primary buttons `background: var(--accent)`.
- [ ] Undo: snapshot the RLE string (small), not the decoded array, so 200 history entries stay cheap.
- [ ] Examples: `src/lib/examples/models.ts`, add `models` slugs to `EXAMPLE_SLUGS`, register in `MODULES`
      (`src/lib/examples/index.ts`), link to the matching sprites and story entries.
- [ ] Phone layout with `max-md:` classes only; desktop stays pixel-identical.
- [ ] Blender card (below) in the tool's empty state and in its export menu.
- [ ] Docs: `README.md` tool list, `CHANGELOG.md`, `HANDOVER.md`, and this file's status.
- [ ] Verify as in `CLAUDE.md` → Testing (build, `next start`, Playwright at 1440×900 and 390×844). Also import
      the `.glb` into Blender and Godot 4 and check scale, orientation and colours.

## Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Scope creep: requests for animation, rigging, textures, sculpting | High | Fixed non-goals above; the Blender card is the standard answer |
| Low-end phones or no WebGL2 | Medium | Detect and show a friendly fallback; render on demand; cap DPR and grid at 64³ |
| Touch editing is clumsy in 3D | Medium | Two-finger orbit, a one-finger mode toggle, large hit targets, snapped views; test on a real phone early |
| Export quirks (axes, scale, colours lost in OBJ) | Medium | glTF first; vertex colours plus a palette material; round-trip into Blender and Godot before release |
| Storage growth (guest `localStorage` ~5 MB shared with sprites) | Low with RLE | RLE + base64; small thumbnails (e.g. 96 px); existing "storage full" message |
| three.js breaking changes | Medium | Pin the exact version; upgrade deliberately |
| GPL contamination from copying Goxel, Blockbench or Voxel Builder code | Low if known | Read them only, never copy; reuse MIT code with notices |
| One more tool for a solo owner to maintain | Medium | Keep the MVP small; share palette, history and export pieces; no 3D in other tools yet |
| Users think it's meant to replace Blender | Medium | Name it "Voxels", not "3D Modeller"; the card sets expectations |

## Recommendation card wording

Shown in the Voxels tool's empty state and as the last item of its `ExportMenu`. Uses the tool's accent colour,
dismissible, and remembered per browser.

> **Need more than voxels? Use Blender — it's free.**
> This tool is for quick, chunky models. For smooth shapes, sculpting, UV textures, rigging and animation, use
> [Blender](https://www.blender.org/download/): free and open source, and used for real games and films.
> Export your model as **.glb**, then in Blender choose *File → Import → glTF 2.0*. Your colours come with it.
>
> Also free: [MagicaVoxel](https://ephtracy.github.io/) for big voxel scenes (open our **.vox** export) and
> [Blockbench](https://www.blockbench.net) for boxy low-poly models with pixel-art textures.

Short version for the export menu:

> **Open in Blender (free)** — export .glb, then *File → Import → glTF 2.0* in [Blender](https://www.blender.org/download/).

If nothing gets built, the same card can go on the dashboard or landing page as "3D? We recommend Blender (free)".
That gives most of the value of option D for almost no cost.
