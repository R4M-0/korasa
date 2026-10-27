"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Search } from "lucide-react";
import { EntityIcon } from "@/components/common/entity-icon";
import { ColorPicker, IconPicker } from "@/components/courses/icon-color-picker";
import { collectionOptions } from "@/components/projects/collection-options";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDialogs, type DialogState, type EntityRef } from "@/hooks/use-dialogs";
import { BACKGROUNDS, type PageBackground } from "@/lib/editor/scene";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { CollectionKind } from "@/types";

const NONE = "__none__";

const BACKGROUND_LABEL: Record<PageBackground, string> = {
  plain: "Plain",
  ruled: "Ruled",
  grid: "Graph",
  dotted: "Dotted",
  bordered: "Bordered",
};

/** Mounted once in the shell; renders whichever dialog is requested. */
export function EntityDialogs() {
  const dialog = useDialogs((s) => s.dialog);
  const close = useDialogs((s) => s.close);
  // Key by dialog identity so form state resets each time a dialog opens.
  const key = dialog ? JSON.stringify(dialog) : "closed";

  return (
    <Dialog open={!!dialog} onOpenChange={(open) => !open && close()}>
      {dialog?.kind === "move" ? (
        <MoveDialog key={key} entity={dialog.entity} onDone={close} />
      ) : dialog ? (
        <EntityFormDialog key={key} dialog={dialog} onDone={close} />
      ) : null}
    </Dialog>
  );
}

// ------------------------------------------------------------------ form

type FormDialog = Exclude<NonNullable<DialogState>, { kind: "move" }>;

function EntityFormDialog({ dialog, onDone }: { dialog: FormDialog; onDone: () => void }) {
  const router = useRouter();
  const collections = useWorkspaceStore((s) => s.collections);
  const projects = useWorkspaceStore((s) => s.projects);
  const store = useWorkspaceStore.getState;

  const existingCollection =
    dialog.kind === "edit" && dialog.entity.type === "collection"
      ? collections.find((c) => c.id === dialog.entity.id)
      : undefined;
  const existingProject =
    dialog.kind === "edit" && dialog.entity.type === "project"
      ? projects.find((p) => p.id === dialog.entity.id)
      : undefined;

  const isProject = dialog.kind === "create-project" || !!existingProject;
  const initialKind: CollectionKind =
    dialog.kind === "create-collection" ? dialog.collectionKind : (existingCollection?.kind ?? "folder");

  const [kind, setKind] = useState<CollectionKind>(initialKind);
  const [name, setName] = useState(existingCollection?.name ?? existingProject?.name ?? "");
  const [description, setDescription] = useState(
    existingCollection?.description ?? existingProject?.description ?? "",
  );
  const [term, setTerm] = useState(existingCollection?.term ?? "");
  const [icon, setIcon] = useState<string | null>(
    existingCollection?.icon ??
      existingProject?.icon ??
      (isProject ? "notebook" : initialKind === "course" ? "graduation" : "folder"),
  );
  const [color, setColor] = useState<string | null>(
    existingCollection?.color ?? existingProject?.color ?? (isProject || initialKind === "course" ? "#2f4fb0" : null),
  );
  const [parent, setParent] = useState<string>(
    (dialog.kind === "create-collection"
      ? dialog.parentId
      : dialog.kind === "create-project"
        ? dialog.collectionId
        : (existingCollection?.parentId ?? existingProject?.collectionId)) ?? NONE,
  );
  const [background, setBackground] = useState<PageBackground>("ruled");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options = useMemo(
    () => collectionOptions(collections, existingCollection?.id),
    [collections, existingCollection?.id],
  );
  const selectItems = [{ value: NONE, label: isProject ? "No collection" : "Top level" }, ...options];

  const noun = isProject ? "project" : kind === "course" ? "course" : "folder";
  const title = dialog.kind === "edit" ? `Edit ${noun}` : `New ${noun}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give it a name.");
      return;
    }
    if (trimmed.length > 120) {
      setError("Keep the name under 120 characters.");
      return;
    }
    setBusy(true);
    const parentId = parent === NONE ? null : parent;
    try {
      if (dialog.kind === "create-project") {
        const p = await store().createProject({
          name: trimmed,
          description: description.trim(),
          icon,
          color,
          collectionId: parentId,
          background,
        });
        if (p) {
          onDone();
          router.push(`/p/${p.id}`);
        }
      } else if (dialog.kind === "create-collection") {
        const c = await store().createCollection({
          kind,
          name: trimmed,
          description: description.trim(),
          term: kind === "course" ? term.trim() || null : null,
          icon,
          color,
          parentId,
        });
        if (c) {
          if (parentId) useUiStore.getState().setExpanded(parentId, true);
          onDone();
          router.push(`/c/${c.id}`);
        }
      } else if (existingProject) {
        const p = await store().updateProject(existingProject.id, {
          name: trimmed,
          description: description.trim(),
          icon,
          color,
          collectionId: parentId,
        });
        if (p) onDone();
      } else if (existingCollection) {
        const c = await store().updateCollection(existingCollection.id, {
          kind,
          name: trimmed,
          description: description.trim(),
          term: kind === "course" ? term.trim() || null : null,
          icon,
          color,
          parentId,
        });
        if (c) {
          if (c.parentId !== existingCollection.parentId) await store().refresh();
          onDone();
        }
      }
    } finally {
      setBusy(false);
    }
  }

  if (dialog.kind === "edit" && !existingCollection && !existingProject) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Not found</DialogTitle>
          <DialogDescription>This item no longer exists.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    );
  }

  return (
    <DialogContent className="sm:max-w-md">
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription>
            {isProject
              ? "A project holds A4 pages — notes, diagrams and screenshots."
              : kind === "course"
                ? "Courses group lectures, exercises and revision projects."
                : "Folders organise projects any way you like."}
          </DialogDescription>
        </DialogHeader>

        {!isProject && dialog.kind === "edit" && (
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Type">
            {(["course", "folder"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "rounded-md py-1 text-sm capitalize text-muted-foreground transition-colors",
                  kind === k && "bg-card text-foreground shadow-xs",
                )}
              >
                {k}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-1.5">
          <Label htmlFor="entity-name">Name</Label>
          <div className="flex items-center gap-2">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-card"
              aria-hidden
            >
              <EntityIcon name={icon} color={color} />
            </span>
            <Input
              id="entity-name"
              autoFocus
              value={name}
              aria-invalid={!!error}
              aria-describedby={error ? "entity-name-error" : undefined}
              placeholder={isProject ? "e.g. Trees — lecture 5" : kind === "course" ? "e.g. Data Structures" : "e.g. Personal"}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              maxLength={140}
            />
          </div>
          {error && (
            <p id="entity-name-error" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        {kind === "course" && !isProject && (
          <div className="grid gap-1.5">
            <Label htmlFor="entity-term">Semester or year</Label>
            <Input
              id="entity-term"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="e.g. Fall 2026"
              maxLength={60}
            />
          </div>
        )}

        {(isProject || kind === "course" || dialog.kind === "edit") && (
          <div className="grid gap-1.5">
            <Label htmlFor="entity-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="entity-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
              className="min-h-16 resize-none"
            />
          </div>
        )}

        <div className="grid gap-1.5">
          <Label>{isProject ? "Collection" : "Inside"}</Label>
          <Select items={selectItems} value={parent} onValueChange={(v) => setParent((v as string) ?? NONE)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{selectItems[0].label}</SelectItem>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <span style={{ paddingLeft: o.depth * 12 }} className="flex items-center gap-2">
                    <EntityIcon
                      name={o.collection.icon}
                      fallback={o.collection.kind === "course" ? "graduation" : "folder"}
                      color={o.collection.color}
                    />
                    {o.collection.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {dialog.kind === "create-project" && (
          <div className="grid gap-1.5">
            <Label>First page</Label>
            <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Page background">
              {BACKGROUNDS.map((bg) => (
                <button
                  key={bg}
                  type="button"
                  role="radio"
                  aria-checked={background === bg}
                  onClick={() => setBackground(bg)}
                  className={cn(
                    "group flex flex-col items-center gap-1 rounded-md p-1 text-[11px] text-muted-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                    background === bg && "bg-accent text-foreground",
                  )}
                >
                  <PaperSwatch background={bg} active={background === bg} />
                  {BACKGROUND_LABEL[bg]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-1.5">
          <Label>Icon</Label>
          <IconPicker value={icon} color={color} onChange={setIcon} />
        </div>
        <div className="grid gap-1.5">
          <Label>Color</Label>
          <ColorPicker value={color} onChange={setColor} />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {dialog.kind === "edit" ? "Save changes" : `Create ${noun}`}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function PaperSwatch({ background, active }: { background: PageBackground; active?: boolean }) {
  const pattern: React.CSSProperties =
    background === "ruled"
      ? { backgroundImage: "repeating-linear-gradient(to bottom, transparent 0 5px, #9db4d6 5px 5.6px)" }
      : background === "grid"
        ? {
            backgroundImage:
              "linear-gradient(#9db4d6 1px, transparent 1px), linear-gradient(90deg, #9db4d6 1px, transparent 1px)",
            backgroundSize: "6px 6px",
          }
        : background === "dotted"
          ? { backgroundImage: "radial-gradient(#8f9bb0 0.7px, transparent 0.8px)", backgroundSize: "5px 5px" }
          : background === "bordered"
            ? { boxShadow: "inset 0 0 0 3px #fffefb, inset 0 0 0 3.6px #b9b2a6" }
            : {};
  return (
    <span
      className={cn(
        "block h-11 w-8 rounded-[2px] border border-stone-300/70 bg-[#fffefb] shadow-[0_1px_2px_rgba(0,0,0,.08)] transition-transform group-hover:-translate-y-0.5",
        active && "border-primary/60 ring-2 ring-primary/30",
      )}
      style={pattern}
    />
  );
}

// ------------------------------------------------------------------ move

function MoveDialog({ entity, onDone }: { entity: EntityRef; onDone: () => void }) {
  const collections = useWorkspaceStore((s) => s.collections);
  const projects = useWorkspaceStore((s) => s.projects);
  const [query, setQuery] = useState("");
  const item =
    entity.type === "collection"
      ? collections.find((c) => c.id === entity.id)
      : projects.find((p) => p.id === entity.id);
  const currentParent =
    entity.type === "collection"
      ? (item as { parentId?: string | null } | undefined)?.parentId ?? null
      : (item as { collectionId?: string | null } | undefined)?.collectionId ?? null;

  // A collection cannot move into itself or its descendants.
  const options = useMemo(() => {
    const all = collectionOptions(collections, entity.type === "collection" ? entity.id : undefined);
    const q = query.trim().toLowerCase();
    return q ? all.filter((o) => o.label.toLowerCase().includes(q)) : all;
  }, [collections, entity, query]);

  async function moveTo(target: string | null) {
    const s = useWorkspaceStore.getState();
    if (entity.type === "project") await s.updateProject(entity.id, { collectionId: target });
    else {
      const res = await s.updateCollection(entity.id, { parentId: target });
      if (res) await s.refresh();
    }
    if (target) useUiStore.getState().setExpanded(target, true);
    onDone();
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Move “{item?.name ?? "item"}”</DialogTitle>
        <DialogDescription>Choose where it should live.</DialogDescription>
      </DialogHeader>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter collections…"
          className="pl-8"
        />
      </div>
      <div className="-mx-1 max-h-72 overflow-y-auto">
        {!query && (
          <MoveRow
            label={entity.type === "project" ? "No collection (independent project)" : "Top level"}
            icon={<EntityIcon name="sparkles" className="text-muted-foreground" />}
            current={currentParent === null}
            onClick={() => moveTo(null)}
          />
        )}
        {options.map((o) => (
          <MoveRow
            key={o.value}
            label={o.collection.name}
            depth={query ? 0 : o.depth}
            hint={query && o.depth ? o.label : undefined}
            icon={
              <EntityIcon
                name={o.collection.icon}
                fallback={o.collection.kind === "course" ? "graduation" : "folder"}
                color={o.collection.color}
              />
            }
            current={currentParent === o.value}
            onClick={() => moveTo(o.value)}
          />
        ))}
        {options.length === 0 && query && (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matching collections.</p>
        )}
      </div>
    </DialogContent>
  );
}

function MoveRow({
  label,
  icon,
  depth = 0,
  hint,
  current,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  depth?: number;
  hint?: string;
  current: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={current}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:opacity-60"
      style={{ paddingLeft: 8 + depth * 16 }}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">
        {label}
        {hint && <span className="ml-2 text-xs text-muted-foreground">{hint}</span>}
      </span>
      {current && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Check className="size-3.5" /> Current
        </span>
      )}
    </button>
  );
}
