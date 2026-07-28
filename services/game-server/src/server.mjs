import { createHash } from "node:crypto";
import { createServer } from "node:http";

import { WebSocket, WebSocketServer } from "ws";

import { GameService } from "./game-service.mjs";
import { verifyTicket } from "./ticket.mjs";

function rejectUpgrade(socket, statusCode) {
  const message = statusCode === 403 ? "Forbidden" : statusCode === 404 ? "Not Found" : "Unauthorized";
  socket.end(`HTTP/1.1 ${statusCode} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

function ticketFromProtocols(header) {
  const protocols = String(header || "")
    .split(",")
    .map((value) => value.trim());
  const tokenProtocol = protocols.find((value) => value.startsWith("pfv-ticket."));
  return tokenProtocol ? tokenProtocol.slice("pfv-ticket.".length) : "";
}

function sameOrigin(request) {
  try {
    const origin = new URL(String(request.headers.origin || ""));
    return origin.host === request.headers.host;
  } catch {
    return false;
  }
}

export function createGameServer(options = {}) {
  const secret = String(options.secret || "");
  const host = String(options.host || "127.0.0.1");
  const port = Number.isInteger(options.port) ? options.port : Number(options.port) || 8787;
  const path = String(options.path || "/game-socket");
  const allowedOrigins = new Set((options.allowedOrigins || []).filter(Boolean));
  const requestHandler = typeof options.requestHandler === "function" ? options.requestHandler : null;
  const gameService = options.gameService || new GameService();
  const usedTickets = new Map();
  const playerSockets = new Map();

  const httpServer = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/healthz") {
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      });
      response.end(JSON.stringify({ ok: true }));
      return;
    }
    if (requestHandler && requestHandler(request, response) !== false) return;
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not Found");
  });
  const websocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: 16 * 1024,
    perMessageDeflate: false,
    handleProtocols(protocols) {
      return protocols.has("pfv-game") ? "pfv-game" : false;
    }
  });

  httpServer.on("upgrade", (request, socket, head) => {
    let requestPath;
    try {
      requestPath = new URL(request.url, "http://localhost").pathname;
    } catch {
      rejectUpgrade(socket, 404);
      return;
    }
    if (requestPath !== path) {
      rejectUpgrade(socket, 404);
      return;
    }

    const origin = String(request.headers.origin || "");
    if (allowedOrigins.size ? !allowedOrigins.has(origin) : !sameOrigin(request)) {
      rejectUpgrade(socket, 403);
      return;
    }

    let identity;
    try {
      identity = verifyTicket(ticketFromProtocols(request.headers["sec-websocket-protocol"]), secret);
      if (!identity.jti || usedTickets.has(identity.jti)) throw new Error("replayed ticket");
    } catch {
      rejectUpgrade(socket, 401);
      return;
    }
    usedTickets.set(identity.jti, identity.exp);
    request.gameIdentity = identity;
    websocketServer.handleUpgrade(request, socket, head, (websocket) => {
      websocketServer.emit("connection", websocket, request);
    });
  });

  websocketServer.on("connection", (socket, request) => {
    const identity = request.gameIdentity;
    const playerId = createHash("sha256").update(`pingfang-game:${identity.game}:${identity.sub}:${identity.cid}`).digest("base64url").slice(0, 16);
    const previous = playerSockets.get(playerId);
    if (previous && previous !== socket && previous.readyState === WebSocket.OPEN) {
      previous.close(4001, "账号已在其他页面连接");
    }
    playerSockets.set(playerId, socket);
    socket.isAlive = true;
    socket.on("pong", () => {
      socket.isAlive = true;
    });
    gameService.connect(
      {
        playerId,
        name: identity.name,
        game: identity.game
      },
      (event) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event));
      }
    );
    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        socket.close(1003, "只支持 JSON 消息");
        return;
      }
      try {
        gameService.receive(playerId, JSON.parse(data.toString()));
      } catch {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "game.error", message: "消息格式错误" }));
        }
      }
    });
    socket.on("close", () => {
      if (playerSockets.get(playerId) !== socket) return;
      playerSockets.delete(playerId);
      gameService.disconnect(playerId);
    });
  });

  const roundTimer = setInterval(() => {
    gameService.advanceExpiredRounds(Date.now());
  }, 1000);
  roundTimer.unref();
  const maintenanceTimer = setInterval(() => {
    const now = Date.now();
    for (const [jti, expiresAt] of usedTickets) {
      if (expiresAt * 1000 <= now) usedTickets.delete(jti);
    }
    for (const socket of websocketServer.clients) {
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30_000);
  maintenanceTimer.unref();

  return {
    gameService,
    listen() {
      return new Promise((resolve, reject) => {
        httpServer.once("error", reject);
        httpServer.listen(port, host, () => {
          httpServer.off("error", reject);
          resolve(httpServer.address());
        });
      });
    },
    address() {
      return httpServer.address();
    },
    close() {
      clearInterval(roundTimer);
      clearInterval(maintenanceTimer);
      for (const socket of websocketServer.clients) socket.terminate();
      return new Promise((resolve, reject) => {
        websocketServer.close(() => {
          httpServer.close((error) => (error ? reject(error) : resolve()));
        });
      });
    }
  };
}
