"use client";

import { toast } from "sonner";
import { sanitizeHtml } from "@/lib/editor/sanitize";
import { createText } from "@/lib/editor/objects";
import { insertImages, isSupportedImage } from "@/lib/editor/images";
import { pageSize, sceneObjectSchema, type SceneObject } from "@/lib/editor/scene";
import { editor, isEmptyHtml, selectedObjects, useEditorStore } from "@/stores/editor-store";

const MARKER = "korasa/objects";
let internal: SceneObject[] = [];

function isTyping(t: EventTarget | null) {
  return t instanceof HTMLElement && (t.isContentEditable || t.tagName === "INPUT" || t.tagName === "TEXTAREA");
}

function serialize(objects: SceneObject[]) {
  return JSON.stringify({ type: MARKER, objects });
}

function parseObjects(text: string): SceneObject[] | null {
  if (!text.startsWith(`{"type":"${MARKER}"`)) return null;
  try {
    const data = JSON.parse(text) as { objects?: unknown[] };
    const out: SceneObject[] = [];
    for (const o of data.objects ?? []) {
      const r = sceneObjectSchema.safeParse(o);
      if (r.success) out.push(r.data);
    }
    return out;
  } catch {
    return null;
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function plainToHtml(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

function targetPage() {
  const s = useEditorStore.getState();
  return s.selection.pageId ?? s.activePageId;
}

function pasteText(html: string) {
  const pageId = targetPage();
  const s = useEditorStore.getState();
  if (!pageId || isEmptyHtml(html)) return;
  const page = s.pages[pageId];
  const { w } = pageSize(page.orientation);
  const lowest = page.scene.objects.reduce((m, o) => Math.max(m, o.y + o.h), 72);
  const t = { ...createText(72, Math.min(lowest + 24, 900), s.style, html), w: w - 144 };
  editor.addObjects(pageId, [t]);
}

export function copySelection(cut = false): boolean {
  const objs = selectedObjects();
  if (!objs.length) return false;
  internal = objs;
  void navigator.clipboard?.writeText(serialize(objs)).catch(() => {});
  if (cut) editor.deleteSelection();
  return true;
}

export function handleCopy(e: ClipboardEvent, cut: boolean) {
  if (isTyping(e.target) || useEditorStore.getState().editing) return;
  const objs = selectedObjects();
  if (!objs.length) return;
  internal = objs;
  e.clipboardData?.setData("text/plain", serialize(objs));
  e.preventDefault();
  if (cut) editor.deleteSelection();
}

export function handlePaste(e: ClipboardEvent) {
  const data = e.clipboardData;
  if (!data) return;
  const files = Array.from(data.files).filter(isSupportedImage);
  const pageId = targetPage();
  // Screenshots paste as image files — even while typing in a text box.
  if (files.length && pageId) {
    e.preventDefault();
    void insertImages(files, pageId);
    return;
  }
  if (isTyping(e.target) || useEditorStore.getState().editing) return;
  if (!pageId) return;
  const text = data.getData("text/plain");
  const objects = parseObjects(text);
  if (objects) {
    e.preventDefault();
    editor.pasteObjects(pageId, objects);
    return;
  }
  const html = data.getData("text/html");
  if (html) {
    e.preventDefault();
    pasteText(sanitizeHtml(html));
    return;
  }
  if (text) {
    e.preventDefault();
    pasteText(plainToHtml(text));
  }
}

/** Paste for menu commands (no paste event available). */
export async function pasteFromMenu() {
  const pageId = targetPage();
  if (!pageId) return;
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith("image/"));
      if (type) {
        await insertImages([await item.getType(type)], pageId);
        return;
      }
    }
    const text = await navigator.clipboard.readText();
    const objects = parseObjects(text);
    if (objects) editor.pasteObjects(pageId, objects);
    else if (text) pasteText(plainToHtml(text));
  } catch {
    if (internal.length) editor.pasteObjects(pageId, internal);
    else toast("Press Ctrl+V to paste", { description: "The browser blocked clipboard access from the menu." });
  }
}
