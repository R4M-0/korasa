"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, FilePlus2, X } from "lucide-react";
import { tourSteps } from "@/components/tour/tours";
import { Button } from "@/components/ui/button";
import { useDialogs } from "@/hooks/use-dialogs";
import { useHydrated } from "@/hooks/use-hydrated";
import { useModKey } from "@/hooks/use-mod-key";
import { cn } from "@/lib/utils";
import { useTourStore } from "@/stores/tour-store";
import { useUiStore } from "@/stores/ui-store";

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 6;
const GAP = 14;
const CARD_W = 340;

function sameRect(a: Rect | null, b: Rect | null) {
  return a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);
}

/** Follow an element's on-screen box (it may move, resize or appear later). */
function useTargetRect(selector: string | undefined, key: string) {
  const [tracked, setTracked] = useState<{ key: string; rect: Rect | null }>({ key: "", rect: null });
  useEffect(() => {
    if (!selector) return;
    let raf = 0;
    let last: Rect | null = null;
    let first = true;
    const tick = () => {
      const el = document.querySelector(selector);
      const r = el?.getBoundingClientRect();
      const next = r && r.width > 0 && r.height > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      if (first || !sameRect(next, last)) {
        first = false;
        last = next;
        setTracked({ key, rect: next });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selector, key]);
  // Ignore a measurement left over from the previous step.
  return selector && tracked.key === key ? tracked.rect : null;
}

/** Place the card beside the target, preferring right, then below, left, above. */
function placeCard(rect: Rect | null, cardH: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(CARD_W, vw - 32);
  if (!rect) return { left: (vw - w) / 2, top: Math.max(16, (vh - cardH) / 2), width: w };
  const clampTop = (t: number) => Math.min(Math.max(16, t), vh - cardH - 16);
  const clampLeft = (l: number) => Math.min(Math.max(16, l), vw - w - 16);
  const right = rect.left + rect.width + PAD + GAP;
  if (right + w <= vw - 16) return { left: right, top: clampTop(rect.top - PAD), width: w };
  const below = rect.top + rect.height + PAD + GAP;
  if (below + cardH <= vh - 16) return { left: clampLeft(rect.left), top: below, width: w };
  const left = rect.left - PAD - GAP - w;
  if (left >= 16) return { left, top: clampTop(rect.top - PAD), width: w };
  return { left: clampLeft(rect.left), top: Math.max(16, rect.top - PAD - GAP - cardH), width: w };
}

/**
 * Coach-mark tour: dims the app, spotlights one element per step and explains
 * it. Always skippable (Skip button or Esc); finishing or skipping marks the
 * tour as seen so it never auto-starts again.
 */
export function TourHost() {
  const hydrated = useHydrated();
  const active = useTourStore((s) => s.active);
  const stepIndex = useTourStore((s) => s.step);
  const go = useTourStore((s) => s.go);
  const end = useTourStore((s) => s.end);
  const mod = useModKey();
  const openDialog = useDialogs((s) => s.open);
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [cardH, setCardH] = useState(220);

  const steps = active
    ? tourSteps(active, mod, { revealSidebar: () => useUiStore.getState().setSidebarCollapsed(false) })
    : [];
  const step = steps[stepIndex];
  const rect = useTargetRect(step?.target, `${active}:${stepIndex}`);
  const isLast = stepIndex === steps.length - 1;

  useEffect(() => {
    step?.onEnter?.();
    // onEnter belongs to the step; run it once per step change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stepIndex]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [active, stepIndex, rect]);

  useEffect(() => {
    if (active) primaryRef.current?.focus();
  }, [active, stepIndex]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        end({ skipped: true });
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        if (isLast) end();
        else go(stepIndex + 1);
      } else if (e.key === "ArrowLeft" && stepIndex > 0) {
        e.preventDefault();
        e.stopPropagation();
        go(stepIndex - 1);
      }
    };
    // Capture phase so editor/app shortcuts never see these keys during the tour.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, stepIndex, isLast, go, end]);

  if (!hydrated || !active || !step) return null;

  const pos = placeCard(rect, cardH);
  const centered = !rect;

  return createPortal(
    <div className="fixed inset-0 z-[200]" data-ui>
      {/* Backdrop + spotlight. The cut-out is a huge box-shadow around the target. */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-[10px] ring-2 ring-primary/70 transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgb(12 16 28 / 0.55)",
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-[rgb(12_16_28/0.55)] backdrop-blur-[2px]" />
      )}
      {/* Swallow clicks on the app underneath while the tour is open. */}
      <div className="fixed inset-0" onMouseDown={(e) => e.preventDefault()} />

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "fixed rounded-xl border bg-popover p-5 text-popover-foreground shadow-[0_24px_60px_-20px_rgb(0_0_0/0.55)] transition-all duration-300 ease-out motion-reduce:transition-none",
          centered && "p-6",
        )}
        style={{ top: pos.top, left: pos.left, width: centered ? Math.min(420, window.innerWidth - 32) : pos.width }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => end({ skipped: true })}
          aria-label="Skip the tour"
          className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        {centered && stepIndex === 0 && active === "welcome" && (
          // eslint-disable-next-line @next/next/no-img-element -- static brand asset
          <img src="/logo.png" alt="" className="mb-4 size-16 -rotate-3 drop-shadow-md" />
        )}
        <p className="text-[11px] font-medium tracking-wider text-primary uppercase">
          {active === "welcome" ? "Welcome" : "The editor"} · {stepIndex + 1} of {steps.length}
        </p>
        <h2 id={titleId} className={cn("mt-1 pr-6 font-display leading-tight", centered ? "text-3xl" : "text-2xl")}>
          {step.title}
        </h2>
        <div className="mt-2 text-[14px] leading-relaxed text-muted-foreground [&_b]:font-semibold [&_b]:text-foreground">
          {step.body}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <div className="mr-auto flex gap-1" aria-hidden>
            {steps.map((_, i) => (
              <span key={i} className={cn("h-1.5 rounded-full transition-all", i === stepIndex ? "w-4 bg-primary" : "w-1.5 bg-border")} />
            ))}
          </div>
          {stepIndex === 0 ? (
            <Button variant="ghost" size="sm" onClick={() => end({ skipped: true })}>
              Skip
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => go(stepIndex - 1)} aria-label="Previous step">
              <ArrowLeft /> Back
            </Button>
          )}
          {isLast && active === "welcome" ? (
            <>
              <Button variant="outline" size="sm" onClick={() => end()}>
                Explore
              </Button>
              <Button
                ref={primaryRef}
                size="sm"
                onClick={() => {
                  end();
                  openDialog({ kind: "create-project", collectionId: null });
                }}
              >
                <FilePlus2 /> First project
              </Button>
            </>
          ) : (
            <Button ref={primaryRef} size="sm" onClick={() => (isLast ? end() : go(stepIndex + 1))}>
              {stepIndex === 0 && active === "welcome" ? "Show me around" : isLast ? "Done" : "Next"}
              {!isLast && <ArrowRight />}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
