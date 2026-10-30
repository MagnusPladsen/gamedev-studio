# Asset context menu — design

Status: approved by the owner, 30 Oct 2026. Build after the Voxels tool (`feature/voxels`) lands, on its own
branch, because both touch every tool's asset list.

## Intent

Everything in a project is an asset that can link to any other, but today the only way to act on an asset is to open
its tool, and the only way to link is the LinkedAssets panel inside an editor. Right-clicking anything (a sprite, a
saved sound, a story entry, an issue card, a link chip) should give the usual file actions plus the studio's real
power move: connecting this thing to a note, a diagram, a task or any other asset without leaving where you are.

## Goals (owner-decided)

**Where it works: everywhere an asset is shown**
- Project dashboard rows and every tool's own list: Pixel Art sprites, Sprite Sheets, SFX saved sounds, Music saved
  tracks, Tilemap maps and the tilemap's tile picker, Story, Dialogue, Palettes, Notebook, Diagrams, Voxels models,
  Task Board cards / backlog rows / all-issues rows.
- LinkedAssets chips, story and notebook `[[wiki links]]`, story backlinks and graph nodes, diagram nodes that point
  at an asset.

**Copy and paste**
- Duplicate in place ("Pip copy").
- Copy → Paste elsewhere: an in-app clipboard; "Paste" appears on the dashboard and in each tool's list (right-click
  the list background, or a Paste button when the clipboard holds that tool's type), in the same or another project.
- Copy to system clipboard, by type: sprite → PNG image (first frame); palette → hex list; note / story / dialogue →
  text; issue → "KEY Title"; others → name.
- Copy name; Copy link (URL that opens the asset in the studio).

**Link actions**
- Link to note… — a modal to search and pick an existing note.
- New note about X — creates a note linked to X and opens it.
- Add to diagram… — modal to pick a diagram (or "New diagram"); adds a node pointing at X.
- Create task — new Task Board issue titled after X, linked to X, opened on the board.
- Link to asset… — searchable picker over every asset in the project (same grouping as LinkedAssets).

**Phones**: long-press opens the menu, and a small `⋯` button on each row opens the same menu.

**Pinning (owner-decided, added 30 Oct 2026)**
- Pin tools: a pinned tool moves to the top of the side menu's tool list (pin/unpin from the tool row's right-click
  menu and its `⋯` on phones), in pin order.
- Pin assets: "Pin to sidebar" in every asset's menu adds it to a **Pinned** section above the tools (icon in its tool
  colour + name, click opens it via `assetHref`, right-click gives the normal asset menu plus Unpin). Note's existing
  "Pin" (pin within Notebook) stays separate and is labelled "Pin in Notebook".
- Pins are per project and synced: stored on the `Project` record (`pins?: { tools: string[]; assets: AssetRef[] }`),
  so they travel with cloud sync and project export; no migration needed (projects are JSON bodies). Deleting an asset
  removes its pin; pins to missing assets are skipped when rendering.

## Extra items (Claude's suggestions, all confirmed in scope by the owner)

- Open, Open in new tab, Rename…, Delete… (confirm; also removes its links so no dangling chips remain).
- Show links — opens the dashboard filtered to X and what it links to.
- Type shortcuts that already exist as flows:
  - Sprite: Use in Tilemap, Make 3D model (sprite → voxels), Export PNG.
  - Palette: Use in Pixel Art, Use in Voxels.
  - Sound / Music: Play / Stop (preview volume).
  - Note: Pin / Unpin. Issue: Move to column ▸, Add to sprint ▸.
- Inside Pixel Art's frame strip (owner listed "animation pixel"): right-click a frame → Duplicate, Delete, Copy as
  PNG, Move left/right. Tilemap tile picker: Open sprite, Copy, Link…

## Non-goals

Multi-select and bulk actions; drag-and-drop between projects; replacing each tool's existing buttons; a command
palette; right-click inside canvases for drawing tools (pixel/tile/voxel canvases keep their current mouse behaviour).

## Anti-goals

- Hijacking the browser's native menu on text fields and editable content (spellcheck, paste text must keep working).
- Different menus for the same asset in different places (one registry decides the items).
- Desktop layout shifts from the `⋯` button (it's `max-md:` visible only; on desktop it appears on row hover only
  where the row already has hover actions, or not at all).

## Constraints

- Studio conventions (`CLAUDE.md`): `var(--accent)`, `var(--text-primary)` on secondary items, icon-only buttons with
  `title` + `aria-label`, phone fixes `max-md:` only, every change autosaves through `storage`, undo where the
  surface already has undo.
- Menu is keyboard-accessible (`role="menu"`, arrow keys, Enter, Esc, focus return) and positioned at the pointer,
  flipped to stay on screen, rendered in a portal.
- Adding a node to a diagram that is open in another tab or the current view must not be overwritten by the
  editor's local state (reload via `reloadView()` / storage version).

## Decided by Claude (builder's calls, open to override)

- One `AssetContextMenu` provider in `(app)/layout.tsx` + `useAssetMenu()` hook; surfaces call
  `openAssetMenu(event, ref)`; items come from a registry keyed by `AssetType` (common items + per-type items).
- New shared pieces in `src/components/`: `ContextMenu` (portal, positioning, keyboard), `AssetPickerModal`
  (search + grouped list, reused by Link to note / Add to diagram / Link to asset), `Toast` ("Copied", "Linked to
  Pip's jump" with an Open action).
- Generic asset operations in `src/lib/asset-actions.ts`: `duplicateAsset`, `renameAsset`, `deleteAsset` (with link
  cleanup), `copyToSystemClipboard`, built on `storage` + `ASSET_KINDS` (`name` vs `title` handled once).
- In-app clipboard lives in memory plus `sessionStorage` (survives a reload, not shared between tabs).
- Paste across projects: self-contained types (sprite, sound, music, palette, note, story, dialogue, model, issue)
  paste anywhere; types that reference other assets by id (tilemap, sprite sheet, diagram) paste into the same
  project only, with the item disabled and a reason elsewhere. Links are never copied.
- Pasted names get " copy" when the name already exists in that project.
- Long-press: 500 ms, cancelled by 8 px movement; suppresses the click that follows.
- Standalone assets vs embedded items: every `AssetType` row (including story entries and issues) is an asset and
  uses `asset-actions.ts`. Pixel Art frames are embedded in a sprite: the frame-strip menu is a separate in-editor
  menu built on Pixel Art's own frame functions (and its undo). Tile-picker tiles and diagram nodes show sprites /
  linked assets, so their menu is the menu of the referenced asset.
- Delete: removes the asset and its `links` rows; when other assets reference it by id (tilemap cells, sprite sheet
  frames, diagram nodes), the confirm lists them ("Used in Meadow, Characters") and those references are left as
  they are (each tool already has to cope with a missing sprite; the builder checks and makes them render an empty
  cell / placeholder rather than crash). `[[wiki]]` text is never edited.
- Add to diagram: uses the existing `DiagramNode.data.asset` pointer (no new node kind); the node is a "custom"
  node labelled with the asset name, placed to the right of the rightmost node (or at the origin of an empty
  diagram); after saving, `reloadView()` so an open diagram editor picks it up.
- Paste: the clipboard is a snapshot taken at copy time; it can be pasted any number of times and still works after
  the source is deleted. Copies get a new id, lose `example: true`, and never carry links. A pasted issue gets the
  next key of the target project, status = the board's first column, no sprint (backlog).
- In-app clipboard size: kept in memory; mirrored to `sessionStorage` only when under 2 MB, otherwise memory only.
- Cross-project paste writes through `storage.save` so cloud/folder persisters sync it as usual.
- A note can't be linked to itself (item hidden); "Open" in toasts uses `assetHref`.
- Base: start from `main` after `feature/voxels` is merged, so the `model` type is in the registry from day one.
- Rollout order (one PR): shared pieces → dashboard + LinkedAssets → tool lists → wiki links/board/diagrams →
  per-type extras → pixel-art frames and tile picker.

## Done when

- Right-click (desktop) and long-press / `⋯` (390×844) open the same menu on every surface listed above.
- Each owner-decided action works and autosaves; deleting cleans links; paste works same-project and cross-project
  per the rules above.
- Keyboard: open with Shift+F10 / Menu key on a focused row, navigate, Esc closes and returns focus.
- No new page errors, no phone overflow; desktop screenshots of tools unchanged except for the menu itself.
- `npm run build`, typecheck and lint pass; unit tests for `asset-actions.ts` and the item registry.
