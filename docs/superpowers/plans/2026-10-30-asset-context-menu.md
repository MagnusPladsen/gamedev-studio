# Asset Context Menu + Sidebar Pinning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Right-click (desktop) or long-press / `⋯` (phones) on any asset anywhere in the studio opens one menu
with file actions, copy/paste, link actions and per-type shortcuts; pinned tools and assets sit at the top of the
side menu.

**Architecture:** Pure, unit-tested logic in `src/lib/` (menu positioning, long-press, asset actions, in-app
clipboard, pins, the menu item registry, an autosave flush registry). One `AssetContextMenuProvider` in
`src/app/(app)/layout.tsx` turns registry entries into a portal-rendered `ContextMenu` and runs the actions;
surfaces only spread `assetTriggerProps(ref)` and render `<AssetMenuButton>` (phones). Before any action changes an
asset whose editor is on screen, the provider flushes every pending autosave, applies the change, then re-mounts the
editor (`reloadView()`) on `?open=<id>` so local editor state can never overwrite it.

**Tech Stack:** Next.js 16.4.3 (App Router, `cacheComponents`), React 19.3, Tailwind 4, lucide-react, uuid,
vitest 5 (`npm test`, node environment, `src/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-10-30-asset-context-menu-design.md`

## Global Constraints

- Branch `feature/context-menu`. Commit after each task (`/commit` skill, stage named files only, never
  `git add -A`); never push without asking.
- Commit format: conventional subject ≤ 72 chars, bullet body saying why, trailer
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Before using `useRouter` / `useSearchParams` read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md`
  and `use-search-params.md`. Client pages that read search params stay under the `<Suspense>` in `(app)/layout.tsx`.
  No route segment config (`dynamic`) — `cacheComponents` forbids it.
- Menu labels (verbatim): "Open", "Open in new tab", "Rename…", "Delete…", "Duplicate", "Copy", "Paste", "Copy name",
  "Copy link", "Link to note…", "New note about X", "Add to diagram…", "Create task", "Link to asset…", "Show links",
  "Use in Tilemap", "Make 3D model", "Export PNG", "Use in Pixel Art", "Use in Voxels", "Play" / "Stop",
  "Move to column ▸", "Add to sprint ▸", "Pin to sidebar" / "Unpin from sidebar", "Pin in Notebook" /
  "Unpin in Notebook". Frame strip: "Duplicate", "Delete", "Copy as PNG", "Move left", "Move right". Tile picker =
  the sprite's own menu. Tool rows: "Pin to top" / "Unpin". (`▸` is drawn by `ContextMenu` for any entry with a
  submenu; the label text is "Move to column" / "Add to sprint".)
- System-clipboard item label by type: sprite "Copy as PNG", palette "Copy hex codes", note / story / dialogue
  "Copy text", issue "Copy key and title"; other types have no extra item ("Copy name" covers "others → name").
- Copy rules: duplicate names get `" copy"` (`"Pip copy"`, then `"Pip copy 2"`); pasted names get `" copy"` only when
  the name already exists in the target project. Copies get a new id, lose `example: true`, never carry links
  (`links` rows or `StoryEntry.links`). Pasted issue: next key of the target board, `status = board.columns[0].id`,
  `sprintId: null`. Duplicated issue: new key, same status and sprint.
- Self-contained types paste anywhere: sprite, sound, music, palette, note, story, dialogue, model, issue.
  `tilemap`, `spritesheet`, `diagram` paste into the source project only (item disabled with a reason elsewhere).
- Clipboard: snapshot at copy time, pasteable any number of times, survives deleting the source; memory plus
  `sessionStorage` key `gds-asset-clipboard`, mirrored only when the JSON is under 2 MB (2 × 1024 × 1024 bytes UTF-8).
- Long-press: 500 ms, cancelled by more than 8 px movement, touch/pen only (never mouse), suppresses the click that
  follows.
- Toast copy: "Copied"; "Linked to {name}" (+ Open); "Added to {diagram}" (+ Open); "Duplicated as {name}" (+ Open);
  "Pasted {name}" (+ Open); "Pinned to sidebar"; "Couldn't copy: the browser blocked the clipboard". Open uses
  `assetHref`. Shown 4 s, one at a time, `role="status"`.
- Delete confirm: `Delete “{name}”? Its links are removed too.` plus, when referenced,
  `\n\nUsed in {names joined by ", "}. Those spots stay empty.`
- Native menu stays on `input`, `textarea`, `select`, `[contenteditable]` (not `"false"`) and whenever text is
  selected. Pixel / tile / voxel canvases keep their current mouse behaviour.
- Studio conventions (`CLAUDE.md`): secondary items use `var(--text-primary)`; icon-only buttons have `title` +
  `aria-label`; phone-only UI via `max-md:` / `md:hidden` so desktop stays pixel-identical; every change goes through
  `storage` (autosaves); undo where the surface already has it (board history picks issue changes up by itself).
  No hardcoded colours except `ASSET_KINDS[type].color`. The menu is portalled to `document.body` (outside
  `<main>`, so no tool tint): use `--bg-secondary`, `--bg-hover`, `--border`, `--text-primary`, `--text-muted`,
  `--red`.
- The `⋯` button is `md:hidden` everywhere (decided: "not at all" on desktop). Rows that already show a `⋯`
  (issue cards) or are tiny (LinkedAssets chips, tile picker, wiki links, graph nodes, frames, diagram nodes) get
  long-press only on phones.
- The project has no i18n layer; copy is inline English like the rest of the app.

## Review Focus

1. **Right-click inside a text field, contenteditable or over selected text** — the browser's own menu (spellcheck,
   paste) must appear, also inside rows that have a menu. Pinned in Task 1 (`shouldUseNativeMenu`,
   `contextMenuDecision`); Task 6 calls them before `preventDefault`.
2. **Long-press vs scroll, drag and Android's own `contextmenu`** — a finger that moves more than 8 px scrolls and never
   opens the menu; a menu opened by long-press does not also open the row; Android firing `contextmenu` after a
   long-press must not open a second menu. Pinned in Task 1 (`createLongPress`, `contextMenuDecision`).
3. **Acting on the asset open in the current editor** (rename the sprite you are drawing, delete the open diagram,
   add a node to the open diagram, paste into Music whose list is local state) — the editor's pending autosave must not
   overwrite the change and the list must show it. Pinned in Task 5 (`flushAllAutosaves` awaits async saves) and Task 4
   (`needsEditorReload`).
4. **Paste across projects** — a tilemap / sprite sheet / diagram is refused with a reason; an issue gets the target
   board's next key, first column, backlog; nothing pasted carries links or `example`. Pinned in Task 3.
5. **Deleting an asset others use, or that is pinned** — confirm names the users ("Used in Meadow, Characters");
   tilemap cells, sheet frames and diagram nodes keep the id and render a placeholder; the pin disappears; pins to
   assets deleted elsewhere (sync, other tab) are skipped. Pinned in Task 2 and Task 14.

---

### Task 1: ContextMenu, Toast and pointer helpers

**Files:**
- Create: `src/lib/menu-position.ts`, `src/lib/long-press.ts`
- Create: `src/components/ContextMenu.tsx`, `src/components/Toast.tsx`
- Modify: `src/app/globals.css` (append the `[data-asset-menu]` rules)
- Test: `src/lib/menu-position.test.ts`, `src/lib/long-press.test.ts`

**Interfaces:**
- Produces (`menu-position.ts`):
  - `interface Point { x: number; y: number }`, `interface Size { width: number; height: number }`,
    `MENU_MARGIN = 8`
  - `positionMenu(anchor: Point, size: Size, viewport: Size): { left: number; top: number; maxHeight: number }` —
    opens right/down of the anchor; flips left (`x - width`) / up (`y - height`) when it would cross
    `viewport - MENU_MARGIN`; then clamps into `[MENU_MARGIN, viewport - size - MENU_MARGIN]`;
    `maxHeight = viewport.height - 2 * MENU_MARGIN` (taller menus start at `MENU_MARGIN` and scroll).
  - `positionSubmenu(parent: { left: number; right: number; top: number }, size: Size, viewport: Size)` — same
    return; `left = parent.right - 4`, flipped to `parent.left - width + 4`; `top = parent.top`, clamped.
  - `nextEnabledIndex(disabled: boolean[], current: number, key: "ArrowDown" | "ArrowUp" | "Home" | "End"): number`
    (wraps, skips disabled, `-1` when none enabled)
  - `anchorPoint(event: { clientX: number; clientY: number; pointerType?: string }, rect: { left: number; bottom: number }): Point`
    — keyboard-invoked (`clientX === 0 && clientY === 0`, or `pointerType === ""`) anchors at `rect.left, rect.bottom`.
  - `shouldUseNativeMenu(target: { closest(selector: string): unknown } | null, selectedText: string): boolean`
    — selector `input, textarea, select, [contenteditable]:not([contenteditable="false"])`.
  - `contextMenuDecision(input: { isNativeTarget: boolean; lastPointerType: string | null }): "native" | "ignore" | "open"`
    — native target → `"native"`; last `pointerdown` was `"touch"` / `"pen"` → `"ignore"` (long-press owns it, so
    Android's own `contextmenu` can't open a second menu); else `"open"`.
- Produces (`long-press.ts`): `LONG_PRESS_MS = 500`, `LONG_PRESS_TOLERANCE_PX = 8`,
  `interface LongPress { down(p: Point & { pointerType: string }): void; move(p: Point): void; up(): void; cancel(): void; consumeClick(): boolean }`,
  `createLongPress(onLongPress: (p: Point) => void): LongPress` (uses global `setTimeout`, so fake timers work).
- Produces (`ContextMenu.tsx`):
  ```ts
  type ContextMenuEntry =
    | { kind: "item"; key: string; label: string; onSelect?: () => void; disabled?: boolean; hint?: string; danger?: boolean; submenu?: ContextMenuEntry[] }
    | { kind: "separator"; key: string };
  function ContextMenu(props: { anchor: Point; entries: ContextMenuEntry[]; label: string; onClose(): void }): React.JSX.Element
  ```
- Produces (`Toast.tsx`): `interface ToastOptions { message: string; action?: { label: string; href: string } }`,
  `ToastProvider({ children })`, `useToast(): { showToast(options: ToastOptions): void }`, `TOAST_MS = 4000`.

- [ ] **Step 1: Write failing tests**
  ```ts
  // menu-position.test.ts
  const desk = { width: 1440, height: 900 }, phone = { width: 390, height: 844 }, menu = { width: 200, height: 300 };
  expect(positionMenu({ x: 100, y: 100 }, menu, desk)).toEqual({ left: 100, top: 100, maxHeight: 884 });
  expect(positionMenu({ x: 1400, y: 100 }, menu, desk).left).toBe(1200);
  expect(positionMenu({ x: 100, y: 850 }, menu, desk).top).toBe(550);
  expect(positionMenu({ x: 150, y: 100 }, { width: 240, height: 100 }, phone).left).toBe(8);   // flip goes negative → clamp
  expect(positionMenu({ x: 10, y: 10 }, { width: 200, height: 1000 }, desk)).toEqual({ left: 10, top: 8, maxHeight: 884 });
  expect(positionMenu({ x: 380, y: 800 }, { width: 220, height: 400 }, phone)).toMatchObject({ left: 160, top: 400 });
  expect(positionSubmenu({ left: 100, right: 300, top: 200 }, { width: 200, height: 150 }, desk)).toMatchObject({ left: 296, top: 200 });
  expect(positionSubmenu({ left: 1100, right: 1300, top: 200 }, { width: 200, height: 150 }, desk).left).toBe(904);
  expect(nextEnabledIndex([false, true, false], 0, "ArrowDown")).toBe(2);
  expect(nextEnabledIndex([false, true, false], 2, "ArrowDown")).toBe(0);
  expect(nextEnabledIndex([false, true, false], 0, "ArrowUp")).toBe(2);
  expect(nextEnabledIndex([true, false, false, true], 2, "Home")).toBe(1);
  expect(nextEnabledIndex([true, false, false, true], 1, "End")).toBe(2);
  expect(nextEnabledIndex([true, true], 0, "ArrowDown")).toBe(-1);
  expect(anchorPoint({ clientX: 0, clientY: 0 }, { left: 40, bottom: 60 })).toEqual({ x: 40, y: 60 });
  expect(anchorPoint({ clientX: 300, clientY: 200, pointerType: "mouse" }, { left: 40, bottom: 60 })).toEqual({ x: 300, y: 200 });
  const fake = (match: boolean) => ({ closest: () => (match ? {} : null) });
  expect(shouldUseNativeMenu(fake(true), "")).toBe(true);
  expect(shouldUseNativeMenu(fake(false), "Pip")).toBe(true);
  expect(shouldUseNativeMenu(fake(false), "")).toBe(false);
  expect(shouldUseNativeMenu(null, "")).toBe(false);
  expect(contextMenuDecision({ isNativeTarget: true, lastPointerType: "touch" })).toBe("native");
  expect(contextMenuDecision({ isNativeTarget: false, lastPointerType: "touch" })).toBe("ignore");
  expect(contextMenuDecision({ isNativeTarget: false, lastPointerType: "pen" })).toBe("ignore");
  expect(contextMenuDecision({ isNativeTarget: false, lastPointerType: "mouse" })).toBe("open");
  expect(contextMenuDecision({ isNativeTarget: false, lastPointerType: null })).toBe("open");
  ```
  ```ts
  // long-press.test.ts (vi.useFakeTimers())
  // "fires once after 500 ms": down touch (10,10); advance 499 → 0 calls; advance 1 → 1 call with {x:10,y:10}
  // "8 px is allowed, more cancels": move to (18,10) → still fires; new press, move to (16,16) (8.49 px) → never fires
  // "release before 500 ms never fires": down, advance 300, up, advance 1000 → 0 calls
  // "mouse never fires": down with pointerType "mouse", advance 1000 → 0 calls
  // "suppresses exactly one click after firing": after fire consumeClick() → true, then false; never fired → false
  // "cancel() clears the timer": down, cancel(), advance 1000 → 0 calls
  ```
- [ ] **Step 2: Run** `npx vitest run src/lib/menu-position.test.ts src/lib/long-press.test.ts` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** both modules to the signatures above (distance is Euclidean, `> 8` cancels).
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Implement `ContextMenu`** — `createPortal` to `document.body` after mount; `role="menu"`,
  `aria-label={label}`, items `role="menuitem"` (`aria-disabled`, `aria-haspopup="menu"` for submenus); measures
  itself then applies `positionMenu`; focuses the first enabled item; keys: ArrowUp/Down/Home/End via
  `nextEnabledIndex`, Enter/Space select, ArrowRight opens a submenu, ArrowLeft/Esc closes the submenu or the menu;
  `stopPropagation` on every keydown so page shortcuts (pixel-art tool letters, board "c", undo) don't fire.
  Closes on outside `pointerdown`, `resize`, window `scroll` (capture) and `blur`. Selecting closes first, then calls
  `onSelect`. Disabled items show `hint` as a second muted line. `danger` items use `var(--red)`. Submenus: at
  `min-width: 768px` a flyout via `positionSubmenu`; below 768 px a drill-in that replaces the list with a "‹ Back"
  row then the sub-items. Styling: `fixed z-[200] min-w-48 max-w-[calc(100vw-16px)] rounded-lg p-1 shadow-xl`,
  `background: var(--bg-secondary)`, `border: 1px solid var(--border)`, items `text-xs px-2 py-1.5 max-md:py-2.5`
  hover/focus `var(--bg-hover)`, separators 1px `var(--border)`.
- [ ] **Step 6: Implement `ToastProvider` / `useToast`** — one toast at a time (`fixed z-[210] bottom-4 left-1/2 -translate-x-1/2`,
  `max-md:bottom-[calc(16px+env(safe-area-inset-bottom))]`), action is a `next/link` styled `var(--accent)`,
  dismiss after `TOAST_MS`, `role="status" aria-live="polite"`.
- [ ] **Step 7: Append to `globals.css`**:
  ```css
  [data-asset-menu] { -webkit-touch-callout: none; }
  @media (max-width: 767px) { [data-asset-menu] { user-select: none; -webkit-user-select: none; } }
  ```
- [ ] **Step 8: Verify** `npx tsc --noEmit -p .` and `npm run lint` pass (components are not mounted yet).
- [ ] **Step 9: Commit** — `git add src/lib/menu-position.ts src/lib/menu-position.test.ts src/lib/long-press.ts src/lib/long-press.test.ts src/components/ContextMenu.tsx src/components/Toast.tsx src/app/globals.css`;
  subject `feat: add context menu, toast and long-press helpers`; body bullets: positioning flips and clamps so
  menus stay on screen; long-press timing per spec; native-menu guard for editable targets.

### Task 2: Sidebar pins data and generic asset actions

**Files:**
- Modify: `src/types/index.ts` (`ProjectPins`, `Project.pins?`)
- Create: `src/lib/pins.ts`, `src/lib/asset-actions.ts`
- Test: `src/lib/pins.test.ts`, `src/lib/asset-actions.test.ts`

**Interfaces:**
- Produces (types): `interface ProjectPins { tools: string[]; assets: AssetRef[] }`; `Project.pins?: ProjectPins`.
- Produces (`pins.ts`) — every write saves the project with a new `updatedAt` (so cloud sync's newer-wins merge keeps
  it) and only when something changed:
  - `getPins(projectId: string): ProjectPins` (defaults `{ tools: [], assets: [] }`)
  - `isToolPinned(projectId: string, path: string): boolean`, `toggleToolPin(projectId: string, path: string): void` (appends)
  - `orderTools<T extends { path: string }>(tools: T[], pinned: string[]): T[]` — the `"assets"` entry stays first and
    is never pinnable; pinned tools follow in pin order; the rest keep their order; unknown paths ignored.
  - `isAssetPinned(projectId: string, ref: AssetRef): boolean`, `toggleAssetPin(projectId: string, ref: AssetRef): void`,
    `removeAssetPin(projectId: string, ref: AssetRef): void`
  - `resolvePinnedAssets(projectId: string): AssetSummary[]` — pin order, missing assets skipped.
- Produces (`asset-actions.ts`):
  - `type StoredAsset = Sprite | SoundEffect | MusicTrack | Diagram | StoryEntry | TilemapData | DialogueTree | Palette | SpriteSheet | Note | Issue | VoxelModel`
  - `getStoredAsset(projectId: string, ref: AssetRef): StoredAsset | undefined`
  - `getAssetName(type: AssetType, item: unknown): string` — `title` for story / note / issue, else `name`; `"Untitled"`.
    (Raw name, unlike `summarize()` which prefixes the issue key.)
  - `uniqueName(base: string, taken: string[]): string`
  - `type ClonePlacement = "in-place" | "backlog"`;
    `cloneAsset(type: AssetType, item: StoredAsset, targetProjectId: string, placement: ClonePlacement): StoredAsset`
    — deep copy (`structuredClone`), new id, `projectId`, no `example`, `createdAt`/`updatedAt` now, name via
    `uniqueName` against the target project's same-type names, story `links: []`; issue: key from `takeIssueKey`
    (board from `storage.getAll("boards", p)[0] ?? createDefaultBoard(p)`, both from `@/components/board/meta`);
    `"in-place"` keeps status + sprint, `"backlog"` uses `columns[0].id` + `sprintId: null`; order = max order in that
    status + 1000; `archived: false`; `resolvedAt` set only when the column's category is `"done"`. Does not save.
  - `duplicateAsset(projectId: string, ref: AssetRef): AssetRef | null` (clone `"in-place"` + `storage.save`)
  - `renameAsset(projectId: string, ref: AssetRef, name: string): void` — trimmed; empty is a no-op; writes `title` or `name`.
  - `findReferences(projectId: string, ref: AssetRef): AssetSummary[]` — sprites: tilemaps whose layer cells or
    `tilesetSpriteIds` hold the id, sprite sheets whose `spriteIds` hold it; any type: diagrams with a node whose
    `data.asset.id` matches. Order: tilemaps, sprite sheets, diagrams.
  - `deleteConfirmMessage(projectId: string, ref: AssetRef): string` (copy in Global Constraints)
  - `deleteAsset(projectId: string, ref: AssetRef): void` — `storage.delete` (already drops `links` rows), strips
    `StoryEntry.links` entries targeting it, `removeAssetPin`; references from `findReferences` are left as they are.
  - `addAssetToDiagram(projectId: string, diagramId: string, ref: AssetRef): Diagram | null` — custom node
    `{ type: "custom", width: 140, height: 56, label: name, data: { asset: ref } }` at `x = right edge of the
    rightmost node + 40`, `y` = that node's `y`; empty diagram → `(0, 0)`. Saves.
  - `createDiagramWith(projectId: string, ref: AssetRef): Diagram` — named `"{name} diagram"`, containing that node. Saves.
  - `createNoteAbout(projectId: string, ref: AssetRef): Note` — title `"Notes on {name}"` (not `{name}`, so `[[Pip]]`
    keeps resolving to the story entry), empty content, `addLink(note, ref)`.
  - `createTaskFor(projectId: string, ref: AssetRef): Issue` — `createIssue(p, board, { title: name })`, `addLink`.
  - `type ClipboardPayload = { kind: "text"; text: string } | { kind: "png"; dataUrl: string }`;
    `systemClipboardPayload(type: AssetType, item: StoredAsset): ClipboardPayload` — sprite → first frame `pixels`;
    palette → colours joined by `"\n"`; note / story → `content`; dialogue → one line per node with text
    (`"Speaker: text"` or `text`), each choice as `"- {choice}"`; issue → `"KEY Title"`; others → name.
  - `copyToSystemClipboard(payload: ClipboardPayload): Promise<boolean>` — text via `navigator.clipboard.writeText`;
    PNG via `new ClipboardItem({ "image/png": fetch(dataUrl).then((r) => r.blob()) })` (promise created inside the
    gesture, for Safari); `false` on any failure. Browser-only, not unit-tested.
  - `assetUrl(origin: string, projectId: string, ref: AssetRef): string` = `origin + assetHref(...)`.

- [ ] **Step 1: Write failing tests** (`beforeEach(() => replaceCache(new Map()))`; seed project `p1` "Pip's Quest",
  sprite "Pip" `example: true`, tilemap "Meadow" with a cell holding Pip's id, sheet "Characters", diagram "Flow",
  story "Pip" linking to the sprite, board prefix `PIP`, columns `todo/doing/done`).
  ```ts
  // pins.test.ts
  expect(getPins("p1")).toEqual({ tools: [], assets: [] });
  toggleToolPin("p1", "music"); toggleToolPin("p1", "board");
  expect(getPins("p1").tools).toEqual(["music", "board"]);
  toggleToolPin("p1", "music"); expect(isToolPinned("p1", "music")).toBe(false);
  const tools = ["assets", "board", "pixel-art", "music"].map((path) => ({ path }));
  expect(orderTools(tools, ["music", "gone", "assets", "board"]).map((t) => t.path)).toEqual(["assets", "music", "board", "pixel-art"]);
  toggleAssetPin("p1", pip); expect(isAssetPinned("p1", pip)).toBe(true);
  toggleAssetPin("p1", { type: "note", id: "missing" });
  expect(resolvePinnedAssets("p1").map((a) => a.name)).toEqual(["Pip"]);
  const v = storage.version(); removeAssetPin("p1", { type: "sound", id: "never-pinned" }); expect(storage.version()).toBe(v);
  ```
  ```ts
  // asset-actions.test.ts
  expect(getAssetName("note", { title: "Ideas" })).toBe("Ideas");
  expect(getAssetName("sprite", { name: "" })).toBe("Untitled");
  expect(uniqueName("Pip", [])).toBe("Pip");
  expect(uniqueName("Pip", ["Pip"])).toBe("Pip copy");
  expect(uniqueName("Pip", ["Pip", "Pip copy"])).toBe("Pip copy 2");
  renameAsset("p1", story, "  Meadow tale  "); expect(storage.getById("stories", story.id, "p1")!.title).toBe("Meadow tale");
  renameAsset("p1", story, "   "); expect(storage.getById("stories", story.id, "p1")!.title).toBe("Meadow tale");
  addLink("p1", pip, noteRef);
  const copy = duplicateAsset("p1", pip)!;
  const stored = storage.getById("sprites", copy.id, "p1")!;
  expect(copy.id).not.toBe(pip.id); expect(stored.name).toBe("Pip copy"); expect("example" in stored).toBe(false);
  expect(stored.frames).toEqual(storage.getById("sprites", pip.id, "p1")!.frames);
  expect(getRelated("p1", "sprite", copy.id)).toEqual([]);
  expect(storage.getById("stories", duplicateAsset("p1", story)!.id, "p1")!.links).toEqual([]);
  // issue PIP-1 in "doing", sprint "s1", board nextNumber 2
  const dupIssue = storage.getById("issues", duplicateAsset("p1", issue)!.id, "p1")!;
  expect(dupIssue).toMatchObject({ key: "PIP-2", status: "doing", sprintId: "s1" });
  expect(findReferences("p1", pip).map((a) => a.name)).toEqual(["Meadow", "Characters", "Flow"]);
  expect(deleteConfirmMessage("p1", pip)).toContain("Used in Meadow, Characters, Flow.");
  toggleAssetPin("p1", pip); deleteAsset("p1", pip);
  expect(storage.getById("sprites", pip.id, "p1")).toBeUndefined();
  expect(storage.getAll("links", "p1").some((l) => l.from.id === pip.id || l.to.id === pip.id)).toBe(false);
  expect(storage.getById("stories", story.id, "p1")!.links.some((l) => l.targetId === pip.id)).toBe(false);
  expect(isAssetPinned("p1", pip)).toBe(false);
  expect(storage.getById("tilemaps", meadow.id, "p1")!.layers[0].tiles[0][0]).toBe(pip.id); // left as is
  expect(addAssetToDiagram("p1", emptyDiagram.id, noteRef)!.nodes.at(-1)).toMatchObject({ type: "custom", x: 0, y: 0, width: 140, height: 56, data: { asset: noteRef } });
  // Flow has one node at x 100, width 140, y 50
  expect(addAssetToDiagram("p1", flow.id, noteRef)!.nodes.at(-1)).toMatchObject({ x: 280, y: 50 });
  expect(createNoteAbout("p1", pip).title).toBe("Notes on Pip");
  // project p2 has a sound "Jump" and no board yet
  expect(createTaskFor("p2", soundRef)).toMatchObject({ title: "Jump", status: storage.getAll("boards", "p2")[0].columns[0].id });
  expect(systemClipboardPayload("palette", { ...palette, colors: ["#1a1c2c", "#5d275d"] })).toEqual({ kind: "text", text: "#1a1c2c\n#5d275d" });
  expect(systemClipboardPayload("issue", { ...issueItem, key: "PIP-3", title: "Fix jump" })).toEqual({ kind: "text", text: "PIP-3 Fix jump" });
  expect(systemClipboardPayload("sprite", spriteItem)).toEqual({ kind: "png", dataUrl: spriteItem.frames[0].pixels });
  expect(systemClipboardPayload("sound", soundItem)).toEqual({ kind: "text", text: "Jump" });
  expect(systemClipboardPayload("dialogue", { ...tree, nodes: [{ speaker: "Pip", text: "Hi" }, { text: "Go?", choices: [{ text: "Yes" }] }] })).toEqual({ kind: "text", text: "Pip: Hi\nGo?\n- Yes" });
  expect(assetUrl("https://gamedev-studio.pladsen.dev", "p1", { type: "note", id: "n1" })).toBe("https://gamedev-studio.pladsen.dev/project/p1/notebook?open=n1");
  ```
- [ ] **Step 2: Run** `npx vitest run src/lib/pins.test.ts src/lib/asset-actions.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `types`, `pins.ts`, `asset-actions.ts` (names via `ASSET_KINDS[type].collection`; never
  branch on collection names outside `getAssetName` / `renameAsset`).
- [ ] **Step 4: Run** the same command, then `npm test` — Expected: all PASS (voxel tests untouched).
- [ ] **Step 5: Commit** — files above; subject `feat: add asset actions and per-project sidebar pins`; bullets: one place
  handles name vs title; delete cleans links, story links and pins but leaves id references; pins live on the
  project record so they sync and export.

### Task 3: In-app clipboard

**Files:**
- Create: `src/lib/asset-clipboard.ts`, `src/hooks/useAssetClipboard.ts`
- Test: `src/lib/asset-clipboard.test.ts`

**Interfaces:**
- Consumes: Task 2 `StoredAsset`, `getStoredAsset`, `getAssetName`, `cloneAsset`.
- Produces (`asset-clipboard.ts`):
  - `CLIPBOARD_KEY = "gds-asset-clipboard"`, `CLIPBOARD_SESSION_LIMIT = 2 * 1024 * 1024`,
    `SAME_PROJECT_ONLY: AssetType[] = ["tilemap", "spritesheet", "diagram"]`
  - `interface AssetClipboard { type: AssetType; name: string; item: StoredAsset; sourceProjectId: string; sourceProjectName: string; copiedAt: string }`
  - `copyAsset(projectId: string, ref: AssetRef): AssetClipboard | null` — snapshot (`structuredClone`), memory, then
    `sessionStorage.setItem` when `new TextEncoder().encode(json).length < CLIPBOARD_SESSION_LIMIT`, else
    `removeItem(CLIPBOARD_KEY)`; all `sessionStorage` access guarded (`typeof sessionStorage`, try/catch).
  - `readClipboard(): AssetClipboard | null` — memory, else parsed `sessionStorage` (corrupt → `null`).
  - `subscribeClipboard(listener: () => void): () => void`
  - `type PasteCheck = { ok: true } | { ok: false; reason: string }`;
    `canPaste(clip: AssetClipboard, targetProjectId: string): PasteCheck` — reason
    `"Only in {sourceProjectName}: it uses that project's assets"`.
  - `pasteAsset(clip: AssetClipboard, targetProjectId: string): AssetRef | null` — `cloneAsset(..., "backlog")` +
    `storage.save` (so persisters sync it); `null` when `canPaste` fails.
- Produces (`useAssetClipboard.ts`): `useAssetClipboard(): AssetClipboard | null` (`useSyncExternalStore`, server
  snapshot `null`).

- [ ] **Step 1: Write failing tests** (seed `p1` "Pip's Quest" with sprite "Pip" + tilemap; `p2` "Other" with board
  prefix `OTH`, `nextNumber: 5`, `columns[0].id === "todo"`; `vi.stubGlobal("sessionStorage", mapBackedStorage())`;
  fresh module per test via `vi.resetModules()` + dynamic import).
  ```ts
  const clip = copyAsset("p1", pip)!;
  expect(readClipboard()).toMatchObject({ name: "Pip", sourceProjectName: "Pip's Quest", type: "sprite" });
  deleteAsset("p1", pip);
  const a = pasteAsset(clip, "p1")!, b = pasteAsset(clip, "p1")!;
  expect(a.id).not.toBe(b.id);
  expect([a, b].map((r) => storage.getById("sprites", r.id, "p1")!.name)).toEqual(["Pip", "Pip copy"]); // source gone, so first paste keeps the name
  const other = pasteAsset(clip, "p2")!; // same snapshot, other project, no "Pip" there
  expect(storage.getById("sprites", other.id, "p2")).toMatchObject({ name: "Pip", projectId: "p2" });
  expect("example" in storage.getById("sprites", other.id, "p2")!).toBe(false);
  expect(getRelated("p2", "sprite", other.id)).toEqual([]);
  const tm = copyAsset("p1", meadowRef)!;
  expect(canPaste(tm, "p2")).toEqual({ ok: false, reason: "Only in Pip's Quest: it uses that project's assets" });
  expect(canPaste(tm, "p1")).toEqual({ ok: true }); expect(pasteAsset(tm, "p2")).toBeNull();
  const pastedIssue = storage.getById("issues", pasteAsset(copyAsset("p1", issueInSprint)!, "p2")!.id, "p2")!;
  expect(pastedIssue).toMatchObject({ key: "OTH-5", status: "todo", sprintId: null });
  // sessionStorage mirror
  copyAsset("p1", pip); expect(sessionStorage.getItem(CLIPBOARD_KEY)).not.toBeNull();
  vi.resetModules(); expect((await import("./asset-clipboard")).readClipboard()?.name).toBe("Pip");
  copyAsset("p1", hugeSprite); // frames[0].pixels = "a".repeat(2 * 1024 * 1024 + 1)
  expect(sessionStorage.getItem(CLIPBOARD_KEY)).toBeNull(); expect(readClipboard()?.name).toBe("Huge");
  sessionStorage.setItem(CLIPBOARD_KEY, "{not json"); vi.resetModules();
  expect((await import("./asset-clipboard")).readClipboard()).toBeNull();
  const listener = vi.fn(); subscribeClipboard(listener); copyAsset("p1", pip); expect(listener).toHaveBeenCalledTimes(1);
  ```
- [ ] **Step 2: Run** `npx vitest run src/lib/asset-clipboard.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the module and hook.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** — files above; subject `feat: add in-app asset clipboard with session mirror`; bullets: snapshot
  survives deleting the source; id-referencing types stay in their project; 2 MB cap keeps sessionStorage safe.

### Task 4: Menu item registry

**Files:**
- Create: `src/lib/asset-menu-items.ts`
- Test: `src/lib/asset-menu-items.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type AssetActionId =
    | "open" | "open-new-tab" | "export-png" | "use-in-pixel-art" | "use-in-voxels" | "toggle-note-pin"
    | "move-to-column" | "add-to-sprint" | "link-to-note" | "new-note" | "add-to-diagram" | "create-task"
    | "link-to-asset" | "show-links" | "duplicate" | "copy" | "copy-system" | "copy-name" | "copy-link"
    | "toggle-sidebar-pin" | "rename" | "delete";            // Task 12 and 13 extend this union
  type AssetMenuEntry =
    | { kind: "item"; action: AssetActionId; arg?: string; label: string; danger?: boolean; disabled?: boolean; hint?: string; submenu?: AssetMenuEntry[] }
    | { kind: "separator" };
  interface AssetMenuContext { ref: AssetRef; name: string; isPinnedToSidebar: boolean; isNotePinned?: boolean; board?: Board; issue?: Issue }
  function getAssetMenuEntries(ctx: AssetMenuContext): AssetMenuEntry[]
  function systemCopyLabel(type: AssetType): string | null
  function needsEditorReload(pathname: string, projectId: string, type: AssetType): boolean
  ```
  Groups, separated, empty groups dropped: (A) Open, Open in new tab · (B) type extras — sprite: Export PNG; palette:
  Use in Pixel Art, Use in Voxels; note: Pin/Unpin in Notebook; issue: Move to column (submenu: other columns,
  `arg = column.id`), Add to sprint (submenu: planned/active sprints other than the current, then "Backlog"
  `arg = ""` when `sprintId` is set; none → item disabled, hint "No other sprints") · (C) Link to note…,
  `New note about {name}` (names over 24 chars become `name.slice(0, 23).trimEnd() + "…"`), Add to diagram…, Create task (not for issues), Link to
  asset…, Show links · (D) Duplicate, Copy, system copy item when `systemCopyLabel` is non-null, Copy name, Copy link ·
  (E) Pin to sidebar / Unpin from sidebar, Rename…, Delete… (`danger`).
  `needsEditorReload`: true when the first path segment after `/project/{projectId}/` equals
  `ASSET_KINDS[type].path`, except `issue` (the board reads storage live).

- [ ] **Step 1: Write failing tests** (`const labels = (e: AssetMenuEntry[]) => e.map((x) => (x.kind === "separator" ? "—" : x.label))`)
  ```ts
  expect(labels(getAssetMenuEntries({ ref: { type: "sprite", id: "s" }, name: "Pip", isPinnedToSidebar: false }))).toEqual([
    "Open", "Open in new tab", "—", "Export PNG", "—", "Link to note…", "New note about Pip", "Add to diagram…",
    "Create task", "Link to asset…", "Show links", "—", "Duplicate", "Copy", "Copy as PNG", "Copy name", "Copy link",
    "—", "Pin to sidebar", "Rename…", "Delete…",
  ]);
  const sound = labels(getAssetMenuEntries({ ref: { type: "sound", id: "x" }, name: "Jump", isPinnedToSidebar: true }));
  expect(sound).toContain("Unpin from sidebar"); expect(sound.join("|")).not.toContain("—|—");
  expect(sound[0]).not.toBe("—"); expect(sound.at(-1)).toBe("Delete…");
  expect(labels(getAssetMenuEntries({ ref: noteRef, name: "Ideas", isPinnedToSidebar: false, isNotePinned: true }))).toContain("Unpin in Notebook");
  expect(labels(getAssetMenuEntries({ ref: noteRef, name: "Ideas", isPinnedToSidebar: false, isNotePinned: false }))).toContain("Pin in Notebook");
  // fixture board columns: todo "To do", doing "Doing", done "Done"; issue in "doing", sprint "s1";
  // sprints: s1 "Sprint 1" active, s2 "Sprint 2" planned, s3 "Sprint 3" closed
  const issueEntries = getAssetMenuEntries({ ref: issueRef, name: "Fix jump", isPinnedToSidebar: false, board, issue });
  expect(labels(issueEntries)).not.toContain("Create task");
  expect(labels(find(issueEntries, "move-to-column").submenu!)).toEqual(["To do", "Done"]);
  expect(labels(find(issueEntries, "add-to-sprint").submenu!)).toEqual(["Sprint 2", "Backlog"]);
  expect(find(getAssetMenuEntries({ ...issueCtx, board: { ...board, sprints: [] }, issue: { ...issue, sprintId: null } }), "add-to-sprint")).toMatchObject({ disabled: true, hint: "No other sprints" });
  expect(find(issueEntries, "delete")).toMatchObject({ danger: true });
  expect(labels(getAssetMenuEntries({ ref: storyRef, name: "A very long story entry title", isPinnedToSidebar: false }))).toContain("New note about A very long story entry…");
  expect(systemCopyLabel("palette")).toBe("Copy hex codes"); expect(systemCopyLabel("dialogue")).toBe("Copy text");
  expect(systemCopyLabel("issue")).toBe("Copy key and title"); expect(systemCopyLabel("music")).toBeNull();
  expect(needsEditorReload("/project/p1/pixel-art", "p1", "sprite")).toBe(true);
  expect(needsEditorReload("/project/p1/assets", "p1", "sprite")).toBe(false);
  expect(needsEditorReload("/project/p1/sprites", "p1", "sprite")).toBe(false);
  expect(needsEditorReload("/project/p1/sprites", "p1", "spritesheet")).toBe(true);
  expect(needsEditorReload("/project/p1/board", "p1", "issue")).toBe(false);
  ```
- [ ] **Step 2: Run** `npx vitest run src/lib/asset-menu-items.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** (pure data; no React, no storage reads — the provider builds the context).
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Commit** — subject `feat: add asset context menu item registry`; bullets: one registry decides the items
  for every surface; issue submenus derived from the board; reload rule kept pure and tested.

### Task 5: Autosave flush registry

**Files:**
- Create: `src/lib/autosave-registry.ts`
- Modify: `src/hooks/useAutosave.ts` (register an awaitable flush), `src/app/(app)/project/[projectId]/notebook/page.tsx:435`
  (register its own `flush`)
- Test: `src/lib/autosave-registry.test.ts`

**Interfaces:**
- Produces: `registerAutosaveFlush(flush: () => void | Promise<void>): () => void`,
  `flushAllAutosaves(): Promise<void>` (`Promise.allSettled`, never rejects).
- `useAutosave` keeps its public `flush: () => void`; internally `flushNow(): Promise<void>` returns the save's promise
  and is registered in a mount effect (unregistered on unmount). Notebook: `useEffect(() => registerAutosaveFlush(flush), [flush])`.
  Dialogue and the board save immediately; story's autosave re-reads the entry before saving content, so neither needs more.

- [ ] **Step 1: Write failing tests**
  ```ts
  const order: string[] = [];
  registerAutosaveFlush(() => new Promise<void>((r) => setTimeout(() => { order.push("slow"); r(); }, 20)));
  registerAutosaveFlush(() => { order.push("sync"); });
  await flushAllAutosaves(); expect(order).toEqual(["sync", "slow"]);
  const off = registerAutosaveFlush(spy); off(); await flushAllAutosaves(); expect(spy).not.toHaveBeenCalled();
  registerAutosaveFlush(() => Promise.reject(new Error("x"))); registerAutosaveFlush(other);
  await expect(flushAllAutosaves()).resolves.toBeUndefined(); expect(other).toHaveBeenCalled();
  ```
- [ ] **Step 2: Run** `npx vitest run src/lib/autosave-registry.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** the registry, then the `useAutosave` and notebook edits (no other behaviour change).
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit -p .` — Expected: PASS.
- [ ] **Step 5: Commit** — subject `feat: let menu actions flush every pending autosave`; bullets: pixel-art and
  similar editors save asynchronously, so a rename from the menu could be overwritten by a late save.

### Task 6: Asset menu provider, picker modal and `⋯` button

**Files:**
- Create: `src/components/AssetContextMenu.tsx`, `src/components/AssetPickerModal.tsx`, `src/components/AssetMenuButton.tsx`
- Modify: `src/app/(app)/layout.tsx` (wrap: `<SyncProvider><ToastProvider><AssetContextMenuProvider><AppSidebar>`)

**Interfaces:**
- Consumes: Tasks 1–5 (all names above), `useSync().reloadView`, `addLink`, `getRelated`, `saveIssue`, `assetHref`.
- Produces (`AssetContextMenu.tsx`):
  ```ts
  interface MenuTriggerProps {
    "data-asset-menu": "";
    onContextMenu(e: React.MouseEvent<Element>): void;
    onPointerDown(e: React.PointerEvent<Element>): void; onPointerMove(e: React.PointerEvent<Element>): void;
    onPointerUp(e: React.PointerEvent<Element>): void; onPointerCancel(e: React.PointerEvent<Element>): void;
    onClickCapture(e: React.MouseEvent<Element>): void;
  }
  interface AssetMenuApi {
    projectId: string | null;
    openAssetMenu(anchor: Point, ref: AssetRef, opener?: HTMLElement | null): void;
    openMenu(anchor: Point, entries: ContextMenuEntry[], label: string, opener?: HTMLElement | null): void;
    assetTriggerProps(ref: AssetRef): MenuTriggerProps;
    menuTriggerProps(getEntries: () => ContextMenuEntry[] | null, label: string): MenuTriggerProps; // null → native menu
    pasteTriggerProps(type?: AssetType): MenuTriggerProps;  // list background; native menu unless the clipboard fits
    paste(type?: AssetType): Promise<void>;
  }
  function AssetContextMenuProvider({ children }: { children: React.ReactNode }): React.JSX.Element
  function useAssetMenu(): AssetMenuApi
  ```
- Produces (`AssetMenuButton.tsx`): `AssetMenuButton({ asset, label }: { asset: AssetRef; label: string })` — `md:hidden`,
  `w-8 h-8 -my-1`, `MoreHorizontal` 14 px, `title`/`aria-label` `"More actions for {label}"`, `stopPropagation`,
  anchors at its rect via `anchorPoint`. `PasteButton({ type }: { type?: AssetType })` — renders only when
  the clipboard is non-empty and (`type` undefined or `clip.type === type`); calls `paste(type)`; text button "Paste" (`var(--text-primary)`, `1px solid var(--border)`),
  disabled with `title = reason` when `canPaste` fails.
- Produces (`AssetPickerModal.tsx`):
  `AssetPickerModal(props: { projectId: string; title: string; types?: AssetType[]; exclude: AssetRef[]; createLabel?: string; onCreate?(): void; onPick(ref: AssetRef): void; onClose(): void })`
  — `role="dialog" aria-modal`, `z-[150]`, autofocused search ("Search assets in this project"), groups in
  `ASSET_TYPES` order with `ASSET_KINDS[t].label` in the kind colour (same look as the `LinkedAssets` picker, which
  stays as it is), optional create button first, empty state "Nothing to pick yet.", Esc / backdrop close.

- [ ] **Step 1: Implement the trigger plumbing** — one shared `createLongPress` controller per provider.
  `onContextMenu`: `contextMenuDecision({ isNativeTarget: shouldUseNativeMenu(e.target, getSelection()?.toString() ?? ""), lastPointerType })`
  — `"native"`: return untouched; `"ignore"`: `preventDefault()` only; `"open"`: `preventDefault`, `stopPropagation`, open at `anchorPoint(e, e.currentTarget.getBoundingClientRect())` with
  `opener = e.currentTarget`. Pointer handlers feed the controller (`stopPropagation` is not called on pointer events,
  so drags and page handlers still run). `onClickCapture`: `consumeClick()` → `preventDefault` + `stopPropagation`.
  On close, focus returns to `opener` when still connected. `projectId` comes from `usePathname()`
  (`/project/([^/]+)`); with none, every open is a no-op.
- [ ] **Step 2: Build the context and dispatch** — context from `getStoredAsset` (missing → no menu), `isAssetPinned`,
  note `pinned`, board + issue for issues. Map entries to `ContextMenuEntry` (`key` = action + arg / index). Dispatch:

  | Action | Does | Then |
  |---|---|---|
  | open / open-new-tab | `router.push(assetHref)` / `window.open(href, "_blank", "noopener")` | – |
  | export-png | `downloadBlob("{name}.png", blob of frames[0].pixels)` (`src/lib/download.ts`) | – |
  | use-in-pixel-art / use-in-voxels | push `/project/{p}/pixel-art?palette={id}` / `/voxels?palette={id}` (existing params) | – |
  | toggle-note-pin | save note `pinned: !pinned` | mutation |
  | move-to-column / add-to-sprint | `saveIssue(p, board, issue, { status: arg, order: end of column })` / `{ sprintId: arg \|\| null }` | – |
  | link-to-note / link-to-asset | picker (`types: ["note"]` / all), `exclude` = self + `getRelated`; `addLink` | toast "Linked to {name}" |
  | new-note / create-task | `createNoteAbout` / `createTaskFor` | push `assetHref` of the new note / issue |
  | add-to-diagram | picker `types: ["diagram"]`, `exclude` = self, `createLabel: "New diagram"` → `addAssetToDiagram` / `createDiagramWith` | mutation on the diagram; toast "Added to {diagram}" |
  | show-links | push `/project/{p}/assets?links={type}:{id}` | – |
  | duplicate | `duplicateAsset` | mutation on the copy; toast "Duplicated as {name}" |
  | copy / copy-system / copy-name / copy-link | `copyAsset` / `copyToSystemClipboard(systemClipboardPayload)` / text name / `assetUrl(location.origin, …)` | toast "Copied" or the failure copy |
  | toggle-sidebar-pin | `toggleAssetPin` | toast "Pinned to sidebar" when pinning |
  | rename | `window.prompt("Rename", name)` → `renameAsset` | mutation |
  | delete | `window.confirm(deleteConfirmMessage)` → `deleteAsset` | mutation (deleted) |

  **Mutation** = `await flushAllAutosaves()` before the lib call; after it, when
  `needsEditorReload(pathname, projectId, ref.type)`: `router.replace(deleted ? pathname : assetHref(resultRef), { scroll: false })`
  then `reloadView()`. `paste(type)` = `readClipboard` → type filter → `canPaste` → mutation with `pasteAsset` →
  toast "Pasted {name}". `pasteTriggerProps(type)` opens a one-item menu ("Paste", disabled + hint when `canPaste`
  fails) only when the clipboard holds that type (any type when `type` is undefined); otherwise the native menu.
- [ ] **Step 3: Implement `AssetPickerModal`, `AssetMenuButton`, `PasteButton`** and mount the providers in the layout.
- [ ] **Step 4: Verify** `npx tsc --noEmit -p .`, `npm run lint`, `npm test`, `npm run build` — Expected: pass.
- [ ] **Step 5: Controller (browser)** — `npm run dev`; at 1440×900 every page renders as before with no page errors
  (no surface is wired yet).
- [ ] **Step 6: Commit** — files above; subject `feat: add asset context menu provider and picker`; bullets: surfaces
  only spread trigger props; mutations flush autosaves and re-mount the visible editor; link pickers share one modal.

### Task 7: Pinned section and tool pinning in the side menu

**Files:**
- Create: `src/components/SidebarPins.tsx`, `src/components/asset-icons.ts` (`ASSET_ICONS`, moved from the dashboard's `ICONS`)
- Modify: `src/app/(app)/layout.tsx:127-145` (tool list), `src/app/(app)/project/[projectId]/assets/page.tsx:32-45` (import `ASSET_ICONS`)

**Interfaces:**
- Consumes: `resolvePinnedAssets`, `orderTools`, `getPins`, `isToolPinned`, `toggleToolPin` (Task 2);
  `useAssetMenu().assetTriggerProps / menuTriggerProps`, `AssetMenuButton` (Task 6); `useStorageVersion`.
- Produces: `ASSET_ICONS: Record<AssetType, LucideIcon>`;
  `SidebarPins({ projectId, onNavigate }: { projectId: string; onNavigate(): void })` — renders nothing without pins.

- [ ] **Step 1: Implement `SidebarPins`** — between "All Projects" and the tools: header "Pinned"
  (`text-[10px] uppercase tracking-wide px-3`, `var(--text-muted)`), rows styled like tool rows: `ASSET_ICONS[type]`
  in `ASSET_KINDS[type].color` + truncated name, `Link` to `assetHref`, `onClick={onNavigate}` (closes the phone
  drawer), `assetTriggerProps(ref)`, `AssetMenuButton`.
- [ ] **Step 2: Order and pin tools** — `orderTools(toolNav, getPins(projectId).tools)`; re-render on
  `useStorageVersion()`. Each tool row except Assets gets `menuTriggerProps(() => [{ kind: "item", key: "pin", label: pinned ? "Unpin" : "Pin to top", onSelect: () => toggleToolPin(projectId, tool.path) }], tool.name)`
  and a `md:hidden` `⋯` (wrap the `Link` in `relative` div; button `absolute right-1 top-1/2 -translate-y-1/2`,
  `title`/`aria-label` `"More actions for {tool.name}"`, opens the same entries via `openMenu`).
- [ ] **Step 3: Verify** `npx tsc --noEmit -p .`, `npm run lint`, `npm run build`.
- [ ] **Step 4: Controller (browser)** — project with examples. 1440×900: with no pins the sidebar is pixel-identical
  to `main`; right-click "Music" → "Pin to top" moves it right under Assets; pin "Task Board" → order Assets, Music,
  Task Board; reload keeps it; "Unpin" restores. 390×844: open the drawer, `⋯` on a tool row opens the same menu,
  no horizontal overflow.
- [ ] **Step 5: Commit** — subject `feat: pin tools and assets in the side menu`; bullets: pins per project and synced;
  Assets stays first; Pinned section hidden when empty so desktop is unchanged.

### Task 8: Dashboard rows, list paste, "Show links" and LinkedAssets chips

**Files:**
- Modify: `src/app/(app)/project/[projectId]/assets/page.tsx` (rows ~L222, list container, header), `src/components/LinkedAssets.tsx` (chips ~L83)

**Interfaces:**
- Consumes: `assetTriggerProps`, `pasteTriggerProps`, `AssetMenuButton`, `PasteButton` (Task 6), `getRelated`.
- Produces: dashboard query param `?links={type}:{id}` (read with `useSearchParams`).

- [ ] **Step 1: Wire rows** — each row `div` gets `assetTriggerProps({ type, id })` and an `AssetMenuButton` as its last
  child. The list container and the empty-state box get `pasteTriggerProps()`; `<PasteButton />` (no type: the dashboard
  takes any type) sits left of the type filter.
- [ ] **Step 2: "Show links"** — when `?links=` resolves to a stored asset, `shown` = that asset + `getRelated(...)`
  (search and type filter still apply) and a chip above the list: "Showing {name} and its links" with an `X`
  button (`title`/`aria-label` "Show everything") that `router.replace(pathname, { scroll: false })`. Unknown or
  missing ref → param ignored.
- [ ] **Step 3: LinkedAssets** — each chip `div` gets `assetTriggerProps(r)` (long-press only on phones, no `⋯`).
- [ ] **Step 4: Verify** `npx tsc --noEmit -p .`, `npm run lint`, `npm run build`.
- [ ] **Step 5: Controller (browser)** — 1440×900: dashboard screenshot equals `main` with nothing copied; right-click a
  sprite row → menu at the pointer with the Task 4 sprite labels; right-click the row near the bottom-right corner →
  menu flips up/left on screen; Shift+F10 on a focused row link opens it, arrows move, Esc closes and focus returns;
  Rename… renames and the list updates; Copy then right-click list background → Paste → "Pasted Pip copy" toast with
  Open; Show links filters, chip clears it; Delete… on a sprite used by a tilemap lists "Used in …"; right-click
  inside the search input shows the native menu. In Pixel Art, right-click a LinkedAssets chip opens the linked
  asset's menu. 390×844: `⋯` on every row, long-press a row (no click-through to the link), scrolling the list does
  not open the menu, no horizontal overflow.
- [ ] **Step 6: Commit** — subject `feat: open the asset menu from the dashboard and link chips`; bullets: rows,
  background paste, links filter via `?links=`; desktop unchanged until something is copied.

### Task 9: Tool lists — Pixel Art, Sprite Sheets, SFX, Music, Tilemap

**Files:**
- Modify: `src/app/(app)/project/[projectId]/pixel-art/page.tsx:943`, `sprites/page.tsx:289`, `sfx/page.tsx:694`,
  `music/page.tsx:682`, `tilemap/page.tsx:477` (each: rows, list container, list header)

**Interfaces:**
- Consumes: `assetTriggerProps`, `pasteTriggerProps`, `AssetMenuButton`, `PasteButton` (Task 6).

- [ ] **Step 1: Same shape on each list** — row `div`: spread `assetTriggerProps({ type, id })`, add `tabIndex={0}`
  (keyboard focus for Shift+F10; `:focus-visible` only shows for keyboard), append `AssetMenuButton` after the existing
  delete / play buttons. List container: `pasteTriggerProps(type)`. List header: `PasteButton type=…` next to the
  existing "new" button. Types: `sprite`, `spritesheet`, `sound`, `music`, `tilemap`. Leave the Sprite Sheets page's
  sprite picker and the tilemap tile picker alone (Task 14).
- [ ] **Step 2: Verify** `npx tsc --noEmit -p .`, `npm run lint`, `npm run build`.
- [ ] **Step 3: Controller (browser)** — 1440×900, each of the five tools: screenshot equals `main`; right-click a row
  opens the menu; Rename… on the asset currently open in the editor (Pixel Art: draw a pixel, rename within 1 s) keeps
  the new name and the drawing; Duplicate in Music shows the copy in the list and opens it; Delete… on the open sprite
  clears the editor without errors; Copy a tilemap, open another project's Tilemap → Paste is disabled with
  "Only in …". 390×844: `⋯` on each row, long-press opens without selecting the row, no overflow.
- [ ] **Step 4: Commit** — subject `feat: asset menu on pixel art, sheet, sfx, music, tilemap lists`.

### Task 10: Tool lists — Story, Dialogue, Palettes, Notebook, Voxels

**Files:**
- Modify: `src/app/(app)/project/[projectId]/story/page.tsx:580`, `dialogue/page.tsx:756`, `palettes/page.tsx:263`,
  `notebook/page.tsx:762` and `:852-858`, `src/components/voxels/ModelList.tsx` (`ModelRow`, header)

**Interfaces:**
- Consumes: as Task 9.

- [ ] **Step 1: Div rows** (dialogue, palettes, `ModelRow`) — as Task 9 Step 1; `ModelRow` calls `useAssetMenu()` itself.
  All five lists also get Task 9's list-container `pasteTriggerProps(type)` and header `PasteButton` (types `story`,
  `dialogue`, `palette`, `note`, `model`).
- [ ] **Step 2: Button rows** (story entries, notebook notes cannot nest a button) — wrap each row in
  `<div className="relative">`, spread `assetTriggerProps` on the row button, add `max-md:pr-9` to it and place
  `AssetMenuButton` absolutely (`md:hidden absolute right-1 top-1/2 -translate-y-1/2`).
- [ ] **Step 3: Notebook pin wording** — the editor's pin button `title` becomes `draft.pinned ? "Unpin in Notebook" : "Pin in Notebook"`
  and `aria-label` the same; the list's "Pinned" group header stays.
- [ ] **Step 4: Verify** `npx tsc --noEmit -p .`, `npm run lint`, `npm run build`.
- [ ] **Step 5: Controller (browser)** — 1440×900: the five lists equal `main` (Notebook pin tooltip text aside);
  right-click a note → "Pin in Notebook" moves it to the Pinned group, "Pin to sidebar" adds it to the side menu;
  right-click inside the note textarea and the story textarea → native menu (spellcheck works); rename the open note
  while typing → no lost characters and the title shows the new name; Copy a palette → Paste in another project's
  Palettes works. 390×844: `⋯` on every row, no overflow.
- [ ] **Step 6: Commit** — subject `feat: asset menu on story, dialogue, palette, note, model lists`.

### Task 11: Wiki links, backlinks, graph nodes, Task Board and Diagrams

**Files:**
- Modify: `src/app/(app)/project/[projectId]/story/page.tsx` (`renderInline` ~L319, backlinks ~L781, graph `<g>` ~L453),
  `notebook/page.tsx` (`renderInline` ~L186), `board/page.tsx` (`IssueCard` ~L739, backlog rows ~L1083, all-issues
  `<tr>` ~L1252, header), `diagrams/page.tsx` (list rows ~L800, list header, canvas ~L976)

**Interfaces:**
- Consumes: `assetTriggerProps`, `openAssetMenu`, `AssetMenuButton`, `PasteButton` (Task 6); `createLongPress`,
  `anchorPoint` (Task 1); the diagram page's `hitTestNode`, `nodeAsset`, `screenToCanvas` (~L442).

- [ ] **Step 1: Story and notebook** — resolved wiki-link buttons get `assetTriggerProps` of the target (story entry
  or note); unresolved "Create ‘X’" links keep the native menu. Story backlink buttons and graph `<g>` nodes (story
  and asset nodes) get `assetTriggerProps`.
- [ ] **Step 2: Board** — `IssueCard` root: `assetTriggerProps({ type: "issue", id })` (its existing `⋯` "Move to…"
  stays; phones use long-press). Backlog rows and all-issues rows: `assetTriggerProps` + `AssetMenuButton` (all-issues:
  inside the first `<td>`, so no new column). Header: `PasteButton type="issue"`.
- [ ] **Step 3: Diagrams** — list rows as Task 9 Step 1 (`type: "diagram"`), `PasteButton type="diagram"` in the list
  header. Canvas `onContextMenu`: hit-test the pointer; a node with `nodeAsset` → `preventDefault` + `openAssetMenu`
  for that ref; otherwise do nothing (native menu, as today). Touch: a `createLongPress` instance fed from the
  existing `handlePointerDown` / move / up; on fire, open the node's menu and end the current drag without moving
  the node; the next tap is swallowed via `consumeClick()` so the double-tap label editor does not open.
- [ ] **Step 4: Verify** `npx tsc --noEmit -p .`, `npm run lint`, `npm run build`.
- [ ] **Step 5: Controller (browser)** — 1440×900: board, backlog, all-issues and diagram list screenshots equal
  `main`; right-click a card → "Move to column ▸" flyout moves it and Ctrl+Z undoes it; "Add to sprint ▸" moves an
  issue out of the backlog; right-click a wiki link in story preview → that entry's menu; right-click an asset node in
  a diagram → the asset's menu, a plain node → native menu; in open diagram "Flow", right-click an asset node →
  "Add to diagram…" → Flow → a new node appears right of the rightmost node and survives a reload. 390×844: long-press a card (no drag, no open), long-press an asset node, `⋯` on
  backlog rows, no overflow.
- [ ] **Step 6: Commit** — subject `feat: asset menu on wiki links, board issues and diagram nodes`.

### Task 12: Sprite shortcuts — Use in Tilemap, Make 3D model

**Files:**
- Modify: `src/lib/asset-menu-items.ts` (+ test), `src/components/AssetContextMenu.tsx` (dispatch),
  `src/app/(app)/project/[projectId]/tilemap/page.tsx` (`?tile=`), `voxels/page.tsx` + `src/components/voxels/SpriteImportDialog.tsx` (`?fromSprite=`)

**Interfaces:**
- Produces: `AssetActionId` gains `"use-in-tilemap" | "make-3d-model"` (sprite group B, before "Export PNG").
  `SpriteImportDialog` gains `autoConvertSpriteId?: string` (runs `convert` once on mount for that sprite; failures show
  the existing messages). Routes: `/project/{p}/tilemap?tile={spriteId}` sets `selectedTile` to the sprite and the
  tool to paint (kept when a map is created after); `/project/{p}/voxels?fromSprite={spriteId}` opens the dialog with it.

- [ ] **Step 1: Write failing test** — sprite labels now start
  `["Open", "Open in new tab", "—", "Use in Tilemap", "Make 3D model", "Export PNG", "—", …]`.
- [ ] **Step 2: Run** `npx vitest run src/lib/asset-menu-items.test.ts` — Expected: FAIL; implement; Expected: PASS.
- [ ] **Step 3: Implement** the two params (read with `useSearchParams`, act once per value like `useOpenParam`) and the
  dispatch (`router.push`).
- [ ] **Step 4: Verify** `npm test`, `npx tsc --noEmit -p .`, `npm run lint`, `npm run build`.
- [ ] **Step 5: Controller (browser)** — 1440×900: sprite "Use in Tilemap" lands in Tilemap with that tile selected and
  painting with it works; "Make 3D model" lands in Voxels and creates "{name} 3D" linked to the sprite; a 128 px
  sprite shows the existing "bigger than 64 pixels" message. Voxels and Tilemap screenshots without params equal `main`.
- [ ] **Step 6: Commit** — subject `feat: send sprites to tilemap and voxels from the asset menu`.

### Task 13: Sound and music Play / Stop

**Files:**
- Create: `src/lib/audio/sfx-synth.ts` (move `SAMPLE_RATE` + `synthesize` from `sfx/page.tsx:20,147`),
  `src/lib/audio/music-synth.ts` (move `midiToFreq` from `music/page.tsx:40`; `scheduleNote` becomes a module function
  taking `destination: AudioNode`), `src/lib/audio/preview.ts`
- Modify: `sfx/page.tsx`, `music/page.tsx` (import the moved code; no behaviour change), `src/lib/asset-menu-items.ts`
  (+ test), `src/components/AssetContextMenu.tsx`
- Test: `src/lib/audio/music-synth.test.ts`

**Interfaces:**
- Produces: `scheduleNote(ctx: AudioContext, destination: AudioNode, note: MusicNote, instrument: string, volume: number, when: number, beatDuration: number): AudioScheduledSourceNode`,
  `trackLengthSeconds(track: MusicTrack): number` (last note end in beats × 60 / bpm);
  `playPreview(projectId: string, ref: AssetRef): void` (sound: synthesize + buffer; music: one pass of every
  channel, not looped; gain `previewGain()` at start; stops any previous preview), `stopPreview(): void`,
  `getPreviewing(): AssetRef | null`, `subscribePreview(listener: () => void): () => void` (clears itself when playback ends).
  `AssetActionId` gains `"toggle-preview"`; `AssetMenuContext` gains `isPreviewing?: boolean`; label "Play" / "Stop",
  group B for sound and music.

- [ ] **Step 1: Write failing tests**
  ```ts
  expect(trackLengthSeconds({ bpm: 120, channels: [{ patterns: [{ notes: [{ start: 0, duration: 4 }, { start: 6, duration: 2 }] }] }] } as MusicTrack)).toBe(4);
  expect(trackLengthSeconds({ bpm: 120, channels: [] } as unknown as MusicTrack)).toBe(0);
  expect(labels(getAssetMenuEntries({ ref: soundRef, name: "Jump", isPinnedToSidebar: false, isPreviewing: true })).slice(0, 4)).toEqual(["Open", "Open in new tab", "—", "Stop"]);
  ```
- [ ] **Step 2: Run** `npx vitest run src/lib/audio src/lib/asset-menu-items.test.ts` — Expected: FAIL; implement; PASS.
- [ ] **Step 3: Verify** `npm test`, `npx tsc --noEmit -p .`, `npm run lint`, `npm run build`.
- [ ] **Step 4: Controller (browser)** — dashboard: right-click an SFX → Play sounds at the preview volume; right-click
  a music track → Play, reopen menu → Stop silences it; SFX and Music pages still play and export WAV as before.
- [ ] **Step 5: Commit** — subject `feat: preview sounds and music from the asset menu`; bullets: synth code moved out of
  the pages unchanged so the menu can play outside them.

### Task 14: Pixel Art frame menu, tile picker, missing-reference placeholders

**Files:**
- Modify: `src/app/(app)/project/[projectId]/pixel-art/page.tsx` (`duplicateFrame` / `deleteFrame` ~L756-775, frame
  strip ~L1353), `tilemap/page.tsx` (tile picker ~L510), `diagrams/page.tsx` (badge ~L387, "Open" link ~L1041)

**Interfaces:**
- Consumes: `menuTriggerProps`, `assetTriggerProps` (Task 6), `copyToSystemClipboard` (Task 2).
- Produces (pixel-art, local): `duplicateFrame(index = activeFrame)`, `deleteFrame(index = activeFrame)`,
  `moveFrame(index: number, direction: -1 | 1)`, `copyFrameAsPng(index: number)` — all through `pushHistory` (undoable).

- [ ] **Step 1: Frame strip** — each frame button gets `menuTriggerProps(() => entries, "Frame {i + 1}")` with
  "Duplicate", "Delete" (`danger`, disabled when one frame), "Copy as PNG" (`compositeFrame` → `copyToSystemClipboard`,
  toast "Copied"), "Move left" / "Move right" (disabled at the ends; the active frame follows the moved frame).
- [ ] **Step 2: Tile picker** — sprite tile buttons get `assetTriggerProps({ type: "sprite", id })` (its Open / Copy /
  Link to asset… are the sprite menu's).
- [ ] **Step 3: Missing references** — confirm tilemap cells already draw the red cross (`tilemap/page.tsx:92`) and
  sheets skip missing sprites (`sprites/page.tsx:108`); in diagrams, when `getAsset` returns nothing the badge uses
  `var(--text-muted)` and the "Open …" link becomes muted text "Linked asset was deleted".
- [ ] **Step 4: Verify** `npm test`, `npx tsc --noEmit -p .`, `npm run lint`, `npm run build`.
- [ ] **Step 5: Controller (browser)** — 1440×900: right-click frame 2 → Move left makes it frame 1, Ctrl+Z restores;
  Copy as PNG pastes as an image in another app; right-click the canvas → unchanged behaviour; right-click a tile in
  the tilemap picker → sprite menu. Delete a sprite used in "Meadow", a sheet and a diagram node: Meadow shows crosses,
  the sheet packs without it, the diagram shows "Linked asset was deleted"; no page errors. 390×844: long-press a frame
  and a tile, no overflow.
- [ ] **Step 6: Commit** — subject `feat: frame strip menu, tile picker menu, deleted-asset placeholders`.

## Final verification (controller)

- `npm test`, `npx tsc --noEmit -p .`, `npm run lint` (no new findings), `npm run build`, then `npx next start`.
- Playwright pass at 1440×900 and 390×844 per `CLAUDE.md`: new project with examples, open every tool, no page errors,
  no horizontal overflow on phones; desktop screenshots of every tool match `main` with nothing copied or pinned.
- Every surface in the spec's "Where it works" opens the same menu (right-click / long-press / `⋯`); keyboard open with
  Shift+F10, arrows, Esc returns focus; cross-project paste per the rules; pins survive a reload and sign-in sync.
