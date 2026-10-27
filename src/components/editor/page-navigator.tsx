"use client";

import { memo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  Copy,
  FileDown,
  ImageDown,
  MoreHorizontal,
  Pencil,
  Plus,
  RectangleHorizontal,
  RectangleVertical,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageThumbnail } from "@/components/editor/render/static-page";
import { BACKGROUND_LABELS } from "@/components/editor/render/paper-background";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BACKGROUNDS } from "@/lib/editor/scene";
import { downloadPagePng, downloadPdf, fileStem, printToPdf } from "@/lib/export";
import { cn } from "@/lib/utils";
import { editor, useEditorStore } from "@/stores/editor-store";

export async function exportPage(pageId: string, kind: "png" | "pdf" | "print") {
  const s = useEditorStore.getState();
  const page = s.pages[pageId];
  if (!page || !s.project) return;
  const name = `${fileStem(s.project.name)}-${fileStem(page.title)}`;
  try {
    if (kind === "print") return printToPdf(s.project.id, [pageId]);
    const t = toast.loading("Exporting…");
    if (kind === "png") await downloadPagePng(page, `${name}.png`);
    else await downloadPdf([page], `${name}.pdf`);
    toast.success("Export ready", { id: t });
  } catch (err) {
    toast.dismiss();
    toast.error("Export failed", { description: err instanceof Error ? err.message : String(err) });
  }
}

function PageTitleInput({ pageId, title, onDone }: { pageId: string; title: string; onDone: () => void }) {
  return (
    <input
      autoFocus
      defaultValue={title}
      aria-label="Page title"
      maxLength={120}
      className="w-full rounded border bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-2 focus:ring-ring/40"
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") onDone();
      }}
      onBlur={(e) => {
        const t = e.target.value.trim();
        if (t && t !== title) editor.setPageProps(pageId, { title: t });
        onDone();
      }}
    />
  );
}

export function PageMenuItems({ pageId, onRename }: { pageId: string; onRename?: () => void }) {
  const page = useEditorStore((s) => s.pages[pageId]);
  if (!page) return null;
  return (
    <>
      {onRename && (
        <DropdownMenuItem onClick={onRename}>
          <Pencil /> Rename
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={() => void editor.duplicatePage(pageId)}>
        <Copy /> Duplicate
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => void editor.addPage({ afterPageId: pageId })}>
        <Plus /> New page after
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => void editor.togglePageFavorite(pageId)}>
        <Star className={cn(page.favoritedAt && "fill-amber-400 text-amber-500")} /> {page.favoritedAt ? "Remove from favorites" : "Add to favorites"}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>Paper</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {BACKGROUNDS.map((b) => (
            <DropdownMenuItem key={b} onClick={() => editor.setPageProps(pageId, { background: b })} className={cn(b === page.background && "bg-accent")}>
              {BACKGROUND_LABELS[b]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem onClick={() => editor.setPageProps(pageId, { orientation: page.orientation === "portrait" ? "landscape" : "portrait" })}>
        {page.orientation === "portrait" ? <RectangleHorizontal /> : <RectangleVertical />}
        {page.orientation === "portrait" ? "Switch to landscape" : "Switch to portrait"}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => void exportPage(pageId, "print")}>
        <FileDown /> Export page as PDF
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => void exportPage(pageId, "png")}>
        <ImageDown /> Export page as PNG
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive" onClick={() => void editor.deletePage(pageId)}>
        <Trash2 /> Delete page
      </DropdownMenuItem>
    </>
  );
}

const PageCard = memo(function PageCard({
  pageId,
  index,
  dragging,
  dropBefore,
  onDragStart,
  onDragOverCard,
  onDragEnd,
}: {
  pageId: string;
  index: number;
  dragging: boolean;
  dropBefore: boolean | null;
  onDragStart: (id: string) => void;
  onDragOverCard: (id: string, before: boolean) => void;
  onDragEnd: () => void;
}) {
  const page = useEditorStore((s) => s.pages[pageId]);
  const active = useEditorStore((s) => s.activePageId === pageId);
  const [renaming, setRenaming] = useState(false);
  if (!page) return null;
  return (
    <div
      className={cn("group relative px-3 py-1.5", dragging && "opacity-40")}
      draggable={!renaming}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-korasa-page", pageId);
        onDragStart(pageId);
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("application/x-korasa-page")) return;
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        onDragOverCard(pageId, e.clientY < r.top + r.height / 2);
      }}
      onDragEnd={onDragEnd}
    >
      {dropBefore !== null && (
        <div className={cn("absolute right-3 left-3 h-0.5 rounded-full bg-primary", dropBefore ? "top-0" : "bottom-0")} />
      )}
      <button
        type="button"
        onClick={() => editor.goToPage(pageId)}
        onDoubleClick={() => setRenaming(true)}
        aria-current={active ? "page" : undefined}
        aria-label={`Page ${index + 1}: ${page.title}`}
        className={cn(
          "block w-full overflow-hidden rounded-[3px] bg-white ring-1 transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active ? "shadow-md ring-2 ring-primary" : "shadow-sm ring-black/10 hover:ring-black/25 dark:ring-white/10",
        )}
      >
        <PageThumbnail width={page.orientation === "portrait" ? 136 : 168} scene={page.scene} background={page.background} orientation={page.orientation} />
      </button>
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className={cn("text-[11px] tabular-nums", active ? "text-primary" : "text-muted-foreground")}>{index + 1}</span>
        {renaming ? (
          <PageTitleInput pageId={pageId} title={page.title} onDone={() => setRenaming(false)} />
        ) : (
          <span className={cn("min-w-0 flex-1 truncate text-xs", active ? "font-medium text-foreground" : "text-muted-foreground")} title={page.title}>
            {page.title}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Page options"
            className="rounded p-0.5 text-muted-foreground opacity-0 outline-none group-hover:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 aria-expanded:opacity-100"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <PageMenuItems pageId={pageId} onRename={() => setRenaming(true)} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});

export function PageNavigator() {
  const order = useEditorStore(useShallow((s) => s.pageOrder));
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; before: boolean } | null>(null);

  const drop = () => {
    if (drag && over && drag !== over.id) {
      const next = order.filter((id) => id !== drag);
      const idx = next.indexOf(over.id);
      next.splice(over.before ? idx : idx + 1, 0, drag);
      if (next.join() !== order.join()) void editor.reorderPages(next);
    }
    setDrag(null);
    setOver(null);
  };

  return (
    <aside data-ui aria-label="Pages" className="flex h-full w-[184px] shrink-0 flex-col border-r bg-sidebar">
      <div className="flex h-10 items-center justify-between px-3">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Pages · {order.length}</span>
        <button
          type="button"
          onClick={() => void editor.addPage({ afterPageId: useEditorStore.getState().activePageId })}
          className="rounded p-1 text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Add page after current"
          title="Add page"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto pb-3"
        onDrop={(e) => {
          e.preventDefault();
          drop();
        }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/x-korasa-page")) e.preventDefault();
        }}
      >
        {order.map((id, i) => (
          <PageCard
            key={id}
            pageId={id}
            index={i}
            dragging={drag === id}
            dropBefore={over?.id === id && drag !== id ? over.before : null}
            onDragStart={setDrag}
            onDragOverCard={(pid, before) => setOver({ id: pid, before })}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
          />
        ))}
        <div className="px-3 pt-1">
          <button
            type="button"
            onClick={() => void editor.addPage()}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed py-3 text-xs text-muted-foreground outline-none hover:border-primary/40 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Plus className="size-3.5" /> New page
          </button>
        </div>
      </div>
    </aside>
  );
}
