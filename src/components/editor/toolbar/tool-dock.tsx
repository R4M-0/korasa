"use client";

import {
  ArrowUpRight,
  Circle,
  Diamond,
  Eraser,
  Hand,
  Highlighter,
  ImagePlus,
  Lock,
  LockOpen,
  Minus,
  MousePointer2,
  PenLine,
  Square,
  Type,
} from "lucide-react";
import { IconButton, ToolbarDivider, ToolbarSurface } from "@/components/editor/toolbar/primitives";
import { insertImages, pickImages } from "@/lib/editor/images";
import type { Tool } from "@/lib/editor/objects";
import { editor, useEditorStore } from "@/stores/editor-store";

const GROUPS: { tool: Tool; label: string; key: string; icon: React.ReactNode }[][] = [
  [
    { tool: "select", label: "Select", key: "V", icon: <MousePointer2 /> },
    { tool: "hand", label: "Pan", key: "H / Space", icon: <Hand /> },
  ],
  [{ tool: "text", label: "Text", key: "T", icon: <Type /> }],
  [
    { tool: "pen", label: "Pen", key: "P", icon: <PenLine /> },
    { tool: "highlighter", label: "Highlighter", key: "M", icon: <Highlighter /> },
    { tool: "eraser", label: "Eraser", key: "E", icon: <Eraser /> },
  ],
  [
    { tool: "rect", label: "Rectangle", key: "R", icon: <Square /> },
    { tool: "ellipse", label: "Ellipse", key: "O", icon: <Circle /> },
    { tool: "diamond", label: "Diamond", key: "D", icon: <Diamond /> },
    { tool: "arrow", label: "Arrow / connector", key: "A", icon: <ArrowUpRight /> },
    { tool: "line", label: "Line", key: "L", icon: <Minus className="-rotate-45" /> },
  ],
];

export function ToolDock() {
  const tool = useEditorStore((s) => s.tool);
  const locked = useEditorStore((s) => s.toolLocked);
  return (
    <ToolbarSurface role="toolbar" aria-label="Tools" className="pointer-events-auto">
      {GROUPS.map((group, i) => (
        <div key={i} className="flex items-center gap-0.5">
          {i > 0 && <ToolbarDivider />}
          {group.map((t) => (
            <IconButton key={t.tool} label={t.label} shortcut={t.key} active={tool === t.tool} side="top" onClick={() => editor.setTool(t.tool)}>
              {t.icon}
            </IconButton>
          ))}
        </div>
      ))}
      <ToolbarDivider />
      <IconButton
        label="Insert image"
        shortcut="I"
        side="top"
        onClick={() => {
          const pageId = useEditorStore.getState().activePageId;
          if (pageId) pickImages((files) => void insertImages(files, pageId));
        }}
      >
        <ImagePlus />
      </IconButton>
      <IconButton
        label={locked ? "Keep tool active: on" : "Keep tool active after drawing"}
        side="top"
        active={locked}
        onClick={() => editor.toggleToolLock()}
      >
        {locked ? <Lock /> : <LockOpen />}
      </IconButton>
    </ToolbarSurface>
  );
}
