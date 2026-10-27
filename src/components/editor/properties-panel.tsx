"use client";

import { useState } from "react";
import { RectangleHorizontal, RectangleVertical, X } from "lucide-react";
import { BACKGROUND_LABELS, PaperBackground } from "@/components/editor/render/paper-background";
import { Slider } from "@/components/ui/slider";
import { objectBounds, isLinear } from "@/lib/editor/geometry";
import { objectLabel, selectionBounds } from "@/lib/editor/objects";
import { BACKGROUNDS, pageSize } from "@/lib/editor/scene";
import { cn } from "@/lib/utils";
import { editor, useEditorStore, useSelectedObjects } from "@/stores/editor-store";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b px-4 py-3.5 last:border-b-0">
      <h3 className="mb-2.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

type NumberFieldProps = { label: string; value: number; onCommit: (v: number) => void; step?: number; suffix?: string };

/** Numeric field that commits on blur/Enter (one undo step per edit). */
function NumberField(props: NumberFieldProps) {
  // Remount when the external value changes so the draft resets.
  return <NumberFieldInner key={Math.round(props.value * 10)} {...props} />;
}

function NumberFieldInner({ label, value, onCommit, step = 1, suffix }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(Math.round(value * 10) / 10));
  const commit = () => {
    const v = Number(draft);
    if (Number.isFinite(v) && v !== Math.round(value * 10) / 10) onCommit(v);
    else setDraft(String(Math.round(value * 10) / 10));
  };
  return (
    <label className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-xs focus-within:ring-2 focus-within:ring-ring/40">
      <span className="w-3 shrink-0 text-muted-foreground">{label}</span>
      <input
        inputMode="decimal"
        value={draft}
        step={step}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const v = (Number(draft) || 0) + (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
            setDraft(String(v));
            onCommit(v);
          }
        }}
        className="w-full min-w-0 bg-transparent tabular-nums outline-none"
      />
      {suffix && <span className="text-muted-foreground">{suffix}</span>}
    </label>
  );
}

function ObjectProperties() {
  const objs = useSelectedObjects();
  const b = selectionBounds(objs)!;
  const single = objs.length === 1 ? objs[0] : null;
  const box = single && !isLinear(single) ? single : b;
  const opacity = objs.reduce((m, o) => Math.max(m, o.opacity), 0);

  const setBox = (patch: { x?: number; y?: number; w?: number; h?: number }) => {
    if (single && !isLinear(single)) {
      editor.updateSelected((o) => ({ ...o, ...patch, w: Math.max(2, patch.w ?? o.w), h: Math.max(2, patch.h ?? o.h) }));
    } else {
      // Move the whole selection.
      const dx = (patch.x ?? b.x) - b.x;
      const dy = (patch.y ?? b.y) - b.y;
      editor.updateSelected((o) => ({ ...o, x: o.x + dx, y: o.y + dy }));
    }
  };

  return (
    <>
      <Section title={single ? objectLabel(single) : `${objs.length} objects`}>
        <div className="grid grid-cols-2 gap-1.5">
          <NumberField label="X" value={box.x} onCommit={(x) => setBox({ x })} />
          <NumberField label="Y" value={box.y} onCommit={(y) => setBox({ y })} />
          {single && !isLinear(single) && (
            <>
              <NumberField label="W" value={single.w} onCommit={(w) => setBox({ w })} />
              <NumberField label="H" value={single.type === "text" && single.autoHeight ? objectBounds(single).h : single.h} onCommit={(h) => setBox({ h })} />
              <NumberField
                label="↻"
                value={single.rotation}
                suffix="°"
                onCommit={(r) => editor.updateSelected((o) => ({ ...o, rotation: ((((r + 180) % 360) + 360) % 360) - 180 }))}
              />
            </>
          )}
        </div>
      </Section>
      <Section title="Opacity">
        <div className="flex items-center gap-3">
          <Slider
            key={`${objs.map((o) => o.id).join()}:${opacity}`}
            defaultValue={[Math.round(opacity * 100)]}
            min={5}
            max={100}
            step={5}
            onValueCommitted={(v) => {
              const n = Array.isArray(v) ? v[0] : v;
              editor.updateSelected((o) => ({ ...o, opacity: n / 100 }));
            }}
            aria-label="Opacity"
          />
          <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{Math.round(opacity * 100)}%</span>
        </div>
      </Section>
      {single?.type === "text" && (
        <Section title="Text box">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={single.autoHeight}
              onChange={(e) => editor.updateSelected((o) => (o.type === "text" ? { ...o, autoHeight: e.target.checked } : o))}
            />
            Grow with content
          </label>
        </Section>
      )}
      {single && (single.type === "rect" || single.type === "ellipse" || single.type === "diamond") && (
        <Section title="Shape">
          <div className="grid grid-cols-2 gap-1.5">
            {single.type === "rect" && (
              <NumberField label="r" value={single.radius} onCommit={(radius) => editor.updateSelected((o) => (o.type === "rect" ? { ...o, radius: Math.max(0, radius) } : o))} />
            )}
            <NumberField label="Aa" value={single.labelSize} onCommit={(labelSize) => editor.updateSelected((o) => ("labelSize" in o ? { ...o, labelSize: Math.min(120, Math.max(6, labelSize)) } : o))} />
          </div>
        </Section>
      )}
    </>
  );
}

function PageProperties() {
  const pageId = useEditorStore((s) => s.activePageId);
  const page = useEditorStore((s) => (s.activePageId ? s.pages[s.activePageId] : null));
  if (!page || !pageId) return null;
  const { w, h } = pageSize(page.orientation);
  return (
    <>
      <Section title="Page">
        <input
          key={page.id + page.title}
          defaultValue={page.title}
          aria-label="Page title"
          maxLength={120}
          className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          onBlur={(e) => {
            const t = e.target.value.trim();
            if (t && t !== page.title) editor.setPageProps(pageId, { title: t });
          }}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          A4 · {page.orientation} · {page.scene.objects.length} object{page.scene.objects.length === 1 ? "" : "s"}
        </p>
      </Section>
      <Section title="Paper">
        <div className="grid grid-cols-3 gap-2">
          {BACKGROUNDS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => editor.setPageProps(pageId, { background: b })}
              aria-pressed={page.background === b}
              className={cn(
                "group flex flex-col items-center gap-1 rounded-md p-1 text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                page.background === b ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn("relative block h-14 w-10 overflow-hidden rounded-[2px] bg-white ring-1", page.background === b ? "ring-2 ring-primary" : "ring-black/15")}
              >
                <span className="absolute top-0 left-0 origin-top-left" style={{ transform: `scale(${40 / 794 * 3})` }}>
                  <span className="relative block" style={{ width: 794 / 3, height: 1123 / 3 }}>
                    <PaperBackground background={b} w={794 / 3} h={1123 / 3} />
                  </span>
                </span>
              </span>
              {BACKGROUND_LABELS[b]}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Orientation">
        <div className="grid grid-cols-2 gap-1.5">
          {(["portrait", "landscape"] as const).map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={page.orientation === o}
              onClick={() => editor.setPageProps(pageId, { orientation: o })}
              className={cn(
                "flex h-9 items-center justify-center gap-1.5 rounded-md border text-xs capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                page.orientation === o ? "border-primary/50 bg-primary/8 text-primary" : "hover:bg-accent",
              )}
            >
              {o === "portrait" ? <RectangleVertical className="size-4" /> : <RectangleHorizontal className="size-4" />}
              {o}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground tabular-nums">
          {page.orientation === "portrait" ? "210 × 297 mm" : "297 × 210 mm"} · {w} × {h} px
        </p>
      </Section>
    </>
  );
}

export function PropertiesPanel() {
  const hasSelection = useEditorStore((s) => s.selection.ids.length > 0);
  return (
    <aside data-ui aria-label="Properties" className="flex h-full w-64 shrink-0 flex-col border-l bg-sidebar">
      <div className="flex h-10 items-center justify-between border-b px-4">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{hasSelection ? "Selection" : "Page settings"}</span>
        <button
          type="button"
          onClick={() => editor.togglePanel("properties")}
          aria-label="Close properties"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{hasSelection ? <ObjectProperties /> : <PageProperties />}</div>
    </aside>
  );
}
