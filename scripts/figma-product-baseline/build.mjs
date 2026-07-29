import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const pluginDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(pluginDir, "../..");
const plan = JSON.parse(await readFile(join(pluginDir, "baseline-plan.json"), "utf8"));
const template = await readFile(join(pluginDir, "code.template.js"), "utf8");
const prototypeV2 = await readFile(join(pluginDir, "prototype-v2.js"), "utf8");
const prototypeA01 = await readFile(join(pluginDir, "prototype-a01.js"), "utf8");
const prototypeFormal = await readFile(join(pluginDir, "prototype-formal.js"), "utf8");
const planMarker = "__BASELINE_PLAN__";
const assetMarker = "__ASSET_PAYLOAD__";

for (const marker of [planMarker, assetMarker]) {
  if (!template.includes(marker)) {
    throw new Error(`Missing ${marker} placeholder in code.template.js`);
  }
}

const assets = { entries: {}, blobs: {} };
for (const asset of plan.assetInventory) {
  const extension = extname(asset.path).toLowerCase();
  if (extension === ".ico") {
    assets.entries[asset.path] = { kind: "UNSUPPORTED", reason: "Figma image fills do not support ICO source bytes." };
    continue;
  }
  const data = await readFile(join(projectDir, asset.path));
  const hash = createHash("sha256").update(data).digest("hex");
  const kind = extension === ".svg" ? "SVG" : "RASTER";
  assets.entries[asset.path] = { kind, blobId: hash };
  if (!assets.blobs[hash]) {
    assets.blobs[hash] = kind === "SVG" ? { kind, svg: data.toString("utf8") } : { kind, base64: data.toString("base64") };
  }
}

const prettierConfig = (await prettier.resolveConfig(join(pluginDir, "code.js"))) || {};
const output = await prettier.format(
  `${template.replace(planMarker, JSON.stringify(plan)).replace(assetMarker, JSON.stringify(assets))}\n${prototypeV2}\n${prototypeA01}\n${prototypeFormal}`,
  {
    ...prettierConfig,
    filepath: join(pluginDir, "code.js")
  }
);
await writeFile(join(pluginDir, "code.js"), output, "utf8");

console.log(`Built Figma plugin for ${plan.source.snapshot || `${plan.source.branch}@${plan.source.commit}`} ` + `(${plan.themes.length} themes, ${plan.archetypes.length} archetypes)`);
console.log(`Embedded ${Object.keys(assets.entries).length} asset entries in ${Object.keys(assets.blobs).length} deduplicated blobs`);
