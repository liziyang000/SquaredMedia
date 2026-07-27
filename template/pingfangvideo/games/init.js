(function (window, document) {
  "use strict";

  var game = document.querySelector("[data-blockrain-game]");
  var controls = document.querySelectorAll("[data-blockrain-action]");
  var nextPanel = document.querySelector("[data-blockrain-next]");
  var nextGrid = document.querySelector("[data-blockrain-next-grid]");
  var nextName = document.querySelector("[data-blockrain-next-name]");
  var $ = window.jQuery;
  var instance;
  var nextCells = [];
  var shapeNames = {
    line: "长条",
    square: "方块",
    arrow: "T 形",
    rightHook: "右钩",
    leftHook: "左钩",
    rightZag: "右折",
    leftZag: "左折"
  };

  if (!game || !$ || !$.fn || typeof $.fn.blockrain !== "function") return;

  function color(name, fallback) {
    var value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function currentTheme() {
    return {
      background: color("--bg", "#080b10"),
      backgroundGrid: color("--bg", "#080b10"),
      stroke: color("--bg", "#080b10"),
      strokeWidth: 2,
      innerStroke: color("--line-soft", "rgba(255, 255, 255, 0.08)"),
      blocks: {
        line: color("--accent-2", "#26d4af"),
        square: color("--gold", "#f5bf4f"),
        arrow: color("--accent", "#ff5a3d"),
        rightHook: color("--brand-2", "#26d4af"),
        leftHook: color("--text", "#f4f0e8"),
        rightZag: color("--accent-2", "#26d4af"),
        leftZag: color("--accent", "#ff5a3d")
      }
    };
  }

  function buildNextGrid() {
    if (!nextGrid) return;

    nextGrid.innerHTML = "";
    for (var index = 0; index < 16; index += 1) {
      var cell = document.createElement("i");
      nextGrid.appendChild(cell);
      nextCells.push(cell);
    }
  }

  function updateNext() {
    if (!instance || !instance._board || !nextPanel || !nextName) return;

    var shape = instance._board.next;
    var type = shape && shape.blockType;
    var name = shapeNames[type] || "准备中";

    nextName.textContent = name;
    nextPanel.setAttribute("aria-label", "下一个方块：" + name);

    nextCells.forEach(function (cell) {
      cell.classList.remove("is-active");
    });

    if (!shape || typeof shape.getBlocks !== "function") return;

    var blocks = shape.getBlocks(0);
    var points = [];
    var minX = Infinity;
    var minY = Infinity;
    var maxX = -Infinity;
    var maxY = -Infinity;

    for (var offset = 0; offset < blocks.length; offset += 2) {
      var x = blocks[offset];
      var y = blocks[offset + 1];
      points.push([x, y]);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    var gridOffsetX = Math.floor((4 - (maxX - minX + 1)) / 2);
    var gridOffsetY = Math.floor((4 - (maxY - minY + 1)) / 2);

    points.forEach(function (point) {
      var column = gridOffsetX + point[0] - minX;
      var row = gridOffsetY + point[1] - minY;
      var cell = nextCells[row * 4 + column];
      if (cell) cell.classList.add("is-active");
    });
  }

  function clearHolding(board) {
    board.holding.left = null;
    board.holding.right = null;
    board.holding.drop = null;
  }

  function runAction(action) {
    var board = instance && instance._board;
    if (!board || !board.started || board.gameover || !board.cur) return;

    clearHolding(board);

    if (action === "left") board.cur.moveLeft();
    else if (action === "right") board.cur.moveRight();
    else if (action === "drop") board.cur.drop();
    else if (action === "rotate-left") board.cur.rotate("left");
    else if (action === "rotate-right") board.cur.rotate("right");

    clearHolding(board);
  }

  function bindControls() {
    Array.prototype.forEach.call(controls, function (button) {
      button.addEventListener("click", function (event) {
        event.preventDefault();
        runAction(button.getAttribute("data-blockrain-action"));
      });
    });
  }

  var $game = $(game);
  $game.blockrain({
    theme: currentTheme(),
    playText: "准备好了吗？",
    playButtonText: "开始游戏",
    gameOverText: "本局结束",
    restartButtonText: "再来一局",
    scoreText: "得分",
    speed: 18,
    onStart: updateNext,
    onRestart: updateNext,
    onPlaced: updateNext
  });
  instance = $game.blockrain("instance");
  $game.blockrain("touchControls", false);
  buildNextGrid();
  bindControls();
  updateNext();

  if (window.MutationObserver) {
    new window.MutationObserver(function (records) {
      var changed = records.some(function (record) {
        return record.attributeName === "data-theme";
      });
      if (changed) $game.blockrain("theme", currentTheme());
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }
})(window, document);
