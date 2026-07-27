import type { NextRequest } from "next/server";

import {
  NativePlaybackAuthorizationError,
  authorizeProtectedStream,
  createNativePlaybackTicket,
  validateProtectedStreamPath
} from "../../../server/nativePlaybackTickets";

export const runtime = "nodejs";

const STAGING_HOST = "react.ping2.my";
const MAX_REQUEST_BYTES = 2048;

function jsonResponse(body: object, status: number) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function requestHost(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  return (forwardedHost || request.headers.get("host") || "").replace(/:\d+$/, "").toLowerCase();
}

export async function POST(request: NextRequest) {
  const host = requestHost(request);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (host !== STAGING_HOST || origin !== `https://${STAGING_HOST}` || (fetchSite && fetchSite !== "same-origin")) {
    return jsonResponse({ message: "播放授权请求来源无效" }, 403);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return jsonResponse({ message: "Content-Type 必须为 application/json" }, 415);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ message: "播放授权请求过大" }, 413);
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_REQUEST_BYTES) {
    return jsonResponse({ message: "播放授权请求过大" }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ message: "播放授权请求格式错误" }, 400);
  }
  const streamPath =
    typeof body === "object" && body !== null && !Array.isArray(body) ? validateProtectedStreamPath((body as { streamUrl?: unknown }).streamUrl) : null;
  if (!streamPath) {
    return jsonResponse({ message: "受控媒体地址无效" }, 422);
  }

  try {
    const mediaUrl = await authorizeProtectedStream({
      streamPath,
      cookie: request.headers.get("cookie") || "",
      clientIp: request.headers.get("x-real-ip") || "",
      userAgent: request.headers.get("user-agent") || ""
    });
    const ticket = createNativePlaybackTicket(mediaUrl);
    return jsonResponse({ url: `/api/native-playback-stream/${ticket}` }, 200);
  } catch (error) {
    if (error instanceof NativePlaybackAuthorizationError) {
      const status = error.status === 401 || error.status === 403 || error.status === 404 ? error.status : 503;
      return jsonResponse({ message: status === 503 ? "播放授权服务暂时不可用" : "播放授权已失效" }, status);
    }
    return jsonResponse({ message: "播放授权服务暂时不可用" }, 503);
  }
}
