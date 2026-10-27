"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaticPage } from "@/components/editor/render/static-page";
import { api } from "@/lib/api/client";
import { pageSize } from "@/lib/editor/scene";
import type { PageDTO, ProjectDocumentDTO } from "@/types";

/** Pixels per millimetre in CSS (96 dpi). */
const PX_PER_MM = 96 / 25.4;
const SHEET_MM = {
  portrait: { w: 210, h: 297 },
  landscape: { w: 297, h: 210 },
} as const;

/*
 * Print stylesheet. Sheets are exactly A4; landscape sheets use a named page
 * so mixed-orientation projects print correctly. The root layout locks body
 * scrolling for the app shell, so this route unlocks it.
 */
const PRINT_CSS = `
html, body { height: auto !important; overflow: auto !important; }
@page { size: A4 portrait; margin: 0; }
@page landscape { size: A4 landscape; margin: 0; }
.print-sheet {
  position: relative;
  overflow: hidden;
  background: #fffefb;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
  break-inside: avoid;
}
.print-sheet[data-orientation="landscape"] { page: landscape; }
@media screen {
  .print-sheet { box-shadow: var(--paper-shadow); margin: 0 auto 28px; }
}
@media print {
  html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
  .print-chrome { display: none !important; }
  /* Toasters/portals after a landscape sheet would switch back to the default
     named page and force a trailing blank page. */
  body > :not(:has(.print-sheet)) { display: none !important; }
  .print-desk { background: none !important; padding: 0 !important; }
  .print-sheet { margin: 0 !important; box-shadow: none !important; break-after: page; }
  .print-sheet:last-child { break-after: auto; }
}
`;

async function waitForAssets(root: HTMLElement) {
  await document.fonts.ready;
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

function Sheet({ page }: { page: PageDTO }) {
  const mm = SHEET_MM[page.orientation];
  const units = pageSize(page.orientation);
  // Scale page units to the exact physical sheet so nothing clips.
  const scale = (mm.w * PX_PER_MM) / units.w;
  return (
    <section
      className="print-sheet"
      data-orientation={page.orientation}
      aria-label={page.title}
      style={{ width: `${mm.w}mm`, height: `${mm.h}mm` }}
    >
      <StaticPage
        scene={page.scene}
        background={page.background}
        orientation={page.orientation}
        style={{ position: "absolute", left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: "0 0" }}
      />
    </section>
  );
}

export function PrintView({
  projectId,
  pageIds,
  autoPrint,
}: {
  projectId: string;
  pageIds: string[];
  autoPrint: boolean;
}) {
  const [doc, setDoc] = useState<ProjectDocumentDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const sheetsRef = useRef<HTMLDivElement>(null);
  const printedRef = useRef(false);
  const pageKey = pageIds.join(",");

  useEffect(() => {
    let cancelled = false;
    api
      .project(projectId)
      .then((d) => {
        if (!cancelled) setDoc(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const wanted = pageKey ? new Set(pageKey.split(",")) : null;
  const pages = doc ? doc.pages.filter((p) => !wanted || wanted.has(p.id)) : [];

  useEffect(() => {
    if (doc) document.title = doc.project.name;
  }, [doc]);

  useEffect(() => {
    if (!doc || !sheetsRef.current) return;
    let cancelled = false;
    waitForAssets(sheetsRef.current).then(() => {
      if (cancelled) return;
      setReady(true);
      if (autoPrint && !printedRef.current && pages.length) {
        printedRef.current = true;
        window.print();
      }
    });
    return () => {
      cancelled = true;
    };
    // pages derives from doc + pageKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, pageKey, autoPrint]);

  return (
    <div className="print-desk desk-surface min-h-screen pb-10">
      <style>{PRINT_CSS}</style>
      <header className="print-chrome sticky top-0 z-10 mb-8 flex items-center gap-3 border-b bg-background/90 px-4 py-2.5 backdrop-blur">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{doc?.project.name ?? "Preparing export…"}</div>
          <div className="text-xs text-muted-foreground">
            {doc
              ? `${pages.length} ${pages.length === 1 ? "page" : "pages"} · A4 · choose “Save as PDF” as the destination`
              : "Loading pages"}
          </div>
        </div>
        <Button onClick={() => window.print()} disabled={!ready || !pages.length}>
          {ready ? <Printer /> : <Loader2 className="animate-spin" />}
          Print / Save as PDF
        </Button>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={() => window.close()}>
          <X />
        </Button>
      </header>

      {error ? (
        <div className="print-chrome mx-auto max-w-md rounded-lg border bg-card p-6 text-center">
          <p className="font-medium">Couldn’t load this project</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
      ) : !doc ? (
        <div className="print-chrome flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading pages…
        </div>
      ) : pages.length === 0 ? (
        <div className="print-chrome mx-auto max-w-md rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          No pages to print.
        </div>
      ) : (
        <div ref={sheetsRef}>
          {pages.map((p) => (
            <Sheet key={p.id} page={p} />
          ))}
        </div>
      )}
    </div>
  );
}
