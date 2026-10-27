"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useDialogs } from "@/hooks/use-dialogs";
import { api } from "@/lib/api/client";
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

const MAX_IMPORT_BYTES = 200 * 1024 * 1024;

/** Hidden file input that services `useDialogs().requestImport()`. */
export function ImportProject() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);
  const request = useDialogs((s) => s.importRequest);

  useEffect(() => {
    if (!request) return;
    target.current = request.collectionId;
    input.current?.click();
  }, [request]);

  async function onFile(file: File) {
    if (file.size > MAX_IMPORT_BYTES) {
      toast.error("That file is too large to import (max 200 MB).");
      return;
    }
    const id = toast.loading(`Importing “${file.name}”…`);
    try {
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error("This isn’t a valid Korasa project file (JSON could not be parsed).");
      }
      const project = await api.importProject(data, target.current);
      useWorkspaceStore.getState().upsertProject(project);
      if (project.collectionId) useUiStore.getState().setExpanded(project.collectionId, true);
      toast.success(`Imported “${project.name}”`, { id, description: `${project.pages.length} pages` });
      router.push(`/p/${project.id}`);
    } catch (err) {
      toast.error("Import failed", { id, description: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <input
      ref={input}
      type="file"
      accept=".json,application/json"
      className="hidden"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) void onFile(file);
      }}
    />
  );
}
