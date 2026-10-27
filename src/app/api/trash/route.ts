import { emptyTrash, getTrash } from "@/lib/db/repo";
import { handler } from "@/lib/server/http";

export const GET = handler(async () => getTrash());

export const DELETE = handler(async () => {
  await emptyTrash();
  return { ok: true };
});
