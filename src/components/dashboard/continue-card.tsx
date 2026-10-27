"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EntityIcon } from "@/components/common/entity-icon";
import { PageThumbnail } from "@/components/editor/render/static-page";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { pluralize, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { collectionPath, useWorkspaceStore } from "@/stores/workspace-store";
import type { PageDTO, ProjectDTO } from "@/types";

/** Hero card for the most recently opened project, with a live page preview. */
export function ContinueCard({ project }: { project: ProjectDTO }) {
  const collections = useWorkspaceStore((s) => s.collections);
  const [loaded, setLoaded] = useState<{ projectId: string; page: PageDTO | null } | null>(null);
  const page = loaded?.projectId === project.id ? loaded.page : undefined;

  // Prefer the page opened most recently; fall back to the first page.
  const target =
    [...project.pages].sort((a, b) => (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? ""))[0] ?? null;
  const targetId = target?.lastOpenedAt ? target.id : (project.pages[0]?.id ?? null);

  useEffect(() => {
    let cancelled = false;
    if (!targetId) {
      Promise.resolve().then(() => !cancelled && setLoaded({ projectId: project.id, page: null }));
      return;
    }
    api
      .page(targetId)
      .then((p) => !cancelled && setLoaded({ projectId: project.id, page: p }))
      .catch(() => !cancelled && setLoaded({ projectId: project.id, page: null }));
    return () => {
      cancelled = true;
    };
  }, [project.id, targetId]);

  const path = collectionPath(collections, project.collectionId);
  const href = targetId ? `/p/${project.id}?page=${targetId}` : `/p/${project.id}`;

  return (
    <Link
      href={href}
      className="group relative grid overflow-hidden rounded-2xl border border-border bg-card transition-shadow duration-300 hover:shadow-[0_18px_50px_-24px_rgba(60,40,10,.45)] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none md:grid-cols-[minmax(0,1fr)_300px]"
    >
      <div className="flex flex-col p-6 md:p-8">
        <span className="text-xs font-semibold tracking-[0.08em] text-primary uppercase">Continue working</span>
        <div className="mt-4 flex items-center gap-2 text-[13px] text-muted-foreground">
          <EntityIcon name={project.icon} fallback="notebook" color={project.color} />
          <span className="truncate">{path.length ? path.map((c) => c.name).join(" / ") : "Project"}</span>
        </div>
        <h2 className="mt-1 font-display text-4xl leading-tight tracking-tight">{project.name}</h2>
        {page ? (
          <p className="mt-1 text-[15px] text-muted-foreground">
            on <span className="text-foreground">{page.title}</span>
          </p>
        ) : null}
        {project.description && <p className="mt-3 max-w-lg text-sm text-muted-foreground">{project.description}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-4 pt-6">
          <span className={cn(buttonVariants({ size: "lg" }), "pointer-events-none gap-2 px-4")}>
            Open project <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="text-xs text-muted-foreground">
            {pluralize(project.pages.length, "page")} · opened {relativeTime(project.lastOpenedAt ?? project.updatedAt)}
          </span>
        </div>
      </div>
      <div className="desk-surface relative hidden h-64 overflow-hidden border-l border-border md:block md:h-auto">
        <div className="absolute top-7 left-1/2 w-[220px] -translate-x-1/2 rotate-[1.5deg] transition-transform duration-500 ease-out group-hover:rotate-0 group-hover:-translate-y-1">
          {page === undefined ? (
            <Skeleton className="h-[311px] w-[220px] rounded-[2px]" />
          ) : page ? (
            <div className="rounded-[2px] shadow-[var(--paper-shadow)]">
              <PageThumbnail
                width={220}
                scene={page.scene}
                background={page.background}
                orientation={page.orientation}
              />
            </div>
          ) : (
            <div className="h-[311px] w-[220px] rounded-[2px] bg-[#fffefb] shadow-[var(--paper-shadow)]" />
          )}
        </div>
      </div>
    </Link>
  );
}
