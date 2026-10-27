"use client";

import Link from "next/link";
import { FilePlus2, FolderPlus, GraduationCap, Plus, Upload } from "lucide-react";
import { CollectionCard } from "@/components/courses/collection-card";
import { ContinueCard } from "@/components/dashboard/continue-card";
import { EmptyWorkspace } from "@/components/dashboard/empty-workspace";
import { EmptyNote, PageFrame, SectionHeading } from "@/components/dashboard/page-frame";
import { recentItems, recentProjects } from "@/components/dashboard/recent";
import { RecentList } from "@/components/dashboard/recent-list";
import { FavoritesGrid, useFavorites } from "@/components/dashboard/favorites";
import { WorkspaceGate } from "@/components/dashboard/workspace-gate";
import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/hooks/use-dialogs";
import { useHydrated } from "@/hooks/use-hydrated";
import { greeting, longDate } from "@/lib/format";
import { childCollections, projectsIn, useWorkspaceStore } from "@/stores/workspace-store";

export function Dashboard() {
  return (
    <PageFrame>
      <Greeting />
      <WorkspaceGate>
        <DashboardBody />
      </WorkspaceGate>
    </PageFrame>
  );
}

function Greeting() {
  const hydrated = useHydrated();
  const open = useDialogs((s) => s.open);
  const requestImport = useDialogs((s) => s.requestImport);
  return (
    <header className="mb-10 flex flex-wrap items-end justify-between gap-6 animate-in fade-in-0 slide-in-from-bottom-1 duration-500">
      <div>
        <p className="text-[13px] text-muted-foreground" suppressHydrationWarning>
          {hydrated ? longDate() : " "}
        </p>
        <h1 className="mt-1 font-display text-5xl leading-none tracking-tight md:text-6xl" suppressHydrationWarning>
          {hydrated ? greeting() : "Welcome"}
          <span className="text-primary">.</span>
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quick create" data-tour="start">
        <Button onClick={() => open({ kind: "create-project", collectionId: null })} className="gap-1.5 px-3">
          <FilePlus2 /> New project
        </Button>
        <Button variant="outline" onClick={() => open({ kind: "create-collection", collectionKind: "course", parentId: null })}>
          <GraduationCap /> Course
        </Button>
        <Button variant="outline" onClick={() => open({ kind: "create-collection", collectionKind: "folder", parentId: null })}>
          <FolderPlus /> Folder
        </Button>
        <Button variant="ghost" onClick={() => requestImport(null)} aria-label="Import project">
          <Upload /> Import
        </Button>
      </div>
    </header>
  );
}

function DashboardBody() {
  const collections = useWorkspaceStore((s) => s.collections);
  const projects = useWorkspaceStore((s) => s.projects);
  const open = useDialogs((s) => s.open);
  const favorites = useFavorites();

  if (collections.length === 0 && projects.length === 0) return <EmptyWorkspace />;

  const [latest] = recentProjects(projects);
  const recent = recentItems(projects)
    .filter((i) => !(i.kind === "project" && i.project.id === latest?.id))
    .slice(0, 6);
  const courses = childCollections(collections, null).filter((c) => c.kind === "course");
  const loose = projectsIn(projects, null);

  return (
    <div className="space-y-12">
      {latest && (
        <div className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
          <ContinueCard project={latest} />
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section aria-label="Recently opened">
          <SectionHeading
            title="Recently opened"
            action={
              <Link href="/recent" className="text-xs text-muted-foreground hover:text-foreground">
                View all
              </Link>
            }
          />
          {recent.length ? <RecentList items={recent} /> : <EmptyNote>Pages you open will appear here.</EmptyNote>}
        </section>
        <section aria-label="Favorites">
          <SectionHeading
            title="Favorites"
            count={favorites.length || undefined}
            action={
              <Link href="/favorites" className="text-xs text-muted-foreground hover:text-foreground">
                View all
              </Link>
            }
          />
          {favorites.length ? (
            <FavoritesGrid items={favorites.slice(0, 6)} compact />
          ) : (
            <EmptyNote>Star a course, project or page to pin it here.</EmptyNote>
          )}
        </section>
      </div>

      <section aria-label="Courses">
        <SectionHeading
          title="Courses"
          count={courses.length}
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => open({ kind: "create-collection", collectionKind: "course", parentId: null })}
            >
              <Plus /> New course
            </Button>
          }
        />
        {courses.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <CollectionCard key={c.id} collection={c} />
            ))}
          </div>
        ) : (
          <EmptyNote>No courses yet — create one to group lectures and exercises.</EmptyNote>
        )}
      </section>

      <section aria-label="Projects">
        <SectionHeading
          title="Projects"
          count={loose.length}
          action={
            <Button variant="ghost" size="sm" onClick={() => open({ kind: "create-project", collectionId: null })}>
              <Plus /> New project
            </Button>
          }
        />
        {loose.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {loose.map((p) => (
              <ProjectCard key={p.id} project={p} showContext={false} />
            ))}
          </div>
        ) : (
          <EmptyNote>Independent projects — side projects, research, scratch pages — live here.</EmptyNote>
        )}
      </section>
    </div>
  );
}
