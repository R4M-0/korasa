"use client";

import { Maximize, Minus, Plus, ScanSearch } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { IconButton, ToolbarSurface } from "@/components/editor/toolbar/primitives";
import { kbd } from "@/lib/editor/platform";
import { editor, useEditorStore } from "@/stores/editor-store";

export function ZoomControls() {
  const zoom = useEditorStore((s) => s.viewport.zoom);
  return (
    <ToolbarSurface className="pointer-events-auto">
      <IconButton label="Zoom out" shortcut={kbd("Mod+-")} side="top" size="sm" onClick={() => editor.zoomBy(1 / 1.2)}>
        <Minus />
      </IconButton>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="h-7 min-w-14 rounded-md px-1.5 text-xs font-medium tabular-nums text-foreground/80 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Zoom options"
        >
          {Math.round(zoom * 100)}%
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="w-52">
          {[0.5, 0.75, 1, 1.5, 2].map((z) => (
            <DropdownMenuItem key={z} onClick={() => editor.setZoom(z)}>
              {z * 100}%{z === 1 && <DropdownMenuShortcut>{kbd("Mod+0")}</DropdownMenuShortcut>}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => editor.zoomToPage(undefined, "width")}>Fit page width</DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.zoomToPage()}>
            Fit page <DropdownMenuShortcut>⇧2</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.fitWorkspace()}>
            Fit all pages <DropdownMenuShortcut>⇧1</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButton label="Zoom in" shortcut={kbd("Mod+=")} side="top" size="sm" onClick={() => editor.zoomBy(1.2)}>
        <Plus />
      </IconButton>
      <IconButton label="Fit page" shortcut="⇧2" side="top" size="sm" onClick={() => editor.zoomToPage()}>
        <ScanSearch />
      </IconButton>
      <IconButton label="Fit all pages" shortcut="⇧1" side="top" size="sm" onClick={() => editor.fitWorkspace()}>
        <Maximize />
      </IconButton>
    </ToolbarSurface>
  );
}
