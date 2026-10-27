"use client";

import {
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Group,
  Lock,
  MousePointerSquareDashed,
  Pencil,
  Scissors,
  Trash2,
  Ungroup,
  Unlock,
} from "lucide-react";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { copySelection, pasteFromMenu } from "@/lib/editor/clipboard";
import { kbd } from "@/lib/editor/platform";
import { editor, useEditorStore, useSelectedObjects } from "@/stores/editor-store";

export function CanvasContextMenu() {
  const count = useEditorStore((s) => s.selection.ids.length);
  const objs = useSelectedObjects();
  const single = objs.length === 1 ? objs[0] : null;
  const grouped = objs.some((o) => o.groupId);
  const locked = objs.length > 0 && objs.every((o) => o.locked);

  return (
    <ContextMenuContent className="w-56">
      {count > 0 ? (
        <>
          {single?.type === "text" && (
            <ContextMenuItem onClick={() => editor.startEditing(single.id, "text")}>
              <Pencil /> Edit text
            </ContextMenuItem>
          )}
          {single && (single.type === "rect" || single.type === "ellipse" || single.type === "diamond") && (
            <ContextMenuItem onClick={() => editor.startEditing(single.id, "label")}>
              <Pencil /> Edit label
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => copySelection(true)}>
            <Scissors /> Cut <ContextMenuShortcut>{kbd("Mod+X")}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => copySelection()}>
            <Copy /> Copy <ContextMenuShortcut>{kbd("Mod+C")}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => void pasteFromMenu()}>
            <ClipboardPaste /> Paste <ContextMenuShortcut>{kbd("Mod+V")}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => editor.duplicateSelection()}>
            <CopyPlus /> Duplicate <ContextMenuShortcut>{kbd("Mod+D")}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => editor.reorderSelection("front")}>
            <ArrowUpToLine /> Bring to front <ContextMenuShortcut>{kbd("Mod+Shift+]")}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => editor.reorderSelection("forward")}>
            <ChevronUp /> Bring forward <ContextMenuShortcut>{kbd("Mod+]")}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => editor.reorderSelection("backward")}>
            <ChevronDown /> Send backward <ContextMenuShortcut>{kbd("Mod+[")}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => editor.reorderSelection("back")}>
            <ArrowDownToLine /> Send to back <ContextMenuShortcut>{kbd("Mod+Shift+[")}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuSeparator />
          {count > 1 && (
            <ContextMenuItem onClick={() => editor.groupSelection()}>
              <Group /> Group <ContextMenuShortcut>{kbd("Mod+G")}</ContextMenuShortcut>
            </ContextMenuItem>
          )}
          {grouped && (
            <ContextMenuItem onClick={() => editor.ungroupSelection()}>
              <Ungroup /> Ungroup <ContextMenuShortcut>{kbd("Mod+Shift+G")}</ContextMenuShortcut>
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => editor.updateSelected((o) => ({ ...o, locked: !locked }))}>
            {locked ? <Unlock /> : <Lock />} {locked ? "Unlock" : "Lock"}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => editor.deleteSelection()}>
            <Trash2 /> Delete <ContextMenuShortcut>{kbd("Delete")}</ContextMenuShortcut>
          </ContextMenuItem>
        </>
      ) : (
        <>
          <ContextMenuItem onClick={() => void pasteFromMenu()}>
            <ClipboardPaste /> Paste <ContextMenuShortcut>{kbd("Mod+V")}</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => editor.selectAll()}>
            <MousePointerSquareDashed /> Select all <ContextMenuShortcut>{kbd("Mod+A")}</ContextMenuShortcut>
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
}
