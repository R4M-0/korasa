"use client";

import { Check } from "lucide-react";
import { ENTITY_COLORS, ENTITY_ICONS } from "@/components/common/entity-icon";
import { cn } from "@/lib/utils";

export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string | null;
  color: string | null;
  onChange: (icon: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Icon" className="grid grid-cols-[repeat(auto-fill,minmax(2rem,1fr))] gap-1">
      {Object.entries(ENTITY_ICONS).map(([key, Icon]) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={key}
            title={key}
            onClick={() => onChange(key)}
            className={cn(
              "flex h-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
              active && "border-border bg-card text-foreground shadow-xs",
            )}
          >
            <Icon className="size-4" style={active && color ? { color } : undefined} />
          </button>
        );
      })}
    </div>
  );
}

export function ColorPicker({ value, onChange }: { value: string | null; onChange: (c: string | null) => void }) {
  return (
    <div role="radiogroup" aria-label="Color" className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label="No color"
        onClick={() => onChange(null)}
        className={cn(
          "relative size-6 rounded-full border border-dashed border-muted-foreground/50 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          value === null && "ring-2 ring-foreground/30 ring-offset-1 ring-offset-background",
        )}
      />
      {ENTITY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cn(
            "flex size-6 items-center justify-center rounded-full transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
            value === c && "ring-2 ring-foreground/30 ring-offset-1 ring-offset-background",
          )}
          style={{ background: c }}
        >
          {value === c && <Check className="size-3.5 text-white" />}
        </button>
      ))}
    </div>
  );
}
