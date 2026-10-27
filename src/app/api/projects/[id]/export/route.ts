import { NextResponse } from "next/server";
import { exportProject } from "@/lib/server/portable";
import { handler } from "@/lib/server/http";

export const GET = handler(async (_req: Request, ctx: RouteContext<"/api/projects/[id]/export">) => {
  const { id } = await ctx.params;
  const data = await exportProject(id);
  const slug = data.project.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "project";
  return new NextResponse(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${slug}.korasa.json"`,
    },
  });
});
