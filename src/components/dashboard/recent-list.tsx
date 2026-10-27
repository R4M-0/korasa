"use client";

import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { EntityIcon } from "@/components/common/entity-icon";
import type { RecentItem } from "@/components/dashboard/recent";
import { pluralize, relativeTime } from "@/lib/format";
import { collectionPath, useWorkspaceStore } from "@/stores/workspace-store";

export function RecentList({ items }: { items: RecentItem[] }) {
  const collections = useWorkspaceStore((s) => s.collections);
  return (
    <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-card">
      {items.map((item) => {
        const path = collectionPath(collections, item.project.collectionId).map((c) => c.name);
        const href = item.kind === "page" ? `/p/${item.project.id}?page=${item.page.id}` : `/p/${item.project.id}`;
        return (
          <li key={item.key}>
            <Link
              href={href}
              className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/50 focus-visible:bg-accent/60 focus-visible:outline-none"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                {item.kind === "page" ? (
                  <FileText className="size-4 text-muted-foreground" />
                ) : (
                  <EntityIcon name={item.project.icon} fallback="notebook" color={item.project.color} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {item.kind === "page" ? item.page.title : item.project.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.kind === "page"
                    ? [...path, item.project.name].join(" / ")
                    : [...path, pluralize(item.project.pages.length, "page")].join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{relativeTime(item.at)}</span>
              <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
