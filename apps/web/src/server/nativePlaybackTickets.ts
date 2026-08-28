import { randomBytes } from "node:crypto";
import { request as requestHttps } from "node:https";
import { isIP } from "node:net";
import { checkServerIdentity } from "node:tls";

export const NATIVE_PLAYBACK_TICKET_TTL_MS = 120_000;

const MAX_ACTIVE_TICKETS = 5_000;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const STREAM_PATH_PATTERN =
  /^\/index\.php\/pingfangapi\/stream\/id\/[1-9][0-9]{0,9}\/sid\/[1-9][0-9]{0,9}\/nid\/[1-9][0-9]{0,9}(?:\/ticket\/[a-f0-9]{64})?\.html$/;

type NativePlaybackGrant = {
  mediaUrl: string;
  expiresAt: number;
};

type NativePlaybackTicketGlobal = typeof globalThis & {
  __squaredMediaNativePlaybackTickets?: Map<string, NativePlaybackGrant>;
};

type CreateTicketOptions = {
  now?: number;
  createToken?: () => string;
};

type AuthorizeProtectedStreamOptions = {
  streamPath: string;
  cookie: string;
  clientIp: string;
  userAgent: string;
  host?: string;
  timeoutMs?: number;
};

export class NativePlaybackAuthorizationError extends Error {
  readonly status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = "NativePlaybackAuthorizationError";
    this.status = status;
  }
}

function ticketStore() {
  const ticketGlobal = globalThis as NativePlaybackTicketGlobal;
  ticketGlobal.__squaredMediaNativePlaybackTickets ??= new Map();
  return ticketGlobal.__squaredMediaNativePlaybackTickets;
}

function removeExpiredTickets(now: number) {
  const store = ticketStore();
  for (const [ticket, grant] of store) {
    if (grant.expiresAt <= now) store.delete(ticket);
  }
}

function normalizeMediaUrl(value: string) {
  let mediaUrl: URL;
  try {
    mediaUrl = new URL(value);
  } catch {
    throw new Error("媒体跳转地址不安全");
  }
  if (!["http:", "https:"].includes(mediaUrl.protocol) || mediaUrl.username || mediaUrl.password) {
    throw new Error("媒体跳转地址不安全");
  }
  return mediaUrl.href;
}

export function validateProtectedStreamPath(value: unknown) {
  if (typeof value !== "string") return null;
  const streamPath = value.trim();
  return STREAM_PATH_PATTERN.test(streamPath) ? streamPath : null;
}

export function createNativePlaybackTicket(mediaUrl: string, options: CreateTicketOptions = {}) {
  const now = options.now ?? Date.now();
  const createToken = options.createToken ?? (() => randomBytes(32).toString("hex"));
  const normalizedMediaUrl = normalizeMediaUrl(mediaUrl);
  const store = ticketStore();

  removeExpiredTickets(now);
  if (store.size >= MAX_ACTIVE_TICKETS) {
    throw new Error("临时播放凭证数量已达上限");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ticket = createToken();
    if (!TOKEN_PATTERN.test(ticket) || store.has(ticket)) continue;
    store.set(ticket, {
      mediaUrl: normalizedMediaUrl,
      expiresAt: now + NATIVE_PLAYBACK_TICKET_TTL_MS
    });
    return ticket;
  }

  throw new Error("无法生成临时播放凭证");
}

export function redeemNativePlaybackTicket(ticket: string, now = Date.now()) {
  if (!TOKEN_PATTERN.test(ticket)) return null;
  const store = ticketStore();
  const grant = store.get(ticket);
  if (!grant || grant.expiresAt <= now) {
    store.delete(ticket);
    return null;
  }
  return grant.mediaUrl;
}

export function resetNativePlaybackTicketsForTest() {
  ticketStore().clear();
}

export function authorizeProtectedStream({
  streamPath,
  cookie,
  clientIp,
  userAgent,
  host = "www.ping2.my",
  timeoutMs = 7_000
}: AuthorizeProtectedStreamOptions) {
  const protectedPath = validateProtectedStreamPath(streamPath);
  if (!protectedPath || host !== "www.ping2.my" || !isIP(clientIp)) {
    return Promise.reject(new NativePlaybackAuthorizationError("播放授权请求无效", 403));
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const succeed = (mediaUrl: string) => {
      if (settled) return;
      settled = true;
      resolve(mediaUrl);
    };
    const headers: Record<string, string> = {
      Accept: "application/vnd.apple.mpegurl,video/*;q=0.9,*/*;q=0.8",
      Host: host,
      "X-Forwarded-For": clientIp,
      "X-Forwarded-Proto": "https",
      "X-Real-IP": clientIp
    };
    if (cookie && cookie.length <= 8192) headers.Cookie = cookie;
    if (/^[\x20-\x7e]{1,512}$/.test(userAgent)) headers["User-Agent"] = userAgent;

    const request = requestHttps(
      {
        protocol: "https:",
        hostname: "127.0.0.1",
        port: 443,
        servername: host,
        method: "GET",
        path: protectedPath,
        headers,
        checkServerIdentity: (_hostname, certificate) => checkServerIdentity(host, certificate)
      },
      (response) => {
        response.resume();
        const status = response.statusCode ?? 503;
        const location = response.headers.location;
        if (status !== 302 || typeof location !== "string" || location === "") {
          fail(new NativePlaybackAuthorizationError("播放授权已失效", status >= 400 && status < 600 ? status : 503));
          return;
        }

        try {
          const mediaUrl = new URL(location, `https://${host}/`);
          succeed(normalizeMediaUrl(mediaUrl.href));
        } catch {
          fail(new NativePlaybackAuthorizationError("媒体跳转地址无效", 503));
        }
      }
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new NativePlaybackAuthorizationError("播放授权请求超时", 504));
    });
    request.once("error", (error) => {
      fail(error instanceof NativePlaybackAuthorizationError ? error : new NativePlaybackAuthorizationError("播放授权服务暂时不可用", 503));
    });
    request.end();
  });
}
