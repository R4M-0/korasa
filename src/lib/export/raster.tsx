"use client";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { getFontEmbedCSS, toCanvas } from "html-to-image";
import { StaticPage } from "@/components/editor/render/static-page";
import { pageSize } from "@/lib/editor/scene";
import type { ExportablePage } from "@/lib/export/files";

const PAPER_COLOR = "#fffefb";

/** Wait until every image inside `root` has loaded (or failed) and decoded. */
async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map(async (img) => {
      if (!img.complete) {
        await new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        });
      }
      try {
        await img.decode();
      } catch {
        // Broken images fall back to the "Image unavailable" placeholder.
      }
    }),
  );
}

/**
 * Renders pages offscreen one at a time and rasterises them. Font embedding CSS
 * is computed once per session because it is the expensive part.
 */
export class PageRasterizer {
  private container: HTMLDivElement;
  private fontCss: Promise<string> | null = null;

  constructor() {
    this.container = document.createElement("div");
    this.container.setAttribute("aria-hidden", "true");
    Object.assign(this.container.style, {
      position: "fixed",
      left: "-100000px",
      top: "0",
      pointerEvents: "none",
      // Keep it laid out (not display:none) so fonts/images resolve.
      contain: "layout paint",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(this.container);
  }

  async render(page: ExportablePage, pixelRatio: number): Promise<HTMLCanvasElement> {
    const host = document.createElement("div");
    this.container.appendChild(host);
    const root = createRoot(host);
    try {
      flushSync(() => {
        root.render(
          <StaticPage scene={page.scene} background={page.background} orientation={page.orientation} />,
        );
      });
      const node = host.firstElementChild as HTMLElement | null;
      if (!node) throw new Error("Page failed to render");
      await document.fonts.ready;
      await waitForImages(node);
      // Let layout settle (auto-height text, fonts swapping in).
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      this.fontCss ??= getFontEmbedCSS(node).catch(() => "");
      const fontEmbedCSS = await this.fontCss;
      const { w, h } = pageSize(page.orientation);
      return await toCanvas(node, {
        width: w,
        height: h,
        canvasWidth: w,
        canvasHeight: h,
        pixelRatio,
        backgroundColor: PAPER_COLOR,
        fontEmbedCSS,
        cacheBust: false,
      });
    } finally {
      root.unmount();
      host.remove();
    }
  }

  dispose() {
    this.container.remove();
  }
}

export async function renderPageToCanvas(page: ExportablePage, pixelRatio: number) {
  const r = new PageRasterizer();
  try {
    return await r.render(page, pixelRatio);
  } finally {
    r.dispose();
  }
}
