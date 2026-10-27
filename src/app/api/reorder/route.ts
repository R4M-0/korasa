import { reorder } from "@/lib/db/repo";
import { handler, readJson } from "@/lib/server/http";
import { reorderSchema } from "@/lib/validation/schemas";

export const POST = handler(async (req: Request) => {
  const { kind, ids } = await readJson(req, reorderSchema);
  await reorder(kind, ids);
  return { ok: true };
});
