import { pageSize, type Orientation } from "@/lib/editor/scene";
import type { Box } from "@/lib/editor/geometry";
import type { ProjectViewMode } from "@/types";

/** Vertical gap between stacked pages (world units, includes the title strip). */
export const PAGE_GAP = 72;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

export interface LayoutPage {
  id: string;
  orientation: Orientation;
  posX: number | null;
  posY: number | null;
}

/** World-space boxes of each visible page for the given view mode. */
export function computeLayout(
  pages: LayoutPage[],
  mode: ProjectViewMode,
  activePageId: string | null,
): Map<string, Box> {
  const out = new Map<string, Box>();
  if (mode === "single") {
    const p = pages.find((pg) => pg.id === activePageId) ?? pages[0];
    if (p) {
      const { w, h } = pageSize(p.orientation);
      out.set(p.id, { x: -w / 2, y: 0, w, h });
    }
    return out;
  }
  let y = 0;
  for (const p of pages) {
    const { w, h } = pageSize(p.orientation);
    const stacked = { x: -w / 2, y, w, h };
    y += h + PAGE_GAP;
    if (mode === "free" && p.posX !== null && p.posY !== null) {
      out.set(p.id, { x: p.posX, y: p.posY, w, h });
    } else {
      out.set(p.id, stacked);
    }
  }
  return out;
}

export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Viewport that fits `box` into a `vw × vh` screen area with padding. */
export function fitBox(box: Box, vw: number, vh: number, padding = 48, maxZoom = 1.5): Viewport {
  const zoom = clampZoom(
    Math.min((vw - padding * 2) / Math.max(box.w, 1), (vh - padding * 2) / Math.max(box.h, 1), maxZoom),
  );
  return {
    zoom,
    panX: vw / 2 - (box.x + box.w / 2) * zoom,
    panY: vh / 2 - (box.y + box.h / 2) * zoom,
  };
}

/** Viewport showing the top of a page at a comfortable reading width. */
export function fitPageWidth(box: Box, vw: number, padding = 56, maxZoom = 1): Viewport {
  const zoom = clampZoom(Math.min((vw - padding * 2) / box.w, maxZoom));
  return {
    zoom,
    panX: vw / 2 - (box.x + box.w / 2) * zoom,
    panY: 40 - box.y * zoom,
  };
}

/** Zoom by `factor` keeping the screen point (sx, sy) fixed. */
export function zoomAt(v: Viewport, factor: number, sx: number, sy: number): Viewport {
  const zoom = clampZoom(v.zoom * factor);
  const k = zoom / v.zoom;
  return { zoom, panX: sx - (sx - v.panX) * k, panY: sy - (sy - v.panY) * k };
}
