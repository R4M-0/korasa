import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { ATTACHMENTS_DIR, db } from "@/lib/db/client";
import { getWorkspace, NotFoundError, toAttachmentDTO } from "@/lib/db/repo";

export const IMAGE_MIME_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
};

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export class AttachmentError extends Error {}

export async function saveAttachment(input: {
  data: Buffer;
  filename: string;
  mimeType: string;
  projectId: string | null;
  width: number | null;
  height: number | null;
}) {
  const ext = IMAGE_MIME_TYPES[input.mimeType];
  if (!ext) throw new AttachmentError(`Unsupported file type: ${input.mimeType || "unknown"}`);
  if (input.data.byteLength === 0) throw new AttachmentError("The file is empty");
  if (input.data.byteLength > MAX_ATTACHMENT_BYTES)
    throw new AttachmentError("Images must be smaller than 25 MB");

  const ws = await getWorkspace();
  const storageKey = `${nanoid(16)}.${ext}`;
  await fs.mkdir(ATTACHMENTS_DIR, { recursive: true });
  await fs.writeFile(path.join(ATTACHMENTS_DIR, storageKey), input.data);
  try {
    const project = input.projectId
      ? await db.project.findUnique({ where: { id: input.projectId }, select: { id: true } })
      : null;
    const row = await db.attachment.create({
      data: {
        workspaceId: ws.id,
        projectId: project?.id ?? null,
        filename: input.filename.slice(0, 200) || `image.${ext}`,
        mimeType: input.mimeType,
        size: input.data.byteLength,
        width: input.width,
        height: input.height,
        storageKey,
      },
    });
    return toAttachmentDTO(row);
  } catch (err) {
    await fs.rm(path.join(ATTACHMENTS_DIR, storageKey), { force: true });
    throw err;
  }
}

export async function readAttachment(id: string) {
  const row = await db.attachment.findUnique({ where: { id } });
  if (!row) throw new NotFoundError("Attachment not found");
  const file = path.join(ATTACHMENTS_DIR, path.basename(row.storageKey));
  try {
    const data = await fs.readFile(file);
    return { row, data };
  } catch {
    throw new NotFoundError("Attachment file is missing");
  }
}
