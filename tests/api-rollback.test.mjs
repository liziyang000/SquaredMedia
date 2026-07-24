import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deployPath = path.join(root, "scripts/deploy-theme.sh");
const rollbackPath = path.join(root, "scripts/rollback-api.sh");
const deployScript = readFileSync(deployPath, "utf8");
const rollbackScript = readFileSync(rollbackPath, "utf8");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const backupId = "20260724T120000Z-1234-5678";

function shellQuote(value) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function writeApiPair(addonDir, controllerPath, marker) {
  mkdirSync(path.join(addonDir, "application/index/controller"), { recursive: true });
  mkdirSync(path.join(addonDir, "service"), { recursive: true });
  mkdirSync(path.dirname(controllerPath), { recursive: true });
  writeFileSync(path.join(addonDir, "info.ini"), `name = ${marker}\n`);
  writeFileSync(path.join(addonDir, "service/AccountService.php"), `<?php\nconst API_MARKER = '${marker}';\n`);
  const controller = `<?php\nconst API_CONTROLLER_MARKER = '${marker}';\n`;
  writeFileSync(path.join(addonDir, "application/index/controller/Pingfangapi.php"), controller);
  writeFileSync(controllerPath, controller);
}

function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return source.slice(start, end);
}

assert.equal(packageJson.scripts["rollback:api"], "bash scripts/rollback-api.sh");
assert.match(packageJson.scripts.test, /node tests\/api-rollback\.test\.mjs/);
assert.equal((deployScript.match(/API_BACKUP_ID="\$\(date -u/g) ?? []).length, 1);
assert.match(deployScript, /API_BACKUP_ID=\$\(printf "%q" "\$API_BACKUP_ID"\)/);
assert.match(deployScript, /persist_api_rollback_backup/);
assert.match(deployScript, /API_ROLLBACK_BACKUP=\$\{API_BACKUP_ID\} npm run rollback:api/);
assert.match(rollbackScript, /: "\$\{API_ROLLBACK_BACKUP:\?Set API_ROLLBACK_BACKUP/);
assert.match(rollbackScript, /maccms_root" == "\/"/);
assert.doesNotMatch(rollbackScript, /find .*pingfangapi\.backup.*tail/);
assert.match(rollbackScript, /application\/database\.php/);
assert.doesNotMatch(rollbackScript, /rm [^\n]*database\.php|cp [^\n]*database\.php|mv [^\n]*database\.php/);
assert.doesNotMatch(rollbackScript, /pingfangvideo|pingfangdevice/);

const backupFunctions = extractBetween(
  deployScript,
  "validate_api_rollback_pair() {",
  "\n\ninstall_api_addon() {"
);
const configMergeFunction = extractBetween(
  deployScript,
  "merge_addon_config_values() {",
  "\n\ninstall_device_addon() {"
);
const installApiFunction = extractBetween(
  deployScript,
  "install_api_addon() {",
  "\n\nif [[ ! -d \"$DEPLOY_PATH\" ]]"
);
const backupHarnessRoot = mkdtempSync(path.join(tmpdir(), "pingfang-api-backup-test-"));
try {
  const maccmsRoot = path.join(backupHarnessRoot, "maccms");
  const templateDir = path.join(maccmsRoot, "template");
  const addon = path.join(maccmsRoot, "addons/pingfangapi");
  const controller = path.join(maccmsRoot, "application/index/controller/Pingfangapi.php");
  const harness = path.join(backupHarnessRoot, "backup-harness.sh");
  mkdirSync(templateDir, { recursive: true });
  writeApiPair(addon, controller, "live");
  writeFileSync(
    harness,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      backupFunctions,
      `DEPLOY_PATH=${shellQuote(templateDir)}`,
      "DEPLOY_SCOPE=api",
      "API_ADDON_NAME=pingfangapi",
      `API_BACKUP_ID=${shellQuote(backupId)}`,
      "persist_api_rollback_backup",
      ""
    ].join("\n")
  );

  const first = spawnSync("bash", [harness], { encoding: "utf8" });
  assert.equal(first.status, 0, first.stderr);
  const addonBackup = path.join(maccmsRoot, `addons/pingfangapi.backup.${backupId}`);
  const controllerBackup = path.join(
    maccmsRoot,
    `application/index/controller/Pingfangapi.php.backup.${backupId}`
  );
  assert.equal(readFileSync(path.join(addonBackup, "info.ini"), "utf8"), "name = live\n");
  assert.equal(readFileSync(controllerBackup, "utf8"), "<?php\nconst API_CONTROLLER_MARKER = 'live';\n");

  writeFileSync(path.join(addonBackup, "sentinel"), "do not overwrite\n");
  const collision = spawnSync("bash", [harness], { encoding: "utf8" });
  assert.notEqual(collision.status, 0);
  assert.match(collision.stderr, /backup target already exists/i);
  assert.equal(readFileSync(path.join(addonBackup, "sentinel"), "utf8"), "do not overwrite\n");

  rmSync(addonBackup, { recursive: true });
  rmSync(controllerBackup);
  const external = path.join(backupHarnessRoot, "external");
  mkdirSync(external);
  symlinkSync(external, addonBackup);
  const linkCollision = spawnSync("bash", [harness], { encoding: "utf8" });
  assert.notEqual(linkCollision.status, 0);
  assert.match(linkCollision.stderr, /backup target already exists|symbolic link/i);
  assert.equal(existsSync(controllerBackup), false);
} finally {
  rmSync(backupHarnessRoot, { recursive: true, force: true });
}

const installHarnessRoot = mkdtempSync(path.join(tmpdir(), "pingfang-api-install-test-"));
try {
  const maccmsRoot = path.join(installHarnessRoot, "maccms");
  const templateDir = path.join(maccmsRoot, "template");
  const addon = path.join(maccmsRoot, "addons/pingfangapi");
  const addonBackup = path.join(maccmsRoot, `addons/pingfangapi.backup.${backupId}`);
  const controller = path.join(maccmsRoot, "application/index/controller/Pingfangapi.php");
  const newAddon = path.join(installHarnessRoot, "new-api");
  const harness = path.join(installHarnessRoot, "install-harness.sh");
  mkdirSync(templateDir, { recursive: true });
  writeApiPair(addon, controller, "current");
  writeApiPair(addonBackup, path.join(installHarnessRoot, "backup-controller.php"), "current");
  writeApiPair(newAddon, path.join(installHarnessRoot, "new-controller.php"), "new");
  writeFileSync(
    path.join(addonBackup, "config.php"),
    "<?php return [['name' => 'lazyload_image', 'value' => '/saved/lazy.png'], ['name' => 'home_limit', 'value' => '77']];\n"
  );
  writeFileSync(
    path.join(newAddon, "config.php"),
    "<?php return [['name' => 'lazyload_image', 'value' => '/default/lazy.png'], ['name' => 'home_limit', 'value' => '120']];\n"
  );
  writeFileSync(
    harness,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      configMergeFunction,
      installApiFunction,
      `DEPLOY_PATH=${shellQuote(templateDir)}`,
      "DEPLOY_SCOPE=api",
      "API_ADDON_NAME=pingfangapi",
      `API_BACKUP_ID=${shellQuote(backupId)}`,
      `api_addon_source=${shellQuote(newAddon)}`,
      "install_api_addon",
      ""
    ].join("\n")
  );
  const result = spawnSync("bash", [harness], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const installedConfig = readFileSync(path.join(addon, "config.php"), "utf8");
  assert.match(installedConfig, /'name' => 'lazyload_image'[\s\S]*'value' => '\/saved\/lazy\.png'/);
  assert.match(installedConfig, /'name' => 'home_limit'[\s\S]*'value' => '77'/);
  assert.match(readFileSync(controller, "utf8"), /API_CONTROLLER_MARKER = 'new'/);
} finally {
  rmSync(installHarnessRoot, { recursive: true, force: true });
}

function createRollbackScenario() {
  const scenarioRoot = mkdtempSync(path.join(tmpdir(), "pingfang-api-rollback-test-"));
  const maccmsRoot = path.join(scenarioRoot, "maccms");
  const templateDir = path.join(maccmsRoot, "template");
  const addon = path.join(maccmsRoot, "addons/pingfangapi");
  const controller = path.join(maccmsRoot, "application/index/controller/Pingfangapi.php");
  const addonBackup = path.join(maccmsRoot, `addons/pingfangapi.backup.${backupId}`);
  const controllerBackup = path.join(
    maccmsRoot,
    `application/index/controller/Pingfangapi.php.backup.${backupId}`
  );
  const fakeBin = path.join(scenarioRoot, "fake-bin");
  const sshLog = path.join(scenarioRoot, "ssh.log");

  mkdirSync(templateDir, { recursive: true });
  writeApiPair(addon, controller, "current");
  writeApiPair(addonBackup, controllerBackup, "backup");
  mkdirSync(path.join(templateDir, "pingfangvideo"), { recursive: true });
  mkdirSync(path.join(maccmsRoot, "addons/pingfangdevice"), { recursive: true });
  mkdirSync(path.join(maccmsRoot, "runtime/cache"), { recursive: true });
  writeFileSync(path.join(templateDir, "pingfangvideo/sentinel"), "theme\n");
  writeFileSync(path.join(maccmsRoot, "addons/pingfangdevice/sentinel"), "device\n");
  writeFileSync(path.join(maccmsRoot, "application/database.php"), "<?php return ['database' => 'unchanged'];\n");
  writeFileSync(path.join(maccmsRoot, "runtime/cache/stale"), "stale\n");

  mkdirSync(fakeBin);
  const fakeSsh = path.join(fakeBin, "ssh");
  writeFileSync(
    fakeSsh,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'printf "%s\\n" "$*" >> "$ROLLBACK_TEST_SSH_LOG"',
      'remote_command="${!#}"',
      'exec /bin/bash -c "$remote_command"',
      ""
    ].join("\n")
  );
  chmodSync(fakeSsh, 0o755);

  const fakeCurl = path.join(fakeBin, "curl");
  writeFileSync(
    fakeCurl,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'output=""',
      'while [[ "$#" -gt 0 ]]; do',
      '  if [[ "$1" == "-o" ]]; then',
      '    output="$2"',
      "    shift 2",
      "    continue",
      "  fi",
      "  shift",
      "done",
      'if [[ "${ROLLBACK_TEST_CURL_MODE:-success}" == "fail" ]]; then',
      "  exit 88",
      "fi",
      `printf '%s\\n' '{"code":1,"msg":"ok","data":{"siteName":"平方影视","todayUpdated":0,"categories":[],"hero":[],"ranking":[],"latest":[],"latestByCategory":[]}}' > "$output"`,
      "printf '200'",
      ""
    ].join("\n")
  );
  chmodSync(fakeCurl, 0o755);

  const realPhp = spawnSync("sh", ["-c", "command -v php"], { encoding: "utf8" }).stdout.trim();
  assert.ok(realPhp);
  const realFind = spawnSync("sh", ["-c", "command -v find"], { encoding: "utf8" }).stdout.trim();
  assert.ok(realFind);
  const fakePhp = path.join(fakeBin, "php");
  writeFileSync(
    fakePhp,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'if [[ "${ROLLBACK_TEST_FAIL_LIVE_LINT:-0}" == "1" && "${1:-}" == "-l" && "${2:-}" == *"/addons/pingfangapi/"* ]] && grep -q "backup" "$2"; then',
      "  exit 89",
      "fi",
      'exec "$ROLLBACK_TEST_REAL_PHP" "$@"',
      ""
    ].join("\n")
  );
  chmodSync(fakePhp, 0o755);

  const fakeFind = path.join(fakeBin, "find");
  writeFileSync(
    fakeFind,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      'if [[ "${ROLLBACK_TEST_FAIL_CACHE:-0}" == "1" && "$*" == *"-mindepth 1"* ]]; then',
      "  exit 90",
      "fi",
      'exec "$ROLLBACK_TEST_REAL_FIND" "$@"',
      ""
    ].join("\n")
  );
  chmodSync(fakeFind, 0o755);

  return {
    addon,
    addonBackup,
    controller,
    controllerBackup,
    fakeBin,
    maccmsRoot,
    scenarioRoot,
    sshLog,
    templateDir,
    realFind,
    realPhp
  };
}

function runRollback(scenario, overrides = {}) {
  return spawnSync("bash", [rollbackPath], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${scenario.fakeBin}:${process.env.PATH}`,
      DEPLOY_HOST: "fixture.invalid",
      DEPLOY_USER: "fixture",
      DEPLOY_PATH: scenario.templateDir,
      DEPLOY_SITE_HOST: "fixture.invalid",
      DEPLOY_SITE_SCHEME: "https",
      API_ROLLBACK_BACKUP: backupId,
      ROLLBACK_TEST_REAL_FIND: scenario.realFind,
      ROLLBACK_TEST_REAL_PHP: scenario.realPhp,
      ROLLBACK_TEST_SSH_LOG: scenario.sshLog,
      ...overrides
    }
  });
}

function assertUnrelatedScopeUnchanged(scenario) {
  assert.equal(readFileSync(path.join(scenario.templateDir, "pingfangvideo/sentinel"), "utf8"), "theme\n");
  assert.equal(readFileSync(path.join(scenario.maccmsRoot, "addons/pingfangdevice/sentinel"), "utf8"), "device\n");
  assert.equal(
    readFileSync(path.join(scenario.maccmsRoot, "application/database.php"), "utf8"),
    "<?php return ['database' => 'unchanged'];\n"
  );
}

const success = createRollbackScenario();
try {
  const result = runRollback(success);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`Rolled back pingfangapi from ${backupId}`));
  assert.equal(readFileSync(path.join(success.addon, "info.ini"), "utf8"), "name = backup\n");
  assert.equal(
    readFileSync(success.controller, "utf8"),
    "<?php\nconst API_CONTROLLER_MARKER = 'backup';\n"
  );
  assert.equal(existsSync(path.join(success.maccmsRoot, "runtime/cache/stale")), false);
  assertUnrelatedScopeUnchanged(success);
  assert.equal(lstatSync(success.addonBackup).isDirectory(), true);
  assert.equal(lstatSync(success.controllerBackup).isFile(), true);
} finally {
  rmSync(success.scenarioRoot, { recursive: true, force: true });
}

for (const failureMode of ["smoke", "lint", "cache"]) {
  const scenario = createRollbackScenario();
  try {
    const result = runRollback(
      scenario,
      failureMode === "smoke"
        ? { ROLLBACK_TEST_CURL_MODE: "fail" }
        : failureMode === "lint"
          ? { ROLLBACK_TEST_FAIL_LIVE_LINT: "1" }
          : { ROLLBACK_TEST_FAIL_CACHE: "1" }
    );
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /restoring the pre-rollback filesystem snapshot/i,
      `status=${result.status}\nstdout=${result.stdout}\nstderr=${result.stderr}`
    );
    assert.equal(readFileSync(path.join(scenario.addon, "info.ini"), "utf8"), "name = current\n");
    assert.equal(
      readFileSync(scenario.controller, "utf8"),
      "<?php\nconst API_CONTROLLER_MARKER = 'current';\n"
    );
    assertUnrelatedScopeUnchanged(scenario);
  } finally {
    rmSync(scenario.scenarioRoot, { recursive: true, force: true });
  }
}

for (const missingPart of ["addon", "controller"]) {
  const scenario = createRollbackScenario();
  try {
    if (missingPart === "addon") {
      rmSync(scenario.addonBackup, { recursive: true });
    } else {
      rmSync(scenario.controllerBackup);
    }
    const result = runRollback(scenario);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /complete API rollback pair/i);
    assert.equal(readFileSync(path.join(scenario.addon, "info.ini"), "utf8"), "name = current\n");
    assertUnrelatedScopeUnchanged(scenario);
  } finally {
    rmSync(scenario.scenarioRoot, { recursive: true, force: true });
  }
}

const mismatchedBackup = createRollbackScenario();
try {
  writeFileSync(
    mismatchedBackup.controllerBackup,
    "<?php\nconst API_CONTROLLER_MARKER = 'mismatched';\n"
  );
  const result = runRollback(mismatchedBackup);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /mismatched API controllers/i);
  assert.equal(readFileSync(path.join(mismatchedBackup.addon, "info.ini"), "utf8"), "name = current\n");
  assertUnrelatedScopeUnchanged(mismatchedBackup);
} finally {
  rmSync(mismatchedBackup.scenarioRoot, { recursive: true, force: true });
}

const missingDatabase = createRollbackScenario();
try {
  rmSync(path.join(missingDatabase.maccmsRoot, "application/database.php"));
  const result = runRollback(missingDatabase);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /application\/database\.php is missing/i);
  assert.equal(readFileSync(path.join(missingDatabase.addon, "info.ini"), "utf8"), "name = current\n");
} finally {
  rmSync(missingDatabase.scenarioRoot, { recursive: true, force: true });
}

const linkedAncestor = createRollbackScenario();
try {
  const addons = path.join(linkedAncestor.maccmsRoot, "addons");
  const externalAddons = path.join(linkedAncestor.scenarioRoot, "external-addons");
  renameSync(addons, externalAddons);
  symlinkSync(externalAddons, addons);
  const result = runRollback(linkedAncestor);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must be a real directory/i);
  assert.equal(readFileSync(path.join(linkedAncestor.addon, "info.ini"), "utf8"), "name = current\n");
  assertUnrelatedScopeUnchanged(linkedAncestor);
} finally {
  rmSync(linkedAncestor.scenarioRoot, { recursive: true, force: true });
}

const linkedBackup = createRollbackScenario();
try {
  const realBackup = `${linkedBackup.addonBackup}.real`;
  rmSync(realBackup, { recursive: true, force: true });
  writeApiPair(realBackup, linkedBackup.controllerBackup, "linked");
  rmSync(linkedBackup.addonBackup, { recursive: true });
  symlinkSync(realBackup, linkedBackup.addonBackup);
  const result = runRollback(linkedBackup);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /symbolic link/i);
  assert.equal(readFileSync(path.join(linkedBackup.addon, "info.ini"), "utf8"), "name = current\n");
  assertUnrelatedScopeUnchanged(linkedBackup);
} finally {
  rmSync(linkedBackup.scenarioRoot, { recursive: true, force: true });
}

for (const invalidId of ["", "../pingfangapi.backup.evil", "latest", "20260724T120000Z-1-2/extra"]) {
  const scenario = createRollbackScenario();
  try {
    const result = runRollback(scenario, { API_ROLLBACK_BACKUP: invalidId });
    assert.notEqual(result.status, 0);
    assert.equal(existsSync(scenario.sshLog), false, `Invalid backup ID ${invalidId} must fail before SSH`);
    assert.equal(readFileSync(path.join(scenario.addon, "info.ini"), "utf8"), "name = current\n");
  } finally {
    rmSync(scenario.scenarioRoot, { recursive: true, force: true });
  }
}

console.log("API rollback tests passed");
