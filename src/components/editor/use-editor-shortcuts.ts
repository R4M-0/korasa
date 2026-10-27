"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { handleCopy, handlePaste } from "@/lib/editor/clipboard";
import type { Tool } from "@/lib/editor/objects";
import { pickImages, insertImages } from "@/lib/editor/images";
import { editor, flushOnUnload, flushSaves, useEditorStore } from "@/stores/editor-store";

const TOOL_KEYS: Record<string, Tool> = {
  v: "select",
  h: "hand",
  t: "text",
  p: "pen",
  m: "highlighter",
  e: "eraser",
  r: "rect",
  o: "ellipse",
  d: "diamond",
  a: "arrow",
  l: "line",
};

function isTyping(t: EventTarget | null) {
  return (
    t instanceof HTMLElement &&
    (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")
  );
}

export async function saveNow() {
  const ok = await flushSaves();
  if (ok) toast.success("All changes saved", { duration: 1500 });
  else toast.error("Save failed", { description: useEditorStore.getState().saveError ?? "Will retry automatically." });
}

/**
 * Editor keyboard shortcuts. While typing (text editor, inputs) only
 * Mod+S is handled so native/Tiptap editing behaviour is preserved.
 */
export function useEditorShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === "s") {
        e.preventDefault();
        void saveNow();
        return;
      }
      // Never steal keys from dialogs/menus or text fields.
      if (isTyping(e.target) || (e.target as HTMLElement)?.closest?.("[role=dialog],[role=menu]")) return;
      const s = useEditorStore.getState();
      if (s.status !== "ready") return;
      const hasSel = s.selection.ids.length > 0;

      if (mod) {
        if (key === "z" && !e.shiftKey) {
          e.preventDefault();
          editor.undo();
        } else if ((key === "z" && e.shiftKey) || key === "y") {
          e.preventDefault();
          editor.redo();
        } else if (key === "d") {
          e.preventDefault();
          editor.duplicateSelection();
        } else if (key === "a") {
          e.preventDefault();
          editor.selectAll();
        } else if (key === "g") {
          e.preventDefault();
          if (e.shiftKey) editor.ungroupSelection();
          else editor.groupSelection();
        } else if (e.key === "]" || e.key === "}") {
          e.preventDefault();
          editor.reorderSelection(e.shiftKey ? "front" : "forward");
        } else if (e.key === "[" || e.key === "{") {
          e.preventDefault();
          editor.reorderSelection(e.shiftKey ? "back" : "backward");
        } else if (key === "=" || key === "+") {
          e.preventDefault();
          editor.zoomBy(1.2);
        } else if (key === "-") {
          e.preventDefault();
          editor.zoomBy(1 / 1.2);
        } else if (key === "0") {
          e.preventDefault();
          editor.setZoom(1);
        } else if (key === "u" && e.shiftKey) {
          e.preventDefault();
          const pageId = s.activePageId;
          if (pageId) pickImages((files) => void insertImages(files, pageId));
        }
        return;
      }

      if (e.altKey) return;
      if (e.shiftKey && (e.code === "Digit1" || e.code === "Digit2")) {
        e.preventDefault();
        if (e.code === "Digit1") editor.fitWorkspace();
        else editor.zoomToPage();
        return;
      }
      switch (e.key) {
        case "Escape":
          if (s.tool !== "select") editor.setTool("select");
          else editor.clearSelection();
          return;
        case "Delete":
        case "Backspace":
          if (hasSel) {
            e.preventDefault();
            editor.deleteSelection();
          }
          return;
        case "Enter":
          if (s.selection.ids.length === 1) {
            const o = s.pages[s.selection.pageId!]?.scene.objects.find((x) => x.id === s.selection.ids[0]);
            if (o?.type === "text") {
              e.preventDefault();
              editor.startEditing(o.id, "text");
            } else if (o && (o.type === "rect" || o.type === "ellipse" || o.type === "diamond")) {
              e.preventDefault();
              editor.startEditing(o.id, "label");
            }
          }
          return;
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          if (!hasSel) return;
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          editor.nudgeSelection(dx, dy);
          return;
        }
        case "PageDown":
        case "PageUp": {
          const idx = s.pageOrder.indexOf(s.activePageId ?? "");
          const next = s.pageOrder[idx + (e.key === "PageDown" ? 1 : -1)];
          if (next) {
            e.preventDefault();
            editor.goToPage(next);
          }
          return;
        }
      }
      const tool = !e.shiftKey ? TOOL_KEYS[key] : undefined;
      if (tool) {
        e.preventDefault();
        editor.setTool(tool);
      } else if (key === "i" && !e.shiftKey) {
        const pageId = s.activePageId;
        if (pageId) pickImages((files) => void insertImages(files, pageId));
      }
    };
    const onCopy = (e: ClipboardEvent) => handleCopy(e, false);
    const onCut = (e: ClipboardEvent) => handleCopy(e, true);
    const onPaste = (e: ClipboardEvent) => handlePaste(e);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!flushOnUnload()) {
        e.preventDefault();
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushSaves();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("copy", onCopy);
    window.addEventListener("cut", onCut);
    window.addEventListener("paste", onPaste);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("cut", onCut);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);
}
