"use client";

import { useState } from "react";
import { EmptyNote, PageFrame, PageTitle, SectionHeading } from "@/components/dashboard/page-frame";
import { recentItems, type RecentItem } from "@/components/dashboard/recent";
import { RecentList } from "@/components/dashboard/recent-list";
import { WorkspaceGate } from "@/components/dashboard/workspace-gate";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";

type Filter = "all" | "pages" | "projects";

export function RecentView() {
  return (
    <PageFrame>
      <PageTitle title="Recent" description="Everything you’ve opened, newest first." />
      <WorkspaceGate>
        <RecentBody />
      </WorkspaceGate>
    </PageFrame>
  );
}

function bucket(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= start) return "Today";
  if (t >= start - 86400000) return "Yesterday";
  if (t >= start - 6 * 86400000) return "This week";
  if (t >= start - 30 * 86400000) return "This month";
  return "Earlier";
}

function RecentBody() {
  const projects = useWorkspaceStore((s) => s.projects);
  const [filter, setFilter] = useState<Filter>("all");
  const items = recentItems(projects, { pages: filter !== "projects", projects: filter !== "pages" });
  const groups = new Map<string, RecentItem[]>();
  for (const i of items) groups.set(bucket(i.at), [...(groups.get(bucket(i.at)) ?? []), i]);

  return (
    <div>
      <div role="radiogroup" aria-label="Show" className="mb-6 flex w-fit rounded-lg bg-muted p-0.5 text-xs">
        {(["all", "pages", "projects"] as const).map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={filter === f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md px-2.5 py-1 capitalize text-muted-foreground transition-colors",
              filter === f && "bg-card text-foreground shadow-xs",
            )}
          >
            {f}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyNote>Nothing opened yet.</EmptyNote>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([label, list]) => (
            <section key={label} aria-label={label}>
              <SectionHeading title={label} count={list.length} />
              <RecentList items={list} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
