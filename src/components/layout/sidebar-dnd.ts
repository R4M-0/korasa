"use client";

import { create } from "zustand";
import type { EntityRef } from "@/hooks/use-dialogs";
import { useUiStore } from "@/stores/ui-store";
import { byPosition, useWorkspaceStore } from "@/stores/workspace-store";
import type { CollectionDTO } from "@/types";

export type DropZone = "before" | "after" | "inside";
export type SectionId = "courses" | "projects" | "folders";
export type DropTarget = EntityRef | { type: "section"; id: SectionId };

interface DragState {
  dragging: EntityRef | null;
  over: { key: string; zone: DropZone } | null;
  setDragging: (d: EntityRef | null) => void;
  setOver: (o: { key: string; zone: DropZone } | null) => void;
}

/**
 * HTML5 drag data can't be read during dragover, so the active drag lives in
 * a tiny store that rows read to render drop indicators.
 */
export const useDragStore = create<DragState>()((set) => ({
  dragging: null,
  over: null,
  setDragging: (dragging) => set({ dragging, over: null }),
  setOver: (over) => set({ over }),
}));

export const targetKey = (t: DropTarget) => `${t.type}:${t.id}`;

export function isDescendant(collections: CollectionDTO[], candidateId: string, ancestorId: string) {
  const byId = new Map(collections.map((c) => [c.id, c]));
  let cursor = byId.get(candidateId);
  while (cursor) {
    if (cursor.id === ancestorId) return true;
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return false;
}

/** Which zones a target accepts for the current drag (null = not a valid drop). */
export function zoneFor(
  drag: EntityRef,
  target: DropTarget,
  ratio: number,
): DropZone | null {
  if (target.type === "section") {
    if (drag.type === "project") return target.id === "projects" ? "inside" : null;
    return target.id === "projects" ? null : "inside";
  }
  if (drag.type === target.type && drag.id === target.id) return null;
  const { collections } = useWorkspaceStore.getState();
  if (drag.type === "collection" && target.type === "collection" && isDescendant(collections, target.id, drag.id))
    return null;
  if (target.type === "collection") return ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
  return ratio < 0.5 ? "before" : "after";
}

function parentOf(ref: EntityRef): string | null {
  const s = useWorkspaceStore.getState();
  if (ref.type === "collection") return s.collections.find((c) => c.id === ref.id)?.parentId ?? null;
  return s.projects.find((p) => p.id === ref.id)?.collectionId ?? null;
}

async function setParent(ref: EntityRef, parentId: string | null) {
  const s = useWorkspaceStore.getState();
  if (parentOf(ref) === parentId) return true;
  if (ref.type === "project") return !!(await s.updateProject(ref.id, { collectionId: parentId }));
  const ok = !!(await s.updateCollection(ref.id, { parentId }));
  if (ok) await s.refresh();
  return ok;
}

export async function performDrop(drag: EntityRef, target: DropTarget, zone: DropZone) {
  const s = useWorkspaceStore.getState();

  if (target.type === "section") {
    await setParent(drag, null);
    return;
  }

  if (zone === "inside" && target.type === "collection") {
    if (await setParent(drag, target.id)) useUiStore.getState().setExpanded(target.id, true);
    return;
  }

  const targetParent = parentOf(target);
  if (drag.type !== target.type) {
    // Collections and projects are ordered separately; move into the same parent.
    await setParent(drag, targetParent);
    return;
  }

  if (!(await setParent(drag, targetParent))) return;
  const fresh = useWorkspaceStore.getState();
  const siblings =
    drag.type === "collection"
      ? fresh.collections.filter((c) => c.parentId === targetParent).sort(byPosition)
      : fresh.projects.filter((p) => p.collectionId === targetParent).sort(byPosition);
  const ids = siblings.map((x) => x.id).filter((id) => id !== drag.id);
  const index = ids.indexOf(target.id);
  ids.splice(index === -1 ? ids.length : zone === "after" ? index + 1 : index, 0, drag.id);
  if (drag.type === "collection") await s.reorderCollections(ids);
  else await s.reorderProjects(ids);
}

export const DRAG_MIME = "application/x-korasa-entity";
