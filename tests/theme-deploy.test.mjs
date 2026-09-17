import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const deploy = readFileSync("scripts/deploy-theme.sh", "utf8");
const remoteScript = deploy.match(/<<'REMOTE_SCRIPT'\n([\s\S]*?)\nREMOTE_SCRIPT/)?.[1];
assert.ok(remoteScript, "deployment must provide its remote script");
const commandStubs = `
sha256sum() {
  node -e 'const fs=require("node:fs"),crypto=require("node:crypto"); console.log(crypto.createHash("sha256").update(fs.readFileSync(process.argv[1])).digest("hex")+"  "+process.argv[1]);' "$1"
}
curl() {
  local theme_test_output=""
  while [[ "$#" -gt 0 ]]; do
    if [[ "$1" == "-o" ]]; then shift; theme_test_output="$1"; fi
    shift
  done
  printf '%s' '<html>/template/pingfangvideo/</html>' > "$theme_test_output"
  printf '%s' "$THEME_TEST_HTTP_STATUS"
}
`;

for (const scenario of ["success", "smoke-failure", "corrupt-upload"]) {
  const fixture = mkdtempSync(path.join(tmpdir(), "pingfang-theme-deploy-"));
  try {
    const template = path.join(fixture, "template");
    const live = path.join(template, "pingfangvideo");
    const staged = path.join(fixture, "staged", "pingfangvideo");
    mkdirSync(live, { recursive: true });
    mkdirSync(staged, { recursive: true });
    writeFileSync(path.join(live, "info.ini"), "old theme\n");
    writeFileSync(path.join(live, "old-only.txt"), "preserve in backup\n");
    writeFileSync(path.join(staged, "info.ini"), "new theme\n");
    writeFileSync(path.join(staged, "ink-wash.css"), "new ink theme\n");
    const addon = path.join(fixture, "addons", "vodops");
    mkdirSync(addon, { recursive: true });
    writeFileSync(path.join(addon, "sentinel.txt"), "unchanged addon\n");
    const archive = path.join(fixture, "theme.tar.gz");
    execFileSync("tar", ["-czf", archive, "-C", path.dirname(staged), "pingfangvideo"]);
    const hash = createHash("sha256").update(readFileSync(archive)).digest("hex");
    const result = spawnSync("bash", ["-s"], {
      input: commandStubs + remoteScript,
      encoding: "utf8",
      env: {
        ...process.env,
        DEPLOY_PATH: template,
        DEPLOY_SCOPE: "theme",
        DEPLOY_CLEAR_CACHE: "1",
        DEPLOY_SITE_HOST: "theme.test",
        DEPLOY_SITE_SCHEME: "https",
        DEPLOY_SITE_MARKER: "/template/pingfangvideo/",
        THEME_NAME: "pingfangvideo",
        THEME_ARCHIVE_SHA: scenario === "corrupt-upload" ? "0".repeat(64) : hash,
        THEME_TEST_HTTP_STATUS: scenario === "smoke-failure" ? "500" : "200",
        REMOTE_TMP: archive,
        REMOTE_ADDON_TMP: path.join(fixture, "missing-device.tar.gz"),
        REMOTE_VODOPS_ADDON_TMP: path.join(fixture, "missing-vodops.tar.gz"),
      },
    });
    assert.equal(result.status, scenario === "success" ? 0 : 1, result.stderr || result.stdout);
    assert.equal(readFileSync(path.join(live, "info.ini"), "utf8"), scenario === "success" ? "new theme\n" : "old theme\n");
    assert.equal(readFileSync(path.join(addon, "sentinel.txt"), "utf8"), "unchanged addon\n");
    assert.equal(existsSync(path.join(live, "ink-wash.css")), scenario === "success");
    const backups = readdirSync(template).filter((name) => name.startsWith("pingfangvideo.backup."));
    assert.equal(backups.length, scenario === "corrupt-upload" ? 0 : 1);
    if (backups.length) assert.equal(readFileSync(path.join(template, backups[0], "old-only.txt"), "utf8"), "preserve in backup\n");
    assert.ok(!readdirSync(template).some((name) => name.startsWith(".pingfangvideo.candidate.")));
    assert.ok(!existsSync(archive), "uploaded temporary archive should be cleaned up");
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}
console.log("Theme-only deployment: success, rollback, and corrupt-upload checks passed");
