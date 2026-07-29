const V2_COMPONENT_SPECS = [
  {
    id: "media-placeholder",
    name: "Media/Placeholder",
    dimensions: {
      Ratio: ["Poster", "Thumbnail", "Backdrop", "Player", "Canvas"],
      State: ["Default", "Hover"]
    }
  },
  {
    id: "navigation-nav-item",
    name: "Navigation/NavItem",
    dimensions: { State: ["Default", "Hover", "Current", "Focus"] }
  },
  {
    id: "content-category-tile",
    name: "Content/CategoryTile",
    dimensions: {
      Viewport: ["Desktop", "Tablet", "Mobile"],
      State: ["Default", "Hover", "Focus"]
    }
  },
  {
    id: "selection-filter-option",
    name: "Selection/FilterOption",
    dimensions: {
      Viewport: ["Desktop", "Mobile"],
      State: ["Default", "Hover", "Selected", "Focus"]
    }
  },
  {
    id: "playback-episode-item",
    name: "Playback/EpisodeItem",
    dimensions: {
      Viewport: ["Desktop", "Tablet", "Mobile"],
      State: ["Default", "Hover", "Active", "Recommended", "Focus"]
    }
  },
  {
    id: "account-device-card",
    name: "Account/DeviceCard",
    dimensions: {
      Viewport: ["Desktop", "Tablet", "Mobile"],
      State: ["Default", "Hover", "Current"]
    }
  },
  {
    id: "games-game-card",
    name: "Games/GameCard",
    dimensions: {
      Viewport: ["Desktop", "Tablet", "Mobile"],
      Game: ["2048", "Blockrain", "Gomoku", "DrawGuess"],
      State: ["Default", "Hover"]
    }
  },
  {
    id: "system-system-box",
    name: "System/SystemBox",
    dimensions: {
      Viewport: ["Desktop", "Mobile"],
      Kind: ["Message", "Password", "Fallback"]
    }
  },
  {
    id: "form-password-toggle",
    name: "Form/PasswordToggle",
    dimensions: {
      Visibility: ["Hidden", "Visible"],
      State: ["Default", "Hover", "Focus"]
    }
  },
  {
    id: "games-blockrain-control",
    name: "Games/BlockrainControl",
    dimensions: {
      Viewport: ["Desktop", "Mobile"],
      State: ["Default", "Hover", "Focus", "Pressed"]
    }
  }
];

const V2_COMPONENT_REVISION = "source-visual-v2.2";

const V2_EVIDENCE_NEEDLES = {
  A01: ["https://www.ping2video.xyz/ -"],
  A02: ["/label/categories"],
  A03: ["/label/videos"],
  A04: ["/label/hot"],
  A05: ["/label/history"],
  A06: ["/vod/type/", "/vod/show/"],
  A07: ["/vod/search/", "www.ping2video.xyz (english-us)"],
  A08: ["/vod/detail/"],
  A09: ["/vod/play/"],
  A10: ["/user/login"],
  A11: ["/user/reg"],
  A12: ["/user/findpass"],
  A13: ["/user/index"],
  A14: ["/user/plays"],
  A15: ["/user/favs"],
  A16: ["/pingfangdevice"],
  A17: ["/label/games"],
  A18: ["/label/games"],
  A19: ["/label/game-2048"],
  A20: ["/label/game-blockrain"],
  A21: ["/label/game-gomoku"],
  A22: ["/label/game-drawguess"],
  A23: ["/vod/down/"],
  A24: ["/vod/confirm", "/vod/copyright", "/vod/detail_pwd", "/vod/player_pwd", "/art/confirm", "/art/detail_pwd"],
  A25: ["/vod/plot", "/plot/"],
  A26: ["/comment/"],
  A27: ["/gbook/", "/book/report"],
  A28: ["/art/index", "/topic/index", "/actor/index", "/role/index", "/website/index"],
  A29: ["/art/detail", "/topic/detail", "/actor/detail", "/role/detail", "/website/detail"],
  A30: ["/public/jump", "/public/msg", "/public/verify"]
};

const V2_EVIDENCE_TEXT_SIGNATURES = {
  A07: ["搜索结果"],
  A17: ["登录后开启游戏大厅", "前往登录"],
  A18: ["片刻放松，随时开局", "会员已解锁"]
};

const V2_STATE_FACTS = {
  A01: ["Normal", "Carousel Active", "Autoplay Paused", "Tab Selected", "Rank Empty", "Latest Empty", "Image Missing", "Card Hover"],
  A02: ["Normal", "Category Hover", "Category Focus", "Navigate"],
  A03: ["Normal", "Card Hover", "Card Focus", "Image Missing", "Pagination Current", "Pagination Disabled"],
  A04: ["Normal", "Card Hover", "Pagination Current"],
  A05: ["Populated", "Empty", "Storage Failure", "Timeline Hover"],
  A06: ["Normal", "Filter Selected", "Unavailable Hidden", "Search Focus", "Empty Results", "Pagination"],
  A07: ["Normal", "No Results", "List Hover", "Image Missing", "Pagination"],
  A08: [
    "Normal",
    "Artwork Missing",
    "Favorite Loading",
    "Favorited",
    "Notice Success",
    "Notice Error",
    "Source Loading",
    "Source Recommended",
    "Episode Active"
  ],
  A09: ["Default", "Preload", "Buffering", "Error", "Retry", "Line Failover", "Auto-next", "Episode Active", "Trial Playback"],
  A10: ["Normal", "Field Focus", "Password Visible", "Captcha Refresh", "Submit Loading", "Notice Success", "Notice Error"],
  A11: ["Normal", "Field Focus", "Native Submit"],
  A12: ["Normal", "Field Focus", "Native Submit"],
  A13: ["Normal", "Records Navigate", "Favorites Navigate", "Devices Navigate"],
  A14: ["Normal", "Empty", "Selected", "Browser Confirm", "Success Reload", "Failure Alert", "Pagination"],
  A15: ["Normal", "Empty", "Selected", "Browser Confirm", "Success Reload", "Failure Alert", "Pagination"],
  A16: ["Normal", "Empty", "Current Device", "Other Device", "Revoked", "Browser Confirm", "Disabled", "Success Reload", "Error Alert"],
  A17: ["Guest Gate"],
  A18: ["Normal", "Game Card Hover", "Game Card Focus", "Navigate"],
  A19: ["Initial", "Playing", "Won", "Game Over", "Keep Playing", "Retry", "Restart"],
  A20: ["Ready", "Playing", "Control Pressed", "Game Over", "Restart"],
  A21: ["Connecting", "No Room", "Invalid Code", "Waiting", "My Turn", "Opponent Turn", "Win", "Draw", "Reconnect", "Offline"],
  A22: ["Connecting", "Waiting", "Drawing", "Guessing", "Already Guessed", "Round End", "Finished", "Reconnect", "Offline"],
  A23: ["Normal Download Groups"],
  A24: ["Vod Confirm", "Copyright", "Detail Password", "Player Password", "Download Password", "Article Confirm", "Article Password"],
  A25: ["Normal Plot List", "Fallback Index", "Fallback Detail"],
  A26: ["Normal", "Form Focus", "Captcha", "Native Submit"],
  A27: ["Guestbook", "Report", "Form Focus", "Captcha", "Native Submit"],
  A28: ["Article Fallback", "Topic Fallback", "Actor Fallback", "Role Fallback", "Website Fallback"],
  A29: ["Article Detail Fallback", "Topic Detail Fallback", "Actor Detail Fallback", "Role Detail Fallback", "Website Detail Fallback"],
  A30: ["Countdown Jump", "Immediate Jump", "Dynamic Message", "Captcha Form", "Native Submit"]
};

const V2_STRUCTURAL_COPY =
  /^(首页|视频|游戏|分类|热播推荐|TOP 05|年度热度榜|查看更多|影片库|搜索|搜索结果|主题|登录|注册|找回密码|退出|收藏|已收藏|收藏中…|播放|立即播放|继续播放|详情介绍|下载|剧情|评论|留言|举报|提交|刷新|返回|关闭|取消|确认|上一集|下一集|第\d+集|线路\d+|推荐|全部影片|浏览全部影片|全部记录|热播榜|全站热度|银幕精选|追剧现场|轻松时刻|次元放映|今日更新|刚刚上线|继续观看|本年最新上线|本年度暂无新上线内容|有新影片上线后会显示在这里。|此频道有新内容后会显示在这里。|检测|重新检测|加载中|正在加载内容|正在准备播放|正在续接画面|缓冲中|播放失败|重试|换线|开始游戏|重新开始|继续游戏|创建房间|加入房间|离开房间|复制|发送|清空|验证码|账号|密码|记住我|暂无内容|操作成功|操作失败，请稍后重试|当前设备|设备管理|登录设备管理|踢下线|播放记录|我的收藏|当前模块暂未配置模板内容|登录后开启游戏大厅|前往登录|片刻放松，随时开局|会员已解锁|2048|Blockrain|五子棋|你画我猜)$/i;

function v2VariantCombinations(dimensions) {
  return Object.entries(dimensions).reduce(
    (rows, [property, values]) => rows.flatMap((row) => values.map((value) => ({ ...row, [property]: value }))),
    [{}]
  );
}

function v2VariantName(combination) {
  return Object.entries(combination)
    .map(([property, value]) => `${property}=${value}`)
    .join(", ");
}

function v2CombinationValue(component, property) {
  if (component.variantProperties && component.variantProperties[property]) return component.variantProperties[property];
  const match = String(component.name).match(new RegExp(`(?:^|,\\s*)${property}=([^,]+)`));
  return match ? match[1].trim() : "";
}

async function v2FindComponentSet(page, key) {
  await page.loadAsync();
  return page.findOne((node) => node.type === "COMPONENT_SET" && entityKey(node) === key);
}

function v2StatePaint(context, state) {
  if (["Hover", "Focus", "Current", "Active", "Selected", "Recommended"].includes(state)) {
    return {
      fill: bindColor(context.selected, "rgba(139, 124, 255, 0.14)"),
      stroke: bindColor(context.lineAccentStrong, "rgba(110, 231, 249, 0.54)")
    };
  }
  return {
    fill: bindColor(context.panel, "rgba(15, 19, 34, 0.76)"),
    stroke: bindColor(context.line, "rgba(221, 228, 255, 0.16)")
  };
}

async function v2AppendComponentText(parent, key, text, context, size = 13, color = null, width = null, font = null) {
  const resolvedFont = font || context.fonts.medium;
  const node = tag(
    createText(text, resolvedFont, size, color || context.text, "#f4f6ff", width || undefined),
    key,
    "P3"
  );
  const style = matchingTextStyle(context, size, resolvedFont);
  if (style) await node.setTextStyleIdAsync(style.id);
  parent.appendChild(node);
  return node;
}

function v2CreateFixedFrame(parent, key, name, direction, width, height, gap, context) {
  const frame = tag(figma.createFrame(), key, "P3");
  frame.name = name;
  configureFixedAutoLayout(frame, direction, width, height, gap, context);
  frame.fills = [];
  frame.clipsContent = false;
  parent.appendChild(frame);
  return frame;
}

function v2ApplyInteractiveShadow(node, state) {
  if (!["Hover", "Focus", "Current", "Active", "Selected", "Recommended"].includes(state)) return;
  node.effects = [
    {
      type: "DROP_SHADOW",
      color: { r: 0.38, g: 0.31, b: 0.86, a: state === "Focus" ? 0.28 : 0.22 },
      offset: { x: 0, y: state === "Hover" ? 12 : 8 },
      radius: state === "Hover" ? 26 : 20,
      spread: 0,
      visible: true,
      blendMode: "NORMAL"
    }
  ];
}

async function v2AppendPill(parent, key, text, context, options = {}) {
  const pill = v2CreateFixedFrame(
    parent,
    key,
    text,
    "HORIZONTAL",
    options.width || 68,
    options.height || 30,
    0,
    context
  );
  pill.fills = [options.fill || bindColor(context.selected, "rgba(139, 124, 255, 0.14)")];
  pill.strokes = [options.stroke || bindColor(context.lineAccentStrong, "rgba(110, 231, 249, 0.54)")];
  pill.strokeWeight = 1;
  setRadius(pill, options.radius || 999, null);
  await v2AppendComponentText(
    pill,
    `${key}/label`,
    text,
    context,
    options.size || 11,
    options.color || context.accent2,
    null,
    options.font || context.fonts.bold
  );
  return pill;
}

function v2PlaceholderSize(ratio) {
  return {
    Poster: [144, 216],
    Thumbnail: [208, 156],
    Backdrop: [320, 180],
    Player: [320, 180],
    Canvas: [320, 200]
  }[ratio];
}

function v2AppendArtRect(parent, key, name, x, y, width, height, fill, radius = 0) {
  const rect = tag(figma.createRectangle(), key, "P3");
  rect.name = name;
  rect.resize(width, height);
  rect.x = x;
  rect.y = y;
  rect.fills = [fill];
  rect.strokes = [];
  if (radius) setRadius(rect, radius, null);
  parent.appendChild(rect);
  return rect;
}

async function v2CreateGameArtwork(parent, key, game, width, height, context, compact) {
  const art = v2CreateFixedFrame(parent, key, `CSS Artwork / ${game}`, "VERTICAL", width, height, 0, context);
  art.fills = [
    gradientPaint([
      [0, "#171c30"],
      [0.52, "#15172a"],
      [1, "#05070d"]
    ])
  ];
  art.strokes = [bindColor(context.line, "rgba(221,228,255,0.16)")];
  art.strokeBottomWeight = 1;

  if (game === "2048") {
    const tileSize = compact ? 70 : 82;
    const gridSize = tileSize * 2 + 10;
    const grid = v2CreateFixedFrame(art, `${key}/grid`, "2048 Tiles", "HORIZONTAL", gridSize, gridSize, 10, context);
    grid.layoutWrap = "WRAP";
    grid.counterAxisAlignItems = "MIN";
    for (const [index, number] of ["2", "0", "4", "8"].entries()) {
      const tile = v2CreateFixedFrame(grid, `${key}/tile/${index}`, `Tile ${number}`, "VERTICAL", tileSize, tileSize, 0, context);
      tile.fills = [
        index >= 2
          ? gradientPaint([
              [0, "#8b7cff"],
              [1, "#6ee7f9"]
            ])
          : bindColor(context.surfaceStrong, "rgba(255,255,255,0.085)")
      ];
      tile.strokes = [
        index >= 2 ? bindColor(context.lineAccentStrong, "rgba(110,231,249,0.54)") : bindColor(context.lineStrong, "rgba(221,228,255,0.28)")
      ];
      tile.strokeWeight = 1;
      setRadius(tile, 14, context.radiusSmall);
      await v2AppendComponentText(tile, `${key}/tile/${index}/label`, number, context, compact ? 27 : 34, null, null, context.fonts.bold);
    }
    return art;
  }

  const canvasWidth = Math.min(width - 32, game === "Gomoku" ? 174 : game === "DrawGuess" ? 210 : 280);
  const canvasHeight = game === "DrawGuess" ? Math.min(150, height - 28) : Math.min(174, height - 28);
  const canvas = tag(figma.createFrame(), `${key}/canvas`, "P3");
  canvas.name = `${game} CSS Artwork`;
  canvas.resize(canvasWidth, canvasHeight);
  canvas.fills = [];
  canvas.clipsContent = false;
  art.appendChild(canvas);

  if (game === "Blockrain") {
    const cell = compact ? 22 : 28;
    const colors = ["#6ee7f9", "#8b7cff", "#f3c97d"];
    const groups = [
      [[0, 0], [1, 0], [2, 0], [1, 1]],
      [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[0, 0], [1, 0], [1, 1], [2, 1]]
    ];
    const origins = [
      [18, 12],
      [canvasWidth - cell * 3 - 18, 62],
      [Math.round((canvasWidth - cell * 3) / 2), canvasHeight - cell * 2 - 22]
    ];
    groups.forEach((cells, groupIndex) => {
      cells.forEach(([column, row], cellIndex) => {
        v2AppendArtRect(
          canvas,
          `${key}/block/${groupIndex}/${cellIndex}`,
          "Block",
          origins[groupIndex][0] + column * cell,
          origins[groupIndex][1] + row * cell,
          cell - 2,
          cell - 2,
          solidPaint(colors[groupIndex]),
          4
        );
      });
    });
    v2AppendArtRect(
      canvas,
      `${key}/floor`,
      "Gradient Floor",
      12,
      canvasHeight - 4,
      canvasWidth - 24,
      3,
      gradientPaint([
        [0, "rgba(110,231,249,0)"],
        [0.35, "#6ee7f9"],
        [0.65, "#8b7cff"],
        [1, "rgba(139,124,255,0)"]
      ]),
      999
    );
  } else if (game === "Gomoku") {
    const board = v2AppendArtRect(canvas, `${key}/board`, "Gomoku Board", 0, 0, canvasWidth, canvasHeight, solidPaint("#d8b775"), 10);
    board.strokes = [solidPaint("rgba(255,255,255,0.18)")];
    board.strokeWeight = 1;
    for (let index = 1; index < 6; index += 1) {
      const x = Math.round((canvasWidth / 6) * index);
      const y = Math.round((canvasHeight / 6) * index);
      v2AppendArtRect(canvas, `${key}/grid/v/${index}`, "Grid Line", x, 10, 1, canvasHeight - 20, solidPaint("rgba(58,37,22,0.48)"));
      v2AppendArtRect(canvas, `${key}/grid/h/${index}`, "Grid Line", 10, y, canvasWidth - 20, 1, solidPaint("rgba(58,37,22,0.48)"));
    }
    [
      [canvasWidth * 0.34, canvasHeight * 0.34, "#111827"],
      [canvasWidth * 0.52, canvasHeight * 0.52, "#f8fafc"],
      [canvasWidth * 0.68, canvasHeight * 0.52, "#111827"]
    ].forEach(([x, y, color], index) => {
      const piece = tag(figma.createEllipse(), `${key}/piece/${index}`, "P3");
      piece.resize(32, 32);
      piece.x = x - 16;
      piece.y = y - 16;
      piece.fills = [solidPaint(color)];
      piece.strokes = [solidPaint("rgba(0,0,0,0.24)")];
      piece.strokeWeight = 1;
      canvas.appendChild(piece);
    });
  } else {
    const paper = v2AppendArtRect(canvas, `${key}/paper`, "Drawing Paper", 0, 0, canvasWidth, canvasHeight, solidPaint("#f7f1df"), 12);
    paper.strokes = [solidPaint("rgba(255,255,255,0.26)")];
    paper.strokeWeight = 1;
    for (let index = 0; index < 3; index += 1) {
      const stroke = v2AppendArtRect(
        canvas,
        `${key}/drawing/${index}`,
        "Drawing Stroke",
        30 + index * 34,
        40 + index * 20,
        76,
        4,
        solidPaint(index === 1 ? "#8b7cff" : "#334155"),
        999
      );
      stroke.rotation = index === 1 ? -18 : 12;
    }
    const pencil = v2AppendArtRect(canvas, `${key}/pencil`, "Pencil", canvasWidth - 142, canvasHeight - 34, 126, 15, solidPaint("#f3c97d"), 5);
    pencil.rotation = -8;
  }
  return art;
}

async function v2CreateComponentVariant(spec, combination, context, key) {
  const component = tag(figma.createComponent(), key, "P3");
  component.name = v2VariantName(combination);
  const state = combination.State || combination.Visibility || combination.Kind || "Default";
  const paint = v2StatePaint(context, state);
  let width = 220;
  let height = 56;
  let label = "测试文本";

  if (spec.id === "media-placeholder") {
    [width, height] = v2PlaceholderSize(combination.Ratio);
    label = combination.Ratio === "Player" ? "16:9" : combination.Ratio === "Canvas" ? "8:5" : combination.Ratio;
  } else if (spec.id === "navigation-nav-item") {
    width = 56;
    height = 44;
    label = "首页";
  } else if (spec.id === "content-category-tile") {
    width = { Desktop: 334, Tablet: 170, Mobile: 175 }[combination.Viewport];
    height = combination.Viewport === "Desktop" ? 112 : 150;
  } else if (spec.id === "selection-filter-option") {
    width = combination.Viewport === "Mobile" ? 84 : 88;
    height = 44;
  } else if (spec.id === "playback-episode-item") {
    width = { Desktop: 160, Tablet: 131, Mobile: 103 }[combination.Viewport];
    height = 44;
    label = "第1集";
  } else if (spec.id === "account-device-card") {
    width = { Desktop: 1384, Tablet: 728, Mobile: 362 }[combination.Viewport];
    height = combination.Viewport === "Mobile" ? 248 : 178;
  } else if (spec.id === "games-game-card") {
    width = { Desktop: 680, Tablet: 352, Mobile: 362 }[combination.Viewport];
    height = combination.Viewport === "Mobile" ? 440 : 420;
    label = { "2048": "2048", Blockrain: "俄罗斯方块", Gomoku: "五子棋", DrawGuess: "你画我猜" }[combination.Game];
  } else if (spec.id === "system-system-box") {
    width = combination.Viewport === "Mobile" ? 362 : 560;
    height = combination.Kind === "Password" ? (combination.Viewport === "Mobile" ? 430 : 450) : combination.Viewport === "Mobile" ? 230 : 240;
    label = combination.Kind === "Password" ? "请输入密码" : combination.Kind === "Fallback" ? "当前模块暂未配置模板内容" : "测试文本";
  } else if (spec.id === "form-password-toggle") {
    width = 44;
    height = 44;
    label = combination.Visibility === "Visible" ? "◉" : "◎";
  } else if (spec.id === "games-blockrain-control") {
    width = combination.Viewport === "Mobile" ? 55 : 54;
    height = combination.Viewport === "Mobile" ? 52 : 56;
    label = "左移";
  }

  const componentDirection =
    spec.id === "account-device-card" && combination.Viewport !== "Mobile" ? "HORIZONTAL" : "VERTICAL";
  configureFixedAutoLayout(component, componentDirection, width, height, 8, context);
  component.primaryAxisAlignItems = "CENTER";
  component.counterAxisAlignItems = "CENTER";
  component.fills =
    spec.id === "media-placeholder"
      ? [
          gradientPaint([
            [0, state === "Hover" ? "#252b48" : "#171c30"],
            [1, state === "Hover" ? "#3c315f" : "#211b3d"]
          ])
        ]
      : [paint.fill];
  component.strokes = [paint.stroke];
  component.strokeWeight = state === "Focus" ? 2 : 1;
  setRadius(
    component,
    ["navigation-nav-item", "selection-filter-option", "playback-episode-item", "form-password-toggle"].includes(spec.id)
      ? spec.id === "navigation-nav-item"
        ? 12
        : 11
      : spec.id === "media-placeholder"
        ? 12
        : 18,
    ["navigation-nav-item", "media-placeholder"].includes(spec.id)
      ? context.radiusSmall
      : ["selection-filter-option", "playback-episode-item", "form-password-toggle"].includes(spec.id)
        ? null
        : context.radius
  );
  v2ApplyInteractiveShadow(component, state);

  if (spec.id === "media-placeholder") {
    const mark = await v2AppendComponentText(component, `${key}/mark`, "▶", context, 20, context.accent2, null, context.fonts.bold);
    mark.opacity = 0.88;
    await v2AppendComponentText(component, `${key}/label`, "测试文本", context, 12, context.muted);
  } else if (spec.id === "navigation-nav-item") {
    component.itemSpacing = 4;
    component.effects =
      state === "Current"
        ? [componentEffect("DROP_SHADOW", "rgba(139,124,255,0.18)", { x: 0, y: 6 }, 16)]
        : state === "Focus"
          ? [componentEffect("DROP_SHADOW", "rgba(110,231,249,0.22)", { x: 0, y: 0 }, 0, 3)]
          : [];
    component.fills = ["Hover", "Current"].includes(state) ? [solidPaint("rgba(255,255,255,0.055)")] : [];
    component.strokes = [state === "Focus" ? bindColor(context.lineAccentStrong, "rgba(110, 231, 249, 0.54)") : solidPaint("rgba(0,0,0,0)")];
    await v2AppendComponentText(
      component,
      `${key}/label`,
      "首页",
      context,
      14,
      ["Hover", "Current"].includes(state) ? context.text : context.muted,
      null,
      context.fonts.bold
    );
    if (["Hover", "Current"].includes(state)) {
      const currentBar = tag(figma.createRectangle(), `${key}/current-indicator`, "P3");
      currentBar.resize(28, 2);
      currentBar.fills = [
        gradientPaint([
          [0, "#8b7cff"],
          [1, "#6ee7f9"]
        ])
      ];
      setRadius(currentBar, 999, null);
      component.appendChild(currentBar);
    }
  } else if (spec.id === "content-category-tile") {
    const innerWidth = width - 32;
    const compact = combination.Viewport !== "Desktop";
    const headerHeight = compact ? 52 : 28;
    const chipHeight = compact ? 64 : 30;
    component.paddingTop = 16;
    component.paddingRight = 16;
    component.paddingBottom = 16;
    component.paddingLeft = 16;
    component.itemSpacing = 14;
    component.primaryAxisAlignItems = "MIN";
    component.counterAxisAlignItems = "MIN";
    component.fills =
      state === "Default"
        ? [
            gradientPaint([
              [0, "rgba(255,255,255,0.07)"],
              [0.52, "rgba(23,28,48,0.82)"],
              [1, "rgba(5,7,13,0.90)"]
            ])
          ]
        : [bindColor(context.surfaceStrong, "rgba(255,255,255,0.085)")];
    component.strokes = [state === "Default" ? bindColor(context.line, "rgba(221,228,255,0.16)") : bindColor(context.lineAccent, "rgba(110,231,249,0.34)")];
    component.effects = [
      componentEffect("DROP_SHADOW", state === "Default" ? "rgba(0,0,0,0.24)" : "rgba(110,231,249,0.14)", { x: 0, y: 18 }, 48),
      componentEffect("INNER_SHADOW", "rgba(255,255,255,0.08)", { x: 0, y: 1 }, 0)
    ];
    const header = v2CreateFixedFrame(component, `${key}/header`, "Category Header", "HORIZONTAL", innerWidth, headerHeight, 8, context);
    header.primaryAxisAlignItems = "SPACE_BETWEEN";
    await v2AppendComponentText(
      header,
      `${key}/header/title`,
      "测试文本",
      context,
      20,
      context.text,
      compact ? Math.max(56, innerWidth - 72) : undefined,
      context.fonts.bold
    );
    await v2AppendComponentText(header, `${key}/header/action`, "进入频道", context, 12, context.accent2, null, context.fonts.bold);
    const chips = v2CreateFixedFrame(component, `${key}/chips`, "Category Sorts", "HORIZONTAL", innerWidth, chipHeight, 8, context);
    chips.primaryAxisAlignItems = "MIN";
    chips.counterAxisAlignItems = "MIN";
    chips.layoutWrap = "WRAP";
    for (const [index, text] of ["最新", "最热", "评分"].entries()) {
      await v2AppendPill(chips, `${key}/chips/${index}`, text, context, {
        width: 58,
        height: 28,
        radius: 999,
        size: 11,
        fill: bindColor(context.panelSoft, "rgba(23,28,48,0.82)"),
        stroke: bindColor(context.line, "rgba(221,228,255,0.16)"),
        color: context.muted
      });
    }
  } else if (spec.id === "selection-filter-option") {
    component.effects =
      state === "Selected"
        ? [componentEffect("DROP_SHADOW", "rgba(139,124,255,0.16)", { x: 0, y: 6 }, 16)]
        : state === "Focus"
          ? [componentEffect("DROP_SHADOW", "rgba(110,231,249,0.22)", { x: 0, y: 0 }, 0, 3)]
          : [];
    component.fills = [
      state === "Selected"
        ? bindColor(context.selected, "rgba(139,124,255,0.14)")
        : state === "Hover"
          ? bindColor(context.panelSoft, "rgba(23,28,48,0.82)")
          : solidPaint("rgba(255,255,255,0.035)")
    ];
    component.strokes = [
      state === "Selected" || state === "Focus"
        ? bindColor(context.lineAccentStrong, "rgba(110,231,249,0.54)")
        : state === "Hover"
          ? bindColor(context.lineStrong, "rgba(221,228,255,0.28)")
          : solidPaint("rgba(0,0,0,0)")
    ];
    await v2AppendComponentText(
      component,
      `${key}/label`,
      "测试文本",
      context,
      13,
      state === "Selected" ? context.text : state === "Default" || state === "Focus" ? context.muted : context.text
    );
  } else if (spec.id === "playback-episode-item") {
    component.effects =
      ["Hover", "Active", "Recommended"].includes(state)
        ? [componentEffect("DROP_SHADOW", "rgba(139,124,255,0.20)", { x: 0, y: 8 }, 20)]
        : state === "Focus"
          ? [componentEffect("DROP_SHADOW", "rgba(110,231,249,0.22)", { x: 0, y: 0 }, 0, 3)]
          : [];
    component.fills = [
      ["Hover", "Active", "Recommended"].includes(state)
        ? bindColor(context.selected, "rgba(139,124,255,0.14)")
        : solidPaint("rgba(255,255,255,0.035)")
    ];
    component.strokes = [
      state === "Active"
        ? solidPaint("rgba(139,124,255,0.34)")
        : ["Recommended", "Hover", "Focus"].includes(state)
          ? bindColor(context.lineAccentStrong, "rgba(110,231,249,0.54)")
          : bindColor(context.line, "rgba(221,228,255,0.10)")
    ];
    await v2AppendComponentText(
      component,
      `${key}/label`,
      "第1集",
      context,
      13,
      ["Hover", "Recommended"].includes(state) ? context.accent2 : context.text,
      null,
      ["Active", "Recommended"].includes(state) ? context.fonts.bold : context.fonts.medium
    );
  } else if (spec.id === "account-device-card") {
    const mobile = combination.Viewport === "Mobile";
    const actionsWidth = mobile ? width - 36 : 176;
    const copyWidth = mobile ? width - 36 : width - 36 - 18 - actionsWidth;
    const copyHeight = mobile ? 152 : 142;
    component.paddingTop = 18;
    component.paddingRight = 18;
    component.paddingBottom = 18;
    component.paddingLeft = 18;
    component.itemSpacing = 18;
    component.primaryAxisAlignItems = "MIN";
    component.counterAxisAlignItems = mobile ? "MIN" : "CENTER";
    component.fills =
      state === "Hover"
        ? [bindColor(context.surfaceStrong, "rgba(255,255,255,0.085)")]
        : [
            gradientPaint([
              [0, "rgba(255,255,255,0.065)"],
              [0.58, "rgba(23,28,48,0.80)"],
              [1, "rgba(5,7,13,0.88)"]
            ])
          ];
    component.strokes = [
      state === "Hover" ? bindColor(context.lineAccent, "rgba(110,231,249,0.34)") : bindColor(context.line, "rgba(221,228,255,0.16)")
    ];
    component.effects = [
      componentEffect("DROP_SHADOW", state === "Hover" ? "rgba(110,231,249,0.14)" : "rgba(0,0,0,0.24)", { x: 0, y: 18 }, 48),
      componentEffect("INNER_SHADOW", "rgba(255,255,255,0.08)", { x: 0, y: 1 }, 0)
    ];
    const copy = v2CreateFixedFrame(component, `${key}/copy`, "Device Copy", "VERTICAL", copyWidth, copyHeight, 6, context);
    copy.primaryAxisAlignItems = "MIN";
    copy.counterAxisAlignItems = "MIN";
    const titleRow = v2CreateFixedFrame(copy, `${key}/title-row`, "Device Title", "HORIZONTAL", copyWidth, 32, 8, context);
    titleRow.primaryAxisAlignItems = "MIN";
    await v2AppendComponentText(titleRow, `${key}/title`, "测试文本", context, 24, context.text, null, context.fonts.bold);
    if (state === "Current") {
      await v2AppendComponentText(titleRow, `${key}/current`, "当前设备", context, 13, context.accent2, null, context.fonts.bold);
    }
    for (const [index, text] of [
      "最近登录时间：测试文本",
      "最近活动时间：测试文本",
      "登录 IP：测试文本",
      "UA：测试文本"
    ].entries()) {
      await v2AppendComponentText(copy, `${key}/meta/${index}`, text, context, 14, context.muted, copyWidth);
    }
    const actions = v2CreateFixedFrame(component, `${key}/actions`, "Device Actions", "HORIZONTAL", actionsWidth, 40, 12, context);
    actions.primaryAxisAlignItems = mobile ? "MIN" : "MAX";
    actions.counterAxisAlignItems = "CENTER";
    await v2AppendPill(actions, `${key}/status`, "测试文本", context, {
      width: 74,
      fill: solidPaint("rgba(40,199,167,0.14)"),
      stroke: solidPaint("rgba(40,199,167,0.28)"),
      color: context.accent2
    });
    if (state !== "Current") {
      const revoke = v2CreateFixedFrame(actions, `${key}/revoke`, "踢下线", "HORIZONTAL", 90, 40, 0, context);
      revoke.fills = [solidPaint("#d92d20")];
      setRadius(revoke, 12, context.radiusSmall);
      await v2AppendComponentText(revoke, `${key}/revoke/label`, "踢下线", context, 12, null, null, context.fonts.bold);
    }
  } else if (spec.id === "games-game-card") {
    const mobile = combination.Viewport === "Mobile";
    const compactArt = width <= 420;
    const artHeight = mobile ? 200 : 220;
    const copyHeight = height - artHeight;
    const innerWidth = width - 48;
    const metaByGame = {
      "2048": ["数字益智", "键盘 · 滑动"],
      Blockrain: ["经典消除", "键盘 · 触控"],
      Gomoku: ["双人对弈", "实时联机"],
      DrawGuess: ["聚会互动", "2–8 人联机"]
    };
    component.itemSpacing = 0;
    component.primaryAxisAlignItems = "MIN";
    component.counterAxisAlignItems = "MIN";
    setRadius(component, 24, null);
    component.fills = [bindColor(context.panel, "rgba(15,19,34,0.76)")];
    component.strokes = [
      state === "Hover" ? bindColor(context.lineAccentStrong, "rgba(110,231,249,0.54)") : bindColor(context.line, "rgba(221,228,255,0.16)")
    ];
    component.effects =
      state === "Hover"
        ? [
            componentEffect("DROP_SHADOW", "rgba(0,0,0,0.42)", { x: 0, y: 24 }, 56),
            componentEffect("DROP_SHADOW", "rgba(110,231,249,0.16)", { x: 0, y: 0 }, 34)
          ]
        : [componentEffect("DROP_SHADOW", "rgba(0,0,0,0.26)", { x: 0, y: 18 }, 44)];
    await v2CreateGameArtwork(component, `${key}/art`, combination.Game, width, artHeight, context, compactArt);
    const copy = v2CreateFixedFrame(component, `${key}/copy`, "Game Copy", "VERTICAL", width, copyHeight, 7, context);
    copy.paddingTop = mobile ? 20 : 22;
    copy.paddingRight = 24;
    copy.paddingBottom = mobile ? 20 : 22;
    copy.paddingLeft = 24;
    copy.primaryAxisAlignItems = "MIN";
    copy.counterAxisAlignItems = "MIN";
    const meta = v2CreateFixedFrame(copy, `${key}/meta`, "Game Meta", "HORIZONTAL", innerWidth, 18, 12, context);
    meta.primaryAxisAlignItems = "SPACE_BETWEEN";
    await v2AppendComponentText(meta, `${key}/meta/type`, metaByGame[combination.Game][0], context, 12, context.muted, null, context.fonts.bold);
    await v2AppendComponentText(meta, `${key}/meta/input`, metaByGame[combination.Game][1], context, 12, context.muted, null, context.fonts.bold);
    await v2AppendComponentText(copy, `${key}/title`, label, context, 30, context.text, null, context.fonts.bold);
    await v2AppendComponentText(copy, `${key}/body`, "测试文本", context, 13, context.muted, innerWidth);
    const actions = v2CreateFixedFrame(
      copy,
      `${key}/actions`,
      "Game Actions",
      mobile ? "VERTICAL" : "HORIZONTAL",
      innerWidth,
      mobile ? 72 : 40,
      mobile ? 8 : 16,
      context
    );
    actions.primaryAxisAlignItems = mobile ? "MIN" : "SPACE_BETWEEN";
    actions.counterAxisAlignItems = mobile ? "MIN" : "CENTER";
    const start = v2CreateFixedFrame(actions, `${key}/start`, "开始游戏", "HORIZONTAL", 104, 40, 0, context);
    start.fills = [bindColor(context.accent, "#8b7cff")];
    setRadius(start, 12, context.radiusSmall);
    await v2AppendComponentText(start, `${key}/start/label`, "开始游戏", context, 12, null, null, context.fonts.bold);
    await v2AppendComponentText(actions, `${key}/source`, "MIT · GitHub", context, 11, context.muted, null, context.fonts.bold);
  } else if (spec.id === "system-system-box") {
    const mobile = combination.Viewport === "Mobile";
    const padding = mobile ? 20 : 28;
    const innerWidth = width - padding * 2;
    component.paddingTop = padding;
    component.paddingRight = padding;
    component.paddingBottom = padding;
    component.paddingLeft = padding;
    component.itemSpacing = 10;
    component.primaryAxisAlignItems = "MIN";
    component.counterAxisAlignItems = "MIN";
    component.fills = [
      gradientPaint([
        [0, "rgba(255,255,255,0.075)"],
        [0.48, "rgba(15,19,34,0.82)"],
        [1, "rgba(5,7,13,0.92)"]
      ])
    ];
    component.strokes = [solidPaint("rgba(204,226,255,0.24)")];
    component.effects = [
      componentEffect("DROP_SHADOW", "rgba(0,0,0,0.34)", { x: 0, y: 24 }, 58),
      componentEffect("INNER_SHADOW", "rgba(255,255,255,0.08)", { x: 0, y: 1 }, 0)
    ];
    setRadius(component, 24, null);
    await v2AppendComponentText(
      component,
      `${key}/eyebrow`,
      combination.Kind === "Password" ? "访问限制" : combination.Kind === "Fallback" ? "SYSTEM" : "系统",
      context,
      10,
      context.accent2,
      null,
      context.fonts.bold
    );
    await v2AppendComponentText(component, `${key}/title`, label, context, 30, context.text, innerWidth, context.fonts.bold);
    if (combination.Kind === "Password") {
      const form = v2CreateFixedFrame(component, `${key}/form`, "Password Form", "VERTICAL", innerWidth, mobile ? 310 : 320, 12, context);
      form.primaryAxisAlignItems = "MIN";
      form.counterAxisAlignItems = "MIN";
      for (const [index, field] of ["密码", "验证码"].entries()) {
        const group = v2CreateFixedFrame(form, `${key}/field/${index}`, field, "VERTICAL", innerWidth, 74, 6, context);
        group.primaryAxisAlignItems = "MIN";
        group.counterAxisAlignItems = "MIN";
        await v2AppendComponentText(group, `${key}/field/${index}/label`, field, context, 13, context.text, null, context.fonts.bold);
        const input = v2CreateFixedFrame(group, `${key}/field/${index}/input`, `${field} Input`, "HORIZONTAL", innerWidth, 48, 0, context);
        input.paddingLeft = 14;
        input.primaryAxisAlignItems = "MIN";
        input.fills = [bindColor(context.panelSoft, "rgba(23,28,48,0.82)")];
        input.strokes = [bindColor(context.line, "rgba(221,228,255,0.16)")];
        input.strokeWeight = 1;
        setRadius(input, 12, context.radiusSmall);
        await v2AppendComponentText(input, `${key}/field/${index}/input/placeholder`, field, context, 12, context.muted);
      }
      const verifyCode = v2CreateFixedFrame(form, `${key}/verify-code`, "Captcha Placeholder", "HORIZONTAL", innerWidth, 48, 0, context);
      verifyCode.fills = [bindColor(context.panelSoft, "rgba(23,28,48,0.82)")];
      verifyCode.strokes = [bindColor(context.line, "rgba(221,228,255,0.16)")];
      verifyCode.strokeWeight = 1;
      verifyCode.dashPattern = [6, 4];
      setRadius(verifyCode, 12, context.radiusSmall);
      await v2AppendComponentText(verifyCode, `${key}/verify-code/label`, "验证码", context, 12, context.muted);
      const confirm = v2CreateFixedFrame(form, `${key}/confirm`, "提交", "HORIZONTAL", innerWidth, 48, 0, context);
      confirm.fills = [bindColor(context.accent, "#8b7cff")];
      setRadius(confirm, 12, context.radiusSmall);
      await v2AppendComponentText(confirm, `${key}/confirm/label`, "提交", context, 13, null, null, context.fonts.bold);
    } else {
      await v2AppendComponentText(component, `${key}/body`, "测试文本", context, 14, context.muted, innerWidth);
      const actions = v2CreateFixedFrame(component, `${key}/actions`, "System Actions", "HORIZONTAL", innerWidth, 44, 12, context);
      actions.primaryAxisAlignItems = "MIN";
      for (const [index, action] of ["确认", "返回"].entries()) {
        const button = v2CreateFixedFrame(actions, `${key}/action/${index}`, action, "HORIZONTAL", 92, 44, 0, context);
        button.fills = [index === 0 ? bindColor(context.accent, "#8b7cff") : bindColor(context.panelSoft, "rgba(23,28,48,0.82)")];
        button.strokes = [index === 0 ? solidPaint("rgba(0,0,0,0)") : bindColor(context.line, "rgba(221,228,255,0.16)")];
        button.strokeWeight = index === 0 ? 0 : 1;
        setRadius(button, 12, context.radiusSmall);
        await v2AppendComponentText(button, `${key}/action/${index}/label`, action, context, 12, null, null, context.fonts.bold);
      }
    }
  } else if (spec.id === "form-password-toggle") {
    component.fills = [
      state === "Hover" ? solidPaint("rgba(255,255,255,0.07)") : solidPaint("rgba(0,0,0,0)")
    ];
    component.strokes = [
      state === "Focus" ? bindColor(context.lineAccentStrong, "rgba(110,231,249,0.54)") : solidPaint("rgba(0,0,0,0)")
    ];
    const eyeIcon = tag(figma.createFrame(), `${key}/eye-icon`, "P3");
    eyeIcon.name = "Eye Icon";
    eyeIcon.resize(22, 22);
    eyeIcon.fills = [];
    eyeIcon.clipsContent = false;
    component.appendChild(eyeIcon);
    const eye = tag(figma.createEllipse(), `${key}/eye`, "P3");
    eye.resize(22, 14);
    eye.fills = [];
    eye.strokes = [bindColor(context.text, "#f4f6ff")];
    eye.strokeWeight = 1.6;
    eyeIcon.appendChild(eye);
    eye.x = 0;
    eye.y = 4;
    const pupil = tag(figma.createEllipse(), `${key}/pupil`, "P3");
    pupil.resize(6, 6);
    pupil.fills = [bindColor(context.text, "#f4f6ff")];
    eyeIcon.appendChild(pupil);
    pupil.x = 8;
    pupil.y = 8;
    if (combination.Visibility === "Visible") {
      const slash = tag(figma.createLine(), `${key}/slash`, "P3");
      slash.resize(22, 1);
      slash.strokes = [bindColor(context.text, "#f4f6ff")];
      slash.strokeWeight = 1.6;
      slash.rotation = -42;
      eyeIcon.appendChild(slash);
      slash.x = 0;
      slash.y = 11;
    }
  } else if (spec.id === "games-blockrain-control") {
    component.paddingTop = state === "Pressed" ? 8 : 7;
    component.paddingRight = 4;
    component.paddingBottom = state === "Pressed" ? 6 : 7;
    component.paddingLeft = 4;
    component.itemSpacing = 2;
    component.effects =
      state === "Focus" ? [componentEffect("DROP_SHADOW", "rgba(110,231,249,0.22)", { x: 0, y: 0 }, 0, 3)] : [];
    component.fills = [
      state === "Hover" || state === "Focus"
        ? bindColor(context.selected, "rgba(139,124,255,0.18)")
        : bindColor(context.panel, "rgba(15,19,34,0.86)")
    ];
    component.strokes = [
      state === "Default" || state === "Pressed"
        ? bindColor(context.lineAccent, "rgba(110,231,249,0.34)")
        : bindColor(context.lineAccentStrong, "rgba(110,231,249,0.54)")
    ];
    await v2AppendComponentText(component, `${key}/arrow`, "←", context, 22, context.text, null, context.fonts.bold);
    await v2AppendComponentText(component, `${key}/label`, label, context, 10, context.muted, null, context.fonts.bold);
  } else {
    await v2AppendComponentText(component, `${key}/label`, label, context, 13);
  }
  component.description = `${spec.name} · ${v2VariantName(combination)} · source-backed default-theme reference · media policy=placeholder · dynamic copy=测试文本.`;
  component.setSharedPluginData(NS, "component_revision", V2_COMPONENT_REVISION);
  return component;
}

function v2ChangeToReaction(destinationId, trigger, duration = 0.2, transitionType = "SMART_ANIMATE") {
  return {
    trigger: { type: trigger },
    actions: [
      {
        type: "NODE",
        destinationId,
        navigation: "CHANGE_TO",
        transition: {
          type: transitionType,
          easing: { type: "EASE_OUT" },
          duration
        },
        resetScrollPosition: false
      }
    ]
  };
}

async function v2ApplyComponentReactions(componentSet, spec) {
  const components = componentSet.children.filter((node) => node.type === "COMPONENT");
  for (const component of components) {
    const state = v2CombinationValue(component, "State");
    const sibling = (targetState) =>
      components.find((candidate) => {
        if (v2CombinationValue(candidate, "State") !== targetState) return false;
        return Object.keys(spec.dimensions)
          .filter((property) => property !== "State")
          .every((property) => v2CombinationValue(candidate, property) === v2CombinationValue(component, property));
      });
    const reactions = [];
    const hover = sibling("Hover");
    const selected = sibling("Selected") || sibling("Active") || sibling("Current");
    const pressed = sibling("Pressed");
    const instant = spec.id === "navigation-nav-item" ? "DISSOLVE" : "SMART_ANIMATE";
    const duration = spec.id === "navigation-nav-item" ? 0.01 : 0.2;
    if (state === "Default" && hover) reactions.push(v2ChangeToReaction(hover.id, "ON_HOVER", duration, instant));
    if (
      (state === "Default" || state === "Hover") &&
      selected &&
      ["navigation-nav-item", "selection-filter-option", "playback-episode-item"].includes(spec.id)
    ) {
      reactions.push(v2ChangeToReaction(selected.id, "ON_CLICK", 0.18, "SMART_ANIMATE"));
    }
    if ((state === "Default" || state === "Hover") && pressed) {
      reactions.push(v2ChangeToReaction(pressed.id, "ON_PRESS", 0.01, "DISSOLVE"));
    }
    if (spec.id === "form-password-toggle" && ["Default", "Hover"].includes(state)) {
      const targetVisibility = v2CombinationValue(component, "Visibility") === "Visible" ? "Hidden" : "Visible";
      const visibilityTarget = components.find(
        (candidate) =>
          v2CombinationValue(candidate, "State") === state &&
          v2CombinationValue(candidate, "Visibility") === targetVisibility
      );
      if (visibilityTarget) {
        reactions.push(v2ChangeToReaction(visibilityTarget.id, "ON_CLICK", 0.12, "DISSOLVE"));
      }
    }
    await component.setReactionsAsync(reactions);
  }
}

async function buildV2ComponentFamily(componentId) {
  await requireP3Complete();
  const spec = V2_COMPONENT_SPECS.find((item) => item.id === componentId);
  if (!spec) throw new Error(`Unknown v2 component family: ${componentId}`);
  const { page } = await ensurePlannedPage("02 · Components");
  assertMutableTargetPage(page);
  await figma.setCurrentPageAsync(page);
  const context = await docContext();
  const key = `v2/component/${spec.id}`;
  const combinations = v2VariantCombinations(spec.dimensions);
  const expectedVariantNames = combinations.map(v2VariantName).sort();
  const existingSet = await v2FindComponentSet(page, `${key}/set`);
  const existingVariantNames = existingSet
    ? existingSet.children.filter((node) => node.type === "COMPONENT").map((node) => node.name).sort()
    : [];
  const existingRevision = existingSet ? existingSet.getSharedPluginData(NS, "component_revision") : "";
  if (
    existingSet &&
    existingRevision === V2_COMPONENT_REVISION &&
    JSON.stringify(existingVariantNames) === JSON.stringify(expectedVariantNames)
  ) {
    await v2ApplyComponentReactions(existingSet, spec);
    figma.currentPage.selection = [existingSet];
    figma.viewport.scrollAndZoomIntoView([existingSet]);
    return `V2 COMPONENT · UPDATED IN PLACE\nfamily=${spec.name}\nset=${existingSet.id}\nvariants=${existingSet.children.length}`;
  }
  if (existingSet) {
    const generatedRoot = page.children.find((node) => entityKey(node) === key);
    if (!generatedRoot) throw new Error(`Generated root missing for incompatible component set: ${spec.name}`);
    generatedRoot.remove();
  }
  const root = tag(createAutoFrame(`${spec.name} / Source-backed`, "VERTICAL", 1440, 24), key, "P3");
  root.paddingTop = 48;
  root.paddingRight = 48;
  root.paddingBottom = 64;
  root.paddingLeft = 48;
  root.fills = [bindColor(context.canvas, "#05070d")];
  page.appendChild(root);
  placeAwayFromExisting(page, root);
  await addOwnedText(root, `${key}/title`, spec.name, context, {
    font: context.fonts.bold,
    size: 32,
    width: 1344,
    phase: "P3"
  });
  await addOwnedText(
    root,
    `${key}/meta`,
    "Default theme · source-backed states only · media is placeholder-only · Hover reactions apply to desktop/fine-pointer prototypes.",
    context,
    { color: context.muted, fallback: "#9da6bd", size: 12, width: 1344, phase: "P3" }
  );
  const holder = tag(figma.createFrame(), `${key}/holder`, "P3");
  holder.name = `${spec.name} / Variant Holder`;
  holder.fills = [];
  holder.resize(1344, 1);
  root.appendChild(holder);
  const components = [];
  const componentLayout = {
    "media-placeholder": { columns: 3, columnWidth: 340, rowHeight: 250 },
    "navigation-nav-item": { columns: 4, columnWidth: 90, rowHeight: 74 },
    "content-category-tile": { columns: 3, columnWidth: 360, rowHeight: 180 },
    "selection-filter-option": { columns: 4, columnWidth: 110, rowHeight: 74 },
    "playback-episode-item": { columns: 5, columnWidth: 180, rowHeight: 74 },
    "account-device-card": { columns: 1, columnWidth: 1408, rowHeight: 280 },
    "games-game-card": { columns: 2, columnWidth: 700, rowHeight: 480 },
    "system-system-box": { columns: 2, columnWidth: 600, rowHeight: 490 },
    "form-password-toggle": { columns: 3, columnWidth: 100, rowHeight: 80 },
    "games-blockrain-control": { columns: 4, columnWidth: 100, rowHeight: 80 }
  }[spec.id];
  const columnWidth = componentLayout.columnWidth;
  const rowHeight = componentLayout.rowHeight;
  const columns = Math.max(1, Math.min(componentLayout.columns, combinations.length));
  for (let index = 0; index < combinations.length; index += 1) {
    const combination = combinations[index];
    const component = await v2CreateComponentVariant(spec, combination, context, `${key}/variant/${v2VariantName(combination)}`);
    holder.appendChild(component);
    component.x = (index % columns) * columnWidth;
    component.y = Math.floor(index / columns) * rowHeight;
    components.push(component);
  }
  const rows = Math.ceil(combinations.length / columns);
  holder.resize(columns * columnWidth, rows * rowHeight);
  root.resize(Math.max(1440, columns * columnWidth + 96), Math.max(1, root.height));
  const componentSet = tag(figma.combineAsVariants(components, holder), `${key}/set`, "P3");
  componentSet.name = spec.name;
  componentSet.description = `Current code ${PLAN.source.branch}@${PLAN.source.commit}. Source-backed states only.`;
  componentSet.setSharedPluginData(NS, "component_revision", V2_COMPONENT_REVISION);
  componentSet.children.forEach((component, index) => {
    component.x = (index % columns) * columnWidth;
    component.y = Math.floor(index / columns) * rowHeight;
  });
  componentSet.resize(columns * columnWidth, rows * rowHeight);
  await v2ApplyComponentReactions(componentSet, spec);
  figma.currentPage.selection = [componentSet];
  figma.viewport.scrollAndZoomIntoView([componentSet]);
  figma.commitUndo();
  return `V2 COMPONENT · CREATED\nfamily=${spec.name}\nset=${componentSet.id}\nvariants=${componentSet.children.length}`;
}

async function validateV2ComponentFamily(componentId) {
  const spec = V2_COMPONENT_SPECS.find((item) => item.id === componentId);
  if (!spec) throw new Error(`Unknown v2 component family: ${componentId}`);
  const page = figma.root.children.find((item) => item.name === "02 · Components");
  if (!page) return `V2 COMPONENT VALIDATION · PENDING\nmissing page=02 · Components`;
  await page.loadAsync();
  const key = `v2/component/${spec.id}`;
  const componentSet = await v2FindComponentSet(page, `${key}/set`);
  if (!componentSet) return `V2 COMPONENT VALIDATION · PENDING\nmissing family=${spec.name}`;
  const issues = [];
  const expectedNames = v2VariantCombinations(spec.dimensions).map(v2VariantName).sort();
  const variants = componentSet.children.filter((node) => node.type === "COMPONENT");
  const actualNames = variants.map((node) => node.name).sort();
  if (componentSet.getSharedPluginData(NS, "component_revision") !== V2_COMPONENT_REVISION) {
    issues.push("component revision mismatch");
  }
  if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
    issues.push(`variant names/count mismatch ${actualNames.length}/${expectedNames.length}`);
  }
  let reactions = 0;
  for (const variant of variants) {
    if (variant.layoutMode === "NONE") issues.push(`${variant.name} is not Auto Layout`);
    reactions += (await componentReactionCount(variant));
  }
  const expectedReactionCounts = {
    "media-placeholder": 5,
    "navigation-nav-item": 3,
    "content-category-tile": 3,
    "selection-filter-option": 6,
    "playback-episode-item": 9,
    "account-device-card": 3,
    "games-game-card": 12,
    "system-system-box": 0,
    "form-password-toggle": 6,
    "games-blockrain-control": 6
  };
  if (reactions !== expectedReactionCounts[spec.id]) {
    issues.push(`reactions=${reactions}/${expectedReactionCounts[spec.id]}`);
  }
  for (let leftIndex = 0; leftIndex < variants.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < variants.length; rightIndex += 1) {
      const left = variants[leftIndex].absoluteBoundingBox;
      const right = variants[rightIndex].absoluteBoundingBox;
      if (left && right && boxesOverlap(left, right)) {
        issues.push("component variants overlap");
        leftIndex = variants.length;
        break;
      }
    }
  }
  if (spec.dimensions.State && spec.dimensions.State.includes("Hover")) {
    for (const variant of variants.filter((node) => v2CombinationValue(node, "State") === "Default")) {
      const hover = variants.find(
        (candidate) =>
          v2CombinationValue(candidate, "State") === "Hover" &&
          Object.keys(spec.dimensions)
            .filter((property) => property !== "State")
            .every(
              (property) =>
                v2CombinationValue(candidate, property) === v2CombinationValue(variant, property)
            )
      );
      if (hover && a01RecursiveVisualSignature(variant) === a01RecursiveVisualSignature(hover)) {
        issues.push(`${variant.name} hover is visually identical`);
      }
    }
  }
  return [
    `V2 COMPONENT VALIDATION · ${issues.length ? "FAIL" : "PASS"}`,
    `family=${spec.name}`,
    `revision=${V2_COMPONENT_REVISION}`,
    `variants=${variants.length}/${expectedNames.length}`,
    `reactions=${reactions}/${expectedReactionCounts[spec.id]}`,
    `issues=${issues.length}`,
    ...(issues.length ? issues.map((issue) => `- ${issue}`) : ["- none"])
  ].join("\n");
}

async function buildNextV2ComponentFamily() {
  const page = figma.root.children.find((item) => item.name === "02 · Components");
  for (const spec of V2_COMPONENT_SPECS) {
    let stale = true;
    if (page) {
      await page.loadAsync();
      const set = await v2FindComponentSet(page, `v2/component/${spec.id}/set`);
      const expectedNames = v2VariantCombinations(spec.dimensions).map(v2VariantName).sort();
      const actualNames = set
        ? set.children.filter((node) => node.type === "COMPONENT").map((node) => node.name).sort()
        : [];
      stale =
        !set ||
        set.getSharedPluginData(NS, "component_revision") !== V2_COMPONENT_REVISION ||
        JSON.stringify(actualNames) !== JSON.stringify(expectedNames);
    }
    if (stale) return buildV2ComponentFamily(spec.id);
  }
  return "V2 COMPONENTS · COMPLETE\nNo pending V2 component family.";
}

async function validateAllV2ComponentFamilies() {
  const failures = [];
  let passed = 0;
  for (const spec of V2_COMPONENT_SPECS) {
    const report = await validateV2ComponentFamily(spec.id);
    if (report.startsWith("V2 COMPONENT VALIDATION · PASS")) passed += 1;
    else failures.push(`${spec.name}: ${report.split("\n")[0]}`);
  }
  return [
    `V2 ALL COMPONENTS · ${failures.length ? "FAIL" : "PASS"}`,
    `families=${passed}/${V2_COMPONENT_SPECS.length}`,
    `issues=${failures.length}`,
    ...(failures.length ? failures.map((issue) => `- ${issue}`) : ["- none"])
  ].join("\n");
}

function v2NodeHaystack(node) {
  const texts =
    "findAllWithCriteria" in node
      ? node
          .findAllWithCriteria({ types: ["TEXT"] })
          .slice(0, 24)
          .map((text) => text.characters)
          .join(" ")
      : "";
  return `${node.name || ""} ${texts}`.toLowerCase();
}

function v2EvidenceRoots(rawPage, archetype) {
  const needles = V2_EVIDENCE_NEEDLES[archetype.id] || [];
  const signatures = V2_EVIDENCE_TEXT_SIGNATURES[archetype.id] || [];
  const entries = rawPage.children
    .map((root) => {
      const haystack = v2NodeHaystack(root);
      return {
        root,
        haystack,
        score: needles.reduce(
          (score, needle, index) => score + (haystack.includes(needle.toLowerCase()) ? 100 - index : 0),
          0
        ),
        signatureScore: signatures.reduce(
          (score, signature, index) => score + (haystack.includes(signature.toLowerCase()) ? 1000 - index : 0),
          0
        ),
        height1440: v2ViewportSource(root, 1440)?.height || 0
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.signatureScore - left.signatureScore || right.score - left.score);
  if (archetype.id === "A17") {
    entries.sort(
      (left, right) =>
        right.signatureScore - left.signatureScore || left.height1440 - right.height1440 || right.score - left.score
    );
  } else if (archetype.id === "A18") {
    entries.sort(
      (left, right) =>
        right.signatureScore - left.signatureScore || right.height1440 - left.height1440 || right.score - left.score
    );
  }
  return entries;
}

function v2ViewportSource(root, width) {
  const candidates = [
    root,
    ...("findAllWithCriteria" in root ? root.findAllWithCriteria({ types: ["FRAME", "COMPONENT", "INSTANCE"] }) : [])
  ]
    .filter((node) => node.visible && Math.abs(node.width - width) <= 2)
    .sort((left, right) => {
      const depth = frameDepthFrom(left, root) - frameDepthFrom(right, root);
      return depth || right.height - left.height;
    });
  return candidates[0] || null;
}

function v2NodeDimensions(node) {
  const box = node.absoluteBoundingBox;
  return { width: box ? box.width : node.width || 0, height: box ? box.height : node.height || 0 };
}

function v2KeepImageNode(node) {
  const name = String(node.name || "").toLowerCase();
  const { width, height } = v2NodeDimensions(node);
  const brandAsset = /logo|emblem/.test(name) && width <= 240 && height <= 96;
  const smallUiAsset = /icon|symbol/.test(name) && width <= 64 && height <= 64;
  return brandAsset || smallUiAsset;
}

function v2IsDynamicTextNode(node, archetype) {
  const value = String(node.characters || "").replace(/\s+/g, " ").trim();
  if (!value || V2_STRUCTURAL_COPY.test(value)) return false;
  if (/^(?:\d+|8\.0|20\d{2}|ABC234|[<>/·•—–+\-=：:（）()]+)$/.test(value)) return false;
  const ancestry = [];
  let current = node.parent;
  while (current && current.type !== "PAGE") {
    ancestry.push(String(current.name || "").toLowerCase());
    current = current.parent;
  }
  const roles = ancestry.join(" ");
  const dynamicRole =
    /poster|vod|banner|rank|shelf|continue|detail|timeline|list-item|record|favorite|device-meta|plot|comment-body|comment-user|guest-message|report-content|download-item|player-title|room-player|participant/.test(
      roles
    );
  return dynamicRole;
}

function v2TestText(value) {
  const labeledValue = String(value || "").match(
    /^(导演|主演|演员|类型|地区|语言|年份|片长|画质|设备|系统|浏览器|位置|最近登录时间|IP|关键词|评分)\s*([：:])\s*.+$/
  );
  if (labeledValue) return `${labeledValue[1]}${labeledValue[2]}测试文本`;
  return "测试文本";
}

async function v2LoadTextFonts(node, cache) {
  const fonts = node.getRangeAllFontNames(0, node.characters.length);
  for (const font of fonts) {
    const key = `${font.family}/${font.style}`;
    if (!cache.has(key)) cache.set(key, figma.loadFontAsync(font));
    await cache.get(key);
  }
}

async function v2SanitizeClone(clone, archetype) {
  const nodes = [clone, ...("findAll" in clone ? clone.findAll(() => true) : [])];
  const fontCache = new Map();
  let imageReplacements = 0;
  let textReplacements = 0;
  await clearClonedReactions(clone);
  for (const node of nodes) {
    if ("fills" in node && Array.isArray(node.fills) && node.fills.some((paint) => paint.type === "IMAGE") && !v2KeepImageNode(node)) {
      node.fills = node.fills.map((paint) =>
        paint.type === "IMAGE"
          ? gradientPaint([
              [0, "#171c30"],
              [0.5, "#222644"],
              [1, "#2b2147"]
            ])
          : paint
      );
      node.name = `Media Placeholder / ${node.name || node.type}`;
      node.setSharedPluginData(NS, "content_policy", "placeholder");
      imageReplacements += 1;
    }
    if (node.type === "TEXT" && v2IsDynamicTextNode(node, archetype)) {
      await v2LoadTextFonts(node, fontCache);
      node.characters = v2TestText(node.characters);
      node.setSharedPluginData(NS, "content_policy", "测试文本");
      textReplacements += 1;
    }
  }
  return { imageReplacements, textReplacements };
}

async function v2CreateFallbackFrame(archetype, width, context, key) {
  const height = width === 1440 ? 960 : width === 768 ? 1024 : 844;
  const screen = tag(figma.createFrame(), key, "P4");
  screen.name = `${archetype.id} · ${width} · Code-derived`;
  screen.resize(width, height);
  screen.layoutMode = "VERTICAL";
  screen.primaryAxisSizingMode = "FIXED";
  screen.counterAxisSizingMode = "FIXED";
  screen.clipsContent = true;
  screen.fills = [bindColor(context.canvas, "#05070d")];
  const horizontalPadding = width === 1440 ? 56 : width === 768 ? 32 : 18;
  const header = tag(createAutoFrame("Site Header", "HORIZONTAL", width, 12), `${key}/header`, "P4");
  header.resize(width, width === 390 ? 58 : 72);
  header.primaryAxisAlignItems = "SPACE_BETWEEN";
  header.counterAxisAlignItems = "CENTER";
  header.paddingLeft = horizontalPadding;
  header.paddingRight = horizontalPadding;
  header.fills = [bindColor(context.panel, "rgba(15, 19, 34, 0.76)")];
  screen.appendChild(header);
  await v2AppendComponentText(header, `${key}/brand`, "平方视频", context, width === 390 ? 14 : 16);
  await v2AppendComponentText(header, `${key}/nav`, width === 390 ? "☰" : "首页　视频　游戏　搜索", context, width === 390 ? 18 : 13);

  const main = tag(createAutoFrame("Main", "VERTICAL", width, 24), `${key}/main`, "P4");
  main.paddingTop = width === 390 ? 24 : 40;
  main.paddingRight = horizontalPadding;
  main.paddingBottom = 48;
  main.paddingLeft = horizontalPadding;
  main.fills = [];
  screen.appendChild(main);
  await v2AppendComponentText(main, `${key}/eyebrow`, archetype.family.toUpperCase(), context, 11, context.accent2);
  await v2AppendComponentText(
    main,
    `${key}/title`,
    ["system", "content"].includes(archetype.family) ? "当前模块暂未配置模板内容" : archetype.id === "A17" ? "登录后可使用游戏中心" : "测试文本",
    context,
    width === 390 ? 28 : 40
  );
  await v2AppendComponentText(
    main,
    `${key}/body`,
    "测试文本",
    context,
    14,
    context.muted
  );
  const content = tag(createAutoFrame("Content Surface", "VERTICAL", width - horizontalPadding * 2, 16), `${key}/surface`, "P4");
  content.paddingTop = 24;
  content.paddingRight = 24;
  content.paddingBottom = 24;
  content.paddingLeft = 24;
  content.fills = [bindColor(context.panel, "rgba(15, 19, 34, 0.76)")];
  content.strokes = [bindColor(context.line, "rgba(221, 228, 255, 0.16)")];
  content.strokeWeight = 1;
  setRadius(content, 18, context.radius);
  main.appendChild(content);
  const columns = width === 1440 ? 4 : width === 768 ? 3 : 2;
  const cardWidth = Math.floor((content.width - 48 - (columns - 1) * 12) / columns);
  const row = tag(createAutoFrame("Placeholder Grid", "HORIZONTAL", content.width - 48, 12), `${key}/grid`, "P4");
  row.layoutWrap = "WRAP";
  content.appendChild(row);
  for (let index = 0; index < Math.min(columns * 2, 8); index += 1) {
    const card = tag(createAutoFrame(`Card ${index + 1}`, "VERTICAL", cardWidth, 8), `${key}/card/${index + 1}`, "P4");
    card.paddingTop = 8;
    card.paddingRight = 8;
    card.paddingBottom = 12;
    card.paddingLeft = 8;
    card.fills = [bindColor(context.surface, "rgba(255, 255, 255, 0.045)")];
    card.strokes = [bindColor(context.line, "rgba(221, 228, 255, 0.16)")];
    card.strokeWeight = 1;
    setRadius(card, 18, context.radius);
    row.appendChild(card);
    const media = tag(figma.createRectangle(), `${key}/card/${index + 1}/media`, "P4");
    media.resize(cardWidth - 16, Math.max(90, Math.round((cardWidth - 16) * 1.5)));
    media.name = "Media Placeholder / Poster";
    media.fills = [
      gradientPaint([
        [0, "#171c30"],
        [1, "#2b2147"]
      ])
    ];
    setRadius(media, 12, context.radiusSmall);
    card.appendChild(media);
    await v2AppendComponentText(card, `${key}/card/${index + 1}/title`, "测试文本", context, 13);
  }
  return screen;
}

async function v2CreateStateMatrix(archetype, context, key, width) {
  const matrix = tag(createAutoFrame(`${archetype.id} / States`, "HORIZONTAL", width, 12), `${key}/states`, "P4");
  matrix.layoutWrap = "WRAP";
  matrix.counterAxisAlignItems = "MIN";
  for (const [index, state] of (V2_STATE_FACTS[archetype.id] || archetype.states).entries()) {
    const card = tag(createAutoFrame(state, "VERTICAL", 248, 7), `${key}/state/${index}`, "P4");
    card.paddingTop = 16;
    card.paddingRight = 16;
    card.paddingBottom = 16;
    card.paddingLeft = 16;
    card.fills = [bindColor(context.panel, "rgba(15, 19, 34, 0.76)")];
    card.strokes = [bindColor(context.line, "rgba(221, 228, 255, 0.16)")];
    card.strokeWeight = 1;
    setRadius(card, 14, context.radiusSmall);
    matrix.appendChild(card);
    await v2AppendComponentText(card, `${key}/state/${index}/label`, state, context, 13);
    await v2AppendComponentText(card, `${key}/state/${index}/source`, "Current code", context, 10, context.muted);
  }
  return matrix;
}

async function buildV2Archetype(archetypeId) {
  await requireP3Complete();
  const archetype = PLAN.archetypes.find((item) => item.id === archetypeId);
  if (!archetype) throw new Error(`Unknown archetype: ${archetypeId}`);
  if (archetype.id === "A01") return buildA01Prototype(archetype);
  return buildFormalArchetype(archetype);
  const rawPage = figma.root.children.find((page) => isRawEvidencePage(page));
  if (!rawPage) throw new Error("Protected Raw Evidence page missing.");
  await rawPage.loadAsync();
  const evidenceRoots = v2EvidenceRoots(rawPage, archetype);
  const { page } = await ensurePlannedPage(archetype.figmaPage);
  assertMutableTargetPage(page);
  await figma.setCurrentPageAsync(page);
  const context = await docContext();
  const key = `v2/prototype/${archetype.id}`;
  const root = await ensureOwnedReferenceRoot(page, key, `${archetype.id} · ${archetype.name} / Default Theme`, "P4", context, 3000);
  bindReferenceRootSpacing(root, context, 24, 3000);
  root.fills = [bindColor(context.canvas, "#05070d")];
  await addOwnedText(root, `${key}/title`, `${archetype.id} · ${archetype.name}`, context, {
    font: context.fonts.bold,
    size: 40,
    width: 2872,
    phase: "P4"
  });
  await addOwnedText(
    root,
    `${key}/meta`,
    [
      `Route: ${archetype.route}`,
      `Theme: default / Liquid Cinema · full prototype coverage`,
      `Media: placeholder only · dynamic copy: 测试文本 · structural copy preserved`,
      `Evidence: ${evidenceRoots.length ? evidenceRoots.map((entry) => `${entry.root.name} · ${entry.root.id}`).join(" | ") : "code-derived fallback"}`
    ].join("\n"),
    context,
    { color: context.muted, fallback: "#9da6bd", size: 12, width: 2872, phase: "P4" }
  );
  const row = tag(createAutoFrame(`${archetype.id} / Responsive`, "HORIZONTAL", 2872, 24), `${key}/viewports`, "P4");
  row.counterAxisAlignItems = "MIN";
  root.appendChild(row);
  let mediaReplacements = 0;
  let textReplacements = 0;
  let evidenceFrames = 0;
  for (const width of RAW_EVIDENCE_VIEWPORTS) {
    let source = null;
    let sourceRoot = null;
    for (const entry of evidenceRoots) {
      source = v2ViewportSource(entry.root, width);
      if (source) {
        sourceRoot = entry.root;
        break;
      }
    }
    let frame;
    if (source) {
      frame = tag(source.clone(), `${key}/viewport/${width}`, "P4");
      frame.name = `${archetype.id} · ${width} · Raw-derived`;
      const sanitized = await v2SanitizeClone(frame, archetype);
      mediaReplacements += sanitized.imageReplacements;
      textReplacements += sanitized.textReplacements;
      frame.setSharedPluginData(NS, "raw_source_node_id", source.id);
      frame.setSharedPluginData(NS, "raw_top_level_root_id", sourceRoot.id);
      frame.setSharedPluginData(NS, "raw_capture_url", sourceRoot.name || "");
      frame.setSharedPluginData(NS, "viewport", String(width));
      frame.setSharedPluginData(NS, "source_commit", PLAN.source.commit);
      evidenceFrames += 1;
    } else {
      frame = await v2CreateFallbackFrame(archetype, width, context, `${key}/viewport/${width}`);
      frame.setSharedPluginData(NS, "source_kind", "code-derived");
      frame.setSharedPluginData(NS, "viewport", String(width));
      frame.setSharedPluginData(NS, "source_commit", PLAN.source.commit);
    }
    if ("layoutPositioning" in frame) frame.layoutPositioning = "AUTO";
    row.appendChild(frame);
  }
  root.appendChild(await v2CreateStateMatrix(archetype, context, key, 2872));
  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
  figma.commitUndo();
  return [
    "V2 DEFAULT PROTOTYPE · APPLIED",
    `archetype=${archetype.id} · ${archetype.name}`,
    `page=${page.name} · ${page.id}`,
    `root=${root.id}`,
    `responsiveFrames=3`,
    `rawDerived=${evidenceFrames}`,
    `codeDerived=${3 - evidenceFrames}`,
    `mediaPlaceholders=${mediaReplacements}`,
    `testTextReplacements=${textReplacements}`
  ].join("\n");
}

async function validateV2Archetype(archetypeId) {
  const archetype = PLAN.archetypes.find((item) => item.id === archetypeId);
  if (!archetype) throw new Error(`Unknown archetype: ${archetypeId}`);
  if (archetype.id === "A01") return validateA01Prototype(archetype);
  return validateFormalArchetype(archetype);
  const page = figma.root.children.find((item) => item.name === archetype.figmaPage);
  if (!page) return `V2 PROTOTYPE VALIDATION · PENDING\nmissing page=${archetype.figmaPage}`;
  await page.loadAsync();
  const key = `v2/prototype/${archetype.id}`;
  const root = page.children.find((node) => entityKey(node) === key);
  const issues = [];
  if (!root) issues.push("prototype root missing");
  if (root) {
    if (root.clipsContent) issues.push("prototype root clips content");
    for (const width of RAW_EVIDENCE_VIEWPORTS) {
      const frame = root.findOne((node) => entityKey(node) === `${key}/viewport/${width}`);
      if (!frame) {
        issues.push(`viewport ${width} missing`);
        continue;
      }
      if (Math.abs(frame.width - width) > 2) issues.push(`viewport ${width} width=${frame.width}`);
      const leakedImages = [frame, ...("findAll" in frame ? frame.findAll(() => true) : [])].filter(
        (node) =>
          "fills" in node &&
          Array.isArray(node.fills) &&
          node.fills.some((paint) => paint.type === "IMAGE") &&
          !v2KeepImageNode(node)
      );
      if (leakedImages.length) issues.push(`viewport ${width} contains ${leakedImages.length} non-placeholder media images`);
      const leakedDynamicTexts = [frame, ...("findAll" in frame ? frame.findAll(() => true) : [])].filter(
        (node) =>
          node.type === "TEXT" &&
          v2IsDynamicTextNode(node, archetype) &&
          !String(node.characters || "").includes("测试文本")
      );
      if (leakedDynamicTexts.length) {
        issues.push(`viewport ${width} contains ${leakedDynamicTexts.length} unsanitized dynamic text nodes`);
      }
    }
  }
  return [
    `V2 PROTOTYPE VALIDATION · ${issues.length ? "FAIL" : "PASS"}`,
    `archetype=${archetype.id}`,
    `issues=${issues.length}`,
    ...(issues.length ? issues.map((issue) => `- ${issue}`) : ["- none"])
  ].join("\n");
}

async function buildNextV2Archetype() {
  for (const archetype of PLAN.archetypes) {
    const page = figma.root.children.find((item) => item.name === archetype.figmaPage);
    if (!page) return buildV2Archetype(archetype.id);
    await page.loadAsync();
    const root = page.children.find((node) => entityKey(node) === `v2/prototype/${archetype.id}`);
    if (!root) return buildV2Archetype(archetype.id);
    if (
      archetype.id === "A01" &&
      (root.getSharedPluginData(NS, "source_kind") !== "code-composed" ||
        root.getSharedPluginData(NS, "prototype_revision") !== A01_PROTOTYPE_REVISION)
    ) {
      return buildV2Archetype(archetype.id);
    }
    if (
      archetype.id !== "A01" &&
      (root.getSharedPluginData(NS, "source_kind") !== "code-composed" ||
        root.getSharedPluginData(NS, "prototype_revision") !== FORMAL_PROTOTYPE_REVISION)
    ) {
      return buildV2Archetype(archetype.id);
    }
  }
  return "V2 DEFAULT PROTOTYPES · COMPLETE\nNo pending archetype.";
}

async function validateAllV2Prototypes() {
  const issues = [];
  let roots = 0;
  let frames = 0;
  for (const archetype of PLAN.archetypes) {
    const page = figma.root.children.find((item) => item.name === archetype.figmaPage);
    if (!page) {
      issues.push(`${archetype.id} page missing`);
      continue;
    }
    await page.loadAsync();
    const key = `v2/prototype/${archetype.id}`;
    const root = page.children.find((node) => entityKey(node) === key);
    if (!root) {
      issues.push(`${archetype.id} root missing`);
      continue;
    }
    roots += 1;
    if (archetype.id === "A01") {
      const a01Issues = await collectA01PrototypeIssues(archetype, page, root);
      issues.push(...a01Issues.map((issue) => `${archetype.id} ${issue}`));
    } else {
      const formalIssues = await collectFormalArchetypeIssues(archetype, page, root);
      issues.push(...formalIssues.map((issue) => `${archetype.id} ${issue}`));
    }
    for (const width of RAW_EVIDENCE_VIEWPORTS) {
      const frame = root.findOne((node) => entityKey(node) === `${key}/viewport/${width}`);
      if (!frame) issues.push(`${archetype.id}/${width} missing`);
      else frames += 1;
    }
  }
  const rawPage = figma.root.children.find((page) => isRawEvidencePage(page));
  if (!rawPage) {
    issues.push("Raw Evidence page missing");
  } else {
    await rawPage.loadAsync();
    const signature = protectedPageSignature(rawPage);
    const expectedSignature = PLAN.rawEvidenceProtection && PLAN.rawEvidenceProtection.expectedSignature;
    if (expectedSignature && signature.signature !== expectedSignature) {
      issues.push(`Raw Evidence signature changed ${signature.signature}/${expectedSignature}`);
    }
  }
  return [
    `V2 ALL PROTOTYPES · ${issues.length ? "FAIL" : roots === PLAN.archetypes.length && frames === PLAN.archetypes.length * 3 ? "PASS" : "PENDING"}`,
    `prototypeRoots=${roots}/${PLAN.archetypes.length}`,
    `responsiveFrames=${frames}/${PLAN.archetypes.length * 3}`,
    `issues=${issues.length}`,
    ...(issues.length ? issues.map((issue) => `- ${issue}`) : ["- none"])
  ].join("\n");
}

async function focusV2Archetype(archetypeId) {
  const archetype = PLAN.archetypes.find((item) => item.id === archetypeId);
  if (!archetype) throw new Error(`Unknown archetype: ${archetypeId}`);
  const page = figma.root.children.find((item) => item.name === archetype.figmaPage);
  if (!page) throw new Error(`Missing page: ${archetype.figmaPage}`);
  await page.loadAsync();
  await figma.setCurrentPageAsync(page);
  const key = `v2/prototype/${archetype.id}`;
  const root = page.children.find((node) => entityKey(node) === key);
  if (!root) throw new Error(`Missing prototype root: ${archetype.id}`);
  const desktop = root.findOne((node) => entityKey(node) === `${key}/viewport/1440`);
  const target = desktop || root;
  figma.currentPage.selection = [target];
  figma.viewport.scrollAndZoomIntoView([target]);
  return [
    "V2 PROTOTYPE FOCUSED",
    `archetype=${archetype.id} · ${archetype.name}`,
    `page=${page.name}`,
    `node=${target.id}`,
    `size=${Math.round(target.width)}×${Math.round(target.height)}`
  ].join("\n");
}

async function focusAllV2Components() {
  const page = figma.root.children.find((item) => item.name === "02 · Components");
  if (!page) throw new Error("Missing page: 02 · Components");
  await page.loadAsync();
  await figma.setCurrentPageAsync(page);
  const sets = (
    await Promise.all(V2_COMPONENT_SPECS.map((spec) => v2FindComponentSet(page, `v2/component/${spec.id}/set`)))
  ).filter(Boolean);
  if (!sets.length) throw new Error("No V2 component sets found");
  figma.currentPage.selection = sets;
  figma.viewport.scrollAndZoomIntoView(sets);
  return [
    "V2 COMPONENTS FOCUSED",
    `page=${page.name}`,
    `families=${sets.length}/${V2_COMPONENT_SPECS.length}`
  ].join("\n");
}

const v2LegacyMessageHandler = figma.ui.onmessage;
figma.ui.onmessage = async (message) => {
  if (
    ![
      "apply-v2-component",
      "validate-v2-component",
      "apply-next-v2-component",
      "validate-all-v2-components",
      "apply-v2-archetype",
      "apply-next-v2-archetype",
      "validate-v2-archetype",
      "validate-all-v2-prototypes",
      "focus-v2-archetype",
      "focus-all-v2-components"
    ].includes(message.action)
  ) {
    return v2LegacyMessageHandler(message);
  }
  try {
    let text;
    if (String(message.action).startsWith("apply-")) {
      assertApproval(message.approval);
      await assertTargetFile();
    }
    if (message.action === "apply-v2-component") text = await buildV2ComponentFamily(message.v2ComponentId);
    else if (message.action === "validate-v2-component") text = await validateV2ComponentFamily(message.v2ComponentId);
    else if (message.action === "apply-next-v2-component") text = await buildNextV2ComponentFamily();
    else if (message.action === "validate-all-v2-components") text = await validateAllV2ComponentFamilies();
    else if (message.action === "apply-v2-archetype") text = await buildV2Archetype(message.archetypeId);
    else if (message.action === "apply-next-v2-archetype") text = await buildNextV2Archetype();
    else if (message.action === "validate-v2-archetype") text = await validateV2Archetype(message.archetypeId);
    else if (message.action === "validate-all-v2-prototypes") text = await validateAllV2Prototypes();
    else if (message.action === "focus-v2-archetype") text = await focusV2Archetype(message.archetypeId);
    else if (message.action === "focus-all-v2-components") text = await focusAllV2Components();
    figma.ui.postMessage({ type: "result", text });
  } catch (error) {
    figma.ui.postMessage({ type: "result", text: `ERROR\n${errorText(error)}` });
  }
};
