import { createPage } from "@/lib/db/repo";
import { handler, readJson } from "@/lib/server/http";
import { pageCreateSchema } from "@/lib/validation/schemas";

export const POST = handler(async (req: Request, ctx: RouteContext<"/api/projects/[id]/pages">) => {
  const { id } = await ctx.params;
  return createPage(id, await readJson(req, pageCreateSchema));
});
