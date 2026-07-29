const PLAN = __BASELINE_PLAN__;
const ASSET_PAYLOAD = __ASSET_PAYLOAD__;
const NS = "squaredmedia_product_baseline";
const RUN_ID = PLAN.baselineId;
const APPROVAL_PHRASE = "APPLY 303e3b5";
const SOURCE_REFERENCE = PLAN.source.snapshot || `${PLAN.source.branch}@${PLAN.source.commit}`;
const DEFAULT_COLLECTION = "Semantic · Liquid Cinema";
const PRIMITIVE_COLLECTION = "Primitives · Theme Surfaces";
const RAW_EVIDENCE_PAGE_NAME = "92 · Raw Evidence · html.to.design · 2026-07-28";
const RAW_EVIDENCE_PAGE_ALIASES = [
  "网页布局截图_html_to_design",
  "90 - html.to.design Raw Import - 2026-07-28",
  "90 · html.to.design Raw Import · 2026-07-28"
];
const RAW_EVIDENCE_VIEWPORTS = [1440, 768, 390];
let rawEvidenceAuditCursor = 0;
const DOC_PAGE_NAMES = [
  "00 · Baseline Guide",
  "00 · Code Map · MacCMS Current",
  "01 · Foundations",
  "02 · Components",
  "03 · Assets & Symbols",
  "04 · Responsive Rules",
  "05 · Interaction & States",
  "06 · Developer Reference",
  "90 · Issues / Recorded Only"
];
const COVERAGE_PAGE_NAMES = [
  "10 · Home",
  "11 · Catalog & Search",
  "12 · Content Detail",
  "13 · Player",
  "14 · Account",
  "15 · Access & Feedback",
  "16 · Games",
  "17 · Content Modules",
  "18 · System & Restrictions"
];
const MAINTAINED_TEXT_STYLE_PREFIXES = PLAN.formalPrototype.maintainedTextStylePrefixes;
const MAINTAINED_EFFECT_STYLE_PREFIXES = PLAN.formalPrototype.maintainedEffectStylePrefixes;

figma.showUI(
  `<style>
    :root {
      color-scheme: dark;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; background: #05070d; color: #f4f6ff; }
    h1 { margin: 0 0 6px; font-size: 17px; }
    p { margin: 0 0 12px; color: #9da6bd; font-size: 12px; line-height: 1.5; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .group {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(221,228,255,.12);
    }
    .group strong { display: block; margin-bottom: 7px; font-size: 12px; }
    button, input, select {
      width: 100%;
      border: 1px solid rgba(221,228,255,.16);
      border-radius: 8px;
      font: inherit;
    }
    button {
      padding: 10px 12px;
      background: rgba(23,28,48,.82);
      color: #f4f6ff;
      font-weight: 700;
      cursor: pointer;
    }
    button:hover { border-color: rgba(110,231,249,.54); }
    button:disabled { cursor: not-allowed; opacity: .42; }
    .primary { background: #8b7cff; color: #05070d; }
    .danger { grid-column: 1 / -1; background: rgba(139,124,255,.14); }
    label { display: block; margin-top: 8px; color: #9da6bd; font-size: 11px; }
    input, select {
      margin-top: 6px;
      padding: 9px 10px;
      background: rgba(15,19,34,.76);
      color: #f4f6ff;
    }
    pre {
      margin: 14px 0 0;
      padding: 12px;
      width: 100%;
      height: 220px;
      overflow: auto;
      white-space: pre-wrap;
      border: 1px solid rgba(221,228,255,.16);
      border-radius: 8px;
      background: #020514;
      color: #cbd5e1;
      font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    }
  </style>
  <h1>Squared Media Product Baseline</h1>
  <p>Source: ${SOURCE_REFERENCE} · Audit, previews, and validations are read-only. Apply actions mutate only their selected stage.</p>
  <div class="grid">
    <button data-action="audit">Audit</button>
    <button data-action="audit-raw-evidence">Audit Raw Evidence</button>
    <button data-action="audit-formal-readiness">Audit formal readiness</button>
    <button data-action="audit-components-layout">Audit component layout</button>
    <button class="primary requires-approval" data-action="apply-components-layout-fix" disabled>Fix component layout</button>
    <button class="requires-approval" data-action="apply-archive-legacy-components" disabled>Archive historical component catalog</button>
    <button data-action="preview">Preview plan</button>
    <button data-action="final-qa">Final QA</button>
    <button data-action="focus">Focus Themes page</button>
  </div>
  <label>
    Approval phrase
    <input id="approval" autocomplete="off" spellcheck="false" placeholder="${APPROVAL_PHRASE}">
  </label>
  <div class="group">
    <strong>P1 · Foundations and themes</strong>
    <div class="grid">
      <button data-action="validate-p1">Validate P1</button>
      <button class="primary requires-approval" data-action="apply-p1" disabled>Apply P1 · Themes</button>
    </div>
  </div>
  <div class="group">
    <strong>P2 · Structure and documentation</strong>
    <label>One page operation
      <select id="page-operation">${PLAN.pages.map((item) => `<option value="${item.name}">${item.name} · ${item.operation}</option>`).join("")}</select>
    </label>
    <div class="grid">
      <button class="requires-approval" data-action="apply-page" disabled>Apply selected structure</button>
      <button data-action="validate-p2">Validate P2</button>
    </div>
    <button class="primary requires-approval" data-action="apply-next-page" disabled>Apply next pending structure</button>
    <label>One documentation page
      <select id="doc-page">${DOC_PAGE_NAMES.map((name) => `<option value="${name}">${name}</option>`).join("")}</select>
    </label>
    <button class="primary requires-approval" data-action="apply-doc" disabled>Apply selected documentation</button>
    <button class="primary requires-approval" data-action="apply-next-doc" disabled>Apply next pending documentation</button>
  </div>
  <div class="group">
    <strong>P3 · Missing component families</strong>
    <label>Build exactly one family
      <select id="component-build">${PLAN.componentBuilds.map((item) => `<option value="${item.id}">${item.name} · ${item.variantCount} variants</option>`).join("")}</select>
    </label>
    <div class="grid">
      <button class="primary requires-approval" data-action="apply-component" disabled>Build selected family</button>
      <button data-action="validate-component">Validate selected family</button>
    </div>
    <button class="primary requires-approval" data-action="apply-next-component" disabled>Build next pending family</button>
    <label>V2 source-backed component
      <select id="v2-component">${[
        ["media-placeholder", "Media/Placeholder"],
        ["navigation-nav-item", "Navigation/NavItem"],
        ["content-category-tile", "Content/CategoryTile"],
        ["selection-filter-option", "Selection/FilterOption"],
        ["playback-episode-item", "Playback/EpisodeItem"],
        ["account-device-card", "Account/DeviceCard"],
        ["games-game-card", "Games/GameCard"],
        ["system-system-box", "System/SystemBox"],
        ["form-password-toggle", "Form/PasswordToggle"],
        ["games-blockrain-control", "Games/BlockrainControl"]
      ]
        .map(([id, name]) => `<option value="${id}">${name}</option>`)
        .join("")}</select>
    </label>
    <div class="grid">
      <button class="primary requires-approval" data-action="apply-v2-component" disabled>Build / update V2 component</button>
      <button data-action="validate-v2-component">Validate V2 component</button>
    </div>
    <div class="grid">
      <button class="primary requires-approval" data-action="apply-next-v2-component" disabled>Build next V2 component</button>
      <button data-action="validate-all-v2-components">Validate all V2 components</button>
    </div>
    <button data-action="focus-all-v2-components">Focus all V2 components</button>
  </div>
  <div class="group">
    <strong>P4 · Page-family coverage</strong>
    <label>One page family
      <select id="coverage-page">${COVERAGE_PAGE_NAMES.map((name) => `<option value="${name}">${name}</option>`).join("")}</select>
    </label>
    <div class="grid">
      <button class="primary requires-approval" data-action="apply-coverage" disabled>Apply coverage index</button>
      <button data-action="validate-coverage">Validate coverage</button>
    </div>
    <button class="primary requires-approval" data-action="apply-next-coverage" disabled>Apply next pending coverage</button>
    <label>Default-theme archetype
      <select id="v2-archetype">${PLAN.archetypes
        .map((item) => `<option value="${item.id}">${item.id} · ${item.name} · ${item.figmaPage}</option>`)
        .join("")}</select>
    </label>
    <label>Archetype ID quick focus
      <input id="v2-archetype-jump" type="text" placeholder="A07" />
    </label>
    <div class="grid">
      <button class="primary requires-approval" data-action="apply-v2-archetype" disabled>Apply selected prototype</button>
      <button data-action="validate-v2-archetype">Validate selected prototype</button>
    </div>
    <button data-action="focus-v2-archetype">Focus selected prototype · Desktop</button>
    <button class="primary requires-approval" data-action="apply-next-v2-archetype" disabled>Apply next pending prototype</button>
    <button data-action="validate-all-v2-prototypes">Validate all V2 prototypes</button>
  </div>
  <div class="group">
    <strong>P5 · Formal project prototype</strong>
    <div class="grid">
      <button class="requires-approval" data-action="apply-p5-overview" disabled>Build Project Overview</button>
      <button class="requires-approval" data-action="apply-p5-component-index" disabled>Build Component Index</button>
      <button class="requires-approval" data-action="apply-p5-player-evidence" disabled>Integrate Player Evidence</button>
      <button class="requires-approval" data-action="apply-p5-user-flows" disabled>Build User Flows</button>
      <button class="requires-approval" data-action="apply-p5-page-order" disabled>Apply Formal Page Order</button>
      <button data-action="validate-p5">Validate P5</button>
    </div>
  </div>
  <pre id="status" aria-label="Plugin status">Ready. No Figma changes have been made.</pre>
  <script>
    const buttons = Array.from(document.querySelectorAll("button[data-action]"));
    const guarded = buttons.filter((button) => button.classList.contains("requires-approval"));
    const approval = document.getElementById("approval");
    const approvalMatches = () => approval.value.trim() === "${APPROVAL_PHRASE}";
    const updateGuarded = () => guarded.forEach((button) => { button.disabled = !approvalMatches(); });
    approval.addEventListener("input", updateGuarded);
    for (const button of buttons) {
      button.addEventListener("click", () => {
        const action = button.dataset.action;
        if (button.classList.contains("requires-approval") && !approvalMatches()) return;
        buttons.forEach((item) => { item.disabled = true; });
        document.getElementById("status").textContent = "Running " + action + "…";
        parent.postMessage({
          pluginMessage: {
            action,
            approval: approval.value.trim(),
            pageName: document.getElementById("page-operation").value,
            docPageName: document.getElementById("doc-page").value,
            componentId: document.getElementById("component-build").value,
            coveragePageName: document.getElementById("coverage-page").value,
            v2ComponentId: document.getElementById("v2-component").value,
            archetypeId: document.getElementById("v2-archetype-jump").value.trim()
              || document.getElementById("v2-archetype").value
          }
        }, "*");
      });
    }
    onmessage = (event) => {
      const message = event.data.pluginMessage;
      if (!message || message.type !== "result") return;
      document.getElementById("status").textContent = message.text;
      buttons.forEach((item) => {
        item.disabled = item.classList.contains("requires-approval") ? !approvalMatches() : false;
      });
    };
  </script>`,
  { width: 560, height: 900, themeColors: true }
);

function errorText(error) {
  const message = String(error && error.message ? error.message : error);
  const stack = String(error && error.stack ? error.stack : "");
  return stack.includes(message) ? stack : `${message}\n${stack}`;
}

function tag(entity, key, phase = "P1") {
  entity.setSharedPluginData(NS, "run_id", RUN_ID);
  entity.setSharedPluginData(NS, "key", key);
  entity.setSharedPluginData(NS, "phase", phase);
  return entity;
}

function entityKey(entity) {
  return entity.getSharedPluginData(NS, "key");
}

function isOwned(entity, key) {
  return entity.getSharedPluginData(NS, "run_id") === RUN_ID && (!key || entityKey(entity) === key);
}

function isRawEvidencePage(page) {
  return Boolean(page && [RAW_EVIDENCE_PAGE_NAME, ...RAW_EVIDENCE_PAGE_ALIASES].includes(page.name));
}

function assertMutableTargetPage(page) {
  if (!page || page.type !== "PAGE") {
    throw new Error("A mutable Figma page target is required.");
  }
  if (isRawEvidencePage(page)) {
    throw new Error(`Protected Raw Evidence is read-only: ${page.name} · ${page.id}`);
  }
  return page;
}

function parseColor(value) {
  if (typeof value !== "string") {
    throw new Error(`Expected color string, got ${String(value)}`);
  }
  const text = value.trim().toLowerCase();
  if (text.startsWith("#")) {
    const hex = text.slice(1);
    if (hex.length !== 6 && hex.length !== 8) {
      throw new Error(`Unsupported hex color: ${value}`);
    }
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
      ...(hex.length === 8 ? { a: parseInt(hex.slice(6, 8), 16) / 255 } : {})
    };
  }
  const match = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
  if (!match) throw new Error(`Unsupported color: ${value}`);
  return {
    r: Number(match[1]) / 255,
    g: Number(match[2]) / 255,
    b: Number(match[3]) / 255,
    ...(match[4] === undefined ? {} : { a: Number(match[4]) })
  };
}

function solidPaint(value) {
  const color = parseColor(value);
  const opacity = color.a === undefined ? 1 : color.a;
  return {
    type: "SOLID",
    color: { r: color.r, g: color.g, b: color.b },
    opacity
  };
}

function variableType(token) {
  return typeof token.value === "number" ? "FLOAT" : "COLOR";
}

function variableValue(token) {
  return variableType(token) === "FLOAT" ? token.value : parseColor(token.value);
}

function resolvedValue(resources, variable, seen = new Set()) {
  if (seen.has(variable.id)) {
    throw new Error(`Variable alias cycle: ${variable.name}`);
  }
  seen.add(variable.id);
  const collection = resources.collections.find((item) => item.id === variable.variableCollectionId);
  const modeId = collection && collection.modes[0].modeId;
  const value = (modeId && variable.valuesByMode[modeId]) || Object.values(variable.valuesByMode)[0];
  if (value && typeof value === "object" && value.type === "VARIABLE_ALIAS") {
    const target = resources.variables.find((item) => item.id === value.id);
    if (!target) throw new Error(`Broken alias: ${variable.name}`);
    return resolvedValue(resources, target, seen);
  }
  return value;
}

function valuesMatch(actual, expected) {
  if (typeof expected === "number") {
    return typeof actual === "number" && Math.abs(actual - expected) < 0.001;
  }
  if (!actual || typeof actual !== "object") return false;
  const expectedColor = parseColor(expected);
  const channels = ["r", "g", "b", "a"];
  return channels.every((channel) => {
    const left = actual[channel] === undefined ? 1 : actual[channel];
    const right = expectedColor[channel] === undefined ? 1 : expectedColor[channel];
    return Math.abs(left - right) < 0.005;
  });
}

function primitiveName(theme, token) {
  return `theme/${theme.id}/${token.name}`;
}

function primitiveKey(theme, token) {
  return `primitive/${primitiveName(theme, token)}`;
}

function semanticKey(theme, token) {
  return `semantic/${theme.id}/${token.name}`;
}

async function allResources() {
  const [collections, variables] = await Promise.all([figma.variables.getLocalVariableCollectionsAsync(), figma.variables.getLocalVariablesAsync()]);
  return { collections, variables };
}

async function assertTargetFile() {
  if (figma.editorType !== "figma") {
    throw new Error("This plugin only supports Figma Design files.");
  }
  if (figma.fileKey) {
    if (figma.fileKey !== PLAN.figma.fileKey) {
      throw new Error(`Wrong file: expected ${PLAN.figma.fileKey}, got ${figma.fileKey}`);
    }
    return `fileKey=${figma.fileKey}`;
  }

  const pageNames = new Set(figma.root.children.map((page) => page.name));
  const requiredPages = ["00 · Baseline Guide", "01 · Foundations", "02 · Components", "10 · Home", "20 · Production Prototype"];
  const missingPages = requiredPages.filter((name) => !pageNames.has(name));
  const hasCodeMapLineage = ["00 · Code Map", "00 · Code Map · MacCMS Current", "91 · Archive · Next.js Code Map · 2026-07-24"].some((name) =>
    pageNames.has(name)
  );
  const hasRawEvidence = pageNames.has("网页布局截图_html_to_design") || pageNames.has("92 · Raw Evidence · html.to.design · 2026-07-28");
  const resources = await allResources();
  const requiredCollections = [DEFAULT_COLLECTION, "Spacing & Radius"];
  const missingCollections = requiredCollections.filter((name) => !resources.collections.some((collection) => collection.name === name));
  if (missingPages.length || !hasCodeMapLineage || !hasRawEvidence || missingCollections.length) {
    throw new Error(
      [
        `Unverified file: Figma did not expose fileKey ${PLAN.figma.fileKey} to this development plugin.`,
        `missing pages=${missingPages.join(", ") || "none"}`,
        `code map lineage=${hasCodeMapLineage ? "present" : "missing"}`,
        `raw evidence=${hasRawEvidence ? "present" : "missing"}`,
        `missing collections=${missingCollections.join(", ") || "none"}`
      ].join("\n")
    );
  }
  return `fingerprint=${requiredPages.length} stable pages + code map lineage + raw evidence + ${requiredCollections.join(", ")}`;
}

async function ensureCollection(resources, name, key) {
  const tagged = resources.collections.find((item) => entityKey(item) === key);
  if (tagged) {
    if (!isOwned(tagged, key)) {
      throw new Error(`Collection ownership conflict: ${name}`);
    }
    return tagged;
  }
  const sameName = resources.collections.find((item) => item.name === name);
  if (sameName) {
    throw new Error(`Collection "${name}" already exists without this baseline tag. ` + "Review it manually instead of overwriting it.");
  }
  const collection = tag(figma.variables.createVariableCollection(name), key);
  collection.renameMode(collection.modes[0].modeId, "Value");
  resources.collections.push(collection);
  return collection;
}

function findVariable(resources, collection, name) {
  return resources.variables.find((item) => item.variableCollectionId === collection.id && item.name === name);
}

async function ensureVariable(resources, collection, key, name, type, value, scopes, css) {
  let variable = resources.variables.find((item) => entityKey(item) === key);
  if (variable && !isOwned(variable, key)) {
    throw new Error(`Variable ownership conflict: ${name}`);
  }
  if (!variable) {
    const sameName = findVariable(resources, collection, name);
    if (sameName) {
      throw new Error(`Variable "${collection.name}/${name}" exists without this baseline tag.`);
    }
    variable = tag(figma.variables.createVariable(name, collection, type), key);
    resources.variables.push(variable);
  }
  if (variable.resolvedType !== type) {
    throw new Error(`Variable type conflict: ${name}`);
  }
  const modeId = collection.modes[0].modeId;
  variable.setValueForMode(modeId, value);
  variable.scopes = scopes;
  variable.setVariableCodeSyntax("WEB", `var(${css})`);
  return variable;
}

async function createThemeVariables() {
  const resources = await allResources();
  const defaultCollection = resources.collections.find((item) => item.name === DEFAULT_COLLECTION);
  if (!defaultCollection) {
    throw new Error(`Required existing collection missing: ${DEFAULT_COLLECTION}`);
  }
  for (const token of PLAN.themes[0].tokens.filter((item) => variableType(item) === "COLOR")) {
    const variable = findVariable(resources, defaultCollection, token.name);
    if (!variable) {
      throw new Error(`Required default variable missing: ${defaultCollection.name}/${token.name}`);
    }
    if (!valuesMatch(resolvedValue(resources, variable), token.value)) {
      throw new Error(`Default variable value conflict: ${defaultCollection.name}/${token.name}`);
    }
    variable.scopes = token.scopes;
    variable.setVariableCodeSyntax("WEB", `var(${token.css})`);
  }

  const primitiveCollection = await ensureCollection(resources, PRIMITIVE_COLLECTION, "collection/theme-primitives");
  const primitiveByKey = new Map();

  for (const theme of PLAN.themes) {
    for (const token of theme.tokens) {
      const primitive = await ensureVariable(
        resources,
        primitiveCollection,
        primitiveKey(theme, token),
        primitiveName(theme, token),
        variableType(token),
        variableValue(token),
        [],
        token.css
      );
      primitiveByKey.set(primitiveKey(theme, token), primitive);
    }
  }

  const semanticCollections = new Map([[PLAN.themes[0].id, defaultCollection]]);
  for (const theme of PLAN.themes.slice(1)) {
    const collection = await ensureCollection(resources, theme.collection, `collection/semantic/${theme.id}`);
    semanticCollections.set(theme.id, collection);
    for (const token of theme.tokens) {
      const primitive = primitiveByKey.get(primitiveKey(theme, token));
      await ensureVariable(
        resources,
        collection,
        semanticKey(theme, token),
        token.name,
        variableType(token),
        figma.variables.createVariableAlias(primitive),
        token.scopes,
        token.css
      );
    }
  }

  return {
    resources,
    primitiveCollection,
    defaultCollection,
    primitiveByKey,
    semanticCollections,
    spacingValues: (() => {
      const spacingCollection = resources.collections.find((item) => item.name === "Spacing & Radius");
      return spacingCollection
        ? resources.variables
            .filter((variable) => variable.variableCollectionId === spacingCollection.id && variable.resolvedType === "FLOAT")
            .map((variable) => ({ variable, value: resolvedValue(resources, variable) }))
        : [];
    })()
  };
}

async function loadFonts() {
  const candidates = [
    { family: "Inter", style: "Regular" },
    { family: "Inter", style: "Medium" },
    { family: "Inter", style: "Bold" }
  ];
  const available = await figma.listAvailableFontsAsync();
  const resolved = [];
  for (const candidate of candidates) {
    const exact = available.find((item) => item.fontName.family === candidate.family && item.fontName.style === candidate.style);
    const fallback = exact || available.find((item) => item.fontName.family === candidate.family && item.fontName.style === "Regular");
    if (!fallback) throw new Error("Inter is not available in this file.");
    resolved.push(fallback.fontName);
  }
  await Promise.all(resolved.map((font) => figma.loadFontAsync(font)));
  return {
    regular: resolved[0],
    medium: resolved[1],
    bold: resolved[2]
  };
}

function bindColor(variable, fallback) {
  if (!variable) return solidPaint(fallback);
  return figma.variables.setBoundVariableForPaint(solidPaint(fallback), "color", variable);
}

function createText(value, font, size, colorVariable, fallback, width) {
  const text = figma.createText();
  text.fontName = font;
  text.fontSize = size;
  text.characters = value;
  text.textAutoResize = width ? "HEIGHT" : "WIDTH_AND_HEIGHT";
  if (width) text.resize(width, Math.max(1, text.height));
  text.fills = [bindColor(colorVariable, fallback)];
  return text;
}

function createAutoFrame(name, direction, width, gap) {
  const frame = figma.createFrame();
  frame.name = name;
  frame.resize(width, 1);
  frame.layoutMode = direction;
  frame.primaryAxisSizingMode = direction === "VERTICAL" ? "AUTO" : "FIXED";
  frame.counterAxisSizingMode = direction === "VERTICAL" ? "FIXED" : "AUTO";
  frame.itemSpacing = gap;
  frame.clipsContent = false;
  frame.fills = [];
  return frame;
}

function themeVariable(resources, collection, name) {
  return findVariable(resources, collection, name);
}

function collectionForThemeToken(context, theme, token) {
  return context.semanticCollections.get(theme.id);
}

function themeVariableByName(context, theme, name) {
  const token = theme.tokens.find((item) => item.name === name);
  if (!token) return null;
  if (theme.id === PLAN.themes[0].id && variableType(token) === "FLOAT") {
    return context.primitiveByKey.get(primitiveKey(theme, token)) || null;
  }
  return themeVariable(context.resources, collectionForThemeToken(context, theme, token), name);
}

function clearOwnedChildren(root) {
  for (const child of root.children.slice()) {
    if (child.getSharedPluginData(NS, "run_id") === RUN_ID) child.remove();
  }
}

function assertApproval(approval) {
  if (approval !== APPROVAL_PHRASE) {
    throw new Error("Approval phrase does not match.");
  }
}

function compactPageName(name) {
  return name.replace(/ · /g, " ");
}

function pageAliases(pagePlan) {
  const aliases = new Set([compactPageName(pagePlan.name)]);
  if (pagePlan.operation.startsWith("rename-from:")) {
    const source = pagePlan.operation.slice("rename-from:".length);
    aliases.add(source);
    aliases.add(compactPageName(source));
  }
  if (pagePlan.name === "92 · Raw Evidence · html.to.design · 2026-07-28") {
    aliases.add("网页布局截图_html_to_design");
    aliases.add("90 - html.to.design Raw Import - 2026-07-28");
    aliases.add("90 · html.to.design Raw Import · 2026-07-28");
  }
  return Array.from(aliases).filter((name) => name !== pagePlan.name);
}

function pagePlanByName(name) {
  const pagePlan = PLAN.pages.find((item) => item.name === name);
  if (!pagePlan) throw new Error(`Unknown planned page: ${name}`);
  return pagePlan;
}

function findPlannedPage(pagePlan) {
  return (
    figma.root.children.find((page) => page.name === pagePlan.name) || figma.root.children.find((page) => pageAliases(pagePlan).includes(page.name)) || null
  );
}

async function ensurePlannedPage(name) {
  const pagePlan = pagePlanByName(name);
  let page = figma.root.children.find((item) => item.name === name);
  let created = false;
  let renamedFrom = "";
  if (page) assertMutableTargetPage(page);
  if (!page) {
    page = findPlannedPage(pagePlan);
    if (page) {
      assertMutableTargetPage(page);
      renamedFrom = page.name;
      page.name = name;
      page.setSharedPluginData(NS, "canonical_name", name);
      page.setSharedPluginData(NS, "phase", "P2");
    } else if (pagePlan.operation === "rename-only" || pagePlan.operation.startsWith("rename-from:")) {
      throw new Error(`Required source page missing for ${name}. Expected one of: ${pageAliases(pagePlan).join(", ")}`);
    } else {
      page = tag(figma.createPage(), `page/${name}`, "P2");
      page.name = name;
      created = true;
    }
  }
  await page.loadAsync();
  assertMutableTargetPage(page);
  return { page, pagePlan, created, renamedFrom };
}

function placeAwayFromExisting(page, node) {
  let right = 0;
  for (const child of page.children) {
    if (child === node) continue;
    const box = child.absoluteBoundingBox;
    if (box) right = Math.max(right, box.x + box.width);
  }
  node.x = right ? Math.ceil((right + 240) / 100) * 100 : 0;
  node.y = 0;
}

function variableByCss(resources, collection, css) {
  return (
    resources.variables.find(
      (variable) => variable.variableCollectionId === collection.id && variable.codeSyntax && variable.codeSyntax.WEB === `var(${css})`
    ) || null
  );
}

async function docContext() {
  const resources = await allResources();
  const collection = resources.collections.find((item) => item.name === DEFAULT_COLLECTION);
  if (!collection) throw new Error(`Required existing collection missing: ${DEFAULT_COLLECTION}`);
  const spacingCollection = resources.collections.find((item) => item.name === "Spacing & Radius") || null;
  const fonts = await loadFonts();
  const allTextStyles = await figma.getLocalTextStylesAsync();
  const textStyles = allTextStyles.filter((style) => MAINTAINED_TEXT_STYLE_PREFIXES.some((prefix) => style.name.startsWith(prefix)));
  return {
    resources,
    collection,
    fonts,
    textStyles,
    spacingCollection,
    spacingValues: spacingCollection
      ? resources.variables
          .filter((variable) => variable.variableCollectionId === spacingCollection.id && variable.resolvedType === "FLOAT")
          .map((variable) => ({ variable, value: resolvedValue(resources, variable) }))
      : [],
    canvas: variableByCss(resources, collection, "--bg"),
    panel: variableByCss(resources, collection, "--panel"),
    panelSoft: variableByCss(resources, collection, "--panel-soft"),
    text: variableByCss(resources, collection, "--text"),
    muted: variableByCss(resources, collection, "--muted"),
    line: variableByCss(resources, collection, "--line"),
    lineStrong: variableByCss(resources, collection, "--line-strong"),
    lineAccentSoft: variableByCss(resources, collection, "--line-accent-soft"),
    lineAccent: variableByCss(resources, collection, "--line-accent"),
    lineAccentStrong: variableByCss(resources, collection, "--line-accent-strong"),
    lineWarm: variableByCss(resources, collection, "--line-warm"),
    lineWarmStrong: variableByCss(resources, collection, "--line-warm-strong"),
    lineGold: variableByCss(resources, collection, "--line-gold"),
    accent: variableByCss(resources, collection, "--accent"),
    accent2: variableByCss(resources, collection, "--accent-2"),
    gold: variableByCss(resources, collection, "--gold"),
    surface: variableByCss(resources, collection, "--surface"),
    surfaceStrong: variableByCss(resources, collection, "--surface-strong"),
    selected: variableByCss(resources, collection, "--selected-bg"),
    radius: variableByCss(resources, collection, "--radius"),
    radiusSmall: variableByCss(resources, collection, "--radius-sm")
  };
}

function floatVariableForValue(context, value, field) {
  const candidates = context.spacingValues.filter((item) => typeof item.value === "number" && Math.abs(item.value - value) < 0.001);
  const wantsRadius = field.toLowerCase().includes("radius");
  return (
    candidates.find((item) => wantsRadius === /radius/i.test(item.variable.name))?.variable ||
    candidates.find((item) => !/radius/i.test(item.variable.name))?.variable ||
    candidates[0]?.variable ||
    null
  );
}

function setLayoutNumber(node, field, value, context) {
  if (field !== "width" && field !== "height") node[field] = value;
  const variable = floatVariableForValue(context, value, field);
  if (variable) node.setBoundVariable(field, variable);
}

function setRadius(node, value, variable) {
  node.cornerRadius = value;
  if (variable) node.setBoundVariable("cornerRadius", variable);
}

function matchingTextStyle(context, size, font) {
  if (!context.textStyles) return null;
  const wantsBold = /bold|semibold|heavy|black/i.test(font.style);
  const wantsMedium = /medium/i.test(font.style);
  return (
    context.textStyles.find((style) => {
      if (style.fontSize !== size) return false;
      const styleBold = /bold|semibold|heavy|black/i.test(style.fontName.style);
      const styleMedium = /medium/i.test(style.fontName.style);
      return wantsBold ? styleBold : wantsMedium ? styleMedium : !styleBold;
    }) || null
  );
}

async function addOwnedText(parent, key, text, context, options = {}) {
  const font = options.font || context.fonts.regular;
  const size = options.size || 13;
  const node = tag(
    createText(text, font, size, options.color || context.text, options.fallback || "#f4f6ff", options.width || Math.max(1, parent.width - 48)),
    key,
    options.phase || "P2"
  );
  const style = matchingTextStyle(context, size, font);
  if (style) await node.setTextStyleIdAsync(style.id);
  parent.appendChild(node);
  return node;
}

async function createDocCard(context, key, item, phase = "P2") {
  const card = tag(createAutoFrame(item.name || item.title, "VERTICAL", 1312, 8), key, phase);
  setLayoutNumber(card, "itemSpacing", 8, context);
  setLayoutNumber(card, "paddingTop", 20, context);
  setLayoutNumber(card, "paddingRight", 22, context);
  setLayoutNumber(card, "paddingBottom", 20, context);
  setLayoutNumber(card, "paddingLeft", 22, context);
  card.fills = [bindColor(context.panel, "#0f1322")];
  card.strokes = [bindColor(context.line, "rgba(221, 228, 255, 0.16)")];
  card.strokeWeight = 1;
  setRadius(card, 18, context.radius);
  await addOwnedText(card, `${key}/title`, item.title, context, {
    font: context.fonts.bold,
    size: 17,
    width: 1268,
    phase
  });
  if (item.meta) {
    await addOwnedText(card, `${key}/meta`, item.meta, context, {
      color: context.accent2,
      fallback: "#6ee7f9",
      size: 11,
      width: 1268,
      phase
    });
  }
  await addOwnedText(card, `${key}/body`, item.body, context, {
    color: context.muted,
    fallback: "#9da6bd",
    size: 12,
    width: 1268,
    phase
  });
  if (item.assetPath) {
    card.appendChild(createAssetPreview(context, `${key}/preview`, item.assetPath, phase));
  }
  return card;
}

function createAssetPreview(context, key, assetPath, phase) {
  const preview = tag(figma.createFrame(), key, phase);
  const fileName = assetPath.split("/").pop();
  preview.name = `Preview / ${fileName}`;
  preview.resize(1268, 220);
  preview.fills = [bindColor(context.panelSoft, "rgba(23, 28, 48, 0.82)")];
  preview.strokes = [bindColor(context.line, "rgba(221, 228, 255, 0.16)")];
  preview.strokeWeight = 1;
  preview.clipsContent = true;
  setRadius(preview, 12, context.radiusSmall);

  const entry = ASSET_PAYLOAD.entries[assetPath];
  const blob = entry && entry.blobId ? ASSET_PAYLOAD.blobs[entry.blobId] : null;
  try {
    if (entry && entry.kind === "SVG" && blob && blob.svg) {
      const displaySvg = assetPath.includes("/images/pixel/icon-")
        ? blob.svg.replace("<svg ", '<svg fill="#b9e84a" ')
        : blob.svg;
      const vector = tag(figma.createNodeFromSvg(displaySvg), `${key}/svg`, phase);
      vector.name = `${fileName} / Editable SVG`;
      const scale = Math.min(1180 / Math.max(1, vector.width), 180 / Math.max(1, vector.height));
      vector.rescale(scale);
      vector.x = (preview.width - vector.width) / 2;
      vector.y = (preview.height - vector.height) / 2;
      preview.appendChild(vector);
      return preview;
    }
    if (entry && entry.kind === "RASTER" && blob && blob.base64) {
      const image = figma.createImage(figma.base64Decode(blob.base64));
      const rectangle = tag(figma.createRectangle(), `${key}/raster`, phase);
      rectangle.name = `${fileName} / Source Raster`;
      rectangle.resize(1180, 180);
      rectangle.x = 44;
      rectangle.y = 20;
      rectangle.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FIT" }];
      setRadius(rectangle, 8, null);
      preview.appendChild(rectangle);
      return preview;
    }
  } catch (error) {
    const failure = tag(
      createText(`Preview unavailable · ${errorText(error)}`, context.fonts.regular, 12, context.muted, "#9da6bd", 1180),
      `${key}/error`,
      phase
    );
    failure.x = 44;
    failure.y = 92;
    preview.appendChild(failure);
    return preview;
  }
  const placeholder = tag(
    createText(entry && entry.reason ? entry.reason : "Preview payload missing.", context.fonts.regular, 12, context.muted, "#9da6bd", 1180),
    `${key}/unsupported`,
    phase
  );
  placeholder.x = 44;
  placeholder.y = 92;
  preview.appendChild(placeholder);
  return preview;
}

function stateCoverage(archetype) {
  const missing = PLAN.requiredPageStates.filter((state) => !archetype.states.includes(state));
  return `Implemented: ${archetype.states.join(", ")}\nMissing: ${missing.length ? missing.map((state) => `${state} · Not implemented in current code`).join(", ") : "none"}`;
}

function archetypeCard(archetype) {
  const responsive = PLAN.responsivePatterns.find((pattern) => pattern.families.includes(archetype.family));
  return {
    title: `${archetype.id} · ${archetype.name}`,
    meta: `${archetype.route} · ${archetype.figmaPage}`,
    body: [
      `Purpose / family: ${archetype.family}`,
      `Components: ${archetype.components.join(", ")}`,
      `Data: ${archetype.data.join(", ")}`,
      `Templates: ${archetype.templates.join("\n")}`,
      stateCoverage(archetype),
      responsive
        ? `Responsive:\nDesktop · ${responsive.desktop}\nTablet · ${responsive.tablet}\nMobile · ${responsive.mobile}`
        : "Responsive: use the global navigation pattern and current CSS media queries.",
      "Extension direction: Not specified in current code; record future changes before implementation."
    ].join("\n")
  };
}

function navigationFlowCard(flow) {
  return {
    title: `${flow.id} · ${flow.name}`,
    meta: `Entry: ${flow.entry}`,
    body: `Flow: ${flow.steps.join(" → ")}\nTransition: ${flow.transition}\nSources: ${flow.sourceFiles.join("\n")}`
  };
}

function formatColorValue(value) {
  if (!value || typeof value !== "object" || !("r" in value)) return JSON.stringify(value);
  const red = Math.round(value.r * 255);
  const green = Math.round(value.g * 255);
  const blue = Math.round(value.b * 255);
  const alpha = value.a === undefined ? 1 : value.a;
  return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(3))})`;
}

function formatLineMetric(metric) {
  if (!metric || metric.unit === "AUTO") return "AUTO";
  return `${metric.value}${metric.unit === "PIXELS" ? "px" : "%"}`;
}

function formatEffect(effect) {
  if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
    return `${effect.type} · ${effect.offset.x},${effect.offset.y} · blur ${effect.radius} · spread ${effect.spread || 0} · ${formatColorValue(effect.color)}`;
  }
  return `${effect.type} · radius ${effect.radius} · visible ${effect.visible}`;
}

async function dynamicDocumentationItems(name) {
  if (name !== "01 · Foundations") return [];
  const resources = await allResources();
  const officialCollectionNames = ["Primitives", DEFAULT_COLLECTION, "Spacing & Radius"];
  const officialCollections = resources.collections
    .filter((collection) => officialCollectionNames.includes(collection.name))
    .sort((left, right) => left.name.localeCompare(right.name));
  const variableItems = officialCollections.flatMap((collection) =>
    resources.variables
      .filter((variable) => variable.variableCollectionId === collection.id)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((variable) => {
        const value = resolvedValue(resources, variable);
        return {
          title: `Variable · ${collection.name}/${variable.name}`,
          meta: variable.codeSyntax.WEB || "No WEB code syntax",
          body: `Type: ${variable.resolvedType}\nValue: ${typeof value === "number" ? `${value}px` : formatColorValue(value)}\nScopes: ${
            [...variable.scopes].sort().join(", ") || "none"
          }`
        };
      })
  );
  if (!officialCollections.some((collection) => collection.name === "Spacing & Radius")) {
    variableItems.push({
      title: "Spacing & Radius collection",
      meta: "Missing",
      body: "The audited local Spacing & Radius collection is no longer present. Stop before generating dependent components."
    });
  }

  const allTextStyles = await figma.getLocalTextStylesAsync();
  const textStyles = allTextStyles
    .filter((style) => MAINTAINED_TEXT_STYLE_PREFIXES.some((prefix) => style.name.startsWith(prefix)))
    .sort((left, right) => left.name.localeCompare(right.name));
  const textItems = textStyles.map((style) => ({
    title: `Text style · ${style.name}`,
    meta: `${style.fontName.family} · ${style.fontName.style} · ${style.fontSize}px`,
    body: [
      `Line height: ${formatLineMetric(style.lineHeight)}`,
      `Letter spacing: ${formatLineMetric(style.letterSpacing)}`,
      `Case: ${style.textCase}`,
      `Decoration: ${style.textDecoration}`,
      `Description: ${style.description || "none"}`
    ].join("\n")
  }));

  const allEffectStyles = await figma.getLocalEffectStylesAsync();
  const effectStyles = allEffectStyles
    .filter((style) => MAINTAINED_EFFECT_STYLE_PREFIXES.some((prefix) => style.name.startsWith(prefix)))
    .sort((left, right) => left.name.localeCompare(right.name));
  const effectItems = effectStyles.map((style) => ({
    title: `Effect style · ${style.name}`,
    meta: `${style.effects.length} effect${style.effects.length === 1 ? "" : "s"}`,
    body: `${style.effects.map(formatEffect).join("\n") || "No effects"}\nDescription: ${style.description || "none"}`
  }));
  return [
    {
      title: "Maintained design-system inventory",
      meta: `${officialCollections.length} collections · ${variableItems.length} variables · ${textStyles.length} text styles · ${effectStyles.length} effect styles`,
      body: `Only Primitives, Semantic · Liquid Cinema, Spacing & Radius, ${MAINTAINED_TEXT_STYLE_PREFIXES.join(
        ", "
      )} text styles, and ${MAINTAINED_EFFECT_STYLE_PREFIXES.join(
        ", "
      )} effect styles are promoted here. html.to.design variables and domain-prefixed styles remain isolated as Raw Evidence.`
    },
    ...variableItems,
    ...textItems,
    ...effectItems
  ];
}

function documentationModel(name) {
  if (name === "00 · Baseline Guide") {
    return {
      title: "Squared Media · Product Design Baseline",
      intro: `Current source: ${SOURCE_REFERENCE} · ${PLAN.source.runtime}. This file is a maintained implementation reference, not a redesign proposal.`,
      items: [
        {
          title: "Source-of-truth contract",
          meta: PLAN.source.sourceRoots.join(" · "),
          body: PLAN.guardrails.join("\n")
        },
        {
          title: "Maintenance workflow",
          meta: "Audit → source diff → variables → one component/page family → validation → handoff",
          body: "Update the code map whenever routes, templates, CSS breakpoints, public assets, or interaction state machines change. Preserve raw evidence and production prototype acceptance references. Never promote preview-only assets or historical Next.js mappings into the current implementation map."
        },
        {
          title: "Page-transition map",
          meta: `${PLAN.navigationFlows.length} source-backed flows`,
          body: PLAN.navigationFlows.map((flow) => `${flow.id} · ${flow.steps.join(" → ")}`).join("\n")
        },
        {
          title: "Settings are surfaces, not a page",
          meta: "No standalone settings route in current code",
          body: PLAN.settingsSurfaces.map((surface) => `${surface.name} · ${surface.route}\n${surface.behavior}`).join("\n\n")
        },
        {
          title: "Status of developer integrations",
          meta: "Explicitly tracked",
          body: `Code Connect: ${PLAN.integrationStatus.codeConnect}\nSettings route: ${PLAN.integrationStatus.settingsRoute}`
        }
      ]
    };
  }
  if (name === "00 · Code Map · MacCMS Current") {
    return {
      title: "Code Map · MacCMS Current",
      intro: `30 visual archetypes mapped to current production templates. Historical apps/web references belong only on ${PLAN.pages.find((page) => page.name.startsWith("91 · Archive")).name}.`,
      items: [...PLAN.navigationFlows.map(navigationFlowCard), ...PLAN.archetypes.map(archetypeCard)]
    };
  }
  if (name === "01 · Foundations") {
    const themeItems = PLAN.themes.map((theme) => ({
      title: `${theme.label} · ${theme.option}`,
      meta: theme.collection,
      body: theme.tokens.map((token) => `${token.name} · var(${token.css}) · ${token.value}`).join("\n")
    }));
    const statusItems = PLAN.statusTokens.map((token) => ({
      title: token.label,
      meta: token.sourceSelectors.join(" · "),
      body: `Foreground ${token.foreground}\nBorder ${token.border}\nBackground ${token.background}\nOpacity ${token.opacity}`
    }));
    return {
      title: "Foundations · Current Code",
      intro:
        "Typography: the default theme uses the system UI stack. Pixel Frog titles, navigation, buttons, labels, and status text use the local Fusion Pixel PFV 12px proportional Simplified Chinese runtime font at weight 400; Figma uses a fallback unless that font is installed locally. Core controls use a 44px minimum touch target; login controls use 54–58px. Existing formal text/effect styles remain authoritative.",
      items: [...themeItems, ...statusItems]
    };
  }
  if (name === "02 · Components") {
    const existingItems = PLAN.existingFigmaComponents.map((componentName) => {
      const contract = PLAN.existingComponentStateContracts.find((item) => item.name === componentName);
      const sourceStates = contract.states.map((state) => state.toLowerCase());
      const requiredCoverage = PLAN.requiredComponentStates
        .map((state) => {
          const implemented = state === "default" ? true : sourceStates.includes(state);
          return `${state}: ${implemented ? "implemented / source-specific" : "Not implemented in current code"}`;
        })
        .join("\n");
      return {
        title: `Existing · ${componentName}`,
        meta: "Reuse current editable component",
        body: `Source states: ${contract.states.join(", ")}\nRequired state matrix:\n${requiredCoverage}\nSources: ${contract.sourceFiles.join("\n")}`
      };
    });
    const buildItems = PLAN.componentBuilds.map((build) => ({
      title: `Planned · ${build.name}`,
      meta: `${build.variantCount} variants · ${Object.entries(build.variantDimensions)
        .map(([dimension, values]) => `${dimension}: ${values.join("/")}`)
        .join(" · ")}`,
      body: [
        `Evidence: ${Object.entries(build.stateEvidence)
          .map(([state, values]) => `${state}=${values.length ? values.join(" + ") : "Not implemented in current code"}`)
          .join("\n")}`,
        `Explicit gaps: ${build.notImplemented.length ? build.notImplemented.join(", ") : "none"}`,
        `Reference only: ${Boolean(build.referenceOnly)}`
      ].join("\n")
    }));
    return {
      title: "Components · Reuse and State Contract",
      intro:
        `The existing ${PLAN.existingFigmaComponents.length} editable components remain authoritative. P3 adds ${PLAN.componentBuilds.length} current-code families, one set at a time. Context-specific controls stay separate and unavailable states are recorded instead of invented.`,
      items: [...existingItems, ...buildItems]
    };
  }
  if (name === "03 · Assets & Symbols") {
    return {
      title: "Assets & Symbols · Source Inventory",
      intro:
        "Source files remain authoritative. SVG stays editable; raster assets retain source dimensions and explicit dark/light choices. Pixel Frog monochrome controls are source SVGs applied through CSS masks, while its emblem, border, and grid keep fixed source colors.",
      items: [
        ...PLAN.assetGroups.map((group) => ({
          title: group.directory,
          meta: group.usage,
          body: `Size: ${group.sizeRule}\nColor: ${group.colorBehavior}`
        })),
        ...PLAN.assetInventory.map((asset) => ({
          title: asset.path,
          meta: `${asset.dimensions} · ${asset.status}`,
          body: `Usage: ${asset.usage}\nColor: ${asset.colorBehavior}`,
          assetPath: asset.path
        }))
      ]
    };
  }
  if (name === "04 · Responsive Rules") {
    const viewports = PLAN.referenceViewports.map((viewport) => ({
      title: `${viewport.name} · ${viewport.width}px`,
      meta: "Canonical reference viewport",
      body: "Use as an acceptance frame. CSS breakpoints remain the implementation authority."
    }));
    const breakpoints = PLAN.breakpoints.map((breakpoint) => ({
      title: `${breakpoint.axis === "height" ? "Height" : "Width"} ≤ ${breakpoint.max}px · ${breakpoint.id}`,
      meta: `${breakpoint.scope} · @media (max-${breakpoint.axis}: ${breakpoint.max}px)`,
      body: `${breakpoint.behavior}\nSource: ${breakpoint.sourceFile}`
    }));
    const conditions = PLAN.mediaConditions.map((condition) => ({
      title: `Media condition · ${condition.query}`,
      meta: "Environmental behavior",
      body: condition.behavior
    }));
    const patterns = PLAN.responsivePatterns.map((pattern) => ({
      title: `Responsive pattern · ${pattern.id}`,
      meta: `${pattern.families.join(", ")} · ${pattern.sourceSelectors.join(" · ")}`,
      body: [
        `Desktop: ${pattern.desktop}`,
        `Tablet: ${pattern.tablet}`,
        `Mobile: ${pattern.mobile}`,
        `Show / hide: ${pattern.visibility}`,
        `Navigation: ${pattern.navigation}`,
        `Cards / modules: ${pattern.cards}`
      ].join("\n")
    }));
    return {
      title: "Responsive Rules · Current CSS",
      intro:
        `Desktop 1440, Tablet 768, and Mobile 390 are acceptance frames, not CSS breakpoints. The ${PLAN.breakpoints.length} source-backed thresholds below cover the theme shell, Artplayer status overlay, and preload/buffering prompts.`,
      items: [...viewports, ...breakpoints, ...conditions, ...patterns]
    };
  }
  if (name === "05 · Interaction & States") {
    const interactions = PLAN.interactionFacts.map((fact) => ({
      title: fact.name,
      meta: fact.source,
      body: `${fact.behavior}\nEvidence:\n${fact.evidence.join("\n")}`
    }));
    const states = PLAN.requiredPageStates.map((state) => ({
      title: `Page state · ${state}`,
      meta: "Required coverage",
      body: `${PLAN.missingStatePolicy} Coverage is recorded per archetype in the current Code Map and page-family index.`
    }));
    return {
      title: "Interaction & States · Current Behavior",
      intro:
        "Motion, feedback, focus, loading, failure, theme-specific Hover/Action behavior, and reduced-motion fallbacks are recorded from app.js, CSS, and player code.",
      items: [...interactions, ...states]
    };
  }
  if (name === "06 · Developer Reference") {
    const settings = PLAN.settingsSurfaces.map((surface) => ({
      title: `Settings surface · ${surface.name}`,
      meta: surface.route,
      body: `${surface.behavior}\nSources: ${surface.sourceFiles.join("\n")}`
    }));
    const machine = PLAN.machineOutputs.map((output) => ({
      title: `Machine output · ${output.name}`,
      meta: "Developer reference only · no visual frame",
      body: output.templates.join("\n")
    }));
    const sourceCoverage = PLAN.formalPrototype.codeCoverageAddendum.map((item) => ({
      title: `Source coverage · ${item.id} · ${item.name}`,
      meta: item.classification,
      body: `${item.representation}\nSources:\n${item.sourceFiles.join("\n")}`
    }));
    return {
      title: "Developer Reference · Routes, Data, and Extensions",
      intro: `All mappings reference ${SOURCE_REFERENCE}. All ${PLAN.sourceCoverage.expectedTrackedFileCount} tracked source files are represented by an archetype, component, interaction, flow, asset, machine output, or explicit non-visual coverage entry.`,
      items: [...PLAN.archetypes.map(archetypeCard), ...settings, ...machine, ...sourceCoverage]
    };
  }
  if (name === "90 · Issues / Recorded Only") {
    const themeIssues = PLAN.knownThemeIssues.map((issue) => ({
      title: `${issue.id} · ${issue.name}`,
      meta: "Current code mismatch · recorded only",
      body: `${issue.behavior}\nEvidence:\n${issue.evidence.join("\n")}`
    }));
    const excludedSources = PLAN.formalPrototype.codeCoverageAddendum
      .filter((item) => item.classification === "excluded-runtime")
      .map((item) => ({
        title: `${item.id} · ${item.name}`,
        meta: "Present in source · excluded from current production implementation",
        body: `${item.representation}\n${item.sourceFiles.join("\n")}`
      }));
    const stateGapItems = PLAN.archetypes
      .map((archetype) => ({
        archetype,
        missing: PLAN.requiredPageStates.filter((state) => !archetype.states.includes(state))
      }))
      .filter((item) => item.missing.length)
      .map(({ archetype, missing }) => ({
        title: `${archetype.id} · ${archetype.name}`,
        meta: "Missing state coverage",
        body: missing.map((state) => `${state} · Not implemented in current code`).join("\n")
      }));
    return {
      title: "Issues / Recorded Only",
      intro: "Observations are recorded without silently changing the current implementation or visual language.",
      items: [
        {
          title: "Historical mapping",
          meta: "Must remain archived",
          body: PLAN.archiveReferences.join("\n")
        },
        {
          title: "Dialog limitation",
          meta: "Browser-native confirmation",
          body: "Device, playback-history, and favorite destructive actions use confirm()/window.confirm. The browser or operating system owns the visual appearance; no themed custom-dialog component exists in current code."
        },
        {
          title: "Code Connect",
          meta: "Unpublished",
          body: PLAN.integrationStatus.codeConnect
        },
        ...themeIssues,
        ...excludedSources,
        ...stateGapItems
      ]
    };
  }
  throw new Error(`No documentation model for ${name}`);
}

async function ensureOwnedReferenceRoot(page, key, name, phase, context, width = 1440) {
  let root = page.children.find((item) => entityKey(item) === key);
  if (!root) {
    root = tag(createAutoFrame(name, "VERTICAL", width, 18), key, phase);
    root.paddingTop = 64;
    root.paddingRight = 64;
    root.paddingBottom = 96;
    root.paddingLeft = 64;
    page.appendChild(root);
    placeAwayFromExisting(page, root);
  } else if (!isOwned(root, key)) {
    throw new Error(`Reference root ownership conflict: ${name}`);
  }
  root.name = name;
  root.resize(width, Math.max(1, root.height));
  root.layoutMode = "VERTICAL";
  root.primaryAxisSizingMode = "AUTO";
  root.counterAxisSizingMode = "FIXED";
  root.clipsContent = false;
  clearOwnedChildren(root);
  const overlapsForeignRoot = page.children.some(
    (item) =>
      item !== root &&
      item.absoluteBoundingBox &&
      item.getSharedPluginData(NS, "run_id") !== RUN_ID &&
      boxesOverlap(root.absoluteBoundingBox, item.absoluteBoundingBox)
  );
  if (overlapsForeignRoot) placeAwayFromExisting(page, root);
  setLayoutNumber(root, "itemSpacing", 40, context);
  setLayoutNumber(root, "paddingTop", 64, context);
  setLayoutNumber(root, "paddingRight", 64, context);
  setLayoutNumber(root, "paddingBottom", 96, context);
  setLayoutNumber(root, "paddingLeft", 64, context);
  return root;
}

function bindReferenceRootSpacing(root, context, gap = 18, width = 1440) {
  root.resize(width, Math.max(1, root.height));
  root.layoutMode = "VERTICAL";
  root.primaryAxisSizingMode = "AUTO";
  root.counterAxisSizingMode = "FIXED";
  root.clipsContent = false;
  setLayoutNumber(root, "itemSpacing", gap, context);
  setLayoutNumber(root, "paddingTop", 64, context);
  setLayoutNumber(root, "paddingRight", 64, context);
  setLayoutNumber(root, "paddingBottom", 96, context);
  setLayoutNumber(root, "paddingLeft", 64, context);
}

function removeOwnedTopLevelOrphans(page, root, key) {
  for (const item of [...page.children]) {
    if (item !== root && item.getSharedPluginData(NS, "run_id") === RUN_ID && entityKey(item).startsWith(`${key}/`)) {
      item.remove();
    }
  }
}

function documentationSignature(name, model, items) {
  const canonicalItems = items
    .map((item) => ({ title: item.title || "", meta: item.meta || "", body: item.body || "" }))
    .sort((left, right) =>
      `${left.title}\u0000${left.meta}\u0000${left.body}`.localeCompare(`${right.title}\u0000${right.meta}\u0000${right.body}`)
    );
  const payload = { name, source: SOURCE_REFERENCE, title: model.title, intro: model.intro, items: canonicalItems };
  if (name === "03 · Assets & Symbols") payload.assetPreviewRevision = "pixel-mask-green-v1";
  return `fnv1a32:${signatureHash(JSON.stringify(payload))}`;
}

async function renderDocumentationPage(name) {
  await requireP1Complete();
  const { page } = await ensurePlannedPage(name);
  assertMutableTargetPage(page);
  await figma.setCurrentPageAsync(page);
  const context = await docContext();
  const model = documentationModel(name);
  const items = [...model.items, ...(await dynamicDocumentationItems(name))];
  const key = `p2/docs/${name}`;
  const root = await ensureOwnedReferenceRoot(page, key, `${name} / Current Code Reference`, "P2", context);
  removeOwnedTopLevelOrphans(page, root, key);
  bindReferenceRootSpacing(root, context);
  root.fills = [bindColor(context.canvas, "#05070d")];
  await addOwnedText(root, `${key}/title`, model.title, context, {
    font: context.fonts.bold,
    size: 40,
    width: 1312
  });
  await addOwnedText(root, `${key}/intro`, model.intro, context, {
    color: context.muted,
    fallback: "#9da6bd",
    size: 14,
    width: 1312
  });
  for (let index = 0; index < items.length; index += 1) {
    root.appendChild(await createDocCard(context, `${key}/item/${index + 1}`, items[index], "P2"));
  }
  root.setSharedPluginData(NS, "documentation_signature", documentationSignature(name, model, items));
  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
  figma.commitUndo();
  return `P2 DOCUMENTATION APPLIED\npage=${page.name} · ${page.id}\nroot=${root.id}\nitems=${items.length}\nsignature=${root.getSharedPluginData(
    NS,
    "documentation_signature"
  )}`;
}

function variantCombinations(build) {
  if (Array.isArray(build.variants)) return build.variants.map((combination) => ({ ...combination }));
  const entries = Object.entries(build.variantDimensions);
  return entries.reduce(
    (combinations, [dimension, values]) => combinations.flatMap((combination) => values.map((value) => ({ ...combination, [dimension]: value }))),
    [{}]
  );
}

function variantName(combination) {
  return Object.entries(combination)
    .map(([dimension, value]) => `${dimension}=${value}`)
    .join(", ");
}

function stateStyle(context, state) {
  const styles = {
    Loading: {
      fill: context.panel,
      fillFallback: "rgba(15, 19, 34, 0.76)",
      stroke: context.lineAccentSoft,
      strokeFallback: "rgba(139, 124, 255, 0.24)",
      text: context.accent2,
      textFallback: "#6ee7f9"
    },
    Available: {
      fill: context.selected,
      fillFallback: "rgba(139, 124, 255, 0.14)",
      stroke: context.lineAccent,
      strokeFallback: "rgba(139, 124, 255, 0.42)",
      text: context.accent2,
      textFallback: "#6ee7f9"
    },
    Slow: {
      fill: context.surfaceStrong,
      fillFallback: "rgba(255, 255, 255, 0.085)",
      stroke: context.lineGold,
      strokeFallback: "rgba(243, 201, 125, 0.38)",
      text: context.gold,
      textFallback: "#f3c97d"
    },
    Failed: {
      fill: context.surfaceStrong,
      fillFallback: "rgba(255, 255, 255, 0.085)",
      stroke: context.lineWarm,
      strokeFallback: "rgba(170, 117, 255, 0.4)",
      text: context.accent,
      textFallback: "#8b7cff"
    },
    Timeout: {
      fill: context.surfaceStrong,
      fillFallback: "rgba(255, 255, 255, 0.085)",
      stroke: context.lineWarm,
      strokeFallback: "rgba(170, 117, 255, 0.4)",
      text: context.accent,
      textFallback: "#8b7cff"
    },
    Unsupported: {
      fill: context.panel,
      fillFallback: "rgba(15, 19, 34, 0.76)",
      stroke: context.line,
      strokeFallback: "rgba(221, 228, 255, 0.16)",
      text: context.muted,
      textFallback: "#9da6bd"
    },
    Missing: {
      fill: context.panel,
      fillFallback: "rgba(15, 19, 34, 0.76)",
      stroke: context.line,
      strokeFallback: "rgba(221, 228, 255, 0.16)",
      text: context.muted,
      textFallback: "#9da6bd"
    },
    Recommended: {
      fill: context.panel,
      fillFallback: "rgba(15, 19, 34, 0.76)",
      stroke: context.lineAccentStrong,
      strokeFallback: "rgba(110, 231, 249, 0.54)",
      text: context.accent2,
      textFallback: "#6ee7f9"
    }
  };
  return styles[state] || styles.Unsupported;
}

function configureFixedAutoLayout(node, direction, width, height, gap, context) {
  node.layoutMode = direction;
  node.primaryAxisSizingMode = "FIXED";
  node.counterAxisSizingMode = "FIXED";
  node.primaryAxisAlignItems = "CENTER";
  node.counterAxisAlignItems = "CENTER";
  node.resize(width, height);
  setLayoutNumber(node, "width", width, context);
  setLayoutNumber(node, "height", height, context);
  setLayoutNumber(node, "itemSpacing", gap, context);
}

function configureHugAutoLayout(node, direction, height, gap, context) {
  node.resize(1, Math.max(1, height || 1));
  node.layoutMode = direction;
  node.primaryAxisSizingMode = "AUTO";
  node.counterAxisSizingMode = height ? "FIXED" : "AUTO";
  node.primaryAxisAlignItems = "CENTER";
  node.counterAxisAlignItems = "CENTER";
  if (height) setLayoutNumber(node, "height", height, context);
  setLayoutNumber(node, "itemSpacing", gap, context);
}

function gradientPaint(stops) {
  return {
    type: "GRADIENT_LINEAR",
    gradientTransform: [
      [1, 0, 0],
      [0, 1, 0]
    ],
    gradientStops: stops.map(([position, color]) => {
      const parsed = parseColor(color);
      return {
        position,
        color: { r: parsed.r, g: parsed.g, b: parsed.b, a: parsed.a === undefined ? 1 : parsed.a }
      };
    })
  };
}

async function appendVariantText(component, key, value, context, options = {}) {
  const font = options.font || context.fonts.medium;
  const size = options.size || 13;
  const text = tag(createText(value, font, size, options.color || context.text, options.fallback || "#f4f6ff"), key, "P3");
  const style = matchingTextStyle(context, size, font);
  if (style) await text.setTextStyleIdAsync(style.id);
  component.appendChild(text);
  return text;
}

function configureSurface(node, fillVariable, fillFallback, strokeVariable, strokeFallback, radiusVariable, radius = 12) {
  node.fills = [bindColor(fillVariable, fillFallback)];
  node.strokes = [bindColor(strokeVariable, strokeFallback)];
  node.strokeWeight = 1;
  setRadius(node, radius, radiusVariable);
}

function componentEffect(type, color, offset, radius, spread = 0) {
  const parsed = parseColor(color);
  return {
    type,
    color: { r: parsed.r, g: parsed.g, b: parsed.b, a: parsed.a === undefined ? 1 : parsed.a },
    offset,
    radius,
    spread,
    visible: true,
    blendMode: "NORMAL"
  };
}

async function createActionButtonVariant(build, combination, context, key, missing) {
  const component = tag(figma.createComponent(), key, "P3");
  component.name = variantName(combination);
  configureHugAutoLayout(component, "HORIZONTAL", 44, 6, context);
  setLayoutNumber(component, "paddingRight", 18, context);
  setLayoutNumber(component, "paddingLeft", 18, context);
  const primary = combination.Style === "Primary";
  const hover = combination.State === "Hover";
  const focus = combination.State === "Focus";
  configureSurface(
    component,
    primary ? (hover ? null : context.accent) : hover ? context.panelSoft : context.panel,
    primary ? (hover ? "#9486ff" : "#8b7cff") : hover ? "rgba(23, 28, 48, 0.92)" : "rgba(15, 19, 34, 0.76)",
    focus ? context.lineAccentStrong : hover ? context.lineStrong : context.line,
    focus ? "rgba(110, 231, 249, 0.54)" : hover ? "rgba(221, 228, 255, 0.28)" : "rgba(221, 228, 255, 0.16)",
    context.radius,
    18
  );
  if (primary && !focus) component.strokeWeight = 0;
  if (hover) {
    component.effects = [componentEffect("DROP_SHADOW", "rgba(139,124,255,0.24)", { x: 0, y: 8 }, 18)];
  }
  if (focus) {
    component.effects = [componentEffect("DROP_SHADOW", "rgba(110,231,249,0.24)", { x: 0, y: 0 }, 0, 3)];
  }
  if (combination.State === "Disabled") component.opacity = 0.72;
  const label = primary ? "主要操作" : "次要操作";
  await appendVariantText(component, `${key}/label`, label, context, {
    color: context.text,
    fallback: "#ffffff",
    size: 13
  });
  component.description = `${variantName(combination)} · Hug width · min-height 44px · 10px 18px padding · source-backed by .primary-btn/.ghost-btn.`;
  return component;
}

async function createFavoriteButtonVariant(build, combination, context, key) {
  const component = tag(figma.createComponent(), key, "P3");
  component.name = variantName(combination);
  configureHugAutoLayout(component, "HORIZONTAL", 44, 6, context);
  setLayoutNumber(component, "paddingRight", 18, context);
  setLayoutNumber(component, "paddingLeft", 18, context);
  const favorited = combination.State === "Favorited";
  configureSurface(
    component,
    favorited ? context.selected : context.panel,
    favorited ? "rgba(139, 124, 255, 0.14)" : "rgba(15, 19, 34, 0.76)",
    favorited ? context.lineAccentStrong : context.lineAccentSoft,
    favorited ? "rgba(110, 231, 249, 0.54)" : "rgba(139, 124, 255, 0.24)",
    context.radius,
    18
  );
  const loading = combination.State === "Loading";
  await appendVariantText(component, `${key}/label`, loading ? "收藏中…" : favorited ? "已收藏" : "收藏", context, {
    color: favorited ? context.accent2 : loading ? context.muted : context.text,
    fallback: favorited ? "#6ee7f9" : loading ? "#9da6bd" : "#f4f6ff",
    size: 13
  });
  if (loading) component.opacity = 1;
  component.description = `${variantName(combination)} · .favorite-btn. Loading remains visible, uses muted text, and disables interaction in current code.`;
  return component;
}

async function createLoginSubmitVariant(build, combination, context, key) {
  const component = tag(figma.createComponent(), key, "P3");
  component.name = variantName(combination);
  configureFixedAutoLayout(component, "HORIZONTAL", 320, 58, 6, context);
  component.fills = [
    gradientPaint([
      [0, "#6e99fa"],
      [0.46, "#6464fa"],
      [1, "#9b55fa"]
    ])
  ];
  component.strokes = [solidPaint("rgba(224, 230, 255, 0.34)")];
  component.strokeWeight = 1;
  setRadius(component, 12, context.radiusSmall);
  component.effects =
    combination.State === "Hover"
      ? [
          componentEffect("DROP_SHADOW", "rgba(75,94,255,0.40)", { x: 0, y: 18 }, 42),
          componentEffect("DROP_SHADOW", "rgba(154,74,255,0.34)", { x: 0, y: 0 }, 32),
          componentEffect("INNER_SHADOW", "rgba(255,255,255,0.40)", { x: 0, y: 1 }, 0)
        ]
      : [
          componentEffect("DROP_SHADOW", "rgba(75,94,255,0.32)", { x: 0, y: 14 }, 34),
          componentEffect("DROP_SHADOW", "rgba(154,74,255,0.24)", { x: 0, y: 0 }, 24),
          componentEffect("INNER_SHADOW", "rgba(255,255,255,0.34)", { x: 0, y: 1 }, 0)
        ];
  if (combination.State === "Loading") component.opacity = 0.72;
  const label = await appendVariantText(component, `${key}/label`, combination.State === "Loading" ? "登录中" : "登录", context, {
    font: context.fonts.bold,
    size: 16
  });
  label.letterSpacing = { unit: "PERCENT", value: 8 };
  component.description = `${variantName(combination)} · Reference width 320px; runtime width is 100% of the login panel · min-height 58px · radius 12px · source-backed by .login-submit and setLoginSubmitting().`;
  return component;
}

async function createHeaderSearchVariant(build, combination, context, key) {
  const component = tag(figma.createComponent(), key, "P3");
  component.name = variantName(combination);
  configureFixedAutoLayout(component, "HORIZONTAL", 420, 44, 0, context);
  component.primaryAxisAlignItems = "MIN";
  configureSurface(
    component,
    context.panel,
    "rgba(5, 8, 17, 0.38)",
    combination.State === "Focus" ? context.lineAccentStrong : context.line,
    combination.State === "Focus" ? "rgba(110, 231, 249, 0.54)" : "rgba(226, 231, 255, 0.15)",
    null,
    15
  );
  component.effects =
    combination.State === "Focus"
      ? [componentEffect("DROP_SHADOW", "rgba(110,231,249,0.22)", { x: 0, y: 0 }, 0, 3)]
      : [componentEffect("INNER_SHADOW", "rgba(255,255,255,0.06)", { x: 0, y: 1 }, 0)];

  const input = tag(figma.createFrame(), `${key}/input`, "P3");
  input.name = "Search input";
  configureFixedAutoLayout(input, "HORIZONTAL", 344, 44, 0, context);
  input.fills = [];
  input.strokes = [];
  input.primaryAxisAlignItems = "MIN";
  setLayoutNumber(input, "paddingLeft", 16, context);
  const placeholder = await appendVariantText(input, `${key}/input/placeholder`, "搜索影片、演员或导演…", context, {
    color: context.muted,
    fallback: "#9da6bd",
    size: 14
  });
  placeholder.layoutSizingHorizontal = "FILL";
  component.appendChild(input);

  const button = tag(figma.createFrame(), `${key}/button`, "P3");
  button.name = "Search button";
  configureFixedAutoLayout(button, "HORIZONTAL", 76, 44, 0, context);
  button.fills = [
    gradientPaint([
      [0, "rgba(139, 124, 255, 0.95)"],
      [1, "rgba(95, 77, 224, 0.96)"]
    ])
  ];
  button.strokes = [];
  if (combination.State === "ButtonDisabled") button.opacity = 0.72;
  await appendVariantText(button, `${key}/button/label`, "搜索", context, { font: context.fonts.bold, size: 13 });
  component.appendChild(button);
  component.description = `${variantName(combination)} · 420px reference at the CSS max; runtime width follows the header grid · radius 15px · input min-height 44px.`;
  return component;
}

async function createLoginFieldIcon(kind, key) {
  if (kind === "Visibility") {
    const icon = tag(
      figma.createNodeFromSvg(
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e7edff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.65"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>'
      ),
      key,
      "P3"
    );
    icon.name = "Visibility icon";
    icon.resize(22, 22);
    return icon;
  }
  const path =
    kind === "Password"
      ? "M7 10V8a5 5 0 0 1 10 0v2m-11 0h12a1 1 0 0 1 1 1v9H5v-9a1 1 0 0 1 1-1Zm6 4v3"
      : "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7 8a7 7 0 0 0-14 0";
  const icon = tag(
    figma.createNodeFromSvg(
      `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d1e0ff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.65"><path d="${path}"/></svg>`
    ),
    key,
    "P3"
  );
  icon.name = `${kind} icon`;
  icon.resize(20, 20);
  return icon;
}

async function createLoginFieldVariant(build, combination, context, key) {
  const component = tag(figma.createComponent(), key, "P3");
  component.name = variantName(combination);
  configureFixedAutoLayout(component, "HORIZONTAL", 360, 56, 12, context);
  component.primaryAxisAlignItems = "MIN";
  setLayoutNumber(component, "paddingRight", 14, context);
  setLayoutNumber(component, "paddingLeft", 14, context);
  component.fills = [
    gradientPaint(
      combination.State === "Focus"
        ? [
            [0, "rgba(94, 112, 132, 0.58)"],
            [1, "rgba(52, 65, 88, 0.66)"]
          ]
        : [
            [0, "rgba(82, 101, 116, 0.5)"],
            [1, "rgba(43, 55, 76, 0.58)"]
          ]
    )
  ];
  component.strokes = [
    solidPaint(combination.State === "Focus" ? "rgba(136, 191, 255, 0.72)" : "rgba(207, 222, 255, 0.18)")
  ];
  component.strokeWeight = 1;
  setRadius(component, 13);
  component.effects =
    combination.State === "Focus"
      ? [
          componentEffect("DROP_SHADOW", "rgba(104,143,255,0.13)", { x: 0, y: 0 }, 0, 3),
          componentEffect("DROP_SHADOW", "rgba(121,89,255,0.18)", { x: 0, y: 0 }, 24),
          componentEffect("INNER_SHADOW", "rgba(255,255,255,0.10)", { x: 0, y: 1 }, 0)
        ]
      : [
          componentEffect("INNER_SHADOW", "rgba(255,255,255,0.06)", { x: 0, y: 1 }, 0),
          componentEffect("DROP_SHADOW", "rgba(4,7,23,0.12)", { x: 0, y: 12 }, 30)
        ];
  component.appendChild(await createLoginFieldIcon(combination.Kind, `${key}/icon`));
  const placeholder = await appendVariantText(
    component,
    `${key}/placeholder`,
    combination.Kind === "Password" ? "登录密码" : "用户名或邮箱",
    context,
    { color: context.muted, fallback: "rgba(204, 216, 244, 0.52)", size: 16 }
  );
  placeholder.layoutSizingHorizontal = "FILL";
  if (combination.Kind === "Password") {
    const toggle = tag(figma.createFrame(), `${key}/toggle`, "P3");
    toggle.name = "Password visibility";
    configureFixedAutoLayout(toggle, "HORIZONTAL", 44, 44, 0, context);
    toggle.fills = [];
    toggle.strokes = [];
    toggle.appendChild(await createLoginFieldIcon("Visibility", `${key}/toggle/icon`));
    component.appendChild(toggle);
  }
  component.description = `${variantName(combination)} · width reference 360px; runtime width follows the login panel · min-height 56px · radius 13px · exact login-control context.`;
  return component;
}

async function createDialogVariant(build, combination, context, key) {
  const component = tag(figma.createComponent(), key, "P3");
  component.name = variantName(combination);
  configureFixedAutoLayout(component, "VERTICAL", 360, 112, 8, context);
  component.primaryAxisAlignItems = "MIN";
  component.counterAxisAlignItems = "MIN";
  setLayoutNumber(component, "paddingTop", 16, context);
  setLayoutNumber(component, "paddingRight", 16, context);
  setLayoutNumber(component, "paddingBottom", 16, context);
  setLayoutNumber(component, "paddingLeft", 16, context);
  component.fills = [];
  component.strokes = [bindColor(context.line, "rgba(221, 228, 255, 0.16)")];
  component.strokeWeight = 1;
  component.dashPattern = [6, 4];
  setRadius(component, 12, context.radiusSmall);
  const prompts = {
    History: "确定要清空播放记录吗",
    Favorites: "确定要清空收藏记录吗",
    Device: "确定要将设备踢下线吗？"
  };
  await appendVariantText(component, `${key}/title`, "Browser / OS confirm()", context, {
    font: context.fonts.bold,
    size: 14
  });
  await appendVariantText(component, `${key}/body`, prompts[combination.UseCase], context, {
    color: context.muted,
    fallback: "#9da6bd",
    size: 12
  });
  await appendVariantText(component, `${key}/note`, "Reference only · visual appearance is browser/OS owned", context, {
    color: context.accent2,
    fallback: "#6ee7f9",
    size: 10
  });
  component.description = `REFERENCE ONLY · ${variantName(combination)} · current code calls confirm()/window.confirm; no themed dialog exists.`;
  return component;
}

async function createNoticeVariant(build, combination, context, key) {
  const component = tag(figma.createComponent(), key, "P3");
  component.name = variantName(combination);
  configureHugAutoLayout(component, "HORIZONTAL", null, 8, context);
  setLayoutNumber(component, "paddingTop", 11, context);
  setLayoutNumber(component, "paddingRight", 18, context);
  setLayoutNumber(component, "paddingBottom", 11, context);
  setLayoutNumber(component, "paddingLeft", 18, context);
  const isError = combination.Tone === "Error";
  component.fills = [solidPaint("rgba(25, 27, 31, 0.96)")];
  component.strokes = [
    bindColor(isError ? context.lineWarmStrong : context.lineAccentStrong, isError ? "rgba(170, 117, 255, 0.56)" : "rgba(110, 231, 249, 0.54)")
  ];
  component.strokeWeight = 1;
  setRadius(component, 18, context.radius);
  component.effects = [componentEffect("DROP_SHADOW", "rgba(0,0,0,0.32)", { x: 0, y: 14 }, 34)];
  await appendVariantText(component, `${key}/label`, isError ? "操作失败，请稍后重试" : "操作成功", context, { size: 13 });
  component.description = `${variantName(combination)} · hug width with max-width min(520px, 100vw - 32px) at runtime · visible for 2400ms.`;
  return component;
}

async function createQualityBadgeVariant(build, combination, context, key) {
  const component = tag(figma.createComponent(), key, "P3");
  component.name = variantName(combination);
  configureHugAutoLayout(component, "HORIZONTAL", 28, 4, context);
  setLayoutNumber(component, "paddingRight", 9, context);
  setLayoutNumber(component, "paddingLeft", 9, context);
  const style = stateStyle(context, combination.State);
  configureSurface(component, style.fill, style.fillFallback, style.stroke, style.strokeFallback, null, 999);
  if (combination.State === "Recommended") {
    component.effects = [componentEffect("DROP_SHADOW", "rgba(139,124,255,0.24)", { x: 0, y: 8 }, 18)];
  }
  const labels = {
    Loading: "检测中…",
    Available: "可用",
    Slow: "可用但较慢",
    Failed: "不可用",
    Timeout: "检测超时",
    Unsupported: "无法直测",
    Missing: "缺少该集",
    Recommended: "推荐 · 可用"
  };
  await appendVariantText(component, `${key}/label`, labels[combination.State], context, {
    color: style.text,
    fallback: style.textFallback,
    size: 12
  });
  component.description = `${variantName(combination)} · source-quality-result state from style.css/app.js.`;
  return component;
}

async function createCardQualityBadgeVariant(build, combination, context, key) {
  const component = tag(figma.createComponent(), key, "P3");
  component.name = variantName(combination);
  configureHugAutoLayout(component, "HORIZONTAL", null, 0, context);
  setLayoutNumber(component, "paddingTop", 6, context);
  setLayoutNumber(component, "paddingRight", 9, context);
  setLayoutNumber(component, "paddingBottom", 6, context);
  setLayoutNumber(component, "paddingLeft", 9, context);
  component.fills = [solidPaint("rgba(0, 0, 0, 0.72)")];
  component.strokes = [];
  setRadius(component, 999);
  await appendVariantText(component, `${key}/label`, "高清", context, { size: 12 });
  component.description = "Visible · .poster .quality-badge · content comes from vod_remarks; the node is not rendered when vod_remarks is empty.";
  return component;
}

async function createBuildVariant(build, combination, context, key) {
  const name = variantName(combination);
  const missing = build.notImplementedVariants.includes(name);
  if (build.id === "action-button") return createActionButtonVariant(build, combination, context, key, missing);
  if (build.id === "action-favorite-button") return createFavoriteButtonVariant(build, combination, context, key);
  if (build.id === "action-login-submit") return createLoginSubmitVariant(build, combination, context, key);
  if (build.id === "form-header-search") return createHeaderSearchVariant(build, combination, context, key);
  if (build.id === "form-login-field") return createLoginFieldVariant(build, combination, context, key);
  if (build.id === "feedback-dialog") return createDialogVariant(build, combination, context, key);
  if (build.id === "feedback-notice") return createNoticeVariant(build, combination, context, key);
  if (build.id === "tag-quality-badge") return createQualityBadgeVariant(build, combination, context, key);
  if (build.id === "media-card-quality-badge") return createCardQualityBadgeVariant(build, combination, context, key);
  throw new Error(`No component builder for ${build.id}`);
}

function componentGridLayout(build) {
  const layouts = {
    "action-button": { columns: 4, columnWidth: 230, rowHeight: 84 },
    "action-favorite-button": { columns: 3, columnWidth: 230, rowHeight: 84 },
    "action-login-submit": { columns: 3, columnWidth: 350, rowHeight: 98 },
    "form-header-search": { columns: 2, columnWidth: 460, rowHeight: 84 },
    "form-login-field": { columns: 2, columnWidth: 400, rowHeight: 90 },
    "feedback-dialog": { columns: 3, columnWidth: 400, rowHeight: 140 },
    "feedback-notice": { columns: 2, columnWidth: 360, rowHeight: 80 },
    "tag-quality-badge": { columns: 4, columnWidth: 260, rowHeight: 68 },
    "media-card-quality-badge": { columns: 1, columnWidth: 200, rowHeight: 70 }
  };
  return layouts[build.id] || { columns: 4, columnWidth: 260, rowHeight: 110 };
}

const LEGACY_COMPONENT_REVISION = "source-visual-v2.1";

function componentVariantValue(component, property) {
  if (component.variantProperties && component.variantProperties[property]) return component.variantProperties[property];
  const match = String(component.name).match(new RegExp(`(?:^|,\\s*)${property}=([^,]+)`));
  return match ? match[1].trim() : "";
}

function legacyChangeToReaction(destinationId, trigger, duration = 0.18) {
  return {
    trigger: { type: trigger },
    actions: [
      {
        type: "NODE",
        destinationId,
        navigation: "CHANGE_TO",
        transition: {
          type: "SMART_ANIMATE",
          easing: { type: "EASE_OUT" },
          duration
        },
        resetScrollPosition: false
      }
    ]
  };
}

async function wireLegacyComponentReactions(componentSet, build) {
  const components = componentSet.children.filter((node) => node.type === "COMPONENT");
  const sibling = (component, overrides) =>
    components.find((candidate) =>
      Object.entries({ ...(component.variantProperties || {}), ...overrides }).every(
        ([property, value]) => componentVariantValue(candidate, property) === value
      )
    );
  for (const component of components) {
    const state = componentVariantValue(component, "State");
    const reactions = [];
    if (build.id === "action-button" && state === "Default") {
      const hover = sibling(component, { State: "Hover" });
      if (hover) reactions.push(legacyChangeToReaction(hover.id, "ON_HOVER"));
    } else if (build.id === "action-favorite-button" && state === "Default") {
      const loading = sibling(component, { State: "Loading" });
      if (loading) reactions.push(legacyChangeToReaction(loading.id, "ON_CLICK"));
    } else if (build.id === "action-login-submit") {
      if (state === "Default") {
        const hover = sibling(component, { State: "Hover" });
        if (hover) reactions.push(legacyChangeToReaction(hover.id, "ON_HOVER"));
      }
      if (state === "Default" || state === "Hover") {
        const loading = sibling(component, { State: "Loading" });
        if (loading) reactions.push(legacyChangeToReaction(loading.id, "ON_CLICK"));
      }
    } else if (build.id === "form-header-search" && state === "Default") {
      const focus = sibling(component, { State: "Focus" });
      if (focus) reactions.push(legacyChangeToReaction(focus.id, "ON_CLICK"));
    } else if (build.id === "form-login-field" && state === "Default") {
      const focus = sibling(component, { State: "Focus" });
      if (focus) reactions.push(legacyChangeToReaction(focus.id, "ON_CLICK"));
    }
    await component.setReactionsAsync(reactions);
  }
}

async function componentReactionCount(component) {
  if ("getReactionsAsync" in component) return (await component.getReactionsAsync()).length;
  return Array.isArray(component.reactions) ? component.reactions.length : 0;
}

function componentVisualSignature(component) {
  return JSON.stringify({
    fills: component.fills,
    strokes: component.strokes,
    strokeWeight: component.strokeWeight,
    effects: component.effects,
    opacity: component.opacity
  });
}

async function buildComponentFamily(componentId) {
  await requireP1Complete();
  await requireP2Complete();
  const build = PLAN.componentBuilds.find((item) => item.id === componentId);
  if (!build) throw new Error(`Unknown component build: ${componentId}`);
  const { page } = await ensurePlannedPage("02 · Components");
  assertMutableTargetPage(page);
  await figma.setCurrentPageAsync(page);
  const context = await docContext();
  const key = `p3/component/${build.id}`;
  const foreignSet = page.findAll((node) => node.type === "COMPONENT_SET" && node.name === build.name && !isOwned(node))[0];
  if (foreignSet) {
    throw new Error(`Component set "${build.name}" already exists without this baseline tag. Reuse or rename it manually before building.`);
  }
  const root = await ensureOwnedReferenceRoot(page, key, `${build.name} / Current Code`, "P3", context);
  bindReferenceRootSpacing(root, context);
  root.fills = [bindColor(context.canvas, "#05070d")];
  await addOwnedText(root, `${key}/title`, build.name, context, {
    font: context.fonts.bold,
    size: 32,
    width: 1312,
    phase: "P3"
  });
  await addOwnedText(
    root,
    `${key}/intro`,
    [
      `Source-backed variants: ${build.variantCount}.`,
      `Evidence: ${Object.entries(build.stateEvidence)
        .map(([state, values]) => `${state}=${values.length ? values.join(" + ") : "Not implemented in current code"}`)
        .join(" · ")}`,
      `Explicit gaps: ${build.notImplemented.length ? build.notImplemented.join(", ") : "none"}`
    ].join("\n"),
    context,
    {
      color: context.muted,
      fallback: "#9da6bd",
      size: 12,
      width: 1312,
      phase: "P3"
    }
  );

  const holder = tag(figma.createFrame(), `${key}/holder`, "P3");
  holder.name = `${build.name} / Variant Holder`;
  holder.fills = [];
  const combinations = variantCombinations(build);
  const layout = componentGridLayout(build);
  const columns = Math.min(layout.columns, combinations.length);
  const columnWidth = layout.columnWidth;
  const rowHeight = layout.rowHeight;
  const rows = Math.ceil(combinations.length / columns);
  holder.resize(Math.min(1312, columns * columnWidth), rows * rowHeight);
  root.appendChild(holder);

  const components = [];
  for (let index = 0; index < combinations.length; index += 1) {
    const combination = combinations[index];
    const component = await createBuildVariant(build, combination, context, `${key}/variant/${variantName(combination)}`);
    holder.appendChild(component);
    component.x = (index % columns) * columnWidth;
    component.y = Math.floor(index / columns) * rowHeight;
    components.push(component);
  }
  const componentSet = tag(figma.combineAsVariants(components, holder), `${key}/set`, "P3");
  componentSet.name = build.name;
  componentSet.description = `${build.referenceOnly ? "REFERENCE ONLY · " : ""}Current source ${SOURCE_REFERENCE}. Missing states are explicitly labeled.`;
  componentSet.setSharedPluginData(NS, "component_revision", LEGACY_COMPONENT_REVISION);
  componentSet.children.forEach((component, index) => {
    component.x = (index % columns) * columnWidth;
    component.y = Math.floor(index / columns) * rowHeight;
  });
  componentSet.resize(columns * columnWidth, rows * rowHeight);
  componentSet.x = 0;
  componentSet.y = 0;
  holder.resize(Math.max(holder.width, componentSet.width), Math.max(holder.height, componentSet.height));
  await wireLegacyComponentReactions(componentSet, build);

  figma.currentPage.selection = [componentSet];
  figma.viewport.scrollAndZoomIntoView([componentSet]);
  figma.commitUndo();
  return [
    "P3 COMPONENT APPLIED",
    `family=${build.name}`,
    `set=${componentSet.id}`,
    `variants=${componentSet.children.length}/${build.variantCount}`,
    `referenceOnly=${Boolean(build.referenceOnly)}`
  ].join("\n");
}

async function validateComponentFamily(componentId) {
  const build = PLAN.componentBuilds.find((item) => item.id === componentId);
  if (!build) throw new Error(`Unknown component build: ${componentId}`);
  const pagePlan = pagePlanByName("02 · Components");
  const page = findPlannedPage(pagePlan);
  if (!page) return `P3 VALIDATION · PENDING\nmissing page=${pagePlan.name}`;
  await page.loadAsync();
  const root = page.children.find((node) => entityKey(node) === `p3/component/${build.id}`);
  const sets = page.findAll((node) => node.type === "COMPONENT_SET" && entityKey(node) === `p3/component/${build.id}/set`);
  const issues = [];
  if (!root) {
    issues.push("owned component root missing");
  } else {
    if (root.height <= 1) issues.push("owned component root height is clipped");
    if (root.clipsContent) issues.push("owned component root clips content");
  }
  if (sets.length !== 1) issues.push(`owned component set count ${sets.length}/1`);
  const set = sets[0];
  if (set) {
    if (set.name !== build.name) issues.push(`name ${set.name}/${build.name}`);
    if (set.children.length !== build.variantCount) issues.push(`variants ${set.children.length}/${build.variantCount}`);
    const names = new Set(set.children.map((component) => component.name));
    for (const combination of variantCombinations(build)) {
      const name = variantName(combination);
      if (!names.has(name)) issues.push(`missing variant ${name}`);
    }
    if (set.getSharedPluginData(NS, "component_revision") !== LEGACY_COMPONENT_REVISION) {
      issues.push("component visual revision is stale");
    }
    const expectedReactionCounts = {
      "action-button": 2,
      "action-favorite-button": 1,
      "action-login-submit": 3,
      "form-header-search": 1,
      "form-login-field": 2
    };
    if (Object.prototype.hasOwnProperty.call(expectedReactionCounts, build.id)) {
      let reactionCount = 0;
      for (const component of set.children) reactionCount += await componentReactionCount(component);
      if (reactionCount !== expectedReactionCounts[build.id]) {
        issues.push(`reactions ${reactionCount}/${expectedReactionCounts[build.id]}`);
      }
    }
    if (build.id === "action-button" || build.id === "action-login-submit") {
      const styles = build.id === "action-button" ? ["Primary", "Ghost"] : [null];
      for (const style of styles) {
        const defaultVariant = set.children.find(
          (component) =>
            componentVariantValue(component, "State") === "Default" &&
            (!style || componentVariantValue(component, "Style") === style)
        );
        const hoverVariant = set.children.find(
          (component) =>
            componentVariantValue(component, "State") === "Hover" &&
            (!style || componentVariantValue(component, "Style") === style)
        );
        if (
          defaultVariant &&
          hoverVariant &&
          componentVisualSignature(defaultVariant) === componentVisualSignature(hoverVariant)
        ) {
          issues.push(`${style || "LoginSubmit"} Default and Hover visuals are identical`);
        }
      }
    }
  }
  return [
    `P3 VALIDATION · ${issues.length ? "FAIL" : "PASS"}`,
    `family=${build.name}`,
    `issues=${issues.length}`,
    ...(issues.length ? issues.map((issue) => `- ${issue}`) : ["- none"])
  ].join("\n");
}

async function applyNextComponentFamily() {
  const pagePlan = pagePlanByName("02 · Components");
  const page = findPlannedPage(pagePlan);
  if (page) await page.loadAsync();
  for (const build of PLAN.componentBuilds) {
    const rootKey = `p3/component/${build.id}`;
    const setKey = `${rootKey}/set`;
    const root = page && page.children.find((node) => entityKey(node) === rootKey);
    const sets = page ? page.findAll((node) => node.type === "COMPONENT_SET" && entityKey(node) === setKey) : [];
    const setExists = sets.length === 1;
    const revisionCurrent = setExists && sets[0].getSharedPluginData(NS, "component_revision") === LEGACY_COMPONENT_REVISION;
    if (!root || root.height <= 1 || root.clipsContent || !setExists || !revisionCurrent) return buildComponentFamily(build.id);
  }
  return "P3 COMPONENTS COMPLETE\nNo pending component family.";
}

async function applyPageStructure(name) {
  await requireP1Complete();
  const result = await ensurePlannedPage(name);
  assertMutableTargetPage(result.page);
  result.page.setSharedPluginData(NS, "p2_structure", RUN_ID);
  await figma.setCurrentPageAsync(result.page);
  figma.currentPage.selection = [];
  figma.commitUndo();
  return [
    "P2 STRUCTURE APPLIED",
    `page=${result.page.name} · ${result.page.id}`,
    `operation=${result.pagePlan.operation}`,
    `created=${result.created}`,
    `renamedFrom=${result.renamedFrom || "none"}`,
    "No page content was deleted or moved."
  ].join("\n");
}

async function applyNextPageStructure() {
  for (const pagePlan of PLAN.pages) {
    const page = findPlannedPage(pagePlan);
    if (!page || page.name !== pagePlan.name || page.getSharedPluginData(NS, "p2_structure") !== RUN_ID) {
      return applyPageStructure(pagePlan.name);
    }
  }
  return "P2 STRUCTURE COMPLETE\nNo pending page operation.";
}

async function applyNextDocumentation() {
  for (const name of DOC_PAGE_NAMES) {
    const pagePlan = pagePlanByName(name);
    const page = findPlannedPage(pagePlan);
    if (!page) return renderDocumentationPage(name);
    await page.loadAsync();
    const key = `p2/docs/${name}`;
    const root = page.children.find((node) => entityKey(node) === key);
    if (!root) return renderDocumentationPage(name);
    if (root.height <= 1 || root.clipsContent) return renderDocumentationPage(name);
    const model = documentationModel(name);
    const items = [...model.items, ...(await dynamicDocumentationItems(name))];
    const expectedItems = items.length;
    const actualItems = root.children.filter((node) => entityKey(node).startsWith(`${key}/item/`)).length;
    if (actualItems !== expectedItems) return renderDocumentationPage(name);
    if (root.getSharedPluginData(NS, "documentation_signature") !== documentationSignature(name, model, items)) {
      return renderDocumentationPage(name);
    }
  }
  return "P2 DOCUMENTATION COMPLETE\nNo pending documentation page.";
}

async function validateP2() {
  await assertTargetFile();
  const pending = [];
  const conflicts = [];
  for (const pagePlan of PLAN.pages) {
    const canonical = figma.root.children.filter((page) => page.name === pagePlan.name);
    if (canonical.length > 1) conflicts.push(`duplicate page ${pagePlan.name}`);
    if (!canonical.length) {
      const legacy = figma.root.children.find((page) => pageAliases(pagePlan).includes(page.name));
      pending.push(`${pagePlan.name}${legacy ? ` · legacy=${legacy.name}` : " · missing"}`);
    }
  }
  for (const name of DOC_PAGE_NAMES) {
    const page = figma.root.children.find((item) => item.name === name);
    if (!page) {
      pending.push(`${name} · documentation page pending`);
      continue;
    }
    await page.loadAsync();
    const rootKey = `p2/docs/${name}`;
    const root = page.children.find((node) => entityKey(node) === rootKey);
    if (!root) {
      pending.push(`${name} · documentation root pending`);
      continue;
    }
    if (root.height <= 1) conflicts.push(`${name} · documentation root height is clipped`);
    if (root.clipsContent) conflicts.push(`${name} · documentation root clips content`);
    const model = documentationModel(name);
    const items = [...model.items, ...(await dynamicDocumentationItems(name))];
    const expectedItems = items.length;
    const actualItems = root.children.filter((node) => entityKey(node).startsWith(`${rootKey}/item/`)).length;
    if (actualItems !== expectedItems) {
      conflicts.push(`${name} · documentation items ${actualItems}/${expectedItems}`);
    }
    if (root.getSharedPluginData(NS, "documentation_signature") !== documentationSignature(name, model, items)) {
      conflicts.push(`${name} · documentation content signature is stale`);
    }
  }
  for (const protectedName of ["20 · Production Prototype", "92 · Raw Evidence · html.to.design · 2026-07-28"]) {
    const pagePlan = pagePlanByName(protectedName);
    const page = findPlannedPage(pagePlan);
    if (!page) {
      conflicts.push(`protected page missing ${protectedName}`);
      continue;
    }
    await page.loadAsync();
    if (page.children.length === 0) conflicts.push(`protected page empty ${page.name}`);
  }
  const status = conflicts.length ? "FAIL" : pending.length ? "PENDING" : "PASS";
  return [
    `P2 VALIDATION · ${status}`,
    `conflicts=${conflicts.length}`,
    ...conflicts.map((item) => `- CONFLICT · ${item}`),
    `pending=${pending.length}`,
    ...pending.map((item) => `- PENDING · ${item}`)
  ].join("\n");
}

async function renderCoverageIndex(pageName) {
  await requireP1Complete();
  await requireP2Complete();
  await requireP3Complete();
  if (!COVERAGE_PAGE_NAMES.includes(pageName)) throw new Error(`Unsupported coverage page: ${pageName}`);
  const archetypes = PLAN.archetypes.filter((item) => item.figmaPage === pageName);
  if (!archetypes.length) throw new Error(`No archetypes mapped to ${pageName}`);
  const { page } = await ensurePlannedPage(pageName);
  assertMutableTargetPage(page);
  await figma.setCurrentPageAsync(page);
  const context = await docContext();
  const key = `p4/coverage/${pageName}`;
  const root = await ensureOwnedReferenceRoot(page, key, `${pageName} / Coverage Index`, "P4", context);
  bindReferenceRootSpacing(root, context);
  root.fills = [bindColor(context.canvas, "#05070d")];
  await addOwnedText(root, `${key}/title`, `${pageName} · Current Code Coverage`, context, {
    font: context.fonts.bold,
    size: 36,
    width: 1312,
    phase: "P4"
  });
  await addOwnedText(
    root,
    `${key}/intro`,
    "These editable implementation cards document purpose, route, components, data, templates, and the full required state matrix. Existing visual frames remain untouched. Missing visual/state references are explicitly labeled rather than invented.",
    context,
    {
      color: context.muted,
      fallback: "#9da6bd",
      size: 13,
      width: 1312,
      phase: "P4"
    }
  );
  for (let index = 0; index < archetypes.length; index += 1) {
    root.appendChild(await createDocCard(context, `${key}/archetype/${archetypes[index].id}`, archetypeCard(archetypes[index]), "P4"));
  }
  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
  figma.commitUndo();
  return `P4 COVERAGE APPLIED\npage=${page.name} · ${page.id}\nroot=${root.id}\narchetypes=${archetypes.length}`;
}

async function validateCoverageIndex(pageName) {
  if (!COVERAGE_PAGE_NAMES.includes(pageName)) throw new Error(`Unsupported coverage page: ${pageName}`);
  const pagePlan = pagePlanByName(pageName);
  const page = findPlannedPage(pagePlan);
  if (!page) return `P4 VALIDATION · PENDING\nmissing page=${pageName}`;
  await page.loadAsync();
  const key = `p4/coverage/${pageName}`;
  const roots = page.children.filter((node) => entityKey(node) === key);
  const expected = PLAN.archetypes.filter((item) => item.figmaPage === pageName);
  const issues = [];
  if (roots.length !== 1) issues.push(`coverage root count ${roots.length}/1`);
  if (roots[0]) {
    if (roots[0].height <= 1) issues.push("coverage root height is clipped");
    if (roots[0].clipsContent) issues.push("coverage root clips content");
    for (const archetype of expected) {
      const archetypeKey = `${key}/archetype/${archetype.id}`;
      if (!roots[0].children.some((node) => entityKey(node) === archetypeKey)) {
        issues.push(`missing ${archetype.id}`);
      }
    }
  }
  return [
    `P4 VALIDATION · ${issues.length ? "FAIL" : "PASS"}`,
    `page=${pageName}`,
    `archetypes=${expected.length}`,
    `issues=${issues.length}`,
    ...(issues.length ? issues.map((issue) => `- ${issue}`) : ["- none"])
  ].join("\n");
}

async function applyNextCoverage() {
  for (const pageName of COVERAGE_PAGE_NAMES) {
    const pagePlan = pagePlanByName(pageName);
    const page = findPlannedPage(pagePlan);
    if (!page) return renderCoverageIndex(pageName);
    await page.loadAsync();
    const key = `p4/coverage/${pageName}`;
    const root = page.children.find((node) => entityKey(node) === key);
    if (!root) return renderCoverageIndex(pageName);
    if (root.height <= 1 || root.clipsContent) return renderCoverageIndex(pageName);
    const expected = PLAN.archetypes.filter((item) => item.figmaPage === pageName).length;
    const actual = root.children.filter((node) => entityKey(node).startsWith(`${key}/archetype/`)).length;
    if (actual !== expected) return renderCoverageIndex(pageName);
  }
  return "P4 COVERAGE COMPLETE\nNo pending page family.";
}

function boxesOverlap(left, right) {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
}

function isFormalFlowTargetClone(node, page) {
  const topLevel = topLevelAncestor(node, page);
  return Boolean(topLevel && entityKey(topLevel).startsWith("p5/formal/user-flows/target/"));
}

async function finalQa() {
  await assertTargetFile();
  const pending = [];
  const issues = [];
  const warnings = [];
  const pageNames = figma.root.children.map((page) => page.name);
  if (new Set(pageNames).size !== pageNames.length) issues.push("duplicate page names");

  let componentSets = 0;
  let components = 0;
  let drawerOpen = 0;
  let drawerHotspots = 0;
  let connectedDrawerHotspots = 0;
  const formalComponentNames = new Set();
  for (const page of figma.root.children) {
    await page.loadAsync();
    const sets = page.findAll((node) => node.type === "COMPONENT_SET");
    sets.forEach((node) => formalComponentNames.add(node.name.split("/").pop()));
    page.findAll((node) => node.type === "COMPONENT").forEach((node) => formalComponentNames.add(node.name.split("/").pop()));
    componentSets += sets.length;
    components += page.findAll((node) => node.type === "COMPONENT").length;
    const drawerNodes = page.findAll((node) => node.name === "Drawer / Open" && !isFormalFlowTargetClone(node, page));
    const hotspotNodes = page.findAll((node) => node.name === "Hotspot / Open Drawer" && !isFormalFlowTargetClone(node, page));
    drawerOpen += drawerNodes.length;
    drawerHotspots += hotspotNodes.length;
    connectedDrawerHotspots += hotspotNodes.filter((node) => "reactions" in node && node.reactions.length > 0).length;

    const ownedUnnamed = page.findAll((node) => node.getSharedPluginData(NS, "run_id") === RUN_ID && (!node.name || !node.name.trim()));
    if (ownedUnnamed.length) issues.push(`${page.name} has ${ownedUnnamed.length} unnamed baseline nodes`);

    const topLevel = page.children.filter((node) => node.absoluteBoundingBox);
    const ownedRoots = topLevel.filter((node) => node.getSharedPluginData(NS, "run_id") === RUN_ID);
    const foreignRoots = topLevel.filter((node) => node.getSharedPluginData(NS, "run_id") !== RUN_ID);
    for (const owned of ownedRoots) {
      const key = entityKey(owned);
      const isReferenceRoot =
        key === "page/themes/root" ||
        key.startsWith("p2/docs/") ||
        /^p3\/component\/[^/]+$/.test(key) ||
        key.startsWith("p4/coverage/") ||
        key.startsWith("p5/formal/");
      if (isReferenceRoot && owned.height <= 1) issues.push(`${page.name} clipped reference root: ${owned.name}`);
      if (isReferenceRoot && owned.clipsContent) issues.push(`${page.name} reference root clips content: ${owned.name}`);
      for (const foreign of foreignRoots) {
        if (boxesOverlap(owned.absoluteBoundingBox, foreign.absoluteBoundingBox)) {
          issues.push(`${page.name} overlap: ${owned.name} ↔ ${foreign.name}`);
        }
      }
    }
    if (page.name === "02 · Components") {
      const archivePage = figma.root.children.find((item) => item.name.startsWith("91 · Archive · Next.js"));
      if (archivePage) await archivePage.loadAsync();
      const legacyRoot = findLegacyComponentsRoot(page) || (archivePage ? findLegacyComponentsRoot(archivePage) : null);
      if (!legacyRoot || !("children" in legacyRoot)) {
        issues.push("historical component catalog reference missing");
      } else {
        if (legacyRoot.parent === page) issues.push("historical component catalog remains on the current Components page");
        const layoutProblems = componentLayoutProblems(legacyRoot);
        for (const problem of layoutProblems) {
          if (problem.type === "escaped" || problem.type === "nested-escaped") {
            issues.push(`historical component catalog overflow: ${problem.child.name} has ${problem.escaped.length} out-of-bounds descendants`);
          } else {
            issues.push(`historical component catalog overlap: ${problem.first.name} ↔ ${problem.second.name}`);
          }
        }
        const rankBoardCard = legacyRoot.children.find((node) => node.name === "Showcase/Home/RankBoard");
        const desktopRankBoard =
          rankBoardCard && "findOne" in rankBoardCard ? rankBoardCard.findOne((node) => node.visible && node.name === "Viewport=Desktop") : null;
        const rankItems =
          desktopRankBoard && "findAll" in desktopRankBoard ? desktopRankBoard.findAll((node) => node.visible && /^Rank Item \d+$/.test(node.name)) : [];
        const rankList = rankItems.length ? rankItems[0].parent : null;
        if (rankItems.length !== 5) {
          issues.push(`historical RankBoard desktop columns ${rankItems.length}/5`);
        } else {
          if (!rankList || !("layoutMode" in rankList) || rankList.layoutMode !== "HORIZONTAL" || rankList.itemSpacing !== 10) {
            issues.push("historical RankBoard desktop grid must be horizontal with a 10px gap");
          }
          if (rankItems.some((node) => !("layoutSizingHorizontal" in node) || node.layoutSizingHorizontal !== "FILL")) {
            issues.push("historical RankBoard desktop columns must use equal fill sizing");
          }
          const rankWidths = rankItems.map((node) => node.width);
          if (Math.max(...rankWidths) - Math.min(...rankWidths) > 1) {
            issues.push("historical RankBoard desktop column widths are unequal");
          }
          if (
            rankItems.some((rankItem) => {
              const title = "children" in rankItem ? rankItem.children.find((node) => node.type === "TEXT" && node.name === "Item Title") : null;
              return !title || !("layoutSizingHorizontal" in title) || title.layoutSizingHorizontal !== "FILL";
            })
          ) {
            issues.push("historical RankBoard titles must fill the remaining column width");
          }
        }
      }
    }
  }
  for (const componentName of PLAN.existingFigmaComponents) {
    if (!formalComponentNames.has(componentName)) issues.push(`existing component missing ${componentName}`);
  }

  for (const pagePlan of PLAN.pages) {
    if (!figma.root.children.some((page) => page.name === pagePlan.name)) pending.push(`page ${pagePlan.name}`);
  }
  for (const name of DOC_PAGE_NAMES) {
    const page = figma.root.children.find((item) => item.name === name);
    if (!page || !page.children.some((node) => entityKey(node) === `p2/docs/${name}`)) pending.push(`documentation ${name}`);
  }
  for (const build of PLAN.componentBuilds) {
    const page = figma.root.children.find((item) => item.name === "02 · Components");
    const set = page && page.findAll((node) => node.type === "COMPONENT_SET" && entityKey(node) === `p3/component/${build.id}/set`)[0];
    if (!set) {
      pending.push(`component ${build.name}`);
      continue;
    }
    if (set.children.length !== build.variantCount) issues.push(`${build.name} variants ${set.children.length}/${build.variantCount}`);
    const minimumHeight = {
      "action-button": 44,
      "action-favorite-button": 44,
      "action-login-submit": 58,
      "form-header-search": 44,
      "form-login-field": 56
    }[build.id];
    if (minimumHeight && set.children.some((component) => component.height < minimumHeight)) {
      issues.push(`${build.name} has a control below ${minimumHeight}px`);
    }
  }
  for (const pageName of COVERAGE_PAGE_NAMES) {
    const page = figma.root.children.find((item) => item.name === pageName);
    if (!page || !page.children.some((node) => entityKey(node) === `p4/coverage/${pageName}`)) {
      pending.push(`coverage ${pageName}`);
    }
  }

  for (const protectedName of ["20 · Production Prototype", "92 · Raw Evidence · html.to.design · 2026-07-28"]) {
    const page = figma.root.children.find((item) => item.name === protectedName);
    if (!page) {
      pending.push(`protected evidence ${protectedName}`);
    } else if (!page.children.length) {
      issues.push(`protected evidence page empty ${protectedName}`);
    }
  }

  if (!drawerOpen) issues.push("Drawer / Open reference missing");
  if (!drawerHotspots) issues.push("Hotspot / Open Drawer missing");
  if (drawerHotspots && !connectedDrawerHotspots) issues.push("drawer hotspot has no prototype reaction");
  const minimumComponentSets = 12 + PLAN.componentBuilds.length;
  if (componentSets < minimumComponentSets) pending.push(`formal component sets ${componentSets}/${minimumComponentSets}`);
  if (PLAN.integrationStatus.codeConnectIncludedInCurrentPhase && PLAN.integrationStatus.codeConnect.startsWith("Not published:")) {
    warnings.push("Code Connect remains explicitly unpublished; no mapping is claimed.");
  }

  const p1 = await validateP1();
  if (!p1.startsWith("P1 VALIDATION · PASS")) pending.push("P1 variables/themes");
  const p2 = await validateP2();
  if (p2.startsWith("P2 VALIDATION · FAIL")) {
    issues.push("P2 structure/documentation validation failed");
  } else if (!p2.startsWith("P2 VALIDATION · PASS")) {
    pending.push("P2 structure/documentation");
  }
  const p5 = await validateP5();
  if (p5.startsWith("P5 VALIDATION · FAIL")) {
    issues.push("P5 formal project prototype validation failed");
  } else if (!p5.startsWith("P5 VALIDATION · PASS")) {
    pending.push("P5 formal project prototype");
  }
  const v2 = await validateAllV2Prototypes();
  if (v2.startsWith("V2 ALL PROTOTYPES · FAIL")) {
    issues.push("V2 default-theme prototype validation failed");
  } else if (!v2.startsWith("V2 ALL PROTOTYPES · PASS")) {
    pending.push("V2 default-theme A01–A30 prototypes");
  }
  const status = issues.length ? "FAIL" : pending.length ? "PENDING" : "PASS";
  return [
    `FINAL QA · ${status}`,
    `pages=${figma.root.children.length}`,
    `componentSets=${componentSets}`,
    `components=${components}`,
    `drawerOpen=${drawerOpen}`,
    `drawerHotspots=${drawerHotspots}`,
    `connectedDrawerHotspots=${connectedDrawerHotspots}`,
    `issues=${issues.length}`,
    ...issues.map((issue) => `- ISSUE · ${issue}`),
    `pending=${pending.length}`,
    ...pending.map((item) => `- PENDING · ${item}`),
    `warnings=${warnings.length}`,
    ...warnings.map((warning) => `- NOTE · ${warning}`)
  ].join("\n");
}

function themeDocumentation(theme) {
  const documentation = {
    "liquid-cinema": {
      coverage: "FULL PROTOTYPE",
      composites:
        "cinema-canvas / cinema-glass / cinema-glass-soft / cinema-glass-shadow / focus-ring / selected-shadow / login-canvas",
      layout:
        "Default product geometry. --wrap=min(1480px, 100vw - 56px); glass hero, rank, shelves, detail and player layouts are the canonical A01–A30 implementation.",
      assets: "Shared brand and UI assets. No theme-exclusive SVG.",
      sources: "template/pingfangvideo/css/style.css:5896+ · html/public/head.html · js/app.js"
    },
    "blue-pink-purple": {
      coverage: "DOCUMENTATION ONLY",
      composites:
        "Aurora cinema-canvas; cyan/pink/purple glass gradients; multi-layer shadow, selected-shadow, focus-field-shadow and focus-ring.",
      layout: "Keeps default geometry; changes material, glow, border and accent treatment. aurora-glass is an alias, not an exposed product choice.",
      assets: "No theme-exclusive SVG; shared brand assets remain unchanged.",
      sources: "template/pingfangvideo/css/style.css:38–78, 5950+ · html/public/head.html · js/app.js"
    },
    "poster-magazine": {
      coverage: "DOCUMENTATION ONLY",
      composites:
        "cyan → pink → violet action gradient; poster cinema-canvas/glass; 32px/96px deep shadow; shimmer overlay on shelf cards.",
      layout:
        "Distinct hero two-column editorial grid; rank becomes a vertical side panel; shelf uses four columns and the first card spans two columns. Tablet/mobile rules remain source-defined.",
      assets: "No theme-exclusive SVG; layout and CSS composites create the identity.",
      sources: "template/pingfangvideo/css/style.css:4603–5030 · html/public/head.html · js/app.js"
    },
    "dunhuang-caisson": {
      coverage: "DOCUMENTATION ONLY",
      composites:
        "Warm ink/brocade surfaces; gold and cinnabar borders; fixed-color decorative layers; compact 7px/5px radius system.",
      layout:
        "Uses caisson frame, channel vault, pearl/rosette/vine bands and wave-cloud corners. Decorations change at desktop/mobile breakpoints; content hierarchy remains code-owned.",
      assets:
        "caisson-frame.svg · caisson-frame-mobile.svg · channel-vault.svg · emblem.svg · pearl-band.svg · rosette-divider.svg · scrolling-vine-band.svg · wave-cloud-corner.svg. Fixed source colors; not currentColor.",
      sources: "template/pingfangvideo/css/style.css · template/pingfangvideo/images/dunhuang/*.svg"
    },
    "pixel-frog": {
      coverage: "DOCUMENTATION ONLY",
      composites:
        "Deep forest canvas; bright frog-green, cream, coral, red and ink palette; 4px/2px radius tokens; 0px major-panel corners; 4–10px unblurred offset shadows; pixel border-image, grid texture and fixed-color emblem.",
      layout:
        "Keeps the current page hierarchy and 6→4→2 content grids. Header, drawer, Hero, panels and player use 4px SVG borders with no backdrop blur. Login becomes a 640px Pixel Pass panel; mobile rules reduce the Hero emblem to 68px and compact the pass below 760/520px.",
      assets:
        "frog-emblem.svg · pixel-border.svg · pixel-grid.svg · icon-search/play/close/enter/user/lock/shield/eye/refresh.svg. CSS-mask control icons are recolorable; emblem, border and grid retain fixed source colors.",
      typography:
        "Fusion Pixel PFV · local fusion-pixel-12px-proportional-zh-hans.woff2 · weight 400 · title tracking .035em · navigation/control tracking .055em · SIL OFL 1.1. Figma uses a fallback unless the runtime font is locally installed.",
      states:
        "Nav hover/current uses 14% green and a 3px underline. Buttons use green fill, 2px ink border and 4px hard shadow. Fine-pointer card hover moves -3px/-3px and grows to an 8px hard shadow; focus-visible keeps card position. No Pixel-specific :active press is implemented.",
      motion:
        "Explicit user selection only: four-edge square particle burst plus 0.48s steps(4) emblem hop. Login enters in 0.32s steps(4); READY blinks at 1.4s steps(2). Initial preference restoration is static. Reduced motion disables every Pixel-specific animation and particle.",
      responsive:
        "Desktop 1440: 96px Hero emblem and 640px login panel. Tablet 768: default global reflow until 760px. Mobile 390: 68px emblem, vertical Hero darkening, full-row drawer theme option, compact login. Below 520px: 44px pass avatar and 38px title.",
      knownIssues: PLAN.knownThemeIssues.map((issue) => `${issue.id} · ${issue.name}`).join("\n"),
      sources:
        "template/pingfangvideo/css/style.css:9164+ · html/public/head.html · html/user/login.html · js/app.js · js/canvas-confetti.min.js · images/pixel/*.svg · css/fonts/*"
    }
  };
  return documentation[theme.id];
}

async function ensureThemesPage(context) {
  const pageName = "01 · Themes";
  const pageKey = "page/themes";
  let page = figma.root.children.find((item) => entityKey(item) === pageKey);
  if (page && !isOwned(page, pageKey)) {
    throw new Error(`Themes page ownership conflict: ${page.name}`);
  }
  if (!page) {
    const sameName = figma.root.children.find((item) => item.name === pageName);
    page = sameName || tag(figma.createPage(), pageKey);
    if (!sameName) page.name = pageName;
  }
  assertMutableTargetPage(page);
  await page.loadAsync();
  await figma.setCurrentPageAsync(page);

  const rootKey = "page/themes/root";
  let root = page.children.find((item) => entityKey(item) === rootKey);
  if (root && !isOwned(root, rootKey)) {
    throw new Error("Themes root ownership conflict.");
  }
  if (!root) {
    root = tag(createAutoFrame("Themes / Root", "VERTICAL", 1440, 40), rootKey);
    root.paddingTop = 64;
    root.paddingRight = 64;
    root.paddingBottom = 96;
    root.paddingLeft = 64;
    page.appendChild(root);
    placeAwayFromExisting(page, root);
  }
  root.resize(1440, Math.max(1, root.height));
  root.layoutMode = "VERTICAL";
  root.primaryAxisSizingMode = "AUTO";
  root.counterAxisSizingMode = "FIXED";
  root.clipsContent = false;
  clearOwnedChildren(root);
  setLayoutNumber(root, "itemSpacing", 40, context);
  setLayoutNumber(root, "paddingTop", 64, context);
  setLayoutNumber(root, "paddingRight", 64, context);
  setLayoutNumber(root, "paddingBottom", 96, context);
  setLayoutNumber(root, "paddingLeft", 64, context);

  const defaultTheme = PLAN.themes[0];
  const defaultCollection = context.defaultCollection;
  const defaultCanvas = themeVariable(context.resources, defaultCollection, "color/background/canvas");
  root.fills = [bindColor(defaultCanvas, defaultTheme.tokens[0].value)];

  const fonts = await loadFonts();
  const defaultText = themeVariable(context.resources, defaultCollection, "color/text/primary");
  const defaultMuted = themeVariable(context.resources, defaultCollection, "color/text/muted");

  root.appendChild(tag(createText("Themes · Current Code", fonts.bold, 44, defaultText, "#f4f6ff", 1312), "page/themes/title"));
  root.appendChild(
    tag(
      createText(
        `${PLAN.themes.length} themes exposed by public/head.html and app.js. Figma Starter cannot add multiple modes, so each of the ${PLAN.themes.length - 1} alternate themes uses one isolated semantic collection. aurora-glass remains a CSS alias and is not an exposed product choice. Source reference: ${SOURCE_REFERENCE}.`,
        fonts.regular,
        15,
        defaultMuted,
        "#9da6bd",
        1312
      ),
      "page/themes/strategy"
    )
  );

  for (let index = 0; index < PLAN.themes.length; index += 2) {
    const row = tag(createAutoFrame(`Themes / Row ${index / 2 + 1}`, "HORIZONTAL", 1312, 24), `page/themes/row/${index / 2 + 1}`);
    setLayoutNumber(row, "itemSpacing", 24, context);
    root.appendChild(row);
    for (const theme of PLAN.themes.slice(index, index + 2)) {
      const panel = themeVariableByName(context, theme, "color/background/panel");
      const textColor = themeVariableByName(context, theme, "color/text/primary");
      const muted = themeVariableByName(context, theme, "color/text/muted");
      const border = themeVariableByName(context, theme, "color/border/default");
      const radius = themeVariableByName(context, theme, "radius/default");

      const card = tag(createAutoFrame(`Theme / ${theme.label}`, "VERTICAL", 644, 14), `page/themes/card/${theme.id}`);
      setLayoutNumber(card, "itemSpacing", 14, context);
      setLayoutNumber(card, "paddingTop", 24, context);
      setLayoutNumber(card, "paddingRight", 24, context);
      setLayoutNumber(card, "paddingBottom", 24, context);
      setLayoutNumber(card, "paddingLeft", 24, context);
      card.fills = [bindColor(panel, theme.tokens[1].value)];
      card.strokes = [bindColor(border, theme.tokens[5].value)];
      card.strokeWeight = 1;
      card.cornerRadius = theme.radius.default;
      if (radius) card.setBoundVariable("cornerRadius", radius);
      row.appendChild(card);

      card.appendChild(tag(createText(theme.label, fonts.bold, 26, textColor, theme.tokens[3].value, 596), `page/themes/card/${theme.id}/title`));
      card.appendChild(
        tag(
          createText(
            `${themeDocumentation(theme).coverage} · ${theme.option} · ${theme.collection} · radius ${theme.radius.default}/${theme.radius.small}`,
            fonts.regular,
            12,
            muted,
            theme.tokens[4].value,
            596
          ),
          `page/themes/card/${theme.id}/meta`
        )
      );

      for (const token of theme.tokens.filter((item) => variableType(item) === "COLOR")) {
        const variable = themeVariableByName(context, theme, token.name);
        const tokenRow = tag(createAutoFrame(`Token / ${token.css}`, "HORIZONTAL", 596, 12), `page/themes/card/${theme.id}/token/${token.name}`);
        setLayoutNumber(tokenRow, "itemSpacing", 12, context);
        tokenRow.counterAxisAlignItems = "CENTER";
        card.appendChild(tokenRow);
        const swatch = tag(figma.createRectangle(), `page/themes/card/${theme.id}/swatch/${token.name}`);
        swatch.name = `Swatch / ${token.css}`;
        swatch.resize(36, 36);
        swatch.cornerRadius = 8;
        swatch.fills = [bindColor(variable, token.value)];
        tokenRow.appendChild(swatch);
        tokenRow.appendChild(
          tag(
            createText(`${token.name}\nvar(${token.css}) · ${token.value}`, fonts.regular, 11, textColor, theme.tokens[3].value, 548),
            `page/themes/card/${theme.id}/label/${token.name}`
          )
        );
      }
      const documentation = themeDocumentation(theme);
      card.appendChild(
        tag(
          createText(
            [
              `Composite effects: ${documentation.composites}`,
              `Layout rules: ${documentation.layout}`,
              `Unique assets: ${documentation.assets}`,
              documentation.typography ? `Typography: ${documentation.typography}` : "",
              documentation.states ? `Component states: ${documentation.states}` : "",
              documentation.motion ? `Theme action and motion: ${documentation.motion}` : "",
              documentation.responsive ? `Responsive delta: ${documentation.responsive}` : "",
              documentation.knownIssues ? `Known implementation mismatches:\n${documentation.knownIssues}` : "",
              `Code: ${documentation.sources}`
            ]
              .filter(Boolean)
              .join("\n\n"),
            fonts.regular,
            11,
            muted,
            theme.tokens[4].value,
            596
          ),
          `page/themes/card/${theme.id}/documentation`
        )
      );
    }
  }

  const composite = tag(createAutoFrame("Themes / Composite Values", "VERTICAL", 1312, 10), "page/themes/composites");
  setLayoutNumber(composite, "itemSpacing", 10, context);
  setLayoutNumber(composite, "paddingTop", 22, context);
  setLayoutNumber(composite, "paddingRight", 22, context);
  setLayoutNumber(composite, "paddingBottom", 22, context);
  setLayoutNumber(composite, "paddingLeft", 22, context);
  composite.fills = [bindColor(themeVariable(context.resources, defaultCollection, "color/background/panel-soft"), "#171c30")];
  composite.cornerRadius = 18;
  root.appendChild(composite);
  composite.appendChild(tag(createText("Composite CSS values", fonts.bold, 20, defaultText, "#f4f6ff", 1268), "page/themes/composites/title"));
  composite.appendChild(
    tag(
      createText(
        `Only Liquid Cinema receives complete A01–A30 page coverage in this round. ${PLAN.themes
          .slice(1)
          .map((theme) => theme.label)
          .join("、")} remain source-backed documentation entries for colors, typography, radii, gradients, hard or multi-layer shadows, unique SVGs, responsive/layout deltas, component states, motion, reduced motion, and implementation mismatches. Code Connect is outside the current acceptance scope.`,
        fonts.regular,
        13,
        defaultMuted,
        "#9da6bd",
        1268
      ),
      "page/themes/composites/body"
    )
  );

  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
  return { page, root };
}

function normalizeAuditText(value, limit = 72) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function signatureHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function protectedPageSignature(page) {
  if (!isRawEvidencePage(page)) {
    throw new Error(`Protected-page signature only supports Raw Evidence, got ${page ? page.name : "missing page"}.`);
  }
  const topLevel = page.children.map((node) => {
    const descendants = "findAll" in node ? node.findAll(() => true) : [];
    const nodes = [node, ...descendants];
    const textSignatures = [];
    const seenText = new Set();
    let imageFillCount = 0;
    const viewportCandidates = Object.fromEntries(RAW_EVIDENCE_VIEWPORTS.map((width) => [String(width), []]));

    for (const candidate of nodes) {
      if (candidate.type === "TEXT" && candidate.visible) {
        const signature = normalizeAuditText(candidate.characters);
        if (signature && !seenText.has(signature) && textSignatures.length < 8) {
          seenText.add(signature);
          textSignatures.push(signature);
        }
      }
      if ("fills" in candidate && Array.isArray(candidate.fills)) {
        imageFillCount += candidate.fills.filter((paint) => paint.type === "IMAGE").length;
      }
      if (candidate.visible && ["FRAME", "COMPONENT", "INSTANCE"].includes(candidate.type)) {
        for (const width of RAW_EVIDENCE_VIEWPORTS) {
          if (Math.abs(candidate.width - width) <= 2) {
            viewportCandidates[String(width)].push({
              id: candidate.id,
              name: normalizeAuditText(candidate.name, 48) || "(unnamed)",
              width: Math.round(candidate.width),
              height: Math.round(candidate.height)
            });
          }
        }
      }
    }

    const box = node.absoluteBoundingBox;
    return {
      id: node.id,
      type: node.type,
      name: normalizeAuditText(node.name, 96) || "(unnamed)",
      width: Math.round(box ? box.width : node.width),
      height: Math.round(box ? box.height : node.height),
      childCount: "children" in node ? node.children.length : 0,
      textSignatures,
      imageFillCount,
      viewportCandidates
    };
  });
  const canonical = topLevel.map((node) => ({
    id: node.id,
    type: node.type,
    name: node.name,
    width: node.width,
    height: node.height,
    childCount: node.childCount,
    textSignatures: node.textSignatures,
    imageFillCount: node.imageFillCount,
    viewportCandidates: node.viewportCandidates
  }));
  return {
    pageId: page.id,
    pageName: page.name,
    topLevelCount: topLevel.length,
    signature: `fnv1a32:${signatureHash(JSON.stringify(canonical))}`,
    topLevel
  };
}

function formatViewportCandidates(viewportCandidates) {
  return RAW_EVIDENCE_VIEWPORTS.map((width) => {
    const candidates = viewportCandidates[String(width)] || [];
    const visibleCandidates = candidates.slice(0, 6).map((candidate) => `${candidate.name} · ${candidate.id} · ${candidate.width}×${candidate.height}`);
    if (candidates.length > visibleCandidates.length) {
      visibleCandidates.push(`… ${candidates.length - visibleCandidates.length} more`);
    }
    return `  viewport ${width}: ${candidates.length}${visibleCandidates.length ? `\n    - ${visibleCandidates.join("\n    - ")}` : ""}`;
  });
}

async function auditRawEvidence() {
  const targetVerification = await assertTargetFile();
  const pagePlan = pagePlanByName(RAW_EVIDENCE_PAGE_NAME);
  const page = findPlannedPage(pagePlan);
  if (!page) {
    return [
      "RAW EVIDENCE AUDIT · MISSING",
      `target=${targetVerification}`,
      `expected=${RAW_EVIDENCE_PAGE_NAME}`,
      `aliases=${RAW_EVIDENCE_PAGE_ALIASES.join(", ")}`
    ].join("\n");
  }
  await page.loadAsync();
  const report = protectedPageSignature(page);
  const chunkSize = 1;
  const start = Math.min(rawEvidenceAuditCursor, Math.max(0, report.topLevel.length - 1));
  const end = Math.min(report.topLevel.length, start + chunkSize);
  const nodeLines = report.topLevel.slice(start, end).flatMap((node, chunkIndex) => {
    const viewports = RAW_EVIDENCE_VIEWPORTS.map((width) => {
      const candidates = node.viewportCandidates[String(width)] || [];
      const candidate = candidates[0];
      return `${width}:${candidates.length}${candidate ? `:${candidate.id}:${candidate.height}` : ""}`;
    }).join("|");
    return [
      `${String(start + chunkIndex + 1).padStart(2, "0")}/${report.topLevelCount} · ${node.type} · ${normalizeAuditText(node.name, 72)}`,
      `root=${node.id} · ${node.width}×${node.height} · child=${node.childCount} · img=${node.imageFillCount} · vp=${viewports}`,
      `text=${node.textSignatures.slice(0, 2).join("|") || "none"}`
    ];
  });
  rawEvidenceAuditCursor = end >= report.topLevel.length ? 0 : end;
  return [
    `RAW EVIDENCE · READ ONLY · ${report.signature} · next=${rawEvidenceAuditCursor ? rawEvidenceAuditCursor + 1 : 1}`,
    ...nodeLines
  ].join("\n");
}

async function audit() {
  const targetVerification = await assertTargetFile();
  const resources = await allResources();
  const pages = [];
  let componentSets = 0;
  let components = 0;
  for (const page of figma.root.children) {
    await page.loadAsync();
    const sets = page.findAll((node) => node.type === "COMPONENT_SET").length;
    const comps = page.findAll((node) => node.type === "COMPONENT").length;
    componentSets += sets;
    components += comps;
    pages.push(`${page.name} | top=${page.children.length} | sets=${sets} | components=${comps} | flows=${page.flowStartingPoints.length}`);
  }
  const collectionLines = resources.collections.map((collection) => {
    const count = resources.variables.filter((variable) => variable.variableCollectionId === collection.id).length;
    return `${collection.name} | modes=${collection.modes.map((mode) => mode.name).join(",")} | variables=${count}`;
  });
  return [
    "AUDIT · READ ONLY",
    `fileKey=${figma.fileKey || "unavailable"}`,
    `target=${targetVerification}`,
    `pages=${pages.length}`,
    `componentSets=${componentSets}`,
    `components=${components}`,
    "",
    "PAGES",
    ...pages,
    "",
    "VARIABLE COLLECTIONS",
    ...collectionLines
  ].join("\n");
}

function topLevelAncestor(node, page) {
  let current = node;
  while (current && current.parent && current.parent !== page) current = current.parent;
  return current && current.parent === page ? current : null;
}

function compactNodeSummary(node) {
  const box = node.absoluteBoundingBox;
  const childCount = "children" in node ? node.children.length : 0;
  return `${node.type} · ${node.name || "(unnamed)"} · ${box ? `${Math.round(box.width)}×${Math.round(box.height)} @ ${Math.round(box.x)},${Math.round(box.y)}` : "no bounds"} · children=${childCount}`;
}

async function auditFormalReadiness() {
  await assertTargetFile();
  const pageOrder = figma.root.children.map((page) => page.name);
  const [allTextStyles, allEffectStyles] = await Promise.all([figma.getLocalTextStylesAsync(), figma.getLocalEffectStylesAsync()]);
  const maintainedTextStyles = allTextStyles.filter((style) => MAINTAINED_TEXT_STYLE_PREFIXES.some((prefix) => style.name.startsWith(prefix)));
  const importedTextStyles = allTextStyles.filter((style) => !maintainedTextStyles.includes(style));
  const maintainedEffectStyles = allEffectStyles.filter((style) =>
    MAINTAINED_EFFECT_STYLE_PREFIXES.some((prefix) => style.name.startsWith(prefix))
  );
  const importedEffectStyles = allEffectStyles.filter((style) => !maintainedEffectStyles.includes(style));
  const keyPageNames = [
    "02 · Components",
    "13 · Player",
    "20 · Production Prototype",
    "92 · Raw Evidence · html.to.design · 2026-07-28"
  ];
  const pageLines = [];
  const evidenceLines = [];
  for (const pageName of keyPageNames) {
    const page = figma.root.children.find((item) => item.name === pageName);
    if (!page) {
      pageLines.push(`${pageName} · MISSING`);
      continue;
    }
    await page.loadAsync();
    pageLines.push(`${pageName} · top=${page.children.length}`);
    for (const node of page.children) pageLines.push(`  - ${compactNodeSummary(node)}`);
    if (pageName === "92 · Raw Evidence · html.to.design · 2026-07-28") {
      const textNodes = page.findAllWithCriteria({ types: ["TEXT"] });
      for (const state of PLAN.formalPrototype.playerEvidence) {
        const matches = textNodes.filter((node) => state.textSignatures.some((signature) => node.characters.includes(signature)));
        const roots = Array.from(new Set(matches.map((node) => topLevelAncestor(node, page)).filter(Boolean)));
        const frames = roots.flatMap((root) => {
          const candidates = [root, ...("findAllWithCriteria" in root ? root.findAllWithCriteria({ types: ["FRAME"] }) : [])];
          return candidates.filter((node) => state.expectedViewports.some((width) => Math.abs(node.width - width) <= 2));
        });
        evidenceLines.push(
          `${state.id} · signatures=${matches.length} · roots=${roots.length} · viewports=${Array.from(
            new Set(frames.map((node) => Math.round(node.width)))
          )
            .sort((left, right) => right - left)
            .join(",") || "none"}`
        );
        for (const root of roots) evidenceLines.push(`  - root ${compactNodeSummary(root)}`);
      }
    }
  }
  const desiredOrder = PLAN.formalPrototype.pageOrder;
  const orderMismatch = desiredOrder.filter((name, index) => pageOrder[index] !== name);
  return [
    "FORMAL READINESS · READ ONLY",
    `pages=${pageOrder.length}/${desiredOrder.length}`,
    `order mismatches=${orderMismatch.length}`,
    ...orderMismatch.map((name) => `- expected ${desiredOrder.indexOf(name) + 1} · ${name}`),
    `maintained text styles=${maintainedTextStyles.length}`,
    ...maintainedTextStyles.map((style) => `- ${style.name}`),
    `isolated/imported text styles=${importedTextStyles.length}`,
    ...importedTextStyles.map((style) => `- ${style.name}`),
    `maintained effect styles=${maintainedEffectStyles.length}`,
    ...maintainedEffectStyles.map((style) => `- ${style.name}`),
    `isolated/imported effect styles=${importedEffectStyles.length}`,
    ...importedEffectStyles.map((style) => `- ${style.name}`),
    "",
    "PLAYER EVIDENCE",
    ...(evidenceLines.length ? evidenceLines : ["- unavailable"]),
    "",
    "KEY PAGE TOP-LEVEL NODES",
    ...pageLines
  ].join("\n");
}

function roundedBox(node) {
  const box = node.absoluteBoundingBox;
  if (!box) return "no-box";
  return `x=${Math.round(box.x)} y=${Math.round(box.y)} w=${Math.round(box.width)} h=${Math.round(box.height)}`;
}

function boxContains(outer, inner, tolerance = 1) {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  );
}

function findLegacyComponentsRoot(page) {
  return (
    page.children.find((item) => item.name === "Components / Liquid Cinema") ||
    page.children.find(
      (item) => "findOne" in item && item.findOne((node) => node.type === "TEXT" && node.characters.includes("Components · Code Structure Map"))
    )
  );
}

async function locateLegacyComponentsRoot() {
  for (const pageName of ["02 · Components", "91 · Archive · Next.js Code Map · 2026-07-24"]) {
    const page = figma.root.children.find((item) => item.name === pageName);
    if (!page) continue;
    await page.loadAsync();
    const root = findLegacyComponentsRoot(page);
    if (root) return { page, root };
  }
  return null;
}

function componentLayoutProblems(root) {
  const problems = [];
  const directChildren = root.children.filter((node) => node.visible && node.absoluteBoundingBox);
  for (const child of directChildren) {
    const descendants = "findAll" in child ? child.findAll((node) => node.visible && Boolean(node.absoluteBoundingBox)) : [];
    const escaped = descendants.filter((node) => !boxContains(child.absoluteBoundingBox, node.absoluteBoundingBox));
    if (escaped.length) {
      problems.push({
        type: "escaped",
        child,
        escaped
      });
    }
  }
  for (let index = 0; index < directChildren.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < directChildren.length; otherIndex += 1) {
      const first = directChildren[index];
      const second = directChildren[otherIndex];
      if (boxesOverlap(first.absoluteBoundingBox, second.absoluteBoundingBox)) {
        problems.push({
          type: "sibling-overlap",
          first,
          second
        });
      }
    }
  }
  const rankBoardCard = directChildren.find((node) => node.name === "Showcase/Home/RankBoard");
  const desktopRankBoard =
    rankBoardCard && "findOne" in rankBoardCard ? rankBoardCard.findOne((node) => node.visible && node.name === "Viewport=Desktop") : null;
  const desktopRankItems =
    desktopRankBoard && "findAll" in desktopRankBoard
      ? desktopRankBoard.findAll((node) => node.visible && node.absoluteBoundingBox && /^Rank Item \d+$/.test(node.name))
      : [];
  const rankList = desktopRankItems.length ? desktopRankItems[0].parent : null;
  if (rankList && rankList.absoluteBoundingBox) {
    const escapedItems = desktopRankItems.filter((node) => !boxContains(rankList.absoluteBoundingBox, node.absoluteBoundingBox));
    if (escapedItems.length) {
      problems.push({
        type: "nested-escaped",
        child: rankList,
        escaped: escapedItems
      });
    }
  }
  for (const rankItem of desktopRankItems) {
    const escaped = rankItem.findAll(
      (node) => node.visible && node.absoluteBoundingBox && !boxContains(rankItem.absoluteBoundingBox, node.absoluteBoundingBox)
    );
    if (escaped.length) {
      problems.push({
        type: "nested-escaped",
        child: rankItem,
        escaped
      });
    }
  }
  return problems;
}

async function auditComponentsLayout() {
  await assertTargetFile();
  const located = await locateLegacyComponentsRoot();
  if (!located) return "COMPONENT LAYOUT AUDIT · BLOCKED\nHistorical component catalog missing.";
  const { page, root } = located;
  await figma.setCurrentPageAsync(page);
  if (!("children" in root)) {
    return [
      "COMPONENT LAYOUT AUDIT · BLOCKED",
      "Historical component catalog root is not a container.",
      ...page.children.map((item) => `${item.type} · ${item.name} · ${roundedBox(item)}`)
    ].join("\n");
  }

  const issues = [];
  const directChildren = root.children.filter((node) => node.visible && node.absoluteBoundingBox);
  for (const child of directChildren) {
    const descendants = "findAll" in child ? child.findAll((node) => node.visible && Boolean(node.absoluteBoundingBox)) : [];
    const escaped = descendants.filter((node) => !boxContains(child.absoluteBoundingBox, node.absoluteBoundingBox));
    if (escaped.length) {
      issues.push(
        `${child.name} · ${roundedBox(child)} contains ${escaped.length} out-of-bounds descendants: ${escaped
          .slice(0, 6)
          .map((node) => `${node.name} (${roundedBox(node)})`)
          .join(", ")}`
      );
    }
  }
  for (let index = 0; index < directChildren.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < directChildren.length; otherIndex += 1) {
      const first = directChildren[index];
      const second = directChildren[otherIndex];
      if (boxesOverlap(first.absoluteBoundingBox, second.absoluteBoundingBox)) {
        issues.push(`direct child overlap: ${first.name} ↔ ${second.name}`);
      }
    }
  }

  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
  const rankBoardCard = directChildren.find((node) => node.name === "Showcase/Home/RankBoard");
  const desktopRankBoard =
    rankBoardCard && "findOne" in rankBoardCard
      ? rankBoardCard.findOne((node) => node.visible && node.name === "Viewport=Desktop" && Boolean(node.absoluteBoundingBox))
      : null;
  const desktopRankItems =
    desktopRankBoard && "findAll" in desktopRankBoard
      ? desktopRankBoard.findAll((node) => node.visible && node.absoluteBoundingBox && /^Rank Item \d+$/.test(node.name))
      : [];
  const rankList = desktopRankItems.length ? desktopRankItems[0].parent : null;
  if (desktopRankItems.length !== 5) {
    issues.push(`RankBoard desktop columns ${desktopRankItems.length}/5`);
  } else {
    if (!rankList || !("layoutMode" in rankList) || rankList.layoutMode !== "HORIZONTAL" || rankList.itemSpacing !== 10) {
      issues.push("RankBoard desktop grid must be horizontal with a 10px gap");
    }
    if (desktopRankItems.some((node) => !("layoutSizingHorizontal" in node) || node.layoutSizingHorizontal !== "FILL")) {
      issues.push("RankBoard desktop columns must use equal fill sizing");
    }
    const rankWidths = desktopRankItems.map((node) => node.width);
    if (Math.max(...rankWidths) - Math.min(...rankWidths) > 1) {
      issues.push("RankBoard desktop column widths are unequal");
    }
  }
  if (rankList && rankList.absoluteBoundingBox) {
    const escapedItems = desktopRankItems.filter((node) => !boxContains(rankList.absoluteBoundingBox, node.absoluteBoundingBox));
    if (escapedItems.length) {
      issues.push(`Rank List contains ${escapedItems.length} out-of-bounds items: ${escapedItems.map((node) => node.name).join(", ")}`);
    }
  }
  for (const rankItem of desktopRankItems) {
    const escaped = rankItem.findAll(
      (node) => node.visible && node.absoluteBoundingBox && !boxContains(rankItem.absoluteBoundingBox, node.absoluteBoundingBox)
    );
    if (escaped.length) {
      issues.push(`${rankItem.name} contains ${escaped.length} out-of-bounds descendants: ${escaped.map((node) => node.name).join(", ")}`);
    }
    const title = "children" in rankItem ? rankItem.children.find((node) => node.type === "TEXT" && node.name === "Item Title") : null;
    if (!title || !("layoutSizingHorizontal" in title) || title.layoutSizingHorizontal !== "FILL") {
      issues.push(`${rankItem.name} title must fill the remaining column width`);
    }
  }
  const firstRankItem = desktopRankItems[0] || null;
  const firstRankItemLines =
    firstRankItem && "findAll" in firstRankItem
      ? firstRankItem
          .findAll((node) => node.visible && node.absoluteBoundingBox && (node.parent === firstRankItem || node.type === "TEXT"))
          .map(
            (node) =>
              `${node.type}:${node.name} relx=${Math.round(node.absoluteBoundingBox.x - firstRankItem.absoluteBoundingBox.x)} w=${Math.round(node.absoluteBoundingBox.width)} sizing=${"layoutSizingHorizontal" in node ? node.layoutSizingHorizontal : "n/a"}`
          )
      : [];
  const rankBoardLines = [
    rankList && rankList.absoluteBoundingBox
      ? `list ${rankList.id} ${roundedBox(rankList)} layout=${"layoutMode" in rankList ? rankList.layoutMode : "n/a"} gap=${"itemSpacing" in rankList ? rankList.itemSpacing : "n/a"}`
      : "list missing",
    firstRankItem
      ? `item ${firstRankItem.id} w=${Math.round(firstRankItem.width)} layout=${"layoutMode" in firstRankItem ? firstRankItem.layoutMode : "n/a"} sizing=${"layoutSizingHorizontal" in firstRankItem ? firstRankItem.layoutSizingHorizontal : "n/a"}`
      : "item missing",
    ...firstRankItemLines
  ];
  if (rankBoardCard) {
    return [`RANKBOARD LAYOUT · ${issues.length ? "FAIL" : "PASS"}`, ...rankBoardLines, `catalog issues=${issues.length}`].join("\n");
  }
  return [
    `COMPONENT LAYOUT AUDIT · ${issues.length ? "FAIL" : "PASS"}`,
    `page=${page.name} · ${page.id}`,
    `root=${root.name} · ${root.id} · ${roundedBox(root)}`,
    `root layout=${"layoutMode" in root ? root.layoutMode : "n/a"} clips=${"clipsContent" in root ? root.clipsContent : "n/a"}`,
    `direct children=${directChildren.length}`,
    `issues=${issues.length}`,
    ...issues.map((issue) => `- ${issue}`),
    "",
    "RANKBOARD GEOMETRY",
    ...rankBoardLines
  ].join("\n");
}

async function repairComponentsLayout() {
  const located = await locateLegacyComponentsRoot();
  if (!located) throw new Error("Historical component catalog missing.");
  const { page, root } = located;
  await figma.setCurrentPageAsync(page);
  if (!root || !("children" in root)) {
    throw new Error("Historical component catalog root is not a container.");
  }

  const mutatedNodeIds = [];
  const rankChanges = [];
  const rankBoardCard = root.children.find((node) => node.name === "Showcase/Home/RankBoard");
  const desktopRankBoard =
    rankBoardCard && "findOne" in rankBoardCard ? rankBoardCard.findOne((node) => node.visible && node.name === "Viewport=Desktop") : null;
  const desktopRankItems =
    desktopRankBoard && "findAll" in desktopRankBoard ? desktopRankBoard.findAll((node) => node.visible && /^Rank Item \d+$/.test(node.name)) : [];
  const rankList = desktopRankItems.length ? desktopRankItems[0].parent : null;
  if (rankList && "layoutMode" in rankList && rankList.layoutMode === "HORIZONTAL" && desktopRankItems.length === 5) {
    for (const rankItem of desktopRankItems) {
      if ("layoutSizingHorizontal" in rankItem && rankItem.layoutSizingHorizontal !== "FILL") {
        rankItem.layoutSizingHorizontal = "FILL";
        mutatedNodeIds.push(rankItem.id);
        rankChanges.push(`${rankItem.name}:column=fill`);
      }
      const title = "children" in rankItem ? rankItem.children.find((node) => node.type === "TEXT" && node.name === "Item Title") : null;
      if (title && "layoutSizingHorizontal" in title && title.layoutSizingHorizontal !== "FILL") {
        title.layoutSizingHorizontal = "FILL";
        mutatedNodeIds.push(title.id);
        rankChanges.push(`${rankItem.name}/Item Title:content=fill`);
      }
    }
  }

  const measurements = root.children
    .filter((node) => node.name.startsWith("Showcase/") && node.visible && node.absoluteBoundingBox)
    .map((card) => {
      const cardBox = card.absoluteBoundingBox;
      const descendants = "findAll" in card ? card.findAll((node) => node.visible && Boolean(node.absoluteBoundingBox)) : [];
      const maxBottom = descendants.reduce(
        (bottom, node) => Math.max(bottom, node.absoluteBoundingBox.y + node.absoluteBoundingBox.height),
        cardBox.y + cardBox.height
      );
      const overflowBottom = Math.max(0, maxBottom - (cardBox.y + cardBox.height));
      return {
        card,
        beforeHeight: card.height,
        overflowBottom,
        requiredHeight: Math.ceil(card.height + overflowBottom + 32)
      };
    });

  const changedCards = [];
  for (const measurement of measurements) {
    const { card, beforeHeight, overflowBottom, requiredHeight } = measurement;
    let changed = false;
    if (overflowBottom > 1) {
      card.resize(card.width, requiredHeight);
      changed = true;
    }
    if ("clipsContent" in card && card.clipsContent) {
      card.clipsContent = false;
      changed = true;
    }
    if (changed) {
      mutatedNodeIds.push(card.id);
      changedCards.push(`${card.name}:${Math.round(beforeHeight)}→${Math.round(card.height)}`);
    }
  }

  if ("clipsContent" in root && root.clipsContent) {
    root.clipsContent = false;
    mutatedNodeIds.push(root.id);
  }
  if ("layoutMode" in root && root.layoutMode === "VERTICAL" && root.primaryAxisSizingMode !== "AUTO") {
    root.primaryAxisSizingMode = "AUTO";
    if (!mutatedNodeIds.includes(root.id)) mutatedNodeIds.push(root.id);
  }
  root.setSharedPluginData(NS, "legacy_components_layout_repaired", RUN_ID);

  const remaining = componentLayoutProblems(root);
  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
  figma.commitUndo();
  return [
    `COMPONENT LAYOUT FIX · ${remaining.length ? "FAIL" : "PASS"}`,
    `page=${page.name} · ${page.id}`,
    `root=${root.name} · ${root.id} · height=${Math.round(root.height)}`,
    `cards checked=${measurements.length}`,
    `cards changed=${changedCards.length}`,
    `rank changes=${rankChanges.length}`,
    `mutatedNodeIds=${mutatedNodeIds.join(",") || "none"}`,
    ...rankChanges.map((item) => `- ${item}`),
    ...changedCards.map((item) => `- ${item}`),
    `remaining issues=${remaining.length}`,
    ...remaining
      .slice(0, 12)
      .map((problem) =>
        problem.type === "escaped" || problem.type === "nested-escaped"
          ? `- ${problem.child.name}: ${problem.escaped.length} descendants still outside`
          : `- ${problem.first.name} ↔ ${problem.second.name}`
      )
  ].join("\n");
}

async function archiveLegacyComponentCatalog() {
  await requireP2Complete();
  const componentsPage = figma.root.children.find((item) => item.name === "02 · Components");
  const archivePage = figma.root.children.find((item) => item.name === "91 · Archive · Next.js Code Map · 2026-07-24");
  if (!componentsPage || !archivePage) throw new Error("Components or Next.js archive page missing.");
  await componentsPage.loadAsync();
  await archivePage.loadAsync();

  const moved = [];
  const historicalRoot = findLegacyComponentsRoot(componentsPage);
  if (historicalRoot) {
    archivePage.appendChild(historicalRoot);
    historicalRoot.name = "Archive / Historical Next.js Components / Reference Only";
    historicalRoot.setSharedPluginData(NS, "archive_status", "historical-nextjs-reference");
    placeAwayFromExisting(archivePage, historicalRoot);
    moved.push(`${historicalRoot.name} · ${historicalRoot.id}`);
  }

  const supersededRoot = componentsPage.children.find((node) => entityKey(node) === "p3/component/form-text-field");
  if (supersededRoot) {
    archivePage.appendChild(supersededRoot);
    supersededRoot.name = "Archive / Superseded Form-TextField / Reference Only";
    supersededRoot.setSharedPluginData(NS, "archive_status", "superseded-context-mixing");
    placeAwayFromExisting(archivePage, supersededRoot);
    moved.push(`${supersededRoot.name} · ${supersededRoot.id}`);
  }

  await figma.setCurrentPageAsync(archivePage);
  const focus = historicalRoot || findLegacyComponentsRoot(archivePage) || supersededRoot;
  if (focus) {
    figma.currentPage.selection = [focus];
    figma.viewport.scrollAndZoomIntoView([focus]);
  }
  figma.commitUndo();
  return [
    "HISTORICAL COMPONENT CATALOG ARCHIVED",
    `archivePage=${archivePage.name} · ${archivePage.id}`,
    `moved=${moved.length}`,
    ...(moved.length ? moved.map((item) => `- ${item}`) : ["- already archived"])
  ].join("\n");
}

function navigationReaction(destinationId, transitionType = "DISSOLVE") {
  return [
    {
      trigger: { type: "ON_CLICK" },
      actions: [
        {
          type: "NODE",
          destinationId,
          navigation: "NAVIGATE",
          transition: {
            type: transitionType,
            easing: { type: "EASE_OUT" },
            duration: transitionType === "SMART_ANIMATE" ? 0.3 : 0.2
          },
          resetScrollPosition: true
        }
      ]
    }
  ];
}

function nodeLinkReaction(destinationId) {
  const fileKey = figma.fileKey || PLAN.figma.fileKey;
  const nodeId = String(destinationId).replaceAll(":", "-");
  return [
    {
      trigger: { type: "ON_CLICK" },
      actions: [
        {
          type: "URL",
          url: `https://www.figma.com/design/${fileKey}/Squared-Media?node-id=${encodeURIComponent(nodeId)}`,
          openInNewTab: false
        }
      ]
    }
  ];
}

function firstPrototypeFrame(node, viewport) {
  const candidates = [
    node,
    ...("findAllWithCriteria" in node ? node.findAllWithCriteria({ types: ["FRAME", "COMPONENT", "INSTANCE"] }) : [])
  ].filter((candidate) => candidate.visible && Math.abs(candidate.width - viewport) <= 2);
  return candidates.sort((left, right) => right.height - left.height)[0] || null;
}

function findPrototypeDestination(page, hint, viewport) {
  const candidates = page.findAll(
    (node) =>
      node.visible &&
      node.name &&
      (node.name === hint || node.name.startsWith(hint) || (hint.length >= 5 && node.name.includes(hint)))
  );
  for (const candidate of candidates) {
    const viewportFrame = firstPrototypeFrame(candidate, viewport);
    if (viewportFrame) return viewportFrame;
  }
  return candidates.find((node) => ["FRAME", "COMPONENT", "INSTANCE"].includes(node.type)) || null;
}

function findDrawerDestination(page, hint, viewport) {
  const node = page.findOne((item) => item.visible && item.name === hint);
  if (!node) return null;
  if (["FRAME", "COMPONENT", "INSTANCE"].includes(node.type) && Math.abs(node.width - viewport) <= 2) return node;
  let current = node;
  while (current && current.parent && current.parent !== page) {
    current = current.parent;
    if (["FRAME", "COMPONENT", "INSTANCE"].includes(current.type) && Math.abs(current.width - viewport) <= 2) return current;
  }
  return ["FRAME", "COMPONENT", "INSTANCE"].includes(node.type) ? node : null;
}

function plannedComponentEvidence(componentName) {
  const mapped =
    PLAN.components.find((item) => item.name === componentName) ||
    PLAN.components.find((item) => item.name.split("/").pop() === componentName.split("/").pop());
  const contract = PLAN.existingComponentStateContracts.find((item) => item.name === componentName.split("/").pop());
  const build = PLAN.componentBuilds.find((item) => item.name === componentName);
  return {
    status: mapped?.status || (build ? "planned" : "existing"),
    sourceFiles: mapped?.sourceFiles || contract?.sourceFiles || [],
    states: build ? Object.values(build.variantDimensions).flat() : contract?.states || []
  };
}

function componentIndexDestination(node, page) {
  const topLevel = topLevelAncestor(node, page);
  if (topLevel && ["FRAME", "COMPONENT", "INSTANCE"].includes(topLevel.type)) return topLevel;
  return findLegacyComponentsRoot(page);
}

function containingPage(node) {
  let current = node;
  while (current && current.type !== "PAGE") current = current.parent;
  return current && current.type === "PAGE" ? current : null;
}

async function destinationForPage(pageName, ownedKey = "") {
  const page = figma.root.children.find((item) => item.name === pageName);
  if (!page) return null;
  await page.loadAsync();
  if (ownedKey) {
    const owned = page.children.find((node) => entityKey(node) === ownedKey);
    if (owned) return owned;
  }
  return (
    page.children.find((node) => ["FRAME", "COMPONENT", "INSTANCE"].includes(node.type) && node.visible) ||
    page.findOne((node) => ["FRAME", "COMPONENT", "INSTANCE"].includes(node.type) && node.visible) ||
    null
  );
}

async function applyP5Overview() {
  await requireP2Complete();
  const { page } = await ensurePlannedPage("00 · Project Overview");
  assertMutableTargetPage(page);
  const quickLinks = [
    { label: "Baseline Guide", pageName: "00 · Baseline Guide", key: "p2/docs/00 · Baseline Guide" },
    { label: "Components", pageName: "02 · Components", key: "p5/formal/component-index" },
    { label: "Player", pageName: "13 · Player", key: "p5/formal/player-evidence" },
    { label: "User Flows", pageName: "19 · User Flows", key: "p5/formal/user-flows" },
    { label: "Production Prototype", pageName: "20 · Production Prototype", key: "" },
    { label: "Issues / Recorded Only", pageName: "90 · Issues / Recorded Only", key: "p2/docs/90 · Issues / Recorded Only" }
  ];
  const resolvedLinks = [];
  for (const link of quickLinks) {
    resolvedLinks.push({ ...link, destination: await destinationForPage(link.pageName, link.key) });
  }
  await figma.setCurrentPageAsync(page);
  const context = await docContext();
  const key = "p5/formal/overview";
  const root = await ensureOwnedReferenceRoot(page, key, "Squared Media / Project Overview", "P5", context);
  bindReferenceRootSpacing(root, context, 18);
  root.fills = [bindColor(context.canvas, "#05070d")];
  await addOwnedText(root, `${key}/title`, "Squared Media · Product Design Baseline", context, {
    font: context.fonts.bold,
    size: 44,
    width: 1312,
    phase: "P5"
  });
  await addOwnedText(
    root,
    `${key}/intro`,
    `Current implementation authority: ${PLAN.source.repository} · ${SOURCE_REFERENCE} · ${PLAN.source.runtime}. This file is a maintained implementation baseline, not a visual redesign proposal.`,
    context,
    { color: context.muted, fallback: "#9da6bd", size: 14, width: 1312, phase: "P5" }
  );
  const implementedStateSlots = PLAN.archetypes.reduce(
    (sum, archetype) => sum + PLAN.requiredPageStates.filter((state) => archetype.states.includes(state)).length,
    0
  );
  const totalStateSlots = PLAN.archetypes.length * PLAN.requiredPageStates.length;
  const overviewItems = [
    {
      title: "Product contract",
      meta: "Current code wins",
      body: PLAN.guardrails.join("\n")
    },
    {
      title: "Formal file map",
      meta: `${PLAN.formalPrototype.pageOrder.length} canonical pages`,
      body: [
        "00–06 · project guide, source map, foundations, themes, components, assets, responsive, interactions, developer reference",
        "10–18 · product page families",
        "19 · source-backed user flows",
        "20 · protected production prototype",
        "90–92 · issues, archive, and raw evidence"
      ].join("\n")
    },
    {
      title: "Coverage snapshot",
      meta: `${PLAN.archetypes.length} archetypes · ${PLAN.existingFigmaComponents.length + PLAN.componentBuilds.length} component families · ${
        PLAN.sourceCoverage.expectedTrackedFileCount
      } tracked source files`,
      body: `${implementedStateSlots}/${totalStateSlots} required page-state slots are implemented in current code. ${
        totalStateSlots - implementedStateSlots
      } slots remain explicitly labeled Not implemented in current code.\n${PLAN.sourceCoverage.policy}`
    },
    {
      title: "Responsive acceptance",
      meta: PLAN.referenceViewports.map((viewport) => `${viewport.name} ${viewport.width}`).join(" · "),
      body: `${PLAN.breakpoints.length} real width/height breakpoints and ${PLAN.mediaConditions.length} environmental media conditions remain implementation authority. Reference frames are acceptance examples, not replacement breakpoints.`
    },
    {
      title: "Maintenance workflow",
      meta: "Source diff → evidence → formal reference → validation",
      body: "Update code mappings first, import exact runtime evidence when a pixel reference is required, change only plugin-owned formal reference roots, run P1–P5 validation, then retain Issues and protected evidence for traceability."
    },
    {
      title: "Implementation boundaries",
      meta: "No invented routes or states",
      body: `Settings: ${PLAN.integrationStatus.settingsRoute}\nCode Connect: ${PLAN.integrationStatus.codeConnect}\nHistorical Next.js mappings remain archive-only.`
    },
    {
      title: "Code coverage addendum",
      meta: `${PLAN.formalPrototype.codeCoverageAddendum.length} source groups outside the original 30-archetype map`,
      body: PLAN.formalPrototype.codeCoverageAddendum
        .map((item) => `${item.id} · ${item.name} · ${item.classification}\n${item.representation}`)
        .join("\n\n")
    }
  ];
  for (let index = 0; index < overviewItems.length; index += 1) {
    root.appendChild(await createDocCard(context, `${key}/item/${index + 1}`, overviewItems[index], "P5"));
  }
  let reactionCount = 0;
  for (let index = 0; index < resolvedLinks.length; index += 1) {
    const link = resolvedLinks[index];
    const card = await createDocCard(
      context,
      `${key}/quick/${index + 1}`,
      {
        title: `Open · ${link.label}`,
        meta: link.destination ? "Clickable reference" : "Reference target pending",
        body: link.destination ? `${link.pageName}\nClick to open the maintained reference.` : `${link.pageName}\nBuild the target reference first.`
      },
      "P5"
    );
    root.appendChild(card);
    if (link.destination) {
      await card.setReactionsAsync(nodeLinkReaction(link.destination.id));
      reactionCount += 1;
    }
  }
  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
  figma.commitUndo();
  return `P5 OVERVIEW APPLIED\npage=${page.name} · ${page.id}\nroot=${root.id}\nquickLinkReactions=${reactionCount}/${resolvedLinks.length}`;
}

async function applyP5ComponentIndex() {
  await requireP3Complete();
  const { page } = await ensurePlannedPage("02 · Components");
  assertMutableTargetPage(page);
  await figma.setCurrentPageAsync(page);
  const context = await docContext();
  const key = "p5/formal/component-index";
  const root = await ensureOwnedReferenceRoot(page, key, "Components / Formal Library Index", "P5", context);
  bindReferenceRootSpacing(root, context, 18);
  root.fills = [bindColor(context.canvas, "#05070d")];
  await addOwnedText(root, `${key}/title`, "Components · Formal Library Index", context, {
    font: context.fonts.bold,
    size: 40,
    width: 1312,
    phase: "P5"
  });
  await addOwnedText(
    root,
    `${key}/intro`,
    "Seven maintained categories index every existing and planned component family. Visuals remain unchanged; each entry records states, source files, ownership, and a clickable link when the component exists on canvas.",
    context,
    { color: context.muted, fallback: "#9da6bd", size: 14, width: 1312, phase: "P5" }
  );
  const archivePage = figma.root.children.find((item) => item.name.startsWith("91 · Archive · Next.js"));
  if (archivePage) await archivePage.loadAsync();
  const componentNodes = [
    ...page.findAllWithCriteria({ types: ["COMPONENT_SET", "COMPONENT"] }),
    ...(archivePage ? archivePage.findAllWithCriteria({ types: ["COMPONENT_SET", "COMPONENT"] }) : [])
  ];
  let reactionCount = 0;
  for (let index = 0; index < PLAN.formalPrototype.componentCategories.length; index += 1) {
    const category = PLAN.formalPrototype.componentCategories[index];
    const lines = category.components.map((componentName) => {
      const evidence = plannedComponentEvidence(componentName);
      return `${componentName} · ${evidence.status}\nStates: ${evidence.states.join(", ") || "source-specific"}\nSources: ${
        evidence.sourceFiles.join(", ") || "mapped through the existing Figma component contract"
      }`;
    });
    const card = await createDocCard(
      context,
      `${key}/category/${category.id}`,
      {
        title: category.name,
        meta: `${category.components.length} component families · ${category.purpose}`,
        body: lines.join("\n\n")
      },
      "P5"
    );
    root.appendChild(card);
    const component = componentNodes.find((node) =>
      category.components.some((componentName) => node.name === componentName || node.name.split("/").pop() === componentName.split("/").pop())
    );
    const componentPage = component ? containingPage(component) : null;
    const destination = component && componentPage ? componentIndexDestination(component, componentPage) : null;
    if (destination) {
      await card.setReactionsAsync(componentPage === page ? navigationReaction(destination.id) : nodeLinkReaction(destination.id));
      reactionCount += 1;
    }
  }
  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
  figma.commitUndo();
  return `P5 COMPONENT INDEX APPLIED\npage=${page.name} · ${page.id}\nroot=${root.id}\ncategories=${PLAN.formalPrototype.componentCategories.length}\ncategoryReactions=${reactionCount}`;
}

function frameDepthFrom(node, ancestor) {
  let depth = 0;
  let current = node;
  while (current && current !== ancestor) {
    depth += 1;
    current = current.parent;
  }
  return current === ancestor ? depth : Number.MAX_SAFE_INTEGER;
}

function locatePlayerEvidence(rawPage) {
  const textNodes = rawPage.findAllWithCriteria({ types: ["TEXT"] });
  return PLAN.formalPrototype.playerEvidence.map((state) => {
    const signatures = textNodes.filter((node) => state.textSignatures.some((signature) => node.characters.includes(signature)));
    const roots = Array.from(new Set(signatures.map((node) => topLevelAncestor(node, rawPage)).filter(Boolean)));
    const viewports = state.expectedViewports.map((width) => {
      const candidates = roots
        .flatMap((root) => [root, ...("findAllWithCriteria" in root ? root.findAllWithCriteria({ types: ["FRAME"] }) : [])].map((node) => ({ root, node })))
        .filter(({ node }) => node.visible && Math.abs(node.width - width) <= 2)
        .sort((left, right) => {
          const depth = frameDepthFrom(left.node, left.root) - frameDepthFrom(right.node, right.root);
          return depth || right.node.height - left.node.height;
        });
      return { width, source: candidates[0]?.node || null };
    });
    return { state, signatures, roots, viewports };
  });
}

async function applyP5PlayerEvidence() {
  await requireP3Complete();
  const rawPage = figma.root.children.find((item) => item.name === "92 · Raw Evidence · html.to.design · 2026-07-28");
  if (!rawPage) throw new Error("Protected Raw Evidence page missing.");
  await rawPage.loadAsync();
  const located = locatePlayerEvidence(rawPage);
  const missing = located.flatMap((item) =>
    item.viewports.filter((viewport) => !viewport.source).map((viewport) => `${item.state.id}/${viewport.width}`)
  );
  if (missing.length) {
    throw new Error(`Player evidence preflight failed before mutation: ${missing.join(", ")}`);
  }
  const { page } = await ensurePlannedPage("13 · Player");
  assertMutableTargetPage(page);
  await figma.setCurrentPageAsync(page);
  const context = await docContext();
  const key = "p5/formal/player-evidence";
  const root = await ensureOwnedReferenceRoot(page, key, "Player / Code-backed Prompt Evidence", "P5", context, 3000);
  bindReferenceRootSpacing(root, context, 24, 3000);
  root.fills = [bindColor(context.canvas, "#05070d")];
  await addOwnedText(root, `${key}/title`, "Player · Loading & Buffering Evidence", context, {
    font: context.fonts.bold,
    size: 40,
    width: 2872,
    phase: "P5"
  });
  await addOwnedText(
    root,
    `${key}/intro`,
    "Exact editable 1440 / 768 / 390 html.to.design frames are cloned from protected Raw Evidence. Source evidence is retained; no prompt visual is redrawn or optimized.",
    context,
    { color: context.muted, fallback: "#9da6bd", size: 14, width: 2872, phase: "P5" }
  );
  const clonedNodeIds = [];
  for (const locatedState of located) {
    const stateKey = `${key}/${locatedState.state.id}`;
    const section = tag(createAutoFrame(locatedState.state.name, "VERTICAL", 2872, 16), stateKey, "P5");
    setLayoutNumber(section, "paddingTop", 24, context);
    setLayoutNumber(section, "paddingRight", 24, context);
    setLayoutNumber(section, "paddingBottom", 24, context);
    setLayoutNumber(section, "paddingLeft", 24, context);
    section.fills = [bindColor(context.panel, "#0f1322")];
    section.strokes = [bindColor(context.line, "rgba(221, 228, 255, 0.16)")];
    section.strokeWeight = 1;
    setRadius(section, 18, context.radius);
    root.appendChild(section);
    await addOwnedText(section, `${stateKey}/title`, locatedState.state.name, context, {
      font: context.fonts.bold,
      size: 24,
      width: 2824,
      phase: "P5"
    });
    await addOwnedText(
      section,
      `${stateKey}/meta`,
      `Sources: ${locatedState.state.sourceFiles.join(", ")}\nSignatures: ${locatedState.state.textSignatures.join(" · ")}`,
      context,
      { color: context.muted, fallback: "#9da6bd", size: 12, width: 2824, phase: "P5" }
    );
    const row = tag(createAutoFrame(`${locatedState.state.name} / Viewports`, "HORIZONTAL", 2824, 24), `${stateKey}/viewports`, "P5");
    row.counterAxisAlignItems = "MIN";
    section.appendChild(row);
    for (const viewport of locatedState.viewports) {
      const clone = tag(viewport.source.clone(), `${stateKey}/viewport/${viewport.width}`, "P5");
      clone.name = `${locatedState.state.name} / ${viewport.width}`;
      if ("layoutPositioning" in clone) clone.layoutPositioning = "AUTO";
      row.appendChild(clone);
      clonedNodeIds.push(clone.id);
    }
  }
  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
  figma.commitUndo();
  return `P5 PLAYER EVIDENCE APPLIED\npage=${page.name} · ${page.id}\nroot=${root.id}\neditableViewportFrames=${clonedNodeIds.length}\nnodeIds=${clonedNodeIds.join(",")}`;
}

async function resolveFormalFlowDestinations() {
  const prototypePage = figma.root.children.find((item) => item.name === "20 · Production Prototype");
  const playerPage = figma.root.children.find((item) => item.name === "13 · Player");
  if (!prototypePage || !playerPage) throw new Error("Production Prototype or Player page missing.");
  await prototypePage.loadAsync();
  await playerPage.loadAsync();
  return PLAN.formalPrototype.prototypeFlows.map((flow) => ({
    ...flow,
    steps: flow.steps.map((step) => {
      let destination = null;
      if (step.target === "prototype") destination = findPrototypeDestination(prototypePage, step.hint, step.viewport);
      if (step.target === "drawer") destination = findDrawerDestination(prototypePage, step.hint, step.viewport);
      if (step.target === "player-evidence") {
        destination =
          playerPage.findOne((node) => entityKey(node) === `p5/formal/player-evidence/${step.hint}/viewport/${step.viewport}`) || null;
      }
      return { ...step, destination };
    })
  }));
}

async function createFlowStepCard(context, key, step, index) {
  const card = tag(createAutoFrame(`Step ${index + 1} / ${step.label}`, "VERTICAL", 300, 8), key, "P5");
  setLayoutNumber(card, "paddingTop", 18, context);
  setLayoutNumber(card, "paddingRight", 18, context);
  setLayoutNumber(card, "paddingBottom", 18, context);
  setLayoutNumber(card, "paddingLeft", 18, context);
  card.fills = [bindColor(context.panelSoft, "rgba(23, 28, 48, 0.82)")];
  card.strokes = [bindColor(step.destination ? context.lineAccentSoft : context.lineWarm, step.destination ? "#244757" : "#6b3441")];
  card.strokeWeight = 1;
  setRadius(card, 14, context.radiusSmall);
  await addOwnedText(card, `${key}/eyebrow`, `STEP ${String(index + 1).padStart(2, "0")}`, context, {
    color: context.accent2,
    fallback: "#6ee7f9",
    size: 10,
    width: 264,
    phase: "P5"
  });
  await addOwnedText(card, `${key}/title`, step.label, context, {
    font: context.fonts.bold,
    size: 17,
    width: 264,
    phase: "P5"
  });
  await addOwnedText(
    card,
    `${key}/meta`,
    step.destination ? `${step.target} · ${step.viewport}px · click to inspect same-page evidence` : `Target unresolved · ${step.hint}`,
    context,
    { color: context.muted, fallback: "#9da6bd", size: 11, width: 264, phase: "P5" }
  );
  return card;
}

function formalFlowTargetSignature(step) {
  return `${step.target}|${step.hint}|${step.viewport}`;
}

async function clearClonedReactions(root) {
  const nodes = [
    root,
    ...("findAll" in root ? root.findAll((node) => "reactions" in node && node.reactions.length > 0) : [])
  ].filter((node) => "reactions" in node && node.reactions.length > 0);
  for (const node of nodes) {
    await node.setReactionsAsync([]);
  }
}

async function createFormalFlowTargets(page, key, resolvedFlows) {
  const targetMap = new Map();
  const targetNodeIds = [];
  for (const flow of resolvedFlows) {
    for (const step of flow.steps) {
      const signature = formalFlowTargetSignature(step);
      if (targetMap.has(signature)) continue;
      const targetKey = `${key}/target/${encodeURIComponent(signature)}`;
      const frame = tag(figma.createFrame(), targetKey, "P5");
      frame.name = `Flow Target / ${step.label} / ${step.viewport}`;
      frame.resize(step.destination.width, step.destination.height);
      frame.fills = [];
      frame.clipsContent = false;
      const clone = tag(step.destination.clone(), `${targetKey}/content`, "P5");
      frame.appendChild(clone);
      clone.x = 0;
      clone.y = 0;
      await clearClonedReactions(clone);
      page.appendChild(frame);
      placeAwayFromExisting(page, frame);
      targetMap.set(signature, frame);
      targetNodeIds.push(frame.id);
    }
  }
  return {
    flows: resolvedFlows.map((flow) => ({
      ...flow,
      steps: flow.steps.map((step) => ({ ...step, destination: targetMap.get(formalFlowTargetSignature(step)) }))
    })),
    targetNodeIds
  };
}

async function applyP5UserFlows() {
  await requireP3Complete();
  const resolvedFlows = await resolveFormalFlowDestinations();
  const unresolved = resolvedFlows.flatMap((flow) =>
    flow.steps.filter((step) => !step.destination).map((step) => `${flow.id}/${step.label} (${step.hint})`)
  );
  if (unresolved.length) {
    throw new Error(`User-flow destination preflight failed before mutation: ${unresolved.join(", ")}`);
  }
  const { page } = await ensurePlannedPage("19 · User Flows");
  assertMutableTargetPage(page);
  await figma.setCurrentPageAsync(page);
  const context = await docContext();
  const key = "p5/formal/user-flows";
  const root = await ensureOwnedReferenceRoot(page, key, "User Flows / Source-backed Prototype Index", "P5", context);
  removeOwnedTopLevelOrphans(page, root, key);
  const samePageTargets = await createFormalFlowTargets(page, key, resolvedFlows);
  bindReferenceRootSpacing(root, context, 24);
  root.fills = [bindColor(context.canvas, "#05070d")];
  await addOwnedText(root, `${key}/title`, "User Flows · Current Implementation", context, {
    font: context.fonts.bold,
    size: 40,
    width: 1312,
    phase: "P5"
  });
  await addOwnedText(
    root,
    `${key}/intro`,
    "Each step is an editable, source-backed navigation card linked to an exact same-page clone of the current Production Prototype or player evidence. Figma requires prototype destinations to stay on one page; the protected source frames remain unchanged.",
    context,
    { color: context.muted, fallback: "#9da6bd", size: 14, width: 1312, phase: "P5" }
  );
  const reactionNodeIds = [];
  for (const flow of samePageTargets.flows) {
    const sourceFlow = PLAN.navigationFlows.find((item) => item.id === flow.sourceFlowId);
    const flowKey = `${key}/flow/${flow.id}`;
    const section = tag(createAutoFrame(`${flow.id} / ${flow.name}`, "VERTICAL", 1312, 14), flowKey, "P5");
    setLayoutNumber(section, "paddingTop", 22, context);
    setLayoutNumber(section, "paddingRight", 22, context);
    setLayoutNumber(section, "paddingBottom", 22, context);
    setLayoutNumber(section, "paddingLeft", 22, context);
    section.fills = [bindColor(context.panel, "#0f1322")];
    section.strokes = [bindColor(context.line, "rgba(221, 228, 255, 0.16)")];
    section.strokeWeight = 1;
    setRadius(section, 18, context.radius);
    root.appendChild(section);
    await addOwnedText(section, `${flowKey}/title`, `${flow.id} · ${flow.name}`, context, {
      font: context.fonts.bold,
      size: 22,
      width: 1268,
      phase: "P5"
    });
    await addOwnedText(
      section,
      `${flowKey}/meta`,
      `Maps ${sourceFlow.id} · ${sourceFlow.name}\n${sourceFlow.transition}\nSources: ${sourceFlow.sourceFiles.join(", ")}`,
      context,
      { color: context.muted, fallback: "#9da6bd", size: 11, width: 1268, phase: "P5" }
    );
    const row = tag(createAutoFrame(`${flow.id} / Steps`, "HORIZONTAL", 1268, 16), `${flowKey}/steps`, "P5");
    section.appendChild(row);
    for (let index = 0; index < flow.steps.length; index += 1) {
      const step = flow.steps[index];
      const card = await createFlowStepCard(context, `${flowKey}/step/${index + 1}`, step, index);
      row.appendChild(card);
      await card.setReactionsAsync(navigationReaction(step.destination.id));
      reactionNodeIds.push(card.id);
    }
  }
  page.flowStartingPoints = [{ nodeId: root.id, name: "Squared Media · User Flows" }];
  figma.currentPage.selection = [root];
  figma.viewport.scrollAndZoomIntoView([root]);
  figma.commitUndo();
  return `P5 USER FLOWS APPLIED\npage=${page.name} · ${page.id}\nroot=${root.id}\nflows=${resolvedFlows.length}\ntargetFrames=${samePageTargets.targetNodeIds.length}\nstepReactions=${reactionNodeIds.length}\ntargetNodeIds=${samePageTargets.targetNodeIds.join(",")}\nreactionNodeIds=${reactionNodeIds.join(",")}`;
}

async function applyP5PageOrder() {
  await requireP2Complete();
  const pagesByName = new Map(figma.root.children.map((page) => [page.name, page]));
  const missing = PLAN.formalPrototype.pageOrder.filter((name) => !pagesByName.has(name));
  if (missing.length) throw new Error(`Formal page-order preflight failed before mutation: ${missing.join(", ")}`);
  for (let index = 0; index < PLAN.formalPrototype.pageOrder.length; index += 1) {
    figma.root.insertChild(index, pagesByName.get(PLAN.formalPrototype.pageOrder[index]));
  }
  figma.commitUndo();
  return [
    "P5 PAGE ORDER APPLIED",
    ...figma.root.children.map((page, index) => `${String(index + 1).padStart(2, "0")} · ${page.name}`)
  ].join("\n");
}

async function validateP5() {
  await assertTargetFile();
  const issues = [];
  const pending = [];
  const desiredOrder = PLAN.formalPrototype.pageOrder;
  const currentOrder = figma.root.children.map((page) => page.name);
  for (let index = 0; index < desiredOrder.length; index += 1) {
    if (currentOrder[index] !== desiredOrder[index]) issues.push(`page order ${index + 1}: ${currentOrder[index] || "missing"} / ${desiredOrder[index]}`);
  }
  const rootContracts = [
    ["00 · Project Overview", "p5/formal/overview"],
    ["02 · Components", "p5/formal/component-index"],
    ["13 · Player", "p5/formal/player-evidence"],
    ["19 · User Flows", "p5/formal/user-flows"]
  ];
  const roots = [];
  for (const [pageName, key] of rootContracts) {
    const page = figma.root.children.find((item) => item.name === pageName);
    if (!page) {
      pending.push(`page ${pageName}`);
      continue;
    }
    await page.loadAsync();
    const root = page.children.find((node) => entityKey(node) === key);
    if (!root) {
      pending.push(`root ${key}`);
      continue;
    }
    roots.push({ page, root, key });
    if (root.height <= 1) issues.push(`${pageName} root height is clipped`);
    if (root.clipsContent) issues.push(`${pageName} root clips content`);
    const foreignRoots = page.children.filter(
      (node) => node !== root && node.absoluteBoundingBox && node.getSharedPluginData(NS, "run_id") !== RUN_ID
    );
    for (const foreign of foreignRoots) {
      if (root.absoluteBoundingBox && boxesOverlap(root.absoluteBoundingBox, foreign.absoluteBoundingBox)) {
        issues.push(`${pageName} overlap: ${root.name} ↔ ${foreign.name}`);
      }
    }
  }
  const overview = roots.find((item) => item.key === "p5/formal/overview")?.root;
  if (overview) {
    const quickLinks = overview.children.filter((node) => entityKey(node).startsWith("p5/formal/overview/quick/"));
    if (quickLinks.length !== 6) issues.push(`overview quick links ${quickLinks.length}/6`);
    if (quickLinks.filter((node) => node.reactions.length > 0).length < 4) issues.push("overview has fewer than four connected quick links");
  }
  const componentIndex = roots.find((item) => item.key === "p5/formal/component-index")?.root;
  if (componentIndex) {
    const categories = componentIndex.children.filter((node) => entityKey(node).startsWith("p5/formal/component-index/category/"));
    if (categories.length !== PLAN.formalPrototype.componentCategories.length) {
      issues.push(`component index categories ${categories.length}/${PLAN.formalPrototype.componentCategories.length}`);
    }
    const connectedCategories = categories.filter((node) => node.reactions.length > 0).length;
    if (connectedCategories !== PLAN.formalPrototype.componentCategories.length) {
      issues.push(`component index reactions ${connectedCategories}/${PLAN.formalPrototype.componentCategories.length}`);
    }
  }
  const playerEvidence = roots.find((item) => item.key === "p5/formal/player-evidence")?.root;
  if (playerEvidence) {
    for (const state of PLAN.formalPrototype.playerEvidence) {
      for (const width of state.expectedViewports) {
        const frame = playerEvidence.findOne((node) => entityKey(node) === `p5/formal/player-evidence/${state.id}/viewport/${width}`);
        if (!frame) issues.push(`player evidence missing ${state.id}/${width}`);
        else if (Math.abs(frame.width - width) > 2) issues.push(`player evidence width ${state.id}/${width}: ${Math.round(frame.width)}`);
      }
    }
  }
  const userFlows = roots.find((item) => item.key === "p5/formal/user-flows")?.root;
  if (userFlows) {
    const expectedSteps = PLAN.formalPrototype.prototypeFlows.reduce((sum, flow) => sum + flow.steps.length, 0);
    const expectedTargets = new Set(
      PLAN.formalPrototype.prototypeFlows.flatMap((flow) => flow.steps.map((step) => formalFlowTargetSignature(step)))
    ).size;
    const targetFrames = userFlows.parent.children.filter(
      (node) => node.type === "FRAME" && entityKey(node).startsWith("p5/formal/user-flows/target/")
    );
    if (targetFrames.length !== expectedTargets) issues.push(`user-flow targets ${targetFrames.length}/${expectedTargets}`);
    const samePageFrames = [userFlows, ...targetFrames].filter((node) => node.absoluteBoundingBox);
    for (let leftIndex = 0; leftIndex < samePageFrames.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < samePageFrames.length; rightIndex += 1) {
        if (boxesOverlap(samePageFrames[leftIndex].absoluteBoundingBox, samePageFrames[rightIndex].absoluteBoundingBox)) {
          issues.push(`user-flow overlap: ${samePageFrames[leftIndex].name} ↔ ${samePageFrames[rightIndex].name}`);
        }
      }
    }
    const stepCards = userFlows.findAll((node) => entityKey(node).includes("/step/"));
    const uniqueStepCards = stepCards.filter((node) => /\/step\/\d+$/.test(entityKey(node)));
    if (uniqueStepCards.length !== expectedSteps) issues.push(`user-flow steps ${uniqueStepCards.length}/${expectedSteps}`);
    if (uniqueStepCards.filter((node) => node.reactions.length > 0).length !== expectedSteps) {
      issues.push(`user-flow reactions ${uniqueStepCards.filter((node) => node.reactions.length > 0).length}/${expectedSteps}`);
    }
  }
  const p2 = await validateP2();
  if (!p2.startsWith("P2 VALIDATION · PASS")) issues.push("P2 must pass after maintained-style filtering");
  const status = issues.length ? "FAIL" : pending.length ? "PENDING" : "PASS";
  return [
    `P5 VALIDATION · ${status}`,
    `roots=${roots.length}/${rootContracts.length}`,
    `issues=${issues.length}`,
    ...issues.map((issue) => `- ISSUE · ${issue}`),
    `pending=${pending.length}`,
    ...pending.map((item) => `- PENDING · ${item}`)
  ].join("\n");
}

function previewPlan() {
  const operations = PLAN.pages.reduce((summary, page) => {
    summary[page.operation] = (summary[page.operation] || 0) + 1;
    return summary;
  }, {});
  return [
    "PLAN · READ ONLY",
    `baseline=${PLAN.baselineId}`,
    `target=${PLAN.figma.targetTitle}`,
    `themes=${PLAN.themes.length}`,
    ...PLAN.themes.map((theme) => `- ${theme.label} | option=${theme.option} | collection=${theme.collection}`),
    `archetypes=${PLAN.archetypes.length}`,
    `pages=${PLAN.pages.length}`,
    `documentation pages=${DOC_PAGE_NAMES.length}`,
    `component builds=${PLAN.componentBuilds.map((item) => `${item.name}:${item.variantCount}`).join(", ")}`,
    `coverage pages=${COVERAGE_PAGE_NAMES.length}`,
    `settings surfaces=${PLAN.settingsSurfaces.length} · standalone settings route=false`,
    `machine outputs=${PLAN.machineOutputs.length} · visual frames=false`,
    `page operations=${JSON.stringify(operations)}`,
    `breakpoints=${PLAN.breakpoints.map((item) => `${item.axis}:${item.max}`).join(", ")}`,
    `media conditions=${PLAN.mediaConditions.length}`,
    `responsive patterns=${PLAN.responsivePatterns.length}`,
    `viewports=${PLAN.referenceViewports.map((item) => `${item.name}:${item.width}`).join(", ")}`,
    `navigation flows=${PLAN.navigationFlows.length}`,
    `asset previews=${PLAN.assetInventory.length}`,
    `formal component categories=${PLAN.formalPrototype.componentCategories.length}`,
    `formal prototype flows=${PLAN.formalPrototype.prototypeFlows.length}`,
    `player evidence states=${PLAN.formalPrototype.playerEvidence.length}`,
    `code coverage addendum=${PLAN.formalPrototype.codeCoverageAddendum.length}`,
    `tracked source files=${PLAN.sourceCoverage.expectedTrackedFileCount}`,
    `source coverage policy=${PLAN.sourceCoverage.policy}`,
    "",
    "GUARDRAILS",
    ...PLAN.guardrails.map((item) => `- ${item}`),
    "",
    `P1 creates ${PRIMITIVE_COLLECTION}, ${PLAN.themes.length - 1} alternate semantic collections, and 01 · Themes.`,
    "P2 runs one page operation or documentation page at a time.",
    "P3 builds one source-backed component family at a time; each set stays below 30 variants.",
    "P4 adds one editable page-family coverage index at a time without replacing existing visual frames.",
    "P5 adds the formal project overview, component index, exact player evidence, clickable flow index, and canonical page order as separate guarded actions."
  ].join("\n");
}

async function validateP1() {
  await assertTargetFile();
  const resources = await allResources();
  const issues = [];
  const primitiveCollection = resources.collections.find((item) => item.name === PRIMITIVE_COLLECTION);
  const defaultCollection = resources.collections.find((item) => item.name === DEFAULT_COLLECTION);
  if (!defaultCollection) issues.push(`missing ${DEFAULT_COLLECTION}`);
  if (!primitiveCollection) issues.push(`missing ${PRIMITIVE_COLLECTION}`);

  let checkedVariables = 0;
  for (const theme of PLAN.themes) {
    const semanticCollection = resources.collections.find((item) => item.name === theme.collection);
    if (!semanticCollection) {
      issues.push(`missing collection ${theme.collection}`);
      continue;
    }
    for (const token of theme.tokens) {
      if (theme.id === PLAN.themes[0].id && variableType(token) === "FLOAT") {
        continue;
      }
      const variable = findVariable(resources, semanticCollection, token.name);
      if (!variable) {
        issues.push(`missing ${theme.collection}/${token.name}`);
        continue;
      }
      checkedVariables += 1;
      if (variable.codeSyntax.WEB !== `var(${token.css})`) {
        issues.push(`WEB syntax ${theme.collection}/${token.name}`);
      }
      if (
        theme.id !== PLAN.themes[0].id &&
        JSON.stringify([...variable.scopes].sort()) !== JSON.stringify([...token.scopes].sort())
      ) {
        issues.push(`scope ${theme.collection}/${token.name}`);
      }
    }
  }

  if (primitiveCollection) {
    const expectedPrimitiveCount = PLAN.themes.reduce((sum, theme) => sum + theme.tokens.length, 0);
    const primitiveVariables = resources.variables.filter((item) => item.variableCollectionId === primitiveCollection.id);
    if (primitiveVariables.length !== expectedPrimitiveCount) {
      issues.push(`primitive count ${primitiveVariables.length}/${expectedPrimitiveCount}`);
    }
    for (const variable of primitiveVariables) {
      if (variable.scopes.length !== 0) {
        issues.push(`primitive scope ${variable.name}`);
      }
    }
  }

  const page = figma.root.children.find((item) => item.name === "01 · Themes");
  if (!page) {
    issues.push("Themes page missing");
  } else {
    await page.loadAsync();
    const root = page.children.find((item) => entityKey(item) === "page/themes/root");
    if (!root) {
      issues.push("Themes root missing");
    } else {
      if (root.height <= 1) issues.push("Themes root height is clipped");
      if (root.clipsContent) issues.push("Themes root clips content");
      for (const theme of PLAN.themes) {
        const key = `page/themes/card/${theme.id}`;
        if (!root.findOne((item) => entityKey(item) === key)) {
          issues.push(`theme card missing ${theme.id}`);
        }
      }
    }
  }

  return [
    `P1 VALIDATION · ${issues.length ? "FAIL" : "PASS"}`,
    `checked semantic variables=${checkedVariables}`,
    `expected semantic variables=${
      PLAN.themes[0].tokens.filter((token) => variableType(token) === "COLOR").length +
      PLAN.themes.slice(1).reduce((sum, theme) => sum + theme.tokens.length, 0)
    }`,
    `issues=${issues.length}`,
    ...(issues.length ? issues.map((issue) => `- ${issue}`) : ["- none"])
  ].join("\n");
}

function assertPassingPhase(label, report) {
  if (!report.startsWith(`${label} VALIDATION · PASS`)) {
    throw new Error(`${label} must pass before this action.\n${report}`);
  }
}

async function requireP1Complete() {
  assertPassingPhase("P1", await validateP1());
}

async function requireP2Complete() {
  assertPassingPhase("P2", await validateP2());
}

async function requireP3Complete() {
  for (const build of PLAN.componentBuilds) {
    assertPassingPhase("P3", await validateComponentFamily(build.id));
  }
}

async function applyP1(approval) {
  assertApproval(approval);
  await assertTargetFile();
  const context = await createThemeVariables();
  const { page, root } = await ensureThemesPage(context);
  figma.commitUndo();
  return [
    "P1 APPLIED",
    `page=${page.name} · ${page.id}`,
    `root=${root.id}`,
    `primitive collection=${context.primitiveCollection.name} · ${context.primitiveCollection.id}`,
    `default semantic collection=${context.defaultCollection.name} · ${context.defaultCollection.id}`,
    `alternate semantic collections=${PLAN.themes
      .slice(1)
      .map((theme) => {
        const collection = context.semanticCollections.get(theme.id);
        return `${collection.name} · ${collection.id}`;
      })
      .join(", ")}`,
    "Run Validate P1 next."
  ].join("\n");
}

async function focusThemesPage() {
  const page = figma.root.children.find((item) => item.name === "01 · Themes");
  if (!page) return "Themes page has not been created.";
  await page.loadAsync();
  await figma.setCurrentPageAsync(page);
  const root = page.children.find((item) => entityKey(item) === "page/themes/root");
  if (root) {
    figma.currentPage.selection = [root];
    figma.viewport.scrollAndZoomIntoView([root]);
  }
  return `Focused ${page.name}.`;
}

figma.ui.onmessage = async (message) => {
  try {
    let text;
    if (String(message.action).startsWith("apply-")) {
      assertApproval(message.approval);
      await assertTargetFile();
    }
    if (message.action === "audit") text = await audit();
    else if (message.action === "audit-raw-evidence") text = await auditRawEvidence();
    else if (message.action === "audit-formal-readiness") text = await auditFormalReadiness();
    else if (message.action === "audit-components-layout") text = await auditComponentsLayout();
    else if (message.action === "apply-components-layout-fix") text = await repairComponentsLayout();
    else if (message.action === "apply-archive-legacy-components") text = await archiveLegacyComponentCatalog();
    else if (message.action === "preview") text = previewPlan();
    else if (message.action === "final-qa") text = await finalQa();
    else if (message.action === "validate-p1") text = await validateP1();
    else if (message.action === "apply-p1") text = await applyP1(message.approval);
    else if (message.action === "apply-page") text = await applyPageStructure(message.pageName);
    else if (message.action === "apply-next-page") text = await applyNextPageStructure();
    else if (message.action === "validate-p2") text = await validateP2();
    else if (message.action === "apply-doc") text = await renderDocumentationPage(message.docPageName);
    else if (message.action === "apply-next-doc") text = await applyNextDocumentation();
    else if (message.action === "apply-component") text = await buildComponentFamily(message.componentId);
    else if (message.action === "apply-next-component") text = await applyNextComponentFamily();
    else if (message.action === "validate-component") text = await validateComponentFamily(message.componentId);
    else if (message.action === "apply-coverage") text = await renderCoverageIndex(message.coveragePageName);
    else if (message.action === "apply-next-coverage") text = await applyNextCoverage();
    else if (message.action === "validate-coverage") text = await validateCoverageIndex(message.coveragePageName);
    else if (message.action === "apply-p5-overview") text = await applyP5Overview();
    else if (message.action === "apply-p5-component-index") text = await applyP5ComponentIndex();
    else if (message.action === "apply-p5-player-evidence") text = await applyP5PlayerEvidence();
    else if (message.action === "apply-p5-user-flows") text = await applyP5UserFlows();
    else if (message.action === "apply-p5-page-order") text = await applyP5PageOrder();
    else if (message.action === "validate-p5") text = await validateP5();
    else if (message.action === "focus") text = await focusThemesPage();
    else throw new Error(`Unknown action: ${message.action}`);
    figma.ui.postMessage({ type: "result", text });
  } catch (error) {
    figma.ui.postMessage({
      type: "result",
      text: `ERROR\n${errorText(error)}`
    });
  }
};
