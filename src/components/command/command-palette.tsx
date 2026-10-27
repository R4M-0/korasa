"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  FilePlus2,
  FileText,
  FolderPlus,
  GraduationCap,
  Home,
  Loader2,
  Moon,
  PanelLeft,
  Star,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { useTheme } from "next-themes";
import { EntityIcon } from "@/components/common/entity-icon";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useDialogs } from "@/hooks/use-dialogs";
import { api } from "@/lib/api/client";
import { relativeTime } from "@/lib/format";
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { SearchResultDTO } from "@/types";

interface Action {
  id: string;
  label: string;
  keywords?: string;
  icon: ReactNode;
  shortcut?: string;
  run: () => void;
  group: "Go to" | "Create" | "Preferences";
}

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search Korasa"
      description="Search courses, projects and pages, or run a command"
      className="top-[18%] sm:max-w-xl"
    >
      {open && <PaletteBody close={() => setOpen(false)} />}
    </CommandDialog>
  );
}

function PaletteBody({ close }: { close: () => void }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const openDialog = useDialogs((s) => s.open);
  const requestImport = useDialogs((s) => s.requestImport);
  const projects = useWorkspaceStore((s) => s.projects);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultDTO[] | null>(null);
  const [loading, setLoading] = useState(false);
  const q = query.trim();

  useEffect(() => {
    if (!q) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      setLoading(true);
      api
        .search(q, ctrl.signal)
        .then((r) => setResults(r))
        .catch(() => {
          if (!ctrl.signal.aborted) setResults([]);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setLoading(false);
        });
    }, 140);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [q]);

  const run = (fn: () => void) => {
    close();
    // Let the palette close (and release focus) before opening anything else.
    window.setTimeout(fn, 0);
  };
  const go = (href: string) => run(() => router.push(href));

  const actions: Action[] = [
    { id: "home", group: "Go to", label: "Home", icon: <Home />, run: () => go("/") },
    { id: "recent", group: "Go to", label: "Recent", icon: <Clock />, run: () => go("/recent") },
    { id: "favorites", group: "Go to", label: "Favorites", icon: <Star />, run: () => go("/favorites") },
    { id: "courses", group: "Go to", label: "All courses", icon: <GraduationCap />, run: () => go("/courses") },
    { id: "projects", group: "Go to", label: "All projects", icon: <FileText />, run: () => go("/projects") },
    { id: "trash", group: "Go to", label: "Trash", icon: <Trash2 />, run: () => go("/trash") },
    {
      id: "new-project",
      group: "Create",
      label: "New project",
      keywords: "create add notebook",
      icon: <FilePlus2 />,
      run: () => run(() => openDialog({ kind: "create-project", collectionId: null })),
    },
    {
      id: "new-course",
      group: "Create",
      label: "New course",
      keywords: "create add class",
      icon: <GraduationCap />,
      run: () => run(() => openDialog({ kind: "create-collection", collectionKind: "course", parentId: null })),
    },
    {
      id: "new-folder",
      group: "Create",
      label: "New folder",
      keywords: "create add collection category",
      icon: <FolderPlus />,
      run: () => run(() => openDialog({ kind: "create-collection", collectionKind: "folder", parentId: null })),
    },
    {
      id: "import",
      group: "Create",
      label: "Import project from file…",
      keywords: "json upload korasa",
      icon: <Upload />,
      run: () => run(() => requestImport(null)),
    },
    {
      id: "theme",
      group: "Preferences",
      label: resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode",
      keywords: "theme dark light appearance",
      icon: resolvedTheme === "dark" ? <Sun /> : <Moon />,
      run: () => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark")),
    },
    {
      id: "sidebar",
      group: "Preferences",
      label: "Toggle sidebar",
      icon: <PanelLeft />,
      shortcut: "\\",
      run: () => run(() => useUiStore.getState().toggleSidebar()),
    },
  ];

  const ql = q.toLowerCase();
  const matchedActions = q
    ? actions.filter((a) => `${a.label} ${a.keywords ?? ""}`.toLowerCase().includes(ql))
    : actions.filter((a) => a.group !== "Preferences");

  const recent = useMemo(() => {
    const items = projects.flatMap((p) => [
      ...(p.lastOpenedAt
        ? [{ key: `p:${p.id}`, title: p.name, icon: <EntityIcon name={p.icon} fallback="notebook" color={p.color} />, href: `/p/${p.id}`, at: p.lastOpenedAt, context: `${p.pages.length} pages` }]
        : []),
      ...p.pages
        .filter((pg) => pg.lastOpenedAt)
        .map((pg) => ({
          key: `pg:${pg.id}`,
          title: pg.title,
          icon: <FileText className="text-muted-foreground" />,
          href: `/p/${p.id}?page=${pg.id}`,
          at: pg.lastOpenedAt!,
          context: p.name,
        })),
    ]);
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  }, [projects]);

  const grouped = useMemo(() => {
    const r = q ? (results ?? []) : [];
    return {
      collections: r.filter((x) => x.kind === "collection"),
      projects: r.filter((x) => x.kind === "project"),
      pages: r.filter((x) => x.kind === "page"),
    };
  }, [results, q]);

  const actionGroups = (["Go to", "Create", "Preferences"] as const)
    .map((g) => ({ g, items: matchedActions.filter((a) => a.group === g) }))
    .filter((x) => x.items.length);

  const hasResults = grouped.collections.length + grouped.projects.length + grouped.pages.length > 0;

  return (
    <Command shouldFilter={false} loop className="rounded-xl!">
      <CommandInput value={query} onValueChange={setQuery} placeholder="Search notes, projects, courses…" />
      <CommandList className="max-h-[min(60vh,440px)]">
        {q && !loading && results !== null && !hasResults && matchedActions.length === 0 && (
          <CommandEmpty>
            No results for “{q}”.
          </CommandEmpty>
        )}
        {q && loading && !hasResults && (
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Searching…
          </div>
        )}

        {!q && recent.length > 0 && (
          <CommandGroup heading="Recent">
            {recent.map((r) => (
              <CommandItem key={r.key} value={r.key} onSelect={() => go(r.href)}>
                {r.icon}
                <span className="truncate">{r.title}</span>
                <span className="truncate text-xs text-muted-foreground">{r.context}</span>
                <CommandShortcut className="tracking-normal">{relativeTime(r.at)}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {grouped.pages.length > 0 && (
          <CommandGroup heading="Pages">
            {grouped.pages.map((r) => (
              <ResultItem key={r.id} r={r} onSelect={() => go(r.href)} query={q} />
            ))}
          </CommandGroup>
        )}
        {grouped.projects.length > 0 && (
          <CommandGroup heading="Projects">
            {grouped.projects.map((r) => (
              <ResultItem key={r.id} r={r} onSelect={() => go(r.href)} query={q} />
            ))}
          </CommandGroup>
        )}
        {grouped.collections.length > 0 && (
          <CommandGroup heading="Courses & folders">
            {grouped.collections.map((r) => (
              <ResultItem key={r.id} r={r} onSelect={() => go(r.href)} query={q} />
            ))}
          </CommandGroup>
        )}

        {actionGroups.map(({ g, items }, i) => (
          <div key={g}>
            {(i > 0 || hasResults || (!q && recent.length > 0)) && <CommandSeparator />}
            <CommandGroup heading={g}>
              {items.map((a) => (
                <CommandItem key={a.id} value={a.id} onSelect={a.run}>
                  {a.icon}
                  {a.label}
                  {a.shortcut && <CommandShortcut>{a.shortcut}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
      <div className="flex items-center gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span><kbd className="font-sans">↑↓</kbd> navigate</span>
        <span><kbd className="font-sans">↵</kbd> open</span>
        <span><kbd className="font-sans">esc</kbd> close</span>
        <span className="ml-auto">Searches titles and the text inside pages</span>
      </div>
    </Command>
  );
}

function ResultItem({ r, onSelect, query }: { r: SearchResultDTO; onSelect: () => void; query: string }) {
  const icon =
    r.kind === "page" ? (
      <FileText className="text-muted-foreground" />
    ) : r.kind === "project" ? (
      <EntityIcon name="notebook" className="text-muted-foreground" />
    ) : (
      <EntityIcon name={r.subtype === "course" ? "graduation" : "folder"} className="text-muted-foreground" />
    );
  return (
    <CommandItem value={`${r.kind}:${r.id}`} onSelect={onSelect} className="items-start py-2">
      <span className="mt-0.5">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="truncate font-medium">
            <Highlight text={r.title} query={query} />
          </span>
          <span className="truncate text-xs text-muted-foreground">{r.context}</span>
        </span>
        {r.snippet && (
          <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-muted-foreground">
            <Highlight text={r.snippet} query={query} />
          </span>
        )}
      </span>
    </CommandItem>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return text;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[2px] bg-amber-200/70 px-px text-inherit dark:bg-amber-400/30">
        {text.slice(i, i + query.length)}
      </mark>
      {text.slice(i + query.length)}
    </>
  );
}
