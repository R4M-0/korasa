"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { EditorContent, useEditor as useTiptap } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { textBoxStyle } from "@/components/editor/render/object-view";
import { editor, useEditorStore } from "@/stores/editor-store";
import type { TextObject } from "@/lib/editor/scene";

/**
 * In-place rich text editing for a text object. Content streams into the
 * scene (debounced, without history) so autosave captures long typing
 * sessions; a single undo step is recorded when editing ends.
 */
export function TextEditor({ obj, pageId }: { obj: TextObject; pageId: string }) {
  const objRef = useRef(obj);
  useLayoutEffect(() => {
    objRef.current = obj;
  });
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = (html: string) => {
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      pushTimer.current = null;
      editor.updateObjects(pageId, [objRef.current.id], (o) => (o.type === "text" && o.html !== html ? { ...o, html } : o), false);
    }, 250);
  };

  const tiptap = useTiptap({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: obj.html,
    editorProps: {
      attributes: { class: "outline-none", spellcheck: "true" },
      handleKeyDown: (_view, event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          flush();
          editor.stopEditing();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => push(ed.getHTML()),
  });

  const flush = () => {
    if (!tiptap || tiptap.isDestroyed) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = null;
    const html = tiptap.getHTML();
    editor.updateObjects(pageId, [objRef.current.id], (o) => (o.type === "text" && o.html !== html ? { ...o, html } : o), false);
  };
  const flushRef = useRef(flush);
  useLayoutEffect(() => {
    flushRef.current = flush;
  });

  // Register the instance for the formatting toolbar and place the caret.
  useEffect(() => {
    if (!tiptap) return;
    editor.setTextEditor(tiptap);
    const caret = useEditorStore.getState().editing?.caret;
    requestAnimationFrame(() => {
      if (tiptap.isDestroyed) return;
      const pos = caret ? tiptap.view.posAtCoords({ left: caret.x, top: caret.y }) : null;
      if (pos) tiptap.chain().focus().setTextSelection(pos.pos).run();
      else tiptap.commands.focus("end");
    });
    return () => {
      flushRef.current();
      if (useEditorStore.getState().textEditor === tiptap) editor.setTextEditor(null);
    };
  }, [tiptap]);

  // Flush pending keystrokes before the store ends the edit session.
  useEffect(() => {
    return useEditorStore.subscribe((s, prev) => {
      if (prev.editing?.id === objRef.current.id && s.editing?.id !== objRef.current.id) flushRef.current();
    });
  }, []);

  return (
    <div
      data-editing
      className="paper-text cursor-text"
      style={{ ...textBoxStyle(obj), minHeight: Math.max(obj.fontSize * 1.45, 20) }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <EditorContent editor={tiptap} />
    </div>
  );
}

/** Plain-text label editor for shapes. */
export function LabelEditor({ pageId, id, value, color, size }: { pageId: string; id: string; value: string; color: string; size: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);
  return (
    <div className="absolute inset-0 flex items-center justify-center p-2" data-editing onPointerDown={(e) => e.stopPropagation()}>
      <textarea
        ref={ref}
        defaultValue={value}
        rows={Math.max(1, value.split("\n").length)}
        aria-label="Shape label"
        className="w-full resize-none overflow-hidden bg-transparent text-center leading-tight outline-none"
        style={{ color, fontSize: size }}
        onChange={(e) => {
          const label = e.target.value;
          e.target.rows = Math.max(1, label.split("\n").length);
          editor.updateObjects(pageId, [id], (o) => ({ ...o, label }) as typeof o, false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
            e.preventDefault();
            editor.stopEditing();
          }
          e.stopPropagation();
        }}
      />
    </div>
  );
}
