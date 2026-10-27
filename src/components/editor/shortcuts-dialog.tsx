"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { kbd } from "@/lib/editor/platform";

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Tools",
    items: [
      ["Select", "V"],
      ["Pan", "H  or hold Space"],
      ["Text", "T"],
      ["Pen", "P"],
      ["Highlighter", "M"],
      ["Eraser", "E"],
      ["Rectangle / Ellipse / Diamond", "R / O / D"],
      ["Arrow / Line", "A / L"],
      ["Insert image", "I"],
    ],
  },
  {
    title: "Editing",
    items: [
      ["Undo / Redo", `${kbd("Mod+Z")} / ${kbd("Mod+Shift+Z")}`],
      ["Save now", kbd("Mod+S")],
      ["Duplicate", kbd("Mod+D")],
      ["Delete", "Delete / Backspace"],
      ["Select all on page", kbd("Mod+A")],
      ["Copy / Cut / Paste", `${kbd("Mod+C")} / ${kbd("Mod+X")} / ${kbd("Mod+V")}`],
      ["Group / Ungroup", `${kbd("Mod+G")} / ${kbd("Mod+Shift+G")}`],
      ["Forward / Backward", `${kbd("Mod+]")} / ${kbd("Mod+[")}`],
      ["Edit text or label", "Enter / double-click"],
      ["Nudge", "Arrow keys (Shift ×10)"],
      ["Duplicate while dragging", "Alt + drag"],
      ["Constrain / snap", "Shift"],
      ["Exit tool / clear selection", "Esc"],
    ],
  },
  {
    title: "View",
    items: [
      ["Zoom", `${kbd("Mod")} + scroll, ${kbd("Mod+=")} / ${kbd("Mod+-")}`],
      ["Zoom to 100%", kbd("Mod+0")],
      ["Fit page / all pages", "Shift+2 / Shift+1"],
      ["Previous / next page", "Page Up / Page Down"],
      ["Toggle sidebar", kbd("Mod+\\")],
      ["Command menu", kbd("Mod+K")],
    ],
  },
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Keyboard shortcuts</DialogTitle>
          <DialogDescription>Shortcuts pause while you type in a text box — except save.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.title} className={g.title === "Editing" ? "sm:row-span-2" : undefined}>
              <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">{g.title}</h3>
              <dl className="divide-y">
                {g.items.map(([label, keys]) => (
                  <div key={label} className="flex items-center justify-between gap-4 py-1.5 text-sm">
                    <dt>{label}</dt>
                    <dd className="text-right font-mono text-xs text-muted-foreground">{keys}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
