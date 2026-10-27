"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EntityIcon } from "@/components/common/entity-icon";
import { EmptyNote, PageFrame, PageTitle, SectionHeading } from "@/components/dashboard/page-frame";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { relativeTime } from "@/lib/format";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { TrashDTO } from "@/types";

type Kind = "collection" | "project" | "page";
type Confirm = { mode: "empty" } | { mode: "one"; kind: Kind; id: string; name: string } | null;

export function TrashView() {
  const [trash, setTrash] = useState<TrashDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setTrash(await api.trash());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .trash()
      .then((t) => !cancelled && setTrash(t))
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  const total = trash ? trash.collections.length + trash.projects.length + trash.pages.length : 0;

  async function restore(kind: Kind, id: string, name: string) {
    try {
      if (kind === "collection") await api.updateCollection(id, { restore: true });
      else if (kind === "project") await api.updateProject(id, { restore: true });
      else await api.updatePage(id, { restore: true });
      toast.success(`Restored “${name}”`);
      await Promise.all([reload(), useWorkspaceStore.getState().refresh()]);
    } catch (err) {
      toast.error("Couldn't restore", { description: err instanceof Error ? err.message : String(err) });
    }
  }

  async function runConfirm() {
    if (!confirm) return;
    setBusy(true);
    try {
      if (confirm.mode === "empty") {
        await api.emptyTrash();
        toast.success("Trash emptied");
      } else {
        if (confirm.kind === "collection") await api.deleteCollection(confirm.id, true);
        else if (confirm.kind === "project") await api.deleteProject(confirm.id, true);
        else await api.deletePage(confirm.id, true);
        toast.success(`Deleted “${confirm.name}” forever`);
      }
      setConfirm(null);
      await Promise.all([reload(), useWorkspaceStore.getState().refresh()]);
    } catch (err) {
      toast.error("Couldn't delete", { description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageFrame>
      <PageTitle
        title="Trash"
        description="Deleted items stay here until you empty the trash. Restoring brings back everything inside."
        actions={
          <Button variant="destructive" disabled={!total} onClick={() => setConfirm({ mode: "empty" })}>
            <Trash2 /> Empty trash
          </Button>
        }
      />

      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-card p-6 text-sm">
          Couldn’t load the trash: {error}{" "}
          <button className="font-medium underline" onClick={reload}>
            Retry
          </button>
        </div>
      ) : !trash ? (
        <div className="space-y-2" aria-busy aria-label="Loading">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyNote>The trash is empty.</EmptyNote>
      ) : (
        <div className="space-y-10">
          {trash.collections.length > 0 && (
            <TrashSection title="Courses & folders" count={trash.collections.length}>
              {trash.collections.map((c) => (
                <TrashRow
                  key={c.id}
                  icon={<EntityIcon name={c.icon} fallback={c.kind === "course" ? "graduation" : "folder"} color={c.color} />}
                  title={c.name}
                  detail={`${c.kind === "course" ? "Course" : "Folder"} · deleted ${relativeTime(c.deletedAt)}`}
                  onRestore={() => restore("collection", c.id, c.name)}
                  onDelete={() => setConfirm({ mode: "one", kind: "collection", id: c.id, name: c.name })}
                />
              ))}
            </TrashSection>
          )}
          {trash.projects.length > 0 && (
            <TrashSection title="Projects" count={trash.projects.length}>
              {trash.projects.map((p) => (
                <TrashRow
                  key={p.id}
                  icon={<EntityIcon name={p.icon} fallback="notebook" color={p.color} />}
                  title={p.name}
                  detail={`Project · deleted ${relativeTime(p.deletedAt)}`}
                  onRestore={() => restore("project", p.id, p.name)}
                  onDelete={() => setConfirm({ mode: "one", kind: "project", id: p.id, name: p.name })}
                />
              ))}
            </TrashSection>
          )}
          {trash.pages.length > 0 && (
            <TrashSection title="Pages" count={trash.pages.length}>
              {trash.pages.map((pg) => (
                <TrashRow
                  key={pg.id}
                  icon={<FileText className="size-4 text-muted-foreground" />}
                  title={pg.title}
                  detail={`In ${pg.projectName} · deleted ${relativeTime(pg.deletedAt)}`}
                  onRestore={() => restore("page", pg.id, pg.title)}
                  onDelete={() => setConfirm({ mode: "one", kind: "page", id: pg.id, name: pg.title })}
                />
              ))}
            </TrashSection>
          )}
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && !busy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.mode === "empty" ? "Empty the trash?" : `Delete “${confirm?.mode === "one" ? confirm.name : ""}” forever?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.mode === "empty"
                ? `${total} item${total === 1 ? "" : "s"} and everything inside them will be permanently deleted. This can’t be undone.`
                : confirm?.mode === "one" && confirm.kind === "collection"
                  ? "The folder, its subfolders and the projects inside will be permanently deleted. This can’t be undone."
                  : "This will be permanently deleted. This can’t be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={runConfirm}>
              Delete forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageFrame>
  );
}

function TrashSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <SectionHeading title={title} count={count} />
      <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-card">{children}</ul>
    </section>
  );
}

function TrashRow({
  icon,
  title,
  detail,
  onRestore,
  onDelete,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background opacity-80">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <Button variant="outline" size="sm" onClick={onRestore}>
        <RotateCcw /> Restore
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label={`Delete ${title} forever`} title="Delete forever">
        <Trash2 className="text-destructive" />
      </Button>
    </li>
  );
}
