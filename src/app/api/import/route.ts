import { importProject } from "@/lib/server/portable";
import { BadRequestError, handler } from "@/lib/server/http";

export const POST = handler(async (req: Request) => {
  const collectionId = new URL(req.url).searchParams.get("collectionId");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError("This file is not valid JSON");
  }
  return importProject(body, collectionId);
});
