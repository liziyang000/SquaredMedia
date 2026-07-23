import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const packageName = "pingfangplayer-player";
const archive = path.join(root, "dist", `${packageName}.tar.gz`);
const expectedDependencyVersions = {
  artplayer: "5.4.0",
  "hls.js": "1.6.16"
};
const packageFiles = [
  {
    source: path.join(root, "maccms-player", "static", "player", "artplayer.html"),
    destination: "static/player/artplayer.html"
  },
  {
    source: path.join(root, "node_modules", "artplayer", "dist", "artplayer.js"),
    destination: "static/player/artplayer/artplayer-5.4.0.min.js"
  },
  {
    source: path.join(root, "node_modules", "hls.js", "dist", "hls.min.js"),
    destination: "static/player/artplayer/hls-1.6.16.min.js"
  },
  {
    source: path.join(root, "maccms-player", "static", "player", "artplayer", "pingfang-player-1.0.0.js"),
    destination: "static/player/artplayer/pingfang-player-1.0.0.js"
  },
  {
    source: path.join(root, "maccms-player", "static", "player", "artplayer", "pingfang-player-1.0.0.css"),
    destination: "static/player/artplayer/pingfang-player-1.0.0.css"
  }
];
const packagedFiles = packageFiles.map((file) => file.destination);
const allowedEntries = new Set([
  `${packageName}/`,
  `${packageName}/static/`,
  `${packageName}/static/player/`,
  `${packageName}/static/player/artplayer/`,
  ...packagedFiles.map((entry) => `${packageName}/${entry}`)
]);

const projectPackage = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
for (const [dependency, version] of Object.entries(expectedDependencyVersions)) {
  assert.equal(projectPackage.devDependencies?.[dependency], version, `${dependency} should be pinned exactly to ${version}`);
  const installedPackage = JSON.parse(readFileSync(path.join(root, "node_modules", dependency, "package.json"), "utf8"));
  assert.equal(installedPackage.version, version, `Installed ${dependency} should be version ${version}`);
}

assert.ok(existsSync(archive), `${archive} should exist. Run npm run package first.`);

const tarList = spawnSync("tar", ["-tzf", archive], { encoding: "utf8" });
assert.equal(tarList.status, 0, tarList.stderr || "Player release archive should be readable");
assert.doesNotMatch(tarList.stderr, /LIBARCHIVE\.xattr/, "Player release archive should not include macOS extended attribute metadata");

const entries = tarList.stdout.trim().split(/\r?\n/).filter(Boolean);
assert.equal(new Set(entries).size, entries.length, "Player release archive should not contain duplicate entries");
assert.deepEqual([...entries].sort(), [...allowedEntries].sort(), "Player release archive should contain only the approved player files and directories");

for (const entry of entries) {
  assert.ok(!path.posix.isAbsolute(entry), `Player release entry must be relative: ${entry}`);
  assert.ok(!entry.split("/").some((part) => part === ".."), `Player release entry must not traverse outside its package root: ${entry}`);
  assert.ok(!entry.split("/").some((part) => part.startsWith(".") && part !== "."), `Player release entry must not contain hidden path components: ${entry}`);
  assert.doesNotMatch(entry, /\.php(?:$|\/)/i, `Player release entry must not contain PHP: ${entry}`);
}

const verboseTarList = spawnSync("tar", ["-tvzf", archive], { encoding: "utf8" });
assert.equal(verboseTarList.status, 0, verboseTarList.stderr || "Player release metadata should be readable");
const linkedEntries = verboseTarList.stdout.split(/\r?\n/).filter((line) => /^[lh]/.test(line));
assert.deepEqual(linkedEntries, [], "Player release archive should not contain symbolic or hard links");

for (const file of packageFiles) {
  const entry = `${packageName}/${file.destination}`;
  const packagedContent = execFileSync("tar", ["-xOf", archive, entry]);
  const sourceContent = readFileSync(file.source);
  assert.ok(packagedContent.length > 0, `${entry} should not be empty`);
  assert.deepEqual(packagedContent, sourceContent, `${entry} should exactly match its reviewed source file`);
}

console.log(`Verified ${archive}`);
