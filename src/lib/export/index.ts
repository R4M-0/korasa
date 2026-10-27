"use client";

import { api } from "@/lib/api/client";
import { ensureExtension, fileStem, triggerDownload, type ExportablePage } from "@/lib/export/files";
import { PageRasterizer, renderPageToCanvas } from "@/lib/export/raster";

export type { ExportablePage } from "@/lib/export/files";
export { fileStem } from "@/lib/export/files";

/** A4 in millimetres. */
const A4 = { w: 210, h: 297 };

/**
 * Vector PDF via the browser's print engine. Opens the print route in a new
 * tab, which opens the print dialog ("Save as PDF") once fonts and images load.
 * Text stays selectable and shapes stay vector.
 */
export function printToPdf(projectId: string, pageIds?: string[]): void {
  const params = new URLSearchParams();
  if (pageIds?.length) params.set("pages", pageIds.join(","));
  const qs = params.toString();
  const win = window.open(`/print/${projectId}${qs ? `?${qs}` : ""}`, "_blank");
  if (!win) throw new Error("The print window was blocked. Allow pop-ups for Korasa and try again.");
}

/**
 * Direct .pdf download without a dialog. Each page is rasterised at high
 * resolution (3× ≈ 290 dpi) so text stays sharp, then placed on a true A4
 * page with the correct orientation.
 */
export async function downloadPdf(
  pages: ExportablePage[],
  filename: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (!pages.length) throw new Error("There are no pages to export");
  const { jsPDF } = await import("jspdf");
  const rasterizer = new PageRasterizer();
  try {
    let pdf: InstanceType<typeof jsPDF> | null = null;
    onProgress?.(0, pages.length);
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const landscape = page.orientation === "landscape";
      const w = landscape ? A4.h : A4.w;
      const h = landscape ? A4.w : A4.h;
      const canvas = await rasterizer.render(page, 3);
      // JPEG keeps multi-page files small; quality 0.92 is visually lossless for notes.
      const data = canvas.toDataURL("image/jpeg", 0.92);
      if (!pdf) {
        pdf = new jsPDF({ unit: "mm", format: "a4", orientation: landscape ? "landscape" : "portrait", compress: true });
      } else {
        pdf.addPage("a4", landscape ? "landscape" : "portrait");
      }
      pdf.addImage(data, "JPEG", 0, 0, w, h, undefined, "FAST");
      canvas.width = canvas.height = 0; // release memory early
      onProgress?.(i + 1, pages.length);
    }
    pdf!.setProperties({ title: filename.replace(/\.pdf$/i, ""), creator: "Korasa" });
    triggerDownload(pdf!.output("blob"), ensureExtension(fileStem(filename.replace(/\.pdf$/i, "")), "pdf"));
  } finally {
    rasterizer.dispose();
  }
}

/** PNG of one page. */
export async function downloadPagePng(page: ExportablePage, filename: string, pixelRatio = 2): Promise<void> {
  const canvas = await renderPageToCanvas(page, pixelRatio);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not encode the PNG");
  triggerDownload(blob, ensureExtension(fileStem(filename.replace(/\.png$/i, "")), "png"));
}

/** Download the portable project file (editable objects + embedded images). */
export async function downloadProjectJson(projectId: string, projectName: string): Promise<void> {
  const res = await fetch(api.exportProjectUrl(projectId));
  if (!res.ok) {
    let message = `Export failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  const blob = await res.blob();
  triggerDownload(blob, `${fileStem(projectName)}.korasa.json`);
}
