import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deployPath = path.join(root, "scripts/deploy-theme.sh");
const deployScript = readFileSync(deployPath, "utf8");

function extractBetween(startMarker, endMarker) {
  const start = deployScript.indexOf(startMarker);
  const end = deployScript.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return deployScript.slice(start, end);
}

function shellQuote(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

const rollbackFunctions = extractBetween("restore_release() {", "\ntrap cleanup_deploy_files EXIT");
const uploadCleanupFunction = extractBetween("cleanup_remote_uploads() {", "\ntrap cleanup_remote_uploads EXIT");
const clearCacheFunction = extractBetween("clear_maccms_cache() {", "\n\nvalidate_api_warmup_response() {");

assert.match(deployScript, /ROLLBACK_FAILED_EXIT_STATUS=95/);
assert.match(rollbackFunctions, /local rollback_status=0/);
assert.match(rollbackFunctions, /if ! restore_release; then\n\s+rollback_status=1/);
assert.match(rollbackFunctions, /CRITICAL: automatic rollback failed/);
assert.match(clearCacheFunction, /if ! find "\$cache_dir"/);
assert.ok(
  uploadCleanupFunction.indexOf('if [[ "$status" -eq "$ROLLBACK_FAILED_EXIT_STATUS" ]]') < uploadCleanupFunction.indexOf("REMOTE_UPLOAD_CLEANUP"),
  "The local exit trap must preserve uploads before attempting remote cleanup"
);

function runRemoteRollbackScenario({ failCopy = false, snapshotState = "directory" }) {
  const scenarioRoot = mkdtempSync(path.join(tmpdir(), "pingfang-rollback-test-"));
  const deployTmpDir = path.join(scenarioRoot, "deploy-tmp");
  const rollbackRoot = path.join(deployTmpDir, "rollback");
  const maccmsRoot = path.join(scenarioRoot, "maccms");
  const templateDir = path.join(maccmsRoot, "template");
  const apiTarget = path.join(maccmsRoot, "addons/pingfangapi");
  const controllerTarget = path.join(maccmsRoot, "application/index/controller/Pingfangapi.php");
  const remoteApiArchive = path.join(scenarioRoot, "pingfangapi.tar.gz");
  const fakeBin = path.join(scenarioRoot, "fake-bin");
  const harnessPath = path.join(scenarioRoot, "rollback-harness.sh");

  mkdirSync(deployTmpDir, { recursive: true });
  if (snapshotState === "directory") {
    mkdirSync(path.join(rollbackRoot, "api-addon"), { recursive: true });
    writeFileSync(path.join(rollbackRoot, "api-addon/release.txt"), "snapshot-addon\n");
    writeFileSync(path.join(rollbackRoot, "api-controller"), "snapshot-controller\n");
  } else if (snapshotState === "file") {
    writeFileSync(rollbackRoot, "not a rollback directory\n");
  } else {
    assert.equal(snapshotState, "missing");
  }
  mkdirSync(path.dirname(controllerTarget), { recursive: true });
  mkdirSync(apiTarget, { recursive: true });
  mkdirSync(fakeBin);
  writeFileSync(path.join(apiTarget, "release.txt"), "failed-release\n");
  writeFileSync(controllerTarget, "failed-controller\n");
  writeFileSync(remoteApiArchive, "release archive\n");

  const fakeCp = path.join(fakeBin, "cp");
  writeFileSync(
    fakeCp,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'if [[ "${ROLLBACK_TEST_FAIL_COPY:-0}" == "1" && "$*" == *"/rollback/"* ]]; then',
      "  exit 86",
      "fi",
      'exec /bin/cp "$@"',
      ""
    ].join("\n")
  );
  chmodSync(fakeCp, 0o755);

  writeFileSync(
    harnessPath,
    [
      "#!/usr/bin/env bash",
      "set -u",
      "clear_maccms_cache() { return 0; }",
      rollbackFunctions,
      `DEPLOY_PATH=${shellQuote(templateDir)}`,
      "DEPLOY_SCOPE=api",
      "DEPLOY_CLEAR_CACHE=1",
      "THEME_NAME=pingfangvideo",
      "ADDON_NAME=pingfangdevice",
      "API_ADDON_NAME=pingfangapi",
      `deploy_tmp_dir=${shellQuote(deployTmpDir)}`,
      `rollback_root=${shellQuote(rollbackRoot)}`,
      "release_started=1",
      "release_committed=0",
      `REMOTE_TMP=${shellQuote(path.join(scenarioRoot, "pingfangvideo.tar.gz"))}`,
      `REMOTE_ADDON_TMP=${shellQuote(path.join(scenarioRoot, "pingfangdevice.tar.gz"))}`,
      `REMOTE_API_ADDON_TMP=${shellQuote(remoteApiArchive)}`,
      "ROLLBACK_FAILED_EXIT_STATUS=95",
      "deployment_failure() { return 73; }",
      "deployment_failure",
      "cleanup_deploy_files",
      ""
    ].join("\n")
  );

  const result = spawnSync("bash", [harnessPath], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      ROLLBACK_TEST_FAIL_COPY: failCopy ? "1" : "0"
    }
  });

  return {
    apiTarget,
    controllerTarget,
    deployTmpDir,
    remoteApiArchive,
    result,
    rollbackRoot,
    scenarioRoot
  };
}

const successfulRollback = runRemoteRollbackScenario({ failCopy: false });
try {
  assert.equal(successfulRollback.result.status, 73, successfulRollback.result.stderr);
  assert.doesNotMatch(successfulRollback.result.stderr, /CRITICAL:/);
  assert.equal(existsSync(successfulRollback.deployTmpDir), false);
  assert.equal(existsSync(successfulRollback.remoteApiArchive), false);
  assert.equal(readFileSync(path.join(successfulRollback.apiTarget, "release.txt"), "utf8"), "snapshot-addon\n");
  assert.equal(readFileSync(successfulRollback.controllerTarget, "utf8"), "snapshot-controller\n");
} finally {
  rmSync(successfulRollback.scenarioRoot, { recursive: true, force: true });
}

const failedRollback = runRemoteRollbackScenario({ failCopy: true });
try {
  assert.equal(failedRollback.result.status, 95, failedRollback.result.stderr);
  assert.match(failedRollback.result.stderr, /CRITICAL: automatic rollback failed/);
  assert.match(failedRollback.result.stderr, /preserved rollback snapshot/);
  assert.equal(existsSync(failedRollback.deployTmpDir), true);
  assert.equal(existsSync(failedRollback.rollbackRoot), true);
  assert.equal(existsSync(failedRollback.remoteApiArchive), true);
} finally {
  rmSync(failedRollback.scenarioRoot, { recursive: true, force: true });
}

for (const snapshotState of ["missing", "file"]) {
  const invalidSnapshotRollback = runRemoteRollbackScenario({ snapshotState });
  try {
    assert.equal(invalidSnapshotRollback.result.status, 95, invalidSnapshotRollback.result.stderr);
    assert.match(invalidSnapshotRollback.result.stderr, /Automatic rollback snapshot is missing or invalid/);
    assert.match(invalidSnapshotRollback.result.stderr, /CRITICAL: automatic rollback failed/);
    assert.match(invalidSnapshotRollback.result.stderr, /rollback snapshot is unavailable/);
    assert.equal(existsSync(invalidSnapshotRollback.deployTmpDir), true);
    assert.equal(existsSync(invalidSnapshotRollback.remoteApiArchive), true);
  } finally {
    rmSync(invalidSnapshotRollback.scenarioRoot, { recursive: true, force: true });
  }
}

const cacheHarnessRoot = mkdtempSync(path.join(tmpdir(), "pingfang-cache-rollback-test-"));
try {
  const maccmsRoot = path.join(cacheHarnessRoot, "maccms");
  const templateDir = path.join(maccmsRoot, "template");
  const cacheDir = path.join(maccmsRoot, "runtime/cache");
  const fakeBin = path.join(cacheHarnessRoot, "fake-bin");
  const fakeFind = path.join(fakeBin, "find");
  const harnessPath = path.join(cacheHarnessRoot, "cache-harness.sh");
  mkdirSync(cacheDir, { recursive: true });
  mkdirSync(templateDir, { recursive: true });
  mkdirSync(fakeBin);
  writeFileSync(fakeFind, "#!/usr/bin/env bash\nexit 88\n");
  chmodSync(fakeFind, 0o755);
  writeFileSync(
    harnessPath,
    [
      "#!/usr/bin/env bash",
      "set -u",
      clearCacheFunction,
      `DEPLOY_PATH=${shellQuote(templateDir)}`,
      "rollback_status=0",
      "if ! clear_maccms_cache; then",
      "  rollback_status=1",
      "fi",
      'exit "$rollback_status"',
      ""
    ].join("\n")
  );
  const result = spawnSync("bash", [harnessPath], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` }
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Failed to clear MacCMS cache directory/);
  assert.doesNotMatch(result.stdout, /Cleared .* MacCMS cache directories/);
} finally {
  rmSync(cacheHarnessRoot, { recursive: true, force: true });
}

const outerHarnessRoot = mkdtempSync(path.join(tmpdir(), "pingfang-upload-preserve-test-"));
try {
  const fakeSsh = path.join(outerHarnessRoot, "fake-ssh");
  writeFileSync(fakeSsh, '#!/usr/bin/env bash\nprintf "called\\n" >> "$ROLLBACK_TEST_SSH_LOG"\n');
  chmodSync(fakeSsh, 0o755);
  for (const scenario of [
    { status: 95, message: /preserving uploaded release archives/ },
    { status: 255, message: /remote deployment state is unknown/ }
  ]) {
    const sshLog = path.join(outerHarnessRoot, `ssh-${scenario.status}.log`);
    const harnessPath = path.join(outerHarnessRoot, `upload-cleanup-${scenario.status}.sh`);
    writeFileSync(
      harnessPath,
      [
        "#!/usr/bin/env bash",
        "set -u",
        uploadCleanupFunction,
        "ROLLBACK_FAILED_EXIT_STATUS=95",
        "DEPLOY_SCOPE=api",
        "REMOTE_TMP=/tmp/pingfangvideo.test.tar.gz",
        "REMOTE_ADDON_TMP=/tmp/pingfangdevice.test.tar.gz",
        "REMOTE_API_ADDON_TMP=/tmp/pingfangapi.test.tar.gz",
        `ssh_command=(${shellQuote(fakeSsh)})`,
        "REMOTE=deploy@example.invalid",
        "remote_tmp_env=()",
        `deployment_failure() { return ${scenario.status}; }`,
        "deployment_failure",
        "cleanup_remote_uploads",
        ""
      ].join("\n")
    );
    const result = spawnSync("bash", [harnessPath], {
      encoding: "utf8",
      env: { ...process.env, ROLLBACK_TEST_SSH_LOG: sshLog }
    });
    assert.equal(result.status, scenario.status, result.stderr);
    assert.match(result.stderr, scenario.message);
    assert.match(result.stderr, /preserved remote archives/);
    assert.equal(existsSync(sshLog), false, `Exit status ${scenario.status} must not invoke remote archive cleanup`);
  }
} finally {
  rmSync(outerHarnessRoot, { recursive: true, force: true });
}

console.log("deploy rollback preservation tests passed");
