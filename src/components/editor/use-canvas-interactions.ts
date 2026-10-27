"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  absolutePoints,
  boxesIntersect,
  center,
  hitTest,
  isBindable,
  isLinear,
  normalizeBox,
  objectBounds,
  rotatePoint,
  withAbsolutePoints,
  type Box,
  type Point,
} from "@/lib/editor/geometry";
import {
  cloneObjects,
  createDraw,
  createLinear,
  createShape,
  createText,
  rotateObjectAround,
  scaleObject,
  selectionBounds,
  normalizeAngle,
} from "@/lib/editor/objects";
import type { DrawObject, LinearObject, SceneObject } from "@/lib/editor/scene";
import { insertImages, isSupportedImage } from "@/lib/editor/images";
import { editor, getLayout, useEditorStore } from "@/stores/editor-store";
import type { HandleKind } from "@/components/editor/selection-overlay";

type Gesture =
  | { kind: "pan"; sx: number; sy: number; panX: number; panY: number }
  | {
      kind: "move";
      pageId: string;
      start: Point;
      originals: SceneObject[];
      moved: boolean;
      clickedId: string;
      wasSelected: boolean;
      client: Point;
    }
  | { kind: "marquee"; pageId: string; start: Point; additive: boolean; base: string[] }
  | { kind: "resize"; pageId: string; handle: HandleKind; originals: SceneObject[]; bounds: Box }
  | { kind: "rotate"; pageId: string; pivot: Point; startAngle: number; originals: SceneObject[] }
  | { kind: "endpoint"; pageId: string; which: "start" | "end"; original: LinearObject }
  | { kind: "shape"; pageId: string; id: string; start: Point; type: "rect" | "ellipse" | "diamond" }
  | { kind: "linear"; pageId: string; id: string; start: Point }
  | { kind: "draw"; pageId: string; id: string; samples: [number, number, number][]; highlighter: boolean }
  | { kind: "erase"; pageId: string; hits: Set<string> }
  | { kind: "page"; pageId: string; start: Point; origin: Point };

const MIN_SIZE = 8;
const DRAG_THRESHOLD = 3;

const state = () => useEditorStore.getState();

function snapAngle(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const step = Math.PI / 12;
  const a = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: from.x + Math.cos(a) * len, y: from.y + Math.sin(a) * len };
}

function objectsOf(pageId: string) {
  return state().pages[pageId]?.scene.objects ?? [];
}

function findBindable(pageId: string, p: Point, excludeId: string | null): string | null {
  const objs = objectsOf(pageId);
  const zoom = state().viewport.zoom;
  for (let i = objs.length - 1; i >= 0; i--) {
    const o = objs[i];
    if (o.id !== excludeId && isBindable(o) && hitTest(o, p, 2 / zoom)) return o.id;
  }
  return null;
}

/**
 * Pointer/wheel/drop handling for the canvas. All geometry is converted to
 * page coordinates before touching the scene.
 */
export function useCanvasInteractions(containerRef: React.RefObject<HTMLDivElement | null>) {
  const gestureRef = useRef<Gesture | null>(null);
  /** Aborts the window listeners of the active gesture. */
  const listenersRef = useRef<AbortController | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [panning, setPanning] = useState(false);
  const spaceRef = useRef(false);

  const toWorld = useCallback(
    (clientX: number, clientY: number): Point => {
      const rect = containerRef.current!.getBoundingClientRect();
      const { zoom, panX, panY } = state().viewport;
      return { x: (clientX - rect.left - panX) / zoom, y: (clientY - rect.top - panY) / zoom };
    },
    [containerRef],
  );

  const toPage = useCallback(
    (pageId: string, clientX: number, clientY: number): Point => {
      const w = toWorld(clientX, clientY);
      const box = getLayout().get(pageId);
      return box ? { x: w.x - box.x, y: w.y - box.y } : w;
    },
    [toWorld],
  );

  const pageAt = useCallback(
    (clientX: number, clientY: number, margin = 0): string | null => {
      const w = toWorld(clientX, clientY);
      for (const [id, b] of getLayout()) {
        if (w.x >= b.x - margin && w.x <= b.x + b.w + margin && w.y >= b.y - margin && w.y <= b.y + b.h + margin) return id;
      }
      return null;
    },
    [toWorld],
  );

  // ------------------------------------------------------------- pointer move

  const onMove = useCallback(
    (e: PointerEvent) => {
      const g = gestureRef.current;
      if (!g) return;
      const s = state();
      switch (g.kind) {
        case "pan": {
          editor.setViewport({ ...s.viewport, panX: g.panX + e.clientX - g.sx, panY: g.panY + e.clientY - g.sy });
          return;
        }
        case "page": {
          const w = toWorld(e.clientX, e.clientY);
          editor.setPagePosition(g.pageId, g.origin.x + w.x - g.start.x, g.origin.y + w.y - g.start.y);
          return;
        }
        case "move": {
          if (!g.moved && Math.hypot(e.clientX - g.client.x, e.clientY - g.client.y) < DRAG_THRESHOLD) return;
          if (!g.moved) {
            g.moved = true;
            editor.beginGesture(g.pageId);
            if (e.altKey) {
              // Alt-drag duplicates the selection and drags the copies.
              const copies = cloneObjects(g.originals, 0, 0);
              editor.mutate(g.pageId, (objs) => [...objs, ...copies]);
              editor.select(g.pageId, copies.map((c) => c.id), { expand: false });
              g.originals = copies;
            }
          }
          const p = toPage(g.pageId, e.clientX, e.clientY);
          let dx = p.x - g.start.x;
          let dy = p.y - g.start.y;
          if (e.shiftKey) {
            if (Math.abs(dx) > Math.abs(dy)) dy = 0;
            else dx = 0;
          }
          const moving = new Set(g.originals.map((o) => o.id));
          const byId = new Map(g.originals.map((o) => [o.id, o]));
          editor.mutate(
            g.pageId,
            (objs) =>
              objs.map((o) => {
                const orig = byId.get(o.id);
                if (!orig || orig.locked) return o;
                const moved = { ...orig, x: orig.x + dx, y: orig.y + dy };
                if (isLinear(moved)) {
                  // A connector dragged without its shapes detaches from them.
                  if (moved.startBinding && !moving.has(moved.startBinding.objectId)) moved.startBinding = null;
                  if (moved.endBinding && !moving.has(moved.endBinding.objectId)) moved.endBinding = null;
                }
                return moved;
              }),
            { changed: moving },
          );
          return;
        }
        case "marquee": {
          const p = toPage(g.pageId, e.clientX, e.clientY);
          const box = normalizeBox(g.start, p);
          editor.setMarquee({ pageId: g.pageId, box });
          const hits = objectsOf(g.pageId)
            .filter((o) => boxesIntersect(objectBounds(o), box))
            .map((o) => o.id);
          const ids = g.additive ? [...new Set([...g.base, ...hits])] : hits;
          editor.select(g.pageId, ids);
          return;
        }
        case "resize": {
          const p = toPage(g.pageId, e.clientX, e.clientY);
          applyResize(g, p, e.shiftKey);
          return;
        }
        case "rotate": {
          const p = toPage(g.pageId, e.clientX, e.clientY);
          let delta = (Math.atan2(p.y - g.pivot.y, p.x - g.pivot.x) - g.startAngle) * (180 / Math.PI);
          const single = g.originals.length === 1 ? g.originals[0] : null;
          if (e.shiftKey) {
            if (single) delta = Math.round((single.rotation + delta) / 15) * 15 - single.rotation;
            else delta = Math.round(delta / 15) * 15;
          }
          const byId = new Map(g.originals.map((o) => [o.id, o]));
          editor.mutate(
            g.pageId,
            (objs) =>
              objs.map((o) => {
                const orig = byId.get(o.id);
                if (!orig) return o;
                return single && !isLinear(orig)
                  ? { ...orig, rotation: normalizeAngle(orig.rotation + delta) }
                  : rotateObjectAround(orig, g.pivot, delta);
              }),
            { changed: new Set(byId.keys()) },
          );
          return;
        }
        case "endpoint": {
          let p = toPage(g.pageId, e.clientX, e.clientY);
          const pts = absolutePoints(g.original);
          const idx = g.which === "start" ? 0 : pts.length - 1;
          const other = g.which === "start" ? pts[pts.length - 1] : pts[0];
          if (e.shiftKey) p = snapAngle(other, p);
          const target = findBindable(g.pageId, p, g.original.id);
          editor.setBindTarget(target);
          pts[idx] = p;
          const next = withAbsolutePoints(
            {
              ...g.original,
              [g.which === "start" ? "startBinding" : "endBinding"]: target ? { objectId: target } : null,
            },
            pts,
          );
          editor.mutate(g.pageId, (objs) => objs.map((o) => (o.id === next.id ? next : o)), { changed: new Set([next.id]) });
          return;
        }
        case "shape": {
          let p = toPage(g.pageId, e.clientX, e.clientY);
          if (e.shiftKey) {
            const size = Math.max(Math.abs(p.x - g.start.x), Math.abs(p.y - g.start.y));
            p = { x: g.start.x + Math.sign(p.x - g.start.x || 1) * size, y: g.start.y + Math.sign(p.y - g.start.y || 1) * size };
          }
          const box = e.altKey
            ? { x: g.start.x - Math.abs(p.x - g.start.x), y: g.start.y - Math.abs(p.y - g.start.y), w: Math.abs(p.x - g.start.x) * 2, h: Math.abs(p.y - g.start.y) * 2 }
            : normalizeBox(g.start, p);
          editor.updateObjects(g.pageId, [g.id], (o) => ({ ...o, ...box }), false);
          return;
        }
        case "linear": {
          let p = toPage(g.pageId, e.clientX, e.clientY);
          if (e.shiftKey) p = snapAngle(g.start, p);
          const target = findBindable(g.pageId, p, g.id);
          editor.setBindTarget(target);
          editor.updateObjects(
            g.pageId,
            [g.id],
            (o) => {
              const lin = o as LinearObject;
              const start = absolutePoints(lin)[0];
              return withAbsolutePoints({ ...lin, endBinding: target ? { objectId: target } : null }, [
                lin.startBinding ? start : g.start,
                p,
              ]);
            },
            false,
          );
          return;
        }
        case "draw": {
          const events = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [e];
          for (const ev of events.length ? events : [e]) {
            const p = toPage(g.pageId, ev.clientX, ev.clientY);
            g.samples.push([p.x, p.y, ev.pointerType === "pen" ? ev.pressure || 0.5 : 0.5]);
          }
          const next = { ...createDraw(g.samples, s.style, g.highlighter), id: g.id };
          editor.mutate(g.pageId, (objs) => objs.map((o) => (o.id === g.id ? next : o)), { changed: new Set() });
          return;
        }
        case "erase": {
          const p = toPage(g.pageId, e.clientX, e.clientY);
          const tol = 6 / s.viewport.zoom;
          let added = false;
          for (const o of objectsOf(g.pageId)) {
            if (!g.hits.has(o.id) && !o.locked && hitTest(o, p, tol)) {
              g.hits.add(o.id);
              added = true;
            }
          }
          if (added) editor.setErasing([...g.hits]);
          return;
        }
      }
    },
    [toPage, toWorld],
  );

  // --------------------------------------------------------------- pointer up

  const onUp = useCallback(
    (e: PointerEvent) => {
      const g = gestureRef.current;
      gestureRef.current = null;
      listenersRef.current?.abort();
      listenersRef.current = null;
      setPanning(false);
      if (!g) return;
      const s = state();
      switch (g.kind) {
        case "move": {
          if (g.moved) editor.endGesture();
          else if (g.wasSelected && !e.shiftKey) {
            // Click on an already-selected object: text enters editing at the
            // click point; otherwise narrow a multi-selection to the object.
            const o = objectsOf(g.pageId).find((x) => x.id === g.clickedId);
            if (o?.type === "text" && !o.locked && s.selection.ids.length === 1) {
              editor.startEditing(o.id, "text", undefined, { x: e.clientX, y: e.clientY });
            } else if (s.selection.ids.length > 1 && !o?.groupId) {
              editor.select(g.pageId, [g.clickedId]);
            }
          }
          return;
        }
        case "marquee":
          editor.setMarquee(null);
          return;
        case "page":
          return;
        case "resize":
        case "rotate":
          editor.endGesture();
          return;
        case "endpoint":
          editor.setBindTarget(null);
          editor.endGesture();
          return;
        case "shape": {
          const o = objectsOf(g.pageId).find((x) => x.id === g.id);
          if (o && o.w < MIN_SIZE && o.h < MIN_SIZE) {
            // A click places a default-sized shape centred on the pointer.
            const w = g.type === "ellipse" ? 120 : 150;
            const h = g.type === "rect" ? 90 : 100;
            editor.updateObjects(g.pageId, [g.id], (x) => ({ ...x, x: g.start.x - w / 2, y: g.start.y - h / 2, w, h }), false);
          } else if (o) {
            editor.updateObjects(g.pageId, [g.id], (x) => ({ ...x, w: Math.max(x.w, 2), h: Math.max(x.h, 2) }), false);
          }
          editor.endGesture();
          editor.select(g.pageId, [g.id]);
          if (!s.toolLocked) useEditorStore.setState({ tool: "select" });
          return;
        }
        case "linear": {
          editor.setBindTarget(null);
          const o = objectsOf(g.pageId).find((x) => x.id === g.id) as LinearObject | undefined;
          if (o) {
            const pts = absolutePoints(o);
            if (Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) < MIN_SIZE) {
              const next = withAbsolutePoints({ ...o, endBinding: null }, [g.start, { x: g.start.x + 140, y: g.start.y }]);
              editor.mutate(g.pageId, (objs) => objs.map((x) => (x.id === g.id ? next : x)));
            }
          }
          editor.endGesture();
          editor.select(g.pageId, [g.id]);
          if (!s.toolLocked) useEditorStore.setState({ tool: "select" });
          return;
        }
        case "draw":
          editor.endGesture();
          return;
        case "erase": {
          editor.setErasing([]);
          if (g.hits.size) editor.mutate(g.pageId, (objs) => objs.filter((o) => !g.hits.has(o.id)), { history: true });
          return;
        }
      }
    },
    [],
  );

  const startGesture = useCallback(
    (g: Gesture, e: React.PointerEvent) => {
      gestureRef.current = g;
      if (g.kind === "pan") setPanning(true);
      listenersRef.current?.abort();
      const ac = new AbortController();
      listenersRef.current = ac;
      window.addEventListener("pointermove", onMove, { signal: ac.signal });
      window.addEventListener("pointerup", onUp, { signal: ac.signal });
      window.addEventListener("pointercancel", onUp, { signal: ac.signal });
      e.preventDefault();
    },
    [onMove, onUp],
  );

  // --------------------------------------------------------------- pointer down

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-ui]")) return;
      const s = state();
      const { viewport } = s;

      if (e.button === 1 || (e.button === 0 && (spaceRef.current || s.tool === "hand"))) {
        startGesture({ kind: "pan", sx: e.clientX, sy: e.clientY, panX: viewport.panX, panY: viewport.panY }, e);
        return;
      }
      if (e.button !== 0) {
        // Right-click selects the object under the pointer for the context menu.
        if (e.button === 2) {
          const objEl = target.closest<HTMLElement>("[data-object-id]");
          const pageEl = target.closest<HTMLElement>("[data-page-id]");
          if (objEl && pageEl) {
            const id = objEl.dataset.objectId!;
            if (!s.selection.ids.includes(id)) editor.select(pageEl.dataset.pageId!, [id]);
          }
        }
        return;
      }
      if (target.closest("[data-editing]")) return;

      // Page title strip: activate, or drag the page in free mode.
      const titleEl = target.closest<HTMLElement>("[data-page-title]");
      if (titleEl) {
        const pageId = titleEl.dataset.pageTitle!;
        editor.goToPage(pageId);
        if (s.viewMode === "free") {
          const box = getLayout().get(pageId)!;
          startGesture({ kind: "page", pageId, start: toWorld(e.clientX, e.clientY), origin: { x: box.x, y: box.y } }, e);
        }
        return;
      }

      const handleEl = target.closest<HTMLElement>("[data-handle]");
      if (handleEl) {
        const pageId = handleEl.dataset.pageId!;
        const handle = handleEl.dataset.handle as HandleKind;
        const selected = objectsOf(pageId).filter((o) => s.selection.ids.includes(o.id) && !o.locked);
        if (!selected.length) return;
        editor.stopEditing();
        editor.beginGesture(pageId);
        if (handle === "start" || handle === "end") {
          startGesture({ kind: "endpoint", pageId, which: handle, original: selected[0] as LinearObject }, e);
        } else if (handle === "rotate") {
          const pivot = selected.length === 1 ? center(selected[0]) : center(selectionBounds(selected)!);
          const p = toPage(pageId, e.clientX, e.clientY);
          startGesture({ kind: "rotate", pageId, pivot, startAngle: Math.atan2(p.y - pivot.y, p.x - pivot.x), originals: selected }, e);
        } else {
          startGesture({ kind: "resize", pageId, handle, originals: selected, bounds: selectionBounds(selected)! }, e);
        }
        return;
      }

      const pageId = pageAt(e.clientX, e.clientY);
      if (s.editing) editor.stopEditing();

      if (!pageId) {
        // Empty desk: click clears, drag pans.
        if (s.tool === "select" && !e.shiftKey) editor.clearSelection();
        startGesture({ kind: "pan", sx: e.clientX, sy: e.clientY, panX: viewport.panX, panY: viewport.panY }, e);
        return;
      }
      editor.setActivePage(pageId);
      const p = toPage(pageId, e.clientX, e.clientY);
      const objEl = target.closest<HTMLElement>("[data-object-id]");
      const hitId = objEl && objEl.closest(`[data-page-id="${CSS.escape(pageId)}"]`) ? objEl.dataset.objectId! : null;
      const hitObj = hitId ? objectsOf(pageId).find((o) => o.id === hitId) : undefined;

      switch (s.tool) {
        case "select": {
          if (hitObj) {
            const wasSelected = s.selection.pageId === pageId && s.selection.ids.includes(hitObj.id);
            if (e.shiftKey) {
              editor.select(pageId, [hitObj.id], { additive: true });
              return;
            }
            if (!wasSelected) editor.select(pageId, [hitObj.id]);
            const ids = useEditorStore.getState().selection.ids;
            const originals = objectsOf(pageId).filter((o) => ids.includes(o.id));
            startGesture(
              { kind: "move", pageId, start: p, originals, moved: false, clickedId: hitObj.id, wasSelected, client: { x: e.clientX, y: e.clientY } },
              e,
            );
            return;
          }
          if (!e.shiftKey) editor.select(pageId, []);
          startGesture({ kind: "marquee", pageId, start: p, additive: e.shiftKey, base: s.selection.pageId === pageId ? s.selection.ids : [] }, e);
          return;
        }
        case "text": {
          if (hitObj?.type === "text") {
            editor.select(pageId, [hitObj.id]);
            editor.startEditing(hitObj.id, "text", undefined, { x: e.clientX, y: e.clientY });
          } else {
            const t = createText(p.x - 4, p.y - s.style.fontSize * 0.75, s.style);
            editor.createAndEdit(pageId, t);
          }
          e.preventDefault();
          return;
        }
        case "rect":
        case "ellipse":
        case "diamond": {
          editor.beginGesture(pageId);
          const shape = createShape(s.tool, { x: p.x, y: p.y, w: 0, h: 0 }, s.style);
          editor.mutate(pageId, (objs) => [...objs, shape]);
          editor.select(pageId, [shape.id]);
          startGesture({ kind: "shape", pageId, id: shape.id, start: p, type: s.tool }, e);
          return;
        }
        case "arrow":
        case "line": {
          editor.beginGesture(pageId);
          const startTarget = findBindable(pageId, p, null);
          const lin = { ...createLinear(s.tool, p, p, s.style), startBinding: startTarget ? { objectId: startTarget } : null };
          editor.mutate(pageId, (objs) => [...objs, lin]);
          editor.select(pageId, [lin.id]);
          startGesture({ kind: "linear", pageId, id: lin.id, start: p }, e);
          return;
        }
        case "pen":
        case "highlighter": {
          editor.beginGesture(pageId);
          editor.select(pageId, []);
          const samples: [number, number, number][] = [[p.x, p.y, e.pointerType === "pen" ? e.pressure || 0.5 : 0.5]];
          const d: DrawObject = createDraw(samples, s.style, s.tool === "highlighter");
          editor.mutate(pageId, (objs) => [...objs, d]);
          startGesture({ kind: "draw", pageId, id: d.id, samples, highlighter: s.tool === "highlighter" }, e);
          return;
        }
        case "eraser": {
          const hits = new Set<string>();
          const tol = 6 / viewport.zoom;
          for (const o of objectsOf(pageId)) if (!o.locked && hitTest(o, p, tol)) hits.add(o.id);
          editor.setErasing([...hits]);
          startGesture({ kind: "erase", pageId, hits }, e);
          return;
        }
      }
    },
    [pageAt, startGesture, toPage, toWorld],
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-ui]") || target.closest("[data-editing]")) return;
      const s = state();
      if (s.tool !== "select") return;
      const pageId = pageAt(e.clientX, e.clientY);
      if (!pageId) return;
      const objEl = target.closest<HTMLElement>("[data-object-id]");
      const o = objEl ? objectsOf(pageId).find((x) => x.id === objEl.dataset.objectId) : undefined;
      if (o?.locked) return;
      if (o?.type === "text") {
        editor.select(pageId, [o.id], { expand: false });
        editor.startEditing(o.id, "text", undefined, { x: e.clientX, y: e.clientY });
      } else if (o && (o.type === "rect" || o.type === "ellipse" || o.type === "diamond")) {
        editor.select(pageId, [o.id], { expand: false });
        editor.startEditing(o.id, "label");
      } else if (!o) {
        const p = toPage(pageId, e.clientX, e.clientY);
        editor.createAndEdit(pageId, createText(p.x - 4, p.y - s.style.fontSize * 0.75, s.style));
      }
    },
    [pageAt, toPage],
  );

  // -------------------------------------------------------------- wheel / keys

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest("[data-ui]")) return;
      e.preventDefault();
      const { viewport } = state();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const scale = Math.abs(e.deltaY) < 40 ? 0.012 : 0.0022;
        editor.zoomBy(Math.exp(-e.deltaY * scale), { x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else {
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        editor.setViewport({ ...viewport, panX: viewport.panX - dx, panY: viewport.panY - dy });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [containerRef]);

  useEffect(() => {
    const typing = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !typing(e.target) && !e.repeat) {
        spaceRef.current = true;
        setSpaceDown(true);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceRef.current = false;
        setSpaceDown(false);
      }
    };
    const blur = () => {
      spaceRef.current = false;
      setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      listenersRef.current?.abort();
    };
  }, []);

  // ----------------------------------------------------------------- drop

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const files = Array.from(e.dataTransfer.files);
      if (!files.length) return;
      e.preventDefault();
      const pageId = pageAt(e.clientX, e.clientY, 0) ?? state().activePageId;
      if (!pageId) return;
      const images = files.filter(isSupportedImage);
      if (!images.length) {
        void insertImages(files, pageId);
        return;
      }
      void insertImages(files, pageId, toPage(pageId, e.clientX, e.clientY));
    },
    [pageAt, toPage],
  );

  return { onPointerDown, onDoubleClick, onDragOver, onDrop, spaceDown, panning, toWorld, toPage };
}

// ------------------------------------------------------------------ resize

function applyResize(g: Extract<Gesture, { kind: "resize" }>, p: Point, shift: boolean) {
  const sx = g.handle.includes("e") ? 1 : g.handle.includes("w") ? -1 : 0;
  const sy = g.handle.includes("s") ? 1 : g.handle.includes("n") ? -1 : 0;
  const corner = sx !== 0 && sy !== 0;

  if (g.originals.length === 1 && !isLinear(g.originals[0])) {
    const o = g.originals[0];
    const c = center(o);
    const anchorLocal = { x: c.x - (sx * o.w) / 2, y: c.y - (sy * o.h) / 2 };
    const anchor = rotatePoint(anchorLocal, c, o.rotation);
    const v = rotatePoint({ x: p.x - anchor.x, y: p.y - anchor.y }, { x: 0, y: 0 }, -o.rotation);
    let w = sx ? Math.max(MIN_SIZE, sx * v.x) : o.w;
    let h = sy ? Math.max(MIN_SIZE, sy * v.y) : o.h;
    const keepAspect = corner && (o.type === "image" || o.type === "text" ? !shift : shift);
    if (keepAspect) {
      const k = Math.max(w / o.w, h / o.h);
      w = o.w * k;
      h = o.h * k;
    }
    const offset = rotatePoint({ x: (sx * w) / 2, y: (sy * h) / 2 }, { x: 0, y: 0 }, o.rotation);
    const nc = { x: anchor.x + offset.x, y: anchor.y + offset.y };
    let next: SceneObject = { ...o, x: nc.x - w / 2, y: nc.y - h / 2, w, h };
    if (o.type === "text") {
      // Side handles reflow the text; corners scale it.
      next = corner
        ? { ...o, x: nc.x - w / 2, y: nc.y - h / 2, w, h, fontSize: Math.max(4, Math.round(o.fontSize * (w / o.w) * 10) / 10) }
        : { ...o, x: nc.x - w / 2, y: o.y + (nc.y - h / 2 - o.y), w };
    }
    const result = next;
    editor.mutate(g.pageId, (objs) => objs.map((x) => (x.id === o.id ? result : x)), { changed: new Set([o.id]) });
    return;
  }

  const b = g.bounds;
  const anchor = { x: sx === 1 ? b.x : sx === -1 ? b.x + b.w : b.x, y: sy === 1 ? b.y : sy === -1 ? b.y + b.h : b.y };
  let fx = sx ? Math.max(MIN_SIZE, sx * (p.x - anchor.x)) / Math.max(b.w, 1) : 1;
  let fy = sy ? Math.max(MIN_SIZE, sy * (p.y - anchor.y)) / Math.max(b.h, 1) : 1;
  if (corner && !shift) {
    const k = Math.max(fx, fy);
    fx = k;
    fy = k;
  }
  const byId = new Map(g.originals.map((o) => [o.id, o]));
  editor.mutate(
    g.pageId,
    (objs) => objs.map((o) => (byId.has(o.id) ? scaleObject(byId.get(o.id)!, anchor, fx, fy) : o)),
    { changed: new Set(byId.keys()) },
  );
}
