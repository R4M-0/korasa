import { search } from "@/lib/db/repo";
import { handler } from "@/lib/server/http";

export const GET = handler(async (req: Request) => {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return search(q.slice(0, 200));
});
