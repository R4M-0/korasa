"use client";

import { memo, useLayoutEffect, useRef } from "react";
import { GripHorizontal } from "lucide-react";
import { ObjectView } from "@/components/editor/render/object-view";
import { PaperBackground } from "@/components/editor/render/paper-background";
import { LabelEditor, TextEditor } from "@/components/editor/text-editor";
import { SelectionOverlay } from "@/components/editor/selection-overlay";
import type { Box } from "@/lib/editor/geometry";
import type { SceneObject } from "@/lib/editor/scene";
import { cn } from "@/lib/utils";
import { editor, useEditorStore } from "@/stores/editor-store";

/**
 * Keeps `h` of auto-height text objects in sync with their rendered height,
 * so selection frames, connectors and exports agree with what is on screen.
 */
function useMeasureText(paperRef: React.RefObject<HTMLDivElement | null>, pageId: string, objects: SceneObject[]) {
  useLayoutEffect(() => {
    const paper = paperRef.current;
    if (!paper) return;
    const texts = new Map(objects.filter((o) => o.type === "text" && o.autoHeight).map((o) => [o.id, o]));
    if (!texts.size) return;
    const pending = new Map<string, number>();
    let raf = 0;
    const commit = () => {
      raf = 0;
      const updates = new Map(pending);
      pending.clear();
      editor.mutate(
        pageId,
        (objs) => {
          let changed = false;
          const next = objs.map((o) => {
            const h = updates.get(o.id);
            if (h === undefined || Math.abs(o.h - h) < 1) return o;
            changed = true;
            return { ...o, h };
          });
          return changed ? next : objs;
        },
        { silent: true, changed: new Set(updates.keys()) },
      );
    };
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.objectId!;
        const o = texts.get(id);
        const h = Math.round((entry.target as HTMLElement).offsetHeight);
        if (o && h > 0 && Math.abs(o.h - h) >= 1) pending.set(id, h);
      }
      if (pending.size && !raf) raf = requestAnimationFrame(commit);
    });
    for (const id of texts.keys()) {
      const el = paper.querySelector<HTMLElement>(`[data-object-id="${CSS.escape(id)}"]`);
      if (el) ro.observe(el);
    }
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [paperRef, pageId, objects]);
}

export const PageView = memo(function PageView({ pageId, box, index }: { pageId: string; box: Box; index: number }) {
  const page = useEditorStore((s) => s.pages[pageId]);
  const editing = useEditorStore((s) => s.editing);
  const erasing = useEditorStore((s) => s.erasing);
  const isActive = useEditorStore((s) => s.activePageId === pageId);
  const viewMode = useEditorStore((s) => s.viewMode);
  const paperRef = useRef<HTMLDivElement>(null);
  const objects = page?.scene.objects;
  useMeasureText(paperRef, pageId, objects ?? []);
  if (!page || !objects) return null;

  return (
    <div
      data-page-id={pageId}
      className="absolute"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
    >
      <div
        data-page-title={pageId}
        className={cn(
          "absolute -top-9 left-0 flex h-7 max-w-full items-center gap-2 text-[13px] select-none",
          isActive ? "text-foreground" : "text-muted-foreground",
          viewMode === "free" && "cursor-grab active:cursor-grabbing",
        )}
        title={viewMode === "free" ? "Drag to move this page" : undefined}
      >
        {viewMode === "free" && <GripHorizontal className="size-4 opacity-60" />}
        <span className="tabular-nums opacity-60">{index + 1}</span>
        <span className="truncate font-medium">{page.title}</span>
      </div>
      <div
        ref={paperRef}
        data-paper={pageId}
        className={cn("relative size-full overflow-hidden transition-shadow", isActive && "ring-primary/25")}
        style={{
          background: "var(--paper)",
          boxShadow: isActive
            ? "var(--paper-shadow), 0 0 0 1px color-mix(in oklch, var(--primary) 22%, transparent)"
            : "var(--paper-shadow)",
        }}
      >
        <PaperBackground background={page.background} w={box.w} h={box.h} />
        {objects.map((o) => {
          const isEditing = editing?.id === o.id;
          const faded = erasing.includes(o.id);
          const view = isEditing && editing.kind === "text" && o.type === "text" ? (
            <ObjectView key={o.id} obj={o} interactive>
              <TextEditor obj={o} pageId={pageId} />
            </ObjectView>
          ) : isEditing && editing.kind === "label" && (o.type === "rect" || o.type === "ellipse" || o.type === "diamond") ? (
            <ObjectView key={o.id} obj={{ ...o, label: "" }} interactive>
              <ObjectView obj={{ ...o, x: 0, y: 0, rotation: 0, opacity: 1, label: "" }} />
              <LabelEditor pageId={pageId} id={o.id} value={o.label} color={o.labelColor} size={o.labelSize} />
            </ObjectView>
          ) : (
            <ObjectView key={o.id} obj={faded ? { ...o, opacity: 0.25 } : o} interactive />
          );
          return view;
        })}
      </div>
      <SelectionOverlay pageId={pageId} objects={objects} />
    </div>
  );
});
