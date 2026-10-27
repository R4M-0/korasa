"use client";

import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import type { Editor as TiptapEditor } from "@tiptap/react";
import { api } from "@/lib/api/client";
import {
  center,
  isLinear,
  pruneBindings,
  resolveConnectors,
  type Box,
  type Point,
} from "@/lib/editor/geometry";
import {
  computeLayout,
  fitBox,
  fitPageWidth,
  zoomAt,
  clampZoom,
  type Viewport,
} from "@/lib/editor/layout";
import {
  cloneObjects,
  DEFAULT_STYLE,
  expandGroups,
  newId,
  reorderObjects,
  selectionBounds,
  type StyleDefaults,
  type Tool,
  type ZOrderAction,
} from "@/lib/editor/objects";
import {
  pageSize,
  parseScene,
  type Orientation,
  type PageBackground,
  type Scene,
  type SceneObject,
} from "@/lib/editor/scene";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { CollectionDTO, PageDTO, PageSummaryDTO, ProjectDTO, ProjectViewMode } from "@/types";

// ----------------------------------------------------------------- types

export interface PageState {
  id: string;
  title: string;
  background: PageBackground;
  orientation: Orientation;
  posX: number | null;
  posY: number | null;
  scene: Scene;
  revision: number;
  position: number;
  createdAt: string;
  updatedAt: string;
  favoritedAt: string | null;
  lastOpenedAt: string | null;
}

interface PageSnapshot {
  scene: Scene;
  title: string;
  background: PageBackground;
  orientation: Orientation;
}

interface HistoryEntry {
  pageId: string;
  before: PageSnapshot;
  after: PageSnapshot;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Selection {
  pageId: string | null;
  ids: string[];
}

interface EditorState {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  project: ProjectDTO | null;
  breadcrumbs: CollectionDTO[];
  pageOrder: string[];
  pages: Record<string, PageState>;
  activePageId: string | null;
  viewMode: ProjectViewMode;

  tool: Tool;
  toolLocked: boolean;
  selection: Selection;
  editing: { id: string; kind: "text" | "label"; caret?: Point } | null;
  /** Rubber-band selection rectangle (page coordinates). */
  marquee: { pageId: string; box: Box } | null;
  /** Object a connector endpoint would bind to while dragging. */
  bindTarget: string | null;
  /** Objects highlighted for deletion while the eraser is dragged. */
  erasing: string[];
  style: StyleDefaults;

  viewport: Viewport;
  viewportSize: { w: number; h: number };
  panels: { pages: boolean; properties: boolean };

  past: HistoryEntry[];
  future: HistoryEntry[];

  saveStatus: SaveStatus;
  saveError: string | null;
  lastSavedAt: number | null;
  dirty: Record<string, true>;

  /** The live Tiptap instance while a text object is being edited. */
  textEditor: TiptapEditor | null;
}

const initialState: EditorState = {
  status: "idle",
  error: null,
  project: null,
  breadcrumbs: [],
  pageOrder: [],
  pages: {},
  activePageId: null,
  viewMode: "stack",
  tool: "select",
  toolLocked: false,
  selection: { pageId: null, ids: [] },
  editing: null,
  marquee: null,
  bindTarget: null,
  erasing: [],
  style: DEFAULT_STYLE,
  viewport: { zoom: 1, panX: 0, panY: 0 },
  viewportSize: { w: 1200, h: 800 },
  panels: { pages: true, properties: false },
  past: [],
  future: [],
  saveStatus: "idle",
  saveError: null,
  lastSavedAt: null,
  dirty: {},
  textEditor: null,
};

export const useEditorStore = create<EditorState>()(() => initialState);
const get = useEditorStore.getState;
const set = useEditorStore.setState;

// ------------------------------------------------------------ utilities

function toPageState(p: PageDTO): PageState {
  return {
    id: p.id,
    title: p.title,
    background: p.background,
    orientation: p.orientation,
    posX: p.posX,
    posY: p.posY,
    scene: p.scene,
    revision: p.revision,
    position: p.position,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    favoritedAt: p.favoritedAt,
    lastOpenedAt: p.lastOpenedAt,
  };
}

function snapshot(pageId: string): PageSnapshot | null {
  const p = get().pages[pageId];
  if (!p) return null;
  return { scene: p.scene, title: p.title, background: p.background, orientation: p.orientation };
}

function sameObjects(a: SceneObject[], b: SceneObject[]) {
  return a === b || (a.length === b.length && a.every((o, i) => o === b[i]));
}

function sameSnapshot(a: PageSnapshot, b: PageSnapshot) {
  return (
    a.title === b.title &&
    a.background === b.background &&
    a.orientation === b.orientation &&
    sameObjects(a.scene.objects, b.scene.objects)
  );
}

const HISTORY_LIMIT = 200;

function pushHistory(pageId: string, before: PageSnapshot | null) {
  const after = snapshot(pageId);
  if (!before || !after || sameSnapshot(before, after)) return;
  set((s) => ({ past: [...s.past, { pageId, before, after }].slice(-HISTORY_LIMIT), future: [] }));
}

function applySnapshot(pageId: string, snap: PageSnapshot) {
  set((s) => {
    const page = s.pages[pageId];
    if (!page) return s;
    return { pages: { ...s.pages, [pageId]: { ...page, ...snap } } };
  });
  markDirty(pageId);
}

/** Selected objects on the selection's page. */
export function selectedObjects(s: EditorState = get()): SceneObject[] {
  const { pageId, ids } = s.selection;
  if (!pageId || !ids.length) return [];
  const page = s.pages[pageId];
  if (!page) return [];
  const set_ = new Set(ids);
  return page.scene.objects.filter((o) => set_.has(o.id));
}

let layoutCache: { key: unknown[]; value: Map<string, Box> } | null = null;
/** World-space page boxes (memoised on the inputs that affect layout). */
export function getLayout(s: EditorState = get()): Map<string, Box> {
  const key = [s.pageOrder, s.viewMode, s.viewMode === "single" ? s.activePageId : null, ...s.pageOrder.map((id) => {
    const p = s.pages[id];
    return p ? `${p.orientation}:${p.posX}:${p.posY}` : "";
  })];
  if (layoutCache && layoutCache.key.length === key.length && layoutCache.key.every((k, i) => k === key[i])) {
    return layoutCache.value;
  }
  const value = computeLayout(
    s.pageOrder.map((id) => s.pages[id]).filter(Boolean),
    s.viewMode,
    s.activePageId,
  );
  layoutCache = { key, value };
  return value;
}

// ------------------------------------------------------------- autosave

const SAVE_DEBOUNCE = 700;
const DRAFT_PREFIX = "korasa:draft:";
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let draftTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = 2000;
const versions = new Map<string, number>();
const inflight = new Map<string, Promise<boolean>>();

function markDirty(pageId: string) {
  versions.set(pageId, (versions.get(pageId) ?? 0) + 1);
  if (!get().dirty[pageId]) set((s) => ({ dirty: { ...s.dirty, [pageId]: true } }));
  if (get().saveStatus !== "error") set({ saveStatus: "idle" });
  scheduleSave(SAVE_DEBOUNCE);
  scheduleDrafts();
}

function scheduleSave(delay: number) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flushSaves(), delay);
}

function payloadFor(p: PageState) {
  return {
    scene: p.scene,
    title: p.title,
    background: p.background,
    orientation: p.orientation,
    posX: p.posX,
    posY: p.posY,
  };
}

async function savePage(pageId: string, keepalive = false): Promise<boolean> {
  const existing = inflight.get(pageId);
  if (existing && !keepalive) {
    await existing;
    if (!get().dirty[pageId]) return true;
  }
  const page = get().pages[pageId];
  if (!page) {
    set((s) => {
      const { [pageId]: _, ...rest } = s.dirty;
      void _;
      return { dirty: rest };
    });
    return true;
  }
  const version = versions.get(pageId) ?? 0;
  const run = (async () => {
    try {
      const res = await api.updatePage(pageId, payloadFor(page), { keepalive });
      const current = get().pages[pageId];
      if (current) {
        set((s) => ({
          pages: { ...s.pages, [pageId]: { ...current, revision: res.revision, updatedAt: res.updatedAt } },
        }));
      }
      if ((versions.get(pageId) ?? 0) === version) {
        set((s) => {
          const { [pageId]: _, ...rest } = s.dirty;
          void _;
          return { dirty: rest };
        });
        clearDraft(pageId);
      }
      useWorkspaceStore.getState().patchPageSummary(get().project?.id ?? "", pageId, {
        title: res.title,
        background: res.background,
        orientation: res.orientation,
        updatedAt: res.updatedAt,
      });
      return true;
    } catch (err) {
      set({ saveStatus: "error", saveError: err instanceof Error ? err.message : "Save failed" });
      return false;
    } finally {
      inflight.delete(pageId);
    }
  })();
  inflight.set(pageId, run);
  return run;
}

/** Save every dirty page now. Resolves true when everything persisted. */
export async function flushSaves(): Promise<boolean> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const ids = Object.keys(get().dirty);
  if (!ids.length) {
    await Promise.all(inflight.values());
    return true;
  }
  set({ saveStatus: "saving" });
  const results = await Promise.all(ids.map((id) => savePage(id)));
  const ok = results.every(Boolean);
  if (ok) {
    retryDelay = 2000;
    if (Object.keys(get().dirty).length) scheduleSave(SAVE_DEBOUNCE);
    else set({ saveStatus: "saved", saveError: null, lastSavedAt: Date.now() });
  } else {
    // Keep the dirty flags and retry with backoff; the UI shows "Save failed".
    scheduleSave(retryDelay);
    retryDelay = Math.min(retryDelay * 2, 30_000);
  }
  return ok;
}

// The desktop shell calls this before closing a window so pending edits land.
if (typeof window !== "undefined") {
  (window as unknown as { __korasaFlush?: () => Promise<boolean> }).__korasaFlush = flushSaves;
}

/** Best-effort synchronous persistence for tab close: local drafts + keepalive requests. */
export function flushOnUnload(): boolean {
  const ids = Object.keys(get().dirty);
  if (!ids.length) return true;
  writeDrafts();
  let allSent = true;
  for (const id of ids) {
    const page = get().pages[id];
    if (!page) continue;
    const body = JSON.stringify(payloadFor(page));
    // keepalive bodies are limited to 64 KiB by browsers.
    if (body.length < 60_000) void savePage(id, true);
    else allSent = false;
  }
  return allSent;
}

function scheduleDrafts() {
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(writeDrafts, 400);
}

function writeDrafts() {
  for (const id of Object.keys(get().dirty)) {
    const page = get().pages[id];
    if (!page) continue;
    try {
      localStorage.setItem(
        DRAFT_PREFIX + id,
        JSON.stringify({ revision: page.revision, savedAt: Date.now(), page: payloadFor(page) }),
      );
    } catch {
      // Storage full or unavailable: the server save is still the source of truth.
    }
  }
}

function clearDraft(pageId: string) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + pageId);
  } catch {}
}

/** Re-apply unsaved local drafts whose base revision still matches the server. */
function recoverDrafts(pages: PageState[]): PageState[] {
  let recovered = 0;
  const out = pages.map((p) => {
    try {
      const raw = localStorage.getItem(DRAFT_PREFIX + p.id);
      if (!raw) return p;
      const draft = JSON.parse(raw) as { revision: number; page: ReturnType<typeof payloadFor> };
      if (draft.revision !== p.revision) {
        clearDraft(p.id);
        return p;
      }
      recovered++;
      return {
        ...p,
        title: draft.page.title ?? p.title,
        background: draft.page.background ?? p.background,
        orientation: draft.page.orientation ?? p.orientation,
        posX: draft.page.posX ?? p.posX,
        posY: draft.page.posY ?? p.posY,
        scene: parseScene(draft.page.scene),
      };
    } catch {
      return p;
    }
  });
  if (recovered) {
    toast.info(`Recovered unsaved changes on ${recovered} page${recovered > 1 ? "s" : ""}`);
    for (const p of out) {
      const raw = (() => {
        try {
          return localStorage.getItem(DRAFT_PREFIX + p.id);
        } catch {
          return null;
        }
      })();
      if (raw) queueMicrotask(() => markDirty(p.id));
    }
  }
  return out;
}

// ------------------------------------------------------------ gestures

let gesture: { pageId: string; before: PageSnapshot } | null = null;
let editStart: { pageId: string; before: PageSnapshot } | null = null;

function syncTreePages() {
  const s = get();
  if (!s.project) return;
  const summaries: PageSummaryDTO[] = s.pageOrder
    .map((id) => s.pages[id])
    .filter(Boolean)
    .map((p) => ({
      id: p.id,
      projectId: s.project!.id,
      title: p.title,
      position: p.position,
      background: p.background,
      orientation: p.orientation,
      favoritedAt: p.favoritedAt,
      lastOpenedAt: p.lastOpenedAt,
      deletedAt: null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  useWorkspaceStore.getState().setProjectPages(s.project.id, summaries);
}

function reportError(action: string, err: unknown) {
  toast.error(`Couldn't ${action}`, { description: err instanceof Error ? err.message : String(err) });
}

// --------------------------------------------------------------- actions

export const editor = {
  async load(projectId: string, preferredPageId: string | null) {
    const s = get();
    if (s.project?.id === projectId && s.status === "ready") {
      if (preferredPageId && s.pages[preferredPageId]) editor.goToPage(preferredPageId);
      return;
    }
    // Persist anything pending from a previously open project first.
    await flushSaves();
    gesture = null;
    editStart = null;
    set({
      ...initialState,
      status: "loading",
      style: s.style,
      panels: s.panels,
      viewportSize: s.viewportSize,
    });
    try {
      const doc = await api.project(projectId);
      const pages = recoverDrafts(doc.pages.map(toPageState));
      const active =
        (preferredPageId && pages.find((p) => p.id === preferredPageId)?.id) ||
        [...pages].sort((a, b) => (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? ""))[0]?.id ||
        pages[0]?.id ||
        null;
      set({
        status: "ready",
        project: doc.project,
        breadcrumbs: doc.breadcrumbs,
        pageOrder: pages.map((p) => p.id),
        pages: Object.fromEntries(pages.map((p) => [p.id, p])),
        activePageId: active,
        viewMode: doc.project.viewMode,
      });
      // Bookkeeping for "Recent" — not user content, so fire-and-forget.
      void api.updateProject(projectId, { opened: true }).then((p) => useWorkspaceStore.getState().upsertProject(p)).catch(() => {});
      if (active) void api.updatePage(active, { opened: true }).catch(() => {});
      if (!pages.length) await editor.addPage();
    } catch (err) {
      set({ status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  },

  // ---------------------------------------------------------- viewport

  setViewportSize(w: number, h: number) {
    set({ viewportSize: { w, h } });
  },
  setViewport(v: Viewport) {
    set({ viewport: v });
  },
  zoomBy(factor: number, at?: Point) {
    const { viewport, viewportSize } = get();
    set({ viewport: zoomAt(viewport, factor, at?.x ?? viewportSize.w / 2, at?.y ?? viewportSize.h / 2) });
  },
  setZoom(zoom: number) {
    const { viewport, viewportSize } = get();
    editor.zoomBy(clampZoom(zoom) / viewport.zoom, { x: viewportSize.w / 2, y: viewportSize.h / 2 });
  },
  zoomToPage(pageId = get().activePageId, mode: "fit" | "width" = "fit") {
    if (!pageId) return;
    const box = getLayout().get(pageId);
    if (!box) return;
    const { w, h } = get().viewportSize;
    set({ viewport: mode === "fit" ? fitBox(box, w, h, 40) : fitPageWidth(box, w) });
  },
  fitWorkspace() {
    const boxes = [...getLayout().values()];
    if (!boxes.length) return;
    const minX = Math.min(...boxes.map((b) => b.x));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxX = Math.max(...boxes.map((b) => b.x + b.w));
    const maxY = Math.max(...boxes.map((b) => b.y + b.h));
    const { w, h } = get().viewportSize;
    set({ viewport: fitBox({ x: minX, y: minY, w: maxX - minX, h: maxY - minY }, w, h, 56, 1) });
  },
  /** Pan so the page is visible, keeping the current zoom when possible. */
  revealPage(pageId: string) {
    const box = getLayout().get(pageId);
    if (!box) return;
    const { viewport, viewportSize } = get();
    const z = viewport.zoom;
    set({
      viewport: {
        zoom: z,
        panX: box.w * z < viewportSize.w ? viewportSize.w / 2 - (box.x + box.w / 2) * z : viewport.panX,
        panY: 32 - box.y * z,
      },
    });
  },

  // ----------------------------------------------------------- tools

  setTool(tool: Tool) {
    editor.stopEditing();
    set((s) => ({
      tool,
      selection: tool === "select" ? s.selection : { pageId: s.selection.pageId, ids: [] },
    }));
  },
  toggleToolLock() {
    set((s) => ({ toolLocked: !s.toolLocked }));
  },
  setStyle(patch: Partial<StyleDefaults>) {
    set((s) => ({ style: { ...s.style, ...patch } }));
  },
  togglePanel(panel: "pages" | "properties") {
    set((s) => ({ panels: { ...s.panels, [panel]: !s.panels[panel] } }));
  },
  setErasing(ids: string[]) {
    set({ erasing: ids });
  },
  setMarquee(marquee: EditorState["marquee"]) {
    set({ marquee });
  },
  setBindTarget(id: string | null) {
    if (get().bindTarget !== id) set({ bindTarget: id });
  },
  /** Track the page under the viewport centre without touching "recent" bookkeeping. */
  setActivePageQuiet(pageId: string) {
    if (get().activePageId !== pageId) set({ activePageId: pageId });
  },

  // ------------------------------------------------------- selection

  setActivePage(pageId: string) {
    if (get().activePageId === pageId) return;
    set({ activePageId: pageId });
    void api.updatePage(pageId, { opened: true }).catch(() => {});
  },
  goToPage(pageId: string) {
    editor.stopEditing();
    editor.setActivePage(pageId);
    set((s) => ({ selection: { pageId, ids: s.selection.pageId === pageId ? s.selection.ids : [] } }));
    if (get().viewMode === "single") editor.zoomToPage(pageId, "width");
    else editor.revealPage(pageId);
  },
  select(pageId: string, ids: string[], opts: { additive?: boolean; expand?: boolean } = {}) {
    const s = get();
    const page = s.pages[pageId];
    if (!page) return;
    let next = opts.expand === false ? ids : expandGroups(page.scene.objects, ids);
    if (opts.additive && s.selection.pageId === pageId) {
      const cur = new Set(s.selection.ids);
      const allSelected = next.every((id) => cur.has(id));
      next.forEach((id) => (allSelected ? cur.delete(id) : cur.add(id)));
      next = [...cur];
    }
    if (s.editing && !next.includes(s.editing.id)) editor.stopEditing();
    set({ selection: { pageId, ids: next } });
    editor.setActivePage(pageId);
  },
  clearSelection() {
    editor.stopEditing();
    set((s) => ({ selection: { pageId: s.selection.pageId, ids: [] } }));
  },
  selectAll() {
    const pageId = get().activePageId;
    if (!pageId) return;
    editor.stopEditing();
    set({ tool: "select", selection: { pageId, ids: get().pages[pageId].scene.objects.map((o) => o.id) } });
  },

  // --------------------------------------------------------- mutation

  /**
   * Central scene mutation. `history: true` records an undo step; gestures
   * pass `false` and commit once at the end via `endGesture`.
   */
  mutate(
    pageId: string,
    recipe: (objects: SceneObject[]) => SceneObject[],
    opts: { history?: boolean; changed?: Set<string>; silent?: boolean } = {},
  ) {
    const page = get().pages[pageId];
    if (!page) return;
    const before = opts.history ? snapshot(pageId) : null;
    let objects = recipe(page.scene.objects);
    if (objects === page.scene.objects) return;
    if (objects.length < page.scene.objects.length) objects = pruneBindings(objects);
    objects = resolveConnectors(objects, opts.changed);
    set((s) => ({
      pages: { ...s.pages, [pageId]: { ...page, scene: { ...page.scene, objects } } },
    }));
    // Silent updates (e.g. measured text heights) ride along with the next real save.
    if (!opts.silent) markDirty(pageId);
    if (opts.history) pushHistory(pageId, before);
  },
  updateObjects(pageId: string, ids: string[], patch: (o: SceneObject) => SceneObject, history = true) {
    const idSet = new Set(ids);
    editor.mutate(pageId, (objs) => {
      let changed = false;
      const next = objs.map((o) => {
        if (!idSet.has(o.id)) return o;
        const n = patch(o);
        if (n !== o) changed = true;
        return n;
      });
      return changed ? next : objs;
    }, { history, changed: idSet });
  },
  /** Apply a patch to every selected object (property panel / toolbar). */
  updateSelected(patch: (o: SceneObject) => SceneObject) {
    const { pageId, ids } = get().selection;
    if (!pageId || !ids.length) return;
    editor.updateObjects(pageId, ids, patch, true);
  },
  addObjects(pageId: string, objs: SceneObject[], opts: { select?: boolean; history?: boolean } = {}) {
    editor.mutate(pageId, (o) => [...o, ...objs], { history: opts.history ?? true });
    if (opts.select !== false) {
      set({ selection: { pageId, ids: objs.map((o) => o.id) } });
      editor.setActivePage(pageId);
    }
  },
  beginGesture(pageId: string) {
    gesture = { pageId, before: snapshot(pageId)! };
  },
  endGesture() {
    if (!gesture) return;
    pushHistory(gesture.pageId, gesture.before);
    gesture = null;
  },
  cancelGesture() {
    if (!gesture) return;
    applySnapshot(gesture.pageId, gesture.before);
    gesture = null;
  },

  deleteSelection() {
    const { pageId, ids } = get().selection;
    if (!pageId || !ids.length) return;
    const del = new Set(ids);
    editor.stopEditing(false);
    editor.mutate(pageId, (objs) => objs.filter((o) => !del.has(o.id)), { history: true });
    set({ selection: { pageId, ids: [] } });
  },
  duplicateSelection(offset = 20) {
    const { pageId } = get().selection;
    const objs = selectedObjects();
    if (!pageId || !objs.length) return;
    const copies = cloneObjects(objs, offset, offset);
    editor.addObjects(pageId, copies);
  },
  reorderSelection(action: ZOrderAction) {
    const { pageId, ids } = get().selection;
    if (!pageId || !ids.length) return;
    const idSet = new Set(ids);
    editor.mutate(pageId, (objs) => {
      const next = reorderObjects(objs, idSet, action);
      return sameObjects(next, objs) ? objs : next;
    }, { history: true });
  },
  groupSelection() {
    const { pageId, ids } = get().selection;
    if (!pageId || ids.length < 2) return;
    const groupId = newId();
    editor.updateObjects(pageId, ids, (o) => ({ ...o, groupId }));
  },
  ungroupSelection() {
    const { pageId, ids } = get().selection;
    if (!pageId || !ids.length) return;
    editor.updateObjects(pageId, ids, (o) => (o.groupId ? { ...o, groupId: null } : o));
  },
  nudgeSelection(dx: number, dy: number) {
    const { pageId, ids } = get().selection;
    if (!pageId || !ids.length) return;
    editor.updateObjects(pageId, ids, (o) => (o.locked ? o : { ...o, x: o.x + dx, y: o.y + dy }));
  },
  alignSelection(edge: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") {
    const { pageId, ids } = get().selection;
    const objs = selectedObjects();
    if (!pageId || objs.length < 2) return;
    const b = selectionBounds(objs)!;
    editor.updateObjects(pageId, ids, (o) => {
      if (isLinear(o)) return o;
      switch (edge) {
        case "left": return { ...o, x: b.x };
        case "right": return { ...o, x: b.x + b.w - o.w };
        case "hcenter": return { ...o, x: b.x + b.w / 2 - o.w / 2 };
        case "top": return { ...o, y: b.y };
        case "bottom": return { ...o, y: b.y + b.h - o.h };
        case "vcenter": return { ...o, y: b.y + b.h / 2 - o.h / 2 };
      }
    });
  },
  /** Insert objects (e.g. from the clipboard) centred at a point on a page. */
  pasteObjects(pageId: string, objs: SceneObject[], at?: Point) {
    if (!objs.length) return;
    const b = selectionBounds(objs)!;
    const page = get().pages[pageId];
    const target = at ?? (page ? { x: pageSize(page.orientation).w / 2, y: Math.min(b.y + b.h / 2 + 24, pageSize(page.orientation).h / 2) } : center(b));
    const dx = at ? target.x - (b.x + b.w / 2) : 24;
    const dy = at ? target.y - (b.y + b.h / 2) : 24;
    editor.addObjects(pageId, cloneObjects(objs, dx, dy));
  },

  // ---------------------------------------------------------- editing

  startEditing(id: string, kind: "text" | "label", before?: PageSnapshot, caret?: Point) {
    const pageId = get().selection.pageId ?? get().activePageId;
    if (!pageId) return;
    const current = get().editing;
    if (current?.id === id) return;
    if (current) editor.stopEditing();
    editStart = { pageId, before: before ?? snapshot(pageId)! };
    set({ editing: { id, kind, caret }, selection: { pageId, ids: [id] }, tool: get().toolLocked ? get().tool : "select" });
  },
  /** Create an object and immediately edit it; one undo step covers both. */
  createAndEdit(pageId: string, obj: SceneObject, kind: "text" | "label" = "text") {
    editor.stopEditing();
    const before = snapshot(pageId)!;
    editor.mutate(pageId, (o) => [...o, obj]);
    set({ selection: { pageId, ids: [obj.id] } });
    editor.setActivePage(pageId);
    editor.startEditing(obj.id, kind, before);
  },
  stopEditing(removeEmpty = true) {
    const ed = get().editing;
    if (!ed) return;
    const start = editStart;
    editStart = null;
    if (start) {
      const page = get().pages[start.pageId];
      const obj = page?.scene.objects.find((o) => o.id === ed.id);
      if (removeEmpty && obj?.type === "text" && isEmptyHtml(obj.html)) {
        editor.mutate(start.pageId, (objs) => objs.filter((o) => o.id !== ed.id));
        set((s) => ({ selection: { ...s.selection, ids: s.selection.ids.filter((i) => i !== ed.id) } }));
      }
      pushHistory(start.pageId, start.before);
    }
    set({ editing: null, textEditor: null });
  },
  setTextEditor(instance: TiptapEditor | null) {
    set({ textEditor: instance });
  },

  // ----------------------------------------------------------- history

  undo() {
    editor.stopEditing();
    const entry = get().past.at(-1);
    if (!entry) return;
    set((s) => ({ past: s.past.slice(0, -1), future: [entry, ...s.future] }));
    if (!get().pages[entry.pageId]) return;
    applySnapshot(entry.pageId, entry.before);
    editor.afterHistory(entry.pageId);
  },
  redo() {
    editor.stopEditing();
    const entry = get().future[0];
    if (!entry) return;
    set((s) => ({ future: s.future.slice(1), past: [...s.past, entry] }));
    if (!get().pages[entry.pageId]) return;
    applySnapshot(entry.pageId, entry.after);
    editor.afterHistory(entry.pageId);
  },
  afterHistory(pageId: string) {
    const page = get().pages[pageId];
    const alive = new Set(page.scene.objects.map((o) => o.id));
    set((s) => ({
      activePageId: pageId,
      selection: s.selection.pageId === pageId ? { pageId, ids: s.selection.ids.filter((id) => alive.has(id)) } : { pageId, ids: [] },
    }));
    syncTreePages();
  },

  // ------------------------------------------------------------- pages

  setPageProps(pageId: string, patch: Partial<Pick<PageState, "title" | "background" | "orientation">>) {
    const page = get().pages[pageId];
    if (!page) return;
    const before = snapshot(pageId);
    set((s) => ({ pages: { ...s.pages, [pageId]: { ...page, ...patch } } }));
    markDirty(pageId);
    pushHistory(pageId, before);
    if (patch.title !== undefined) syncTreePages();
  },
  setPagePosition(pageId: string, x: number, y: number) {
    const page = get().pages[pageId];
    if (!page) return;
    set((s) => ({ pages: { ...s.pages, [pageId]: { ...page, posX: Math.round(x), posY: Math.round(y) } } }));
    markDirty(pageId);
  },
  async setViewMode(mode: ProjectViewMode) {
    const s = get();
    if (!s.project || s.viewMode === mode) return;
    if (mode === "free") {
      // Pin pages without a free position where they currently sit.
      const layout = computeLayout(s.pageOrder.map((id) => s.pages[id]), "stack", s.activePageId);
      for (const id of s.pageOrder) {
        const p = get().pages[id];
        const box = layout.get(id);
        if (box && (p.posX === null || p.posY === null)) editor.setPagePosition(id, box.x, box.y);
      }
    }
    set({ viewMode: mode });
    if (mode === "single") editor.zoomToPage(s.activePageId, "width");
    else if (s.activePageId) editor.revealPage(s.activePageId);
    try {
      const p = await api.updateProject(s.project.id, { viewMode: mode });
      useWorkspaceStore.getState().upsertProject(p);
    } catch (err) {
      reportError("change the view", err);
    }
  },
  async addPage(opts: { afterPageId?: string | null; background?: PageBackground; orientation?: Orientation } = {}) {
    const s = get();
    if (!s.project) return null;
    const after = opts.afterPageId === undefined ? (s.pageOrder.at(-1) ?? null) : opts.afterPageId;
    try {
      const page = await api.createPage(s.project.id, {
        afterPageId: after,
        background: opts.background ?? (after ? s.pages[after]?.background : undefined),
        orientation: opts.orientation,
      });
      editor.insertPage(page, after);
      editor.goToPage(page.id);
      return page.id;
    } catch (err) {
      reportError("add a page", err);
      return null;
    }
  },
  insertPage(page: PageDTO, afterId: string | null) {
    set((s) => {
      if (s.pages[page.id]) return s;
      const order = [...s.pageOrder];
      const idx = afterId ? order.indexOf(afterId) : -1;
      order.splice(idx === -1 ? order.length : idx + 1, 0, page.id);
      return { pageOrder: order, pages: { ...s.pages, [page.id]: toPageState(page) } };
    });
    syncTreePages();
  },
  async duplicatePage(pageId: string) {
    const s = get();
    if (!s.project) return;
    // The server copies the persisted scene, so persist first.
    if (get().dirty[pageId] && !(await savePage(pageId))) return reportError("duplicate the page", "Save failed");
    try {
      const page = await api.createPage(s.project.id, { duplicateOf: pageId });
      editor.insertPage(page, pageId);
      editor.goToPage(page.id);
    } catch (err) {
      reportError("duplicate the page", err);
    }
  },
  async deletePage(pageId: string) {
    const s = get();
    if (s.pageOrder.length <= 1) {
      toast("A project keeps at least one page", { description: "Add another page before deleting this one." });
      return;
    }
    const idx = s.pageOrder.indexOf(pageId);
    const title = s.pages[pageId]?.title ?? "Page";
    if (get().dirty[pageId]) await savePage(pageId);
    try {
      await api.deletePage(pageId);
    } catch (err) {
      return reportError("delete the page", err);
    }
    if (get().editing) editor.stopEditing();
    set((st) => {
      const { [pageId]: removed, ...pages } = st.pages;
      void removed;
      const order = st.pageOrder.filter((id) => id !== pageId);
      const nextActive = st.activePageId === pageId ? (order[Math.min(idx, order.length - 1)] ?? null) : st.activePageId;
      return {
        pages,
        pageOrder: order,
        activePageId: nextActive,
        selection: st.selection.pageId === pageId ? { pageId: nextActive, ids: [] } : st.selection,
        past: st.past.filter((e) => e.pageId !== pageId),
        future: st.future.filter((e) => e.pageId !== pageId),
      };
    });
    syncTreePages();
    toast(`Deleted “${title}”`, {
      description: "Restore it now or later from Trash.",
      action: { label: "Undo", onClick: () => void editor.restorePage(pageId, idx) },
    });
  },
  async restorePage(pageId: string, index: number) {
    try {
      await api.updatePage(pageId, { restore: true });
      const page = await api.page(pageId);
      const order = get().pageOrder;
      editor.insertPage(page, index > 0 ? (order[index - 1] ?? order.at(-1) ?? null) : null);
      if (index === 0) {
        // insertPage(null) appends; move to the front explicitly.
        set((s) => ({ pageOrder: [page.id, ...s.pageOrder.filter((id) => id !== page.id)] }));
        await editor.persistOrder();
      }
      editor.goToPage(pageId);
    } catch (err) {
      reportError("restore the page", err);
    }
  },
  async reorderPages(order: string[]) {
    const prev = get().pageOrder;
    set((s) => ({
      pageOrder: order,
      pages: Object.fromEntries(Object.entries(s.pages).map(([id, p]) => [id, { ...p, position: order.indexOf(id) + 1 }])),
    }));
    syncTreePages();
    try {
      await api.reorder("page", order);
    } catch (err) {
      set({ pageOrder: prev });
      syncTreePages();
      reportError("reorder pages", err);
    }
  },
  async persistOrder() {
    await editor.reorderPages(get().pageOrder);
  },
  async renameProject(name: string) {
    const p = get().project;
    const trimmed = name.trim();
    if (!p || !trimmed || trimmed === p.name) return;
    try {
      const updated = await api.updateProject(p.id, { name: trimmed });
      set({ project: { ...p, name: updated.name } });
      useWorkspaceStore.getState().upsertProject(updated);
    } catch (err) {
      reportError("rename the project", err);
    }
  },
  async toggleProjectFavorite() {
    const p = get().project;
    if (!p) return;
    try {
      const updated = await api.updateProject(p.id, { favorite: !p.favoritedAt });
      set({ project: { ...p, favoritedAt: updated.favoritedAt } });
      useWorkspaceStore.getState().upsertProject(updated);
    } catch (err) {
      reportError("update favorites", err);
    }
  },
  async togglePageFavorite(pageId: string) {
    const page = get().pages[pageId];
    if (!page) return;
    try {
      const res = await api.updatePage(pageId, { favorite: !page.favoritedAt });
      set((s) => ({ pages: { ...s.pages, [pageId]: { ...s.pages[pageId], favoritedAt: res.favoritedAt } } }));
      syncTreePages();
    } catch (err) {
      reportError("update favorites", err);
    }
  },
};

export function isEmptyHtml(html: string) {
  return !html.replace(/<[^>]+>/g, "").replace(/&nbsp;|\s/g, "").length && !/<(hr|img)/i.test(html);
}

/** Selected objects, re-rendering only when one of them changes. */
export function useSelectedObjects(): SceneObject[] {
  return useEditorStore(useShallow((s) => selectedObjects(s)));
}

export type { EditorState, PageSnapshot };
