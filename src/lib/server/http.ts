import "server-only";
import { connection, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { ZodError, type ZodType } from "zod";
import { NotFoundError } from "@/lib/db/repo";

export class BadRequestError extends Error {}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError("Request body must be valid JSON");
  }
  return schema.parse(body);
}

/**
 * Wrap a route handler with consistent JSON error responses. API routes read
 * live workspace data, so they always run at request time (never prerendered).
 */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response | unknown>) {
  return async (...args: A): Promise<Response> => {
    await connection();
    try {
      const result = await fn(...args);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      // Let Next.js control-flow errors (prerender bail-outs etc.) propagate.
      unstable_rethrow(err);
      if (err instanceof ZodError) {
        const first = err.issues[0];
        return NextResponse.json(
          { error: first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input" },
          { status: 400 },
        );
      }
      if (err instanceof NotFoundError) return NextResponse.json({ error: err.message }, { status: 404 });
      if (err instanceof BadRequestError) return NextResponse.json({ error: err.message }, { status: 400 });
      console.error(err);
      const message = err instanceof Error ? err.message : "Unexpected server error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
