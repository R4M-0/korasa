import { deleteProject, getProjectDocument, updateProject } from "@/lib/db/repo";
import { handler, readJson } from "@/lib/server/http";
import { projectUpdateSchema } from "@/lib/validation/schemas";

export const GET = handler(async (_req: Request, ctx: RouteContext<"/api/projects/[id]">) => {
  const { id } = await ctx.params;
  return getProjectDocument(id);
});

export const PATCH = handler(async (req: Request, ctx: RouteContext<"/api/projects/[id]">) => {
  const { id } = await ctx.params;
  return updateProject(id, await readJson(req, projectUpdateSchema));
});

export const DELETE = handler(async (req: Request, ctx: RouteContext<"/api/projects/[id]">) => {
  const { id } = await ctx.params;
  const permanent = new URL(req.url).searchParams.get("permanent") === "1";
  await deleteProject(id, permanent);
  return { ok: true };
});
