import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { resolveMigrationRoute } from "./migrationRoutes";

export function proxy(request: NextRequest) {
  const result = resolveMigrationRoute(`${request.nextUrl.pathname}${request.nextUrl.search}`, request.method);
  if (!result) return NextResponse.next();

  if (result.status === 301) {
    const response = NextResponse.redirect(new URL(result.location, request.url), 301);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  return new NextResponse("Gone", {
    status: 410,
    headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
