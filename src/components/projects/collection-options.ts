import type { CollectionDTO } from "@/types";
import { byPosition } from "@/stores/workspace-store";

export interface CollectionOption {
  value: string;
  label: string;
  depth: number;
  collection: CollectionDTO;
}

/** Depth-first list of collections with indentation info, for pickers. */
export function collectionOptions(collections: CollectionDTO[], exclude?: string): CollectionOption[] {
  const out: CollectionOption[] = [];
  const walk = (parentId: string | null, depth: number, prefix: string) => {
    const kids = collections.filter((c) => c.parentId === parentId).sort((a, b) => {
      if (parentId === null && a.kind !== b.kind) return a.kind === "course" ? -1 : 1;
      return byPosition(a, b);
    });
    for (const c of kids) {
      if (c.id === exclude) continue;
      const label = prefix ? `${prefix} / ${c.name}` : c.name;
      out.push({ value: c.id, label, depth, collection: c });
      walk(c.id, depth + 1, label);
    }
  };
  walk(null, 0, "");
  return out;
}
