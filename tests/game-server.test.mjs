import assert from "node:assert/strict";
import WebSocket from "ws";

import { GameService } from "../services/game-server/src/game-service.mjs";
import { createGameServer } from "../services/game-server/src/server.mjs";
import { issueTicket, verifyTicket } from "../services/game-server/src/ticket.mjs";

const secret = "test-secret-that-is-long-enough-for-hmac";
const fixedNow = 1_700_000_000_000;

function nextSocketEvent(socket, predicate, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("timed out waiting for game server event"));
    }, timeoutMs);
    function onMessage(data) {
      const event = JSON.parse(data.toString());
      if (!predicate(event)) return;
      clearTimeout(timeout);
      socket.off("message", onMessage);
      resolve(event);
    }
    socket.on("message", onMessage);
  });
}

function createHarness(game, players, options = {}) {
  const events = new Map(players.map((player) => [player.playerId, []]));
  const service = new GameService({
    now: options.now || (() => fixedNow),
    roomCode: () => "ABC234",
    words: ["电影院"]
  });

  for (const player of players) {
    service.connect(
      {
        ...player,
        game
      },
      (event) => events.get(player.playerId).push(event)
    );
  }

  return {
    service,
    events,
    send(playerId, message) {
      service.receive(playerId, message);
    },
    take(playerId, type) {
      const queue = events.get(playerId);
      const index = queue.findIndex((event) => event.type === type);
      if (index === -1) return null;
      return queue.splice(index, 1)[0];
    },
    latest(playerId, type) {
      return events
        .get(playerId)
        .filter((event) => event.type === type)
        .at(-1);
    }
  };
}

{
  const token = issueTicket(
    {
      sub: "42",
      name: "Alice",
      game: "gomoku",
      cid: "client-tab-alpha-0001"
    },
    secret,
    {
      now: fixedNow,
      nonce: "fixed-nonce",
      ttlSeconds: 60
    }
  );
  const identity = verifyTicket(token, secret, {
    now: fixedNow + 30_000
  });

  assert.equal(identity.sub, "42");
  assert.equal(identity.name, "Alice");
  assert.equal(identity.game, "gomoku");
  assert.equal(identity.cid, "client-tab-alpha-0001");
  assert.throws(() => verifyTicket(`${token.slice(0, -1)}x`, secret, { now: fixedNow }), /invalid ticket/i, "forged tickets must be rejected");
  assert.throws(() => verifyTicket(token, secret, { now: fixedNow + 61_000 }), /expired ticket/i, "expired tickets must be rejected");
}

{
  let now = fixedNow;
  const players = [
    { playerId: "alice", name: "Alice" },
    { playerId: "bob", name: "Bob" }
  ];
  const game = createHarness("gomoku", players, { now: () => now });

  game.send("alice", { type: "room.create" });
  game.send("bob", { type: "room.join", code: "ABC234" });
  game.service.disconnect("bob");
  assert.equal(game.latest("alice", "room.state").room.players.length, 2);

  now += 46_000;
  game.service.advanceExpiredRounds(now);
  const state = game.latest("alice", "room.state").room;
  assert.equal(state.players.length, 1, "disconnected players should be removed after the reconnect grace period");
  assert.equal(state.phase, "waiting");
  assert.equal(
    state.board.every((cell) => cell === null),
    true
  );
}

{
  const players = [
    { playerId: "alice", name: "Alice" },
    { playerId: "bob", name: "Bob" },
    { playerId: "carol", name: "Carol" }
  ];
  const game = createHarness("gomoku", players);

  game.send("alice", { type: "room.create" });
  assert.equal(game.take("alice", "room.created").code, "ABC234");

  game.send("bob", { type: "room.join", code: "abc234" });
  let state = game.latest("alice", "room.state").room;
  assert.equal(state.phase, "playing");
  assert.equal(state.players.length, 2);
  assert.equal(state.turnPlayerId, "alice");
  assert.equal(state.serverNow, fixedNow);

  game.send("carol", { type: "room.join", code: "ABC234" });
  assert.match(game.take("carol", "game.error").message, /房间已满/);

  game.send("bob", { type: "gomoku.move", row: 0, column: 0 });
  assert.match(game.take("bob", "game.error").message, /还没轮到/);

  const winningMoves = [
    ["alice", 7, 3],
    ["bob", 0, 0],
    ["alice", 7, 4],
    ["bob", 0, 1],
    ["alice", 7, 5],
    ["bob", 0, 2],
    ["alice", 7, 6],
    ["bob", 0, 3],
    ["alice", 7, 7]
  ];
  for (const [playerId, row, column] of winningMoves) {
    game.send(playerId, { type: "gomoku.move", row, column });
  }

  state = game.latest("bob", "room.state").room;
  assert.equal(state.phase, "finished");
  assert.equal(state.winnerPlayerId, "alice");
  assert.deepEqual(state.lastMove, { row: 7, column: 7 });
}

{
  const players = [
    { playerId: "drawer", name: "画手" },
    { playerId: "guesser", name: "猜题者" }
  ];
  const game = createHarness("drawguess", players);

  game.send("drawer", { type: "room.create" });
  game.take("drawer", "room.created");
  game.send("guesser", { type: "room.join", code: "ABC234" });
  game.send("drawer", { type: "draw.start" });

  const secretEvent = game.take("drawer", "draw.secret");
  assert.equal(secretEvent.word, "电影院");
  assert.equal(
    game.events.get("guesser").some((event) => JSON.stringify(event).includes("电影院")),
    false,
    "the answer must not be sent to non-drawers before the round ends"
  );

  game.service.disconnect("drawer");
  game.service.connect({ playerId: "drawer", name: "画手", game: "drawguess" }, (event) => game.events.get("drawer").push(event));
  game.send("drawer", { type: "room.join", code: "ABC234" });
  assert.equal(
    game.events.get("drawer").filter((event) => event.type === "draw.secret").length,
    1,
    "a reconnecting drawer must receive the current private answer again"
  );

  game.send("guesser", {
    type: "draw.stroke",
    stroke: { fromX: 0.1, fromY: 0.1, toX: 0.2, toY: 0.2, color: "#111111", width: 4 }
  });
  assert.match(game.take("guesser", "game.error").message, /只有画手/);

  game.send("drawer", {
    type: "draw.stroke",
    stroke: { fromX: 0.1, fromY: 0.1, toX: 0.2, toY: 0.2, color: "#111111", width: 4 }
  });
  assert.deepEqual(game.take("guesser", "draw.stroke").stroke, {
    fromX: 0.1,
    fromY: 0.1,
    toX: 0.2,
    toY: 0.2,
    color: "#111111",
    width: 4
  });

  game.send("guesser", { type: "draw.guess", text: "电影院" });
  const correct = game.take("drawer", "draw.guess");
  assert.equal(correct.correct, true);
  assert.equal(correct.text, "猜中了答案");
  assert.equal(JSON.stringify(correct).includes("电影院"), false);
  assert.ok(game.latest("guesser", "room.state").room.players.find((player) => player.playerId === "guesser").score > 0);
}

{
  let now = fixedNow;
  const players = [
    { playerId: "drawer", name: "画手" },
    { playerId: "guesser", name: "猜题者" }
  ];
  const game = createHarness("drawguess", players, { now: () => now });

  game.send("drawer", { type: "room.create" });
  game.send("guesser", { type: "room.join", code: "ABC234" });
  game.send("drawer", { type: "draw.start" });
  game.send("guesser", { type: "draw.guess", text: "错误答案" });
  game.send("guesser", { type: "draw.guess", text: "又猜一次" });
  assert.match(game.take("guesser", "game.error").message, /猜得太快/);

  now += 61_000;
  game.send("drawer", {
    type: "draw.stroke",
    stroke: { fromX: 0.1, fromY: 0.1, toX: 0.2, toY: 0.2, color: "#111111", width: 4 }
  });
  assert.match(game.take("drawer", "game.error").message, /本轮已经结束/);
  assert.equal(game.events.get("guesser").filter((event) => event.type === "draw.stroke").length, 0, "late strokes must not enter the next round");
}

{
  const server = createGameServer({
    secret,
    host: "127.0.0.1",
    port: 0,
    path: "/game-socket",
    allowedOrigins: ["https://video.test"]
  });
  await server.listen();
  const address = server.address();
  const endpoint = `ws://127.0.0.1:${address.port}/game-socket`;
  const token = issueTicket({ sub: "42", name: "Alice", game: "gomoku", cid: "client-tab-alpha-0002" }, secret, {
    now: Date.now()
  });

  const rejectedStatus = await new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint, ["pfv-game", `pfv-ticket.${token}`], {
      origin: "https://wrong.test"
    });
    socket.once("unexpected-response", (_request, response) => {
      resolve(response.statusCode);
      response.resume();
    });
    socket.once("open", () => reject(new Error("wrong-origin connection unexpectedly opened")));
    socket.once("error", () => {});
  });
  assert.equal(rejectedStatus, 403);

  const firstEvent = await new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint, ["pfv-game", `pfv-ticket.${token}`], {
      origin: "https://video.test"
    });
    socket.once("message", (data) => {
      resolve({ event: JSON.parse(data.toString()), socket });
    });
    socket.once("error", reject);
  });
  assert.equal(firstEvent.event.type, "session.ready");
  assert.equal(firstEvent.socket.protocol, "pfv-game");
  const replayedStatus = await new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint, ["pfv-game", `pfv-ticket.${token}`], {
      origin: "https://video.test"
    });
    socket.once("unexpected-response", (_request, response) => {
      resolve(response.statusCode);
      response.resume();
    });
    socket.once("open", () => reject(new Error("replayed ticket unexpectedly opened")));
    socket.once("error", () => {});
  });
  assert.equal(replayedStatus, 401);

  const secondGomokuToken = issueTicket({ sub: "42", name: "Alice", game: "gomoku", cid: "client-tab-alpha-0003" }, secret, {
    now: Date.now()
  });
  const sameAccountSecondTab = await new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint, ["pfv-game", `pfv-ticket.${secondGomokuToken}`], {
      origin: "https://video.test"
    });
    socket.once("message", (data) => {
      resolve({ event: JSON.parse(data.toString()), socket });
    });
    socket.once("error", reject);
  });
  assert.notEqual(
    firstEvent.event.playerId,
    sameAccountSecondTab.event.playerId,
    "one account should receive independent player identities in different browser tabs"
  );
  const roomCreated = nextSocketEvent(firstEvent.socket, (event) => event.type === "room.created");
  firstEvent.socket.send(JSON.stringify({ type: "room.create" }));
  const created = await roomCreated;
  const joined = nextSocketEvent(
    sameAccountSecondTab.socket,
    (event) => event.type === "room.state" && event.room?.code === created.code && event.room.players.length === 2
  );
  sameAccountSecondTab.socket.send(JSON.stringify({ type: "room.join", code: created.code }));
  assert.equal((await joined).room.phase, "playing", "two tabs from one account should occupy separate Gomoku seats");

  const drawToken = issueTicket({ sub: "42", name: "Alice", game: "drawguess", cid: "client-tab-alpha-0004" }, secret, {
    now: Date.now()
  });
  const secondEvent = await new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint, ["pfv-game", `pfv-ticket.${drawToken}`], {
      origin: "https://video.test"
    });
    socket.once("message", (data) => {
      resolve({ event: JSON.parse(data.toString()), socket });
    });
    socket.once("error", reject);
  });
  assert.notEqual(firstEvent.event.playerId, secondEvent.event.playerId, "one account should have independent identities in different games");
  firstEvent.socket.close();
  sameAccountSecondTab.socket.close();
  secondEvent.socket.close();
  await server.close();
}

console.log("Multiplayer game service tests passed.");
