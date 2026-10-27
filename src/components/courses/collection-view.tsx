"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, FilePlus2, FolderPlus, MoreHorizontal, Star, Upload } from "lucide-react";
import { EntityIcon } from "@/components/common/entity-icon";
import { CollectionCard } from "@/components/courses/collection-card";
import { InlineDescription } from "@/components/courses/inline-description";
import { EmptyNote, PageFrame, SectionHeading } from "@/components/dashboard/page-frame";
import { WorkspaceGate } from "@/components/dashboard/workspace-gate";
import { DROPDOWN_PARTS, EntityMenuItems } from "@/components/layout/entity-menu";
import { ProjectCard } from "@/components/projects/project-card";
import { SortMenu, sortItems, type SortKey } from "@/components/projects/sort";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDialogs } from "@/hooks/use-dialogs";
import { cn } from "@/lib/utils";
import { childCollections, collectionPath, projectsIn, useWorkspaceStore } from "@/stores/workspace-store";

export function CollectionView() {
  const { id } = useParams<{ id: string }>();
  return (
    <PageFrame>
      <WorkspaceGate>
        <CollectionBody id={id} />
      </WorkspaceGate>
    </PageFrame>
  );
}

function CollectionBody({ id }: { id: string }) {
  const collections = useWorkspaceStore((s) => s.collections);
  const projects = useWorkspaceStore((s) => s.projects);
  const open = useDialogs((s) => s.open);
  const requestImport = useDialogs((s) => s.requestImport);
  const [sort, setSort] = useState<SortKey>("updated");
  const collection = collections.find((c) => c.id === id);

  if (!collection) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <h1 className="font-display text-3xl">Not here</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This course or folder doesn’t exist or was moved to the trash.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Go home
          </Link>
          <Link href="/trash" className={buttonVariants({ variant: "ghost" })}>
            Open trash
          </Link>
        </div>
      </div>
    );
  }

  const path = collectionPath(collections, collection.parentId);
  const folders = childCollections(collections, id);
  const items = sortItems(projectsIn(projects, id), sort);
  const color = collection.color ?? "#78716c";
  const isCourse = collection.kind === "course";
  const favorite = !!collection.favoritedAt;
  const update = useWorkspaceStore.getState().updateCollection;

  return (
    <div className="animate-in fade-in-0 duration-300">
      <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-[13px] text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        {(path.length ? path : []).map((c) => (
          <span key={c.id} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 opacity-60" />
            <Link href={`/c/${c.id}`} className="hover:text-foreground">
              {c.name}
            </Link>
          </span>
        ))}
        {!path.length && (
          <span className="flex items-center gap-1">
            <ChevronRight className="size-3.5 opacity-60" />
            <Link href={isCourse ? "/courses" : "/"} className="hover:text-foreground">
              {isCourse ? "Courses" : "Folders"}
            </Link>
          </span>
        )}
      </nav>

      <header className="relative mb-10 flex flex-wrap items-start gap-5">
        <span
          className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-border dark:[&_svg]:brightness-[1.7]"
          style={{ background: `${color}14` }}
        >
          <EntityIcon name={collection.icon} fallback={isCourse ? "graduation" : "folder"} color={color} className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="font-semibold tracking-[0.08em] uppercase dark:brightness-[1.7]" style={{ color }}>
              {isCourse ? "Course" : "Folder"}
            </span>
            {collection.term && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px]">{collection.term}</span>
            )}
          </div>
          <h1 className="mt-1 font-display text-5xl leading-[1.05] tracking-tight">{collection.name}</h1>
          <div className="mt-2">
            <InlineDescription
              value={collection.description}
              placeholder={isCourse ? "Add a description — instructor, schedule, goals…" : "Add a description…"}
              onSave={(description) => update(collection.id, { description })}
            />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            aria-pressed={favorite}
            aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
            title={favorite ? "Remove from favorites" : "Add to favorites"}
            onClick={() => update(collection.id, { favorite: !favorite })}
          >
            <Star className={cn(favorite && "fill-amber-400 text-amber-500")} />
          </Button>
          <Button variant="outline" onClick={() => open({ kind: "create-collection", collectionKind: "folder", parentId: id })}>
            <FolderPlus /> Subfolder
          </Button>
          <Button onClick={() => open({ kind: "create-project", collectionId: id })}>
            <FilePlus2 /> New project
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label="More actions" />}
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <EntityMenuItems entity={{ type: "collection", value: collection }} parts={DROPDOWN_PARTS} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {folders.length === 0 && items.length === 0 ? (
        <div className="desk-surface rounded-2xl border border-border px-6 py-14 text-center">
          <h2 className="font-display text-3xl">Nothing here yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {isCourse
              ? "Create a project for each lecture, tutorial or exam — or add folders to organise them."
              : "Add projects or subfolders to this folder."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={() => open({ kind: "create-project", collectionId: id })}>
              <FilePlus2 /> New project
            </Button>
            <Button variant="outline" onClick={() => open({ kind: "create-collection", collectionKind: "folder", parentId: id })}>
              <FolderPlus /> New subfolder
            </Button>
            <Button variant="ghost" onClick={() => requestImport(id)}>
              <Upload /> Import
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
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
          <section aria-label="Projects">
            <SectionHeading
              title="Projects"
              count={items.length}
              action={items.length > 1 ? <SortMenu value={sort} onChange={setSort} /> : undefined}
            />
            {items.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((p) => (
                  <ProjectCard key={p.id} project={p} showContext={false} />
                ))}
              </div>
            ) : (
              <EmptyNote>No projects directly in this {isCourse ? "course" : "folder"}.</EmptyNote>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
