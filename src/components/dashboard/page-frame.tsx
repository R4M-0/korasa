import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Scroll container + centred column for non-editor pages. */
export function PageFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="h-full overflow-y-auto [scrollbar-gutter:stable]">
      <div className={cn("mx-auto w-full max-w-6xl px-6 pt-10 pb-16 md:px-10", className)}>{children}</div>
    </div>
  );
}

export function PageTitle({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-[13px] text-muted-foreground">{eyebrow}</div>}
        <h1 className="font-display text-4xl leading-[1.05] tracking-tight md:text-[44px]">{title}</h1>
        {description && <div className="mt-2 max-w-2xl text-[15px] text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SectionHeading({ title, action, count }: { title: string; action?: ReactNode; count?: number }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 border-b border-border/70 pb-2">
      <h2 className="flex items-baseline gap-2 text-[13px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        {title}
        {count !== undefined && <span className="font-normal tracking-normal text-muted-foreground/70">{count}</span>}
      </h2>
      {action}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
