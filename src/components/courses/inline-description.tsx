"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Click-to-edit description. Saves on blur or Mod+Enter; Escape cancels. */
export function InlineDescription({
  value,
  placeholder,
  onSave,
}: {
  value: string;
  placeholder: string;
  onSave: (v: string) => Promise<unknown> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={cn(
          "-mx-2 block max-w-2xl rounded-md px-2 py-1 text-left text-[15px] leading-relaxed whitespace-pre-wrap transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          value ? "text-muted-foreground" : "text-muted-foreground/60 italic",
        )}
      >
        {value || placeholder}
      </button>
    );
  }

  const commit = async () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== value) await onSave(next);
  };

  return (
    <textarea
      autoFocus
      value={draft}
      maxLength={2000}
      rows={Math.min(8, Math.max(2, draft.split("\n").length + 1))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
      }}
      aria-label="Description"
      className="-mx-2 block w-full max-w-2xl resize-none rounded-md border border-ring/50 bg-card px-2 py-1 text-[15px] leading-relaxed outline-none"
    />
  );
}
