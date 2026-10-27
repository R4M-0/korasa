import { NextResponse, type NextRequest } from "next/server";

/**
 * In the desktop app the local server is bound to 127.0.0.1 and launched with
 * a per-session secret. Only the app's own window carries the matching
 * cookie, so other local processes or web pages can't reach the API.
 * In development (no KORASA_TOKEN) every request passes through.
 */
export function proxy(request: NextRequest) {
  const token = process.env.KORASA_TOKEN;
  if (!token) return NextResponse.next();
  if (request.cookies.get("korasa_token")?.value === token) return NextResponse.next();
  return new NextResponse("Forbidden", { status: 403 });
}

export const config = {
  matcher: "/((?!_next/static|_next/image).*)",
};
