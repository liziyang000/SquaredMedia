import { execFileSync } from "node:child_process";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(pluginDir, "../..");
const plan = JSON.parse(await readFile(join(pluginDir, "baseline-plan.json"), "utf8"));
const pluginTemplate = await readFile(join(pluginDir, "code.template.js"), "utf8");
const stateLedgerTemplate = JSON.parse(await readFile(join(pluginDir, "state-ledger.template.json"), "utf8"));
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

function unique(values) {
  return new Set(values).size === values.length;
}

function product(values) {
  return values.reduce((total, value) => total * value.length, 1);
}

function combinationNames(dimensions) {
  return Object.entries(dimensions)
    .reduce(
      (combinations, [dimension, values]) => combinations.flatMap((combination) => values.map((value) => [...combination, `${dimension}=${value}`])),
      [[]]
    )
    .map((combination) => combination.join(", "));
}

function collectStrings(value, output = []) {
  if (typeof value === "string") {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output);
    return output;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, output);
  }
  return output;
}

async function exists(relativePath) {
  try {
    await access(join(projectDir, relativePath));
    return true;
  } catch {
    return false;
  }
}

const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], {
  cwd: projectDir,
  encoding: "utf8"
}).trim();
const branch = execFileSync("git", ["branch", "--show-current"], {
  cwd: projectDir,
  encoding: "utf8"
}).trim();

check(head === plan.source.commit, `source commit drift: ${head}`);
check(branch === plan.source.branch, `source branch drift: ${branch}`);
check(plan.source.snapshot === `${branch}@${head} + working tree`, "working-tree source snapshot must be explicit");
check(plan.source.workingTree === true, "Pixel Frog baseline must declare working-tree evidence");
check(plan.schemaVersion === 2, "baseline plan schemaVersion must be 2");
check(plan.figma.fileKey === "Q2QxBpgexgeL4CcXgSYX9v", "wrong Figma file");
check(
  JSON.stringify(plan.contentPolicy) ===
    JSON.stringify({
      videoMedia: "placeholder",
      videoText: "测试文本",
      preserveStructuralCopy: true,
      rawEvidenceReadOnly: true
    }),
  "content policy must require placeholder video media, test text, structural copy, and read-only Raw Evidence"
);
check(plan.defaultPrototype.fullCoverageTheme === "liquid-cinema", "only Liquid Cinema may receive full prototype coverage");
check(plan.defaultPrototype.viewports.join("|") === "1440|768|390", "default prototype viewport contract changed");
check(
  Object.entries(plan.defaultPrototype.coverageByTheme)
    .filter(([, coverage]) => coverage === "full")
    .map(([themeId]) => themeId)
    .join("|") === "liquid-cinema",
  "exactly one theme must receive full prototype coverage"
);
check(
  plan.themes
    .slice(1)
    .every((theme) => plan.defaultPrototype.coverageByTheme[theme.id] === "documentation-only"),
  "non-default themes must remain documentation-only"
);
check(
  plan.defaultPrototype.nonDefaultThemeDeliverables.join("|") ===
    "colors|radii|gradients-and-shadows|unique-svg|special-layout-rules|source-references",
  "non-default theme documentation contract changed"
);
check(plan.rawEvidenceProtection.pageName === "92 · Raw Evidence · html.to.design · 2026-07-28", "Raw Evidence page contract changed");
check(plan.rawEvidenceProtection.operation === "rename-only", "Raw Evidence must remain rename-only");
check(plan.rawEvidenceProtection.readOnly === true, "Raw Evidence must remain read-only");
check(plan.rawEvidenceProtection.expectedTopLevelCount === 26, "Raw Evidence top-level protection count changed");
check(plan.rawEvidenceProtection.expectedSignature === "fnv1a32:c87a024c", "Raw Evidence protection signature changed");
check(
  plan.rawEvidenceProtection.prohibitedMutations.join("|") ===
    "move|delete|overwrite|rename-import-roots|set-plugin-data",
  "Raw Evidence prohibited-mutation contract changed"
);
check(plan.rawEvidenceProtection.indexRequired === true, "Raw Evidence runtime index must be required");
check(
  plan.rawEvidenceProtection.indexKeys.join("|") ===
    "archetypeId|state|viewport|rawPageId|topLevelImportRootId|exactViewportNodeId|captureUrl|width|height|textSignatures|sourceKind",
  "Raw Evidence runtime index fields changed"
);
check(
  plan.rawEvidenceProtection.sourceKinds.join("|") === "raw-captured|code-derived|runtime-only",
  "Raw Evidence source-kind contract changed"
);
check(
  plan.rawEvidenceProtection.disambiguationKeys.join("|") ===
    "captureUrl|viewport|textSignatures|topLevelImportRootId",
  "Raw Evidence disambiguation contract changed"
);
check(
  !collectStrings(plan.rawEvidenceProtection).some((value) => /\b\d+:\d+\b/.test(value)),
  "Raw Evidence runtime node ids must not be hard-coded in the plan"
);
const expectedComponentAliases = {
  SiteHeader: "Navigation/SiteHeader",
  MobileDrawer: "Navigation/MobileDrawer",
  ActionButton: "Action/StandardButton",
  FavoriteButton: "Action/FavoriteButton",
  TextField: "Form/LoginField",
  CaptchaField: "Form/CaptchaField",
  VodCard: "Media/VodCard",
  QualityBadge: "Media/CardQualityBadge",
  Dialog: "Reference/BrowserConfirm",
  Notice: "Feedback/SiteNotice",
  MacCmsPlayer: "Player/MacCmsPlayer",
  PageStatus: "Status/PageStatus",
  EmptyState: "Status/EmptyState",
  Pagination: "Navigation/Pagination"
};
check(
  JSON.stringify(plan.componentAliases) === JSON.stringify(expectedComponentAliases),
  "component alias contract changed"
);
check(Boolean(stateLedgerTemplate.phases.P5), "state ledger P5 contract missing");
const pluginNamespace = pluginTemplate.match(/const NS = "([^"]+)"/)?.[1];
check(/^[A-Za-z0-9_.]+$/.test(pluginNamespace || ""), "invalid sharedPluginData namespace");
check(pluginTemplate.includes('aliases.add("网页布局截图_html_to_design")'), "current raw-import page alias missing");
check(!/\.textStyleId\s*=/.test(pluginTemplate), "dynamic-page plugins must use setTextStyleIdAsync");
check(pluginTemplate.includes('frame.primaryAxisSizingMode = direction === "VERTICAL" ? "AUTO" : "FIXED"'), "auto-layout primary axis contract missing");
check(pluginTemplate.includes('frame.counterAxisSizingMode = direction === "VERTICAL" ? "FIXED" : "AUTO"'), "auto-layout counter axis contract missing");
check(pluginTemplate.includes("frame.clipsContent = false"), "auto-layout reference frames must not clip content");
check(pluginTemplate.includes('data-action="audit-formal-readiness"'), "formal readiness audit action missing");
check(
  pluginTemplate.includes("allTextStyles.filter((style) => MAINTAINED_TEXT_STYLE_PREFIXES.some"),
  "imported text styles must stay isolated from the maintained Foundations inventory"
);
for (const action of [
  "apply-p5-overview",
  "apply-p5-component-index",
  "apply-p5-player-evidence",
  "apply-p5-user-flows",
  "apply-p5-page-order",
  "validate-p5"
]) {
  check(pluginTemplate.includes(`data-action="${action}"`), `formal prototype action missing: ${action}`);
}
check(plan.figma.targetTitle.includes("MacCMS"), "target title must identify MacCMS");
check(plan.themes.length === 5, "theme count must be 5");
check(plan.archetypes.length === 30, "archetype count must be 30");
check(plan.pages.length === 24, "page plan count must be 24");
check(plan.breakpoints.length === 12, "responsive breakpoint count must be 12");
check(plan.mediaConditions.length === 4, "environmental media-condition count must be 4");
check(plan.responsivePatterns.length === 10, "responsive pattern count must be 10");
check(plan.navigationFlows.length === 8, "navigation flow count must be 8");
check(plan.interactionFacts.length === 14, "interaction behavior contract must contain 14 entries");
check(plan.knownThemeIssues.length === 4, "Pixel Frog known-issue contract must contain 4 entries");
check(unique(plan.knownThemeIssues.map((item) => item.id)), "duplicate Pixel Frog known-issue ids");
check(unique(plan.pages.map((item) => item.name)), "duplicate page names");
check(
  plan.formalPrototype.pageOrder.join("|") === plan.pages.map((item) => item.name).join("|"),
  "formal page order must exactly match the planned page sequence"
);
check(unique(plan.formalPrototype.pageOrder), "duplicate formal page order entries");
check(plan.formalPrototype.componentCategories.length === 7, "formal component category count must be 7");
check(unique(plan.formalPrototype.componentCategories.map((item) => item.id)), "duplicate formal component category ids");
check(unique(plan.formalPrototype.componentCategories.map((item) => item.name)), "duplicate formal component category names");
const categorizedComponents = plan.formalPrototype.componentCategories.flatMap((item) => item.components);
const expectedFormalComponents = [...plan.existingFigmaComponents, ...plan.componentBuilds.map((item) => item.name)];
check(unique(categorizedComponents), "formal component categories contain duplicate components");
check(
  [...categorizedComponents].sort().join("|") === [...expectedFormalComponents].sort().join("|"),
  "formal component categories must cover every existing and planned component exactly once"
);
check(plan.formalPrototype.prototypeFlows.length === 5, "formal prototype flow count must be 5");
check(unique(plan.formalPrototype.prototypeFlows.map((item) => item.id)), "duplicate formal prototype flow ids");
for (const flow of plan.formalPrototype.prototypeFlows) {
  check(plan.navigationFlows.some((item) => item.id === flow.sourceFlowId), `${flow.id} references an unknown source flow`);
  check(flow.steps.length === 4, `${flow.id} must contain exactly four source-backed steps`);
}
check(plan.formalPrototype.playerEvidence.length === 2, "player evidence state count must be 2");
check(unique(plan.formalPrototype.playerEvidence.map((item) => item.id)), "duplicate player evidence ids");
check(plan.formalPrototype.codeCoverageAddendum.length === 13, "code coverage addendum count must be 13");
check(unique(plan.formalPrototype.codeCoverageAddendum.map((item) => item.id)), "duplicate code coverage addendum ids");
check(unique(plan.formalPrototype.codeCoverageAddendum.flatMap((item) => item.sourceFiles)), "code coverage addendum contains duplicate source files");
check(
  plan.formalPrototype.maintainedTextStylePrefixes.join("|") === "Display/|Heading/|Body/|Label/|Mono/",
  "maintained text-style prefix contract changed"
);
check(
  plan.formalPrototype.maintainedEffectStylePrefixes.join("|") === "Shadow/|Cinema/|Focus/|Selected/",
  "maintained effect-style prefix contract changed"
);
check(unique(plan.archetypes.map((item) => item.id)), "duplicate archetype ids");
check(unique(plan.archetypes.map((item) => item.name)), "duplicate archetype names");
check(plan.requiredPageStates.join("|") === "normal|loading|empty|error|permission", "required page states changed");
check(plan.requiredComponentStates.join("|") === "default|hover|pressed|disabled|loading|error", "required component states changed");
check(plan.statusTokens.map((item) => item.id).join("|") === "loading|success|warning|error|neutral|disabled", "status token contract changed");
check(plan.componentBuilds.length === 9, "exactly 9 current-code component families must be built");
check(plan.existingFigmaComponents.length === 18, "existing Figma component contract must contain 18 names");
check(unique(plan.existingFigmaComponents), "duplicate existing Figma component names");
check(plan.existingComponentStateContracts.length === 18, "existing component state contract must contain 18 entries");
check(unique(plan.existingComponentStateContracts.map((item) => item.name)), "duplicate existing component state contracts");
check(
  plan.existingComponentStateContracts.map((item) => item.name).join("|") === plan.existingFigmaComponents.join("|"),
  "existing component state contracts must match the audited Figma component order"
);
check(unique(plan.componentBuilds.map((item) => item.id)), "duplicate component build ids");
check(unique(plan.componentBuilds.map((item) => item.name)), "duplicate component build names");
check(
  plan.componentBuilds.map((item) => item.name).join("|") ===
    "Action/StandardButton|Action/FavoriteButton|Action/LoginSubmit|Form/HeaderSearch|Form/LoginField|Reference/BrowserConfirm|Feedback/SiteNotice|Playback/SourceQualityStatus|Media/CardQualityBadge",
  "component build family contract changed"
);
check(!plan.pages.some((item) => /settings/i.test(item.name)), "do not invent a standalone Settings page");
check(
  plan.pages.some((item) => item.name === "16 · Games" && item.operation === "rename-from:16 · Issues"),
  "Games rename missing"
);
check(
  plan.pages.some((item) => item.name === "90 · Issues / Recorded Only"),
  "recorded-only Issues page missing"
);
check(plan.pages.some((item) => item.name === "00 · Project Overview"), "formal Project Overview page missing");
check(plan.pages.some((item) => item.name === "19 · User Flows"), "formal User Flows page missing");
check(
  plan.pages.some((item) => item.name.startsWith("91 · Archive · Next.js")),
  "historical Next.js archive page missing"
);

const activeMappingText = JSON.stringify({
  archetypes: plan.archetypes,
  components: plan.components,
  existingFigmaComponents: plan.existingFigmaComponents,
  existingComponentStateContracts: plan.existingComponentStateContracts,
  componentBuilds: plan.componentBuilds,
  navigationFlows: plan.navigationFlows,
  settingsSurfaces: plan.settingsSurfaces,
  machineOutputs: plan.machineOutputs,
  sourceRoots: plan.source.sourceRoots
});
check(!activeMappingText.includes("apps/web"), "active mapping must not reference historical apps/web");
check(
  plan.archiveReferences.some((item) => item.includes("apps/web")),
  "historical Next.js archive reference missing"
);

for (const sourceRoot of plan.source.sourceRoots) {
  check(await exists(sourceRoot), `missing source root: ${sourceRoot}`);
}
check(unique(plan.sourceCoverage.trackedExtensions), "duplicate tracked source extensions");
check(
  plan.sourceCoverage.trackedExtensions.every((extension) => extension.startsWith(".")),
  "tracked source extensions must start with a period"
);
check(Boolean(plan.sourceCoverage.policy), "source coverage policy missing");
const trackedExtensionSet = new Set(plan.sourceCoverage.trackedExtensions);
const excludedSourceDirectories = new Set(plan.sourceCoverage.excludedDirectories);
const trackedSourceFiles = [];
async function collectTrackedSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!excludedSourceDirectories.has(entry.name)) await collectTrackedSourceFiles(absolutePath);
      continue;
    }
    if (entry.isFile() && trackedExtensionSet.has(extname(entry.name))) {
      trackedSourceFiles.push(relative(projectDir, absolutePath).replaceAll("\\", "/"));
    }
  }
}
for (const sourceRoot of plan.source.sourceRoots) {
  await collectTrackedSourceFiles(join(projectDir, sourceRoot));
}
trackedSourceFiles.sort();
check(
  trackedSourceFiles.length === plan.sourceCoverage.expectedTrackedFileCount,
  `tracked source file count ${trackedSourceFiles.length}/${plan.sourceCoverage.expectedTrackedFileCount}`
);
const mappedSourceFiles = new Set(
  collectStrings(plan).filter((value) => plan.source.sourceRoots.some((sourceRoot) => value.startsWith(`${sourceRoot}/`)))
);
const unmappedSourceFiles = trackedSourceFiles.filter((sourceFile) => !mappedSourceFiles.has(sourceFile));
check(
  unmappedSourceFiles.length === 0,
  `tracked source files missing from the Figma development map:\n${unmappedSourceFiles.join("\n")}`
);

for (const state of plan.formalPrototype.playerEvidence) {
  check(state.textSignatures.length >= 2, `${state.id} player evidence signatures missing`);
  check(state.expectedViewports.join("|") === "1440|768|390", `${state.id} player evidence viewport contract changed`);
  for (const sourceFile of state.sourceFiles) {
    check(await exists(sourceFile), `${state.id} missing ${sourceFile}`);
  }
}
for (const item of plan.formalPrototype.codeCoverageAddendum) {
  check(Boolean(item.classification), `${item.id} coverage classification missing`);
  check(Boolean(item.representation), `${item.id} coverage representation missing`);
  check(item.sourceFiles.length > 0, `${item.id} coverage source files missing`);
  for (const sourceFile of item.sourceFiles) {
    check(await exists(sourceFile), `${item.id} missing ${sourceFile}`);
  }
}

for (const archetype of plan.archetypes) {
  check(archetype.templates.length > 0, `${archetype.id} has no template`);
  for (const template of archetype.templates) {
    check(await exists(template), `${archetype.id} missing ${template}`);
  }
}
const correctedArchetypeContracts = {
  A03: { components: ["SiteHeader", "VodCard", "Pagination"], states: ["normal"] },
  A04: { components: ["SiteHeader", "VodCard", "Pagination"], states: ["normal"] },
  A11: { components: ["TextField", "ActionButton"], states: ["normal"] },
  A12: { components: ["TextField", "ActionButton"], states: ["normal"] },
  A13: { components: ["SiteHeader", "SystemBox", "ActionButton"], states: ["normal"] },
  A14: {
    components: ["SiteHeader", "RecordItem", "EmptyState", "Dialog", "ActionButton"],
    states: ["normal", "empty"]
  },
  A15: {
    components: ["SiteHeader", "FavoriteCard", "EmptyState", "Dialog", "ActionButton"],
    states: ["normal", "empty"]
  },
  A16: { components: ["SiteHeader", "DeviceCard", "Dialog", "ActionButton"], states: ["normal", "empty"] },
  A23: { components: ["SiteHeader", "DownloadList", "PasswordGate", "ActionButton"], states: ["normal"] },
  A24: { components: ["SystemBox", "PasswordGate", "ActionButton"], states: ["normal"] },
  A25: { components: ["SiteHeader", "PlotItem", "SystemBox", "ActionButton"], states: ["normal"] },
  A26: { components: ["CommentForm", "CommentItem", "CaptchaField", "ActionButton"], states: ["normal"] },
  A27: { components: ["FeedbackForm", "ReportForm", "CaptchaField", "ActionButton"], states: ["normal"] },
  A28: { components: ["SiteHeader", "SystemBox", "ActionButton"], states: ["normal"] },
  A29: { components: ["SiteHeader", "SystemBox", "ActionButton"], states: ["normal"] }
};
for (const [archetypeId, expected] of Object.entries(correctedArchetypeContracts)) {
  const archetype = plan.archetypes.find((item) => item.id === archetypeId);
  check(Boolean(archetype), `${archetypeId} corrected archetype contract missing`);
  if (!archetype) continue;
  check(
    archetype.components.join("|") === expected.components.join("|"),
    `${archetypeId} components exceed or drift from current code`
  );
  check(archetype.states.join("|") === expected.states.join("|"), `${archetypeId} states exceed or drift from current code`);
}
for (const archetypeId of ["A28", "A29"]) {
  const archetype = plan.archetypes.find((item) => item.id === archetypeId);
  for (const template of archetype?.templates || []) {
    const source = await readFile(join(projectDir, template), "utf8");
    check(source.includes("system-box module-fallback"), `${archetypeId} template is not a SystemBox module fallback: ${template}`);
  }
}

for (const component of plan.components) {
  for (const sourceFile of component.sourceFiles) {
    check(await exists(sourceFile), `${component.name} missing ${sourceFile}`);
  }
}
const structuralDefaultStates = new Set(["desktop", "desktop-six-column", "closed", "empty"]);
for (const contract of plan.existingComponentStateContracts) {
  check(contract.states.length > 0, `${contract.name} has no source states`);
  check(unique(contract.states), `${contract.name} has duplicate source states`);
  check(
    contract.states.includes("default") || contract.states.some((state) => structuralDefaultStates.has(state)),
    `${contract.name} has no default or structural default state`
  );
  check(contract.sourceFiles.length > 0, `${contract.name} has no source files`);
  check(unique(contract.sourceFiles), `${contract.name} has duplicate source files`);
  for (const sourceFile of contract.sourceFiles) {
    check(await exists(sourceFile), `${contract.name} missing ${sourceFile}`);
  }
}
check(unique(plan.navigationFlows.map((flow) => flow.id)), "duplicate navigation flow ids");
check(unique(plan.navigationFlows.map((flow) => flow.name)), "duplicate navigation flow names");
for (const flow of plan.navigationFlows) {
  check(flow.steps.length >= 4, `${flow.id} navigation flow is incomplete`);
  check(Boolean(flow.entry), `${flow.id} navigation entry missing`);
  check(Boolean(flow.transition), `${flow.id} navigation transition missing`);
  for (const sourceFile of flow.sourceFiles) {
    check(await exists(sourceFile), `${flow.id} missing ${sourceFile}`);
  }
}
check(unique(plan.interactionFacts.map((fact) => fact.name)), "duplicate interaction fact names");
for (const fact of plan.interactionFacts) {
  check(await exists(fact.source), `${fact.name} missing ${fact.source}`);
  check(Boolean(fact.behavior), `${fact.name} behavior missing`);
  check(fact.evidence.length > 0, `${fact.name} evidence missing`);
  check(unique(fact.evidence), `${fact.name} has duplicate evidence`);
  const source = await readFile(join(projectDir, fact.source), "utf8");
  for (const needle of fact.evidence) {
    check(source.includes(needle), `${fact.name} source evidence missing: ${needle}`);
  }
}
check(plan.componentInteractionContracts.length === 22, "component interaction contract count must be 22");
check(unique(plan.componentInteractionContracts.map((contract) => contract.id)), "duplicate component interaction contract ids");
check(unique(plan.componentInteractionContracts.map((contract) => contract.component)), "duplicate component interaction contract components");
check(
  plan.componentInteractionContracts.map((contract) => contract.id).join("|") ===
    Array.from({ length: 22 }, (_, index) => `IC${String(index + 1).padStart(2, "0")}`).join("|"),
  "component interaction contract id sequence changed"
);
const interactionEvidenceCache = new Map();
for (const contract of plan.componentInteractionContracts) {
  check(contract.states.length > 0, `${contract.id} interaction states missing`);
  check(unique(contract.states), `${contract.id} has duplicate interaction states`);
  check(Boolean(contract.trigger), `${contract.id} interaction trigger missing`);
  check(Boolean(contract.action), `${contract.id} interaction action missing`);
  check(Boolean(contract.transition), `${contract.id} interaction transition missing`);
  check(Object.hasOwn(contract, "durationMs"), `${contract.id} interaction duration missing`);
  check(contract.conditions.length > 0, `${contract.id} interaction conditions missing`);
  check(contract.sourceFiles.length > 0, `${contract.id} interaction source files missing`);
  check(unique(contract.sourceFiles), `${contract.id} has duplicate interaction source files`);
  check(contract.evidence.length > 0, `${contract.id} interaction evidence missing`);
  check(unique(contract.evidence), `${contract.id} has duplicate interaction evidence`);
  const evidenceChunks = [];
  for (const sourceFile of contract.sourceFiles) {
    check(await exists(sourceFile), `${contract.id} interaction source missing: ${sourceFile}`);
    if (!interactionEvidenceCache.has(sourceFile)) {
      try {
        interactionEvidenceCache.set(sourceFile, await readFile(join(projectDir, sourceFile), "utf8"));
      } catch {
        interactionEvidenceCache.set(sourceFile, "");
      }
    }
    evidenceChunks.push(interactionEvidenceCache.get(sourceFile));
  }
  const sourceEvidence = evidenceChunks.join("\n");
  for (const needle of contract.evidence) {
    check(sourceEvidence.includes(needle), `${contract.id} interaction evidence missing: ${needle}`);
  }
}
const interactionContractsById = new Map(plan.componentInteractionContracts.map((contract) => [contract.id, contract]));
check(interactionContractsById.get("IC01")?.action.includes("MacCMS route"), "navigation must remain browser/MacCMS route driven");
check(interactionContractsById.get("IC01")?.conditions.includes("no global page-transition animation"), "global page transitions must not be invented");
check(interactionContractsById.get("IC02")?.durationMs === 560, "theme flare duration must remain 560ms");
check(interactionContractsById.get("IC03")?.durationMs === 240, "mobile drawer duration must remain 240ms");
check(interactionContractsById.get("IC04")?.states.join("|") === "expanded|compact", "mobile header state contract changed");
check(
  JSON.stringify(interactionContractsById.get("IC05")?.durationMs) === JSON.stringify({ transition: 200, visible: 2400 }),
  "site notice duration contract changed"
);
check(interactionContractsById.get("IC06")?.durationMs === 0, "standard button hover must remain instant in Figma");
check(
  interactionContractsById.get("IC07")?.states.join("|") === "default|loading|favorited|failure-default",
  "favorite action state contract changed"
);
check(interactionContractsById.get("IC12")?.durationMs?.autoplayInterval === 5200, "carousel autoplay interval changed");
check(
  interactionContractsById.get("IC17")?.states.join("|") ===
    "loading|available|slow|failed|timeout|unsupported|missing|recommended",
  "source-quality state contract changed"
);
check(interactionContractsById.get("IC18")?.conditions.includes("code-derived and deployment-dependent"), "player recovery provenance missing");
check(
  interactionContractsById.get("IC20")?.conditions.includes(
    "the only shared control family with a source-backed :active pressed state"
  ),
  "pressed-state scope must remain limited to Blockrain controls"
);
check(
  ["IC21", "IC22"].every((id) => interactionContractsById.get(id)?.transition.includes("do not create a project modal")),
  "native confirm and alert must not be represented as a project modal"
);

const css = await readFile(join(projectDir, "template/pingfangvideo/css/style.css"), "utf8");
const headTemplate = await readFile(join(projectDir, "template/pingfangvideo/html/public/head.html"), "utf8");
const appJs = await readFile(join(projectDir, "template/pingfangvideo/js/app.js"), "utf8");
const evidenceFiles = new Set(plan.components.flatMap((component) => component.sourceFiles));
const evidenceChunks = [css, headTemplate, appJs];
for (const relativePath of evidenceFiles) {
  try {
    evidenceChunks.push(await readFile(join(projectDir, relativePath), "utf8"));
  } catch {
    // Directories and non-text sources are existence-checked above.
  }
}
const evidence = evidenceChunks.join("\n");
for (const issue of plan.knownThemeIssues) {
  check(Boolean(issue.name), `${issue.id} missing name`);
  check(Boolean(issue.behavior), `${issue.id} missing behavior`);
  check(issue.evidence.length > 0, `${issue.id} missing evidence`);
  for (const sourceNeedle of issue.evidence) {
    check(css.includes(sourceNeedle), `${issue.id} evidence missing: ${sourceNeedle}`);
  }
}

const expectedStatusTokens = {
  loading: ["var(--accent-2)", "var(--line-accent-soft)", "var(--panel)", 1],
  success: ["var(--accent-2)", "var(--line-accent)", "var(--selected-bg)", 1],
  warning: ["var(--gold)", "var(--line-gold)", "var(--surface-strong)", 1],
  error: ["var(--accent)", "var(--line-warm)", "var(--surface-strong)", 1],
  neutral: ["var(--muted)", "var(--line)", "var(--panel)", 1],
  disabled: ["var(--text)", "var(--line)", "var(--panel)", 0.72]
};
for (const token of plan.statusTokens) {
  const expected = expectedStatusTokens[token.id];
  check(Boolean(expected), `unexpected status token: ${token.id}`);
  if (expected) {
    check([token.foreground, token.border, token.background, token.opacity].join("|") === expected.join("|"), `status token values changed: ${token.id}`);
  }
  for (const reference of [token.foreground, token.border, token.background]) {
    const variableName = reference.match(/^var\((--[^)]+)\)$/)?.[1];
    check(Boolean(variableName && css.includes(`${variableName}:`)), `status token CSS variable missing: ${token.id}/${reference}`);
  }
  check(token.sourceSelectors.length > 0, `status token has no source selectors: ${token.id}`);
  for (const selector of token.sourceSelectors) {
    check(css.includes(selector), `status token selector missing: ${token.id}/${selector}`);
  }
}

const plannedComponentNames = new Set(plan.components.filter((item) => item.status === "planned").map((item) => item.name));
for (const build of plan.componentBuilds) {
  const dimensions = Object.values(build.variantDimensions);
  const combinations = build.variants || null;
  const calculatedCount = combinations ? combinations.length : product(dimensions);
  const names = combinations
    ? combinations.map((combination) =>
        Object.entries(combination)
          .map(([dimension, value]) => `${dimension}=${value}`)
          .join(", ")
      )
    : combinationNames(build.variantDimensions);
  check(calculatedCount === build.variantCount, `${build.id} variant count ${build.variantCount}/${calculatedCount}`);
  check(calculatedCount <= 30, `${build.id} exceeds the 30-variant limit`);
  check(unique(names), `${build.id} has duplicate explicit variants`);
  for (const combination of combinations || []) {
    check(
      Object.keys(combination).join("|") === Object.keys(build.variantDimensions).join("|"),
      `${build.id} explicit variant dimensions do not match the declared order`
    );
    for (const [dimension, value] of Object.entries(combination)) {
      check(build.variantDimensions[dimension]?.includes(value), `${build.id} explicit variant has unknown ${dimension}=${value}`);
    }
  }
  check(plannedComponentNames.has(build.name), `${build.id} has no matching planned component`);
  check(Array.isArray(build.notImplementedVariants), `${build.id} missing notImplementedVariants`);
  check(unique(build.notImplementedVariants), `${build.id} has duplicate notImplementedVariants`);
  for (const variant of build.notImplementedVariants) {
    check(names.includes(variant), `${build.id} unknown notImplemented variant: ${variant}`);
  }
  const evidenceDimension =
    build.variantDimensions.State || build.variantDimensions.Tone || Object.values(build.variantDimensions)[0] || [];
  const evidenceValues = [...new Set(evidenceDimension)];
  for (const state of evidenceValues) {
    check(Object.hasOwn(build.stateEvidence, state), `${build.id} missing evidence declaration for ${state}`);
    for (const sourceNeedle of build.stateEvidence[state] || []) {
      check(evidence.includes(sourceNeedle), `${build.id}/${state} evidence missing: ${sourceNeedle}`);
    }
  }
}
check(plan.componentBuilds.find((item) => item.id === "feedback-dialog")?.referenceOnly === true, "browser-native dialog must remain reference-only");

const requestedComponentCoverage = [
  "Navigation/SiteHeader",
  "Action/StandardButton",
  "Action/LoginSubmit",
  "Form/HeaderSearch",
  "Form/LoginField",
  "Media/VodCard",
  "Media/CardQualityBadge",
  "Reference/BrowserConfirm",
  "Playback/SourceQualityStatus",
  "Player/MacCmsPlayer",
  "Status/PageStatus",
  "Status/EmptyState"
];
const componentNames = new Set(plan.components.map((item) => item.name));
for (const componentName of requestedComponentCoverage) {
  check(componentNames.has(componentName), `required component category missing: ${componentName}`);
}
for (const [alias, canonicalName] of Object.entries(plan.componentAliases)) {
  check(componentNames.has(canonicalName), `component alias target missing: ${alias} -> ${canonicalName}`);
}

check(plan.settingsSurfaces.length === 4, "settings surfaces count must be 4");
for (const surface of plan.settingsSurfaces) {
  for (const sourceFile of surface.sourceFiles) {
    check(await exists(sourceFile), `${surface.name} missing ${sourceFile}`);
  }
}
check(plan.integrationStatus.settingsRoute.startsWith("No standalone settings route"), "settings route policy must remain source-backed");
check(plan.integrationStatus.codeConnect.startsWith("Not published:"), "do not claim unpublished Code Connect coverage");
check(
  plan.integrationStatus.codeConnectIncludedInCurrentPhase === false,
  "Code Connect must remain excluded from the current phase"
);

check(plan.machineOutputs.length === 4, "machine-output group count must be 4");
for (const output of plan.machineOutputs) {
  check(output.visualFrame === false, `${output.name} must remain developer reference only`);
  for (const template of output.templates) {
    check(await exists(template), `${output.name} missing ${template}`);
  }
}

for (const archetype of plan.archetypes) {
  check(
    archetype.states.every((state) => plan.requiredPageStates.includes(state)),
    `${archetype.id} has an unknown page state`
  );
}

for (const theme of plan.themes) {
  if (theme.option === "default") {
    check(css.includes("/* Liquid cinema"), "default theme marker missing");
  } else {
    check(headTemplate.includes(`data-theme-option="${theme.option}"`), `theme option missing: ${theme.option}`);
    check(appJs.includes(`"${theme.option}": true`), `validThemes missing: ${theme.option}`);
    check(css.includes(`data-theme="${theme.option}"`), `theme CSS missing: ${theme.option}`);
  }
  check(theme.tokens.length >= 14, `${theme.id} token coverage too small`);
  check(unique(theme.tokens.map((token) => token.css)), `${theme.id} duplicate CSS tokens`);
}
check(
  Object.keys(plan.defaultPrototype.coverageByTheme).join("|") === plan.themes.map((theme) => theme.id).join("|"),
  "default prototype theme coverage must match the theme inventory"
);

const breakpointSourceFiles = [...new Set(plan.breakpoints.map((item) => item.sourceFile))];
for (const sourceFile of breakpointSourceFiles) {
  check(Boolean(sourceFile), "breakpoint source file missing");
  const sourceCss = await readFile(join(projectDir, sourceFile), "utf8");
  const sourceBreakpoints = plan.breakpoints.filter((item) => item.sourceFile === sourceFile);
  for (const breakpoint of sourceBreakpoints) {
    const needle = breakpoint.axis === "height" ? `max-height: ${breakpoint.max}px` : `max-width: ${breakpoint.max}px`;
    check(sourceCss.includes(needle), `${sourceFile} breakpoint missing: ${needle}`);
    check(Boolean(breakpoint.scope), `${breakpoint.id} scope missing`);
  }
  const mediaQueries = Array.from(sourceCss.matchAll(/@media\s+([^{]+)\{/g), (match) => match[1]);
  for (const axis of ["width", "height"]) {
    const cssBreakpoints = [
      ...new Set(
        mediaQueries.flatMap((query) =>
          Array.from(query.matchAll(new RegExp(`max-${axis}:\\s*(\\d+)px`, "g")), (match) => Number(match[1]))
        )
      )
    ].sort((left, right) => right - left);
    const plannedBreakpoints = [
      ...new Set(sourceBreakpoints.filter((item) => item.axis === axis).map((item) => item.max))
    ].sort((left, right) => right - left);
    check(
      JSON.stringify(plannedBreakpoints) === JSON.stringify(cssBreakpoints),
      `${sourceFile} ${axis} breakpoint inventory is incomplete`
    );
  }
}
for (const condition of plan.mediaConditions) {
  check(css.includes(`@media ${condition.query}`), `media condition missing: ${condition.query}`);
}
const responsiveFamilies = new Set(plan.responsivePatterns.flatMap((pattern) => pattern.families));
for (const family of new Set(plan.archetypes.map((archetype) => archetype.family))) {
  check(responsiveFamilies.has(family), `responsive pattern missing family: ${family}`);
}
check(responsiveFamilies.has("global"), "global responsive navigation pattern missing");
for (const pattern of plan.responsivePatterns) {
  check(pattern.sourceSelectors.length > 0, `${pattern.id} has no responsive source selectors`);
  for (const selector of pattern.sourceSelectors) {
    check(css.includes(selector), `${pattern.id} selector missing: ${selector}`);
  }
  for (const viewport of ["desktop", "tablet", "mobile", "visibility", "navigation", "cards"]) {
    check(Boolean(pattern[viewport]), `${pattern.id} missing ${viewport} rule`);
  }
}

for (const group of plan.assetGroups) {
  check(await exists(group.directory), `asset directory missing: ${group.directory}`);
}

const dunhuangFiles = await readdir(join(projectDir, "template/pingfangvideo/images/dunhuang"));
const pixelFiles = await readdir(join(projectDir, "template/pingfangvideo/images/pixel"));
const brandFiles = await readdir(join(projectDir, "template/pingfangvideo/images/brand"));
check(dunhuangFiles.filter((name) => name.endsWith(".svg")).length === 8, "Dunhuang SVG count must be 8");
check(pixelFiles.filter((name) => name.endsWith(".svg")).length === 12, "Pixel Frog SVG count must be 12");
check(brandFiles.filter((name) => !name.startsWith(".")).length >= 18, "brand asset count is unexpectedly small");
const expectedAssetPaths = [
  "template/pingfangvideo/images/site-logo.png",
  ...brandFiles.filter((name) => !name.startsWith(".")).map((name) => `template/pingfangvideo/images/brand/${name}`),
  ...dunhuangFiles.filter((name) => !name.startsWith(".")).map((name) => `template/pingfangvideo/images/dunhuang/${name}`),
  ...pixelFiles.filter((name) => !name.startsWith(".")).map((name) => `template/pingfangvideo/images/pixel/${name}`)
].sort();
const inventoryPaths = plan.assetInventory.map((item) => item.path).sort();
check(plan.assetInventory.length === 40, "asset inventory count must be 40");
check(unique(inventoryPaths), "duplicate asset inventory paths");
check(JSON.stringify(inventoryPaths) === JSON.stringify(expectedAssetPaths), "asset inventory does not exactly match current source files");
for (const asset of plan.assetInventory) {
  check(await exists(asset.path), `asset inventory file missing: ${asset.path}`);
  check(Boolean(asset.dimensions), `asset dimensions missing: ${asset.path}`);
  check(Boolean(asset.usage), `asset usage missing: ${asset.path}`);
  check(["referenced", "not referenced by current theme"].includes(asset.status), `asset status invalid: ${asset.path}`);
  check(Boolean(asset.colorBehavior), `asset color behavior missing: ${asset.path}`);
}
for (const svgName of dunhuangFiles.filter((name) => name.endsWith(".svg"))) {
  const svg = await readFile(join(projectDir, "template/pingfangvideo/images/dunhuang", svgName), "utf8");
  check(!svg.includes("currentColor"), `Dunhuang SVG color behavior changed: ${svgName}`);
}
for (const svgName of pixelFiles.filter((name) => name.endsWith(".svg"))) {
  const svg = await readFile(join(projectDir, "template/pingfangvideo/images/pixel", svgName), "utf8");
  check(svg.includes('shape-rendering="crispEdges"'), `Pixel Frog SVG must preserve crisp edges: ${svgName}`);
}

const templateSource = await readFile(join(pluginDir, "code.template.js"), "utf8");
const builtSource = await readFile(join(pluginDir, "code.js"), "utf8");
const ledger = JSON.parse(await readFile(join(pluginDir, "state-ledger.template.json"), "utf8"));
try {
  execFileSync(
    join(projectDir, "node_modules/.bin/eslint"),
    [
      "--no-config-lookup",
      "--global",
      "figma",
      "--global",
      "__BASELINE_PLAN__",
      "--global",
      "__ASSET_PAYLOAD__",
      "--global",
      "console",
      "--rule",
      '{"no-undef":"error"}',
      join(pluginDir, "code.js")
    ],
    { cwd: projectDir, encoding: "utf8" }
  );
} catch (error) {
  errors.push(`plugin no-undef lint failed:\n${error.stdout || error.stderr || error.message}`);
}
check(templateSource.includes("__BASELINE_PLAN__"), "plugin template plan marker missing");
check(templateSource.includes("__ASSET_PAYLOAD__"), "plugin template asset marker missing");
check(templateSource.includes(`APPLY ${plan.source.commit}`), "plugin approval phrase drift");
check(!builtSource.includes("__BASELINE_PLAN__"), "generated plugin still contains the plan marker");
check(!builtSource.includes("__ASSET_PAYLOAD__"), "generated plugin still contains the asset marker");
check(builtSource.includes(plan.baselineId), "generated plugin baseline id missing");
check(templateSource.includes("figma.createNodeFromSvg"), "editable SVG preview builder missing");
check(templateSource.includes("figma.createImage(figma.base64Decode"), "raster preview builder missing");
check(templateSource.includes("figma.getLocalTextStylesAsync"), "text-style documentation inventory missing");
check(templateSource.includes("figma.getLocalEffectStylesAsync"), "effect-style documentation inventory missing");
check(templateSource.includes('"Spacing & Radius"'), "spacing/radius documentation inventory missing");
check(templateSource.includes("floatVariableForValue"), "spacing-variable resolver missing");
check(templateSource.includes("node.setBoundVariable(field, variable)"), "layout variable binding missing");
check(templateSource.includes("await node.setTextStyleIdAsync(style.id)"), "existing text-style reuse missing");
for (const asset of plan.assetInventory) {
  check(builtSource.includes(asset.path), `generated asset payload entry missing: ${asset.path}`);
}
for (const action of [
  "audit",
  "preview",
  "final-qa",
  "validate-p1",
  "apply-p1",
  "apply-page",
  "validate-p2",
  "apply-doc",
  "apply-component",
  "validate-component",
  "apply-coverage",
  "validate-coverage"
]) {
  check(templateSource.includes(`data-action="${action}"`), `plugin action missing: ${action}`);
}
check(templateSource.includes('String(message.action).startsWith("apply-")'), "apply actions are not centrally approval-guarded");
check(templateSource.includes("await requireP1Complete();"), "P1 phase dependency is not enforced");
check(templateSource.includes("await requireP2Complete();"), "P2 phase dependency is not enforced");
check(templateSource.includes("await requireP3Complete();"), "P3 phase dependency is not enforced");
check(templateSource.includes("figma.combineAsVariants"), "component variant builder missing");
check(templateSource.includes("componentSet.children.forEach"), "post-combine variant layout missing");
check(ledger.baselineId === plan.baselineId, "state ledger baseline drift");
check(ledger.targetFileKey === plan.figma.fileKey, "state ledger file key drift");
check(ledger.source === `${plan.source.branch}@${plan.source.commit}`, "state ledger source drift");
check(ledger.approval.phase0Approved === false, "state ledger must remain unapproved before Figma writes");
check(ledger.approval.approvalPhrase === `APPLY ${plan.source.commit}`, "state ledger approval phrase drift");
check(Object.keys(ledger.phases).join("|") === "P1|P2|P3|P4|P5", "state ledger phase contract changed");
try {
  execFileSync(process.execPath, [join(pluginDir, "smoke-plugin.mjs")], {
    cwd: projectDir,
    encoding: "utf8"
  });
} catch (error) {
  errors.push(`plugin startup smoke test failed:\n${error.stdout || error.stderr || error.message}`);
}

if (errors.length) {
  console.error(`FAIL (${errors.length})`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("PASS");
  console.log(`source=${branch}@${head}`);
  console.log(`themes=${plan.themes.length}`);
  console.log(`archetypes=${plan.archetypes.length}`);
  console.log(`pages=${plan.pages.length}`);
  console.log(`components=${plan.components.length}`);
  console.log(`componentBuilds=${plan.componentBuilds.length}`);
  console.log(`statusTokens=${plan.statusTokens.length}`);
  console.log(`settingsSurfaces=${plan.settingsSurfaces.length}`);
  console.log(`machineOutputs=${plan.machineOutputs.length}`);
  console.log(`assetInventory=${plan.assetInventory.length}`);
  console.log(`navigationFlows=${plan.navigationFlows.length}`);
  console.log(`responsivePatterns=${plan.responsivePatterns.length}`);
  console.log(`trackedSourceFiles=${trackedSourceFiles.length}`);
  console.log(`codeCoverageAddendum=${plan.formalPrototype.codeCoverageAddendum.length}`);
  console.log(`dunhuangSvg=${dunhuangFiles.filter((name) => name.endsWith(".svg")).length}`);
  console.log(`pixelSvg=${pixelFiles.filter((name) => name.endsWith(".svg")).length}`);
  console.log(`brandAssets=${brandFiles.filter((name) => !name.startsWith(".")).length}`);
}
