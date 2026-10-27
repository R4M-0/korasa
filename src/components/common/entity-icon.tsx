import {
  Atom,
  BookOpen,
  Binary,
  Brain,
  Calculator,
  Code2,
  FileText,
  FlaskConical,
  Folder,
  Globe,
  GraduationCap,
  Landmark,
  Languages,
  Lightbulb,
  Music,
  Network,
  NotebookPen,
  Palette,
  Pencil,
  Sigma,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** Icons selectable for courses, folders and projects (stored by key). */
export const ENTITY_ICONS: Record<string, LucideIcon> = {
  notebook: NotebookPen,
  book: BookOpen,
  graduation: GraduationCap,
  folder: Folder,
  file: FileText,
  binary: Binary,
  code: Code2,
  network: Network,
  globe: Globe,
  sigma: Sigma,
  calculator: Calculator,
  atom: Atom,
  flask: FlaskConical,
  brain: Brain,
  languages: Languages,
  landmark: Landmark,
  palette: Palette,
  music: Music,
  lightbulb: Lightbulb,
  pencil: Pencil,
  target: Target,
  trophy: Trophy,
  sparkles: Sparkles,
};

/** Restrained palette for entity colours (ink-like, readable on paper). */
export const ENTITY_COLORS = [
  "#2f4fb0",
  "#0f766e",
  "#15803d",
  "#b45309",
  "#c2410c",
  "#be123c",
  "#7c3aed",
  "#475569",
];

export function EntityIcon({
  name,
  fallback = "file",
  color,
  className,
}: {
  name: string | null | undefined;
  fallback?: string;
  color?: string | null;
  className?: string;
}) {
  const Icon = (name && ENTITY_ICONS[name]) || ENTITY_ICONS[fallback] || FileText;
  return <Icon className={cn("size-4 shrink-0", className)} style={color ? { color } : undefined} />;
}
