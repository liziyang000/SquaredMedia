(function () {
  var root = document.querySelector("[data-multiplayer-game]");
  if (!root) return;

  var gameType = root.dataset.gameType;
  var ticketEndpoint = root.dataset.gameTicketEndpoint;
  var connection = root.querySelector("[data-game-connection]");
  var connectionText = connection && connection.querySelector("span");
  var messageBox = root.querySelector("[data-game-message]");
  var createButton = root.querySelector("[data-room-create]");
  var joinForm = root.querySelector("[data-room-join-form]");
  var joinButton = root.querySelector("[data-room-join]");
  var roomInput = root.querySelector("[data-room-code-input]");
  var roomEntry = root.querySelector("[data-room-entry]");
  var roomDetails = root.querySelector("[data-room-details]");
  var roomCode = root.querySelector("[data-room-code]");
  var copyButton = root.querySelector("[data-room-copy]");
  var leaveButton = root.querySelector("[data-room-leave]");
  var reconnectButton = root.querySelector("[data-game-reconnect]");
  var playerList = root.querySelector("[data-player-list]");
  var socket = null;
  var playerId = "";
  var room = null;
  var reconnectAttempts = 0;
  var reconnectTimer = null;
  var sessionReady = false;
  var serverTimeOffset = 0;
  var roomStorageKey = "pingfang_multiplayer_room_" + gameType;
  var clientStorageKey = "pingfang_multiplayer_client_" + gameType;
  var tabChannel = null;
  var inviteRoomCode = roomCodeFromLocation();
  var clientIdPromise = prepareClientId();

  function storedRoomCode() {
    try {
      return sessionStorage.getItem(roomStorageKey) || "";
    } catch (error) {
      return "";
    }
  }

  function storeRoomCode(value) {
    try {
      if (value) sessionStorage.setItem(roomStorageKey, value);
      else sessionStorage.removeItem(roomStorageKey);
    } catch (error) {}
  }

  function generateClientId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      return Array.prototype.map
        .call(bytes, function (value) {
          return value.toString(16).padStart(2, "0");
        })
        .join("");
    }
    return "tab-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 14);
  }

  function storedClientId() {
    try {
      var value = sessionStorage.getItem(clientStorageKey) || "";
      return /^[A-Za-z0-9_-]{16,64}$/.test(value) ? value : "";
    } catch (error) {
      return "";
    }
  }

  function storeClientId(value) {
    try {
      sessionStorage.setItem(clientStorageKey, value);
    } catch (error) {}
  }

  function prepareClientId() {
    var clientId = storedClientId() || generateClientId();
    storeClientId(clientId);
    if (!("BroadcastChannel" in window)) return Promise.resolve(clientId);

    var probeId = generateClientId();
    tabChannel = new BroadcastChannel("pingfang_multiplayer_tabs_" + gameType);
    return new Promise(function (resolve) {
      var settled = false;
      function respond(event) {
        var data = event.data || {};
        if (data.type === "probe" && data.clientId === clientId && data.probeId !== probeId) {
          tabChannel.postMessage({ type: "occupied", probeId: data.probeId });
        }
      }
      function finish(value) {
        if (settled) return;
        settled = true;
        clientId = value;
        storeClientId(clientId);
        tabChannel.onmessage = respond;
        resolve(clientId);
      }
      tabChannel.onmessage = function (event) {
        respond(event);
        var data = event.data || {};
        if (data.type === "occupied" && data.probeId === probeId) finish(generateClientId());
      };
      tabChannel.postMessage({ type: "probe", clientId: clientId, probeId: probeId });
      window.setTimeout(function () {
        finish(clientId);
      }, 80);
    });
  }

  function normalizeRoomCode(value) {
    var code = String(value || "")
      .trim()
      .toUpperCase();
    return /^[A-Z2-9]{6}$/.test(code) ? code : "";
  }

  function roomCodeFromLocation() {
    try {
      return normalizeRoomCode(new URL(window.location.href).searchParams.get("room"));
    } catch (error) {
      return "";
    }
  }

  function roomInviteUrl(code) {
    var url = new URL(window.location.href);
    url.searchParams.set("room", code);
    return url.href;
  }

  function setRoomInLocation(code) {
    try {
      var url = new URL(window.location.href);
      if (code) url.searchParams.set("room", code);
      else url.searchParams.delete("room");
      window.history.replaceState(null, "", url.href);
    } catch (error) {}
  }

  function showMessage(text) {
    if (!messageBox) return;
    messageBox.textContent = text || "";
  }

  function setConnection(state, text) {
    if (!connection) return;
    connection.dataset.state = state;
    if (connectionText) connectionText.textContent = text;
  }

  function setLobbyEnabled(enabled) {
    if (createButton) createButton.disabled = !enabled;
    if (joinButton) joinButton.disabled = !enabled;
    if (roomInput) roomInput.disabled = !enabled;
  }

  function send(payload) {
    if (!socket || socket.readyState !== WebSocket.OPEN || !sessionReady) {
      showMessage("连接尚未就绪，请稍后重试");
      return false;
    }
    socket.send(JSON.stringify(payload));
    return true;
  }

  function socketUrl(path) {
    var url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) throw new Error("联机地址不是当前站点");
    url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return url.href;
  }

  function requestTicket() {
    return clientIdPromise
      .then(function (clientId) {
        var body = new FormData();
        body.append("game", gameType);
        body.append("client_id", clientId);
        return fetch(ticketEndpoint, {
          method: "POST",
          credentials: "same-origin",
          headers: { "X-Requested-With": "XMLHttpRequest" },
          body: body
        });
      })
      .then(function (response) {
        return response.json().then(function (payload) {
          if (!response.ok || Number(payload.code) !== 1 || !payload.data) {
            var responseError = new Error(payload.msg || "联机票据获取失败");
            responseError.retryable = response.status >= 500;
            throw responseError;
          }
          return payload.data;
        });
      })
      .catch(function (error) {
        var normalizedError = new Error(error && error.message ? error.message : "联机票据获取失败");
        normalizedError.retryable = error && typeof error.retryable === "boolean" ? error.retryable : true;
        throw normalizedError;
      });
  }

  function scheduleReconnect() {
    if (reconnectTimer || reconnectAttempts >= 5) {
      if (reconnectAttempts >= 5 && reconnectButton) reconnectButton.hidden = false;
      return;
    }
    var delay = Math.min(15000, Math.pow(2, reconnectAttempts) * 1000);
    reconnectAttempts += 1;
    reconnectTimer = window.setTimeout(function () {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function connect() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;
    sessionReady = false;
    setLobbyEnabled(false);
    setConnection("connecting", "正在连接");
    showMessage("");
    if (reconnectButton) reconnectButton.hidden = true;

    requestTicket()
      .then(function (ticket) {
        socket = new WebSocket(socketUrl(ticket.socket_path), ["pfv-game", "pfv-ticket." + ticket.ticket]);
        socket.addEventListener("message", function (event) {
          var payload;
          try {
            payload = JSON.parse(event.data);
          } catch (error) {
            showMessage("收到无法识别的房间消息");
            return;
          }
          handleEvent(payload);
        });
        socket.addEventListener("close", function (event) {
          sessionReady = false;
          setLobbyEnabled(false);
          setConnection("offline", "连接已断开");
          if (event.code === 4001) {
            showMessage("当前账号已在其他页面进入游戏");
            if (reconnectButton) reconnectButton.hidden = false;
            return;
          }
          showMessage("连接中断，正在尝试恢复房间…");
          scheduleReconnect();
        });
        socket.addEventListener("error", function () {
          setConnection("offline", "连接失败");
        });
      })
      .catch(function (error) {
        setConnection("offline", "暂时无法连接");
        showMessage(error.message);
        if (error.retryable === false) {
          if (reconnectButton) reconnectButton.hidden = false;
          return;
        }
        scheduleReconnect();
      });
  }

  function handleEvent(event) {
    if (!event || typeof event.type !== "string") return;
    if (event.type === "session.ready") {
      playerId = event.playerId;
      sessionReady = true;
      reconnectAttempts = 0;
      setConnection("online", "联机服务已连接");
      setLobbyEnabled(true);
      showMessage("");
      var previousRoomCode = room && room.code ? room.code : inviteRoomCode || storedRoomCode();
      if (previousRoomCode) send({ type: "room.join", code: previousRoomCode });
      return;
    }
    if (event.type === "room.created") {
      storeRoomCode(event.code);
      setRoomInLocation(event.code);
      return;
    }
    if (event.type === "room.left") {
      room = null;
      inviteRoomCode = "";
      storeRoomCode("");
      setRoomInLocation("");
      clearDrawFeed();
      renderRoom();
      return;
    }
    if (event.type === "room.state") {
      var previousRoom = room;
      room = event.room;
      if (Number.isFinite(Number(room.serverNow))) {
        serverTimeOffset = Number(room.serverNow) - Date.now();
      }
      if (
        gameType === "drawguess" &&
        room.phase === "playing" &&
        room.round === 1 &&
        (!previousRoom || previousRoom.code !== room.code || previousRoom.phase !== "playing")
      ) {
        clearDrawFeed();
      }
      storeRoomCode(room.code);
      inviteRoomCode = room.code;
      setRoomInLocation(room.code);
      renderRoom();
      return;
    }
    if (event.type === "game.error") {
      showMessage(event.message || "操作失败");
      if (inviteRoomCode && !room) {
        inviteRoomCode = "";
        setRoomInLocation("");
      }
      return;
    }
    if (gameType === "drawguess") handleDrawEvent(event);
  }

  function playerMeta(player) {
    var details = [];
    if (!player.connected) details.push("暂时离线");
    if (gameType === "gomoku") {
      details.push(player.stone === "black" ? "黑方" : "白方");
      if (room && room.turnPlayerId === player.playerId) details.push("当前落子");
    } else {
      details.push(player.score + " 分");
      if (room && room.drawerPlayerId === player.playerId) details.push("正在作画");
      if (room && room.guessedPlayerIds.indexOf(player.playerId) !== -1) details.push("已猜中");
    }
    return details.join(" · ");
  }

  function renderPlayers() {
    if (!playerList) return;
    playerList.textContent = "";
    if (!room) return;
    room.players.forEach(function (player) {
      var item = document.createElement("li");
      var marker = document.createElement("i");
      var copy = document.createElement("div");
      var name = document.createElement("strong");
      var meta = document.createElement("span");
      item.classList.toggle("is-self", player.playerId === playerId);
      item.classList.toggle("is-offline", !player.connected);
      marker.dataset.stone = player.stone || "";
      name.textContent = player.name + (player.playerId === playerId ? "（你）" : "");
      meta.textContent = playerMeta(player);
      copy.append(name, meta);
      item.append(marker, copy);
      playerList.append(item);
    });
  }

  function renderRoom() {
    if (roomEntry) roomEntry.hidden = Boolean(room);
    if (roomDetails) roomDetails.hidden = !room;
    if (roomCode) roomCode.textContent = room ? room.code : "------";
    renderPlayers();
    if (gameType === "gomoku") renderGomoku();
    else renderDraw();
  }

  if (createButton) {
    createButton.addEventListener("click", function () {
      showMessage("");
      send({ type: "room.create" });
    });
  }
  if (joinForm) {
    joinForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var code = String(roomInput.value || "")
        .trim()
        .toUpperCase();
      if (!/^[A-Z2-9]{6}$/.test(code)) {
        showMessage("请输入完整的六位房间码");
        roomInput.focus();
        return;
      }
      showMessage("");
      send({ type: "room.join", code: code });
    });
  }
  if (roomInput) {
    roomInput.addEventListener("input", function () {
      roomInput.value = roomInput.value
        .toUpperCase()
        .replace(/[^A-Z2-9]/g, "")
        .slice(0, 6);
    });
  }
  if (copyButton) {
    copyButton.addEventListener("click", function () {
      if (!room) return;
      navigator.clipboard
        .writeText(roomInviteUrl(room.code))
        .then(function () {
          copyButton.textContent = "已复制";
          window.setTimeout(function () {
            copyButton.textContent = "复制邀请链接";
          }, 1600);
        })
        .catch(function () {
          showMessage("复制失败，请手动分享房间码");
        });
    });
  }
  if (leaveButton) {
    leaveButton.addEventListener("click", function () {
      if (send({ type: "room.leave" })) {
        room = null;
        inviteRoomCode = "";
        storeRoomCode("");
        setRoomInLocation("");
        renderRoom();
      }
    });
  }
  if (reconnectButton) {
    reconnectButton.addEventListener("click", function () {
      reconnectAttempts = 0;
      connect();
    });
  }

  var gomokuBoard = root.querySelector("[data-gomoku-board]");
  var gomokuStatus = root.querySelector("[data-game-round-status]");
  var gomokuTurn = root.querySelector("[data-gomoku-turn]");
  var rematchButton = root.querySelector("[data-gomoku-rematch]");
  var gomokuCells = [];

  function initializeGomoku() {
    if (!gomokuBoard) return;
    for (var rowIndex = 0; rowIndex < 15; rowIndex += 1) {
      for (var columnIndex = 0; columnIndex < 15; columnIndex += 1) {
        var cell = document.createElement("button");
        var star = document.createElement("i");
        var stone = document.createElement("span");
        cell.type = "button";
        cell.className = "gomoku-cell";
        cell.dataset.row = rowIndex;
        cell.dataset.column = columnIndex;
        cell.setAttribute("role", "gridcell");
        star.className = "gomoku-star";
        stone.className = "gomoku-stone";
        cell.append(star, stone);
        cell.addEventListener("click", function (event) {
          send({
            type: "gomoku.move",
            row: Number(event.currentTarget.dataset.row),
            column: Number(event.currentTarget.dataset.column)
          });
        });
        gomokuBoard.append(cell);
        gomokuCells.push(cell);
      }
    }
  }

  function renderGomoku() {
    if (!gomokuBoard) return;
    var isMyTurn = Boolean(room && room.phase === "playing" && room.turnPlayerId === playerId);
    gomokuCells.forEach(function (cell, index) {
      var stone = room && room.board ? room.board[index] : null;
      var row = Number(cell.dataset.row);
      var column = Number(cell.dataset.column);
      var isLast = Boolean(room && room.lastMove && room.lastMove.row === row && room.lastMove.column === column);
      cell.classList.toggle("has-black", stone === "black");
      cell.classList.toggle("has-white", stone === "white");
      cell.classList.toggle("is-last", isLast);
      cell.disabled = !isMyTurn || Boolean(stone);
      cell.setAttribute("aria-label", "第" + (row + 1) + "行第" + (column + 1) + "列" + (stone ? "，" + (stone === "black" ? "黑子" : "白子") : ""));
    });
    if (!room) {
      gomokuStatus.textContent = "创建或加入房间后开始";
      gomokuTurn.textContent = "等待开局";
      rematchButton.hidden = true;
      return;
    }
    if (room.phase === "waiting") {
      gomokuStatus.textContent = "把房间码发给另一位玩家";
      gomokuTurn.textContent = "等待对手";
    } else if (room.phase === "playing") {
      var turnPlayer = room.players.find(function (player) {
        return player.playerId === room.turnPlayerId;
      });
      gomokuStatus.textContent = isMyTurn ? "轮到你落子" : "等待 " + (turnPlayer ? turnPlayer.name : "对手") + " 落子";
      gomokuTurn.textContent = room.turnPlayerId === room.players[0].playerId ? "黑方回合" : "白方回合";
    } else {
      var winner = room.players.find(function (player) {
        return player.playerId === room.winnerPlayerId;
      });
      gomokuStatus.textContent = winner ? winner.name + " 获胜" : "本局和棋";
      gomokuTurn.textContent = winner && winner.playerId === playerId ? "你赢了" : "本局结束";
    }
    rematchButton.hidden = room.phase !== "finished";
    rematchButton.disabled = room.rematchReady.indexOf(playerId) !== -1;
    rematchButton.textContent = rematchButton.disabled ? "等待对手确认" : "申请再来一局";
  }

  if (rematchButton) {
    rematchButton.addEventListener("click", function () {
      send({ type: "gomoku.rematch" });
    });
  }

  var canvas = root.querySelector("[data-draw-canvas]");
  var context = canvas && canvas.getContext("2d");
  var canvasLock = root.querySelector("[data-draw-canvas-lock]");
  var drawWord = root.querySelector("[data-draw-word]");
  var drawTimer = root.querySelector("[data-draw-timer]");
  var drawTools = root.querySelector("[data-draw-tools]");
  var colorButtons = Array.prototype.slice.call(root.querySelectorAll("[data-draw-color]"));
  var widthInput = root.querySelector("[data-draw-width]");
  var clearButton = root.querySelector("[data-draw-clear]");
  var drawStart = root.querySelector("[data-draw-start]");
  var guessForm = root.querySelector("[data-draw-guess-form]");
  var guessInput = root.querySelector("[data-draw-guess-input]");
  var guessButton = root.querySelector("[data-draw-guess]");
  var drawFeed = root.querySelector("[data-draw-feed]");
  var brushColor = "#111111";
  var brushWidth = 4;
  var secretWord = "";
  var pointerId = null;
  var lastPoint = null;
  var pendingPoint = null;
  var strokeFrame = null;

  function isDrawer() {
    return Boolean(room && room.phase === "playing" && room.drawerPlayerId === playerId);
  }

  function prepareCanvas() {
    if (!canvas || !context) return null;
    var bounds = canvas.getBoundingClientRect();
    var scale = Math.min(2, window.devicePixelRatio || 1);
    var width = Math.max(1, Math.round(bounds.width * scale));
    var height = Math.max(1, Math.round(bounds.height * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.lineCap = "round";
    context.lineJoin = "round";
    return bounds;
  }

  function paintStroke(stroke) {
    var bounds = prepareCanvas();
    if (!bounds) return;
    context.beginPath();
    context.moveTo(stroke.fromX * bounds.width, stroke.fromY * bounds.height);
    context.lineTo(stroke.toX * bounds.width, stroke.toY * bounds.height);
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.stroke();
  }

  function redrawCanvas() {
    var bounds = prepareCanvas();
    if (!bounds) return;
    context.clearRect(0, 0, bounds.width, bounds.height);
    if (room && Array.isArray(room.strokes)) room.strokes.forEach(paintStroke);
  }

  function normalizedPoint(event) {
    var bounds = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
    };
  }

  function flushStroke() {
    strokeFrame = null;
    if (!lastPoint || !pendingPoint || !isDrawer()) return;
    var stroke = {
      fromX: lastPoint.x,
      fromY: lastPoint.y,
      toX: pendingPoint.x,
      toY: pendingPoint.y,
      color: brushColor,
      width: brushWidth
    };
    lastPoint = pendingPoint;
    pendingPoint = null;
    if (room && Array.isArray(room.strokes)) room.strokes.push(stroke);
    paintStroke(stroke);
    send({ type: "draw.stroke", stroke: stroke });
  }

  function queueStroke(point) {
    pendingPoint = point;
    if (!strokeFrame) strokeFrame = window.requestAnimationFrame(flushStroke);
  }

  function addFeed(text, emphasis) {
    if (!drawFeed) return;
    var item = document.createElement("li");
    item.textContent = text;
    if (emphasis) item.classList.add("is-correct");
    drawFeed.append(item);
    while (drawFeed.children.length > 24) drawFeed.firstElementChild.remove();
    drawFeed.scrollTop = drawFeed.scrollHeight;
  }

  function clearDrawFeed() {
    if (drawFeed) drawFeed.textContent = "";
  }

  function handleDrawEvent(event) {
    if (event.type === "draw.secret") {
      secretWord = event.word;
      renderDraw();
    } else if (event.type === "draw.stroke") {
      if (room) room.strokes.push(event.stroke);
      paintStroke(event.stroke);
    } else if (event.type === "draw.clear") {
      if (room) room.strokes = [];
      redrawCanvas();
    } else if (event.type === "draw.guess") {
      addFeed(event.name + "：" + event.text, event.correct);
    } else if (event.type === "draw.round.end") {
      secretWord = "";
      addFeed("本轮答案：" + event.word, true);
    }
  }

  function renderDraw() {
    if (!canvas) return;
    var drawer = room
      ? room.players.find(function (player) {
          return player.playerId === room.drawerPlayerId;
        })
      : null;
    var drawing = isDrawer();
    if (!drawing) secretWord = "";
    if (!room) {
      drawWord.textContent = "等待开局";
    } else if (room.phase === "waiting") {
      drawWord.textContent = "等待房主开始";
    } else if (room.phase === "finished") {
      drawWord.textContent = "本局结束";
    } else {
      drawWord.textContent = drawing ? secretWord || "正在获取题目…" : room.wordMask;
    }
    canvas.classList.toggle("is-drawing-enabled", drawing);
    canvasLock.hidden = drawing;
    if (!drawing) {
      canvasLock.textContent = room && room.phase === "playing" && drawer ? drawer.name + " 正在作画" : "等待画手开始";
    }
    Array.prototype.forEach.call(drawTools.querySelectorAll("button, input"), function (control) {
      control.disabled = !drawing;
    });
    var alreadyGuessed = Boolean(room && room.guessedPlayerIds.indexOf(playerId) !== -1);
    var canGuess = Boolean(room && room.phase === "playing" && !drawing && !alreadyGuessed);
    guessInput.disabled = !canGuess;
    guessButton.disabled = !canGuess;
    guessInput.placeholder = alreadyGuessed ? "你已猜中，等待下一轮" : drawing ? "画手不能猜题" : "看懂了就快猜…";
    drawStart.hidden = !room || room.hostPlayerId !== playerId || room.phase === "playing";
    drawStart.disabled =
      !room ||
      room.players.filter(function (player) {
        return player.connected;
      }).length < 2;
    drawStart.textContent = room && room.phase === "finished" ? "再开一局" : "开始游戏";
    redrawCanvas();
    updateDrawTimer();
  }

  function updateDrawTimer() {
    if (!drawTimer) return;
    if (!room || room.phase !== "playing") {
      drawTimer.textContent = "--";
      return;
    }
    drawTimer.textContent = Math.max(0, Math.ceil((room.roundEndsAt - (Date.now() + serverTimeOffset)) / 1000)) + "s";
  }

  if (canvas) {
    canvas.addEventListener("pointerdown", function (event) {
      if (!isDrawer()) return;
      pointerId = event.pointerId;
      lastPoint = normalizedPoint(event);
      canvas.setPointerCapture(pointerId);
      event.preventDefault();
    });
    canvas.addEventListener("pointermove", function (event) {
      if (event.pointerId !== pointerId || !lastPoint) return;
      queueStroke(normalizedPoint(event));
      event.preventDefault();
    });
    function finishPointer(event) {
      if (event.pointerId !== pointerId) return;
      pendingPoint = normalizedPoint(event);
      if (strokeFrame) window.cancelAnimationFrame(strokeFrame);
      flushStroke();
      pointerId = null;
      lastPoint = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    }
    canvas.addEventListener("pointerup", finishPointer);
    canvas.addEventListener("pointercancel", finishPointer);
    if ("ResizeObserver" in window) {
      new ResizeObserver(redrawCanvas).observe(canvas);
    } else {
      window.addEventListener("resize", redrawCanvas);
    }
  }
  colorButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      brushColor = button.dataset.drawColor;
      colorButtons.forEach(function (item) {
        item.classList.toggle("is-selected", item === button);
      });
    });
  });
  if (widthInput) {
    widthInput.addEventListener("input", function () {
      brushWidth = Number(widthInput.value);
    });
  }
  if (clearButton) {
    clearButton.addEventListener("click", function () {
      send({ type: "draw.clear" });
    });
  }
  if (drawStart) {
    drawStart.addEventListener("click", function () {
      send({ type: "draw.start" });
    });
  }
  if (guessForm) {
    guessForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = guessInput.value.trim();
      if (!value) return;
      if (send({ type: "draw.guess", text: value })) {
        guessInput.value = "";
        guessInput.focus();
      }
    });
  }

  initializeGomoku();
  if (roomInput && inviteRoomCode) roomInput.value = inviteRoomCode;
  renderRoom();
  window.setInterval(updateDrawTimer, 250);
  connect();
})();
