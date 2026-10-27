import { createProject } from "@/lib/db/repo";
import { handler, readJson } from "@/lib/server/http";
import { projectCreateSchema } from "@/lib/validation/schemas";

export const POST = handler(async (req: Request) =>
  createProject(await readJson(req, projectCreateSchema)),
);
