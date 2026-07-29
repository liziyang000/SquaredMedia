import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const pluginDir = dirname(fileURLToPath(import.meta.url));
const plan = JSON.parse(await readFile(join(pluginDir, "baseline-plan.json"), "utf8"));
const source = await readFile(join(pluginDir, "code.js"), "utf8");
const posted = [];
const shown = [];
const figma = {
  editorType: "figma",
  fileKey: plan.figma.fileKey,
  root: { children: [] },
  variables: {
    async getLocalVariableCollectionsAsync() {
      return [];
    },
    async getLocalVariablesAsync() {
      return [];
    }
  },
  showUI(html, options) {
    shown.push({ html, options });
  },
  ui: {
    onmessage: null,
    postMessage(message) {
      posted.push(message);
    }
  }
};

vm.runInContext(source, vm.createContext({ console, figma }), {
  filename: join(pluginDir, "code.js")
});

if (shown.length !== 1 || !shown[0].html.includes(`APPLY ${plan.source.commit}`)) {
  throw new Error("Plugin UI did not initialize with the pinned approval phrase.");
}
if (typeof figma.ui.onmessage !== "function") {
  throw new Error("Plugin message handler was not registered.");
}
for (const snippet of [
  "Audit component layout",
  "Audit formal readiness",
  "Fix component layout",
  "componentLayoutProblems",
  'type: "nested-escaped"',
  'rankItem.layoutSizingHorizontal = "FILL"',
  'title.layoutSizingHorizontal = "FILL"',
  "RankBoard desktop columns must use equal fill sizing",
  "Build Project Overview",
  "Build Component Index",
  "componentIndexDestination",
  "component index reactions",
  "Integrate Player Evidence",
  "Build User Flows",
  "createFormalFlowTargets",
  "user-flow targets",
  "isFormalFlowTargetClone",
  "user-flow overlap",
  "nodeLinkReaction",
  "Apply Formal Page Order",
  "P5 VALIDATION"
]) {
  if (!source.includes(snippet)) {
    throw new Error(`Component layout regression guard missing: ${snippet}`);
  }
}

await figma.ui.onmessage({ action: "preview" });
if (!posted.at(-1)?.text?.startsWith("PLAN · READ ONLY")) {
  throw new Error("Read-only preview smoke test failed.");
}
if (!posted.at(-1)?.text?.includes("P5 adds the formal project overview")) {
  throw new Error("P5 formal prototype preview is missing.");
}

await figma.ui.onmessage({
  action: "apply-page",
  approval: "",
  pageName: "10 · Home"
});
if (!posted.at(-1)?.text?.includes("Approval phrase does not match.")) {
  throw new Error("Apply action was not blocked without approval.");
}

figma.fileKey = "wrong-file";
await figma.ui.onmessage({
  action: "apply-page",
  approval: `APPLY ${plan.source.commit}`,
  pageName: "10 · Home"
});
if (!posted.at(-1)?.text?.includes("Wrong file")) {
  throw new Error("Apply action was not blocked in the wrong file.");
}

figma.fileKey = undefined;
await figma.ui.onmessage({
  action: "apply-page",
  approval: `APPLY ${plan.source.commit}`,
  pageName: "10 · Home"
});
if (!posted.at(-1)?.text?.includes("Unverified file")) {
  throw new Error("Apply action was not blocked when fileKey and the file fingerprint were unavailable.");
}

figma.fileKey = plan.figma.fileKey;
await figma.ui.onmessage({
  action: "apply-page",
  approval: `APPLY ${plan.source.commit}`,
  pageName: "10 · Home"
});
if (!posted.at(-1)?.text?.includes("P1 must pass before this action.")) {
  throw new Error("P2 action was not blocked before P1 validation passed.");
}

console.log("PASS plugin startup, preview, approval, target-file, and phase guards");
