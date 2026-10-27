"use client";

import { useState } from "react";
import { FolderPlus, GraduationCap } from "lucide-react";
import { CollectionCard } from "@/components/courses/collection-card";
import { EmptyNote, PageFrame, PageTitle, SectionHeading } from "@/components/dashboard/page-frame";
import { WorkspaceGate } from "@/components/dashboard/workspace-gate";
import { SortMenu, sortItems, type SortKey } from "@/components/projects/sort";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/hooks/use-dialogs";
import { childCollections, useWorkspaceStore } from "@/stores/workspace-store";

export function CoursesView() {
  const open = useDialogs((s) => s.open);
  return (
    <PageFrame>
      <PageTitle
        title="Courses"
        description="Every class you're taking or have taken, with lectures, exercises and revision."
        actions={
          <>
            <Button variant="outline" onClick={() => open({ kind: "create-collection", collectionKind: "folder", parentId: null })}>
              <FolderPlus /> Folder
            </Button>
            <Button onClick={() => open({ kind: "create-collection", collectionKind: "course", parentId: null })}>
              <GraduationCap /> New course
            </Button>
          </>
        }
      />
      <WorkspaceGate>
        <CoursesBody />
      </WorkspaceGate>
    </PageFrame>
  );
}

function CoursesBody() {
  const collections = useWorkspaceStore((s) => s.collections);
  const [sort, setSort] = useState<SortKey>("name");
  const top = childCollections(collections, null);
  const courses = sortItems(top.filter((c) => c.kind === "course"), sort);
  const folders = sortItems(top.filter((c) => c.kind !== "course"), sort);

  // Group courses by term so semesters read like shelves.
  const terms = new Map<string, typeof courses>();
  for (const c of courses) {
    const key = c.term?.trim() || "No term";
    terms.set(key, [...(terms.get(key) ?? []), c]);
  }

  return (
    <div className="space-y-12">
      {courses.length === 0 && <EmptyNote>No courses yet. Create one to start organising a class.</EmptyNote>}
      {[...terms.entries()].map(([term, list], i) => (
        <section key={term} aria-label={term}>
          <SectionHeading
            title={term}
            count={list.length}
            action={i === 0 ? <SortMenu value={sort} onChange={setSort} /> : undefined}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => (
              <CollectionCard key={c.id} collection={c} />
            ))}
          </div>
        </section>
      ))}
      {folders.length > 0 && (
        <section aria-label="Folders">
          <SectionHeading title="Folders" count={folders.length} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((c) => (
              <CollectionCard key={c.id} collection={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
