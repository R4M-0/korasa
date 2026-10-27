"use client";

import { toast } from "sonner";
import { api } from "@/lib/api/client";
import type { Point } from "@/lib/editor/geometry";
import { createImage } from "@/lib/editor/objects";
import { pageSize, type ImageObject } from "@/lib/editor/scene";
import { editor, useEditorStore } from "@/stores/editor-store";

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/bmp", "image/svg+xml"];
const MAX_BYTES = 25 * 1024 * 1024;

export function isSupportedImage(file: File | Blob) {
  return ACCEPTED_IMAGE_TYPES.includes(file.type);
}

async function imageSize(file: Blob): Promise<{ w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { w: img.naturalWidth || 400, h: img.naturalHeight || 300 };
  } catch {
    throw new Error("This image could not be decoded");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Upload images and place them on a page. Each image becomes its own
 * editable object referencing an attachment — never inlined into the scene.
 */
export async function insertImages(files: (File | Blob)[], pageId: string, at?: Point) {
  const state = useEditorStore.getState();
  const page = state.pages[pageId];
  const projectId = state.project?.id;
  if (!page || !projectId) return;
  const { w: pw, h: ph } = pageSize(page.orientation);
  const images = files.filter((f) => {
    if (!isSupportedImage(f)) {
      toast.error("Unsupported file", { description: `${(f as File).name ?? "This file"} is not a PNG, JPEG, WebP, GIF, AVIF, BMP or SVG image.` });
      return false;
    }
    if (f.size > MAX_BYTES) {
      toast.error("Image too large", { description: "Images must be smaller than 25 MB." });
      return false;
    }
    return true;
  });
  if (!images.length) return;

  const toastId = toast.loading(images.length > 1 ? `Uploading ${images.length} images…` : "Uploading image…");
  const created: ImageObject[] = [];
  let failed = 0;
  for (const [i, file] of images.entries()) {
    try {
      const natural = await imageSize(file);
      const filename = file instanceof File && file.name ? file.name : `pasted-${Date.now()}.${file.type.split("/")[1]?.replace("svg+xml", "svg") ?? "png"}`;
      const att = await api.uploadAttachment(file, { filename, projectId, width: natural.w, height: natural.h });
      const centre = at ? { x: at.x + i * 24, y: at.y + i * 24 } : { x: pw / 2 + i * 24, y: Math.min(ph / 2, 360) + i * 24 };
      created.push(createImage(att.id, natural, centre, pw * 0.7));
    } catch (err) {
      failed++;
      toast.error("Upload failed", { description: err instanceof Error ? err.message : String(err) });
    }
  }
  if (created.length) {
    editor.addObjects(pageId, created);
    editor.setTool("select");
    editor.select(pageId, created.map((o) => o.id));
    toast.success(created.length > 1 ? `Added ${created.length} images` : "Image added", { id: toastId });
  } else {
    toast.dismiss(toastId);
  }
  return { created: created.length, failed };
}

/** Open the OS file picker for images. */
export function pickImages(onFiles: (files: File[]) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ACCEPTED_IMAGE_TYPES.join(",");
  input.multiple = true;
  input.onchange = () => {
    const files = Array.from(input.files ?? []);
    if (files.length) onFiles(files);
  };
  input.click();
}
