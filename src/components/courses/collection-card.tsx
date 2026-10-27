"use client";

import Link from "next/link";
import { MoreHorizontal, Star } from "lucide-react";
import { EntityIcon } from "@/components/common/entity-icon";
import { CONTEXT_PARTS, DROPDOWN_PARTS, EntityMenuItems } from "@/components/layout/entity-menu";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { pluralize } from "@/lib/format";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { CollectionDTO } from "@/types";

/** Counts every project anywhere below a collection. */
export function useCollectionCounts(id: string) {
  const collections = useWorkspaceStore((s) => s.collections);
  const projects = useWorkspaceStore((s) => s.projects);
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of collections)
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
  }
  const inside = projects.filter((p) => p.collectionId && ids.has(p.collectionId));
  return {
    folders: collections.filter((c) => c.parentId === id).length,
    projects: inside.length,
    pages: inside.reduce((n, p) => n + p.pages.length, 0),
  };
}

/** A course or folder drawn like a notebook with a coloured spine. */
export function CollectionCard({ collection }: { collection: CollectionDTO }) {
  const counts = useCollectionCounts(collection.id);
  const color = collection.color ?? "#78716c";
  const entity = { type: "collection", value: collection } as const;

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block select-auto" render={<div />}>
        <div className="group/card relative h-full">
          <Link
            href={`/c/${collection.id}`}
            className="relative flex h-full min-h-36 flex-col overflow-hidden rounded-xl border border-border bg-card py-4 pr-4 pl-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/15 hover:shadow-[0_10px_30px_-14px_rgba(60,40,10,.35)] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span aria-hidden className="absolute inset-y-0 left-0 w-2" style={{ background: color }} />
            <span aria-hidden className="absolute inset-y-0 left-2 w-px bg-black/10" />
            <div className="flex items-center gap-2">
              <span
                className="flex size-8 items-center justify-center rounded-lg dark:[&_svg]:brightness-[1.7]"
                style={{ background: `${color}18` }}
              >
                <EntityIcon
                  name={collection.icon}
                  fallback={collection.kind === "course" ? "graduation" : "folder"}
                  color={color}
                />
              </span>
              {collection.term && (
                <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                  {collection.term}
                </span>
              )}
              {collection.favoritedAt && <Star className="size-3 fill-amber-400 text-amber-500" aria-label="Favorite" />}
            </div>
            <h3 className="mt-3 font-display text-[22px] leading-tight">{collection.name}</h3>
            {collection.description && (
              <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">{collection.description}</p>
            )}
            <p className="mt-auto pt-3 text-xs text-muted-foreground">
              {pluralize(counts.projects, "project")}
              {counts.folders > 0 && <> · {pluralize(counts.folders, "folder")}</>} · {pluralize(counts.pages, "page")}
            </p>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${collection.name}`}
              className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/card:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none aria-expanded:opacity-100"
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
