import { deleteCollection, updateCollection } from "@/lib/db/repo";
import { handler, readJson } from "@/lib/server/http";
import { collectionUpdateSchema } from "@/lib/validation/schemas";

export const PATCH = handler(async (req: Request, ctx: RouteContext<"/api/collections/[id]">) => {
  const { id } = await ctx.params;
  return updateCollection(id, await readJson(req, collectionUpdateSchema));
});

export const DELETE = handler(async (req: Request, ctx: RouteContext<"/api/collections/[id]">) => {
  const { id } = await ctx.params;
  const permanent = new URL(req.url).searchParams.get("permanent") === "1";
  await deleteCollection(id, permanent);
  return { ok: true };
});
