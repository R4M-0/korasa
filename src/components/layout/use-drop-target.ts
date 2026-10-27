"use client";

import type React from "react";
import type { EntityRef } from "@/hooks/use-dialogs";
import {
  DRAG_MIME,
  performDrop,
  targetKey,
  useDragStore,
  zoneFor,
  type DropTarget,
  type DropZone,
} from "@/components/layout/sidebar-dnd";

/** Drag source props for a tree row. */
export function dragSourceProps(ref: EntityRef) {
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.stopPropagation();
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData(DRAG_MIME, JSON.stringify(ref));
      e.dataTransfer.setData("text/plain", ref.id);
      useDragStore.getState().setDragging(ref);
    },
    onDragEnd: () => useDragStore.getState().setDragging(null),
  };
}

/** Drop handlers + the zone currently hovered (for indicators). */
export function useDropTarget(target: DropTarget): {
  zone: DropZone | null;
  props: Pick<React.HTMLAttributes<HTMLElement>, "onDragOver" | "onDragLeave" | "onDrop">;
} {
  const key = targetKey(target);
  const zone = useDragStore((s) => (s.over?.key === key ? s.over.zone : null));

  return {
    zone,
    props: {
      onDragOver: (e) => {
        const drag = useDragStore.getState().dragging;
        if (!drag) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const z = zoneFor(drag, target, (e.clientY - rect.top) / Math.max(rect.height, 1));
        if (!z) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        const over = useDragStore.getState().over;
        if (over?.key !== key || over.zone !== z) useDragStore.getState().setOver({ key, zone: z });
      },
      onDragLeave: (e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        if (useDragStore.getState().over?.key === key) useDragStore.getState().setOver(null);
      },
      onDrop: (e) => {
        const { dragging, over } = useDragStore.getState();
        useDragStore.getState().setDragging(null);
        if (!dragging || !over || over.key !== key) return;
        e.preventDefault();
        e.stopPropagation();
        void performDrop(dragging, target, over.zone);
      },
    },
  };
}
