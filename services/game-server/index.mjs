import { createGameServer } from "./src/server.mjs";

const secret = String(process.env.GAME_TICKET_SECRET || "");
if (Buffer.byteLength(secret) < 32) {
  throw new Error("GAME_TICKET_SECRET must contain at least 32 bytes");
}

const server = createGameServer({
  secret,
  host: process.env.GAME_HOST || "127.0.0.1",
  port: Number(process.env.GAME_PORT) || 8787,
  path: process.env.GAME_SOCKET_PATH || "/game-socket",
  allowedOrigins: String(process.env.GAME_ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
});

await server.listen();
const address = server.address();
console.log(`PingFang game server listening on ${address.address}:${address.port}`);

async function shutdown() {
  await server.close();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
