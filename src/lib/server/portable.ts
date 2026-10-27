import "server-only";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { readAttachment, saveAttachment } from "@/lib/db/attachments";
import { getProjectDocument, getWorkspace, toProjectDTO } from "@/lib/db/repo";
import {
  attachmentIdsInScene,
  BACKGROUNDS,
  extractSceneText,
  ORIENTATIONS,
  parseScene,
} from "@/lib/editor/scene";

/**
 * Portable project files: a single JSON document containing the project, its
 * pages (with editable scenes) and every referenced image as base64.
 */
export const PORTABLE_FORMAT = "korasa.project";
export const PORTABLE_VERSION = 1;

const portableSchema = z.object({
  format: z.literal(PORTABLE_FORMAT),
  version: z.literal(PORTABLE_VERSION),
  project: z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().max(2000).default(""),
    icon: z.string().max(40).nullable().default(null),
    color: z.string().nullable().default(null),
    viewMode: z.enum(["stack", "free", "single"]).default("stack"),
  }),
  pages: z
    .array(
      z.object({
        title: z.string().max(120).default("Untitled page"),
        background: z.enum(BACKGROUNDS).default("plain"),
        orientation: z.enum(ORIENTATIONS).default("portrait"),
        posX: z.number().nullable().default(null),
        posY: z.number().nullable().default(null),
        scene: z.unknown(),
      }),
    )
    .max(1000),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        filename: z.string(),
        mimeType: z.string(),
        width: z.number().nullable().default(null),
        height: z.number().nullable().default(null),
        data: z.string(),
      }),
    )
    .default([]),
});

export type PortableProject = z.infer<typeof portableSchema>;

export async function exportProject(projectId: string): Promise<PortableProject> {
  const doc = await getProjectDocument(projectId);
  const ids = new Set(doc.pages.flatMap((p) => attachmentIdsInScene(p.scene)));
  const attachments: PortableProject["attachments"] = [];
  for (const id of ids) {
    try {
      const { row, data } = await readAttachment(id);
      attachments.push({
        id,
        filename: row.filename,
        mimeType: row.mimeType,
        width: row.width,
        height: row.height,
        data: data.toString("base64"),
      });
    } catch {
      // Missing files are skipped; the image object will show as unavailable.
    }
  }
  return {
    format: PORTABLE_FORMAT,
    version: PORTABLE_VERSION,
    project: {
      name: doc.project.name,
      description: doc.project.description,
      icon: doc.project.icon,
      color: doc.project.color,
      viewMode: doc.project.viewMode,
    },
    pages: doc.pages.map((p) => ({
      title: p.title,
      background: p.background,
      orientation: p.orientation,
      posX: p.posX,
      posY: p.posY,
      scene: p.scene,
    })),
    attachments,
  };
}

export async function importProject(raw: unknown, collectionId: string | null) {
  const input = portableSchema.parse(raw);
  const ws = await getWorkspace();
  if (collectionId) {
    const c = await db.collection.findUnique({ where: { id: collectionId }, select: { id: true } });
    if (!c) collectionId = null;
  }
  const agg = await db.project.aggregate({
    _max: { position: true },
    where: { workspaceId: ws.id, collectionId },
  });
  const color = input.project.color && /^#[0-9a-fA-F]{6}$/.test(input.project.color) ? input.project.color : null;
  const project = await db.project.create({
    data: {
      workspaceId: ws.id,
      collectionId,
      name: input.project.name,
      description: input.project.description,
      icon: input.project.icon,
      color,
      viewMode: input.project.viewMode,
      position: (agg._max.position ?? 0) + 1,
      lastOpenedAt: new Date(),
    },
  });

  const idMap = new Map<string, string>();
  for (const a of input.attachments) {
    try {
      const saved = await saveAttachment({
        data: Buffer.from(a.data, "base64"),
        filename: a.filename,
        mimeType: a.mimeType,
        projectId: project.id,
        width: a.width,
        height: a.height,
      });
      idMap.set(a.id, saved.id);
    } catch {
      // Unsupported/corrupt attachments are dropped; their objects stay as placeholders.
    }
  }

  let position = 1;
  for (const p of input.pages) {
    const scene = parseScene(p.scene);
    for (const o of scene.objects) {
      if (o.type === "image") o.attachmentId = idMap.get(o.attachmentId) ?? o.attachmentId;
    }
    await db.page.create({
      data: {
        projectId: project.id,
        title: p.title || `Page ${position}`,
        position: position++,
        background: p.background,
        orientation: p.orientation,
        posX: p.posX,
        posY: p.posY,
        scene: JSON.stringify(scene),
        textContent: extractSceneText(scene),
      },
    });
  }
  if (input.pages.length === 0) {
    await db.page.create({ data: { projectId: project.id, title: "Page 1", position: 1 } });
  }
  const full = await db.project.findUniqueOrThrow({
    where: { id: project.id },
    include: { pages: true },
  });
  return toProjectDTO(full, full.pages);
}
