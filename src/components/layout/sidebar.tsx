"use client";

import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  Check,
  ChevronsUpDown,
  Clock,
  Home,
  NotebookTabs,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { CreateMenu } from "@/components/layout/create-menu";
import { KorasaMark, KorasaWordmark } from "@/components/layout/logo";
import { CollectionNode, ProjectNode } from "@/components/layout/sidebar-tree";
import { ThemeSwitch } from "@/components/layout/theme-menu";
import { useDropTarget } from "@/components/layout/use-drop-target";
import type { SectionId } from "@/components/layout/sidebar-dnd";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDialogs } from "@/hooks/use-dialogs";
import { useHydrated } from "@/hooks/use-hydrated";
import { useModKey } from "@/hooks/use-mod-key";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { childCollections, projectsIn, useWorkspaceStore } from "@/stores/workspace-store";

export function Sidebar() {
  const hydrated = useHydrated();
  const collapsed = useUiStore((s) => s.sidebarCollapsed) && hydrated;
  return collapsed ? <SidebarRail /> : <SidebarFull />;
}

/** Static frame shown while the sidebar streams in. */
export function SidebarFallback() {
  return (
    <aside aria-hidden className="flex h-full w-[264px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex h-12 items-center px-3.5">
        <KorasaWordmark />
      </div>
      <div className="px-2.5">
        <TreeSkeleton />
      </div>
    </aside>
  );
}

// ------------------------------------------------------------------ full

function SidebarFull() {
  const toggle = useUiStore((s) => s.toggleSidebar);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const mod = useModKey();

  return (
    <aside
      aria-label="Sidebar"
      className="flex h-full w-[264px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <div className="flex h-12 items-center justify-between px-3.5">
        <Link href="/" className="rounded-md focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none" aria-label="Korasa home">
          <KorasaWordmark />
        </Link>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon-sm" onClick={toggle} aria-label="Collapse sidebar" className="text-muted-foreground" />
            }
          >
            <PanelLeftClose />
          </TooltipTrigger>
          <TooltipContent side="right">
            Collapse sidebar <kbd className="ml-1 opacity-70">{mod}\</kbd>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="space-y-1.5 px-2.5">
        <WorkspaceSwitcher />
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border bg-card/70 px-2.5 text-[13px] text-muted-foreground shadow-xs transition-colors hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Search className="size-3.5" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-sidebar-border bg-sidebar px-1 font-sans text-[10px] tracking-wide">
            {mod}K
          </kbd>
        </button>
        <CreateMenu
          trigger={
            <Button className="h-8 w-full justify-start gap-2 px-2.5 shadow-xs">
              <Plus /> Create new
            </Button>
          }
        />
      </div>

      <nav aria-label="Primary" className="mt-3 space-y-px px-2.5">
        <NavLink href="/" icon={<Home />} label="Home" />
        <NavLink href="/recent" icon={<Clock />} label="Recent" />
        <NavLink href="/favorites" icon={<Star />} label="Favorites" />
      </nav>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 [scrollbar-width:thin]">
        <Suspense fallback={<TreeSkeleton />}>
          <Tree />
        </Suspense>
      </div>

      <div className="flex items-center justify-between border-t border-sidebar-border px-2.5 py-2">
        <NavLink href="/trash" icon={<Trash2 />} label="Trash" className="flex-1" />
        <ThemeSwitch />
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon,
  label,
  className,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  className?: string;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-7 items-center gap-2.5 rounded-md px-2 text-[13px] text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/70 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none [&_svg]:size-4 [&_svg]:text-muted-foreground",
        active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground [&_svg]:text-foreground",
        className,
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

function WorkspaceSwitcher() {
  const workspace = useWorkspaceStore((s) => s.workspace);
  const name = workspace?.name ?? "Workspace";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 w-full items-center gap-2 rounded-md px-1.5 text-left text-[13px] transition-colors hover:bg-sidebar-accent/70 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none aria-expanded:bg-sidebar-accent/70">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary/12 font-display text-sm text-primary">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{name}</span>
          <span className="block text-[11px] leading-tight text-muted-foreground">Local · this device</span>
        </span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          <DropdownMenuItem>
            <span className="flex size-5 items-center justify-center rounded bg-primary/12 font-display text-xs text-primary">
              {name.slice(0, 1).toUpperCase()}
            </span>
            {name}
            <Check className="ml-auto" />
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Plus /> New workspace
            <span className="ml-auto text-[10px] text-muted-foreground">Soon</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-1.5 py-1 text-sm">
          <span className="text-muted-foreground">Theme</span>
          <ThemeSwitch />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ------------------------------------------------------------------ tree

function Tree() {
  const status = useWorkspaceStore((s) => s.status);
  const collections = useWorkspaceStore((s) => s.collections);
  const projects = useWorkspaceStore((s) => s.projects);
  const open = useDialogs((s) => s.open);

  if (status === "idle" || status === "loading") return <TreeSkeleton />;
  if (status === "error") {
    return (
      <div className="rounded-md border border-dashed border-destructive/40 p-3 text-[12px] text-muted-foreground">
        Couldn’t load your workspace.{" "}
        <button className="font-medium text-foreground underline" onClick={() => useWorkspaceStore.getState().refresh()}>
          Retry
        </button>
      </div>
    );
  }

  const top = childCollections(collections, null);
  const courses = top.filter((c) => c.kind === "course");
  const folders = top.filter((c) => c.kind !== "course");
  const loose = projectsIn(projects, null);

  return (
    <div className="space-y-4">
      <Section
        id="courses"
        title="Courses"
        href="/courses"
        onAdd={() => open({ kind: "create-collection", collectionKind: "course", parentId: null })}
        empty="No courses yet"
      >
        {courses.map((c) => (
          <CollectionNode key={c.id} collection={c} depth={0} />
        ))}
      </Section>
      <Section
        id="projects"
        title="Projects"
        href="/projects"
        onAdd={() => open({ kind: "create-project", collectionId: null })}
        empty="Projects outside courses show here"
      >
        {loose.map((p) => (
          <ProjectNode key={p.id} project={p} depth={0} />
        ))}
      </Section>
      <Section
        id="folders"
        title="Folders"
        onAdd={() => open({ kind: "create-collection", collectionKind: "folder", parentId: null })}
        empty="Group anything in folders"
      >
        {folders.map((c) => (
          <CollectionNode key={c.id} collection={c} depth={0} />
        ))}
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  href,
  onAdd,
  empty,
  children,
}: {
  id: SectionId;
  title: string;
  href?: string;
  onAdd: () => void;
  empty: string;
  children: ReactNode[];
}) {
  const hydrated = useHydrated();
  const collapsed = useUiStore((s) => s.expanded[`section:${id}`] === false) && hydrated;
  const setExpanded = useUiStore((s) => s.setExpanded);
  const drop = useDropTarget({ type: "section", id });

  return (
    <section aria-label={title}>
      <div
        {...drop.props}
        className={cn(
          "group/section flex h-6 items-center gap-1 rounded-md pr-1 pl-2",
          drop.zone && "bg-primary/10 ring-1 ring-primary/40 ring-inset",
        )}
      >
        <button
          type="button"
          onClick={() => setExpanded(`section:${id}`, collapsed)}
          aria-expanded={!collapsed}
          className="flex flex-1 items-center gap-1 text-left text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        >
          {title}
          <span className={cn("text-[9px] transition-transform", collapsed && "-rotate-90")} aria-hidden>
            ▾
          </span>
        </button>
        {href && (
          <Link
            href={href}
            className="rounded px-1 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover/section:opacity-100 hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none"
          >
            All
          </Link>
        )}
        <button
          type="button"
          onClick={onAdd}
          aria-label={`New ${title.toLowerCase().replace(/s$/, "")}`}
          className="flex size-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/section:opacity-100 hover:bg-sidebar-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      {!collapsed && (
        <ul role="tree" aria-label={title} className="mt-0.5">
          {children.length ? children : <li className="px-2 py-1 text-[12px] text-muted-foreground/80 italic">{empty}</li>}
        </ul>
      )}
    </section>
  );
}

function TreeSkeleton() {
  return (
    <div className="space-y-2 px-1 pt-1" aria-busy aria-label="Loading">
      <Skeleton className="h-3 w-16" />
      {[70, 55, 80, 60].map((w, i) => (
        <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />
      ))}
      <Skeleton className="mt-4 h-3 w-16" />
      {[65, 50].map((w, i) => (
        <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ rail

function SidebarRail() {
  const toggle = useUiStore((s) => s.toggleSidebar);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const mod = useModKey();
  return (
    <aside
      aria-label="Sidebar"
      className="flex h-full w-[52px] shrink-0 flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-2.5"
    >
      <RailButton label={`Expand sidebar (${mod}\\)`} onClick={toggle}>
        <KorasaMark className="size-5" />
      </RailButton>
      <div className="my-1 h-px w-6 bg-sidebar-border" />
      <RailButton label={`Search (${mod}K)`} onClick={() => setCommandOpen(true)}>
        <Search />
      </RailButton>
      <CreateMenu
        side="right"
        trigger={
          <Button size="icon" aria-label="Create new" className="my-0.5 shadow-xs">
            <Plus />
          </Button>
        }
      />
      <RailLink href="/" label="Home" icon={<Home />} />
      <RailLink href="/recent" label="Recent" icon={<Clock />} />
      <RailLink href="/favorites" label="Favorites" icon={<Star />} />
      <RailLink href="/courses" label="Courses" icon={<BookMarked />} />
      <RailLink href="/projects" label="Projects" icon={<NotebookTabs />} />
      <div className="flex-1" />
      <RailLink href="/trash" label="Trash" icon={<Trash2 />} />
      <RailButton label="Expand sidebar" onClick={toggle}>
        <PanelLeftOpen />
      </RailButton>
    </aside>
  );
}

function RailButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon" aria-label={label} onClick={onClick} className="text-muted-foreground" />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function RailLink({ href, label, icon }: { href: string; label: string; icon: ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none [&_svg]:size-4",
              active && "bg-sidebar-accent text-foreground",
            )}
          />
        }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

