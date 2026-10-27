"use client";

import { useState } from "react";
import { FilePlus2, Search } from "lucide-react";
import { EmptyNote, PageFrame, PageTitle, SectionHeading } from "@/components/dashboard/page-frame";
import { WorkspaceGate } from "@/components/dashboard/workspace-gate";
import { ProjectCard } from "@/components/projects/project-card";
import { SortMenu, sortItems, type SortKey } from "@/components/projects/sort";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDialogs } from "@/hooks/use-dialogs";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";

type Scope = "all" | "independent" | "in-collections";

export function ProjectsView() {
  const open = useDialogs((s) => s.open);
  return (
    <PageFrame>
      <PageTitle
        title="Projects"
        description="Every project in your workspace — inside courses and folders, or on its own."
        actions={
          <Button onClick={() => open({ kind: "create-project", collectionId: null })}>
            <FilePlus2 /> New project
          </Button>
        }
      />
      <WorkspaceGate>
        <ProjectsBody />
      </WorkspaceGate>
    </PageFrame>
  );
}

function ProjectsBody() {
  const projects = useWorkspaceStore((s) => s.projects);
  const [sort, setSort] = useState<SortKey>("updated");
  const [scope, setScope] = useState<Scope>("all");
  const [filter, setFilter] = useState("");

  const f = filter.trim().toLowerCase();
  const list = sortItems(
    projects.filter(
      (p) =>
        (scope === "all" || (scope === "independent" ? !p.collectionId : !!p.collectionId)) &&
        (!f || p.name.toLowerCase().includes(f) || p.description.toLowerCase().includes(f)),
    ),
    sort,
  );

  return (
    <section aria-label="Projects">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter projects…" className="pl-8" />
        </div>
        <div role="radiogroup" aria-label="Scope" className="flex rounded-lg bg-muted p-0.5 text-xs">
          {(
            [
              ["all", "All"],
              ["independent", "Independent"],
              ["in-collections", "In courses & folders"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={scope === value}
              onClick={() => setScope(value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-muted-foreground transition-colors",
                scope === value && "bg-card text-foreground shadow-xs",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <SectionHeading title="Projects" count={list.length} action={<SortMenu value={sort} onChange={setSort} />} />
      {list.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      ) : (
        <EmptyNote>{f ? `No projects match “${filter}”.` : "No projects here yet."}</EmptyNote>
      )}
    </section>
  );
}
