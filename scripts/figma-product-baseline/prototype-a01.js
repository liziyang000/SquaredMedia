const A01_COMPONENT_REVISION = "liquid-cinema-home-v1.0";
const A01_PROTOTYPE_REVISION = "liquid-cinema-home-v1.0";

const A01_COMPONENT_SPECS = [
  {
    id: "home-rank-item",
    name: "Home/RankItem",
    dimensions: {
      Viewport: ["Desktop", "Tablet", "Mobile"],
      State: ["Default", "Hover"]
    }
  },
  {
    id: "home-genre-chip",
    name: "Home/GenreChip",
    dimensions: {
      Viewport: ["Desktop", "Tablet", "Mobile"],
      Channel: ["Featured", "Standard", "New"],
      State: ["Default", "Hover"]
    }
  },
  {
    id: "home-continue-card",
    name: "Home/ContinueCard",
    dimensions: {
      Viewport: ["Desktop", "Tablet", "Mobile"],
      State: ["Default", "Hover"]
    }
  },
  {
    id: "home-shelf-card",
    name: "Home/ShelfCard",
    dimensions: {
      Viewport: ["Desktop", "Tablet", "Mobile"],
      State: ["Default", "Hover", "Focus"]
    }
  },
  {
    id: "home-shelf-tab",
    name: "Home/ShelfTab",
    dimensions: {
      Kind: ["Recommended", "Category"],
      State: ["Default", "Hover", "Active", "Focus"]
    }
  },
  {
    id: "home-carousel-control",
    name: "Home/CarouselControl",
    dimensions: {
      State: ["Playing", "Paused"]
    }
  },
  {
    id: "navigation-menu-toggle",
    name: "Navigation/MenuToggle",
    dimensions: {
      State: ["Default", "Hover", "Open"]
    }
  },
  {
    id: "navigation-mobile-drawer",
    name: "Navigation/MobileDrawer",
    dimensions: {
      Viewport: ["Tablet", "Mobile"],
      State: ["Open"]
    }
  }
];

function a01CombinationValue(node, property) {
  if (node.variantProperties && node.variantProperties[property]) return node.variantProperties[property];
  const match = String(node.name || "").match(new RegExp(`(?:^|,\\s*)${property}=([^,]+)`));
  return match ? match[1].trim() : "";
}

function a01ComponentKey(spec) {
  return `a01/component/${spec.id}`;
}

async function a01Text(parent, key, value, context, options = {}) {
  const node = await v2AppendComponentText(
    parent,
    key,
    value,
    context,
    options.size || 13,
    options.color || null,
    options.width || null,
    options.font || null
  );
  node.setSharedPluginData(NS, "text_policy", options.dynamic ? "测试文本" : "structural");
  if (options.dynamic && value !== "测试文本") {
    throw new Error(`A01 dynamic copy must equal 测试文本: ${key}=${value}`);
  }
  return node;
}

function a01FindVariant(componentSet, properties) {
  return componentSet.children.find(
    (candidate) =>
      candidate.type === "COMPONENT" &&
      Object.entries(properties).every(([property, value]) => a01CombinationValue(candidate, property) === value)
  );
}

function a01ComponentSetByKey(page, key) {
  return page.findOne((node) => node.type === "COMPONENT_SET" && entityKey(node) === key);
}

function a01CreateInstance(componentSet, properties, key, phase = "P4") {
  const component = a01FindVariant(componentSet, properties);
  if (!component) {
    throw new Error(`Missing variant ${componentSet.name}: ${JSON.stringify(properties)}`);
  }
  const instance = tag(component.createInstance(), key, phase);
  instance.setSharedPluginData(NS, "component_set", componentSet.name);
  return instance;
}

function a01ResizeInstance(instance, width, height) {
  instance.resize(width, height);
  if ("layoutSizingHorizontal" in instance) instance.layoutSizingHorizontal = "FIXED";
  if ("layoutSizingVertical" in instance) instance.layoutSizingVertical = "FIXED";
  return instance;
}

function a01Surface(node, context, options = {}) {
  node.fills = [
    options.fill ||
      gradientPaint([
        [0, options.fillStart || "rgba(255,255,255,0.065)"],
        [0.56, options.fillMiddle || "rgba(23,28,48,0.82)"],
        [1, options.fillEnd || "rgba(5,7,13,0.90)"]
      ])
  ];
  node.strokes = [options.stroke || bindColor(context.line, "rgba(221,228,255,0.16)")];
  node.strokeWeight = 1;
  setRadius(node, options.radius || 18, options.radiusVariable || context.radius);
  node.effects = options.effects || [
    componentEffect("DROP_SHADOW", "rgba(0,0,0,0.24)", { x: 0, y: 18 }, 48),
    componentEffect("INNER_SHADOW", "rgba(255,255,255,0.08)", { x: 0, y: 1 }, 0)
  ];
}

function a01Fixed(parent, key, name, direction, width, height, gap, context, phase = "P4") {
  const node = tag(figma.createFrame(), key, phase);
  node.name = name;
  configureFixedAutoLayout(node, direction, width, height, gap, context);
  node.fills = [];
  node.clipsContent = false;
  parent.appendChild(node);
  return node;
}

function a01Free(parent, key, name, width, height, phase = "P4") {
  const node = tag(figma.createFrame(), key, phase);
  node.name = name;
  node.resize(width, height);
  node.fills = [];
  node.clipsContent = false;
  parent.appendChild(node);
  return node;
}

async function a01MediaInstance(componentPage, ratio, state, key, width, height, phase = "P4") {
  const set = a01ComponentSetByKey(componentPage, "v2/component/media-placeholder/set");
  if (!set) throw new Error("Media/Placeholder component set is required before A01.");
  const instance = a01CreateInstance(set, { Ratio: ratio, State: state }, key, phase);
  a01ResizeInstance(instance, width, height);
  instance.setSharedPluginData(NS, "content_policy", "placeholder");
  return instance;
}

async function a01CreateRankVariant(spec, combination, context, componentPage, key) {
  const width = { Desktop: 262, Tablet: 218, Mobile: 281 }[combination.Viewport];
  const state = combination.State;
  const component = tag(figma.createComponent(), key, "P3");
  component.name = v2VariantName(combination);
  configureFixedAutoLayout(component, "HORIZONTAL", width, 86, 11, context);
  component.paddingTop = 8;
  component.paddingRight = 8;
  component.paddingBottom = 8;
  component.paddingLeft = 8;
  component.primaryAxisAlignItems = "MIN";
  component.counterAxisAlignItems = "CENTER";
  component.fills = [
    state === "Hover" ? bindColor(context.selected, "rgba(139,124,255,0.08)") : solidPaint("rgba(255,255,255,0.035)")
  ];
  component.strokes = [
    state === "Hover" ? solidPaint("rgba(139,124,255,0.34)") : solidPaint("rgba(222,228,255,0.10)")
  ];
  component.strokeWeight = 1;
  setRadius(component, 16, null);
  component.effects =
    state === "Hover" ? [componentEffect("DROP_SHADOW", "rgba(139,124,255,0.16)", { x: 0, y: 10 }, 24)] : [];

  const thumb = a01Free(component, `${key}/thumb`, "Rank Thumbnail", 62, 70, "P3");
  const media = await a01MediaInstance(componentPage, "Thumbnail", state === "Hover" ? "Hover" : "Default", `${key}/media`, 62, 70, "P3");
  thumb.appendChild(media);
  media.x = 0;
  media.y = 0;
  const indexBadge = a01Fixed(thumb, `${key}/index`, "Rank Index", "HORIZONTAL", 23, 23, 0, context, "P3");
  indexBadge.fills = [
    gradientPaint([
      [0, "#6ee7f9"],
      [1, "#8b7cff"]
    ])
  ];
  indexBadge.strokes = [solidPaint("rgba(255,255,255,0.22)")];
  indexBadge.strokeWeight = 1;
  setRadius(indexBadge, 8, null);
  indexBadge.x = 4;
  indexBadge.y = 43;
  await a01Text(indexBadge, `${key}/index/label`, "1", context, { size: 11, font: context.fonts.bold });

  const bodyWidth = width - 62 - 11 - 16 - 34;
  const body = a01Fixed(component, `${key}/body`, "Rank Copy", "VERTICAL", bodyWidth, 70, 5, context, "P3");
  body.primaryAxisAlignItems = "CENTER";
  body.counterAxisAlignItems = "MIN";
  await a01Text(body, `${key}/title`, "测试文本", context, {
    dynamic: true,
    size: 14,
    width: bodyWidth,
    font: context.fonts.bold
  });
  await a01Text(body, `${key}/meta`, "测试文本", context, {
    dynamic: true,
    size: 12,
    width: bodyWidth,
    color: context.muted
  });
  const score = a01Fixed(component, `${key}/score`, "Rank Score", "VERTICAL", 34, 70, 0, context, "P3");
  score.primaryAxisAlignItems = "MIN";
  score.counterAxisAlignItems = "MAX";
  await a01Text(score, `${key}/score/label`, "测试文本", context, {
    dynamic: true,
    size: 11,
    color: context.accent2,
    font: context.fonts.bold
  });
  return component;
}

async function a01CreateGenreVariant(spec, combination, context, key) {
  const width = { Desktop: 221, Tablet: 235, Mobile: 164 }[combination.Viewport];
  const height = combination.Viewport === "Mobile" ? 72 : 78;
  const state = combination.State;
  const channel = combination.Channel;
  const component = tag(figma.createComponent(), key, "P3");
  component.name = v2VariantName(combination);
  configureFixedAutoLayout(component, "HORIZONTAL", width, height, 11, context);
  component.paddingTop = 12;
  component.paddingRight = 13;
  component.paddingBottom = 12;
  component.paddingLeft = 13;
  component.primaryAxisAlignItems = "MIN";
  component.counterAxisAlignItems = "CENTER";
  a01Surface(component, context, {
    radius: 18,
    fill:
      channel === "Featured"
        ? gradientPaint([
            [0, "rgba(139,124,255,0.18)"],
            [1, "rgba(17,20,39,0.68)"]
          ])
        : state === "Hover"
          ? gradientPaint([
              [0, "rgba(49,51,84,0.74)"],
              [1, "rgba(21,23,44,0.72)"]
            ])
          : bindColor(context.panelSoft, "rgba(23,28,48,0.82)"),
    stroke:
      state === "Hover"
        ? solidPaint("rgba(139,124,255,0.38)")
        : channel === "Featured"
          ? solidPaint("rgba(139,124,255,0.28)")
          : solidPaint("rgba(222,228,255,0.13)"),
    effects:
      state === "Hover"
        ? [
            componentEffect("DROP_SHADOW", "rgba(0,0,0,0.26)", { x: 0, y: 20 }, 44),
            componentEffect("DROP_SHADOW", "rgba(111,89,230,0.08)", { x: 0, y: 0 }, 28)
          ]
        : [
            componentEffect("INNER_SHADOW", "rgba(255,255,255,0.07)", { x: 0, y: 1 }, 0),
            componentEffect("DROP_SHADOW", "rgba(0,0,0,0.20)", { x: 0, y: 16 }, 38)
          ]
  });

  const badge = a01Fixed(component, `${key}/badge`, "Channel Code", "VERTICAL", 42, 42, 0, context, "P3");
  badge.fills = [
    channel === "Featured"
      ? gradientPaint([
          [0, "rgba(139,124,255,0.44)"],
          [1, "rgba(94,78,209,0.20)"]
        ])
      : solidPaint("rgba(255,255,255,0.055)")
  ];
  badge.strokes = [
    channel === "Featured" ? solidPaint("rgba(205,199,255,0.28)") : solidPaint("rgba(222,228,255,0.16)")
  ];
  badge.strokeWeight = 1;
  setRadius(badge, 13, null);
  await a01Text(
    badge,
    `${key}/badge/label`,
    channel === "Featured" ? "TOP" : channel === "New" ? "NEW" : "FILM",
    context,
    { size: 8, font: context.fonts.bold }
  );

  const copyWidth = width - 42 - 11 - 26;
  const copy = a01Fixed(component, `${key}/copy`, "Channel Copy", "VERTICAL", copyWidth, 50, 4, context, "P3");
  copy.primaryAxisAlignItems = "CENTER";
  copy.counterAxisAlignItems = "MIN";
  await a01Text(
    copy,
    `${key}/title`,
    channel === "Featured" ? "热播榜" : channel === "New" ? "今日更新" : "测试文本",
    context,
    {
      dynamic: channel === "Standard",
      size: 14,
      width: copyWidth,
      font: context.fonts.bold
    }
  );
  await a01Text(
    copy,
    `${key}/subtitle`,
    channel === "Featured" ? "全站热度" : channel === "New" ? "刚刚上线" : "银幕精选",
    context,
    { size: 12, width: copyWidth, color: context.muted }
  );
  return component;
}

async function a01CreateContinueVariant(spec, combination, context, componentPage, key) {
  const width = { Desktop: 336, Tablet: 357, Mobile: 300 }[combination.Viewport];
  const state = combination.State;
  const component = tag(figma.createComponent(), key, "P3");
  component.name = v2VariantName(combination);
  configureFixedAutoLayout(component, "HORIZONTAL", width, 124, 13, context);
  component.paddingTop = 9;
  component.paddingRight = 9;
  component.paddingBottom = 9;
  component.paddingLeft = 9;
  component.primaryAxisAlignItems = "MIN";
  component.counterAxisAlignItems = "CENTER";
  a01Surface(component, context, {
    radius: 18,
    fill:
      state === "Hover"
        ? gradientPaint([
            [0, "rgba(49,51,84,0.72)"],
            [1, "rgba(21,23,44,0.72)"]
          ])
        : bindColor(context.panelSoft, "rgba(23,28,48,0.82)"),
    stroke:
      state === "Hover" ? solidPaint("rgba(139,124,255,0.38)") : solidPaint("rgba(222,228,255,0.12)"),
    effects:
      state === "Hover"
        ? [
            componentEffect("DROP_SHADOW", "rgba(0,0,0,0.28)", { x: 0, y: 20 }, 42),
            componentEffect("DROP_SHADOW", "rgba(111,89,230,0.08)", { x: 0, y: 0 }, 24)
          ]
        : [
            componentEffect("INNER_SHADOW", "rgba(255,255,255,0.06)", { x: 0, y: 1 }, 0),
            componentEffect("DROP_SHADOW", "rgba(0,0,0,0.20)", { x: 0, y: 14 }, 34)
          ]
  });
  const media = await a01MediaInstance(componentPage, "Poster", state === "Hover" ? "Hover" : "Default", `${key}/media`, 76, 114, "P3");
  component.appendChild(media);
  const copyWidth = width - 76 - 13 - 18;
  const copy = a01Fixed(component, `${key}/copy`, "Continue Copy", "VERTICAL", copyWidth, 104, 6, context, "P3");
  copy.primaryAxisAlignItems = "CENTER";
  copy.counterAxisAlignItems = "MIN";
  await a01Text(copy, `${key}/title`, "测试文本", context, {
    dynamic: true,
    size: 14,
    width: copyWidth,
    font: context.fonts.bold
  });
  await a01Text(copy, `${key}/meta`, "测试文本", context, {
    dynamic: true,
    size: 12,
    width: copyWidth,
    color: context.muted
  });
  await a01Text(copy, `${key}/progress`, "测试文本", context, {
    dynamic: true,
    size: 12,
    width: copyWidth,
    color: context.accent2,
    font: context.fonts.bold
  });
  return component;
}

async function a01CreateShelfCardVariant(spec, combination, context, componentPage, key) {
  const width = { Desktop: 217, Tablet: 232, Mobile: 175 }[combination.Viewport];
  const posterHeight = Math.round(width * 1.5);
  const height = posterHeight + 70;
  const state = combination.State;
  const component = tag(figma.createComponent(), key, "P3");
  component.name = v2VariantName(combination);
  configureFixedAutoLayout(component, "VERTICAL", width, height, 3, context);
  component.primaryAxisAlignItems = "MIN";
  component.counterAxisAlignItems = "MIN";
  component.fills = [];
  component.strokes = [];
  component.effects =
    state === "Hover"
      ? [componentEffect("DROP_SHADOW", "rgba(108,88,229,0.13)", { x: 0, y: 0 }, 26)]
      : state === "Focus"
        ? [componentEffect("DROP_SHADOW", "rgba(110,231,249,0.22)", { x: 0, y: 0 }, 0, 3)]
        : [];
  const media = await a01MediaInstance(
    componentPage,
    "Poster",
    state === "Default" ? "Default" : "Hover",
    `${key}/media`,
    width,
    posterHeight,
    "P3"
  );
  component.appendChild(media);
  media.strokes = [
    state === "Default" ? solidPaint("rgba(222,228,255,0.14)") : solidPaint("rgba(139,124,255,0.42)")
  ];
  media.strokeWeight = state === "Focus" ? 2 : 1;
  setRadius(media, combination.Viewport === "Mobile" ? 15 : 18, null);
  media.effects = [
    componentEffect("DROP_SHADOW", state === "Default" ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.36)", { x: 0, y: 20 }, state === "Default" ? 40 : 58)
  ];
  await a01Text(component, `${key}/title`, "测试文本", context, {
    dynamic: true,
    size: 15,
    width: width - 4,
    font: context.fonts.bold
  });
  const meta = a01Fixed(component, `${key}/meta`, "Shelf Meta", "HORIZONTAL", width - 4, 20, 8, context, "P3");
  meta.primaryAxisAlignItems = "SPACE_BETWEEN";
  await a01Text(meta, `${key}/meta/copy`, "测试文本", context, {
    dynamic: true,
    size: 12,
    color: context.muted,
    width: width - 58
  });
  await a01Text(meta, `${key}/meta/score`, "测试文本", context, {
    dynamic: true,
    size: 12,
    color: context.accent2,
    font: context.fonts.bold
  });
  return component;
}

async function a01CreateShelfTabVariant(spec, combination, context, key) {
  const state = combination.State;
  const width = combination.Kind === "Recommended" ? 70 : 84;
  const component = tag(figma.createComponent(), key, "P3");
  component.name = v2VariantName(combination);
  configureFixedAutoLayout(component, "HORIZONTAL", width, 44, 0, context);
  const highlighted = ["Hover", "Active"].includes(state);
  component.fills = [
    highlighted ? bindColor(context.selected, "rgba(139,124,255,0.13)") : solidPaint("rgba(0,0,0,0)")
  ];
  component.strokes = [
    state === "Focus"
      ? bindColor(context.lineAccentStrong, "rgba(110,231,249,0.54)")
      : highlighted
        ? solidPaint("rgba(139,124,255,0.20)")
        : solidPaint("rgba(0,0,0,0)")
  ];
  component.strokeWeight = state === "Focus" ? 2 : 1;
  setRadius(component, 11, null);
  component.effects =
    state === "Focus" ? [componentEffect("DROP_SHADOW", "rgba(110,231,249,0.22)", { x: 0, y: 0 }, 0, 3)] : [];
  await a01Text(
    component,
    `${key}/label`,
    combination.Kind === "Recommended" ? "推荐" : "测试文本",
    context,
    {
      dynamic: combination.Kind === "Category",
      size: 12,
      color: highlighted ? context.text : context.muted,
      font: state === "Active" ? context.fonts.bold : context.fonts.medium
    }
  );
  return component;
}

async function a01CreateCarouselControlVariant(spec, combination, context, key) {
  const component = tag(figma.createComponent(), key, "P3");
  component.name = v2VariantName(combination);
  configureFixedAutoLayout(component, "HORIZONTAL", 40, 40, 0, context);
  component.fills = [solidPaint("rgba(9,12,23,0.56)")];
  component.strokes = [solidPaint("rgba(229,233,255,0.18)")];
  component.strokeWeight = 1;
  setRadius(component, 13, null);
  component.effects = [
    componentEffect("DROP_SHADOW", "rgba(0,0,0,0.26)", { x: 0, y: 12 }, 28),
    componentEffect("INNER_SHADOW", "rgba(255,255,255,0.08)", { x: 0, y: 1 }, 0)
  ];
  await a01Text(component, `${key}/label`, combination.State === "Playing" ? "Ⅱ" : "▶", context, {
    size: 13,
    font: context.fonts.bold
  });
  return component;
}

async function a01CreateMenuToggleVariant(spec, combination, context, key) {
  const component = tag(figma.createComponent(), key, "P3");
  component.name = v2VariantName(combination);
  configureFixedAutoLayout(component, "VERTICAL", 44, 44, 4, context);
  component.fills = [
    combination.State === "Hover" ? solidPaint("rgba(139,124,255,0.13)") : solidPaint("rgba(255,255,255,0.06)")
  ];
  component.strokes = [
    combination.State === "Open"
      ? bindColor(context.lineAccentStrong, "rgba(110,231,249,0.54)")
      : solidPaint("rgba(226,231,255,0.18)")
  ];
  component.strokeWeight = combination.State === "Open" ? 2 : 1;
  setRadius(component, 13, null);
  for (const index of [0, 1, 2]) {
    const line = tag(figma.createRectangle(), `${key}/line/${index}`, "P3");
    line.resize(combination.State === "Open" && index === 1 ? 12 : 19, 2);
    line.fills = [bindColor(context.text, "#f4f6ff")];
    setRadius(line, 999, null);
    component.appendChild(line);
  }
  return component;
}

async function a01CreateDrawerVariant(spec, combination, context, key) {
  const width = combination.Viewport === "Mobile" ? 362 : 320;
  const component = tag(figma.createComponent(), key, "P3");
  component.name = v2VariantName(combination);
  configureFixedAutoLayout(component, "VERTICAL", width, 456, 12, context);
  component.paddingTop = 20;
  component.paddingRight = 20;
  component.paddingBottom = 24;
  component.paddingLeft = 20;
  component.primaryAxisAlignItems = "MIN";
  component.counterAxisAlignItems = "MIN";
  a01Surface(component, context, {
    radius: 24,
    fill: bindColor(context.panel, "rgba(15,19,34,0.96)"),
    stroke: bindColor(context.lineAccent, "rgba(110,231,249,0.34)"),
    effects: [
      componentEffect("DROP_SHADOW", "rgba(0,0,0,0.46)", { x: 0, y: 28 }, 72),
      componentEffect("INNER_SHADOW", "rgba(255,255,255,0.08)", { x: 0, y: 1 }, 0)
    ]
  });
  const title = a01Fixed(component, `${key}/title-row`, "Drawer Title", "HORIZONTAL", width - 40, 44, 12, context, "P3");
  title.primaryAxisAlignItems = "SPACE_BETWEEN";
  await a01Text(title, `${key}/title`, "分类导航", context, {
    size: 20,
    font: context.fonts.bold
  });
  await a01Text(title, `${key}/close`, "×", context, {
    size: 22,
    font: context.fonts.bold
  });
  const search = a01Fixed(component, `${key}/search`, "Search", "HORIZONTAL", width - 40, 48, 0, context, "P3");
  search.paddingLeft = 14;
  search.primaryAxisAlignItems = "MIN";
  search.fills = [bindColor(context.panelSoft, "rgba(23,28,48,0.82)")];
  search.strokes = [bindColor(context.line, "rgba(221,228,255,0.16)")];
  search.strokeWeight = 1;
  setRadius(search, 12, context.radiusSmall);
  await a01Text(search, `${key}/search/label`, "搜索", context, { size: 12, color: context.muted });
  const nav = a01Fixed(component, `${key}/nav`, "Drawer Navigation", "VERTICAL", width - 40, 300, 8, context, "P3");
  nav.primaryAxisAlignItems = "MIN";
  nav.counterAxisAlignItems = "MIN";
  for (const [index, label] of ["首页", "视频", "分类", "年度排行", "新上线", "用户中心"].entries()) {
    const row = a01Fixed(nav, `${key}/nav/${index}`, label, "HORIZONTAL", width - 40, 42, 0, context, "P3");
    row.paddingLeft = 12;
    row.primaryAxisAlignItems = "MIN";
    row.fills = [index === 0 ? bindColor(context.selected, "rgba(139,124,255,0.14)") : solidPaint("rgba(255,255,255,0.035)")];
    row.strokes = [index === 0 ? solidPaint("rgba(139,124,255,0.28)") : solidPaint("rgba(0,0,0,0)")];
    row.strokeWeight = 1;
    setRadius(row, 11, null);
    await a01Text(row, `${key}/nav/${index}/label`, label, context, {
      size: 13,
      color: index === 0 ? context.text : context.muted,
      font: index === 0 ? context.fonts.bold : context.fonts.medium
    });
  }
  return component;
}

async function a01CreateComponentVariant(spec, combination, context, componentPage, key) {
  if (spec.id === "home-rank-item") return a01CreateRankVariant(spec, combination, context, componentPage, key);
  if (spec.id === "home-genre-chip") return a01CreateGenreVariant(spec, combination, context, key);
  if (spec.id === "home-continue-card") return a01CreateContinueVariant(spec, combination, context, componentPage, key);
  if (spec.id === "home-shelf-card") return a01CreateShelfCardVariant(spec, combination, context, componentPage, key);
  if (spec.id === "home-shelf-tab") return a01CreateShelfTabVariant(spec, combination, context, key);
  if (spec.id === "home-carousel-control") return a01CreateCarouselControlVariant(spec, combination, context, key);
  if (spec.id === "navigation-menu-toggle") return a01CreateMenuToggleVariant(spec, combination, context, key);
  if (spec.id === "navigation-mobile-drawer") return a01CreateDrawerVariant(spec, combination, context, key);
  throw new Error(`Unknown A01 component: ${spec.id}`);
}

async function a01WireComponentReactions(componentSet, spec) {
  const components = componentSet.children.filter((node) => node.type === "COMPONENT");
  const sibling = (component, overrides) =>
    components.find((candidate) =>
      Object.entries({ ...(component.variantProperties || {}), ...overrides }).every(
        ([property, value]) => a01CombinationValue(candidate, property) === value
      )
    );
  for (const component of components) {
    const state = a01CombinationValue(component, "State");
    const reactions = [];
    const hover = sibling(component, { State: "Hover" });
    if (state === "Default" && hover) {
      reactions.push(v2ChangeToReaction(hover.id, "ON_HOVER", 0.2, "SMART_ANIMATE"));
    }
    if (spec.id === "home-shelf-tab" && ["Default", "Hover"].includes(state)) {
      const active = sibling(component, { State: "Active" });
      if (active) reactions.push(v2ChangeToReaction(active.id, "ON_CLICK", 0.18, "SMART_ANIMATE"));
    }
    if (spec.id === "home-carousel-control") {
      const target = sibling(component, { State: state === "Playing" ? "Paused" : "Playing" });
      if (target) reactions.push(v2ChangeToReaction(target.id, "ON_CLICK", 0.12, "DISSOLVE"));
    }
    if (spec.id === "navigation-menu-toggle" && ["Default", "Hover"].includes(state)) {
      const open = sibling(component, { State: "Open" });
      if (open) reactions.push(v2ChangeToReaction(open.id, "ON_CLICK", 0.16, "SMART_ANIMATE"));
    }
    await component.setReactionsAsync(reactions);
  }
}

function a01ComponentLayout(spec) {
  return {
    "home-rank-item": { columns: 3, columnWidth: 286, rowHeight: 116 },
    "home-genre-chip": { columns: 3, columnWidth: 250, rowHeight: 108 },
    "home-continue-card": { columns: 2, columnWidth: 382, rowHeight: 154 },
    "home-shelf-card": { columns: 3, columnWidth: 260, rowHeight: 440 },
    "home-shelf-tab": { columns: 4, columnWidth: 110, rowHeight: 74 },
    "home-carousel-control": { columns: 2, columnWidth: 80, rowHeight: 70 },
    "navigation-menu-toggle": { columns: 3, columnWidth: 80, rowHeight: 74 },
    "navigation-mobile-drawer": { columns: 2, columnWidth: 390, rowHeight: 490 }
  }[spec.id];
}

async function a01BuildComponentFamily(componentId) {
  const spec = A01_COMPONENT_SPECS.find((item) => item.id === componentId);
  if (!spec) throw new Error(`Unknown A01 component family: ${componentId}`);
  const { page } = await ensurePlannedPage("02 · Components");
  assertMutableTargetPage(page);
  await figma.setCurrentPageAsync(page);
  await page.loadAsync();
  const context = await docContext();
  const key = a01ComponentKey(spec);
  const combinations = v2VariantCombinations(spec.dimensions);
  const expectedNames = combinations.map(v2VariantName).sort();
  const existingSet = a01ComponentSetByKey(page, `${key}/set`);
  const existingNames = existingSet
    ? existingSet.children.filter((node) => node.type === "COMPONENT").map((node) => node.name).sort()
    : [];
  if (
    existingSet &&
    existingSet.getSharedPluginData(NS, "component_revision") === A01_COMPONENT_REVISION &&
    JSON.stringify(existingNames) === JSON.stringify(expectedNames)
  ) {
    await a01WireComponentReactions(existingSet, spec);
    return existingSet;
  }
  if (existingSet) {
    const existingRoot = page.children.find((node) => entityKey(node) === key);
    if (!existingRoot) throw new Error(`A01 component root missing: ${spec.name}`);
    existingRoot.remove();
  }

  const root = tag(createAutoFrame(`${spec.name} / Liquid Cinema`, "VERTICAL", 1440, 22), key, "P3");
  root.paddingTop = 42;
  root.paddingRight = 42;
  root.paddingBottom = 56;
  root.paddingLeft = 42;
  root.fills = [bindColor(context.canvas, "#05070d")];
  page.appendChild(root);
  placeAwayFromExisting(page, root);
  await a01Text(root, `${key}/title`, spec.name, context, {
    size: 30,
    width: 1356,
    font: context.fonts.bold
  });
  await a01Text(
    root,
    `${key}/meta`,
    "Liquid Cinema default theme · current source states · media placeholders · dynamic copy policy enforced.",
    context,
    { size: 12, width: 1356, color: context.muted }
  );
  const holder = tag(figma.createFrame(), `${key}/holder`, "P3");
  holder.name = `${spec.name} / Variant Holder`;
  holder.fills = [];
  root.appendChild(holder);
  const layout = a01ComponentLayout(spec);
  const columns = Math.min(layout.columns, combinations.length);
  const rows = Math.ceil(combinations.length / columns);
  holder.resize(columns * layout.columnWidth, rows * layout.rowHeight);
  const components = [];
  for (let index = 0; index < combinations.length; index += 1) {
    const combination = combinations[index];
    const component = await a01CreateComponentVariant(
      spec,
      combination,
      context,
      page,
      `${key}/variant/${v2VariantName(combination)}`
    );
    holder.appendChild(component);
    component.x = (index % columns) * layout.columnWidth;
    component.y = Math.floor(index / columns) * layout.rowHeight;
    components.push(component);
  }
  const componentSet = tag(figma.combineAsVariants(components, holder), `${key}/set`, "P3");
  componentSet.name = spec.name;
  componentSet.description = `Liquid Cinema default theme · ${PLAN.source.branch}@${PLAN.source.commit} · source-backed A01 states.`;
  componentSet.setSharedPluginData(NS, "component_revision", A01_COMPONENT_REVISION);
  componentSet.children.forEach((component, index) => {
    component.x = (index % columns) * layout.columnWidth;
    component.y = Math.floor(index / columns) * layout.rowHeight;
  });
  componentSet.resize(columns * layout.columnWidth, rows * layout.rowHeight);
  await a01WireComponentReactions(componentSet, spec);
  return componentSet;
}

async function a01EnsureComponentDependencies() {
  const { page: componentPage } = await ensurePlannedPage("02 · Components");
  await componentPage.loadAsync();
  const mediaSet = a01ComponentSetByKey(componentPage, "v2/component/media-placeholder/set");
  if (!mediaSet || mediaSet.getSharedPluginData(NS, "component_revision") !== V2_COMPONENT_REVISION) {
    await buildV2ComponentFamily("media-placeholder");
  }
  const navSet = a01ComponentSetByKey(componentPage, "v2/component/navigation-nav-item/set");
  if (!navSet || navSet.getSharedPluginData(NS, "component_revision") !== V2_COMPONENT_REVISION) {
    await buildV2ComponentFamily("navigation-nav-item");
  }
  const legacySets = [
    ["action-button", "p3/component/action-button/set"],
    ["form-header-search", "p3/component/form-header-search/set"]
  ];
  for (const [buildId, key] of legacySets) {
    const existing = a01ComponentSetByKey(componentPage, key);
    if (!existing || existing.getSharedPluginData(NS, "component_revision") !== LEGACY_COMPONENT_REVISION) {
      await buildComponentFamily(buildId);
    }
  }
  for (const spec of A01_COMPONENT_SPECS) {
    const existing = a01ComponentSetByKey(componentPage, `${a01ComponentKey(spec)}/set`);
    if (!existing || existing.getSharedPluginData(NS, "component_revision") !== A01_COMPONENT_REVISION) {
      await a01BuildComponentFamily(spec.id);
    }
  }
  await componentPage.loadAsync();
  return {
    componentPage,
    media: a01ComponentSetByKey(componentPage, "v2/component/media-placeholder/set"),
    nav: a01ComponentSetByKey(componentPage, "v2/component/navigation-nav-item/set"),
    action: a01ComponentSetByKey(componentPage, "p3/component/action-button/set"),
    search: a01ComponentSetByKey(componentPage, "p3/component/form-header-search/set"),
    home: Object.fromEntries(
      A01_COMPONENT_SPECS.map((spec) => [spec.id, a01ComponentSetByKey(componentPage, `${a01ComponentKey(spec)}/set`)])
    )
  };
}

async function a01SetInstanceText(instance, value, policy = "structural") {
  const text = instance.findOne((node) => node.type === "TEXT");
  if (!text) return;
  await v2LoadTextFonts(text, new Map());
  text.characters = value;
  text.setSharedPluginData(NS, "text_policy", policy);
}

function a01NodeReaction(destinationId, navigation = "NAVIGATE", transitionType = "SMART_ANIMATE", duration = 0.24) {
  return {
    trigger: { type: "ON_CLICK" },
    actions: [
      {
        type: "NODE",
        destinationId,
        navigation,
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

function a01CloseReaction() {
  return {
    trigger: { type: "ON_CLICK" },
    actions: [{ type: "CLOSE" }]
  };
}

function a01ViewportName(width) {
  return width === 1440 ? "Desktop" : width === 768 ? "Tablet" : "Mobile";
}

function a01WrapWidth(width) {
  return width === 1440 ? 1384 : width === 768 ? 728 : 362;
}

async function a01AppendBrand(parent, key, context, compact) {
  const width = compact ? 164 : 190;
  const brand = a01Fixed(parent, key, "Brand", "HORIZONTAL", width, compact ? 44 : 52, 10, context);
  brand.primaryAxisAlignItems = "MIN";
  const emblem = a01Fixed(
    brand,
    `${key}/emblem`,
    "Brand Emblem",
    "VERTICAL",
    compact ? 36 : 42,
    compact ? 36 : 42,
    0,
    context
  );
  emblem.fills = [
    gradientPaint([
      [0, "#8b7cff"],
      [1, "#6ee7f9"]
    ])
  ];
  emblem.strokes = [solidPaint("rgba(255,255,255,0.24)")];
  emblem.strokeWeight = 1;
  setRadius(emblem, compact ? 12 : 14, null);
  await a01Text(emblem, `${key}/emblem/mark`, "平", context, {
    size: compact ? 14 : 16,
    font: context.fonts.bold
  });
  const copy = a01Fixed(
    brand,
    `${key}/copy`,
    "Brand Copy",
    "VERTICAL",
    width - (compact ? 46 : 52),
    compact ? 38 : 44,
    2,
    context
  );
  copy.primaryAxisAlignItems = "CENTER";
  copy.counterAxisAlignItems = "MIN";
  await a01Text(copy, `${key}/name`, "平方视频", context, {
    size: compact ? 14 : 16,
    width: copy.width,
    font: context.fonts.bold
  });
  if (!compact) {
    await a01Text(copy, `${key}/edition`, "STREAMING EDITION", context, {
      size: 8,
      width: copy.width,
      color: context.muted,
      font: context.fonts.bold
    });
  }
  return brand;
}

async function a01AppendHeader(parent, width, context, dependencies, key) {
  const viewport = a01ViewportName(width);
  const wrapWidth = a01WrapWidth(width);
  const compact = width === 390;
  const headerHeight = compact ? 72 : 88;
  const header = a01Fixed(parent, key, "Site Header", "HORIZONTAL", width, headerHeight, 0, context);
  header.fills = [bindColor(context.canvas, "#05070d")];
  header.setSharedPluginData(NS, "module", "header");
  const inner = a01Fixed(
    header,
    `${key}/inner`,
    "Header Inner",
    "HORIZONTAL",
    wrapWidth,
    compact ? 58 : 68,
    16,
    context
  );
  inner.paddingLeft = compact ? 8 : 12;
  inner.paddingRight = compact ? 8 : 12;
  inner.primaryAxisAlignItems = "SPACE_BETWEEN";
  inner.counterAxisAlignItems = "CENTER";
  a01Surface(inner, context, {
    radius: compact ? 18 : 22,
    fill: bindColor(context.panel, "rgba(15,19,34,0.76)"),
    stroke: bindColor(context.line, "rgba(221,228,255,0.16)"),
    effects: [
      componentEffect("DROP_SHADOW", "rgba(0,0,0,0.24)", { x: 0, y: 16 }, 38),
      componentEffect("INNER_SHADOW", "rgba(255,255,255,0.07)", { x: 0, y: 1 }, 0)
    ]
  });
  await a01AppendBrand(inner, `${key}/brand`, context, compact);

  if (viewport === "Desktop") {
    const nav = a01Fixed(inner, `${key}/nav`, "Site Navigation", "HORIZONTAL", 190, 44, 4, context);
    for (const [index, item] of ["首页", "视频", "游戏"].entries()) {
      const instance = a01CreateInstance(
        dependencies.nav,
        { State: index === 0 ? "Current" : "Default" },
        `${key}/nav/${index}`
      );
      await a01SetInstanceText(instance, item);
      nav.appendChild(instance);
    }
    const search = a01CreateInstance(dependencies.search, { State: "Default" }, `${key}/search`);
    a01ResizeInstance(search, 420, 44);
    inner.appendChild(search);
    const actions = a01Fixed(inner, `${key}/actions`, "Header Actions", "HORIZONTAL", 174, 44, 8, context);
    for (const [index, item] of ["主题", "登录"].entries()) {
      const action = a01CreateInstance(
        dependencies.action,
        { Style: "Ghost", State: "Default" },
        `${key}/actions/${index}`
      );
      await a01SetInstanceText(action, item);
      actions.appendChild(action);
    }
  } else {
    const trailing = a01Fixed(
      inner,
      `${key}/trailing`,
      "Header Trailing",
      "HORIZONTAL",
      viewport === "Tablet" ? 126 : 44,
      44,
      8,
      context
    );
    trailing.primaryAxisAlignItems = "MAX";
    if (viewport === "Tablet") {
      const account = a01CreateInstance(
        dependencies.action,
        { Style: "Ghost", State: "Default" },
        `${key}/account`
      );
      await a01SetInstanceText(account, "登录");
      trailing.appendChild(account);
    }
    const menu = a01CreateInstance(
      dependencies.home["navigation-menu-toggle"],
      { State: "Default" },
      `${key}/menu`
    );
    menu.setSharedPluginData(NS, "interaction_role", "open-mobile-drawer");
    trailing.appendChild(menu);
  }
  return header;
}

async function a01AppendHero(parent, width, context, dependencies, key) {
  const viewport = a01ViewportName(width);
  const wrapWidth = a01WrapWidth(width);
  const heroHeight = width === 1440 ? 653 : width === 768 ? 696 : 520;
  const section = tag(createAutoFrame("Hero", "VERTICAL", wrapWidth, 18), key, "P4");
  section.paddingTop = width === 390 ? 10 : 18;
  section.paddingBottom = width === 390 ? 14 : 20;
  section.fills = [];
  section.setSharedPluginData(NS, "module", "hero");
  parent.appendChild(section);

  const carousel = a01Free(section, `${key}/carousel`, "Hero Carousel", wrapWidth, heroHeight);
  carousel.clipsContent = true;
  carousel.fills = [solidPaint("#0a0d17")];
  carousel.strokes = [solidPaint("rgba(218,225,255,0.20)")];
  carousel.strokeWeight = 1;
  setRadius(carousel, width === 390 ? 24 : 30, null);
  carousel.effects = [
    componentEffect("DROP_SHADOW", "rgba(0,0,0,0.50)", { x: 0, y: 38 }, 120),
    componentEffect("DROP_SHADOW", "rgba(104,83,237,0.12)", { x: 0, y: 0 }, 60),
    componentEffect("INNER_SHADOW", "rgba(255,255,255,0.10)", { x: 0, y: 1 }, 0)
  ];
  carousel.setSharedPluginData(NS, "allow_overlap", "true");
  const media = await a01MediaInstance(
    dependencies.componentPage,
    "Backdrop",
    "Default",
    `${key}/carousel/media`,
    wrapWidth,
    heroHeight
  );
  carousel.appendChild(media);
  media.x = 0;
  media.y = 0;
  media.opacity = 0.5;

  const overlay = tag(figma.createRectangle(), `${key}/carousel/overlay`, "P4");
  overlay.resize(wrapWidth, heroHeight);
  overlay.fills = [
    gradientPaint([
      [0, "rgba(5,7,13,0.92)"],
      [0.56, width === 390 ? "rgba(5,7,13,0.30)" : "rgba(5,7,13,0.48)"],
      [1, width === 390 ? "rgba(5,7,13,0.88)" : "rgba(5,7,13,0.12)"]
    ])
  ];
  overlay.strokes = [];
  carousel.appendChild(overlay);
  overlay.x = 0;
  overlay.y = 0;

  const contentWidth = width === 1440 ? 680 : width === 768 ? 560 : 318;
  const contentHeight = width === 390 ? 300 : 360;
  const content = a01Fixed(
    carousel,
    `${key}/carousel/content`,
    "Hero Copy",
    "VERTICAL",
    contentWidth,
    contentHeight,
    width === 390 ? 12 : 15,
    context
  );
  content.primaryAxisAlignItems = "MIN";
  content.counterAxisAlignItems = "MIN";
  content.x = width === 1440 ? 82 : width === 768 ? 56 : 22;
  content.y = width === 1440 ? 112 : width === 768 ? 136 : 178;
  const eyebrow = a01Fixed(content, `${key}/carousel/eyebrow`, "Hero Eyebrow", "HORIZONTAL", 148, 32, 0, context);
  eyebrow.fills = [solidPaint("rgba(134,116,255,0.15)")];
  eyebrow.strokes = [solidPaint("rgba(210,205,255,0.24)")];
  eyebrow.strokeWeight = 1;
  setRadius(eyebrow, 999, null);
  await a01Text(eyebrow, `${key}/carousel/eyebrow/label`, "热播推荐", context, {
    size: 11,
    color: context.text,
    font: context.fonts.bold
  });
  await a01Text(content, `${key}/carousel/title`, "测试文本", context, {
    dynamic: true,
    size: width === 1440 ? 72 : width === 768 ? 60 : 46,
    width: contentWidth,
    font: context.fonts.bold
  });
  const meta = a01Fixed(
    content,
    `${key}/carousel/meta`,
    "Hero Meta",
    "HORIZONTAL",
    contentWidth,
    28,
    7,
    context
  );
  meta.primaryAxisAlignItems = "MIN";
  for (let index = 0; index < (width === 390 ? 2 : 4); index += 1) {
    const pill = a01Fixed(meta, `${key}/carousel/meta/${index}`, "Meta", "HORIZONTAL", 82, 26, 0, context);
    pill.fills = [solidPaint("rgba(9,12,23,0.35)")];
    pill.strokes = [solidPaint("rgba(229,233,255,0.14)")];
    pill.strokeWeight = 1;
    setRadius(pill, 999, null);
    await a01Text(pill, `${key}/carousel/meta/${index}/label`, "测试文本", context, {
      dynamic: true,
      size: 11,
      color: context.muted
    });
  }
  await a01Text(content, `${key}/carousel/body`, "测试文本", context, {
    dynamic: true,
    size: width === 390 ? 13 : 15,
    width: width === 390 ? contentWidth : 590,
    color: context.muted
  });
  const actions = a01Fixed(
    content,
    `${key}/carousel/actions`,
    "Hero Actions",
    "HORIZONTAL",
    contentWidth,
    48,
    9,
    context
  );
  actions.primaryAxisAlignItems = "MIN";
  for (const [index, action] of [
    ["Primary", "立即播放"],
    ["Ghost", "详情介绍"]
  ].entries()) {
    const button = a01CreateInstance(
      dependencies.action,
      { Style: action[0], State: "Default" },
      `${key}/carousel/actions/${index}`
    );
    await a01SetInstanceText(button, action[1]);
    button.setSharedPluginData(NS, "interaction_role", index === 0 ? "play-cta" : "detail-cta");
    actions.appendChild(button);
  }

  const controls = a01Fixed(
    carousel,
    `${key}/carousel/controls`,
    "Carousel Controls",
    "HORIZONTAL",
    244,
    44,
    10,
    context
  );
  controls.x = Math.round((wrapWidth - 244) / 2);
  controls.y = heroHeight - 64;
  controls.paddingLeft = 10;
  controls.paddingRight = 10;
  controls.fills = [solidPaint("rgba(9,12,23,0.44)")];
  controls.strokes = [solidPaint("rgba(229,233,255,0.14)")];
  controls.strokeWeight = 1;
  setRadius(controls, 999, null);
  const autoplay = a01CreateInstance(
    dependencies.home["home-carousel-control"],
    { State: "Playing" },
    `${key}/carousel/autoplay`
  );
  autoplay.setSharedPluginData(NS, "interaction_role", "carousel-autoplay");
  controls.appendChild(autoplay);
  const dots = a01Fixed(controls, `${key}/carousel/dots`, "Carousel Dots", "HORIZONTAL", 164, 24, 7, context);
  for (let index = 0; index < 5; index += 1) {
    const dot = tag(figma.createRectangle(), `${key}/carousel/dots/${index}`, "P4");
    dot.resize(index === 0 ? 34 : 22, 3);
    dot.fills = [
      index === 0
        ? gradientPaint([
            [0, "#6ee7f9"],
            [1, "#f1efff"]
          ])
        : solidPaint("rgba(222,227,244,0.32)")
    ];
    setRadius(dot, 999, null);
    dots.appendChild(dot);
  }
  carousel.setSharedPluginData(NS, "viewport", viewport);
  return section;
}

async function a01AppendRank(parent, width, context, dependencies, key) {
  const viewport = a01ViewportName(width);
  const wrapWidth = a01WrapWidth(width);
  const panel = tag(createAutoFrame("Rank Board", "VERTICAL", wrapWidth, 10), key, "P4");
  panel.paddingTop = width === 390 ? 12 : 15;
  panel.paddingRight = width === 390 ? 12 : 15;
  panel.paddingBottom = width === 390 ? 12 : 15;
  panel.paddingLeft = width === 390 ? 12 : 15;
  panel.fills = [];
  panel.setSharedPluginData(NS, "module", "rank");
  parent.appendChild(panel);
  a01Surface(panel, context, {
    radius: width === 390 ? 20 : 24,
    fill: bindColor(context.panel, "rgba(15,19,34,0.76)"),
    stroke: bindColor(context.lineAccentSoft, "rgba(204,226,255,0.22)")
  });

  const heading = a01Fixed(
    panel,
    `${key}/heading`,
    "Rank Heading",
    "HORIZONTAL",
    wrapWidth - (width === 390 ? 24 : 30),
    48,
    12,
    context
  );
  heading.primaryAxisAlignItems = "SPACE_BETWEEN";
  const title = a01Fixed(heading, `${key}/heading/title`, "Rank Title", "VERTICAL", 220, 44, 4, context);
  title.primaryAxisAlignItems = "CENTER";
  title.counterAxisAlignItems = "MIN";
  await a01Text(title, `${key}/heading/eyebrow`, "TOP 05", context, {
    size: 10,
    color: context.accent2,
    font: context.fonts.bold
  });
  await a01Text(title, `${key}/heading/name`, "年度热度榜", context, {
    size: width === 390 ? 22 : 24,
    font: context.fonts.bold
  });
  await a01Text(heading, `${key}/heading/more`, "查看更多", context, {
    size: 12,
    color: context.muted,
    font: context.fonts.bold
  });

  const listWidth = wrapWidth - (width === 390 ? 24 : 30);
  const list = a01Fixed(panel, `${key}/list`, "Rank List / Horizontal", "HORIZONTAL", listWidth, 94, 10, context);
  list.primaryAxisAlignItems = "MIN";
  list.counterAxisAlignItems = "MIN";
  list.clipsContent = viewport !== "Desktop";
  list.setSharedPluginData(NS, "responsive_rule", viewport === "Desktop" ? "5-columns" : "horizontal-scroll");
  for (let index = 0; index < 5; index += 1) {
    const instance = a01CreateInstance(
      dependencies.home["home-rank-item"],
      { Viewport: viewport, State: "Default" },
      `${key}/list/${index}`
    );
    instance.setSharedPluginData(NS, "interaction_role", "rank-item");
    list.appendChild(instance);
  }
  return panel;
}

async function a01AppendGenre(parent, width, context, dependencies, key) {
  const viewport = a01ViewportName(width);
  const wrapWidth = a01WrapWidth(width);
  const height = viewport === "Tablet" ? 167 : viewport === "Mobile" ? 88 : 96;
  const dock = a01Fixed(parent, key, "Genre Dock", "HORIZONTAL", wrapWidth, height, viewport === "Mobile" ? 9 : 11, context);
  dock.primaryAxisAlignItems = "MIN";
  dock.counterAxisAlignItems = "MIN";
  dock.paddingTop = viewport === "Mobile" ? 16 : 18;
  dock.paddingBottom = viewport === "Mobile" ? 8 : 0;
  dock.layoutWrap = viewport === "Tablet" ? "WRAP" : "NO_WRAP";
  dock.clipsContent = viewport === "Mobile";
  dock.fills = [];
  dock.setSharedPluginData(NS, "module", "genre");
  dock.setSharedPluginData(
    NS,
    "responsive_rule",
    viewport === "Desktop" ? "6-columns" : viewport === "Tablet" ? "3-columns-2-rows" : "horizontal-scroll"
  );
  const channels = ["Featured", "Standard", "Standard", "Standard", "Standard", "New"];
  for (const [index, channel] of channels.entries()) {
    const instance = a01CreateInstance(
      dependencies.home["home-genre-chip"],
      { Viewport: viewport, Channel: channel, State: "Default" },
      `${key}/${index}`
    );
    instance.setSharedPluginData(NS, "interaction_role", "genre-link");
    dock.appendChild(instance);
  }
  return dock;
}

async function a01AppendShelfHeading(parent, key, eyebrow, title, more, context, width, includeTabs, dependencies) {
  const mobile = width === 390;
  const wrapWidth = a01WrapWidth(width);
  const headingHeight = includeTabs ? (mobile ? 118 : 70) : 64;
  const heading = a01Fixed(parent, key, `${title} Heading`, "HORIZONTAL", wrapWidth, headingHeight, 12, context);
  heading.primaryAxisAlignItems = "SPACE_BETWEEN";
  heading.counterAxisAlignItems = "MIN";
  heading.layoutWrap = mobile && includeTabs ? "WRAP" : "NO_WRAP";
  const headingCopy = a01Fixed(
    heading,
    `${key}/copy`,
    "Shelf Title",
    "VERTICAL",
    mobile ? 218 : 260,
    56,
    4,
    context
  );
  headingCopy.primaryAxisAlignItems = "CENTER";
  headingCopy.counterAxisAlignItems = "MIN";
  await a01Text(headingCopy, `${key}/eyebrow`, eyebrow, context, {
    size: 10,
    color: context.accent2,
    font: context.fonts.bold
  });
  await a01Text(headingCopy, `${key}/title`, title, context, {
    size: mobile ? 24 : 28,
    font: context.fonts.bold
  });

  let tabs = null;
  if (includeTabs) {
    tabs = a01Fixed(
      heading,
      `${key}/tabs`,
      "Shelf Tabs",
      "HORIZONTAL",
      mobile ? wrapWidth : width === 768 ? 360 : 560,
      52,
      5,
      context
    );
    tabs.paddingTop = 4;
    tabs.paddingRight = 4;
    tabs.paddingBottom = 4;
    tabs.paddingLeft = 4;
    tabs.primaryAxisAlignItems = "MIN";
    tabs.clipsContent = mobile;
    tabs.fills = [solidPaint("rgba(255,255,255,0.025)")];
    tabs.strokes = [solidPaint("rgba(222,228,255,0.10)")];
    tabs.strokeWeight = 1;
    setRadius(tabs, 15, null);
    const recommended = a01CreateInstance(
      dependencies.home["home-shelf-tab"],
      { Kind: "Recommended", State: "Active" },
      `${key}/tabs/recommended`
    );
    recommended.setSharedPluginData(NS, "interaction_role", "shelf-tab");
    tabs.appendChild(recommended);
    for (let index = 0; index < 5; index += 1) {
      const category = a01CreateInstance(
        dependencies.home["home-shelf-tab"],
        { Kind: "Category", State: "Default" },
        `${key}/tabs/${index}`
      );
      category.setSharedPluginData(NS, "interaction_role", "shelf-tab");
      tabs.appendChild(category);
    }
  }
  await a01Text(heading, `${key}/more`, more, context, {
    size: 12,
    color: context.muted,
    font: context.fonts.bold
  });
  return { heading, tabs };
}

async function a01AppendContinue(parent, width, context, dependencies, key) {
  const viewport = a01ViewportName(width);
  const wrapWidth = a01WrapWidth(width);
  const section = tag(createAutoFrame("Continue Watching", "VERTICAL", wrapWidth, 14), key, "P4");
  section.paddingTop = viewport === "Mobile" ? 30 : 34;
  section.paddingBottom = 8;
  section.fills = [];
  section.setSharedPluginData(NS, "module", "continue");
  section.setSharedPluginData(NS, "state", "Ready");
  parent.appendChild(section);
  await a01AppendShelfHeading(section, `${key}/heading`, "KEEP WATCHING", "继续观看", "全部记录", context, width, false, dependencies);
  const railHeight = viewport === "Mobile" ? 132 : viewport === "Tablet" ? 262 : 132;
  const rail = a01Fixed(
    section,
    `${key}/rail`,
    "Continue Rail",
    "HORIZONTAL",
    wrapWidth,
    railHeight,
    viewport === "Mobile" ? 10 : 14,
    context
  );
  rail.primaryAxisAlignItems = "MIN";
  rail.counterAxisAlignItems = "MIN";
  rail.layoutWrap = viewport === "Tablet" ? "WRAP" : "NO_WRAP";
  rail.clipsContent = viewport === "Mobile";
  rail.setSharedPluginData(
    NS,
    "responsive_rule",
    viewport === "Desktop" ? "4-columns" : viewport === "Tablet" ? "2-columns" : "horizontal-scroll"
  );
  const count = viewport === "Desktop" ? 4 : viewport === "Tablet" ? 4 : 3;
  for (let index = 0; index < count; index += 1) {
    const instance = a01CreateInstance(
      dependencies.home["home-continue-card"],
      { Viewport: viewport, State: "Default" },
      `${key}/rail/${index}`
    );
    instance.setSharedPluginData(NS, "interaction_role", "continue-link");
    rail.appendChild(instance);
  }
  return section;
}

async function a01AppendLatest(parent, width, context, dependencies, key) {
  const viewport = a01ViewportName(width);
  const wrapWidth = a01WrapWidth(width);
  const section = tag(createAutoFrame("Latest Shelf", "VERTICAL", wrapWidth, 20), key, "P4");
  section.paddingTop = viewport === "Mobile" ? 38 : 48;
  section.paddingBottom = viewport === "Mobile" ? 18 : 24;
  section.fills = [];
  section.setSharedPluginData(NS, "module", "latest");
  parent.appendChild(section);
  await a01AppendShelfHeading(
    section,
    `${key}/heading`,
    "NEW THIS YEAR",
    "本年最新上线",
    "全部影片",
    context,
    width,
    true,
    dependencies
  );
  const cardHeight = viewport === "Desktop" ? 396 : viewport === "Tablet" ? 426 : 338;
  const rows = viewport === "Desktop" ? 1 : viewport === "Tablet" ? 2 : 3;
  const railHeight = rows * cardHeight + (rows - 1) * (viewport === "Mobile" ? 18 : 20);
  const rail = a01Fixed(
    section,
    `${key}/rail`,
    "Latest Grid",
    "HORIZONTAL",
    wrapWidth,
    railHeight,
    viewport === "Mobile" ? 11 : 16,
    context
  );
  rail.primaryAxisAlignItems = "MIN";
  rail.counterAxisAlignItems = "MIN";
  rail.layoutWrap = viewport === "Desktop" ? "NO_WRAP" : "WRAP";
  rail.setSharedPluginData(
    NS,
    "responsive_rule",
    viewport === "Desktop" ? "6-columns" : viewport === "Tablet" ? "3-columns" : "2-columns"
  );
  for (let index = 0; index < 6; index += 1) {
    const instance = a01CreateInstance(
      dependencies.home["home-shelf-card"],
      { Viewport: viewport, State: "Default" },
      `${key}/rail/${index}`
    );
    instance.setSharedPluginData(NS, "interaction_role", "shelf-card");
    rail.appendChild(instance);
  }
  return section;
}

async function a01AppendFooter(parent, width, context, key) {
  const wrapWidth = a01WrapWidth(width);
  const footer = a01Fixed(parent, key, "Site Footer", "HORIZONTAL", width, width === 390 ? 122 : 132, 0, context);
  footer.fills = [solidPaint("rgba(255,255,255,0.018)")];
  footer.strokes = [solidPaint("rgba(222,228,255,0.08)")];
  footer.strokeTopWeight = 1;
  const inner = a01Fixed(footer, `${key}/inner`, "Footer Inner", "HORIZONTAL", wrapWidth, 80, 16, context);
  inner.primaryAxisAlignItems = "SPACE_BETWEEN";
  await a01Text(inner, `${key}/brand`, "平方视频", context, {
    size: 15,
    font: context.fonts.bold
  });
  await a01Text(inner, `${key}/links`, "首页 · 视频 · 游戏", context, {
    size: 12,
    color: context.muted
  });
  return footer;
}

async function a01CreateViewport(width, context, dependencies, key) {
  const viewport = a01ViewportName(width);
  const screen = tag(createAutoFrame(`A01 · ${viewport} · Normal`, "VERTICAL", width, 0), key, "P4");
  screen.fills = [bindColor(context.canvas, "#05070d")];
  screen.clipsContent = false;
  screen.setSharedPluginData(NS, "source_kind", "code-composed");
  screen.setSharedPluginData(NS, "prototype_revision", A01_PROTOTYPE_REVISION);
  screen.setSharedPluginData(NS, "viewport", String(width));
  screen.setSharedPluginData(NS, "source_commit", PLAN.source.commit);
  screen.setSharedPluginData(NS, "responsive_mode", viewport);
  await a01AppendHeader(screen, width, context, dependencies, `${key}/header`);
  const body = tag(createAutoFrame("Home Content", "VERTICAL", width, 0), `${key}/body`, "P4");
  body.fills = [];
  body.counterAxisAlignItems = "CENTER";
  screen.appendChild(body);
  await a01AppendHero(body, width, context, dependencies, `${key}/hero`);
  await a01AppendRank(body, width, context, dependencies, `${key}/rank`);
  await a01AppendGenre(body, width, context, dependencies, `${key}/genre`);
  await a01AppendContinue(body, width, context, dependencies, `${key}/continue`);
  await a01AppendLatest(body, width, context, dependencies, `${key}/latest`);
  await a01AppendFooter(screen, width, context, `${key}/footer`);
  return screen;
}

function a01OverlayReaction(destinationId) {
  return {
    trigger: { type: "ON_CLICK" },
    actions: [
      {
        type: "NODE",
        destinationId,
        navigation: "OVERLAY",
        transition: {
          type: "MOVE_IN",
          direction: "LEFT",
          matchLayers: false,
          easing: { type: "EASE_OUT" },
          duration: 0.24
        },
        resetScrollPosition: false
      }
    ]
  };
}

async function a01CreateDrawerOverlay(parent, viewport, context, dependencies, key) {
  const width = viewport === "Mobile" ? 362 : 320;
  const overlay = a01Free(parent, key, `${viewport} Drawer / Open`, width, 456);
  overlay.fills = [];
  overlay.setSharedPluginData(NS, "state", "MobileDrawer Open");
  overlay.setSharedPluginData(NS, "prototype_destination", "drawer-open");
  overlay.setSharedPluginData(NS, "allow_overlap", "true");
  const drawer = a01CreateInstance(
    dependencies.home["navigation-mobile-drawer"],
    { Viewport: viewport, State: "Open" },
    `${key}/instance`
  );
  overlay.appendChild(drawer);
  drawer.x = 0;
  drawer.y = 0;
  const close = tag(figma.createFrame(), `${key}/close-hotspot`, "P4");
  close.name = "Close Drawer Hotspot";
  close.resize(44, 44);
  close.x = width - 64;
  close.y = 20;
  close.fills = [solidPaint("rgba(0,0,0,0.001)")];
  close.strokes = [];
  close.setSharedPluginData(NS, "interaction_role", "close-mobile-drawer");
  overlay.appendChild(close);
  await close.setReactionsAsync([a01CloseReaction()]);
  return overlay;
}

async function a01SpecimenCard(parent, key, title, context, options = {}) {
  const card = tag(
    createAutoFrame(title, "VERTICAL", options.width || 320, options.gap || 10),
    key,
    "P4"
  );
  card.paddingTop = 16;
  card.paddingRight = 16;
  card.paddingBottom = 16;
  card.paddingLeft = 16;
  card.fills = [bindColor(context.panel, "rgba(15,19,34,0.76)")];
  card.strokes = [bindColor(context.line, "rgba(221,228,255,0.16)")];
  card.strokeWeight = 1;
  setRadius(card, 18, context.radius);
  card.setSharedPluginData(NS, "state_status", options.status || "implemented-current-code");
  parent.appendChild(card);
  await a01Text(card, `${key}/title`, title, context, {
    size: 14,
    font: context.fonts.bold
  });
  if (options.meta) {
    await a01Text(card, `${key}/meta`, options.meta, context, {
      size: 11,
      width: (options.width || 320) - 32,
      color: context.muted
    });
  }
  return card;
}

async function a01AppendStateMatrix(root, context, dependencies, key) {
  const section = tag(createAutoFrame("A01 / Interaction & States", "VERTICAL", 2646, 18), key, "P4");
  section.paddingTop = 28;
  section.paddingRight = 28;
  section.paddingBottom = 32;
  section.paddingLeft = 28;
  section.fills = [solidPaint("rgba(255,255,255,0.018)")];
  section.strokes = [solidPaint("rgba(222,228,255,0.10)")];
  section.strokeWeight = 1;
  setRadius(section, 24, null);
  section.setSharedPluginData(NS, "module", "state-matrix");
  root.appendChild(section);
  await a01Text(section, `${key}/title`, "A01 · Interaction & States", context, {
    size: 28,
    font: context.fonts.bold
  });
  await a01Text(
    section,
    `${key}/meta`,
    "Source-backed visual states use live component instances. Loading, error and permission are explicitly recorded as absent from the current home implementation.",
    context,
    { size: 12, width: 2590, color: context.muted }
  );

  const row = a01Fixed(
    section,
    `${key}/implemented`,
    "Implemented State Specimens",
    "HORIZONTAL",
    2590,
    470,
    14,
    context
  );
  row.primaryAxisAlignItems = "MIN";
  row.counterAxisAlignItems = "MIN";
  row.layoutWrap = "WRAP";
  row.fills = [];
  const specimens = [
    ["Carousel · Playing / Paused", "home-carousel-control", { State: "Playing" }, 160],
    ["Rank Item · Default / Hover", "home-rank-item", { Viewport: "Tablet", State: "Hover" }, 270],
    ["Genre Chip · Default / Hover", "home-genre-chip", { Viewport: "Mobile", Channel: "Featured", State: "Hover" }, 220],
    ["Shelf Tab · Active", "home-shelf-tab", { Kind: "Recommended", State: "Active" }, 180],
    ["Shelf Card · Hover", "home-shelf-card", { Viewport: "Mobile", State: "Hover" }, 220],
    ["Continue · Ready / Hover", "home-continue-card", { Viewport: "Mobile", State: "Hover" }, 340]
  ];
  for (const [index, specimen] of specimens.entries()) {
    const card = await a01SpecimenCard(
      row,
      `${key}/implemented/${index}`,
      specimen[0],
      context,
      { width: specimen[3] }
    );
    const instance = a01CreateInstance(dependencies.home[specimen[1]], specimen[2], `${key}/implemented/${index}/instance`);
    instance.setSharedPluginData(NS, "interaction_role", "state-specimen");
    card.appendChild(instance);
  }

  const states = a01Fixed(
    section,
    `${key}/explicit`,
    "Explicit Page States",
    "HORIZONTAL",
    2590,
    230,
    14,
    context
  );
  states.primaryAxisAlignItems = "MIN";
  states.counterAxisAlignItems = "MIN";
  states.fills = [];

  const hidden = await a01SpecimenCard(states, `${key}/continue-hidden`, "Continue · Hidden", context, {
    width: 290,
    meta: "No local or API history: the entire section remains hidden.",
    status: "implemented-current-code"
  });
  const hiddenMark = a01Fixed(hidden, `${key}/continue-hidden/visual`, "Hidden Section", "HORIZONTAL", 258, 72, 0, context);
  hiddenMark.fills = [solidPaint("rgba(255,255,255,0.025)")];
  hiddenMark.strokes = [solidPaint("rgba(222,228,255,0.18)")];
  hiddenMark.strokeWeight = 1;
  hiddenMark.dashPattern = [6, 4];
  setRadius(hiddenMark, 14, null);
  await a01Text(hiddenMark, `${key}/continue-hidden/visual/label`, "继续观看", context, {
    size: 13,
    color: context.muted,
    font: context.fonts.bold
  });

  const empty = await a01SpecimenCard(states, `${key}/latest-empty`, "Latest · Empty", context, {
    width: 350,
    meta: "Current template empty state.",
    status: "implemented-current-code"
  });
  const emptyVisual = a01Fixed(empty, `${key}/latest-empty/visual`, "Latest Empty State", "VERTICAL", 318, 124, 5, context);
  emptyVisual.fills = [solidPaint("rgba(255,255,255,0.025)")];
  emptyVisual.strokes = [solidPaint("rgba(222,228,255,0.18)")];
  emptyVisual.strokeWeight = 1;
  emptyVisual.dashPattern = [6, 4];
  setRadius(emptyVisual, 18, null);
  await a01Text(emptyVisual, `${key}/latest-empty/title`, "本年度暂无新上线内容", context, {
    size: 14,
    font: context.fonts.bold
  });
  await a01Text(emptyVisual, `${key}/latest-empty/body`, "有新影片上线后会显示在这里。", context, {
    size: 12,
    color: context.muted
  });
  await a01Text(emptyVisual, `${key}/latest-empty/action`, "浏览全部影片", context, {
    size: 12,
    color: context.accent2,
    font: context.fonts.bold
  });

  const reduced = await a01SpecimenCard(states, `${key}/reduced-motion`, "Reduced Motion", context, {
    width: 320,
    meta: "Autoplay disabled; transitions resolve without motion.",
    status: "implemented-current-code"
  });
  const paused = a01CreateInstance(
    dependencies.home["home-carousel-control"],
    { State: "Paused" },
    `${key}/reduced-motion/control`
  );
  reduced.appendChild(paused);

  const missing = await a01SpecimenCard(states, `${key}/image-missing`, "Media · Placeholder", context, {
    width: 300,
    meta: "All formal A01 media is editable placeholder content.",
    status: "implemented-current-code"
  });
  const media = await a01MediaInstance(
    dependencies.componentPage,
    "Thumbnail",
    "Default",
    `${key}/image-missing/media`,
    208,
    118
  );
  missing.appendChild(media);

  const notImplemented = await a01SpecimenCard(
    states,
    `${key}/not-implemented`,
    "Page Loading / Error / Permission",
    context,
    {
      width: 420,
      meta: "Not implemented in current code. No invented visual state is included.",
      status: "not-implemented-current-code"
    }
  );
  notImplemented.strokes = [solidPaint("rgba(243,201,125,0.34)")];
  return section;
}

async function a01AppendDeveloperReference(root, context, key) {
  const reference = tag(createAutoFrame("A01 / Developer Reference", "VERTICAL", 2646, 12), key, "P4");
  reference.paddingTop = 28;
  reference.paddingRight = 28;
  reference.paddingBottom = 32;
  reference.paddingLeft = 28;
  reference.fills = [bindColor(context.panel, "rgba(15,19,34,0.76)")];
  reference.strokes = [bindColor(context.line, "rgba(221,228,255,0.16)")];
  reference.strokeWeight = 1;
  setRadius(reference, 24, null);
  reference.setSharedPluginData(NS, "module", "developer-reference");
  root.appendChild(reference);
  await a01Text(reference, `${key}/title`, "A01 · Developer Reference", context, {
    size: 28,
    font: context.fonts.bold
  });
  const columns = a01Fixed(reference, `${key}/columns`, "Developer Notes", "HORIZONTAL", 2590, 248, 18, context);
  columns.primaryAxisAlignItems = "MIN";
  columns.counterAxisAlignItems = "MIN";
  const notes = [
    [
      "Route & Source",
      "Route: /\nTemplate: template/pingfangvideo/html/index/index.html\nStyles: template/pingfangvideo/css/style.css\nBehavior: template/pingfangvideo/js/app.js"
    ],
    [
      "Responsive",
      "1440: 1384 wrap · 6/5/4 column families\n768: 728 wrap · hidden desktop nav · 3/2 columns\n390: 362 wrap · horizontal rails · 2-column latest"
    ],
    [
      "Interaction",
      "Hero autoplay 5200ms · pause and dots\nHover: rank -2px · genre -3px · shelf -6px\nMobile drawer opens as overlay; reduced motion disables autoplay"
    ],
    [
      "Content Policy",
      "Media: Media/Placeholder instances only\nDynamic video copy: exact 测试文本\nStructural product copy remains source-backed\nCode Connect: excluded from this round"
    ]
  ];
  for (const [index, note] of notes.entries()) {
    const card = await a01SpecimenCard(columns, `${key}/columns/${index}`, note[0], context, {
      width: 634,
      meta: note[1],
      status: "developer-reference"
    });
    card.resize(634, 210);
    card.primaryAxisSizingMode = "FIXED";
  }
  return reference;
}

async function a01ConnectDrawerInteractions(viewportScreens, overlays) {
  for (const width of [768, 390]) {
    const screen = viewportScreens.get(width);
    const menu = screen.findOne(
      (node) => node.type === "INSTANCE" && node.getSharedPluginData(NS, "interaction_role") === "open-mobile-drawer"
    );
    const overlay = overlays.get(width);
    if (!menu || !overlay) throw new Error(`A01 drawer interaction missing for ${width}.`);
    await menu.setReactionsAsync([a01OverlayReaction(overlay.id)]);
  }
}

async function buildA01Prototype(archetype) {
  const rawPage = figma.root.children.find((page) => page.name === RAW_EVIDENCE_PAGE_NAME);
  if (!rawPage) throw new Error("Protected Raw Evidence page missing.");
  await rawPage.loadAsync();
  const rawBefore = protectedPageSignature(rawPage);
  const dependencies = await a01EnsureComponentDependencies();
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
  root.setSharedPluginData(NS, "prototype_revision", A01_PROTOTYPE_REVISION);
  root.setSharedPluginData(NS, "source_commit", PLAN.source.commit);
  await addOwnedText(root, `${key}/title`, "A01 · Home · Liquid Cinema", context, {
    font: context.fonts.bold,
    size: 40,
    width: 2662,
    phase: "P4"
  });
  await addOwnedText(
    root,
    `${key}/meta`,
    [
      "Route: / · default theme full-coverage prototype",
      "Source-composed from current template, CSS and interaction code",
      "Media uses editable placeholders; dynamic video data uses one exact test-text token",
      `Source: ${PLAN.source.branch}@${PLAN.source.commit}`
    ].join("\n"),
    context,
    { color: context.muted, fallback: "#9da6bd", size: 12, width: 2662, phase: "P4" }
  );

  const responsive = tag(createAutoFrame("A01 / Responsive Screens", "HORIZONTAL", 2646, 24), `${key}/viewports`, "P4");
  responsive.counterAxisAlignItems = "MIN";
  responsive.setSharedPluginData(NS, "module", "responsive-screens");
  root.appendChild(responsive);
  const viewportScreens = new Map();
  for (const width of RAW_EVIDENCE_VIEWPORTS) {
    const screen = await a01CreateViewport(width, context, dependencies, `${key}/viewport/${width}`);
    responsive.appendChild(screen);
    viewportScreens.set(width, screen);
  }

  await a01AppendStateMatrix(root, context, dependencies, `${key}/states`);
  for (const width of [768, 390]) {
    const existingOverlay = page.children.find(
      (node) => entityKey(node) === `${key}/overlay/${width}`
    );
    if (existingOverlay) existingOverlay.remove();
  }
  const overlays = new Map();
  for (const width of [768, 390]) {
    const viewport = a01ViewportName(width);
    const overlay = await a01CreateDrawerOverlay(
      page,
      viewport,
      context,
      dependencies,
      `${key}/overlay/${width}`
    );
    placeAwayFromExisting(page, overlay);
    overlays.set(width, overlay);
  }
  await a01ConnectDrawerInteractions(viewportScreens, overlays);
  await a01AppendDeveloperReference(root, context, `${key}/developer-reference`);

  const rawAfter = protectedPageSignature(rawPage);
  if (rawAfter.signature !== rawBefore.signature || rawAfter.topLevelCount !== rawBefore.topLevelCount) {
    throw new Error(`Protected Raw Evidence changed while building A01: ${rawBefore.signature} → ${rawAfter.signature}`);
  }
  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
  figma.commitUndo();
  return [
    "A01 FORMAL PROTOTYPE · APPLIED",
    `page=${page.name} · ${page.id}`,
    `root=${root.id}`,
    `revision=${A01_PROTOTYPE_REVISION}`,
    "responsive=Desktop 1440 · Tablet 768 · Mobile 390",
    `componentFamilies=${A01_COMPONENT_SPECS.length + 4}`,
    "sourceKind=code-composed",
    `rawEvidence=${rawAfter.signature} · unchanged`
  ].join("\n");
}

async function a01Reactions(node) {
  if ("getReactionsAsync" in node) return node.getReactionsAsync();
  return Array.isArray(node.reactions) ? node.reactions : [];
}

async function a01MainComponent(instance) {
  if ("getMainComponentAsync" in instance) return instance.getMainComponentAsync();
  return instance.mainComponent || null;
}

async function a01InstanceSetName(instance) {
  const main = await a01MainComponent(instance);
  return main && main.parent && main.parent.type === "COMPONENT_SET" ? main.parent.name : "";
}

async function a01EffectiveReactionCount(instance) {
  const own = await a01Reactions(instance);
  if (own.length) return own.length;
  const main = await a01MainComponent(instance);
  return main ? (await a01Reactions(main)).length : 0;
}

function a01RecursiveVisualSignature(node) {
  const signature = {
    type: node.type,
    name: node.name,
    width: Math.round((node.width || 0) * 10) / 10,
    height: Math.round((node.height || 0) * 10) / 10,
    opacity: "opacity" in node ? node.opacity : 1,
    fills: "fills" in node && Array.isArray(node.fills) ? node.fills : [],
    strokes: "strokes" in node && Array.isArray(node.strokes) ? node.strokes : [],
    effects: "effects" in node ? node.effects : [],
    characters: node.type === "TEXT" ? node.characters : "",
    children: "children" in node ? node.children.map(a01RecursiveVisualSignature) : []
  };
  return JSON.stringify(signature);
}

async function collectA01ComponentIssues(componentPage) {
  const issues = [];
  const expectedReactionCounts = {
    "home-rank-item": 3,
    "home-genre-chip": 9,
    "home-continue-card": 3,
    "home-shelf-card": 3,
    "home-shelf-tab": 6,
    "home-carousel-control": 2,
    "navigation-menu-toggle": 3,
    "navigation-mobile-drawer": 0
  };
  for (const spec of A01_COMPONENT_SPECS) {
    const key = a01ComponentKey(spec);
    const set = a01ComponentSetByKey(componentPage, `${key}/set`);
    if (!set) {
      issues.push(`component ${spec.name} missing`);
      continue;
    }
    if (set.getSharedPluginData(NS, "component_revision") !== A01_COMPONENT_REVISION) {
      issues.push(`component ${spec.name} revision mismatch`);
    }
    const combinations = v2VariantCombinations(spec.dimensions);
    const expectedNames = combinations.map(v2VariantName).sort();
    const variants = set.children.filter((node) => node.type === "COMPONENT");
    const actualNames = variants.map((node) => node.name).sort();
    if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
      issues.push(`component ${spec.name} variants mismatch ${actualNames.length}/${expectedNames.length}`);
    }
    let reactionCount = 0;
    for (const variant of variants) {
      if (variant.layoutMode === "NONE") issues.push(`component ${spec.name}/${variant.name} is not Auto Layout`);
      reactionCount += (await a01Reactions(variant)).length;
    }
    if (reactionCount !== expectedReactionCounts[spec.id]) {
      issues.push(`component ${spec.name} reactions=${reactionCount}/${expectedReactionCounts[spec.id]}`);
    }
    for (let leftIndex = 0; leftIndex < variants.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < variants.length; rightIndex += 1) {
        const left = variants[leftIndex].absoluteBoundingBox;
        const right = variants[rightIndex].absoluteBoundingBox;
        if (left && right && boxesOverlap(left, right)) {
          issues.push(`component ${spec.name} variants overlap`);
          leftIndex = variants.length;
          break;
        }
      }
    }
    if (spec.dimensions.State && spec.dimensions.State.includes("Hover")) {
      const defaults = variants.filter((variant) => a01CombinationValue(variant, "State") === "Default");
      for (const defaultVariant of defaults) {
        const hover = variants.find(
          (candidate) =>
            a01CombinationValue(candidate, "State") === "Hover" &&
            Object.keys(spec.dimensions)
              .filter((property) => property !== "State")
              .every(
                (property) =>
                  a01CombinationValue(candidate, property) === a01CombinationValue(defaultVariant, property)
              )
        );
        if (hover && a01RecursiveVisualSignature(defaultVariant) === a01RecursiveVisualSignature(hover)) {
          issues.push(`component ${spec.name}/${defaultVariant.name} hover is visually identical`);
        }
      }
    }
  }
  return issues;
}

function a01DirectChildrenOverlap(parent) {
  const children = parent.children.filter((node) => node.visible !== false);
  for (let leftIndex = 0; leftIndex < children.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < children.length; rightIndex += 1) {
      const left = children[leftIndex].absoluteBoundingBox;
      const right = children[rightIndex].absoluteBoundingBox;
      if (left && right && boxesOverlap(left, right)) return true;
    }
  }
  return false;
}

async function collectA01PrototypeIssues(archetype, page, root) {
  const issues = [];
  if (!root) return ["prototype root missing"];
  if (root.getSharedPluginData(NS, "source_kind") !== "code-composed") {
    issues.push("prototype root source_kind must be code-composed");
  }
  if (root.getSharedPluginData(NS, "prototype_revision") !== A01_PROTOTYPE_REVISION) {
    issues.push("prototype root revision mismatch");
  }
  if (root.clipsContent) issues.push("prototype root clips content");
  const componentPage = figma.root.children.find((item) => item.name === "02 · Components");
  if (!componentPage) {
    issues.push("components page missing");
  } else {
    await componentPage.loadAsync();
    issues.push(...(await collectA01ComponentIssues(componentPage)));
  }

  for (const width of RAW_EVIDENCE_VIEWPORTS) {
    const key = `v2/prototype/${archetype.id}/viewport/${width}`;
    const frame = root.findOne((node) => entityKey(node) === key);
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
    if (frame.getSharedPluginData(NS, "prototype_revision") !== A01_PROTOTYPE_REVISION) {
      issues.push(`viewport ${width} revision mismatch`);
    }
    if (frame.getSharedPluginData(NS, "raw_source_node_id")) {
      issues.push(`viewport ${width} retains raw source linkage`);
    }
    const moduleKeys = ["header", "hero", "rank", "genre", "continue", "latest", "footer"];
    for (const moduleName of moduleKeys) {
      const module = frame.findOne((node) => entityKey(node) === `${key}/${moduleName}`);
      if (!module) issues.push(`viewport ${width} module ${moduleName} missing`);
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
    const dynamicTexts = nodes.filter(
      (node) => node.type === "TEXT" && node.getSharedPluginData(NS, "text_policy") === "测试文本"
    );
    const invalidDynamic = dynamicTexts.filter((node) => node.characters !== "测试文本");
    if (invalidDynamic.length) issues.push(`viewport ${width} has ${invalidDynamic.length} invalid dynamic texts`);
    const repeatedDynamic = nodes.filter(
      (node) => node.type === "TEXT" && /测试文本.*测试文本/.test(String(node.characters || ""))
    );
    if (repeatedDynamic.length) issues.push(`viewport ${width} has ${repeatedDynamic.length} repeated test-text nodes`);

    const instances = frame.findAllWithCriteria({ types: ["INSTANCE"] });
    const setNames = new Set();
    for (const instance of instances) {
      const setName = await a01InstanceSetName(instance);
      if (setName) setNames.add(setName);
    }
    const requiredSets = [
      "Media/Placeholder",
      "Action/StandardButton",
      "Home/RankItem",
      "Home/GenreChip",
      "Home/ContinueCard",
      "Home/ShelfCard",
      "Home/ShelfTab",
      "Home/CarouselControl"
    ];
    if (width === 1440) requiredSets.push("Navigation/NavItem", "Form/HeaderSearch");
    else requiredSets.push("Navigation/MenuToggle");
    for (const required of requiredSets) {
      if (!setNames.has(required)) issues.push(`viewport ${width} missing instance family ${required}`);
    }

    const mediaInstances = [];
    for (const instance of instances) {
      if ((await a01InstanceSetName(instance)) === "Media/Placeholder") mediaInstances.push(instance);
    }
    const minimumMedia = width === 390 ? 15 : 16;
    if (mediaInstances.length < minimumMedia) {
      issues.push(`viewport ${width} media instances=${mediaInstances.length}/${minimumMedia}+`);
    }

    const interactionRoles = [
      "carousel-autoplay",
      "play-cta",
      "detail-cta",
      "rank-item",
      "genre-link",
      "continue-link",
      "shelf-tab",
      "shelf-card"
    ];
    for (const role of interactionRoles) {
      const roleInstances = instances.filter(
        (node) => node.getSharedPluginData(NS, "interaction_role") === role
      );
      if (!roleInstances.length) {
        issues.push(`viewport ${width} interaction ${role} missing`);
        continue;
      }
      let hasReaction = false;
      for (const instance of roleInstances) {
        if ((await a01EffectiveReactionCount(instance)) > 0) {
          hasReaction = true;
          break;
        }
      }
      if (!hasReaction) {
        issues.push(`viewport ${width} interaction ${role} has no reaction`);
      }
    }
    if (width !== 1440) {
      const menu = instances.find(
        (node) => node.getSharedPluginData(NS, "interaction_role") === "open-mobile-drawer"
      );
      if (!menu || (await a01Reactions(menu)).length === 0) {
        issues.push(`viewport ${width} mobile drawer trigger missing`);
      }
    }
  }

  for (const width of [768, 390]) {
    const overlay = page.children.find(
      (node) => entityKey(node) === `v2/prototype/${archetype.id}/overlay/${width}`
    );
    if (!overlay) {
      issues.push(`drawer overlay ${width} missing`);
      continue;
    }
    const drawer = overlay.findOne((node) => node.type === "INSTANCE");
    if (!drawer || (await a01InstanceSetName(drawer)) !== "Navigation/MobileDrawer") {
      issues.push(`drawer overlay ${width} does not use Navigation/MobileDrawer`);
    }
    const close = overlay.findOne(
      (node) => node.getSharedPluginData(NS, "interaction_role") === "close-mobile-drawer"
    );
    if (!close || (await a01Reactions(close)).length === 0) issues.push(`drawer overlay ${width} close action missing`);
  }

  const states = root.findOne(
    (node) => entityKey(node) === `v2/prototype/${archetype.id}/states`
  );
  if (!states) {
    issues.push("state matrix missing");
  } else {
    const stateInstances = states.findAllWithCriteria({ types: ["INSTANCE"] });
    if (stateInstances.length < 7) issues.push(`state matrix instances=${stateInstances.length}/7+`);
    const notImplemented = states.findOne(
      (node) => node.getSharedPluginData(NS, "state_status") === "not-implemented-current-code"
    );
    if (!notImplemented) issues.push("not-implemented current-code state card missing");
  }

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
      issues.push(`Raw Evidence signature=${signature.signature}/${PLAN.rawEvidenceProtection.expectedSignature}`);
    }
  }
  return issues;
}

async function validateA01Prototype(archetype) {
  const page = figma.root.children.find((item) => item.name === archetype.figmaPage);
  if (!page) return `A01 PROTOTYPE VALIDATION · PENDING\nmissing page=${archetype.figmaPage}`;
  await page.loadAsync();
  const root = page.children.find((node) => entityKey(node) === `v2/prototype/${archetype.id}`);
  const issues = await collectA01PrototypeIssues(archetype, page, root);
  return [
    `A01 PROTOTYPE VALIDATION · ${issues.length ? "FAIL" : "PASS"}`,
    `revision=${A01_PROTOTYPE_REVISION}`,
    `issues=${issues.length}`,
    ...(issues.length ? issues.map((issue) => `- ${issue}`) : ["- none"])
  ].join("\n");
}
