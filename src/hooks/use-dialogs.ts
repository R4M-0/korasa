"use client";

import { create } from "zustand";
import type { CollectionKind } from "@/types";

export type EntityRef = { type: "collection"; id: string } | { type: "project"; id: string };

export type DialogState =
  | { kind: "create-collection"; collectionKind: CollectionKind; parentId: string | null }
  | { kind: "create-project"; collectionId: string | null }
  | { kind: "edit"; entity: EntityRef }
  | { kind: "move"; entity: EntityRef }
  | null;

interface DialogsStore {
  dialog: DialogState;
  /** Bumped to ask the shell to open the import file picker. */
  importRequest: { collectionId: string | null; nonce: number } | null;
  open: (d: NonNullable<DialogState>) => void;
  close: () => void;
  requestImport: (collectionId?: string | null) => void;
}

/** Global dialogs (create / edit / move / import) mounted once in the app shell. */
export const useDialogs = create<DialogsStore>()((set) => ({
  dialog: null,
  importRequest: null,
  open: (dialog) => set({ dialog }),
  close: () => set({ dialog: null }),
  requestImport: (collectionId = null) => set({ importRequest: { collectionId, nonce: Date.now() } }),
}));
