import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { resolveMigrationRoute } from "./migrationRoutes";
import { bootstrapOrigin, establishSession, PAGE_PATH_HEADER, SESSION_BOOTSTRAP_HEADER } from "./server/sessionBootstrap";

export async function proxy(request: NextRequest) {
  const result = resolveMigrationRoute(`${request.nextUrl.pathname}${request.nextUrl.search}`, request.method);
  if (!result) {
    const headers = new Headers(request.headers);
    headers.delete(SESSION_BOOTSTRAP_HEADER);
    headers.delete(PAGE_PATH_HEADER);
    const pathname = request.nextUrl.pathname;
    const pageRequest =
      ["GET", "HEAD"].includes(request.method) &&
      !request.headers.has("rsc") &&
      !/^\/(?:_next|api|index\.php|api\.php|react-api\.php|static|template|upload|preview|game-socket|healthz)(?:\/|$)/.test(pathname) &&
      !/\.[^/]+$/.test(pathname) &&
      pathname !== "/qixi";
    let setCookies: string[] = [];
    if (pageRequest && bootstrapOrigin()) {
      try {
        const bootstrap = await establishSession(headers);
        headers.set("cookie", bootstrap.cookie);
        headers.set(SESSION_BOOTSTRAP_HEADER, Buffer.from(JSON.stringify(bootstrap.session)).toString("base64url"));
        headers.set(PAGE_PATH_HEADER, `${pathname}${request.nextUrl.search}`);
        setCookies = bootstrap.setCookies;
      } catch {
        // The client session query remains the recovery path when PHP is unavailable.
      }
    }
    const response = NextResponse.next({ request: { headers } });
    if (pageRequest) response.headers.set("Cache-Control", "private, no-store");
    for (const cookie of setCookies) response.headers.append("Set-Cookie", cookie);
    return response;
  }

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
