import { AttachmentError, saveAttachment } from "@/lib/db/attachments";
import { BadRequestError, handler } from "@/lib/server/http";

export const POST = handler(async (req: Request) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) throw new BadRequestError("No file uploaded");
  const dim = (key: string) => {
    const v = Number(form.get(key));
    return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  };
  try {
    return await saveAttachment({
      data: Buffer.from(await file.arrayBuffer()),
      filename: file.name,
      mimeType: file.type,
      projectId: (form.get("projectId") as string | null) || null,
      width: dim("width"),
      height: dim("height"),
    });
  } catch (err) {
    if (err instanceof AttachmentError) throw new BadRequestError(err.message);
    throw err;
  }
});
