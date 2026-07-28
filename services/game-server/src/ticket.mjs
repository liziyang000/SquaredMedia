import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const allowedGames = new Set(["gomoku", "drawguess"]);
const clientIdPattern = /^[A-Za-z0-9_-]{16,64}$/;

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function invalid(message = "invalid ticket") {
  return new Error(message);
}

function validateSecret(secret) {
  if (typeof secret !== "string" || Buffer.byteLength(secret) < 32) {
    throw new Error("ticket secret must contain at least 32 bytes");
  }
}

function signature(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueTicket(identity, secret, options = {}) {
  validateSecret(secret);
  const now = Math.floor((options.now ?? Date.now()) / 1000);
  const ttlSeconds = Math.max(1, Math.min(120, Number(options.ttlSeconds) || 60));
  const sub = String(identity?.sub ?? "");
  const game = String(identity?.game ?? "");
  const cid = String(identity?.cid ?? "");
  if (!/^[1-9]\d*$/.test(sub) || !allowedGames.has(game) || !clientIdPattern.test(cid)) {
    throw invalid();
  }

  const payload = encode(
    JSON.stringify({
      aud: "pingfang-games",
      sub,
      name: String(identity?.name || `会员${sub}`).slice(0, 24),
      game,
      cid,
      iat: now,
      exp: now + ttlSeconds,
      jti: String(options.nonce || randomBytes(12).toString("base64url"))
    })
  );

  return `${payload}.${signature(payload, secret)}`;
}

export function verifyTicket(ticket, secret, options = {}) {
  validateSecret(secret);
  if (typeof ticket !== "string" || ticket.length > 2048) {
    throw invalid();
  }

  const parts = ticket.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw invalid();
  }

  const expected = Buffer.from(signature(parts[0], secret));
  const actual = Buffer.from(parts[1]);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw invalid();
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    throw invalid();
  }

  const now = Math.floor((options.now ?? Date.now()) / 1000);
  if (
    payload?.aud !== "pingfang-games" ||
    !/^[1-9]\d*$/.test(String(payload?.sub ?? "")) ||
    !allowedGames.has(payload?.game) ||
    !clientIdPattern.test(String(payload?.cid ?? "")) ||
    !Number.isInteger(payload?.exp) ||
    !Number.isInteger(payload?.iat) ||
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > 120 ||
    payload.iat > now + 30
  ) {
    throw invalid();
  }
  if (payload.exp <= now) {
    throw invalid("expired ticket");
  }

  return {
    sub: String(payload.sub),
    name: String(payload.name || `会员${payload.sub}`).slice(0, 24),
    game: payload.game,
    cid: String(payload.cid),
    exp: payload.exp,
    jti: String(payload.jti || "")
  };
}
