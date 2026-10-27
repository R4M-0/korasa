"use client";

import { ArrowDownUp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type SortKey = "updated" | "created" | "name";

const LABELS: Record<SortKey, string> = {
  updated: "Recently updated",
  created: "Date created",
  name: "Name",
};

export function sortItems<T extends { name: string; updatedAt: string; createdAt: string }>(items: T[], key: SortKey) {
  const copy = [...items];
  if (key === "name") return copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  if (key === "created") return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function SortMenu({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none aria-expanded:bg-accent">
        <ArrowDownUp className="size-3.5" />
        {LABELS[value]}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as SortKey)}>
          {(Object.keys(LABELS) as SortKey[]).map((k) => (
            <DropdownMenuRadioItem key={k} value={k}>
              {LABELS[k]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
