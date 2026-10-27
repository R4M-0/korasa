"use client";

import Link from "next/link";
import { MoreHorizontal, Star } from "lucide-react";
import { EntityIcon } from "@/components/common/entity-icon";
import { CONTEXT_PARTS, DROPDOWN_PARTS, EntityMenuItems } from "@/components/layout/entity-menu";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { pluralize, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { collectionPath, useWorkspaceStore } from "@/stores/workspace-store";
import type { ProjectDTO } from "@/types";

/** Project card drawn as a small stack of sheets that fans out on hover. */
export function ProjectCard({ project, showContext = true }: { project: ProjectDTO; showContext?: boolean }) {
  const collections = useWorkspaceStore((s) => s.collections);
  const path = collectionPath(collections, project.collectionId);
  const tint = project.color ?? "#57534e";
  const entity = { type: "project", value: project } as const;

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block select-auto" render={<div />}>
        <div className="group/card relative">
          <Link
            href={`/p/${project.id}`}
            className="block rounded-xl border border-border bg-card p-3 shadow-[0_1px_0_rgba(0,0,0,.02)] transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_10px_30px_-14px_rgba(60,40,10,.35)] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <PaperStack tint={tint} pages={project.pages.length} icon={project.icon} />
            <div className="mt-3 flex items-start gap-2 px-0.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-[15px] font-semibold tracking-tight">{project.name}</h3>
                  {project.favoritedAt && <Star className="size-3 shrink-0 fill-amber-400 text-amber-500" aria-label="Favorite" />}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {showContext && path.length > 0 && <>{path.map((c) => c.name).join(" / ")} · </>}
                  {pluralize(project.pages.length, "page")} · {relativeTime(project.updatedAt)}
                </p>
              </div>
            </div>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${project.name}`}
              className="absolute top-4 right-4 flex size-7 items-center justify-center rounded-md bg-card/90 text-muted-foreground opacity-0 shadow-xs ring-1 ring-border transition-opacity group-hover/card:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none aria-expanded:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <EntityMenuItems entity={entity} parts={DROPDOWN_PARTS} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <EntityMenuItems entity={entity} parts={CONTEXT_PARTS} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

function PaperStack({ tint, pages, icon }: { tint: string; pages: number; icon: string | null }) {
  const layers = Math.min(Math.max(pages, 1), 3);
  return (
    <div className="desk-surface relative h-32 overflow-hidden rounded-lg">
      <div className="absolute inset-x-0 bottom-[-18px] mx-auto h-36 w-28">
        {Array.from({ length: layers }).map((_, i) => {
          const back = layers - 1 - i;
          return (
            <div
              key={i}
              className={cn(
                "absolute inset-0 rounded-[3px] border border-stone-300/60 bg-[#fffefb] shadow-[0_1px_2px_rgba(0,0,0,.06),0_6px_14px_-8px_rgba(60,40,10,.3)] transition-transform duration-300 ease-out",
                back === 1 && "group-hover/card:-translate-x-3 group-hover/card:-rotate-6",
                back === 2 && "group-hover/card:translate-x-3 group-hover/card:rotate-6",
              )}
              style={{
                transform: back ? `translate(${back * (back % 2 ? -3 : 3)}px, ${-back * 3}px) rotate(${back % 2 ? -2.5 : 2.5}deg)` : undefined,
                zIndex: i,
              }}
            >
              {back === 0 && (
                <div className="flex h-full flex-col p-3">
                  <EntityIcon name={icon} fallback="notebook" color={tint} className="size-5" />
                  <div className="mt-3 space-y-[7px]">
                    <div className="h-[3px] w-14 rounded-full" style={{ background: tint, opacity: 0.55 }} />
                    {[80, 92, 70, 86, 60].map((w, j) => (
                      <div key={j} className="h-px rounded-full bg-[#9db4d6]/70" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
