const FORMAL_PROTOTYPE_REVISION = "liquid-cinema-formal-v1.0";

const FORMAL_PAGE_COPY = {
  A02: ["CATALOG", "分类导航", "按频道与内容类型进入影片库。"],
  A03: ["LIBRARY", "全部影片", "浏览当前影片库中的全部内容。"],
  A04: ["POPULAR", "热播推荐", "按当前热度排序浏览内容。"],
  A05: ["HISTORY", "播放历史", "继续上次尚未看完的内容。"],
  A06: ["FILTER", "影片筛选", "按分类、地区、年份与排序条件筛选。"],
  A07: ["SEARCH", "搜索结果", "展示当前关键词对应的搜索结果。"],
  A08: ["DETAIL", "影片详情", "查看影片信息、播放线路与剧集。"],
  A09: ["PLAYER", "正在播放", "播放当前剧集并切换线路或选集。"],
  A10: ["ACCOUNT", "用户登录", "登录后同步收藏、历史与设备。"],
  A11: ["ACCOUNT", "用户注册", "创建账号并完成基础验证。"],
  A12: ["ACCOUNT", "找回密码", "通过账号信息完成密码找回。"],
  A13: ["ACCOUNT", "用户中心", "查看账号资料与常用入口。"],
  A14: ["ACCOUNT", "播放记录", "管理已同步的播放历史。"],
  A15: ["ACCOUNT", "我的收藏", "管理已收藏的影片内容。"],
  A16: ["SECURITY", "登录设备管理", "查看当前账号的活跃登录设备。"],
  A17: ["GAMES", "游戏大厅", "登录后开启游戏大厅。"],
  A18: ["GAMES", "游戏大厅", "片刻放松，随时开局。"],
  A19: ["GAME", "2048", "本地数字益智游戏。"],
  A20: ["GAME", "Blockrain", "本地经典消除游戏。"],
  A21: ["GAME", "五子棋", "实时房间与回合制对弈。"],
  A22: ["GAME", "你画我猜", "实时房间、绘画与聊天协作。"],
  A23: ["DOWNLOAD", "影片下载", "按播放线路查看当前剧集的下载地址。"],
  A24: ["RESTRICTION", "访问限制", "版权确认与密码访问门槛。"],
  A25: ["PLOT", "分集剧情", "查看影片的剧情目录与详情。"],
  A26: ["COMMENT", "评论", "提交评论并浏览当前讨论。"],
  A27: ["FEEDBACK", "留言与举报", "提交留言、报错或内容举报。"],
  A28: ["CONTENT", "内容目录", "文章、专题、演员、角色与站点目录。"],
  A29: ["CONTENT", "内容详情", "文章、专题、演员、角色与站点详情。"],
  A30: ["SYSTEM", "系统反馈", "跳转提示、动态消息与验证码校验。"]
};

const FORMAL_MEDIA_ARCHETYPES = new Set([
  "A03",
  "A04",
  "A05",
  "A06",
  "A07",
  "A08",
  "A09",
  "A14",
  "A15"
]);

const FORMAL_REQUIRED_PAGE_STATES = ["normal", "loading", "empty", "error", "permission"];

function formalKeyPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formalViewport(width) {
  return a01ViewportName(width);
}

function formalVariantViewport(width, mobileOnly = false) {
  if (mobileOnly) return width === 390 ? "Mobile" : "Desktop";
  return formalViewport(width);
}

function formalAuto(parent, key, name, direction, width, gap, context, options = {}) {
  const frame = tag(createAutoFrame(name, direction, width, gap), key, "P4");
  frame.fills = [];
  frame.clipsContent = false;
  if (options.padding !== undefined) {
    frame.paddingTop = options.padding;
    frame.paddingRight = options.padding;
    frame.paddingBottom = options.padding;
    frame.paddingLeft = options.padding;
  }
  if (options.paddingX !== undefined) {
    frame.paddingRight = options.paddingX;
    frame.paddingLeft = options.paddingX;
  }
  if (options.paddingY !== undefined) {
    frame.paddingTop = options.paddingY;
    frame.paddingBottom = options.paddingY;
  }
  if (options.wrap) {
    frame.layoutWrap = "WRAP";
    if ("counterAxisSpacing" in frame) frame.counterAxisSpacing = options.rowGap || gap;
  }
  if (options.align) frame.counterAxisAlignItems = options.align;
  if (options.justify) frame.primaryAxisAlignItems = options.justify;
  if (options.fill) frame.fills = [options.fill];
  if (options.stroke) {
    frame.strokes = [options.stroke];
    frame.strokeWeight = 1;
  }
  if (options.radius) setRadius(frame, options.radius, options.radiusVariable || null);
  parent.appendChild(frame);
  return frame;
}

function formalPanel(parent, key, name, width, context, options = {}) {
  const panel = formalAuto(parent, key, name, "VERTICAL", width, options.gap || 14, context, {
    padding: options.padding === undefined ? 20 : options.padding
  });
  a01Surface(panel, context, {
    radius: options.radius || 20,
    fill: options.fill || bindColor(context.panel, "rgba(15,19,34,0.76)"),
    stroke: options.stroke || bindColor(context.line, "rgba(221,228,255,0.16)"),
    effects:
      options.effects ||
      [
        componentEffect("DROP_SHADOW", "rgba(0,0,0,0.22)", { x: 0, y: 16 }, 38),
        componentEffect("INNER_SHADOW", "rgba(255,255,255,0.07)", { x: 0, y: 1 }, 0)
      ]
  });
  panel.setSharedPluginData(NS, "module", options.module || formalKeyPart(name));
  return panel;
}

async function formalDynamic(parent, key, context, options = {}) {
  return a01Text(parent, key, "测试文本", context, { ...options, dynamic: true });
}

async function formalStructural(parent, key, value, context, options = {}) {
  return a01Text(parent, key, value, context, { ...options, dynamic: false });
}

function formalSetByName(dependencies, name) {
  const set = dependencies.sets[name];
  if (!set) throw new Error(`Formal prototype dependency missing: ${name}`);
  return set;
}

function formalInstance(dependencies, name, properties, key, options = {}) {
  const instance = a01CreateInstance(formalSetByName(dependencies, name), properties, key, "P4");
  if (options.width && options.height) a01ResizeInstance(instance, options.width, options.height);
  if (options.role) instance.setSharedPluginData(NS, "interaction_role", options.role);
  if (options.contentPolicy) instance.setSharedPluginData(NS, "content_policy", options.contentPolicy);
  return instance;
}

async function formalEnsureDependencies() {
  const base = await a01EnsureComponentDependencies();
  const componentPage = base.componentPage;
  for (const spec of V2_COMPONENT_SPECS) {
    const key = `v2/component/${spec.id}/set`;
    const set = a01ComponentSetByKey(componentPage, key);
    if (!set || set.getSharedPluginData(NS, "component_revision") !== V2_COMPONENT_REVISION) {
      await buildV2ComponentFamily(spec.id);
    }
  }
  for (const build of PLAN.componentBuilds) {
    const key = `p3/component/${build.id}/set`;
    const set = a01ComponentSetByKey(componentPage, key);
    if (!set || set.getSharedPluginData(NS, "component_revision") !== LEGACY_COMPONENT_REVISION) {
      await buildComponentFamily(build.id);
    }
  }
  await componentPage.loadAsync();
  const names = {};
  for (const spec of V2_COMPONENT_SPECS) {
    names[spec.name] = a01ComponentSetByKey(componentPage, `v2/component/${spec.id}/set`);
  }
  for (const build of PLAN.componentBuilds) {
    names[build.name] = a01ComponentSetByKey(componentPage, `p3/component/${build.id}/set`);
  }
  for (const spec of A01_COMPONENT_SPECS) {
    names[spec.name] = a01ComponentSetByKey(componentPage, `${a01ComponentKey(spec)}/set`);
  }
  return { ...base, componentPage, sets: names };
}

async function formalRetargetHeader(header, archetype, dependencies) {
  const navInstances = header.findAllWithCriteria({ types: ["INSTANCE"] }).filter(
    (node) => node.getSharedPluginData(NS, "component_set") === "Navigation/NavItem"
  );
  const labels = ["首页", "视频", "游戏"];
  const current =
    archetype.family === "games"
      ? 2
      : ["catalog", "detail", "player", "content", "feedback"].includes(archetype.family)
        ? 1
        : -1;
  for (let index = 0; index < navInstances.length; index += 1) {
    const target = a01FindVariant(formalSetByName(dependencies, "Navigation/NavItem"), {
      State: index === current ? "Current" : "Default"
    });
    if (target) navInstances[index].swapComponent(target);
    await a01SetInstanceText(navInstances[index], labels[index] || "首页");
  }
}

async function formalAppendHeader(parent, width, context, dependencies, archetype, key) {
  const header = await a01AppendHeader(parent, width, context, dependencies, key);
  header.setSharedPluginData(NS, "formal_archetype", archetype.id);
  await formalRetargetHeader(header, archetype, dependencies);
  return header;
}

async function formalAppendHeading(parent, archetype, width, context, key) {
  const wrap = a01WrapWidth(width);
  const copy = FORMAL_PAGE_COPY[archetype.id];
  const heading = formalAuto(parent, key, "Page Heading", "VERTICAL", wrap, width === 390 ? 8 : 10, context, {
    paddingY: width === 390 ? 24 : 34
  });
  heading.setSharedPluginData(NS, "module", "page-heading");
  await formalStructural(heading, `${key}/eyebrow`, copy[0], context, {
    size: 10,
    color: context.accent2,
    font: context.fonts.bold
  });
  await formalStructural(heading, `${key}/title`, copy[1], context, {
    size: width === 390 ? 32 : 42,
    width: wrap,
    font: context.fonts.bold
  });
  await formalStructural(heading, `${key}/subtitle`, copy[2], context, {
    size: width === 390 ? 13 : 14,
    width: wrap,
    color: context.muted
  });
  return heading;
}

function formalGrid(parent, key, name, width, gap, context) {
  const grid = formalAuto(parent, key, name, "HORIZONTAL", width, gap, context, {
    wrap: true,
    rowGap: gap,
    align: "MIN",
    justify: "MIN"
  });
  grid.setSharedPluginData(NS, "module", formalKeyPart(name));
  return grid;
}

async function formalAppendSectionTitle(parent, key, eyebrow, title, context, width) {
  const heading = formalAuto(parent, key, "Section Heading", "VERTICAL", width, 4, context);
  await formalStructural(heading, `${key}/eyebrow`, eyebrow, context, {
    size: 9,
    color: context.accent2,
    font: context.fonts.bold
  });
  await formalStructural(heading, `${key}/title`, title, context, {
    size: 22,
    width,
    font: context.fonts.bold
  });
  return heading;
}

async function formalAppendCategoryGrid(parent, width, context, dependencies, key, count = 8) {
  const viewport = formalViewport(width);
  const wrap = a01WrapWidth(width);
  const section = formalAuto(parent, key, "Category Grid Section", "VERTICAL", wrap, 16, context);
  section.setSharedPluginData(NS, "module", "category-grid");
  await formalAppendSectionTitle(section, `${key}/heading`, "CHANNELS", "内容分类", context, wrap);
  const grid = formalGrid(section, `${key}/grid`, "Category Grid", wrap, width === 390 ? 12 : 16, context);
  for (let index = 0; index < count; index += 1) {
    const tile = formalInstance(
      dependencies,
      "Content/CategoryTile",
      { Viewport: viewport, State: index === 1 ? "Hover" : index === 2 ? "Focus" : "Default" },
      `${key}/tile/${index}`,
      { role: "category-navigate" }
    );
    grid.appendChild(tile);
  }
  return section;
}

async function formalAppendFilters(parent, width, context, dependencies, key) {
  const wrap = a01WrapWidth(width);
  const viewport = formalVariantViewport(width, true);
  const panel = formalPanel(parent, key, "Filter Panel", wrap, context, {
    gap: 12,
    padding: width === 390 ? 16 : 20,
    module: "filter-panel"
  });
  const rows = width === 390 ? 3 : 4;
  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const row = formalAuto(panel, `${key}/row/${rowIndex}`, "Filter Row", "HORIZONTAL", wrap - (width === 390 ? 32 : 40), 8, context, {
      wrap: true,
      rowGap: 8,
      align: "MIN"
    });
    await formalStructural(row, `${key}/row/${rowIndex}/label`, ["类型", "地区", "年份", "排序"][rowIndex], context, {
      size: 12,
      color: context.muted,
      width: width === 390 ? 46 : 54,
      font: context.fonts.bold
    });
    const optionCount = width === 390 ? 3 : 6;
    for (let index = 0; index < optionCount; index += 1) {
      const option = formalInstance(
        dependencies,
        "Selection/FilterOption",
        { Viewport: viewport, State: index === 0 ? "Selected" : index === 1 ? "Hover" : "Default" },
        `${key}/row/${rowIndex}/option/${index}`,
        { role: "filter-select" }
      );
      row.appendChild(option);
    }
  }
  return panel;
}

async function formalAppendShelfGrid(parent, width, context, dependencies, key, options = {}) {
  const viewport = formalViewport(width);
  const wrap = a01WrapWidth(width);
  const section = formalAuto(parent, key, options.name || "Media Grid Section", "VERTICAL", wrap, 16, context);
  section.setSharedPluginData(NS, "module", options.module || "media-grid");
  await formalAppendSectionTitle(
    section,
    `${key}/heading`,
    options.eyebrow || "LIBRARY",
    options.title || "影片列表",
    context,
    wrap
  );
  const grid = formalGrid(section, `${key}/grid`, "Media Card Grid", wrap, width === 390 ? 12 : 16, context);
  const count = options.count || (width === 1440 ? 12 : width === 768 ? 8 : 4);
  for (let index = 0; index < count; index += 1) {
    const card = formalInstance(
      dependencies,
      "Home/ShelfCard",
      {
        Viewport: viewport,
        State: index === 1 ? "Hover" : index === 2 ? "Focus" : "Default"
      },
      `${key}/card/${index}`,
      { role: "media-detail" }
    );
    if (width === 768) a01ResizeInstance(card, 170, 325);
    grid.appendChild(card);
  }
  return section;
}

async function formalAppendHistoryTimeline(parent, width, context, dependencies, key) {
  const wrap = a01WrapWidth(width);
  const timeline = formalAuto(parent, key, "History Timeline", "VERTICAL", wrap, 12, context);
  timeline.setSharedPluginData(NS, "module", "history-timeline");
  await formalAppendSectionTitle(timeline, `${key}/heading`, "TIMELINE", "观看记录", context, wrap);
  for (let index = 0; index < (width === 390 ? 4 : 6); index += 1) {
    const row = formalPanel(timeline, `${key}/item/${index}`, "History Item", wrap, context, {
      gap: width === 390 ? 10 : 16,
      padding: width === 390 ? 12 : 14,
      module: "history-item"
    });
    row.layoutMode = "HORIZONTAL";
    row.primaryAxisSizingMode = "FIXED";
    row.counterAxisSizingMode = "AUTO";
    const timeWidth = width === 390 ? 54 : 92;
    const time = formalAuto(row, `${key}/item/${index}/time`, "History Time", "VERTICAL", timeWidth, 4, context);
    await formalDynamic(time, `${key}/item/${index}/date`, context, {
      size: 11,
      color: context.muted
    });
    await formalDynamic(time, `${key}/item/${index}/clock`, context, {
      size: 13,
      color: context.accent2,
      font: context.fonts.bold
    });
    const media = formalInstance(
      dependencies,
      "Media/Placeholder",
      { Ratio: "Poster", State: index === 1 ? "Hover" : "Default" },
      `${key}/item/${index}/media`,
      {
        width: width === 390 ? 64 : 76,
        height: width === 390 ? 96 : 114,
        role: "history-media",
        contentPolicy: "placeholder"
      }
    );
    row.appendChild(media);
    const copyWidth = wrap - (width === 390 ? 24 : 28) - timeWidth - media.width - (width === 390 ? 20 : 32);
    const copy = formalAuto(row, `${key}/item/${index}/copy`, "History Copy", "VERTICAL", copyWidth, 6, context);
    await formalDynamic(copy, `${key}/item/${index}/title`, context, {
      size: 15,
      width: copyWidth,
      font: context.fonts.bold
    });
    await formalDynamic(copy, `${key}/item/${index}/progress`, context, {
      size: 12,
      width: copyWidth,
      color: context.muted
    });
    await formalStructural(copy, `${key}/item/${index}/action`, "点击继续播放", context, {
      size: 12,
      color: context.accent2,
      font: context.fonts.bold
    });
    row.setSharedPluginData(NS, "interaction_role", "history-continue");
  }
  return timeline;
}

async function formalAppendSearchResultList(parent, width, context, dependencies, key) {
  const wrap = a01WrapWidth(width);
  const list = formalAuto(parent, key, "Search Result List", "VERTICAL", wrap, 12, context);
  list.setSharedPluginData(NS, "module", "search-result-list");
  await formalAppendSectionTitle(list, `${key}/heading`, "RESULTS", "搜索结果", context, wrap);
  for (let index = 0; index < (width === 390 ? 4 : 6); index += 1) {
    const row = formalPanel(list, `${key}/item/${index}`, "Search Result Item", wrap, context, {
      gap: width === 390 ? 12 : 16,
      padding: width === 390 ? 12 : 14,
      module: "search-result-item"
    });
    row.layoutMode = "HORIZONTAL";
    row.primaryAxisSizingMode = "FIXED";
    row.counterAxisSizingMode = "AUTO";
    const mediaWidth = width === 390 ? 86 : 96;
    const media = formalInstance(
      dependencies,
      "Media/Placeholder",
      { Ratio: "Poster", State: index === 1 ? "Hover" : "Default" },
      `${key}/item/${index}/media`,
      {
        width: mediaWidth,
        height: Math.round(mediaWidth * 1.5),
        role: "search-result-open",
        contentPolicy: "placeholder"
      }
    );
    row.appendChild(media);
    const copyWidth = wrap - (width === 390 ? 24 : 28) - mediaWidth - (width === 390 ? 12 : 16);
    const copy = formalAuto(row, `${key}/item/${index}/copy`, "Search Result Copy", "VERTICAL", copyWidth, 7, context);
    await formalDynamic(copy, `${key}/item/${index}/title`, context, {
      size: width === 390 ? 16 : 19,
      width: copyWidth,
      font: context.fonts.bold
    });
    await formalDynamic(copy, `${key}/item/${index}/actor`, context, {
      size: 12,
      width: copyWidth,
      color: context.accent2
    });
    await formalDynamic(copy, `${key}/item/${index}/summary`, context, {
      size: 13,
      width: copyWidth,
      color: context.muted
    });
    row.setSharedPluginData(NS, "interaction_role", "search-result-open");
  }
  return list;
}

async function formalAppendContinueGrid(parent, width, context, dependencies, key, options = {}) {
  const viewport = formalViewport(width);
  const wrap = a01WrapWidth(width);
  const section = formalAuto(parent, key, options.name || "Record Section", "VERTICAL", wrap, 16, context);
  section.setSharedPluginData(NS, "module", options.module || "record-list");
  await formalAppendSectionTitle(
    section,
    `${key}/heading`,
    options.eyebrow || "HISTORY",
    options.title || "播放记录",
    context,
    wrap
  );
  const grid = formalGrid(section, `${key}/grid`, "Record Grid", wrap, width === 390 ? 12 : 14, context);
  const count = options.count || (width === 1440 ? 8 : width === 768 ? 4 : 3);
  for (let index = 0; index < count; index += 1) {
    const card = formalInstance(
      dependencies,
      "Home/ContinueCard",
      { Viewport: viewport, State: index === 1 ? "Hover" : "Default" },
      `${key}/record/${index}`,
      { role: "record-open" }
    );
    grid.appendChild(card);
  }
  return section;
}

async function formalAppendPagination(parent, width, context, dependencies, key) {
  const wrap = a01WrapWidth(width);
  const viewport = formalVariantViewport(width, true);
  const row = formalAuto(parent, key, "Pagination", "HORIZONTAL", wrap, 8, context, {
    justify: "CENTER",
    align: "CENTER",
    paddingY: 12
  });
  row.setSharedPluginData(NS, "module", "pagination");
  for (let index = 0; index < (width === 390 ? 3 : 5); index += 1) {
    const option = formalInstance(
      dependencies,
      "Selection/FilterOption",
      { Viewport: viewport, State: index === 1 ? "Selected" : index === 2 ? "Hover" : "Default" },
      `${key}/item/${index}`,
      { role: "pagination" }
    );
    row.appendChild(option);
  }
  return row;
}

async function formalAppendEmptyState(parent, width, context, dependencies, key, title = "暂无内容") {
  const wrap = a01WrapWidth(width);
  const panel = formalPanel(parent, key, "Empty State", wrap, context, {
    gap: 8,
    padding: width === 390 ? 24 : 34,
    module: "empty-state"
  });
  await formalStructural(panel, `${key}/title`, title, context, {
    size: 22,
    font: context.fonts.bold
  });
  await formalDynamic(panel, `${key}/body`, context, {
    size: 13,
    color: context.muted
  });
  const action = formalInstance(
    dependencies,
    "Action/StandardButton",
    { Style: "Ghost", State: "Default" },
    `${key}/action`,
    { role: "empty-action" }
  );
  await a01SetInstanceText(action, "返回");
  panel.appendChild(action);
  return panel;
}

async function formalAppendCatalog(parent, archetype, width, context, dependencies, key) {
  if (archetype.id === "A02") {
    await formalAppendCategoryGrid(parent, width, context, dependencies, `${key}/categories`, width === 390 ? 6 : 8);
    return;
  }
  if (archetype.id === "A05") {
    await formalAppendHistoryTimeline(parent, width, context, dependencies, `${key}/records`);
    await formalAppendEmptyState(parent, width, context, dependencies, `${key}/empty`, "暂无播放记录");
    return;
  }
  if (archetype.id === "A06") {
    await formalAppendFilters(parent, width, context, dependencies, `${key}/filters`);
  }
  if (archetype.id === "A07") {
    await formalAppendFilters(parent, width, context, dependencies, `${key}/filters`);
    await formalAppendSearchResultList(parent, width, context, dependencies, `${key}/results`);
    await formalAppendPagination(parent, width, context, dependencies, `${key}/pagination`);
    await formalAppendEmptyState(parent, width, context, dependencies, `${key}/empty`, "没有找到相关影片");
    return;
  }
  await formalAppendShelfGrid(parent, width, context, dependencies, `${key}/results`, {
    eyebrow: archetype.id === "A04" ? "POPULAR" : "RESULTS",
    title: archetype.id === "A04" ? "全站热度" : archetype.id === "A07" ? "搜索结果" : "影片库"
  });
  await formalAppendPagination(parent, width, context, dependencies, `${key}/pagination`);
  if (archetype.id === "A06") {
    await formalAppendEmptyState(parent, width, context, dependencies, `${key}/empty`, "暂无搜索结果");
  }
}

async function formalAppendDetail(parent, width, context, dependencies, key) {
  const wrap = a01WrapWidth(width);
  const viewport = formalViewport(width);
  const backdrop = formalInstance(
    dependencies,
    "Media/Placeholder",
    { Ratio: "Backdrop", State: "Default" },
    `${key}/backdrop`,
    {
      width: wrap,
      height: width === 390 ? 220 : width === 768 ? 330 : 520,
      role: "detail-backdrop",
      contentPolicy: "placeholder"
    }
  );
  parent.appendChild(backdrop);
  const detail = formalPanel(parent, `${key}/overview`, "Detail Overview", wrap, context, {
    gap: 18,
    padding: width === 390 ? 16 : 24,
    module: "detail-overview"
  });
  detail.layoutMode = width === 390 ? "VERTICAL" : "HORIZONTAL";
  detail.primaryAxisSizingMode = width === 390 ? "AUTO" : "FIXED";
  detail.counterAxisSizingMode = width === 390 ? "FIXED" : "AUTO";
  const poster = formalInstance(
    dependencies,
    "Media/Placeholder",
    { Ratio: "Poster", State: "Hover" },
    `${key}/overview/poster`,
    {
      width: width === 390 ? 160 : width === 768 ? 218 : 300,
      height: width === 390 ? 240 : width === 768 ? 327 : 450,
      role: "artwork-hover",
      contentPolicy: "placeholder"
    }
  );
  detail.appendChild(poster);
  const copyWidth = width === 390 ? wrap - 32 : wrap - (width === 768 ? 218 : 300) - 66;
  const copy = formalAuto(detail, `${key}/overview/copy`, "Detail Copy", "VERTICAL", copyWidth, 12, context);
  await formalDynamic(copy, `${key}/overview/title`, context, {
    size: width === 390 ? 30 : 42,
    width: copyWidth,
    font: context.fonts.bold
  });
  for (let index = 0; index < 3; index += 1) {
    await formalDynamic(copy, `${key}/overview/meta/${index}`, context, {
      size: 13,
      width: copyWidth,
      color: context.muted
    });
  }
  const statusRow = formalAuto(copy, `${key}/overview/status`, "Source Quality", "HORIZONTAL", copyWidth, 8, context, {
    wrap: true,
    rowGap: 8
  });
  for (const [index, state] of ["Recommended", "Available", "Slow"].entries()) {
    statusRow.appendChild(
      formalInstance(
        dependencies,
        "Playback/SourceQualityStatus",
        { State: state },
        `${key}/overview/status/${index}`,
        { role: "source-quality" }
      )
    );
  }
  const actions = formalAuto(copy, `${key}/overview/actions`, "Detail Actions", "HORIZONTAL", copyWidth, 10, context, {
    wrap: true,
    rowGap: 10
  });
  const play = formalInstance(
    dependencies,
    "Action/StandardButton",
    { Style: "Primary", State: "Hover" },
    `${key}/overview/actions/play`,
    { role: "play-action" }
  );
  await a01SetInstanceText(play, "立即播放");
  actions.appendChild(play);
  actions.appendChild(
    formalInstance(
      dependencies,
      "Action/FavoriteButton",
      { State: "Default" },
      `${key}/overview/actions/favorite`,
      { role: "favorite-action" }
    )
  );
  await formalDynamic(copy, `${key}/overview/summary`, context, {
    size: 14,
    width: copyWidth,
    color: context.muted
  });

  const episodes = formalAuto(parent, `${key}/episodes`, "Episode Section", "VERTICAL", wrap, 14, context);
  episodes.setSharedPluginData(NS, "module", "episode-list");
  await formalAppendSectionTitle(episodes, `${key}/episodes/heading`, "PLAYLIST", "选集", context, wrap);
  const episodeGrid = formalGrid(episodes, `${key}/episodes/grid`, "Episode Grid", wrap, 10, context);
  for (let index = 0; index < (width === 390 ? 6 : width === 768 ? 10 : 16); index += 1) {
    episodeGrid.appendChild(
      formalInstance(
        dependencies,
        "Playback/EpisodeItem",
        { Viewport: viewport, State: index === 0 ? "Active" : index === 1 ? "Hover" : "Default" },
        `${key}/episodes/item/${index}`,
        { role: "episode-select" }
      )
    );
  }
  await formalAppendShelfGrid(parent, width, context, dependencies, `${key}/related`, {
    eyebrow: "RECOMMENDED",
    title: "相关推荐",
    count: width === 1440 ? 6 : width === 768 ? 3 : 4
  });
}

async function formalAppendPlayer(parent, width, context, dependencies, key) {
  const wrap = a01WrapWidth(width);
  const viewport = formalViewport(width);
  const player = formalInstance(
    dependencies,
    "Media/Placeholder",
    { Ratio: "Player", State: "Default" },
    `${key}/player`,
    {
      width: wrap,
      height: Math.round(wrap * 0.5625),
      role: "player-canvas",
      contentPolicy: "placeholder"
    }
  );
  parent.appendChild(player);
  const controls = formalPanel(parent, `${key}/controls`, "Player Controls", wrap, context, {
    gap: 12,
    padding: width === 390 ? 14 : 18,
    module: "player-controls"
  });
  const titleRow = formalAuto(
    controls,
    `${key}/controls/title`,
    "Player Title",
    width === 390 ? "VERTICAL" : "HORIZONTAL",
    wrap - (width === 390 ? 28 : 36),
    10,
    context,
    { justify: width === 390 ? "MIN" : "SPACE_BETWEEN" }
  );
  await formalDynamic(titleRow, `${key}/controls/title/text`, context, {
    size: 20,
    font: context.fonts.bold
  });
  const status = formalInstance(
    dependencies,
    "Playback/SourceQualityStatus",
    { State: "Recommended" },
    `${key}/controls/title/status`,
    { role: "source-switch" }
  );
  titleRow.appendChild(status);
  const actions = formalAuto(controls, `${key}/controls/actions`, "Playback Actions", "HORIZONTAL", wrap - 36, 10, context, {
    wrap: true,
    rowGap: 10
  });
  for (const [index, label] of ["上一集", "下一集", "换线", "重试"].entries()) {
    const action = formalInstance(
      dependencies,
      "Action/StandardButton",
      { Style: index < 2 ? "Ghost" : "Primary", State: index === 2 ? "Hover" : "Default" },
      `${key}/controls/action/${index}`,
      { role: formalKeyPart(label) || `player-action-${index}` }
    );
    await a01SetInstanceText(action, label);
    actions.appendChild(action);
  }
  const stateRow = formalAuto(controls, `${key}/controls/statuses`, "Runtime Status", "HORIZONTAL", wrap - 36, 8, context, {
    wrap: true,
    rowGap: 8
  });
  for (const [index, state] of ["Loading", "Slow", "Failed", "Recommended"].entries()) {
    stateRow.appendChild(
      formalInstance(
        dependencies,
        "Playback/SourceQualityStatus",
        { State: state },
        `${key}/controls/status/${index}`,
        { role: "player-runtime-state" }
      )
    );
  }
  const episodes = formalAuto(parent, `${key}/episodes`, "Player Episode List", "VERTICAL", wrap, 14, context);
  episodes.setSharedPluginData(NS, "module", "episode-list");
  await formalAppendSectionTitle(episodes, `${key}/episodes/heading`, "PLAYLIST", "播放列表", context, wrap);
  const episodeGrid = formalGrid(episodes, `${key}/episodes/grid`, "Episode Grid", wrap, 10, context);
  for (let index = 0; index < (width === 390 ? 6 : width === 768 ? 10 : 16); index += 1) {
    episodeGrid.appendChild(
      formalInstance(
        dependencies,
        "Playback/EpisodeItem",
        { Viewport: viewport, State: index === 0 ? "Active" : index === 1 ? "Recommended" : "Default" },
        `${key}/episodes/item/${index}`,
        { role: "episode-select" }
      )
    );
  }
}

async function formalAppendAuth(parent, archetype, width, context, dependencies, key) {
  const wrap = a01WrapWidth(width);
  const panelWidth = width === 390 ? 362 : archetype.id === "A10" ? 620 : 560;
  const panel = formalPanel(parent, key, "Account Form", panelWidth, context, {
    gap: 14,
    padding: width === 390 ? 20 : 28,
    module: "account-form"
  });
  panel.layoutAlign = "CENTER";
  await formalStructural(panel, `${key}/title`, FORMAL_PAGE_COPY[archetype.id][1], context, {
    size: 30,
    width: panelWidth - (width === 390 ? 40 : 56),
    font: context.fonts.bold
  });
  await formalDynamic(panel, `${key}/intro`, context, {
    size: 13,
    width: panelWidth - (width === 390 ? 40 : 56),
    color: context.muted
  });
  const fieldKinds =
    archetype.id === "A10"
      ? ["Account", "Password"]
      : archetype.id === "A11"
        ? ["Account", "Password", "Password"]
        : ["Account", "Account"];
  for (let index = 0; index < fieldKinds.length; index += 1) {
    const field = formalInstance(
      dependencies,
      "Form/LoginField",
      { Kind: fieldKinds[index], State: index === 0 ? "Focus" : "Default" },
      `${key}/field/${index}`,
      {
        width: panelWidth - (width === 390 ? 40 : 56),
        height: 56,
        role: "form-field"
      }
    );
    panel.appendChild(field);
  }
  if (archetype.id === "A10") {
    const visibility = formalInstance(
      dependencies,
      "Form/PasswordToggle",
      { Visibility: "Hidden", State: "Hover" },
      `${key}/password-toggle`,
      { role: "password-visibility" }
    );
    panel.appendChild(visibility);
  }
  const captcha = formalAuto(
    panel,
    `${key}/captcha`,
    "Captcha Placeholder",
    "HORIZONTAL",
    panelWidth - (width === 390 ? 40 : 56),
    10,
    context,
    {
      padding: 12,
      fill: bindColor(context.panelSoft, "rgba(23,28,48,0.82)"),
      stroke: bindColor(context.line, "rgba(221,228,255,0.16)"),
      radius: 12,
      radiusVariable: context.radiusSmall
    }
  );
  await formalStructural(captcha, `${key}/captcha/label`, "验证码", context, {
    size: 13,
    color: context.muted
  });
  const submit =
    archetype.id === "A10"
      ? formalInstance(
          dependencies,
          "Action/LoginSubmit",
          { State: "Default" },
          `${key}/submit`,
          {
            width: panelWidth - (width === 390 ? 40 : 56),
            height: 58,
            role: "form-submit"
          }
        )
      : formalInstance(
          dependencies,
          "Action/StandardButton",
          { Style: "Primary", State: "Hover" },
          `${key}/submit`,
          { role: "form-submit" }
        );
  if (archetype.id !== "A10") await a01SetInstanceText(submit, archetype.id === "A11" ? "注册" : "提交");
  panel.appendChild(submit);
  await formalStructural(panel, `${key}/alternate`, archetype.id === "A10" ? "注册 · 找回密码" : "返回登录", context, {
    size: 12,
    color: context.accent2
  });
  if (wrap > panelWidth) {
    const note = formalAuto(parent, `${key}/note`, "Account Side Note", "VERTICAL", wrap, 8, context, {
      paddingY: 12
    });
    await formalStructural(note, `${key}/note/title`, "账号与隐私", context, {
      size: 14,
      font: context.fonts.bold
    });
    await formalDynamic(note, `${key}/note/body`, context, {
      size: 12,
      color: context.muted
    });
  }
}

async function formalAppendAccount(parent, archetype, width, context, dependencies, key) {
  if (["A10", "A11", "A12"].includes(archetype.id)) {
    await formalAppendAuth(parent, archetype, width, context, dependencies, key);
    return;
  }
  const wrap = a01WrapWidth(width);
  const viewport = formalViewport(width);
  if (archetype.id === "A13") {
    const profile = formalPanel(parent, `${key}/profile`, "Account Summary", wrap, context, {
      gap: 12,
      padding: width === 390 ? 18 : 24,
      module: "account-summary"
    });
    await formalDynamic(profile, `${key}/profile/name`, context, {
      size: 28,
      font: context.fonts.bold
    });
    await formalDynamic(profile, `${key}/profile/meta`, context, {
      size: 13,
      color: context.muted
    });
    const actions = formalGrid(profile, `${key}/profile/actions`, "Account Actions", wrap - (width === 390 ? 36 : 48), 12, context);
    for (const [index, label] of ["播放记录", "我的收藏", "设备管理", "退出"].entries()) {
      const action = formalInstance(
        dependencies,
        "Action/StandardButton",
        { Style: index === 3 ? "Ghost" : "Primary", State: index === 1 ? "Hover" : "Default" },
        `${key}/profile/action/${index}`,
        { role: "account-navigate" }
      );
      await a01SetInstanceText(action, label);
      actions.appendChild(action);
    }
    return;
  }
  if (archetype.id === "A14") {
    await formalAppendContinueGrid(parent, width, context, dependencies, `${key}/records`, {
      title: "播放记录",
      module: "playback-records"
    });
    const confirm = formalInstance(
      dependencies,
      "Reference/BrowserConfirm",
      { UseCase: "History" },
      `${key}/confirm`,
      { role: "browser-confirm-reference" }
    );
    parent.appendChild(confirm);
    await formalAppendEmptyState(parent, width, context, dependencies, `${key}/empty`, "暂无播放记录");
    return;
  }
  if (archetype.id === "A15") {
    await formalAppendShelfGrid(parent, width, context, dependencies, `${key}/favorites`, {
      eyebrow: "FAVORITES",
      title: "我的收藏"
    });
    const confirm = formalInstance(
      dependencies,
      "Reference/BrowserConfirm",
      { UseCase: "Favorites" },
      `${key}/confirm`,
      { role: "browser-confirm-reference" }
    );
    parent.appendChild(confirm);
    await formalAppendEmptyState(parent, width, context, dependencies, `${key}/empty`, "暂无收藏内容");
    return;
  }
  const list = formalAuto(parent, `${key}/devices`, "Device List", "VERTICAL", wrap, 0, context);
  list.setSharedPluginData(NS, "module", "device-list");
  for (let index = 0; index < (width === 390 ? 2 : 3); index += 1) {
    list.appendChild(
      formalInstance(
        dependencies,
        "Account/DeviceCard",
        { Viewport: viewport, State: index === 0 ? "Current" : index === 1 ? "Hover" : "Default" },
        `${key}/devices/${index}`,
        { role: index === 0 ? "current-device" : "device-revoke" }
      )
    );
  }
  const confirm = formalInstance(
    dependencies,
    "Reference/BrowserConfirm",
    { UseCase: "Device" },
    `${key}/confirm`,
    { role: "browser-confirm-reference" }
  );
  list.appendChild(confirm);
  await formalAppendEmptyState(parent, width, context, dependencies, `${key}/empty`, "暂无其他登录设备");
}

async function formalAppendGameGrid(parent, width, context, dependencies, key, hover = true) {
  const wrap = a01WrapWidth(width);
  const viewport = formalViewport(width);
  const grid = formalGrid(parent, key, "Game Grid", wrap, width === 390 ? 16 : 24, context);
  const games = ["2048", "Blockrain", "Gomoku", "DrawGuess"];
  for (let index = 0; index < games.length; index += 1) {
    grid.appendChild(
      formalInstance(
        dependencies,
        "Games/GameCard",
        { Viewport: viewport, Game: games[index], State: hover && index === 1 ? "Hover" : "Default" },
        `${key}/card/${index}`,
        { role: "game-launch" }
      )
    );
  }
  return grid;
}

async function formalAppendGames(parent, archetype, width, context, dependencies, key) {
  const wrap = a01WrapWidth(width);
  const mobileVariant = formalVariantViewport(width, true);
  if (archetype.id === "A17") {
    const gate = formalInstance(
      dependencies,
      "System/SystemBox",
      { Viewport: mobileVariant, Kind: "Message" },
      `${key}/guest-gate`,
      {
        width: width === 390 ? 362 : 680,
        height: width === 390 ? 300 : 300,
        role: "login-gate"
      }
    );
    parent.appendChild(gate);
    const action = formalInstance(
      dependencies,
      "Action/StandardButton",
      { Style: "Primary", State: "Hover" },
      `${key}/login`,
      { role: "login-action" }
    );
    await a01SetInstanceText(action, "前往登录");
    parent.appendChild(action);
    return;
  }
  if (archetype.id === "A18") {
    await formalAppendGameGrid(parent, width, context, dependencies, `${key}/games`);
    return;
  }
  const gameName = {
    A19: "2048",
    A20: "Blockrain",
    A21: "Gomoku",
    A22: "DrawGuess"
  }[archetype.id];
  const stacked = width === 390 || (width === 768 && ["A21", "A22"].includes(archetype.id));
  const shell = formalAuto(parent, `${key}/shell`, "Game Shell", stacked ? "VERTICAL" : "HORIZONTAL", wrap, 18, context, {
    align: "MIN"
  });
  shell.setSharedPluginData(NS, "module", "game-shell");
  const gameCard = formalInstance(
    dependencies,
    "Games/GameCard",
    { Viewport: formalViewport(width), Game: gameName, State: "Hover" },
    `${key}/shell/game`,
    { role: "game-action" }
  );
  shell.appendChild(gameCard);
  const sideWidth = stacked ? wrap : Math.max(1, wrap - gameCard.width - 18);
  const side = formalPanel(shell, `${key}/shell/side`, "Game Status", sideWidth, context, {
    gap: 12,
    padding: width === 390 ? 16 : 20,
    module: "game-status"
  });
  await formalStructural(side, `${key}/shell/side/title`, archetype.id >= "A21" ? "房间状态" : "游戏状态", context, {
    size: 20,
    font: context.fonts.bold
  });
  await formalDynamic(side, `${key}/shell/side/body`, context, {
    size: 13,
    width: sideWidth - (width === 390 ? 32 : 40),
    color: context.muted
  });
  const actionLabels =
    archetype.id >= "A21" ? ["创建房间", "加入房间", "离开房间"] : ["开始游戏", "重新开始", "继续游戏"];
  for (const [index, label] of actionLabels.entries()) {
    const action = formalInstance(
      dependencies,
      "Action/StandardButton",
      { Style: index === 0 ? "Primary" : "Ghost", State: index === 1 ? "Hover" : "Default" },
      `${key}/shell/side/action/${index}`,
      { role: "game-command" }
    );
    await a01SetInstanceText(action, label);
    side.appendChild(action);
  }
  if (archetype.id === "A20") {
    const controls = formalGrid(parent, `${key}/controls`, "Blockrain Controls", wrap, 8, context);
    for (let index = 0; index < 5; index += 1) {
      controls.appendChild(
        formalInstance(
          dependencies,
          "Games/BlockrainControl",
          {
            Viewport: mobileVariant,
            State: index === 1 ? "Pressed" : index === 2 ? "Hover" : "Default"
          },
          `${key}/controls/${index}`,
          { role: "game-control" }
        )
      );
    }
  }
  if (archetype.id === "A22") {
    const chat = formalPanel(parent, `${key}/chat`, "Room Chat", wrap, context, {
      gap: 10,
      padding: width === 390 ? 16 : 20,
      module: "room-chat"
    });
    for (let index = 0; index < 3; index += 1) {
      await formalDynamic(chat, `${key}/chat/message/${index}`, context, {
        size: 13,
        color: index === 1 ? context.accent2 : context.muted
      });
    }
    const send = formalInstance(
      dependencies,
      "Action/StandardButton",
      { Style: "Primary", State: "Default" },
      `${key}/chat/send`,
      { role: "chat-send" }
    );
    await a01SetInstanceText(send, "发送");
    chat.appendChild(send);
  }
}

async function formalAppendDownload(parent, width, context, dependencies, key) {
  const wrap = a01WrapWidth(width);
  const viewport = formalViewport(width);
  const summary = formalPanel(parent, `${key}/summary`, "Download Summary", wrap, context, {
    gap: 14,
    padding: width === 390 ? 16 : 22,
    module: "download-summary"
  });
  await formalDynamic(summary, `${key}/summary/title`, context, {
    size: 24,
    font: context.fonts.bold
  });
  await formalDynamic(summary, `${key}/summary/meta`, context, {
    size: 13,
    color: context.muted
  });
  const groups = formalAuto(parent, `${key}/groups`, "Download Groups", "VERTICAL", wrap, 14, context);
  groups.setSharedPluginData(NS, "module", "download-list");
  for (let groupIndex = 0; groupIndex < 2; groupIndex += 1) {
    const group = formalPanel(groups, `${key}/groups/${groupIndex}`, `Download Line ${groupIndex + 1}`, wrap, context, {
      gap: 10,
      padding: width === 390 ? 14 : 18,
      module: "download-group"
    });
    await formalStructural(group, `${key}/groups/${groupIndex}/title`, `线路${groupIndex + 1}`, context, {
      size: 16,
      font: context.fonts.bold
    });
    const row = formalGrid(group, `${key}/groups/${groupIndex}/items`, "Download Episodes", wrap - (width === 390 ? 28 : 36), 8, context);
    for (let index = 0; index < (width === 390 ? 4 : 8); index += 1) {
      row.appendChild(
        formalInstance(
          dependencies,
          "Playback/EpisodeItem",
          { Viewport: viewport, State: index === 0 ? "Active" : index === 1 ? "Hover" : "Default" },
          `${key}/groups/${groupIndex}/item/${index}`,
          { role: "download-action" }
        )
      );
    }
  }
  const gate = formalPanel(parent, `${key}/password-gate`, "Download / Password Gate", width === 390 ? 362 : 560, context, {
    gap: 12,
    padding: width === 390 ? 20 : 28,
    module: "download-password-gate"
  });
  await formalStructural(gate, `${key}/password-gate/eyebrow`, "访问限制", context, {
    size: 10,
    color: context.accent2,
    font: context.fonts.bold
  });
  await formalStructural(gate, `${key}/password-gate/title`, "下载密码", context, {
    size: 28,
    font: context.fonts.bold
  });
  const password = formalInstance(
    dependencies,
    "Form/LoginField",
    { Kind: "Password", State: "Focus" },
    `${key}/password-gate/password`,
    {
      width: width === 390 ? 322 : 504,
      height: 56,
      role: "password-field"
    }
  );
  gate.appendChild(password);
  const captcha = formalAuto(
    gate,
    `${key}/password-gate/captcha`,
    "Captcha Placeholder",
    "HORIZONTAL",
    width === 390 ? 322 : 504,
    8,
    context,
    {
      padding: 12,
      fill: bindColor(context.panelSoft, "rgba(23,28,48,0.82)"),
      stroke: bindColor(context.line, "rgba(221,228,255,0.16)"),
      radius: 12
    }
  );
  await formalStructural(captcha, `${key}/password-gate/captcha/label`, "验证码占位", context, {
    size: 13,
    color: context.muted
  });
  const submit = formalInstance(
    dependencies,
    "Action/StandardButton",
    { Style: "Primary", State: "Hover" },
    `${key}/password-gate/submit`,
    { role: "native-post" }
  );
  await a01SetInstanceText(submit, "提交验证");
  gate.appendChild(submit);
}

async function formalAppendSystemBoxes(parent, archetype, width, context, dependencies, key) {
  const wrap = a01WrapWidth(width);
  const viewport = formalVariantViewport(width, true);
  const variants =
    archetype.id === "A24"
      ? [
          ["Vod Confirm", "Message"],
          ["Copyright", "Message"],
          ["Vod Detail Password", "Password"],
          ["Vod Player Password", "Password"],
          ["Article Confirm", "Fallback"],
          ["Article Password", "Password"],
          ["Download Password · Reuse A23", "Password"]
        ]
      : archetype.id === "A30"
        ? [
            ["Jump / Countdown", "Message"],
            ["Message / Dynamic", "Message"],
            ["Verify / Form", "Password"]
          ]
        : [
            ["Article", "Fallback"],
            ["Topic", "Fallback"],
            ["Actor", "Fallback"],
            ["Role", "Fallback"],
            ["Website", "Fallback"]
          ];
  const list = formalAuto(parent, `${key}/boxes`, "System Box Variants", "VERTICAL", wrap, 16, context);
  list.setSharedPluginData(NS, "module", "system-box-variants");
  for (let index = 0; index < variants.length; index += 1) {
    const specimen = formalPanel(list, `${key}/variant/${index}`, variants[index][0], wrap, context, {
      gap: 10,
      padding: width === 390 ? 14 : 18,
      module: "system-variant"
    });
    await formalStructural(specimen, `${key}/variant/${index}/label`, variants[index][0], context, {
      size: 15,
      color: context.accent2,
      font: context.fonts.bold
    });
    const box = formalInstance(
      dependencies,
      "System/SystemBox",
      { Viewport: viewport, Kind: variants[index][1] },
      `${key}/boxes/${index}`,
      {
        role: "system-action"
      }
    );
    specimen.appendChild(box);
  }
  if (archetype.id === "A24") {
    const action = formalInstance(
      dependencies,
      "Action/StandardButton",
      { Style: "Primary", State: "Hover" },
      `${key}/confirm`,
      { role: "restriction-confirm" }
    );
    await a01SetInstanceText(action, "确认");
    parent.appendChild(action);
  }
}

async function formalAppendFeedback(parent, archetype, width, context, dependencies, key) {
  const wrap = a01WrapWidth(width);
  if (archetype.id === "A25") {
    const list = formalAuto(parent, `${key}/plot`, "Plot List", "VERTICAL", wrap, 12, context);
    list.setSharedPluginData(NS, "module", "plot-list");
    for (let index = 0; index < 4; index += 1) {
      const item = formalPanel(list, `${key}/plot/${index}`, "Plot Item", wrap, context, {
        gap: 8,
        padding: width === 390 ? 16 : 20,
        module: "plot-item"
      });
      await formalStructural(item, `${key}/plot/${index}/title`, `第${index + 1}集`, context, {
        size: 17,
        font: context.fonts.bold
      });
      await formalDynamic(item, `${key}/plot/${index}/body`, context, {
        size: 13,
        width: wrap - (width === 390 ? 32 : 40),
        color: context.muted
      });
    }
    const back = formalInstance(
      dependencies,
      "Action/StandardButton",
      { Style: "Ghost", State: "Hover" },
      `${key}/back`,
      { role: "plot-back" }
    );
    await a01SetInstanceText(back, "返回详情");
    list.appendChild(back);
    await formalAppendEmptyState(parent, width, context, dependencies, `${key}/fallback`, "当前模块暂未配置模板内容");
    return;
  }
  const createForm = async (parentNode, formKey, title, panelWidth, submitLabel) => {
    const form = formalPanel(parentNode, formKey, title, panelWidth, context, {
      gap: 12,
      padding: width === 390 ? 16 : 22,
      module: archetype.id === "A26" ? "comment-form" : "feedback-form"
    });
    await formalStructural(form, `${formKey}/title`, title, context, {
      size: 22,
      font: context.fonts.bold
    });
    const fieldWidth = panelWidth - (width === 390 ? 32 : 44);
    const field = formalInstance(
      dependencies,
      "Form/LoginField",
      { Kind: "Account", State: "Focus" },
      `${formKey}/account`,
      { width: fieldWidth, height: 56, role: "feedback-field" }
    );
    form.appendChild(field);
    const body = formalAuto(form, `${formKey}/body`, "Message Field", "VERTICAL", fieldWidth, 8, context, {
      padding: 14,
      fill: bindColor(context.panelSoft, "rgba(23,28,48,0.82)"),
      stroke: bindColor(context.line, "rgba(221,228,255,0.16)"),
      radius: 12,
      radiusVariable: context.radiusSmall
    });
    await formalDynamic(body, `${formKey}/body/text`, context, {
      size: 13,
      color: context.muted
    });
    const captcha = formalAuto(form, `${formKey}/captcha`, "Captcha", "HORIZONTAL", fieldWidth, 8, context, {
      padding: 12,
      fill: bindColor(context.panelSoft, "rgba(23,28,48,0.82)"),
      stroke: bindColor(context.line, "rgba(221,228,255,0.16)"),
      radius: 12
    });
    await formalStructural(captcha, `${formKey}/captcha/label`, "验证码占位", context, {
      size: 13,
      color: context.muted
    });
    const submit = formalInstance(
      dependencies,
      "Action/StandardButton",
      { Style: "Primary", State: "Hover" },
      `${formKey}/submit`,
      { role: "native-post" }
    );
    await a01SetInstanceText(submit, submitLabel);
    form.appendChild(submit);
    return form;
  };
  if (archetype.id === "A27") {
    const variants = formalAuto(parent, `${key}/variants`, "Feedback Route Variants", "VERTICAL", wrap, 18, context);
    variants.setSharedPluginData(NS, "module", "feedback-route-variants");
    const formWidth = width === 390 ? 362 : 560;
    await createForm(variants, `${key}/guestbook`, "留言", formWidth, "提交留言");
    await createForm(variants, `${key}/report`, "举报", formWidth, "提交举报");
    return;
  }
  const desktopRow = width !== 390;
  const layout = formalAuto(
    parent,
    `${key}/layout`,
    "Comment Layout",
    desktopRow ? "HORIZONTAL" : "VERTICAL",
    wrap,
    22,
    context,
    { align: "MIN" }
  );
  layout.setSharedPluginData(NS, "module", "comment-layout");
  const formWidth = width === 390 ? 362 : 360;
  const listWidth = desktopRow ? wrap - formWidth - 22 : wrap;
  const list = formalAuto(layout, `${key}/list`, "Comment List", "VERTICAL", listWidth, 12, context);
  list.setSharedPluginData(NS, "module", "comment-list");
  for (let index = 0; index < 4; index += 1) {
    const item = formalPanel(list, `${key}/list/${index}`, "Comment Item", listWidth, context, {
      gap: 6,
      padding: width === 390 ? 14 : 18,
      module: "comment-item"
    });
    await formalDynamic(item, `${key}/list/${index}/author`, context, {
      size: 15,
      font: context.fonts.bold
    });
    await formalDynamic(item, `${key}/list/${index}/time`, context, {
      size: 11,
      color: context.accent2
    });
    await formalDynamic(item, `${key}/list/${index}/body`, context, {
      size: 13,
      width: listWidth - (width === 390 ? 28 : 36),
      color: context.muted
    });
  }
  await createForm(layout, `${key}/form`, "发表评论", formWidth, "提交评论");
}

async function formalAppendContent(parent, archetype, width, context, dependencies, key) {
  if (archetype.id === "A28") {
    await formalAppendSystemBoxes(parent, archetype, width, context, dependencies, `${key}/fallbacks`);
    return;
  }
  await formalAppendSystemBoxes(parent, archetype, width, context, dependencies, `${key}/fallbacks`);
}

async function formalAppendMainContent(parent, archetype, width, context, dependencies, key) {
  if (archetype.family === "catalog") return formalAppendCatalog(parent, archetype, width, context, dependencies, key);
  if (archetype.family === "detail") return formalAppendDetail(parent, width, context, dependencies, key);
  if (archetype.family === "player") return formalAppendPlayer(parent, width, context, dependencies, key);
  if (archetype.family === "account") return formalAppendAccount(parent, archetype, width, context, dependencies, key);
  if (archetype.family === "games") return formalAppendGames(parent, archetype, width, context, dependencies, key);
  if (archetype.id === "A23") return formalAppendDownload(parent, width, context, dependencies, key);
  if (archetype.family === "feedback") return formalAppendFeedback(parent, archetype, width, context, dependencies, key);
  if (archetype.family === "content") return formalAppendContent(parent, archetype, width, context, dependencies, key);
  return formalAppendSystemBoxes(parent, archetype, width, context, dependencies, key);
}

async function formalCreateViewport(archetype, width, context, dependencies, key) {
  const viewport = formalViewport(width);
  const screen = tag(createAutoFrame(`${archetype.id} · ${viewport} · Normal`, "VERTICAL", width, 0), key, "P4");
  screen.fills = [bindColor(context.canvas, "#05070d")];
  screen.clipsContent = false;
  screen.setSharedPluginData(NS, "source_kind", "code-composed");
  screen.setSharedPluginData(NS, "prototype_revision", FORMAL_PROTOTYPE_REVISION);
  screen.setSharedPluginData(NS, "viewport", String(width));
  screen.setSharedPluginData(NS, "source_commit", PLAN.source.commit);
  screen.setSharedPluginData(NS, "responsive_mode", viewport);
  await formalAppendHeader(screen, width, context, dependencies, archetype, `${key}/header`);
  const main = tag(createAutoFrame("Main Content", "VERTICAL", width, width === 390 ? 24 : 34), `${key}/main`, "P4");
  main.fills = [];
  main.clipsContent = false;
  main.counterAxisAlignItems = "CENTER";
  main.paddingBottom = width === 390 ? 36 : 56;
  main.setSharedPluginData(NS, "module", "main");
  screen.appendChild(main);
  await formalAppendHeading(main, archetype, width, context, `${key}/main/heading`);
  await formalAppendMainContent(main, archetype, width, context, dependencies, `${key}/main/content`);
  if (Number(archetype.id.slice(1)) < 23) {
    await a01AppendFooter(screen, width, context, `${key}/footer`);
  }
  return screen;
}

function formalStateComponent(archetype, state, width, dependencies, key) {
  const lower = state.toLowerCase();
  const viewport = formalViewport(width);
  const mobileVariant = formalVariantViewport(width, true);
  if (lower.includes("browser confirm")) {
    return formalInstance(
      dependencies,
      "Reference/BrowserConfirm",
      { UseCase: archetype.id === "A14" ? "History" : archetype.id === "A15" ? "Favorites" : "Device" },
      key,
      { role: "state-specimen" }
    );
  }
  if (lower.includes("password visible")) {
    return formalInstance(
      dependencies,
      "Form/PasswordToggle",
      { Visibility: "Visible", State: "Hover" },
      key,
      { role: "state-specimen" }
    );
  }
  if (lower.includes("submit loading")) {
    return formalInstance(dependencies, "Action/LoginSubmit", { State: "Loading" }, key, { role: "state-specimen" });
  }
  if (lower.includes("notice success")) {
    return formalInstance(dependencies, "Feedback/SiteNotice", { Tone: "Success" }, key, { role: "state-specimen" });
  }
  if (lower.includes("notice error") || lower.includes("failure alert") || lower.includes("error alert")) {
    return formalInstance(dependencies, "Feedback/SiteNotice", { Tone: "Error" }, key, { role: "state-specimen" });
  }
  if (lower.includes("source ") || lower.includes("line failover")) {
    return formalInstance(
      dependencies,
      "Playback/SourceQualityStatus",
      { State: lower.includes("loading") ? "Loading" : lower.includes("recommended") ? "Recommended" : "Failed" },
      key,
      { role: "state-specimen" }
    );
  }
  if (lower.includes("episode")) {
    return formalInstance(
      dependencies,
      "Playback/EpisodeItem",
      { Viewport: viewport, State: lower.includes("active") ? "Active" : "Hover" },
      key,
      { role: "state-specimen" }
    );
  }
  if (lower.includes("filter") || lower.includes("pagination")) {
    return formalInstance(
      dependencies,
      "Selection/FilterOption",
      { Viewport: mobileVariant, State: lower.includes("selected") || lower.includes("current") ? "Selected" : "Hover" },
      key,
      { role: "state-specimen" }
    );
  }
  if (lower.includes("device")) {
    return formalInstance(
      dependencies,
      "Account/DeviceCard",
      { Viewport: viewport, State: lower.includes("current") ? "Current" : "Hover" },
      key,
      { role: "state-specimen" }
    );
  }
  if (lower.includes("game card")) {
    return formalInstance(
      dependencies,
      "Games/GameCard",
      { Viewport: "Mobile", Game: "Blockrain", State: "Hover" },
      key,
      { role: "state-specimen" }
    );
  }
  if (lower.includes("control pressed")) {
    return formalInstance(
      dependencies,
      "Games/BlockrainControl",
      { Viewport: "Mobile", State: "Pressed" },
      key,
      { role: "state-specimen" }
    );
  }
  if (lower.includes("category")) {
    return formalInstance(
      dependencies,
      "Content/CategoryTile",
      { Viewport: "Mobile", State: lower.includes("focus") ? "Focus" : "Hover" },
      key,
      { role: "state-specimen" }
    );
  }
  if (lower.includes("card hover") || lower.includes("list hover") || lower.includes("timeline hover")) {
    return formalInstance(
      dependencies,
      "Home/ShelfCard",
      { Viewport: "Mobile", State: "Hover" },
      key,
      { role: "state-specimen" }
    );
  }
  if (lower.includes("favorite")) {
    return formalInstance(
      dependencies,
      "Action/FavoriteButton",
      { State: lower.includes("loading") ? "Loading" : lower.includes("favorited") ? "Favorited" : "Default" },
      key,
      { role: "state-specimen" }
    );
  }
  if (lower.includes("focus")) {
    return formalInstance(
      dependencies,
      "Form/LoginField",
      { Kind: "Account", State: "Focus" },
      key,
      { role: "state-specimen", width: 320, height: 56 }
    );
  }
  if (lower.includes("loading") || lower.includes("buffer") || lower.includes("connecting") || lower.includes("reconnect")) {
    return formalInstance(
      dependencies,
      "Playback/SourceQualityStatus",
      { State: "Loading" },
      key,
      { role: "state-specimen" }
    );
  }
  if (
    lower.includes("empty") ||
    lower.includes("no room") ||
    lower.includes("offline") ||
    lower.includes("permission") ||
    lower.includes("guest gate") ||
    lower.includes("fallback")
  ) {
    return formalInstance(
      dependencies,
      "System/SystemBox",
      { Viewport: "Mobile", Kind: lower.includes("fallback") ? "Fallback" : "Message" },
      key,
      { role: "state-specimen" }
    );
  }
  if (lower.includes("password") || lower.includes("captcha")) {
    return formalInstance(
      dependencies,
      "System/SystemBox",
      { Viewport: "Mobile", Kind: "Password" },
      key,
      { role: "state-specimen" }
    );
  }
  return formalInstance(
    dependencies,
    "Action/StandardButton",
    { Style: "Ghost", State: lower.includes("hover") ? "Hover" : "Default" },
    key,
    { role: "state-specimen" }
  );
}

async function formalAppendStateMatrix(root, archetype, context, dependencies, key) {
  const section = formalAuto(root, key, `${archetype.id} / Interaction & States`, "VERTICAL", 2646, 18, context, {
    padding: 28,
    fill: solidPaint("rgba(255,255,255,0.018)"),
    stroke: solidPaint("rgba(222,228,255,0.10)"),
    radius: 24
  });
  section.setSharedPluginData(NS, "module", "state-matrix");
  await formalStructural(section, `${key}/title`, `${archetype.id} · Interaction & States`, context, {
    size: 28,
    font: context.fonts.bold
  });
  await formalStructural(
    section,
    `${key}/meta`,
    "所有已实现状态使用真实组件实例；缺失状态仅记录，不补造代码中不存在的视觉。",
    context,
    { size: 12, width: 2590, color: context.muted }
  );
  const grid = formalGrid(section, `${key}/implemented`, "Implemented State Specimens", 2590, 14, context);
  const states = V2_STATE_FACTS[archetype.id] || archetype.states;
  for (let index = 0; index < states.length; index += 1) {
    const state = states[index];
    const card = await a01SpecimenCard(grid, `${key}/implemented/${index}`, state, context, {
      width: 318,
      meta: "Current source behavior",
      status: "implemented-current-code"
    });
    const instance = formalStateComponent(
      archetype,
      state,
      390,
      dependencies,
      `${key}/implemented/${index}/instance`
    );
    if (instance.width > 286) a01ResizeInstance(instance, 286, Math.max(44, Math.min(instance.height, 250)));
    card.appendChild(instance);
  }
  const missingStates = FORMAL_REQUIRED_PAGE_STATES.filter((state) => !archetype.states.includes(state));
  if (missingStates.length) {
    const missing = await a01SpecimenCard(
      section,
      `${key}/not-implemented`,
      "Not Implemented in Current Code",
      context,
      {
        width: 2590,
        meta: missingStates.join(" · "),
        status: "not-implemented-current-code"
      }
    );
    missing.strokes = [solidPaint("rgba(243,201,125,0.34)")];
  }
  return section;
}

async function formalAppendDeveloperReference(root, archetype, context, key) {
  const reference = formalAuto(root, key, `${archetype.id} / Developer Reference`, "VERTICAL", 2646, 14, context, {
    padding: 28,
    fill: bindColor(context.panel, "rgba(15,19,34,0.76)"),
    stroke: bindColor(context.line, "rgba(221,228,255,0.16)"),
    radius: 24
  });
  reference.setSharedPluginData(NS, "module", "developer-reference");
  await formalStructural(reference, `${key}/title`, `${archetype.id} · Developer Reference`, context, {
    size: 28,
    font: context.fonts.bold
  });
  const columns = formalGrid(reference, `${key}/columns`, "Developer Notes", 2590, 16, context);
  const notes = [
    [
      "Route & Source",
      `Route: ${archetype.route}\nTemplates:\n${archetype.templates.join("\n")}`
    ],
    [
      "Components & Data",
      `Components: ${archetype.components.join(" · ")}\nData: ${archetype.data.join(" · ")}`
    ],
    [
      "Responsive",
      "Desktop 1440 / wrap 1384\nTablet 768 / wrap 728\nMobile 390 / wrap 362\nNavigation switches to drawer below desktop."
    ],
    [
      "Interaction",
      `${(V2_STATE_FACTS[archetype.id] || archetype.states).join(" · ")}\nHover and action behavior comes from current component variants.`
    ],
    [
      "Content Policy",
      "Media: editable Media/Placeholder only\nDynamic video/account/comment/game copy: exact 测试文本\nStructural product copy remains source-backed."
    ],
    [
      "Expansion",
      "Keep the route/component/data contract current when templates change.\nOther themes remain documentation-only.\nCode Connect is excluded from this round."
    ]
  ];
  for (const [index, note] of notes.entries()) {
    const card = await a01SpecimenCard(columns, `${key}/columns/${index}`, note[0], context, {
      width: 850,
      meta: note[1],
      status: "developer-reference"
    });
    card.resize(850, 230);
    card.primaryAxisSizingMode = "FIXED";
  }
  return reference;
}

async function formalEnsureDrawerOverlays(page, dependencies, context) {
  const slug = formalKeyPart(page.name);
  const overlays = new Map();
  for (const width of [768, 390]) {
    const key = `formal/shared-overlay/${slug}/${width}`;
    let overlay = page.children.find((node) => entityKey(node) === key);
    if (!overlay) {
      overlay = await a01CreateDrawerOverlay(
        page,
        formalViewport(width),
        context,
        dependencies,
        key
      );
      overlay.name = `${page.name} · ${formalViewport(width)} Drawer / Open`;
      placeAwayFromExisting(page, overlay);
    }
    overlays.set(width, overlay);
  }
  return overlays;
}

async function formalConnectDrawerInteractions(screens, overlays) {
  for (const width of [768, 390]) {
    const screen = screens.get(width);
    const menu = screen.findOne(
      (node) => node.type === "INSTANCE" && node.getSharedPluginData(NS, "interaction_role") === "open-mobile-drawer"
    );
    if (!menu) throw new Error(`Formal drawer menu missing at ${width}.`);
    await menu.setReactionsAsync([a01OverlayReaction(overlays.get(width).id)]);
  }
}

async function buildFormalArchetype(archetype) {
  const rawPage = figma.root.children.find((page) => page.name === RAW_EVIDENCE_PAGE_NAME);
  if (!rawPage) throw new Error("Protected Raw Evidence page missing.");
  await rawPage.loadAsync();
  const rawBefore = protectedPageSignature(rawPage);
  const dependencies = await formalEnsureDependencies();
  const { page } = await ensurePlannedPage(archetype.figmaPage);
  assertMutableTargetPage(page);
  await figma.setCurrentPageAsync(page);
  const context = await docContext();
  const key = `v2/prototype/${archetype.id}`;
  const root = await ensureOwnedReferenceRoot(
    page,
    key,
    `${archetype.id} · ${archetype.name} / Liquid Cinema`,
    "P4",
    context,
    2790
  );
  bindReferenceRootSpacing(root, context, 24, 2790);
  root.fills = [bindColor(context.canvas, "#05070d")];
  root.setSharedPluginData(NS, "source_kind", "code-composed");
  root.setSharedPluginData(NS, "prototype_revision", FORMAL_PROTOTYPE_REVISION);
  root.setSharedPluginData(NS, "source_commit", PLAN.source.commit);
  await addOwnedText(root, `${key}/title`, `${archetype.id} · ${archetype.name} · Liquid Cinema`, context, {
    font: context.fonts.bold,
    size: 40,
    width: 2662,
    phase: "P4"
  });
  await addOwnedText(
    root,
    `${key}/meta`,
    [
      `Route: ${archetype.route}`,
      "Current-code composed editable prototype · default theme full coverage",
      "Media uses placeholders; dynamic video/account/comment/game copy uses exact 测试文本",
      `Source: ${PLAN.source.branch}@${PLAN.source.commit}`
    ].join("\n"),
    context,
    { color: context.muted, fallback: "#9da6bd", size: 12, width: 2662, phase: "P4" }
  );
  const responsive = tag(
    createAutoFrame(`${archetype.id} / Responsive Screens`, "HORIZONTAL", 2646, 24),
    `${key}/viewports`,
    "P4"
  );
  responsive.counterAxisAlignItems = "MIN";
  responsive.setSharedPluginData(NS, "module", "responsive-screens");
  root.appendChild(responsive);
  const screens = new Map();
  for (const width of RAW_EVIDENCE_VIEWPORTS) {
    const screen = await formalCreateViewport(
      archetype,
      width,
      context,
      dependencies,
      `${key}/viewport/${width}`
    );
    responsive.appendChild(screen);
    screens.set(width, screen);
  }
  const overlays = await formalEnsureDrawerOverlays(page, dependencies, context);
  await formalConnectDrawerInteractions(screens, overlays);
  await formalAppendStateMatrix(root, archetype, context, dependencies, `${key}/states`);
  await formalAppendDeveloperReference(root, archetype, context, `${key}/developer-reference`);
  const rawAfter = protectedPageSignature(rawPage);
  if (rawAfter.signature !== rawBefore.signature || rawAfter.topLevelCount !== rawBefore.topLevelCount) {
    throw new Error(
      `Protected Raw Evidence changed while building ${archetype.id}: ${rawBefore.signature} → ${rawAfter.signature}`
    );
  }
  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
  figma.commitUndo();
  return [
    "FORMAL PROTOTYPE · APPLIED",
    `archetype=${archetype.id} · ${archetype.name}`,
    `page=${page.name} · ${page.id}`,
    `root=${root.id}`,
    `revision=${FORMAL_PROTOTYPE_REVISION}`,
    "responsive=Desktop 1440 · Tablet 768 · Mobile 390",
    "sourceKind=code-composed",
    `rawEvidence=${rawAfter.signature} · unchanged`
  ].join("\n");
}

async function collectFormalArchetypeIssues(archetype, page, root) {
  const issues = [];
  if (!root) return ["prototype root missing"];
  const key = `v2/prototype/${archetype.id}`;
  if (root.getSharedPluginData(NS, "source_kind") !== "code-composed") {
    issues.push("prototype root source_kind must be code-composed");
  }
  if (root.getSharedPluginData(NS, "prototype_revision") !== FORMAL_PROTOTYPE_REVISION) {
    issues.push("prototype root revision mismatch");
  }
  if (root.clipsContent) issues.push("prototype root clips content");
  for (const width of RAW_EVIDENCE_VIEWPORTS) {
    const frame = root.findOne((node) => entityKey(node) === `${key}/viewport/${width}`);
    if (!frame) {
      issues.push(`viewport ${width} missing`);
      continue;
    }
    if (Math.abs(frame.width - width) > 2) issues.push(`viewport ${width} width=${frame.width}`);
    if (frame.layoutMode !== "VERTICAL") issues.push(`viewport ${width} is not vertical Auto Layout`);
    if (frame.primaryAxisSizingMode !== "AUTO") issues.push(`viewport ${width} primary sizing is not AUTO`);
    if (frame.counterAxisSizingMode !== "FIXED") issues.push(`viewport ${width} counter sizing is not FIXED`);
    if (frame.clipsContent) issues.push(`viewport ${width} clips content`);
    if (frame.getSharedPluginData(NS, "source_kind") !== "code-composed") {
      issues.push(`viewport ${width} source_kind is not code-composed`);
    }
    if (frame.getSharedPluginData(NS, "prototype_revision") !== FORMAL_PROTOTYPE_REVISION) {
      issues.push(`viewport ${width} revision mismatch`);
    }
    if (frame.getSharedPluginData(NS, "raw_source_node_id")) {
      issues.push(`viewport ${width} retains raw source linkage`);
    }
    const requiredModules =
      Number(archetype.id.slice(1)) < 23 ? ["header", "main", "footer"] : ["header", "main"];
    for (const moduleName of requiredModules) {
      if (!frame.findOne((node) => entityKey(node) === `${key}/viewport/${width}/${moduleName}`)) {
        issues.push(`viewport ${width} module ${moduleName} missing`);
      }
    }
    if (a01DirectChildrenOverlap(frame)) issues.push(`viewport ${width} direct modules overlap`);
    const nodes = [frame, ...frame.findAll(() => true)];
    const imageFills = nodes.filter(
      (node) =>
        "fills" in node &&
        Array.isArray(node.fills) &&
        node.fills.some((paint) => paint.type === "IMAGE")
    );
    if (imageFills.length) issues.push(`viewport ${width} contains ${imageFills.length} image fills`);
    const invalidDynamic = nodes.filter(
      (node) =>
        node.type === "TEXT" &&
        node.getSharedPluginData(NS, "text_policy") === "测试文本" &&
        node.characters !== "测试文本"
    );
    if (invalidDynamic.length) issues.push(`viewport ${width} has ${invalidDynamic.length} invalid dynamic texts`);
    const repeatedDynamic = nodes.filter(
      (node) => node.type === "TEXT" && /测试文本.*测试文本/.test(String(node.characters || ""))
    );
    if (repeatedDynamic.length) issues.push(`viewport ${width} has ${repeatedDynamic.length} repeated test-text nodes`);
    const instances = frame.findAllWithCriteria({ types: ["INSTANCE"] });
    const minimumInstances = ["A17", "A25", "A26"].includes(archetype.id) ? 3 : 4;
    if (instances.length < minimumInstances) {
      issues.push(`viewport ${width} component instances=${instances.length}/${minimumInstances}+`);
    }
    if (FORMAL_MEDIA_ARCHETYPES.has(archetype.id)) {
      let placeholders = 0;
      for (const instance of instances) {
        if ((await a01InstanceSetName(instance)) === "Media/Placeholder") placeholders += 1;
      }
      if (!placeholders) issues.push(`viewport ${width} media placeholder missing`);
    }
    let reactionCount = 0;
    for (const instance of instances) reactionCount += await a01EffectiveReactionCount(instance);
    if (!reactionCount) issues.push(`viewport ${width} has no effective component interaction`);
    if (width !== 1440) {
      const menu = instances.find(
        (node) => node.getSharedPluginData(NS, "interaction_role") === "open-mobile-drawer"
      );
      if (!menu || !(await a01Reactions(menu)).length) {
        issues.push(`viewport ${width} mobile drawer trigger missing`);
      }
    }
  }
  const states = root.findOne((node) => entityKey(node) === `${key}/states`);
  if (!states) {
    issues.push("state matrix missing");
  } else {
    const instances = states.findAllWithCriteria({ types: ["INSTANCE"] });
    const expected = (V2_STATE_FACTS[archetype.id] || archetype.states).length;
    if (instances.length < expected) issues.push(`state matrix instances=${instances.length}/${expected}+`);
    const missingStates = FORMAL_REQUIRED_PAGE_STATES.filter((state) => !archetype.states.includes(state));
    const notImplemented = states.findOne(
      (node) => node.getSharedPluginData(NS, "state_status") === "not-implemented-current-code"
    );
    if (missingStates.length && !notImplemented) issues.push("not-implemented current-code state card missing");
  }
  const developerReference = root.findOne(
    (node) => entityKey(node) === `${key}/developer-reference`
  );
  if (!developerReference) issues.push("developer reference missing");
  const rawPages = figma.root.children.filter((item) => item.name === RAW_EVIDENCE_PAGE_NAME);
  if (rawPages.length !== 1) {
    issues.push(`Raw Evidence exact page count=${rawPages.length}/1`);
  } else {
    await rawPages[0].loadAsync();
    const signature = protectedPageSignature(rawPages[0]);
    if (signature.topLevelCount !== PLAN.rawEvidenceProtection.expectedTopLevelCount) {
      issues.push(`Raw Evidence top-level count=${signature.topLevelCount}`);
    }
    if (signature.signature !== PLAN.rawEvidenceProtection.expectedSignature) {
      issues.push(
        `Raw Evidence signature=${signature.signature}/${PLAN.rawEvidenceProtection.expectedSignature}`
      );
    }
  }
  return issues;
}

async function validateFormalArchetype(archetype) {
  const page = figma.root.children.find((item) => item.name === archetype.figmaPage);
  if (!page) return `FORMAL PROTOTYPE VALIDATION · PENDING\nmissing page=${archetype.figmaPage}`;
  await page.loadAsync();
  const root = page.children.find((node) => entityKey(node) === `v2/prototype/${archetype.id}`);
  const issues = await collectFormalArchetypeIssues(archetype, page, root);
  return [
    `FORMAL PROTOTYPE VALIDATION · ${issues.length ? "FAIL" : "PASS"}`,
    `archetype=${archetype.id} · ${archetype.name}`,
    `revision=${FORMAL_PROTOTYPE_REVISION}`,
    `issues=${issues.length}`,
    ...(issues.length ? issues.map((issue) => `- ${issue}`) : ["- none"])
  ].join("\n");
}
