"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { AssetRef, AssetType, Issue, Note, Sprite } from "@/types";
import { ContextMenu, type ContextMenuEntry } from "@/components/ContextMenu";
import { AssetPickerModal } from "@/components/AssetPickerModal";
import { useSync } from "@/components/SyncProvider";
import { useToast, type ToastOptions } from "@/components/Toast";
import { saveIssue } from "@/components/board/meta";
import {
  addAssetToDiagram,
  assetUrl,
  copyToSystemClipboard,
  createDiagramWith,
  createNoteAbout,
  createTaskFor,
  deleteAsset,
  deleteConfirmMessage,
  duplicateAsset,
  getAssetName,
  getStoredAsset,
  renameAsset,
  systemClipboardPayload,
  type StoredAsset,
} from "@/lib/asset-actions";
import { canPaste, copyAsset, pasteAsset, readClipboard } from "@/lib/asset-clipboard";
import {
  getAssetMenuEntries,
  needsEditorReload,
  type AssetActionId,
  type AssetMenuContext,
  type AssetMenuEntry,
} from "@/lib/asset-menu-items";
import { assetHref } from "@/lib/assets";
import { flushAllAutosaves } from "@/lib/autosave-registry";
import { downloadBlob } from "@/lib/download";
import { addLink, getRelated } from "@/lib/links";
import { createLongPress, type LongPress } from "@/lib/long-press";
import { anchorPoint, contextMenuDecision, shouldUseNativeMenu, type Point } from "@/lib/menu-position";
import { isAssetPinned, toggleAssetPin } from "@/lib/pins";
import { loadImage, spriteFrameSrc } from "@/lib/pixels";
import { storage } from "@/lib/storage";

export interface MenuTriggerProps {
  "data-asset-menu": "";
  onContextMenu(e: React.MouseEvent<Element>): void;
  onPointerDown(e: React.PointerEvent<Element>): void;
  onPointerMove(e: React.PointerEvent<Element>): void;
  onPointerUp(e: React.PointerEvent<Element>): void;
  onPointerCancel(e: React.PointerEvent<Element>): void;
  onPointerLeave(e: React.PointerEvent<Element>): void;
  onClickCapture(e: React.MouseEvent<Element>): void;
}

export interface AssetMenuApi {
  projectId: string | null;
  openAssetMenu(anchor: Point, ref: AssetRef, opener?: HTMLElement | null): void;
  openMenu(anchor: Point, entries: ContextMenuEntry[], label: string, opener?: HTMLElement | null): void;
  assetTriggerProps(ref: AssetRef): MenuTriggerProps;
  /** `getEntries` returning null leaves the browser's own menu. */
  menuTriggerProps(getEntries: () => ContextMenuEntry[] | null, label: string): MenuTriggerProps;
  /** List background: opens "Paste" only when the clipboard fits `type`, otherwise the browser's own menu. */
  pasteTriggerProps(type?: AssetType): MenuTriggerProps;
  paste(type?: AssetType): Promise<void>;
}

export interface PickerRequest {
  title: string;
  types?: AssetType[];
  exclude: AssetRef[];
  createLabel?: string;
  onCreate?(): void;
  onPick(ref: AssetRef): void;
}

type OpenAt = (anchor: Point, opener: HTMLElement | null) => void;
type ResolveOpen = () => OpenAt | null;

interface OpenMenuState {
  id: number;
  anchor: Point;
  entries: ContextMenuEntry[];
  label: string;
}

interface MenuServices {
  projectId: string;
  pathname: string;
  router: ReturnType<typeof useRouter>;
  showToast(options: ToastOptions): void;
  reloadView(): void;
  openPicker(request: PickerRequest, opener: HTMLElement | null): void;
}

interface MenuTarget {
  context: AssetMenuContext;
  item: StoredAsset;
}

interface ActionRun extends MenuTarget {
  services: MenuServices;
  arg?: string;
  opener: HTMLElement | null;
}

type ActionHandler = (run: ActionRun) => void | Promise<void>;

const COPY_FAILED_MESSAGE = "Couldn't copy: the browser blocked the clipboard";
const ISSUE_ORDER_STEP = 1000;
const PROJECT_PATH = /\/project\/([^/]+)/;

const AssetMenuApiContext = createContext<AssetMenuApi | null>(null);

export function useAssetMenu(): AssetMenuApi {
  const api = useContext(AssetMenuApiContext);
  if (!api) throw new Error("useAssetMenu must be used inside <AssetContextMenuProvider>");
  return api;
}

function restoreFocus(opener: HTMLElement | null): void {
  if (opener?.isConnected) opener.focus({ preventScroll: true });
}

function readMenuTarget(projectId: string, ref: AssetRef): MenuTarget | null {
  const item = getStoredAsset(projectId, ref);
  if (!item) return null;
  const context: AssetMenuContext = {
    ref,
    name: getAssetName(ref.type, item),
    isPinnedToSidebar: isAssetPinned(projectId, ref),
  };
  if (ref.type === "note") context.isNotePinned = Boolean((item as Note).pinned);
  if (ref.type === "issue") {
    context.board = storage.getAll("boards", projectId)[0];
    context.issue = item as Issue;
  }
  return { context, item };
}

function entryKey(entry: Extract<AssetMenuEntry, { kind: "item" }>): string {
  return entry.arg === undefined ? entry.action : `${entry.action}:${entry.arg}`;
}

/** A disabled entry never carries its submenu, so it shows no ▸ and cannot open one. */
function toMenuEntries(entries: AssetMenuEntry[], run: (action: AssetActionId, arg?: string) => void): ContextMenuEntry[] {
  return entries.map((entry, index): ContextMenuEntry => {
    if (entry.kind === "separator") return { kind: "separator", key: `separator-${index}` };
    const submenu = entry.submenu && !entry.disabled ? toMenuEntries(entry.submenu, run) : undefined;
    return {
      kind: "item",
      key: entryKey(entry),
      label: entry.label,
      danger: entry.danger,
      disabled: entry.disabled,
      hint: entry.hint,
      submenu,
      onSelect: submenu || entry.disabled ? undefined : () => run(entry.action, entry.arg),
    };
  });
}

/** Writes pending editor saves first, then re-mounts the editor when it shows the changed asset's tool. */
async function mutate(services: MenuServices, change: () => AssetRef | null, isDelete = false): Promise<AssetRef | null> {
  await flushAllAutosaves();
  const result = change();
  const { pathname, projectId, router, reloadView } = services;
  if (result && needsEditorReload(pathname, projectId, result.type)) {
    router.replace(isDelete ? pathname : assetHref(projectId, result.type, result.id), { scroll: false });
    reloadView();
  }
  return result;
}

function toastWithOpen(services: MenuServices, message: string, ref: AssetRef): void {
  services.showToast({ message, action: { label: "Open", href: assetHref(services.projectId, ref.type, ref.id) } });
}

function nameOf(projectId: string, ref: AssetRef): string {
  return getAssetName(ref.type, getStoredAsset(projectId, ref));
}

async function copyText(services: MenuServices, text: string): Promise<void> {
  const isCopied = await copyToSystemClipboard({ kind: "text", text });
  services.showToast({ message: isCopied ? "Copied" : COPY_FAILED_MESSAGE });
}

async function spritePngBlob(sprite: Sprite): Promise<Blob | null> {
  const src = spriteFrameSrc(sprite);
  if (!src) return null;
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d")?.drawImage(image, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function relatedRefs(projectId: string, ref: AssetRef): AssetRef[] {
  return [ref, ...getRelated(projectId, ref.type, ref.id).map(({ type, id }) => ({ type, id }))];
}

function openLinkPicker(run: ActionRun, title: string, types?: AssetType[]): void {
  const { services, context } = run;
  const { projectId } = services;
  services.openPicker(
    {
      title,
      types,
      exclude: relatedRefs(projectId, context.ref),
      onPick: (picked) => {
        addLink(projectId, context.ref, picked);
        toastWithOpen(services, `Linked to ${nameOf(projectId, picked)}`, picked);
      },
    },
    run.opener,
  );
}

async function addToDiagram(services: MenuServices, change: () => AssetRef | null): Promise<void> {
  const diagram = await mutate(services, change);
  if (diagram) toastWithOpen(services, `Added to ${nameOf(services.projectId, diagram)}`, diagram);
}

function openDiagramPicker(run: ActionRun): void {
  const { services, context } = run;
  const { projectId } = services;
  const toRef = (id: string | undefined): AssetRef | null => (id ? { type: "diagram", id } : null);
  services.openPicker(
    {
      title: "Add to diagram",
      types: ["diagram"],
      exclude: [context.ref],
      createLabel: "New diagram",
      onCreate: () => void addToDiagram(services, () => toRef(createDiagramWith(projectId, context.ref).id)),
      onPick: (picked) => void addToDiagram(services, () => toRef(addAssetToDiagram(projectId, picked.id, context.ref)?.id)),
    },
    run.opener,
  );
}

function moveToColumn({ services, context, arg }: ActionRun): void {
  const { board, issue } = context;
  if (!board || !issue || !arg) return;
  const siblings = storage.getAll("issues", services.projectId).filter((other) => other.status === arg);
  const order = siblings.reduce((max, other) => Math.max(max, other.order), 0) + ISSUE_ORDER_STEP;
  saveIssue(services.projectId, board, issue, { status: arg, order });
}

function addToSprint({ services, context, arg }: ActionRun): void {
  const { board, issue } = context;
  if (!board || !issue || arg === undefined) return;
  saveIssue(services.projectId, board, issue, { sprintId: arg || null });
}

async function toggleNotePin({ services, item }: ActionRun): Promise<void> {
  const note = item as Note;
  await mutate(services, () => {
    storage.save("notes", { ...note, pinned: !note.pinned, updatedAt: new Date().toISOString() }, services.projectId);
    return { type: "note", id: note.id };
  });
}

async function exportPng({ context, item }: ActionRun): Promise<void> {
  const blob = await spritePngBlob(item as Sprite);
  if (blob) downloadBlob(`${context.name}.png`, blob);
}

async function duplicate({ services, context }: ActionRun): Promise<void> {
  const copy = await mutate(services, () => duplicateAsset(services.projectId, context.ref));
  if (copy) toastWithOpen(services, `Duplicated as ${nameOf(services.projectId, copy)}`, copy);
}

async function copyInApp({ services, context }: ActionRun): Promise<void> {
  await flushAllAutosaves();
  if (copyAsset(services.projectId, context.ref)) services.showToast({ message: "Copied" });
}

async function copySystem({ services, context, item }: ActionRun): Promise<void> {
  const isCopied = await copyToSystemClipboard(systemClipboardPayload(context.ref.type, item));
  services.showToast({ message: isCopied ? "Copied" : COPY_FAILED_MESSAGE });
}

function toggleSidebarPin({ services, context }: ActionRun): void {
  const wasPinned = isAssetPinned(services.projectId, context.ref);
  toggleAssetPin(services.projectId, context.ref);
  if (!wasPinned) services.showToast({ message: "Pinned to sidebar" });
}

async function rename({ services, context }: ActionRun): Promise<void> {
  const next = window.prompt("Rename", context.name);
  if (next === null || !next.trim() || next.trim() === context.name) return;
  await mutate(services, () => {
    renameAsset(services.projectId, context.ref, next);
    return context.ref;
  });
}

async function remove({ services, context }: ActionRun): Promise<void> {
  if (!window.confirm(deleteConfirmMessage(services.projectId, context.ref))) return;
  await mutate(
    services,
    () => {
      deleteAsset(services.projectId, context.ref);
      return context.ref;
    },
    true,
  );
}

function pushTo(path: (run: ActionRun) => string): ActionHandler {
  return (run) => run.services.router.push(path(run));
}

const ACTION_HANDLERS: Record<AssetActionId, ActionHandler> = {
  open: pushTo(({ services, context }) => assetHref(services.projectId, context.ref.type, context.ref.id)),
  "open-new-tab": ({ services, context }) =>
    void window.open(assetHref(services.projectId, context.ref.type, context.ref.id), "_blank", "noopener"),
  "export-png": exportPng,
  "use-in-pixel-art": pushTo(({ services, context }) => `/project/${services.projectId}/pixel-art?palette=${encodeURIComponent(context.ref.id)}`),
  "use-in-voxels": pushTo(({ services, context }) => `/project/${services.projectId}/voxels?palette=${encodeURIComponent(context.ref.id)}`),
  "toggle-note-pin": toggleNotePin,
  "move-to-column": moveToColumn,
  "add-to-sprint": addToSprint,
  "link-to-note": (run) => openLinkPicker(run, "Link to note", ["note"]),
  "new-note": pushTo(({ services, context }) => assetHref(services.projectId, "note", createNoteAbout(services.projectId, context.ref).id)),
  "add-to-diagram": openDiagramPicker,
  "create-task": pushTo(({ services, context }) => assetHref(services.projectId, "issue", createTaskFor(services.projectId, context.ref).id)),
  "link-to-asset": (run) => openLinkPicker(run, "Link to asset"),
  "show-links": pushTo(({ services, context }) => `/project/${services.projectId}/assets?links=${context.ref.type}:${encodeURIComponent(context.ref.id)}`),
  duplicate,
  copy: copyInApp,
  "copy-system": copySystem,
  "copy-name": ({ services, context }) => copyText(services, context.name),
  "copy-link": ({ services, context }) => copyText(services, assetUrl(window.location.origin, services.projectId, context.ref)),
  "toggle-sidebar-pin": toggleSidebarPin,
  rename,
  delete: remove,
};

function runAction(services: MenuServices, ref: AssetRef, action: AssetActionId, arg: string | undefined, opener: HTMLElement | null): void {
  const target = readMenuTarget(services.projectId, ref);
  if (target) void ACTION_HANDLERS[action]({ ...target, services, arg, opener });
}

function useLastPointerType(): React.RefObject<string | null> {
  const lastPointerType = useRef<string | null>(null);
  useEffect(() => {
    const trackPointer = (event: PointerEvent): void => {
      lastPointerType.current = event.pointerType;
    };
    const resetOnKey = (): void => {
      lastPointerType.current = null;
    };
    window.addEventListener("pointerdown", trackPointer, true);
    window.addEventListener("keydown", resetOnKey, true);
    return () => {
      window.removeEventListener("pointerdown", trackPointer, true);
      window.removeEventListener("keydown", resetOnKey, true);
    };
  }, []);
  return lastPointerType;
}

interface PressedTrigger {
  resolve: ResolveOpen;
  element: HTMLElement;
  event: Event;
}

/** One long-press controller for every trigger; the innermost trigger pressed last decides what opens. */
function createPressTracker(): { longPress: LongPress; press(trigger: PressedTrigger): boolean } {
  let pressed: PressedTrigger | null = null;
  const longPress = createLongPress((point) => pressed?.resolve()?.(point, pressed.element));
  const press = (trigger: PressedTrigger): boolean => {
    if (pressed?.event === trigger.event) return false;
    pressed = trigger;
    return true;
  };
  return { longPress, press };
}

function useTriggerFactory(): (resolve: ResolveOpen) => MenuTriggerProps {
  const lastPointerType = useLastPointerType();
  const [{ longPress, press }] = useState(createPressTracker);

  return useCallback(
    (resolve: ResolveOpen): MenuTriggerProps => ({
      "data-asset-menu": "",
      onContextMenu(e) {
        const selectedText = window.getSelection()?.toString() ?? "";
        const isNativeTarget = shouldUseNativeMenu(e.target instanceof Element ? e.target : null, selectedText);
        const decision = contextMenuDecision({ isNativeTarget, lastPointerType: lastPointerType.current });
        if (decision === "native") return;
        const open = resolve();
        if (!open) return;
        e.preventDefault();
        if (decision === "ignore") return;
        e.stopPropagation();
        const opener = e.currentTarget as HTMLElement;
        open(anchorPoint(e, opener.getBoundingClientRect()), opener);
      },
      onPointerDown(e) {
        if (!press({ resolve, element: e.currentTarget as HTMLElement, event: e.nativeEvent })) return;
        longPress.down({ x: e.clientX, y: e.clientY, pointerType: e.pointerType });
      },
      onPointerMove: (e) => longPress.move({ x: e.clientX, y: e.clientY }),
      onPointerUp: () => longPress.up(),
      onPointerCancel: () => longPress.cancel(),
      onPointerLeave: () => longPress.cancel(),
      onClickCapture(e) {
        if (!longPress.consumeClick()) return;
        e.preventDefault();
        e.stopPropagation();
      },
    }),
    [lastPointerType, longPress, press],
  );
}

function useMenuState(): {
  menu: OpenMenuState | null;
  openMenu: AssetMenuApi["openMenu"];
  closeMenu(): void;
} {
  const [menu, setMenu] = useState<OpenMenuState | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openMenu = useCallback((anchor: Point, entries: ContextMenuEntry[], label: string, from?: HTMLElement | null) => {
    opener.current = from ?? null;
    setMenu((previous) => ({ id: (previous?.id ?? 0) + 1, anchor, entries, label }));
  }, []);
  const closeMenu = useCallback(() => {
    const from = opener.current;
    opener.current = null;
    setMenu(null);
    restoreFocus(from);
  }, []);
  return { menu, openMenu, closeMenu };
}

function usePickerState(): {
  picker: PickerRequest | null;
  openPicker: MenuServices["openPicker"];
  closePicker(): void;
} {
  const [picker, setPicker] = useState<PickerRequest | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openPicker = useCallback((request: PickerRequest, from: HTMLElement | null) => {
    opener.current = from;
    setPicker(request);
  }, []);
  const closePicker = useCallback(() => {
    const from = opener.current;
    opener.current = null;
    setPicker(null);
    restoreFocus(from);
  }, []);
  return { picker, openPicker, closePicker };
}

function useMenuServices(projectId: string | null, openPicker: MenuServices["openPicker"]): MenuServices | null {
  const pathname = usePathname();
  const router = useRouter();
  const { showToast } = useToast();
  const { reloadView } = useSync();
  return useMemo(
    () => (projectId ? { projectId, pathname, router, showToast, reloadView, openPicker } : null),
    [projectId, pathname, router, showToast, reloadView, openPicker],
  );
}

async function pasteFromClipboard(services: MenuServices | null, type?: AssetType): Promise<void> {
  const clip = readClipboard();
  if (!services || !clip || (type && clip.type !== type) || !canPaste(clip, services.projectId).ok) return;
  const pasted = await mutate(services, () => pasteAsset(clip, services.projectId));
  if (pasted) toastWithOpen(services, `Pasted ${nameOf(services.projectId, pasted)}`, pasted);
}

function assetMenuOpener(services: MenuServices | null, ref: AssetRef, openMenu: AssetMenuApi["openMenu"]): OpenAt | null {
  const target = services && readMenuTarget(services.projectId, ref);
  if (!services || !target) return null;
  return (anchor, opener) => {
    const run = (action: AssetActionId, arg?: string): void => runAction(services, ref, action, arg, opener);
    openMenu(anchor, toMenuEntries(getAssetMenuEntries(target.context), run), target.context.name, opener);
  };
}

function pasteMenuOpener(services: MenuServices | null, type: AssetType | undefined, openMenu: AssetMenuApi["openMenu"]): OpenAt | null {
  const clip = readClipboard();
  if (!services || !clip || (type && clip.type !== type)) return null;
  const check = canPaste(clip, services.projectId);
  const paste = (): void => void pasteFromClipboard(services, type);
  const entries: ContextMenuEntry[] = [
    { kind: "item", key: "paste", label: "Paste", disabled: !check.ok, hint: check.ok ? undefined : check.reason, onSelect: paste },
  ];
  return (anchor, opener) => openMenu(anchor, entries, "Paste", opener);
}

function createAssetMenuApi(
  projectId: string | null,
  services: MenuServices | null,
  openMenu: AssetMenuApi["openMenu"],
  createTriggerProps: (resolve: ResolveOpen) => MenuTriggerProps,
): AssetMenuApi {
  const openWhenInProject: AssetMenuApi["openMenu"] = (anchor, entries, label, opener) => {
    if (services) openMenu(anchor, entries, label, opener);
  };
  return {
    projectId,
    openAssetMenu: (anchor, ref, opener) => assetMenuOpener(services, ref, openMenu)?.(anchor, opener ?? null),
    openMenu: openWhenInProject,
    assetTriggerProps: (ref) => createTriggerProps(() => assetMenuOpener(services, ref, openMenu)),
    menuTriggerProps: (getEntries, label) =>
      createTriggerProps(() => {
        const entries = services ? getEntries() : null;
        return entries ? (anchor, opener) => openMenu(anchor, entries, label, opener) : null;
      }),
    pasteTriggerProps: (type) => createTriggerProps(() => pasteMenuOpener(services, type, openMenu)),
    paste: (type) => pasteFromClipboard(services, type),
  };
}

function OpenPicker({ projectId, request, onClose }: { projectId: string; request: PickerRequest; onClose(): void }): React.JSX.Element {
  const { onCreate, onPick } = request;
  const handleCreate = (): void => {
    onClose();
    onCreate?.();
  };
  const handlePick = (ref: AssetRef): void => {
    onClose();
    onPick(ref);
  };
  return (
    <AssetPickerModal
      projectId={projectId}
      title={request.title}
      types={request.types}
      exclude={request.exclude}
      createLabel={request.createLabel}
      onCreate={onCreate ? handleCreate : undefined}
      onPick={handlePick}
      onClose={onClose}
    />
  );
}

/** Holds the one asset menu and picker; surfaces only spread the trigger props it hands out. */
export function AssetContextMenuProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const projectId = usePathname().match(PROJECT_PATH)?.[1] ?? null;
  const { menu, openMenu, closeMenu } = useMenuState();
  const { picker, openPicker, closePicker } = usePickerState();
  const services = useMenuServices(projectId, openPicker);
  const createTriggerProps = useTriggerFactory();

  const api = useMemo(
    () => createAssetMenuApi(projectId, services, openMenu, createTriggerProps),
    [projectId, services, openMenu, createTriggerProps],
  );

  return (
    <AssetMenuApiContext.Provider value={api}>
      {children}
      {menu && <ContextMenu key={menu.id} anchor={menu.anchor} entries={menu.entries} label={menu.label} onClose={closeMenu} />}
      {picker && projectId && <OpenPicker projectId={projectId} request={picker} onClose={closePicker} />}
    </AssetMenuApiContext.Provider>
  );
}
