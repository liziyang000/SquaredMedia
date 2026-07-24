import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rollbackScript = readFileSync(path.join(root, "scripts/rollback-next-web.sh"), "utf8");
const deployScript = readFileSync(path.join(root, "scripts/deploy-next-web.sh"), "utf8");
const remoteMatch = rollbackScript.match(/<<'REMOTE_ROLLBACK'\n([\s\S]*?)\nREMOTE_ROLLBACK/);
assert.ok(remoteMatch, "Remote web rollback script must exist");
const remoteScript = remoteMatch[1];

function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return source.slice(start, end);
}

function shellQuote(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

const syntax = spawnSync("bash", ["-n"], { input: remoteScript, encoding: "utf8" });
assert.equal(syntax.status, 0, syntax.stderr || "Remote web rollback script must be valid Bash");
assert.match(remoteScript, /target_release="\$\(read_next_release_metadata "\$target"\)"/);
assert.match(remoteScript, /healthz_matches_release "\$target_release" -fsS/);
assert.match(remoteScript, /healthz_matches_release "\$target_release" -kfsS/);
assert.match(remoteScript, /action=home_v2&compact=1/);
assert.match(remoteScript, /action=content&compact=1&scope=library&sort=latest&page=1&page_size=24&include_facets=1/);
assert.match(remoteScript, /-L "\$target"/);
assert.match(remoteScript, /"\$target_resolved" != "\$target"/);
assert.match(remoteScript, /-type l -o ! -user root/);
assert.match(remoteScript, /CRITICAL: failed to restore the pre-rollback Web release/);
assert.match(remoteScript, /exit "\$ROLLBACK_FAILED_EXIT_STATUS"/);
assert.match(deployScript, /Rollback command: NEXT_ROLLBACK_RELEASE=\$previous_release npm run rollback:web/);
assert.doesNotMatch(deployScript, /healthz["']?\s*\|\s*grep -Fq/);

const metadataFunction = extractBetween(remoteScript, "read_next_release_metadata() {", "\n\nhealthz_matches_release() {");
const metadataRoot = mkdtempSync(path.join(tmpdir(), "squaredmedia-web-release-metadata-"));
try {
  const releaseId = "20260724T120000Z-abcdef123456";
  const releaseDir = path.join(metadataRoot, releaseId);
  mkdirSync(releaseDir);
  writeFileSync(path.join(releaseDir, "release.env"), `SQUAREDMEDIA_RELEASE_ID=${releaseId}\n`);
  writeFileSync(path.join(releaseDir, "release.json"), JSON.stringify({ release: releaseId, artifactSha256: "a".repeat(64) }) + "\n");
  const harness = `${metadataFunction}\nread_next_release_metadata ${shellQuote(releaseDir)}\n`;

  const valid = spawnSync("bash", ["-c", harness], { encoding: "utf8" });
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(valid.stdout.trim(), releaseId);

  writeFileSync(path.join(releaseDir, "release.json"), JSON.stringify({ release: "20260724T120001Z-abcdef123456" }) + "\n");
  const mismatch = spawnSync("bash", ["-c", harness], { encoding: "utf8" });
  assert.notEqual(mismatch.status, 0, "Mismatched release metadata must fail");
  assert.match(mismatch.stderr, /does not match its directory/);

  rmSync(path.join(releaseDir, "release.env"));
  writeFileSync(path.join(releaseDir, "release.json"), JSON.stringify({ release: releaseId }) + "\n");
  const missing = spawnSync("bash", ["-c", harness], { encoding: "utf8" });
  assert.notEqual(missing.status, 0, "Missing release.env must fail");
  assert.match(missing.stderr, /missing trusted release metadata/);

  const outside = path.join(metadataRoot, "outside.env");
  writeFileSync(outside, `SQUAREDMEDIA_RELEASE_ID=${releaseId}\n`);
  symlinkSync(outside, path.join(releaseDir, "release.env"));
  const linked = spawnSync("bash", ["-c", harness], { encoding: "utf8" });
  assert.notEqual(linked.status, 0, "Linked release metadata must fail");
  assert.match(linked.stderr, /missing trusted release metadata/);
} finally {
  rmSync(metadataRoot, { recursive: true, force: true });
}

const healthFunction = extractBetween(remoteScript, "healthz_matches_release() {", "\n\nvalidate_rollback_api_response() {");
const deployHealthFunction = extractBetween(deployScript, "healthz_matches_release() {", "\n\nharden_release() {");
const healthRoot = mkdtempSync(path.join(tmpdir(), "squaredmedia-web-healthz-"));
try {
  const fakeCurl = path.join(healthRoot, "curl");
  writeFileSync(fakeCurl, '#!/usr/bin/env bash\nprintf "%s" "$HEALTHZ_TEST_PAYLOAD"\n');
  chmodSync(fakeCurl, 0o755);
  const harness = `${healthFunction}\nhealthz_matches_release 20260724T120000Z-abcdef123456 ignored\n`;
  const valid = spawnSync("bash", ["-c", harness], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${healthRoot}:${process.env.PATH}`,
      HEALTHZ_TEST_PAYLOAD: '{"status":"ok","release":"20260724T120000Z-abcdef123456"}'
    }
  });
  assert.equal(valid.status, 0, valid.stderr);
  const stale = spawnSync("bash", ["-c", harness], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${healthRoot}:${process.env.PATH}`,
      HEALTHZ_TEST_PAYLOAD: '{"status":"ok","release":"20260723T120000Z-abcdef123456"}'
    }
  });
  assert.notEqual(stale.status, 0, "A stale process must not satisfy rollback health");

  const deployHarness = `${deployHealthFunction}\nhealthz_matches_release 20260724T120000Z-abcdef123456 ignored\n`;
  for (const payload of [
    '{"status":"error","release":"20260724T120000Z-abcdef123456"}',
    '{"status":"ok","release":"prefix-20260724T120000Z-abcdef123456-suffix"}'
  ]) {
    const invalid = spawnSync("bash", ["-c", deployHarness], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${healthRoot}:${process.env.PATH}`,
        HEALTHZ_TEST_PAYLOAD: payload
      }
    });
    assert.notEqual(invalid.status, 0, `Deploy health must reject ${payload}`);
  }
  const exact = spawnSync("bash", ["-c", deployHarness], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${healthRoot}:${process.env.PATH}`,
      HEALTHZ_TEST_PAYLOAD: '{"status":"ok","release":"20260724T120000Z-abcdef123456"}'
    }
  });
  assert.equal(exact.status, 0, exact.stderr);
} finally {
  rmSync(healthRoot, { recursive: true, force: true });
}

const apiValidator = extractBetween(remoteScript, "validate_rollback_api_response() {", "\n\nsmoke_rollback_api() {");
const apiRoot = mkdtempSync(path.join(tmpdir(), "squaredmedia-web-api-smoke-"));
try {
  const responseFile = path.join(apiRoot, "response.json");
  const runValidation = (kind, status) =>
    spawnSync("bash", ["-c", `${apiValidator}\nvalidate_rollback_api_response ${kind} ${shellQuote(responseFile)} ${status}\n`], {
      encoding: "utf8"
    });

  writeFileSync(
    responseFile,
    JSON.stringify({
      code: 1,
      data: {
        siteName: "平方影视",
        categories: [],
        categoryContext: { current: null, parent: null, children: [] },
        facets: { areas: [], years: [], langs: [], classes: [] },
        videos: [],
        total: 0,
        page: 1,
        totalPages: 0
      }
    })
  );
  assert.equal(runValidation("content", 200).status, 0);
  writeFileSync(
    responseFile,
    JSON.stringify({
      code: 1,
      data: {
        siteName: "平方影视",
        categories: [],
        categoryContext: { current: null, parent: null, children: [] },
        facets: null,
        videos: [],
        total: 0,
        page: 1,
        totalPages: 0
      }
    })
  );
  assert.notEqual(runValidation("content", 200).status, 0, "Content smoke must validate the paged contract");
  writeFileSync(
    responseFile,
    JSON.stringify({
      code: 1,
      data: {
        siteName: "平方影视",
        todayUpdated: 0,
        categories: [],
        hero: [],
        ranking: [],
        latest: [],
        latestByCategory: []
      }
    })
  );
  assert.equal(runValidation("home", 200).status, 0);
  writeFileSync(responseFile, JSON.stringify({ code: 1, data: null }));
  assert.notEqual(runValidation("home", 200).status, 0, "Home smoke must reject an empty data contract");
  writeFileSync(responseFile, JSON.stringify({ code: 403, msg: "当前地区不可访问", data: null }));
  assert.equal(runValidation("home", 403).status, 0, "Documented regional policy denial remains a valid smoke outcome");
} finally {
  rmSync(apiRoot, { recursive: true, force: true });
}

const restoreFunction = extractBetween(remoteScript, "restore_failed_rollback() {", "\ntrap restore_failed_rollback EXIT");
function runRestoreHarness(failDaemonReload) {
  const harnessRoot = mkdtempSync(path.join(tmpdir(), "squaredmedia-web-restore-"));
  const nextRoot = path.join(harnessRoot, "next");
  const currentBefore = path.join(nextRoot, "releases/old");
  const failedTarget = path.join(nextRoot, "releases/failed");
  const nginxBackup = path.join(harnessRoot, "nginx.backup");
  const unitBackup = path.join(harnessRoot, "unit.backup");
  const nginxTarget = path.join(harnessRoot, "nginx.conf");
  const unitTarget = path.join(harnessRoot, "service");
  const harness = path.join(harnessRoot, "restore.sh");
  mkdirSync(currentBefore, { recursive: true });
  mkdirSync(failedTarget, { recursive: true });
  symlinkSync(failedTarget, path.join(nextRoot, "current"));
  symlinkSync(failedTarget, path.join(nextRoot, ".current.rollback"));
  symlinkSync(failedTarget, path.join(nextRoot, ".current.rollback-failed"));
  writeFileSync(nginxBackup, "old nginx\n");
  writeFileSync(unitBackup, "old unit\n");
  writeFileSync(nginxTarget, "failed nginx\n");
  writeFileSync(unitTarget, "failed unit\n");
  writeFileSync(
    harness,
    [
      "#!/usr/bin/env bash",
      "set -u",
      `NEXT_ROOT=${shellQuote(nextRoot)}`,
      `current_before=${shellQuote(currentBefore)}`,
      `nginx_backup=${shellQuote(nginxBackup)}`,
      `unit_backup=${shellQuote(unitBackup)}`,
      `NEXT_NGINX_EXTENSION=${shellQuote(nginxTarget)}`,
      `NEXT_UNIT_PATH=${shellQuote(unitTarget)}`,
      "NEXT_SERVICE=squaredmedia-next.service",
      "nginx_existed=1",
      "unit_existed=1",
      "service_was_active=0",
      "service_was_enabled=0",
      "ROLLBACK_FAILED_EXIT_STATUS=95",
      `FAIL_DAEMON_RELOAD=${failDaemonReload ? "1" : "0"}`,
      "systemctl() {",
      "  if [[ \"$1\" == \"daemon-reload\" && \"$FAIL_DAEMON_RELOAD\" == \"1\" ]]; then return 1; fi",
      "  if [[ \"$1\" == \"is-active\" || \"$1\" == \"is-enabled\" ]]; then return 1; fi",
      "  return 0",
      "}",
      "mv() {",
      "  if [[ \"${1:-}\" == \"-Tf\" ]]; then /bin/mv -fh \"$2\" \"$3\"; else /bin/mv \"$@\"; fi",
      "}",
      "reload_nginx() { return 0; }",
      restoreFunction,
      "false",
      "restore_failed_rollback",
      ""
    ].join("\n")
  );
  const result = spawnSync("bash", [harness], { encoding: "utf8" });
  return {
    currentBefore,
    harnessRoot,
    nginxBackup,
    nginxTarget,
    result,
    unitBackup,
    unitTarget
  };
}

const restored = runRestoreHarness(false);
try {
  assert.equal(restored.result.status, 1, restored.result.stderr);
  assert.equal(readlinkSync(path.join(restored.harnessRoot, "next/current")), restored.currentBefore);
  assert.equal(readFileSync(restored.nginxTarget, "utf8"), "old nginx\n");
  assert.equal(readFileSync(restored.unitTarget, "utf8"), "old unit\n");
  assert.equal(existsSync(restored.nginxBackup), false);
  assert.equal(existsSync(restored.unitBackup), false);
} finally {
  rmSync(restored.harnessRoot, { recursive: true, force: true });
}

const failedRestore = runRestoreHarness(true);
try {
  assert.equal(failedRestore.result.status, 95, failedRestore.result.stderr);
  assert.match(failedRestore.result.stderr, /CRITICAL: failed to restore/);
  assert.equal(existsSync(failedRestore.nginxBackup), true);
  assert.equal(existsSync(failedRestore.unitBackup), true);
} finally {
  rmSync(failedRestore.harnessRoot, { recursive: true, force: true });
}

console.log("web rollback contract tests passed");
