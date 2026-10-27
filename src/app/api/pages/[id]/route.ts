import { deletePage, getPage, updatePage } from "@/lib/db/repo";
import { handler, readJson } from "@/lib/server/http";
import { pageUpdateSchema } from "@/lib/validation/schemas";

export const GET = handler(async (_req: Request, ctx: RouteContext<"/api/pages/[id]">) => {
  const { id } = await ctx.params;
  return getPage(id);
});

// PATCH is also used with `keepalive` when the tab closes, so it must accept
// the same payload as a regular autosave.
export const PATCH = handler(async (req: Request, ctx: RouteContext<"/api/pages/[id]">) => {
  const { id } = await ctx.params;
  return updatePage(id, await readJson(req, pageUpdateSchema));
});

export const DELETE = handler(async (req: Request, ctx: RouteContext<"/api/pages/[id]">) => {
  const { id } = await ctx.params;
  const permanent = new URL(req.url).searchParams.get("permanent") === "1";
  await deletePage(id, permanent);
  return { ok: true };
});
