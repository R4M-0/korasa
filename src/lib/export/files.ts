import type { Orientation, PageBackground, Scene } from "@/lib/editor/scene";

export interface ExportablePage {
  id: string;
  title: string;
  scene: Scene;
  background: PageBackground;
  orientation: Orientation;
}

/** Turn an arbitrary name into a safe file stem (no extension). */
export function fileStem(name: string): string {
  const stem = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 80);
  return stem || "korasa";
}

export function ensureExtension(filename: string, ext: string) {
  return filename.toLowerCase().endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
}

/** Trigger a browser download for a Blob or URL. */
export function triggerDownload(source: Blob | string, filename: string) {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof source !== "string") setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
