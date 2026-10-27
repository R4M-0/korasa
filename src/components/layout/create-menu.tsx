"use client";

import type { ReactElement } from "react";
import { FilePlus2, FolderPlus, GraduationCap, Upload } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDialogs } from "@/hooks/use-dialogs";

/** "Create new" menu. `trigger` is rendered via Base UI's render prop. */
export function CreateMenu({
  trigger,
  side = "bottom",
  collectionId = null,
}: {
  trigger: ReactElement;
  side?: "bottom" | "right";
  collectionId?: string | null;
}) {
  const open = useDialogs((s) => s.open);
  const requestImport = useDialogs((s) => s.requestImport);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent side={side} align="start" className="w-60">
        <DropdownMenuItem onClick={() => open({ kind: "create-project", collectionId })}>
          <FilePlus2 /> Project
          <DropdownMenuShortcut>A4 pages</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open({ kind: "create-collection", collectionKind: "course", parentId: null })}>
          <GraduationCap /> Course
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => open({ kind: "create-collection", collectionKind: "folder", parentId: collectionId })}
        >
          <FolderPlus /> Folder
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => requestImport(collectionId)}>
          <Upload /> Import project…
          <DropdownMenuShortcut>.json</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
