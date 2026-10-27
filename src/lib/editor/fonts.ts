import type { FontFamily } from "@/lib/editor/scene";

export const FONT_STACKS: Record<FontFamily, string> = {
  sans: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
  serif: "var(--font-serif), ui-serif, Georgia, serif",
  hand: "var(--font-hand), 'Comic Sans MS', cursive",
  mono: "var(--font-mono), ui-monospace, monospace",
};

export const FONT_LABELS: Record<FontFamily, string> = {
  sans: "Sans",
  serif: "Serif",
  hand: "Handwritten",
  mono: "Mono",
};
