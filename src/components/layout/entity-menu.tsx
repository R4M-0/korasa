"use client";

import type { ComponentType, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  FilePlus2,
  FolderPlus,
  Pencil,
  Settings2,
  Star,
  StarOff,
  Trash2,
  Upload,
} from "lucide-react";
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useDialogs } from "@/hooks/use-dialogs";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { CollectionDTO, ProjectDTO } from "@/types";

interface MenuParts {
  Item: ComponentType<{ onClick?: () => void; variant?: "default" | "destructive"; children: ReactNode }>;
  Separator: ComponentType;
}

export const DROPDOWN_PARTS: MenuParts = { Item: DropdownMenuItem, Separator: DropdownMenuSeparator };
export const CONTEXT_PARTS: MenuParts = { Item: ContextMenuItem, Separator: ContextMenuSeparator };

export type MenuEntity = { type: "collection"; value: CollectionDTO } | { type: "project"; value: ProjectDTO };

/**
 * Actions for a collection or project. Rendered inside either a dropdown or a
 * context menu so both surfaces stay identical.
 */
export function EntityMenuItems({
  entity,
  parts,
  onRename,
}: {
  entity: MenuEntity;
  parts: MenuParts;
  onRename?: () => void;
}) {
  const router = useRouter();
  const open = useDialogs((s) => s.open);
  const requestImport = useDialogs((s) => s.requestImport);
  const { Item, Separator } = parts;
  const ref = { type: entity.type, id: entity.value.id } as const;
  const favorite = !!entity.value.favoritedAt;

  const toggleFavorite = () => {
    const s = useWorkspaceStore.getState();
    if (entity.type === "collection") s.updateCollection(entity.value.id, { favorite: !favorite });
    else s.updateProject(entity.value.id, { favorite: !favorite });
  };

  return (
    <>
      {entity.type === "collection" && (
        <>
          <Item onClick={() => open({ kind: "create-project", collectionId: entity.value.id })}>
            <FilePlus2 /> New project inside
          </Item>
          <Item onClick={() => open({ kind: "create-collection", collectionKind: "folder", parentId: entity.value.id })}>
            <FolderPlus /> New subfolder
          </Item>
          <Item onClick={() => requestImport(entity.value.id)}>
            <Upload /> Import project here
          </Item>
          <Separator />
        </>
      )}
      {entity.type === "project" && (
        <>
          <Item onClick={() => router.push(`/p/${entity.value.id}`)}>
            <FilePlus2 /> Open
          </Item>
          <Separator />
        </>
      )}
      {onRename && (
        <Item onClick={onRename}>
          <Pencil /> Rename
        </Item>
      )}
      <Item onClick={() => open({ kind: "edit", entity: ref })}>
        <Settings2 /> Edit details…
      </Item>
      <Item onClick={() => open({ kind: "move", entity: ref })}>
        <ArrowRightLeft /> Move to…
      </Item>
      <Item onClick={toggleFavorite}>
        {favorite ? <StarOff /> : <Star />} {favorite ? "Remove from favorites" : "Add to favorites"}
      </Item>
      <Separator />
      <Item
        variant="destructive"
        onClick={() => {
          const s = useWorkspaceStore.getState();
          if (entity.type === "collection") s.trashCollection(entity.value.id);
          else s.trashProject(entity.value.id);
        }}
      >
        <Trash2 /> Move to trash
      </Item>
    </>
  );
}
