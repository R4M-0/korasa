"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Canvas } from "@/components/editor/canvas";
import { PageNavigator } from "@/components/editor/page-navigator";
import { PropertiesPanel } from "@/components/editor/properties-panel";
import { TopBar } from "@/components/editor/top-bar";
import { ContextToolbar } from "@/components/editor/toolbar/context-toolbar";
import { ToolDock } from "@/components/editor/toolbar/tool-dock";
import { ZoomControls } from "@/components/editor/toolbar/zoom-controls";
import { useEditorShortcuts } from "@/components/editor/use-editor-shortcuts";
import { Button } from "@/components/ui/button";
import { editor, flushSaves, useEditorStore } from "@/stores/editor-store";
import { useTourStore } from "@/stores/tour-store";
import { useUiStore } from "@/stores/ui-store";

function EditorSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="h-12 border-b" />
      <div className="desk-surface flex flex-1 items-start justify-center pt-10">
        <div className="relative aspect-[210/297] w-[min(560px,80%)] animate-pulse bg-[var(--paper)] shadow-[var(--paper-shadow)]">
          <Loader2 className="absolute inset-0 m-auto size-6 animate-spin text-stone-400" />
        </div>
      </div>
    </div>
  );
}

export function ProjectEditor({ projectId, pageId }: { projectId: string; pageId: string | null }) {
  const status = useEditorStore((s) => s.status);
  const error = useEditorStore((s) => s.error);
  const loadedId = useEditorStore((s) => s.project?.id);
  const panels = useEditorStore((s) => s.panels);
  useEditorShortcuts();

  useEffect(() => {
    void editor.load(projectId, pageId);
  }, [projectId, pageId]);

  // First project opened: offer the editor tour (once the welcome tour is done).
  const ready = status === "ready" && loadedId === projectId;
  const welcomeSeen = useUiStore((s) => s.toursSeen.welcome === true);
  useEffect(() => {
    if (!ready || !welcomeSeen) return;
    const t = setTimeout(() => useTourStore.getState().startIfNew("editor"), 700);
    return () => clearTimeout(t);
  }, [ready, welcomeSeen]);

  // Small screens start with the page strip hidden to give the sheet room.
  useEffect(() => {
    if (window.innerWidth < 900 && useEditorStore.getState().panels.pages) editor.togglePanel("pages");
  }, []);

  // Leaving the editor (client navigation): end editing and persist.
  useEffect(() => {
    return () => {
      editor.stopEditing();
      void flushSaves();
    };
  }, []);

  if (status === "error")
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertTriangle className="size-8 text-destructive" />
        <h1 className="font-display text-3xl">This project couldn’t be opened</h1>
        <p className="max-w-md text-sm text-muted-foreground">{error}</p>
        <div className="mt-2 flex gap-2">
          <Button variant="outline" onClick={() => void editor.load(projectId, pageId)}>
            Try again
          </Button>
          <Button render={<Link href="/" />}>Go home</Button>
        </div>
      </div>
    );
  if (status !== "ready" || loadedId !== projectId) return <EditorSkeleton />;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {panels.pages && <PageNavigator />}
        <div className="relative min-w-0 flex-1">
          <Canvas />
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-4">
            <ContextToolbar />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
            <ToolDock />
          </div>
          <div className="pointer-events-none absolute right-4 bottom-4 hidden xl:block">
            <ZoomControls />
          </div>
        </div>
        {panels.properties && <PropertiesPanel />}
      </div>
    </div>
  );
}
