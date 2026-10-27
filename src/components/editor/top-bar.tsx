"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Compass,
  Download,
  FileDown,
  FileJson,
  FileStack,
  ImageDown,
  Keyboard,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  PanelLeft,
  PanelLeftDashed,
  PanelRight,
  Printer,
  Redo2,
  Rows3,
  Square,
  Star,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { EntityIcon } from "@/components/common/entity-icon";
import { IconButton } from "@/components/editor/toolbar/primitives";
import { announcePdf, exportPage } from "@/components/editor/page-navigator";
import { ShortcutsDialog } from "@/components/editor/shortcuts-dialog";
import { saveNow } from "@/components/editor/use-editor-shortcuts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadPdf, downloadProjectJson, fileStem, isDesktop, printToPdf } from "@/lib/export";
import { kbd } from "@/lib/editor/platform";
import { cn } from "@/lib/utils";
import { editor, flushSaves, useEditorStore } from "@/stores/editor-store";
import { useTourStore } from "@/stores/tour-store";
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { ProjectViewMode } from "@/types";

// isDesktop() never changes during a session; this just keeps SSR output stable.
const noopSubscribe = () => () => {};

function SaveIndicator() {
  const status = useEditorStore((s) => s.saveStatus);
  const dirty = useEditorStore((s) => Object.keys(s.dirty).length > 0);
  const error = useEditorStore((s) => s.saveError);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (status === "error")
    return (
      <button
        type="button"
        onClick={() => void saveNow()}
        title={error ?? undefined}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
      >
        <AlertCircle className="size-3.5" /> Save failed · Retry
      </button>
    );
  const saving = status === "saving" || dirty;
  return (
    <span role="status" aria-live="polite" className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
      {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
      {saving ? "Saving…" : "Saved"}
    </span>
  );
}

function ProjectName() {
  const name = useEditorStore((s) => s.project?.name ?? "");
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <input
        autoFocus
        defaultValue={name}
        maxLength={120}
        aria-label="Project name"
        className="h-7 w-56 rounded-md border bg-background px-2 text-sm font-medium outline-none focus:ring-2 focus:ring-ring/40"
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={(e) => {
          void editor.renameProject(e.target.value);
          setEditing(false);
        }}
      />
    );
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Rename project"
      className="max-w-[260px] truncate rounded-md px-1.5 py-0.5 text-sm font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      {name}
    </button>
  );
}

const VIEW_MODES: { mode: ProjectViewMode; label: string; icon: React.ReactNode }[] = [
  { mode: "stack", label: "Stacked pages", icon: <Rows3 /> },
  { mode: "free", label: "Free workspace", icon: <LayoutGrid /> },
  { mode: "single", label: "Single page", icon: <Square /> },
];

export function TopBar() {
  const router = useRouter();
  const project = useEditorStore((s) => s.project);
  const breadcrumbs = useEditorStore((s) => s.breadcrumbs);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const viewMode = useEditorStore((s) => s.viewMode);
  const panels = useEditorStore((s) => s.panels);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const desktop = useSyncExternalStore(noopSubscribe, isDesktop, () => false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "?" && !t.isContentEditable && t.tagName !== "INPUT" && t.tagName !== "TEXTAREA") setShortcutsOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!project) return null;

  const allPages = () => {
    const s = useEditorStore.getState();
    return s.pageOrder.map((id) => s.pages[id]).filter(Boolean);
  };

  const run = async (label: string, fn: () => Promise<void> | void) => {
    try {
      await flushSaves();
      await fn();
    } catch (err) {
      toast.error(`${label} failed`, { description: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <header data-ui className="flex h-12 shrink-0 items-center gap-1 border-b bg-background/95 px-2 backdrop-blur">
      <IconButton label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"} shortcut={kbd("Mod+\\")} onClick={toggleSidebar}>
        {sidebarCollapsed ? <PanelLeftDashed /> : <PanelLeft />}
      </IconButton>
      <nav aria-label="Breadcrumb" className="ml-1 flex min-w-0 items-center gap-0.5 text-sm text-muted-foreground">
        <Link href="/" className="rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground">
          Home
        </Link>
        {breadcrumbs.map((c) => (
          <span key={c.id} className="flex min-w-0 items-center gap-0.5">
            <ChevronRight className="size-3.5 shrink-0 opacity-50" />
            <Link href={`/c/${c.id}`} className="flex min-w-0 items-center gap-1 truncate rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground">
              <EntityIcon name={c.icon} fallback={c.kind === "course" ? "graduation" : "folder"} color={c.color} className="size-3.5" />
              <span className="truncate">{c.name}</span>
            </Link>
          </span>
        ))}
        <ChevronRight className="size-3.5 shrink-0 opacity-50" />
        <span className="flex min-w-0 items-center gap-1 text-foreground">
          <EntityIcon name={project.icon} fallback="notebook" color={project.color} className="size-3.5" />
          <ProjectName />
        </span>
        <IconButton
          label={project.favoritedAt ? "Remove from favorites" : "Add to favorites"}
          size="sm"
          onClick={() => void editor.toggleProjectFavorite()}
        >
          <Star className={cn(project.favoritedAt && "fill-amber-400 text-amber-500")} />
        </IconButton>
      </nav>

      <div className="ml-auto flex items-center gap-0.5">
        <div data-tour="save">
          <SaveIndicator />
        </div>
        <div className="mx-1 h-5 w-px bg-border" />
        <IconButton label="Undo" shortcut={kbd("Mod+Z")} disabled={!canUndo} onClick={() => editor.undo()}>
          <Undo2 />
        </IconButton>
        <IconButton label="Redo" shortcut={kbd("Mod+Shift+Z")} disabled={!canRedo} onClick={() => editor.redo()}>
          <Redo2 />
        </IconButton>
        <div className="mx-1 h-5 w-px bg-border" />
        <div role="radiogroup" aria-label="Layout" data-tour="layouts" className="flex items-center rounded-lg bg-muted p-0.5">
          {VIEW_MODES.map((v) => (
            <IconButton
              key={v.mode}
              label={v.label}
              size="sm"
              role="radio"
              aria-checked={viewMode === v.mode}
              active={viewMode === v.mode}
              className={cn(viewMode === v.mode && "bg-background shadow-sm")}
              onClick={() => void editor.setViewMode(v.mode)}
            >
              {v.icon}
            </IconButton>
          ))}
        </div>
        <div className="mx-1 h-5 w-px bg-border" />
        <IconButton label={panels.pages ? "Hide pages" : "Show pages"} active={panels.pages} onClick={() => editor.togglePanel("pages")}>
          <FileStack />
        </IconButton>
        <IconButton label={panels.properties ? "Hide properties" : "Show properties"} active={panels.properties} onClick={() => editor.togglePanel("properties")}>
          <PanelRight />
        </IconButton>

        <DropdownMenu>
          <DropdownMenuTrigger
            data-tour="export"
            className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Download className="size-4" /> Export
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {/* Base UI requires menu labels to sit inside a group. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel>Current page</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => void run("Export", () => exportPage(useEditorStore.getState().activePageId!, "print"))}>
                <Printer /> {desktop ? "PDF (vector)" : "PDF (vector, via print dialog)"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void run("Export", () => exportPage(useEditorStore.getState().activePageId!, "pdf"))}>
                <FileDown /> Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void run("Export", () => exportPage(useEditorStore.getState().activePageId!, "png"))}>
                <ImageDown /> Download PNG
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Whole project</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => void run("Export", async () => announcePdf(await printToPdf(project.id, undefined, fileStem(project.name))))}
              >
                <Printer /> PDF of all pages (vector)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  void run("Export", async () => {
                    const t = toast.loading("Rendering pages…");
                    try {
                      await downloadPdf(allPages(), `${fileStem(project.name)}.pdf`, (done, total) =>
                        toast.loading(`Rendering page ${Math.min(done + 1, total)} of ${total}…`, { id: t }),
                      );
                      toast.success("PDF downloaded", { id: t });
                    } catch (err) {
                      toast.dismiss(t);
                      throw err;
                    }
                  })
                }
              >
                <FileDown /> Download multi-page PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void run("Export", () => downloadProjectJson(project.id, project.name))}>
                <FileJson /> Korasa project file (.json)
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More options"
            className="inline-flex size-8 items-center justify-center rounded-md text-foreground/80 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <MoreHorizontal className="size-[17px]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onClick={() => void saveNow()}>
              <Check /> Save now <DropdownMenuShortcut>{kbd("Mod+S")}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
              <Keyboard /> Keyboard shortcuts <DropdownMenuShortcut>?</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => useTourStore.getState().start("editor")}>
              <Compass /> Editor tour
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={async () => {
                await flushSaves();
                await useWorkspaceStore.getState().trashProject(project.id);
                router.push(project.collectionId ? `/c/${project.collectionId}` : "/");
              }}
            >
              <Trash2 /> Move project to trash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </header>
  );
}
