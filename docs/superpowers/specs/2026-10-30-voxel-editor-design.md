# Voxels tool — design

Status: draft for owner approval, 30 Oct 2026. Background research and measurements:
`docs/research/3d-tool-feasibility.md`.

## Intent

GameDev Studio covers 2D art, audio, levels and writing, but nothing 3D. Beginners who want a 3D prop or character
today have to leave the studio for Blender, which is a big jump. A MagicaVoxel-style voxel editor gives them chunky
3D models in minutes with the same mental model as Pixel Art (a grid you paint with palette colours). It also points
to Blender, honestly and up front, for anything beyond voxels.

Success: a beginner opens "Voxels", starts from Pip or their own sprite, paints a model, and drops the `.glb` into
Godot or Blender with correct scale, orientation and colours, without reading docs.

## Goals (owner-decided: full MVP in one go)

- A new tool **Voxels** with full editing, every export below, symmetry, sprite → voxels, Pip's Quest examples,
  dashboard thumbnails and full phone touch editing.
- It follows every studio convention: autosave + `SaveIndicator`, undo/redo + `UndoRedoButtons` + shortcuts,
  `ExportMenu` at the right of the toolbar, `ExamplesBar`, `LinkedAssets`, `?open=` support, its own colour,
  free / no watermark / no sign-up wording at export.
- A Blender recommendation card in the tool (empty state + export menu).

## Non-goals

Animation, rigging, textures/UVs, lighting or render settings, scenes holding several models, importing meshes
(glTF/OBJ/FBX), sculpting, smooth shapes, and 3D in any other tool (tilemap etc.). Requests for these are answered
by the Blender card.

## Anti-goals (would be a failure even if it works)

- Looking like or being named as a Blender replacement ("3D Modeller", "3D Studio").
- Shipping three.js to pages other than the Voxels route, or slowing first paint of other tools.
- Changing desktop layout or behaviour of any existing tool.
- AI-generated models or examples.
- Copying code from GPL projects (Goxel, Blockbench, Voxel Builder).

## Constraints

- Next.js 16 App Router with `cacheComponents`; client page under `project/[projectId]/` (layout already sets
  `instant = false`). Read `node_modules/next/dist/docs/` before Next-specific code (`AGENTS.md`).
- Storage goes through the synchronous `storage` cache; new collection needs a Supabase migration widening
  `assets_collection_check`.
- Guest data lives in `localStorage` (~5 MB shared), so model data must be compact.
- Phone fixes use `max-md:` classes only; desktop must stay pixel-identical elsewhere.
- Repo is MIT: only MIT/permissive code may be reused, with notices.
- No test suite; verification is build + `next start` + Playwright at 1440×900 and 390×844 (`CLAUDE.md` → Testing).

## Decided

**Owner decisions**
- Full MVP in one delivery (not a lean slice).
- Exports: `.glb`, `.obj` + `.mtl`, `.vox`, PNG render of the current view.
- Extras: X/Y/Z symmetry, sprite → voxels, Pip's Quest examples, dashboard thumbnails.
- Phone: full touch editing (one finger edits, two fingers orbit/pinch-zoom, toggle for one-finger orbit).
- Locked (baked into the migration and saved data): asset type `model`, collection `models`, route
  `/project/[projectId]/voxels`, `voxels` stored as RLE + base64.
- Verification: Claude installs Blender (`brew install --cask blender`) and checks `.glb`/`.obj` imports
  headlessly; Godot 4 is already installed; the owner checks `.vox` in MagicaVoxel by hand.

**Builder's calls (Claude), open to owner override**
- Name **Voxels**, label "Voxel model", lucide `Box` icon, colour clay `#d4a373` with dark `--on-accent`.
- Vanilla `three` pinned to an exact version (no react-three-fiber), viewport loaded with `next/dynamic`
  (`ssr: false`), exporters loaded with `import()` on click.
- Data: `VoxelModel { id, projectId, name, size: [x, y, z], paletteId?, colors: string[], voxels: string,
  thumbnail?, tags, createdAt, updatedAt }`; `voxels` is run-length-encoded palette indices (0 = empty, 1–255 =
  `colors[i-1]`) as base64. Undo history snapshots that string.
- Grid sizes 8³, 16³, 32³, 64³ (cap 64³); new model defaults to 16³; resizing keeps voxels anchored at the
  bottom-centre and crops what no longer fits (with a confirm when anything would be lost).
- Colours: a model keeps its own `colors` (max 255). The default for a new model is the project's first palette,
  else the Pip's Quest meadow colours. "Use palette" on a model that already has voxels replaces `colors` with
  the palette's colours and remaps every voxel to the nearest new colour, so the model keeps its look; it is one
  undo step. `paletteId` only records where the colours came from; later edits to that palette don't follow.
- Tools: add, erase, paint, colour picker, fill (flood across connected same-colour voxels on the clicked face's
  plane), box add/erase (drag a rectangle on a plane, then the height). Shortcuts mirror Pixel Art where they
  overlap.
- Export scale: 1 voxel = 0.1 m, Y-up, model centred on X/Z and resting on Y = 0. Meshes are greedy-meshed with
  hidden faces removed; colours as vertex colours (glTF) and per-colour materials (OBJ/MTL).
- Grids stay cubic in the UI; `size` is `[x, y, z]` in data so non-cubic grids can come later without a format
  change.
- Sprite → voxels always creates a new model (no overwrite, no undo entry; delete it to undo). It uses the
  sprite's first frame, one voxel deep, standing upright (sprite rows → Y), centred in the smallest cubic grid
  that fits. Sprites larger than 64 px in either dimension are refused with a message. Colours are matched
  exactly or appended (up to 255; beyond that, nearest match). The sprite and the model are linked
  automatically.
- Thumbnail: 96 px PNG from a small canvas-2D isometric renderer (`src/lib/voxels/thumbnail.ts`, no three.js),
  used everywhere: after each autosave in the editor and in `ExampleModule.build()` for examples, so thumbnails
  look the same and three.js stays on the Voxels route. Stored on the asset; `summarize()` returns it for `model`.
- Examples: Pip (hero), coin, chest, slime, meadow tree — hand-placed data, slugs added to `EXAMPLE_SLUGS.models`.
  Pip, coin, chest and slime link to their same-named sprites; the tree links to the `meadow` tilemap. No
  existing tool's examples change.
- No WebGL2 → friendly message with the Blender card instead of the editor.
- Blender card wording as in the research doc; dismissible, remembered per browser in `localStorage`.

## Left to the builder

Internal module layout, chunked remeshing vs `InstancedMesh`, raycast method, exact toolbar arrangement on desktop
(following Pixel Art), keyboard shortcut letters that don't clash, and how the phone strips collapse — as long as the
constraints above hold.

## Done when

- All goals work at 1440×900 and 390×844 with no page errors or horizontal overflow; other tools unchanged.
- A `.glb` export of the Pip example imports into Blender and Godot 4 upright, about 1.6 m tall for a 16-high model,
  with colours; `.obj`, `.vox` and PNG open in Blender, MagicaVoxel and an image viewer.
- `npm run build`, `npx tsc --noEmit -p .` pass; no new lint findings.
- README, CHANGELOG, HANDOVER updated; migration added.
