import { randomBytes, randomInt } from "node:crypto";

const BOARD_SIZE = 15;
const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DRAW_COLORS = new Set(["#111111", "#ef4444", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed"]);
const DEFAULT_WORDS = ["电影院", "熊猫", "热气球", "长城", "冰淇淋", "消防车", "向日葵", "宇航员", "吉他", "雨伞", "火锅", "摩天轮"];

function defaultRoomCode() {
  const bytes = randomBytes(6);
  return Array.from(bytes, (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join("");
}

function stripControls(value) {
  return Array.from(String(value ?? ""))
    .filter((character) => {
      const code = character.codePointAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");
}

function cleanName(value, fallback) {
  const name = stripControls(value).replace(/[<>]/g, "").trim().slice(0, 24);
  return name || fallback;
}

function cleanText(value, maxLength) {
  return stripControls(value).trim().slice(0, maxLength);
}

function normalizedGuess(value) {
  return cleanText(value, 40).replace(/\s+/g, "").toLocaleLowerCase("zh-CN");
}

function maskWord(word) {
  return Array.from(word, (character) => (/\s/u.test(character) ? " " : "＿")).join(" ");
}

function finiteUnit(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) return null;
  return Math.round(number * 10_000) / 10_000;
}

function normalizeStroke(value) {
  const fromX = finiteUnit(value?.fromX);
  const fromY = finiteUnit(value?.fromY);
  const toX = finiteUnit(value?.toX);
  const toY = finiteUnit(value?.toY);
  const color = String(value?.color ?? "").toLowerCase();
  const width = Math.round(Number(value?.width));
  if ([fromX, fromY, toX, toY].includes(null) || !DRAW_COLORS.has(color) || !Number.isFinite(width)) {
    return null;
  }
  return {
    fromX,
    fromY,
    toX,
    toY,
    color,
    width: Math.max(2, Math.min(18, width))
  };
}

function hasFive(board, row, column, stone) {
  return [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ].some(([rowStep, columnStep]) => {
    let count = 1;
    for (const direction of [-1, 1]) {
      let nextRow = row + rowStep * direction;
      let nextColumn = column + columnStep * direction;
      while (nextRow >= 0 && nextRow < BOARD_SIZE && nextColumn >= 0 && nextColumn < BOARD_SIZE && board[nextRow * BOARD_SIZE + nextColumn] === stone) {
        count += 1;
        nextRow += rowStep * direction;
        nextColumn += columnStep * direction;
      }
    }
    return count >= 5;
  });
}

export class GameService {
  constructor(options = {}) {
    this.now = options.now || Date.now;
    this.roomCode = options.roomCode || defaultRoomCode;
    this.words = Array.isArray(options.words) && options.words.length ? options.words : DEFAULT_WORDS;
    this.pickWord =
      options.pickWord ||
      ((lastWord) => {
        const alternatives = this.words.filter((word) => word !== lastWord);
        const choices = alternatives.length ? alternatives : this.words;
        return choices[randomInt(choices.length)];
      });
    this.roundDurationMs = Math.max(10_000, Number(options.roundDurationMs) || 60_000);
    this.clients = new Map();
    this.rooms = new Map();
    this.messageWindows = new Map();
  }

  connect(identity, send) {
    const playerId = cleanText(identity?.playerId, 64);
    if (!playerId || !["gomoku", "drawguess"].includes(identity?.game) || typeof send !== "function") {
      throw new Error("invalid game identity");
    }

    const previous = this.clients.get(playerId);
    const previousRoomCode = previous?.game === identity.game ? previous.roomCode : "";
    this.clients.set(playerId, {
      playerId,
      name: cleanName(identity.name, "会员"),
      game: identity.game,
      roomCode: previousRoomCode,
      send
    });
    this.emit(playerId, { type: "session.ready", game: identity.game, playerId });
    if (previousRoomCode) {
      const room = this.rooms.get(previousRoomCode);
      const player = room?.players.find((item) => item.playerId === playerId);
      if (player) {
        player.connected = true;
        player.name = this.clients.get(playerId).name;
        this.sendState(room);
        if (room.game === "drawguess" && room.drawerPlayerId === playerId && room.phase === "playing") {
          this.emit(playerId, { type: "draw.secret", word: room.word });
        }
      }
    }
  }

  disconnect(playerId) {
    const client = this.clients.get(playerId);
    if (!client) return;
    const room = this.rooms.get(client.roomCode);
    this.clients.delete(playerId);
    this.messageWindows.delete(playerId);
    if (!room) return;

    const player = room.players.find((item) => item.playerId === playerId);
    if (player) {
      player.connected = false;
      player.disconnectedAt = this.now();
    }
    if (room.players.every((item) => !item.connected)) room.emptySince = this.now();
    this.sendState(room);
  }

  receive(playerId, message) {
    const client = this.clients.get(playerId);
    if (!client || !message || typeof message !== "object" || Array.isArray(message)) return;
    if (!this.withinRateLimit(playerId)) {
      this.error(playerId, "操作太快了，请稍后再试");
      return;
    }

    switch (message.type) {
      case "room.create":
        this.createRoom(client);
        break;
      case "room.join":
        this.joinRoom(client, message.code);
        break;
      case "room.leave":
        this.leaveRoom(client);
        break;
      case "gomoku.move":
        this.gomokuMove(client, message);
        break;
      case "gomoku.rematch":
        this.gomokuRematch(client);
        break;
      case "draw.start":
        this.startDrawGame(client);
        break;
      case "draw.stroke":
        this.drawStroke(client, message.stroke);
        break;
      case "draw.clear":
        this.drawClear(client);
        break;
      case "draw.guess":
        this.drawGuess(client, message.text);
        break;
      default:
        this.error(playerId, "不支持的操作");
    }
  }

  advanceExpiredRounds(now = this.now()) {
    for (const room of this.rooms.values()) {
      if (room.emptySince) {
        if (now - room.emptySince >= 45_000) this.rooms.delete(room.code);
        continue;
      }
      const activePlayers = room.players.filter((player) => player.connected || now - player.disconnectedAt < 45_000);
      if (activePlayers.length !== room.players.length) {
        room.players = activePlayers;
        if (!room.players.some((player) => player.playerId === room.hostPlayerId)) {
          room.hostPlayerId = room.players[0].playerId;
        }
        if (room.game === "gomoku") {
          this.resetGomoku(room);
          room.phase = room.players.length === 2 ? "playing" : "waiting";
        } else if (room.phase === "playing") {
          this.finishDrawGame(room);
        }
        this.sendState(room);
      }
      if (room.game === "drawguess" && room.phase === "playing" && room.roundEndsAt <= now) {
        this.finishDrawRound(room);
      }
    }
  }

  withinRateLimit(playerId) {
    const now = this.now();
    const current = this.messageWindows.get(playerId);
    if (!current || now - current.startedAt >= 1000) {
      this.messageWindows.set(playerId, { startedAt: now, count: 1 });
      return true;
    }
    current.count += 1;
    return current.count <= 80;
  }

  createRoom(client) {
    this.leaveRoom(client, false);
    let code;
    do {
      code = String(this.roomCode()).toUpperCase();
    } while (!/^[A-Z2-9]{6}$/.test(code) || this.rooms.has(code));

    const room = {
      code,
      game: client.game,
      hostPlayerId: client.playerId,
      phase: "waiting",
      players: [this.newPlayer(client)],
      emptySince: 0
    };
    if (client.game === "gomoku") this.resetGomoku(room);
    else this.resetDraw(room);

    this.rooms.set(code, room);
    client.roomCode = code;
    this.emit(client.playerId, { type: "room.created", code });
    this.sendState(room);
  }

  joinRoom(client, requestedCode) {
    const code = cleanText(requestedCode, 6).toUpperCase();
    const room = this.rooms.get(code);
    if (!room || room.game !== client.game) {
      this.error(client.playerId, "房间不存在或已结束");
      return;
    }

    const existing = room.players.find((player) => player.playerId === client.playerId);
    if (existing) {
      if (client.roomCode && client.roomCode !== room.code) this.leaveRoom(client, false);
      existing.connected = true;
      existing.disconnectedAt = 0;
      existing.name = client.name;
      room.emptySince = 0;
      client.roomCode = room.code;
      this.sendState(room);
      if (room.game === "drawguess" && room.drawerPlayerId === client.playerId && room.phase === "playing") {
        this.emit(client.playerId, { type: "draw.secret", word: room.word });
      }
      return;
    }

    const maxPlayers = room.game === "gomoku" ? 2 : 8;
    if (room.players.length >= maxPlayers) {
      this.error(client.playerId, "房间已满");
      return;
    }
    if (room.game === "drawguess" && room.phase === "playing") {
      this.error(client.playerId, "本局已经开始，请下一局再加入");
      return;
    }

    this.leaveRoom(client, false);
    room.players.push(this.newPlayer(client));
    room.emptySince = 0;
    client.roomCode = room.code;
    if (room.game === "gomoku" && room.players.length === 2) {
      this.resetGomoku(room);
      room.phase = "playing";
    }
    this.sendState(room);
  }

  leaveRoom(client, notify = true) {
    if (!client.roomCode) return;
    const room = this.rooms.get(client.roomCode);
    client.roomCode = "";
    if (!room) return;

    room.players = room.players.filter((player) => player.playerId !== client.playerId);
    if (!room.players.length) {
      this.rooms.delete(room.code);
      return;
    }
    if (room.hostPlayerId === client.playerId) room.hostPlayerId = room.players[0].playerId;
    if (room.game === "gomoku") {
      this.resetGomoku(room);
      room.phase = room.players.length === 2 ? "playing" : "waiting";
    } else if (room.phase === "playing") {
      this.finishDrawGame(room);
    }
    if (notify) this.emit(client.playerId, { type: "room.left" });
    this.sendState(room);
  }

  newPlayer(client) {
    return {
      playerId: client.playerId,
      name: client.name,
      connected: true,
      score: 0,
      disconnectedAt: 0,
      lastGuessAt: 0
    };
  }

  currentRoom(client, game) {
    const room = this.rooms.get(client.roomCode);
    if (!room || room.game !== game || !room.players.some((player) => player.playerId === client.playerId)) {
      this.error(client.playerId, "请先加入房间");
      return null;
    }
    return room;
  }

  resetGomoku(room) {
    room.board = Array(BOARD_SIZE * BOARD_SIZE).fill(null);
    room.turnPlayerId = room.players[0]?.playerId || null;
    room.winnerPlayerId = null;
    room.lastMove = null;
    room.rematchReady = [];
  }

  gomokuMove(client, message) {
    const room = this.currentRoom(client, "gomoku");
    if (!room) return;
    if (room.phase !== "playing") {
      this.error(client.playerId, "棋局尚未开始");
      return;
    }
    if (room.turnPlayerId !== client.playerId) {
      this.error(client.playerId, "还没轮到你落子");
      return;
    }

    const row = Number(message.row);
    const column = Number(message.column);
    if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || row >= BOARD_SIZE || column < 0 || column >= BOARD_SIZE) {
      this.error(client.playerId, "落子位置无效");
      return;
    }
    const index = row * BOARD_SIZE + column;
    if (room.board[index] !== null) {
      this.error(client.playerId, "这里已经有棋子");
      return;
    }

    const playerIndex = room.players.findIndex((player) => player.playerId === client.playerId);
    const stone = playerIndex === 0 ? "black" : "white";
    room.board[index] = stone;
    room.lastMove = { row, column };
    if (hasFive(room.board, row, column, stone)) {
      room.phase = "finished";
      room.winnerPlayerId = client.playerId;
      room.turnPlayerId = null;
    } else if (room.board.every(Boolean)) {
      room.phase = "finished";
      room.turnPlayerId = null;
    } else {
      room.turnPlayerId = room.players[playerIndex === 0 ? 1 : 0].playerId;
    }
    this.sendState(room);
  }

  gomokuRematch(client) {
    const room = this.currentRoom(client, "gomoku");
    if (!room || room.phase !== "finished") return;
    if (!room.rematchReady.includes(client.playerId)) room.rematchReady.push(client.playerId);
    if (room.players.length === 2 && room.players.every((player) => room.rematchReady.includes(player.playerId))) {
      room.players.reverse();
      this.resetGomoku(room);
      room.phase = "playing";
    }
    this.sendState(room);
  }

  resetDraw(room) {
    room.drawerPlayerId = null;
    room.word = "";
    room.wordMask = "";
    room.roundIndex = 0;
    room.roundEndsAt = 0;
    room.strokes = [];
    room.guessedPlayerIds = [];
  }

  startDrawGame(client) {
    const room = this.currentRoom(client, "drawguess");
    if (!room) return;
    if (room.hostPlayerId !== client.playerId) {
      this.error(client.playerId, "只有房主可以开始");
      return;
    }
    if (room.players.filter((player) => player.connected).length < 2) {
      this.error(client.playerId, "至少需要两名玩家");
      return;
    }
    if (room.phase === "playing") {
      this.error(client.playerId, "本局已经开始");
      return;
    }

    for (const player of room.players) player.score = 0;
    room.roundIndex = 0;
    this.startDrawRound(room);
  }

  startDrawRound(room) {
    if (room.roundIndex >= room.players.length) {
      this.finishDrawGame(room);
      return;
    }
    room.phase = "playing";
    room.drawerPlayerId = room.players[room.roundIndex].playerId;
    room.word = cleanText(this.pickWord(room.word, room.roundIndex), 20) || "电影院";
    room.wordMask = maskWord(room.word);
    room.roundEndsAt = this.now() + this.roundDurationMs;
    room.strokes = [];
    room.guessedPlayerIds = [];
    for (const player of room.players) player.lastGuessAt = 0;
    this.sendState(room);
    this.emit(room.drawerPlayerId, { type: "draw.secret", word: room.word });
  }

  drawStroke(client, value) {
    const room = this.currentRoom(client, "drawguess");
    if (!room) return;
    if (room.phase === "playing" && room.roundEndsAt <= this.now()) {
      this.finishDrawRound(room);
      this.error(client.playerId, "本轮已经结束");
      return;
    }
    if (room.phase !== "playing" || room.drawerPlayerId !== client.playerId) {
      this.error(client.playerId, "只有画手可以绘制");
      return;
    }
    const stroke = normalizeStroke(value);
    if (!stroke) {
      this.error(client.playerId, "画笔数据无效");
      return;
    }
    if (room.strokes.length >= 5000) {
      this.error(client.playerId, "本轮笔画已达到上限");
      return;
    }
    room.strokes.push(stroke);
    this.broadcast(room, { type: "draw.stroke", stroke }, client.playerId);
  }

  drawClear(client) {
    const room = this.currentRoom(client, "drawguess");
    if (!room) return;
    if (room.phase === "playing" && room.roundEndsAt <= this.now()) {
      this.finishDrawRound(room);
      this.error(client.playerId, "本轮已经结束");
      return;
    }
    if (room.phase !== "playing" || room.drawerPlayerId !== client.playerId) {
      this.error(client.playerId, "只有画手可以清空画布");
      return;
    }
    room.strokes = [];
    this.broadcast(room, { type: "draw.clear" });
  }

  drawGuess(client, value) {
    const room = this.currentRoom(client, "drawguess");
    if (!room) return;
    const now = this.now();
    if (room.phase === "playing" && room.roundEndsAt <= now) {
      this.finishDrawRound(room);
      this.error(client.playerId, "本轮已经结束");
      return;
    }
    if (room.phase !== "playing") {
      this.error(client.playerId, "本轮尚未开始");
      return;
    }
    if (room.drawerPlayerId === client.playerId) {
      this.error(client.playerId, "画手不能参与猜题");
      return;
    }
    if (room.guessedPlayerIds.includes(client.playerId)) {
      this.error(client.playerId, "你已经猜对了");
      return;
    }

    const text = cleanText(value, 40);
    if (!text) return;
    const player = room.players.find((item) => item.playerId === client.playerId);
    if (player.lastGuessAt && now - player.lastGuessAt < 600) {
      this.error(client.playerId, "猜得太快了，请稍后再试");
      return;
    }
    player.lastGuessAt = now;
    const correct = normalizedGuess(text) === normalizedGuess(room.word);
    if (correct) {
      room.guessedPlayerIds.push(client.playerId);
      const secondsUsed = Math.max(0, Math.floor((this.roundDurationMs - (room.roundEndsAt - now)) / 1000));
      player.score += Math.max(20, 100 - secondsUsed);
      const drawer = room.players.find((item) => item.playerId === room.drawerPlayerId);
      if (drawer) drawer.score += 10;
    }

    this.broadcast(room, {
      type: "draw.guess",
      playerId: client.playerId,
      name: player.name,
      correct,
      text: correct ? "猜中了答案" : text
    });

    const guessers = room.players.filter((item) => item.playerId !== room.drawerPlayerId && item.connected);
    if (correct && guessers.every((item) => room.guessedPlayerIds.includes(item.playerId))) {
      this.finishDrawRound(room);
    } else if (correct) {
      this.sendState(room);
    }
  }

  finishDrawRound(room) {
    if (room.phase !== "playing") return;
    this.broadcast(room, { type: "draw.round.end", word: room.word });
    room.roundIndex += 1;
    this.startDrawRound(room);
  }

  finishDrawGame(room) {
    room.phase = "finished";
    room.drawerPlayerId = null;
    room.word = "";
    room.wordMask = "";
    room.roundEndsAt = 0;
    room.strokes = [];
    room.guessedPlayerIds = [];
    this.sendState(room);
  }

  publicRoom(room) {
    const state = {
      code: room.code,
      game: room.game,
      hostPlayerId: room.hostPlayerId,
      phase: room.phase,
      serverNow: this.now(),
      players: room.players.map((player, index) => ({
        playerId: player.playerId,
        name: player.name,
        connected: player.connected,
        score: player.score,
        ...(room.game === "gomoku" ? { stone: index === 0 ? "black" : "white" } : {})
      }))
    };
    if (room.game === "gomoku") {
      return {
        ...state,
        board: room.board,
        turnPlayerId: room.turnPlayerId,
        winnerPlayerId: room.winnerPlayerId,
        lastMove: room.lastMove,
        rematchReady: room.rematchReady
      };
    }
    return {
      ...state,
      drawerPlayerId: room.drawerPlayerId,
      wordMask: room.wordMask,
      round: room.phase === "waiting" ? 0 : room.roundIndex + 1,
      totalRounds: room.players.length,
      roundEndsAt: room.roundEndsAt,
      strokes: room.strokes,
      guessedPlayerIds: room.guessedPlayerIds
    };
  }

  sendState(room) {
    this.broadcast(room, { type: "room.state", room: this.publicRoom(room) });
  }

  broadcast(room, event, exceptPlayerId = "") {
    for (const player of room.players) {
      if (player.playerId !== exceptPlayerId && player.connected) this.emit(player.playerId, event);
    }
  }

  emit(playerId, event) {
    this.clients.get(playerId)?.send(event);
  }

  error(playerId, message) {
    this.emit(playerId, { type: "game.error", message });
  }
}

export const gameConstants = {
  boardSize: BOARD_SIZE,
  colors: [...DRAW_COLORS]
};
