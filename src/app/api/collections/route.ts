import { createCollection } from "@/lib/db/repo";
import { handler, readJson } from "@/lib/server/http";
import { collectionCreateSchema } from "@/lib/validation/schemas";

export const POST = handler(async (req: Request) =>
  createCollection(await readJson(req, collectionCreateSchema)),
);
