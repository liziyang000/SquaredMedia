import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const packageScript = path.join(root, "scripts", "package-player.mjs");
const verifyScript = path.join(root, "scripts", "verify-player-release.mjs");
const packageName = "pingfangplayer-player";
const authoredFiles = ["static/player/artplayer.html", "static/player/artplayer/pingfang-player-1.0.0.js", "static/player/artplayer/pingfang-player-1.0.0.css"];
const vendorFiles = [
  {
    source: "node_modules/artplayer/dist/artplayer.js",
    destination: "static/player/artplayer/artplayer-5.4.0.min.js",
    content: "fixture-artplayer\n"
  },
  {
    source: "node_modules/hls.js/dist/hls.min.js",
    destination: "static/player/artplayer/hls-1.6.16.min.js",
    content: "fixture-hls\n"
  }
];
const packagedFiles = [...authoredFiles, ...vendorFiles.map((file) => file.destination)];
const expectedEntries = [
  `${packageName}/`,
  `${packageName}/static/`,
  `${packageName}/static/player/`,
  `${packageName}/static/player/artplayer/`,
  ...packagedFiles.map((entry) => `${packageName}/${entry}`)
];
const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "pingfang-player-package-"));

try {
  writeFileSync(
    path.join(fixtureRoot, "package.json"),
    JSON.stringify({
      devDependencies: {
        artplayer: "5.4.0",
        "hls.js": "1.6.16"
      }
    })
  );
  for (const [dependency, version] of [
    ["artplayer", "5.4.0"],
    ["hls.js", "1.6.16"]
  ]) {
    const installedPackage = path.join(fixtureRoot, "node_modules", dependency, "package.json");
    mkdirSync(path.dirname(installedPackage), { recursive: true });
    writeFileSync(installedPackage, JSON.stringify({ version }));
  }
  for (const vendorFile of vendorFiles) {
    const sourcePath = path.join(fixtureRoot, vendorFile.source);
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, vendorFile.content);
  }
  for (const [index, relativePath] of authoredFiles.entries()) {
    const sourcePath = path.join(fixtureRoot, "maccms-player", relativePath);
    mkdirSync(path.dirname(sourcePath), { recursive: true });
    writeFileSync(sourcePath, `fixture-${index}\n`);
  }
  writeFileSync(path.join(fixtureRoot, "maccms-player", "static", "player", "config.php"), "<?php");
  writeFileSync(path.join(fixtureRoot, "maccms-player", "static", "player", ".env"), "SECRET=no\n");
  mkdirSync(path.join(fixtureRoot, "dist"), { recursive: true });
  writeFileSync(path.join(fixtureRoot, "dist", "existing-theme.tar.gz"), "keep\n");

  execFileSync(process.execPath, [packageScript], { cwd: fixtureRoot, stdio: "pipe" });
  execFileSync(process.execPath, [verifyScript], { cwd: fixtureRoot, stdio: "pipe" });

  const archive = path.join(fixtureRoot, "dist", `${packageName}.tar.gz`);
  const packageRoot = path.join(fixtureRoot, "dist", packageName);
  const createFixtureArchive = () =>
    execFileSync("tar", ["--no-xattrs", "-czf", archive, "-C", path.join(fixtureRoot, "dist"), packageName], {
      env: {
        ...process.env,
        COPYFILE_DISABLE: "1"
      }
    });
  const entries = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
  assert.deepEqual([...entries].sort(), [...expectedEntries].sort());
  assert.equal(readFileSync(path.join(fixtureRoot, "dist", "existing-theme.tar.gz"), "utf8"), "keep\n");
  assert.ok(!entries.some((entry) => entry.endsWith(".php")));
  assert.ok(!entries.some((entry) => entry.split("/").some((part) => part.startsWith("."))));

  const installedHls = path.join(fixtureRoot, "node_modules", "hls.js", "dist", "hls.min.js");
  writeFileSync(installedHls, "changed-after-package\n");
  const changedVendorResult = spawnSync(process.execPath, [verifyScript], {
    cwd: fixtureRoot,
    encoding: "utf8"
  });
  assert.notEqual(changedVendorResult.status, 0);
  assert.match(changedVendorResult.stderr, /should exactly match its reviewed source file/);
  writeFileSync(installedHls, vendorFiles[1].content);

  const packagedPlayer = path.join(packageRoot, "static", "player", "artplayer", "pingfang-player-1.0.0.js");
  rmSync(packagedPlayer);
  symlinkSync("pingfang-player-1.0.0.css", packagedPlayer);
  createFixtureArchive();
  const linkedArchiveResult = spawnSync(process.execPath, [verifyScript], {
    cwd: fixtureRoot,
    encoding: "utf8"
  });
  assert.notEqual(linkedArchiveResult.status, 0);
  assert.match(linkedArchiveResult.stderr, /should not contain symbolic or hard links/);

  execFileSync(process.execPath, [packageScript], { cwd: fixtureRoot, stdio: "pipe" });
  writeFileSync(path.join(packageRoot, "config.php"), "<?php");
  createFixtureArchive();
  const phpArchiveResult = spawnSync(process.execPath, [verifyScript], {
    cwd: fixtureRoot,
    encoding: "utf8"
  });
  assert.notEqual(phpArchiveResult.status, 0);
  assert.match(phpArchiveResult.stderr, /only the approved player files and directories/);

  const playerSource = path.join(fixtureRoot, "maccms-player", "static", "player", "artplayer", "pingfang-player-1.0.0.js");
  rmSync(playerSource);
  symlinkSync("pingfang-player-1.0.0.css", playerSource);
  const linkedSourceResult = spawnSync(process.execPath, [packageScript], {
    cwd: fixtureRoot,
    encoding: "utf8"
  });
  assert.notEqual(linkedSourceResult.status, 0);
  assert.match(linkedSourceResult.stderr, /Refusing symbolic link in player source/);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
assert.match(packageJson.scripts.test, /tests\/player-package\.test\.mjs/);
assert.match(packageJson.scripts.package, /package-theme\.mjs/);
assert.match(packageJson.scripts.package, /package:player/);
assert.equal(packageJson.scripts["package:player"], "node scripts/package-player.mjs");
assert.match(packageJson.scripts["verify:release"], /verify-release\.mjs/);
assert.match(packageJson.scripts["verify:release"], /verify:player-release/);
assert.equal(packageJson.scripts["verify:player-release"], "node scripts/verify-player-release.mjs");
assert.equal(packageJson.devDependencies.artplayer, "5.4.0");
assert.equal(packageJson.devDependencies["hls.js"], "1.6.16");

const ci = readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
assert.match(ci, /name: pingfangplayer-player/);
assert.match(ci, /path: dist\/pingfangplayer-player\.tar\.gz/);

console.log("Player package contract checks passed.");
