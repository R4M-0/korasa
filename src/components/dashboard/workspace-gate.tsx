"use client";

import type { ReactNode } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceStore } from "@/stores/workspace-store";

/** Renders children once the workspace tree is loaded; skeleton / error otherwise. */
export function WorkspaceGate({ children, skeleton }: { children: ReactNode; skeleton?: ReactNode }) {
  const status = useWorkspaceStore((s) => s.status);
  const error = useWorkspaceStore((s) => s.error);
  if (status === "ready") return <>{children}</>;
  if (status === "error") {
    return (
      <div role="alert" className="mx-auto mt-16 max-w-md rounded-xl border border-destructive/30 bg-card p-6 text-center">
        <h2 className="font-display text-2xl">Couldn’t open your workspace</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error ?? "Something went wrong."}</p>
        <Button className="mt-5" variant="outline" onClick={() => useWorkspaceStore.getState().refresh()}>
          <RotateCw /> Try again
        </Button>
      </div>
    );
  }
  return <>{skeleton ?? <GridSkeleton />}</>;
}

export function GridSkeleton() {
  return (
    <div aria-busy aria-label="Loading" className="space-y-8">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
