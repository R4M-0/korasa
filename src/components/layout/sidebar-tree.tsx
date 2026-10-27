"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight, FileText, MoreHorizontal, Star } from "lucide-react";
import { EntityIcon } from "@/components/common/entity-icon";
import { CONTEXT_PARTS, DROPDOWN_PARTS, EntityMenuItems, type MenuEntity } from "@/components/layout/entity-menu";
import { dragSourceProps, useDropTarget } from "@/components/layout/use-drop-target";
import type { DropZone } from "@/components/layout/sidebar-dnd";
import { ContextMenu, ContextMenuContent, ContextMenuTrigger } from "@/components/ui/context-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { childCollections, projectsIn, useWorkspaceStore } from "@/stores/workspace-store";
import type { CollectionDTO, PageSummaryDTO, ProjectDTO } from "@/types";

const INDENT = 14;

function useExpanded(id: string, defaultValue = false): [boolean, (v: boolean) => void] {
  const hydrated = useHydrated();
  const stored = useUiStore((s) => s.expanded[id]);
  const setExpanded = useUiStore((s) => s.setExpanded);
  const value = hydrated ? (stored ?? defaultValue) : defaultValue;
  return [value, (v) => setExpanded(id, v)];
}

// ------------------------------------------------------------------ row shell

interface RowProps {
  depth: number;
  icon: ReactNode;
  label: string;
  href: string;
  active: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: (v: boolean) => void;
  entity?: MenuEntity;
  dropZone?: DropZone | null;
  rowProps?: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean };
  trailing?: ReactNode;
  muted?: boolean;
}

function TreeRow({
  depth,
  icon,
  label,
  href,
  active,
  expandable,
  expanded,
  onToggle,
  entity,
  dropZone,
  rowProps,
  trailing,
  muted,
}: RowProps) {
  const [renaming, setRenaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const row = (
    <div
      {...rowProps}
      className={cn(
        "group/row relative flex h-7 items-center gap-1 rounded-md pr-1 text-[13px] dark:[&_svg]:brightness-150 text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/70",
        active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
        dropZone === "inside" && "bg-primary/10 ring-1 ring-primary/40 ring-inset",
        menuOpen && "bg-sidebar-accent/70",
      )}
      style={{ paddingLeft: 4 + depth * INDENT }}
    >
      {active && <span aria-hidden className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-primary" />}
      {dropZone === "before" && <DropLine position="top" depth={depth} />}
      {dropZone === "after" && <DropLine position="bottom" depth={depth} />}
      {expandable ? (
        <button
          type="button"
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.(!expanded);
          }}
          className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-black/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none dark:hover:bg-white/10"
        >
          <ChevronRight className={cn("size-3.5 transition-transform duration-150", expanded && "rotate-90")} />
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      {renaming && entity ? (
        <div className="flex min-w-0 flex-1 items-center gap-2 pr-1">
          {icon}
          <RenameInput entity={entity} onDone={() => setRenaming(false)} />
        </div>
      ) : (
        <Link
          href={href}
          draggable={false}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 self-stretch rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            muted && "text-muted-foreground",
          )}
          onDoubleClick={(e) => {
            if (!entity) return;
            e.preventDefault();
            setRenaming(true);
          }}
        >
          {icon}
          <span className="truncate">{label}</span>
        </Link>
      )}
      {trailing}
      {entity && !renaming && (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            aria-label={`Actions for ${label}`}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-black/5 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none aria-expanded:opacity-100 dark:hover:bg-white/10"
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <EntityMenuItems entity={entity} parts={DROPDOWN_PARTS} onRename={() => setRenaming(true)} />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  if (!entity) return row;
  return (
    <ContextMenu>
      <ContextMenuTrigger className="block select-auto" render={<div />}>
        {row}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <EntityMenuItems entity={entity} parts={CONTEXT_PARTS} onRename={() => setRenaming(true)} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

function DropLine({ position, depth }: { position: "top" | "bottom"; depth: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute right-1 z-10 h-0.5 rounded-full bg-primary",
        position === "top" ? "-top-px" : "-bottom-px",
      )}
      style={{ left: 8 + depth * INDENT }}
    >
      <span className="absolute -top-[3px] -left-1 size-2 rounded-full border-2 border-primary bg-sidebar" />
    </span>
  );
}

function RenameInput({ entity, onDone }: { entity: MenuEntity; onDone: () => void }) {
  const [value, setValue] = useState(entity.value.name);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    // Menus restore focus to their trigger on close; take it back afterwards.
    const t = window.setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 60);
    return () => window.clearTimeout(t);
  }, []);

  const commit = async () => {
    if (done.current) return;
    done.current = true;
    const name = value.trim();
    if (name && name !== entity.value.name) {
      const s = useWorkspaceStore.getState();
      if (entity.type === "collection") await s.updateCollection(entity.value.id, { name });
      else await s.updateProject(entity.value.id, { name });
    }
    onDone();
  };

  return (
    <input
      ref={ref}
      value={value}
      aria-label="Name"
      maxLength={120}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          done.current = true;
          onDone();
        }
      }}
      className="h-6 min-w-0 flex-1 rounded border border-ring/60 bg-background px-1.5 text-[13px] outline-none"
    />
  );
}

// ------------------------------------------------------------------ nodes

export function CollectionNode({ collection, depth }: { collection: CollectionDTO; depth: number }) {
  const pathname = usePathname();
  const collections = useWorkspaceStore((s) => s.collections);
  const projects = useWorkspaceStore((s) => s.projects);
  const [expanded, setExpanded] = useExpanded(collection.id);
  const ref = { type: "collection", id: collection.id } as const;
  const drop = useDropTarget(ref);
  const kids = childCollections(collections, collection.id);
  const items = projectsIn(projects, collection.id);
  const empty = kids.length === 0 && items.length === 0;

  return (
    <li role="treeitem" aria-expanded={expanded} aria-selected={pathname === `/c/${collection.id}`}>
      <TreeRow
        depth={depth}
        icon={
          <EntityIcon
            name={collection.icon}
            fallback={collection.kind === "course" ? "graduation" : "folder"}
            color={collection.color}
          />
        }
        label={collection.name}
        href={`/c/${collection.id}`}
        active={pathname === `/c/${collection.id}`}
        expandable
        expanded={expanded}
        onToggle={setExpanded}
        entity={{ type: "collection", value: collection }}
        dropZone={drop.zone}
        rowProps={{ ...dragSourceProps(ref), ...drop.props }}
        trailing={collection.favoritedAt ? <FavoriteDot /> : null}
      />
      {expanded && (
        <ul role="group">
          {kids.map((c) => (
            <CollectionNode key={c.id} collection={c} depth={depth + 1} />
          ))}
          {items.map((p) => (
            <ProjectNode key={p.id} project={p} depth={depth + 1} />
          ))}
          {empty && (
            <li className="py-1 text-[12px] text-muted-foreground/80" style={{ paddingLeft: 30 + (depth + 1) * INDENT }}>
              Empty
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

export function ProjectNode({ project, depth }: { project: ProjectDTO; depth: number }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useExpanded(project.id);
  const ref = { type: "project", id: project.id } as const;
  const drop = useDropTarget(ref);
  const active = pathname === `/p/${project.id}`;

  return (
    <li role="treeitem" aria-expanded={expanded} aria-selected={active}>
      <TreeRow
        depth={depth}
        icon={<EntityIcon name={project.icon} fallback="notebook" color={project.color} />}
        label={project.name}
        href={`/p/${project.id}`}
        active={active}
        expandable={project.pages.length > 0}
        expanded={expanded}
        onToggle={setExpanded}
        entity={{ type: "project", value: project }}
        dropZone={drop.zone}
        rowProps={{ ...dragSourceProps(ref), ...drop.props }}
        trailing={project.favoritedAt ? <FavoriteDot /> : null}
      />
      {expanded && project.pages.length > 0 && (
        <ul role="group">
          {project.pages.map((pg) => (
            <PageNode key={pg.id} page={pg} depth={depth + 1} projectActive={active} />
          ))}
        </ul>
      )}
    </li>
  );
}

function PageNode({ page, depth, projectActive }: { page: PageSummaryDTO; depth: number; projectActive: boolean }) {
  const params = useSearchParams();
  const active = projectActive && params.get("page") === page.id;
  return (
    <li role="treeitem" aria-selected={active}>
      <TreeRow
        depth={depth}
        icon={<FileText className="size-3.5 shrink-0 text-muted-foreground" />}
        label={page.title || "Untitled page"}
        href={`/p/${page.projectId}?page=${page.id}`}
        active={active}
        muted={!active}
      />
    </li>
  );
}

function FavoriteDot() {
  return <Star aria-label="Favorite" className="size-3 shrink-0 fill-amber-400/80 text-amber-500/80 group-hover/row:hidden" />;
}
