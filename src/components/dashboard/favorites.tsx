"use client";

import Link from "next/link";
import { FileText, Star } from "lucide-react";
import { toast } from "sonner";
import { EntityIcon } from "@/components/common/entity-icon";
import { api } from "@/lib/api/client";
import { pluralize, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { CollectionDTO, PageSummaryDTO, ProjectDTO } from "@/types";

export type FavoriteItem =
  | { kind: "collection"; at: string; value: CollectionDTO }
  | { kind: "project"; at: string; value: ProjectDTO }
  | { kind: "page"; at: string; value: PageSummaryDTO; project: ProjectDTO };

export function useFavorites(): FavoriteItem[] {
  const collections = useWorkspaceStore((s) => s.collections);
  const projects = useWorkspaceStore((s) => s.projects);
  const items: FavoriteItem[] = [
    ...collections.filter((c) => c.favoritedAt).map((c) => ({ kind: "collection" as const, at: c.favoritedAt!, value: c })),
    ...projects.filter((p) => p.favoritedAt).map((p) => ({ kind: "project" as const, at: p.favoritedAt!, value: p })),
    ...projects.flatMap((p) =>
      p.pages.filter((pg) => pg.favoritedAt).map((pg) => ({ kind: "page" as const, at: pg.favoritedAt!, value: pg, project: p })),
    ),
  ];
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

export function FavoritesGrid({ items, compact }: { items: FavoriteItem[]; compact?: boolean }) {
  return (
    <ul className={cn("grid gap-2", compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
      {items.map((item) => (
        <li key={`${item.kind}:${item.value.id}`}>
          <FavoriteTile item={item} />
        </li>
      ))}
    </ul>
  );
}

function FavoriteTile({ item }: { item: FavoriteItem }) {
  const href =
    item.kind === "collection"
      ? `/c/${item.value.id}`
      : item.kind === "project"
        ? `/p/${item.value.id}`
        : `/p/${item.project.id}?page=${item.value.id}`;
  const title = item.kind === "page" ? item.value.title : item.value.name;
  const color = item.kind === "page" ? item.project.color : item.value.color;
  const sub =
    item.kind === "collection"
      ? item.value.kind === "course"
        ? (item.value.term ?? "Course")
        : "Folder"
      : item.kind === "project"
        ? pluralize(item.value.pages.length, "page")
        : item.project.name;

  const unfavorite = () => {
    const s = useWorkspaceStore.getState();
    if (item.kind === "collection") s.updateCollection(item.value.id, { favorite: false });
    else if (item.kind === "project") s.updateProject(item.value.id, { favorite: false });
    else
      api
        .updatePage(item.value.id, { favorite: false })
        .then(() => s.patchPageSummary(item.project.id, item.value.id, { favoritedAt: null }))
        .catch((err: unknown) => toast.error("Couldn't update favorite", { description: String(err) }));
  };

  return (
    <div className="group relative flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-foreground/15">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-md"
        style={{ background: color ? `${color}16` : undefined }}
      >
        {item.kind === "page" ? (
          <FileText className="size-4" style={color ? { color } : undefined} />
        ) : (
          <EntityIcon
            name={item.value.icon}
            fallback={item.kind === "project" ? "notebook" : item.value.kind === "course" ? "graduation" : "folder"}
            color={color}
          />
        )}
      </span>
      <Link href={href} className="min-w-0 flex-1 after:absolute after:inset-0 focus-visible:outline-none">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {sub} · {relativeTime(item.value.updatedAt)}
        </span>
      </Link>
      <button
        type="button"
        onClick={unfavorite}
        aria-label={`Remove ${title} from favorites`}
        title="Remove from favorites"
        className="relative z-10 flex size-7 items-center justify-center rounded-md text-amber-500 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Star className="size-4 fill-amber-400" />
      </button>
    </div>
  );
}
