"use client";

import { forwardRef } from "react";
import { Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Keep focus (and the text selection) in the editor when clicking chrome. */
export const keepFocus = (e: React.MouseEvent | React.PointerEvent) => e.preventDefault();

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="ml-1.5 rounded border border-current/20 px-1 font-sans text-[10px] opacity-70">{children}</kbd>;
}

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  shortcut?: string;
  active?: boolean;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  size?: "sm" | "md";
}

export function IconButton({ label, shortcut, active, children, className, side = "bottom", size = "md", ...props }: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={label}
        aria-pressed={active}
        onMouseDown={keepFocus}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md text-foreground/80 transition-colors outline-none",
          "hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-35",
          size === "md" ? "size-8 [&_svg]:size-[17px]" : "size-7 [&_svg]:size-4",
          active && "bg-primary/12 text-primary hover:bg-primary/15 hover:text-primary",
          className,
        )}
        {...props}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  );
}

export function ToolbarDivider({ vertical = false }: { vertical?: boolean }) {
  return <div className={cn("shrink-0 bg-border", vertical ? "my-1 h-px w-6" : "mx-1 h-5 w-px")} />;
}

export const ToolbarSurface = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function ToolbarSurface(
  { className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-ui
      className={cn(
        "flex items-center gap-0.5 rounded-xl border bg-popover/95 p-1 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_8px_24px_-10px_rgb(0_0_0/0.25)] backdrop-blur",
        className,
      )}
      {...props}
    />
  );
});

export const INK_COLORS = ["#1f1d1a", "#57534e", "#a8a29e", "#2f4fb0", "#0f766e", "#15803d", "#c2410c", "#be123c", "#7c3aed", "#ca8a04"];
export const FILL_COLORS = ["transparent", "#ffffff", "#f5f5f4", "#dbe4ff", "#ccfbf1", "#dcfce7", "#fef3c7", "#ffedd5", "#fce7f3", "#ede9fe"];
export const HIGHLIGHT_COLORS = ["transparent", "#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#fed7aa", "#e9d5ff"];

function Swatch({ color, selected, onPick }: { color: string; selected: boolean; onPick: () => void }) {
  const transparent = color === "transparent";
  return (
    <button
      type="button"
      aria-label={transparent ? "None" : color}
      onMouseDown={keepFocus}
      onClick={onPick}
      className={cn(
        "relative size-6 rounded-md border border-black/10 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring",
        selected && "ring-2 ring-primary ring-offset-1 ring-offset-popover",
      )}
      style={{
        background: transparent
          ? "repeating-conic-gradient(#e7e5e4 0% 25%, #fff 0% 50%) 50% / 8px 8px"
          : color,
      }}
    >
      {selected && <Check className={cn("absolute inset-0 m-auto size-3.5", transparent || isLight(color) ? "text-black/70" : "text-white")} />}
    </button>
  );
}

function isLight(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const r = n >> 16;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return r * 0.299 + g * 0.587 + b * 0.114 > 186;
}

/** Swatch button that opens a palette + custom colour input. */
export function ColorPicker({
  label,
  value,
  colors,
  onChange,
  icon,
  side = "bottom",
}: {
  label: string;
  value: string;
  colors: string[];
  onChange: (color: string) => void;
  icon?: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const transparent = value === "transparent";
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              aria-label={label}
              onMouseDown={keepFocus}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-md outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          }
        >
          {icon ? (
            <span className="relative flex flex-col items-center [&_svg]:size-4">
              {icon}
              <span className="mt-0.5 h-[3px] w-4 rounded-full border border-black/10" style={{ background: transparent ? "transparent" : value }} />
            </span>
          ) : (
            <span
              className="size-[18px] rounded-full border border-black/15"
              style={{
                background: transparent ? "repeating-conic-gradient(#e7e5e4 0% 25%, #fff 0% 50%) 50% / 6px 6px" : value,
              }}
            />
          )}
        </TooltipTrigger>
        <TooltipContent side={side}>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent side={side} className="w-auto p-2.5" data-ui onMouseDown={keepFocus}>
        <div className="mb-2 text-xs font-medium text-muted-foreground">{label}</div>
        <div className="grid grid-cols-5 gap-1.5">
          {colors.map((c) => (
            <Swatch key={c} color={c} selected={c.toLowerCase() === value.toLowerCase()} onPick={() => onChange(c)} />
          ))}
        </div>
        <label className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="color"
            value={transparent || !/^#[0-9a-f]{6}$/i.test(value) ? "#000000" : value}
            onChange={(e) => onChange(e.target.value)}
            className="h-6 w-8 cursor-pointer rounded border bg-transparent p-0"
          />
          Custom
        </label>
      </PopoverContent>
    </Popover>
  );
}
