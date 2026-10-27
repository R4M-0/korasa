import { getTree } from "@/lib/db/repo";
import { handler } from "@/lib/server/http";

export const GET = handler(async () => getTree());
