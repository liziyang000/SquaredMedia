import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts/audit-legacy-access.mjs");
const through = "2026-07-23";
const days = 30;
let targetsFile = "";

function dateKeys() {
  const keys = [];
  const end = Date.UTC(2026, 6, 23);
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    keys.push(new Date(end - offset * 86400000).toISOString().slice(0, 10));
  }
  return keys;
}

function accessLine(date, requestTarget = "/healthz", status = 200, method = "GET") {
  const [year, month, day] = date.split("-");
  const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1];
  return `203.0.113.42 - - [${day}/${monthName}/${year}:12:00:00 +0800] "${method} ${requestTarget} HTTP/1.1" ${status} 123 "-" "fixture-agent"`;
}

function runAudit(files, extraArgs = []) {
  return spawnSync(process.execPath, [script, "--through", through, "--days", String(days), "--targets", targetsFile, ...extraArgs, ...files], {
    cwd: root,
    encoding: "utf8"
  });
}

const fixtureRoot = mkdtempSync(path.join(tmpdir(), "squaredmedia-legacy-access-"));
try {
  targetsFile = path.join(fixtureRoot, "targets.json");
  writeFileSync(
    targetsFile,
    JSON.stringify({
      schemaVersion: 1,
      siteLabel: "fixture-production",
      aliasInventoryComplete: true,
      logCoverage: {
        from: dateKeys()[0],
        through,
        targetVhostOnly: true,
        allRotationsIncluded: true,
        locationsLogged: true,
        staticExports: true,
        nonOverlappingFiles: true
      },
      additionalPrefixes: {
        retiredActors: ["/legacy-actor-search/"]
      },
      legacyPlayPrefixes: ["/vodplay/"]
    })
  );
  const completeLog = path.join(fixtureRoot, "complete.log");
  writeFileSync(
    completeLog,
    `${dateKeys().map((date) => accessLine(date)).join("\n")}\n${accessLine(through, "/index.php/pingfangapi/index?compact=1&action=home_v2")}\n`
  );
  const complete = runAudit([completeLog]);
  assert.equal(complete.status, 0, complete.stderr);
  const completeReport = JSON.parse(complete.stdout);
  assert.equal(completeReport.window.complete, true);
  assert.equal(completeReport.evidence.logCoverageVerified, true);
  assert.equal(completeReport.window.observedDays, 30);
  assert.deepEqual(completeReport.window.missingDates, []);
  assert.equal(completeReport.targets.legacyApiHome.count, 0);
  assert.equal(completeReport.targets.currentApiHomeV2.count, 1);
  assert.match(completeReport.input.contentSha256, /^[a-f0-9]{64}$/);
  assert.equal(completeReport.reviewStatus, "MANUAL_REVIEW_REQUIRED");
  assert.equal(completeReport.decisions, undefined);
  assert.equal(completeReport.automatedRetirementAuthorized, false);

  const playbackOnlyLog = path.join(fixtureRoot, "playback-only.log");
  writeFileSync(
    playbackOnlyLog,
    `${dateKeys().map((date) => accessLine(date)).join("\n")}\n${accessLine(through, "/watch/42/1/3")}\n`
  );
  const playbackOnly = runAudit([playbackOnlyLog]);
  assert.equal(playbackOnly.status, 0, playbackOnly.stderr);
  const playbackOnlyReport = JSON.parse(playbackOnly.stdout);
  assert.equal(playbackOnlyReport.evidence.replacementTraffic.homeV2, 0);
  assert.equal(playbackOnlyReport.evidence.replacementTraffic.playbackFlow, 1);
  assert.equal(playbackOnlyReport.reviewStatus, "MANUAL_REVIEW_REQUIRED");

  const usageLog = path.join(fixtureRoot, "usage.log.gz");
  const usageLines = dateKeys().map((date) => accessLine(date));
  usageLines.push(
    accessLine(through, "/index.php/pingfangapi/%69ndex?action=home", 200),
    accessLine(through, "/index.php//pingfangapi/index?action=home", 200),
    accessLine(through, "//index.php/pingfangapi/index?action=home", 200),
    accessLine(through, "/legacy-actor-search/example", 200),
    accessLine(
      through,
      "/index.php/pingfangapi/index?token=super-secret&action=%68ome&action=home_v2",
      200
    ),
    accessLine(through, "/index.php/pingfangapi/player.html?media=https://private.example/video.m3u8", 200),
    accessLine(through, "/index.php/vod/play/id/42/sid/1/nid/3.html", 200),
    accessLine(through, "/vodplay/42-1-3.html", 301, "HEAD"),
    accessLine(through, "/index.php/actor/index.html", 410)
  );
  writeFileSync(usageLog, gzipSync(usageLines.join("\n") + "\n"));
  const usage = runAudit([usageLog]);
  assert.equal(usage.status, 0, usage.stderr);
  const usageReport = JSON.parse(usage.stdout);
  assert.equal(usageReport.targets.legacyApiHome.count, 3);
  assert.equal(usageReport.targets.currentApiHomeV2.count, 1);
  assert.equal(usageReport.targets.legacyApiPlayer.count, 1);
  assert.equal(usageReport.targets.legacyDynamicPlay.count, 1);
  assert.equal(usageReport.targets.legacyRewritePlay.count, 1);
  assert.equal(usageReport.targets.retiredActors.count, 2);
  assert.equal(usageReport.targets.retiredAccounts.count, 0);
  assert.equal(usageReport.reviewStatus, "MANUAL_REVIEW_REQUIRED");
  assert.doesNotMatch(usage.stdout, /203\.0\.113\.42|super-secret|private\.example|video\.m3u8|fixture-agent/);

  const failedTrafficLog = path.join(fixtureRoot, "failed-traffic.log");
  writeFileSync(
    failedTrafficLog,
    `${dateKeys().map((date) => accessLine(date)).join("\n")}\n${accessLine(through, "/index.php/actor/index.html", 404, "POST")}\n`
  );
  const failedTraffic = runAudit([failedTrafficLog]);
  assert.equal(failedTraffic.status, 0, failedTraffic.stderr);
  const failedTrafficReport = JSON.parse(failedTraffic.stdout);
  assert.equal(failedTrafficReport.targets.retiredActors.count, 1);
  assert.equal(failedTrafficReport.targets.retiredActors.browserSuccessCount, 0);
  assert.equal(failedTrafficReport.reviewStatus, "MANUAL_REVIEW_REQUIRED");
  assert.doesNotMatch(failedTraffic.stdout, /"KEEP"|"RETIRE"/);

  const incompleteLog = path.join(fixtureRoot, "incomplete.log");
  writeFileSync(incompleteLog, dateKeys().filter((date) => date !== "2026-07-03").map((date) => accessLine(date)).join("\n") + "\n");
  const incomplete = runAudit([incompleteLog]);
  assert.equal(incomplete.status, 0, incomplete.stderr);
  const incompleteReport = JSON.parse(incomplete.stdout);
  assert.equal(incompleteReport.window.complete, false);
  assert.deepEqual(incompleteReport.window.missingDates, ["2026-07-03"]);
  assert.equal(incompleteReport.reviewStatus, "INSUFFICIENT_EVIDENCE");

  const malformedLog = path.join(fixtureRoot, "malformed.log");
  writeFileSync(
    malformedLog,
    `${dateKeys().map((date) => accessLine(date)).join("\n")}\n${accessLine(through).replace("+0800", "+0860")}\n${accessLine(through).replace(
      "+0800",
      "+9999"
    )}\n${accessLine(through).replace(/200 123 "-" "fixture-agent"$/, "200 ")}\n`
  );
  const malformed = runAudit([malformedLog]);
  assert.equal(malformed.status, 1);
  const malformedReport = JSON.parse(malformed.stdout);
  assert.equal(malformedReport.input.malformedLines, 3);
  assert.equal(malformedReport.window.complete, false);
  assert.equal(malformedReport.reviewStatus, "INSUFFICIENT_EVIDENCE");

  const duplicate = runAudit([completeLog, completeLog]);
  assert.equal(duplicate.status, 1);
  const duplicateReport = JSON.parse(duplicate.stdout);
  assert.equal(duplicateReport.input.duplicateFiles, 1);
  assert.equal(duplicateReport.reviewStatus, "INSUFFICIENT_EVIDENCE");

  const defaultInventory = spawnSync(process.execPath, [script, "--through", through, "--days", String(days), completeLog], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(defaultInventory.status, 0, defaultInventory.stderr);
  const defaultReport = JSON.parse(defaultInventory.stdout);
  assert.equal(defaultReport.evidence.aliasInventoryComplete, false);
  assert.equal(defaultReport.evidence.logCoverageVerified, false);
  assert.ok(defaultReport.evidence.failures.includes("LOG_COVERAGE_UNVERIFIED"));
  assert.equal(defaultReport.window.complete, false);
  assert.equal(defaultReport.reviewStatus, "INSUFFICIENT_EVIDENCE");

  const invalidWindow = spawnSync(process.execPath, [script, "--through", through, "--days", "0", completeLog], {
    cwd: root,
    encoding: "utf8"
  });
  assert.equal(invalidWindow.status, 2);
  assert.match(invalidWindow.stderr, /--days must be an integer from 30/);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("legacy access audit tests passed");
