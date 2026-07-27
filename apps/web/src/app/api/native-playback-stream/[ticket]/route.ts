import type { NextRequest } from "next/server";

import { redeemNativePlaybackTicket } from "../../../../server/nativePlaybackTickets";

export const runtime = "nodejs";

const STAGING_HOST = "react.ping2.my";

function requestHost(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  return (forwardedHost || request.headers.get("host") || "").replace(/:\d+$/, "").toLowerCase();
}

export async function GET(request: NextRequest, context: { params: Promise<{ ticket: string }> }) {
  if (requestHost(request) !== STAGING_HOST) {
    return new Response("Not Found", { status: 404 });
  }

  const { ticket } = await context.params;
  const mediaUrl = redeemNativePlaybackTicket(ticket);
  if (!mediaUrl) {
    return new Response("播放凭证无效或已过期", {
      status: 403,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "private, no-store",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: mediaUrl,
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
