"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { CommandPalette } from "@/components/command/command-palette";
import { ImportProject } from "@/components/layout/import-project";
import { Sidebar, SidebarFallback } from "@/components/layout/sidebar";
import { EntityDialogs } from "@/components/projects/entity-dialogs";
import { useGlobalShortcuts } from "@/hooks/use-global-shortcuts";
import { useWorkspaceStore } from "@/stores/workspace-store";

export function AppShell({ children }: { children: ReactNode }) {
  useGlobalShortcuts();

  useEffect(() => {
    useWorkspaceStore.getState().load();
    // Pick up changes made in other tabs when returning to this one.
    const onFocus = () => {
      if (document.visibilityState === "visible") useWorkspaceStore.getState().refresh();
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* URL-reading hooks (usePathname/useSearchParams) need a Suspense boundary under cacheComponents. */}
      <Suspense fallback={<SidebarFallback />}>
        <Sidebar />
      </Suspense>
      <main className="h-full min-w-0 flex-1 overflow-hidden">
        <Suspense>{children}</Suspense>
      </main>
      <EntityDialogs />
      <CommandPalette />
      <ImportProject />
    </div>
  );
}
