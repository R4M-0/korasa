import { readAttachment } from "@/lib/db/attachments";
import { handler } from "@/lib/server/http";

export const GET = handler(async (_req: Request, ctx: RouteContext<"/api/attachments/[id]">) => {
  const { id } = await ctx.params;
  const { row, data } = await readAttachment(id);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": row.mimeType,
      "Content-Length": String(data.byteLength),
      // Attachments are immutable: a new upload always gets a new id.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      ...(row.mimeType === "image/svg+xml" && { "Content-Security-Policy": "script-src 'none'" }),
    },
  });
});
