"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { PageView } from "@/components/editor/page-view";
import { CanvasContextMenu } from "@/components/editor/canvas-context-menu";
import { useCanvasInteractions } from "@/components/editor/use-canvas-interactions";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { editor, getLayout, useEditorStore } from "@/stores/editor-store";

const ERASER_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Ccircle cx='12' cy='12' r='8' fill='white' fill-opacity='.6' stroke='%23333' stroke-width='1.5'/%3E%3C/svg%3E\") 12 12, crosshair";
const PEN_CURSOR =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Ccircle cx='10' cy='10' r='2.5' fill='%231f1d1a' stroke='white' stroke-width='1.2'/%3E%3C/svg%3E\") 10 10, crosshair";

export function Canvas({ children }: { children?: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { onPointerDown, onDoubleClick, onDragOver, onDrop, spaceDown, panning } = useCanvasInteractions(containerRef);

  const viewport = useEditorStore((s) => s.viewport);
  const viewportSize = useEditorStore((s) => s.viewportSize);
  const tool = useEditorStore((s) => s.tool);
  const ready = useEditorStore((s) => s.status === "ready");
  const { pageOrder, viewMode, activePageId } = useEditorStore(
    useShallow((s) => ({ pageOrder: s.pageOrder, viewMode: s.viewMode, activePageId: s.activePageId })),
  );
  // Re-layout whenever orientation/position of any page changes.
  const layoutKey = useEditorStore((s) => s.pageOrder.map((id) => `${s.pages[id]?.orientation}:${s.pages[id]?.posX}:${s.pages[id]?.posY}`).join("|"));
  const layout = useMemo(
    () => getLayout(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getLayout memoises on these inputs
    [pageOrder, viewMode, activePageId, layoutKey],
  );

  // Track the canvas size.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => editor.setViewportSize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    editor.setViewportSize(el.clientWidth, el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // Initial framing once the project is loaded.
  const framedFor = useRef<string | null>(null);
  const projectId = useEditorStore((s) => s.project?.id ?? null);
  useLayoutEffect(() => {
    if (!ready || !projectId || framedFor.current === projectId || !activePageId) return;
    framedFor.current = projectId;
    editor.zoomToPage(activePageId, "width");
  }, [ready, projectId, activePageId]);

  // Keep the "active" page in sync with what's in view while scrolling.
  useEffect(() => {
    const t = setTimeout(() => {
      const s = useEditorStore.getState();
      if (s.viewMode === "single" || s.editing || s.selection.ids.length) return;
      const cy = (viewportSize.h / 2 - viewport.panY) / viewport.zoom;
      const cx = (viewportSize.w / 2 - viewport.panX) / viewport.zoom;
      let best: string | null = null;
      let bestDist = Infinity;
      for (const [id, b] of getLayout()) {
        const dx = Math.max(b.x - cx, 0, cx - (b.x + b.w));
        const dy = Math.max(b.y - cy, 0, cy - (b.y + b.h));
        const d = Math.hypot(dx, dy);
        if (d < bestDist) {
          bestDist = d;
          best = id;
        }
      }
      if (best) editor.setActivePageQuiet(best);
    }, 120);
    return () => clearTimeout(t);
  }, [viewport, viewportSize]);

  // Only mount full page content near the viewport; distant sheets render as blanks.
  const margin = Math.max(viewportSize.h, 800) / viewport.zoom;
  const view = {
    x: -viewport.panX / viewport.zoom - margin,
    y: -viewport.panY / viewport.zoom - margin,
    w: viewportSize.w / viewport.zoom + margin * 2,
    h: viewportSize.h / viewport.zoom + margin * 2,
  };

  const cursor = panning
    ? "grabbing"
    : spaceDown || tool === "hand"
      ? "grab"
      : tool === "text"
        ? "text"
        : tool === "eraser"
          ? ERASER_CURSOR
          : tool === "pen" || tool === "highlighter"
            ? PEN_CURSOR
            : tool === "select"
              ? "default"
              : "crosshair";

  return (
    <ContextMenu>
      <ContextMenuTrigger
        ref={containerRef}
        role="application"
        aria-label="Page canvas"
        className={cn("desk-surface relative h-full w-full touch-none overflow-hidden outline-none select-none")}
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})` }}
        >
          {pageOrder.map((id, index) => {
            const box = layout.get(id);
            if (!box) return null;
            const near = box.x < view.x + view.w && box.x + box.w > view.x && box.y < view.y + view.h && box.y + box.h > view.y;
            return near ? (
              <PageView key={id} pageId={id} box={box} index={index} />
            ) : (
              <div
                key={id}
                className="absolute"
                style={{ left: box.x, top: box.y, width: box.w, height: box.h, background: "var(--paper)", boxShadow: "var(--paper-shadow)" }}
              />
            );
          })}
        </div>
        {children}
      </ContextMenuTrigger>
      <CanvasContextMenu />
    </ContextMenu>
  );
}
