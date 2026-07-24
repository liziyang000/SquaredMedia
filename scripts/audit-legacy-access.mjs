#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream, lstatSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createGunzip } from "node:zlib";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultTargetsFile = path.join(repoRoot, "ops/legacy-access-targets.json");
const monthIndexes = new Map(
  ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month, index) => [month, index])
);
const quotedLogFieldPattern = String.raw`"(?:[^"\\]|\\.)*"`;
const accessLinePattern = new RegExp(
  String.raw`^\S+\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([A-Z]+)\s+(\S+)\s+HTTP\/[0-9.]+"\s+([1-5][0-9]{2})\s+(?:\d+|-)\s+${quotedLogFieldPattern}\s+${quotedLogFieldPattern}$`
);
const dynamicPlayPattern = /^\/index\.php\/vod\/play\/id\/[^/?]+\/sid\/[^/?]+\/nid\/[^/?]+(?:\.html)?\/?$/;
const configurableTargetNames = new Set([
  "legacyApiHome",
  "currentApiHomeV2",
  "legacyApiPlayer",
  "currentApiPlayback",
  "currentApiStream",
  "currentReactPlayback",
  "staleReactApi",
  "legacyDynamicPlay",
  "legacyRewritePlay",
  "retiredAccounts",
  "retiredActors",
  "retiredArticles",
  "retiredRoles",
  "retiredTopics",
  "retiredWebsites",
  "retiredPlots",
  "retiredGamesAndComics",
  "retiredSitemaps",
  "playerDiagnostics"
]);

function printUsage(exitCode, message) {
  if (message) console.error(message);
  console.error(
    "Usage: node scripts/audit-legacy-access.mjs --through YYYY-MM-DD [--days 30] [--targets file.json] <access.log|access.log.gz> [...]"
  );
  process.exit(exitCode);
}

function calendarDateTime(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) return null;
  return time;
}

function parseArguments(argv) {
  let through = "";
  let days = 30;
  let targetsFile = defaultTargetsFile;
  const files = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--through") {
      through = argv[++index] || "";
    } else if (argument.startsWith("--through=")) {
      through = argument.slice("--through=".length);
    } else if (argument === "--days") {
      days = Number(argv[++index]);
    } else if (argument.startsWith("--days=")) {
      days = Number(argument.slice("--days=".length));
    } else if (argument === "--targets") {
      targetsFile = argv[++index] || "";
    } else if (argument.startsWith("--targets=")) {
      targetsFile = argument.slice("--targets=".length);
    } else if (argument === "--help" || argument === "-h") {
      printUsage(0);
    } else if (argument.startsWith("-")) {
      printUsage(2, `Unknown option: ${argument}`);
    } else {
      files.push(argument);
    }
  }

  if (!Number.isInteger(days) || days < 30 || days > 365) {
    printUsage(2, "--days must be an integer from 30 to 365.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(through)) {
    printUsage(2, "--through must be a calendar date in YYYY-MM-DD form.");
  }
  const throughTime = calendarDateTime(through);
  const todayTime = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  if (throughTime === null) {
    printUsage(2, "--through must be a valid calendar date.");
  }
  if (throughTime >= todayTime) {
    printUsage(2, "--through must be yesterday or an earlier fully completed date.");
  }
  if (!targetsFile) {
    printUsage(2, "--targets requires a local JSON file.");
  }
  if (files.length === 0) {
    printUsage(2, "At least one local access-log file is required.");
  }

  return { days, files, targetsFile, through, throughTime };
}

function safeLocalFile(file, label) {
  let stat;
  try {
    stat = lstatSync(file);
  } catch {
    printUsage(2, `${label} does not exist: ${path.basename(file)}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    printUsage(2, `${label} must be a local regular file, not a link: ${path.basename(file)}`);
  }
}

function readTargets(file) {
  safeLocalFile(file, "Targets inventory");
  let value;
  try {
    value = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    printUsage(2, "Targets inventory must contain valid JSON.");
  }
  const coverage = value && value.logCoverage;
  const coverageFlags = ["targetVhostOnly", "allRotationsIncluded", "locationsLogged", "staticExports", "nonOverlappingFiles"];
  const additionalPrefixes = value && value.additionalPrefixes;
  const validPrefix = (prefix) =>
    typeof prefix === "string" &&
    prefix.startsWith("/") &&
    !prefix.startsWith("//") &&
    !prefix.includes("\\") &&
    !prefix.includes("?") &&
    !prefix.includes("#");
  const validAdditionalPrefixes =
    additionalPrefixes &&
    typeof additionalPrefixes === "object" &&
    !Array.isArray(additionalPrefixes) &&
    Object.entries(additionalPrefixes).every(
      ([name, prefixes]) => configurableTargetNames.has(name) && Array.isArray(prefixes) && prefixes.every(validPrefix)
    );
  const validCoverage =
    coverage === null ||
    (coverage &&
      typeof coverage === "object" &&
      calendarDateTime(coverage.from) !== null &&
      calendarDateTime(coverage.through) !== null &&
      coverage.from <= coverage.through &&
      coverageFlags.every((name) => coverage[name] === true));
  if (
    !value ||
    value.schemaVersion !== 1 ||
    typeof value.siteLabel !== "string" ||
    value.siteLabel.trim() === "" ||
    value.siteLabel.length > 80 ||
    typeof value.aliasInventoryComplete !== "boolean" ||
    !validCoverage ||
    !validAdditionalPrefixes ||
    !Array.isArray(value.legacyPlayPrefixes) ||
    value.legacyPlayPrefixes.some((prefix) => !validPrefix(prefix) || !prefix.endsWith("/"))
  ) {
    printUsage(2, "Targets inventory has an unsupported shape.");
  }
  return {
    siteLabel: value.siteLabel.trim(),
    aliasInventoryComplete: value.aliasInventoryComplete,
    logCoverage: coverage,
    additionalPrefixes: Object.fromEntries(
      Object.entries(additionalPrefixes).map(([name, prefixes]) => [name, [...new Set(prefixes)]])
    ),
    legacyPlayPrefixes: [...new Set(value.legacyPlayPrefixes)]
  };
}

function requiredDateKeys(throughTime, days) {
  const dates = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    dates.push(new Date(throughTime - offset * 86400000).toISOString().slice(0, 10));
  }
  return dates;
}

function parseTimestamp(value) {
  const match = value.match(/^(\d{2})\/([A-Z][a-z]{2})\/(\d{4}):(\d{2}):(\d{2}):(\d{2}) ([+-])(\d{2})(\d{2})$/);
  if (!match || !monthIndexes.has(match[2])) return null;

  const year = Number(match[3]);
  const month = monthIndexes.get(match[2]);
  const day = Number(match[1]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = Number(match[8]);
  const offsetMinute = Number(match[9]);
  const offset = `${match[7]}${match[8]}${match[9]}`;
  const offsetMinutes = (offsetHour * 60 + offsetMinute) * (match[7] === "+" ? 1 : -1);
  const localTime = Date.UTC(year, month, day, hour, minute, second);
  const date = new Date(localTime);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 23 ||
    offsetMinute > 59
  ) {
    return null;
  }

  return {
    day: `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    offset,
    timestamp: localTime - offsetMinutes * 60000
  };
}

function decodedStream(file) {
  const source = createReadStream(file);
  return file.endsWith(".gz") ? source.pipe(createGunzip()) : source;
}

async function contentDigest(file) {
  const hash = createHash("sha256");
  for await (const chunk of decodedStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function processFile(file, onLine) {
  const hash = createHash("sha256");
  const stream = decodedStream(file);
  stream.on("data", (chunk) => hash.update(chunk));
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of lines) onLine(line);
  return hash.digest("hex");
}

function emptyTarget() {
  return {
    count: 0,
    browserSuccessCount: 0,
    byMethod: {},
    byStatusClass: {},
    firstAt: null,
    lastAt: null
  };
}

function recordTarget(target, method, status, timestamp) {
  target.count += 1;
  if ((method === "GET" || method === "HEAD") && status >= 200 && status < 400) target.browserSuccessCount += 1;
  target.byMethod[method] = (target.byMethod[method] || 0) + 1;
  const statusClass = `${Math.floor(status / 100)}xx`;
  target.byStatusClass[statusClass] = (target.byStatusClass[statusClass] || 0) + 1;
  if (target.firstAt === null || timestamp < Date.parse(target.firstAt)) target.firstAt = new Date(timestamp).toISOString();
  if (target.lastAt === null || timestamp > Date.parse(target.lastAt)) target.lastAt = new Date(timestamp).toISOString();
}

function lastAction(url) {
  return url.searchParams.getAll("action").at(-1) || "";
}

function parseRequestTarget(target) {
  if (target === "*") return { pathname: "*", searchParams: new URLSearchParams() };
  if (target.startsWith("/")) {
    const queryIndex = target.indexOf("?");
    return {
      pathname: queryIndex === -1 ? target : target.slice(0, queryIndex),
      searchParams: new URLSearchParams(queryIndex === -1 ? "" : target.slice(queryIndex + 1))
    };
  }
  try {
    const absolute = new URL(target);
    if (absolute.protocol !== "http:" && absolute.protocol !== "https:") return null;
    return { pathname: absolute.pathname, searchParams: absolute.searchParams };
  } catch {
    return null;
  }
}

function normalizeNginxPathname(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.includes("\0")) return null;

  const segments = [];
  for (const segment of decoded.split(/\/+/)) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }
  const trailingSlash = decoded.endsWith("/") && segments.length > 0 ? "/" : "";
  return `/${segments.join("/")}${trailingSlash}`;
}

function createMatchers(inventory) {
  return {
    legacyApiHome(url) {
      return url.pathname === "/index.php/pingfangapi/index" && lastAction(url) === "home";
    },
    currentApiHomeV2(url) {
      return url.pathname === "/index.php/pingfangapi/index" && lastAction(url) === "home_v2";
    },
    legacyApiPlayer(url) {
      return /^\/index\.php\/pingfangapi\/player(?:\.html)?(?:\/|$)/.test(url.pathname);
    },
    currentApiPlayback(url) {
      return url.pathname === "/index.php/pingfangapi/index" && lastAction(url) === "playback";
    },
    currentApiStream(url) {
      return /^\/index\.php\/pingfangapi\/stream(?:\/|$)/.test(url.pathname);
    },
    currentReactPlayback(url) {
      return /^\/(?:watch|trial)\//.test(url.pathname);
    },
    staleReactApi(url) {
      return url.pathname === "/react-api.php";
    },
    legacyDynamicPlay(url) {
      return dynamicPlayPattern.test(url.pathname);
    },
    legacyRewritePlay(url) {
      return inventory.legacyPlayPrefixes.some((prefix) => url.pathname.startsWith(prefix));
    },
    retiredAccounts(url) {
      return (
        ["/register", "/forgot-password"].includes(url.pathname) ||
        /^\/index\.php\/user\/(?:findpass|reg)(?:\/.*|\.html)?$/.test(url.pathname)
      );
    },
    retiredActors(url) {
      return /^\/actors(?:\/|$)/.test(url.pathname) || /^\/index\.php\/actor\/(?:detail|index|search|show|type)(?:\/.*|\.html)?$/.test(url.pathname);
    },
    retiredArticles(url) {
      return /^\/articles(?:\/|$)/.test(url.pathname) || /^\/index\.php\/art\/(?:confirm|detail|detail_pwd|index|search|show|type)(?:\/.*|\.html)?$/.test(url.pathname);
    },
    retiredRoles(url) {
      return /^\/roles(?:\/|$)/.test(url.pathname) || /^\/index\.php\/role\/(?:detail|index|show)(?:\/.*|\.html)?$/.test(url.pathname);
    },
    retiredTopics(url) {
      return /^\/topics(?:\/|$)/.test(url.pathname) || /^\/index\.php\/topic\/(?:detail|index)(?:\/.*|\.html)?$/.test(url.pathname);
    },
    retiredWebsites(url) {
      return /^\/websites(?:\/|$)/.test(url.pathname) || /^\/index\.php\/website\/(?:detail|index|search|show|type)(?:\/.*|\.html)?$/.test(url.pathname);
    },
    retiredPlots(url) {
      return /^\/plots(?:\/|$)/.test(url.pathname) || /^\/index\.php\/plot\/(?:udetail|uindex)(?:\/.*|\.html)?$/.test(url.pathname);
    },
    retiredGamesAndComics(url) {
      return /^\/(?:games|comics)(?:\/|$)/.test(url.pathname) || /^\/index\.php\/label\/comics(?:\/.*|\.html)?$/.test(url.pathname);
    },
    retiredSitemaps(url) {
      return (
        ["/baidu.xml", "/google.xml", "/sitemap.xml"].includes(url.pathname) ||
        /^\/index\.php\/(?:map|rss)\/(?:baidu|google)(?:\/.*|\.html)?$/.test(url.pathname)
      );
    },
    playerDiagnostics(url) {
      return ["/static/player/artplayer.html", "/static/player/artplayer/api.php", "/static/js/playerconfig.js"].includes(url.pathname);
    }
  };
}

const options = parseArguments(process.argv.slice(2));
const inventory = readTargets(options.targetsFile);
for (const file of options.files) safeLocalFile(file, "Access log");

const requiredDates = requiredDateKeys(options.throughTime, options.days);
const requiredDateSet = new Set(requiredDates);
const observedDates = new Set();
const observedOffsets = new Set();
const matchers = createMatchers(inventory);
const targets = Object.fromEntries(Object.keys(matchers).map((name) => [name, emptyTarget()]));
const input = {
  sourceFiles: options.files.length,
  uniqueFiles: 0,
  parsedLines: 0,
  inWindowLines: 0,
  outOfWindowLines: 0,
  malformedLines: 0,
  duplicateFiles: 0,
  changedFiles: 0,
  firstParsedAt: null,
  lastParsedAt: null,
  contentSha256: ""
};

const seenDigests = new Set();
const processedDigests = [];
try {
  for (const file of options.files) {
    const initialDigest = await contentDigest(file);
    if (seenDigests.has(initialDigest)) {
      input.duplicateFiles += 1;
      continue;
    }
    seenDigests.add(initialDigest);
    input.uniqueFiles += 1;
    const processedDigest = await processFile(file, (line) => {
      if (line.trim() === "") return;
      if (line.length > 8192) {
        input.malformedLines += 1;
        return;
      }
      const match = line.match(accessLinePattern);
      const parsedTimestamp = match ? parseTimestamp(match[1]) : null;
      if (!match || !parsedTimestamp) {
        input.malformedLines += 1;
        return;
      }
      const url = parseRequestTarget(match[3]);
      if (!url) {
        input.malformedLines += 1;
        return;
      }
      if (url.pathname !== "*") {
        const normalizedPathname = normalizeNginxPathname(url.pathname);
        if (normalizedPathname === null) {
          input.malformedLines += 1;
          return;
        }
        url.pathname = normalizedPathname;
      }

      input.parsedLines += 1;
      const parsedAt = new Date(parsedTimestamp.timestamp).toISOString();
      if (input.firstParsedAt === null || parsedTimestamp.timestamp < Date.parse(input.firstParsedAt)) input.firstParsedAt = parsedAt;
      if (input.lastParsedAt === null || parsedTimestamp.timestamp > Date.parse(input.lastParsedAt)) input.lastParsedAt = parsedAt;
      if (!requiredDateSet.has(parsedTimestamp.day)) {
        input.outOfWindowLines += 1;
        return;
      }

      input.inWindowLines += 1;
      observedDates.add(parsedTimestamp.day);
      observedOffsets.add(parsedTimestamp.offset);
      const method = match[2];
      const status = Number(match[4]);
      for (const [name, matches] of Object.entries(matchers)) {
        const additionalMatch = (inventory.additionalPrefixes[name] || []).some((prefix) => url.pathname.startsWith(prefix));
        if (matches(url) || additionalMatch) recordTarget(targets[name], method, status, parsedTimestamp.timestamp);
      }
    });
    processedDigests.push(processedDigest);
    if (processedDigest !== initialDigest) input.changedFiles += 1;
  }
} catch (error) {
  const failedFile = error && typeof error.path === "string" ? path.basename(error.path) : "input";
  console.error(`Failed to read access log ${failedFile}.`);
  process.exit(2);
}
input.contentSha256 = createHash("sha256").update(processedDigests.sort().join("\n")).digest("hex");

const missingDates = requiredDates.filter((date) => !observedDates.has(date));
const logCoverageVerified =
  inventory.logCoverage !== null &&
  inventory.logCoverage.from <= requiredDates[0] &&
  inventory.logCoverage.through >= options.through;
const evidenceFailures = [];
if (input.malformedLines > 0) evidenceFailures.push("MALFORMED_LINES");
if (input.duplicateFiles > 0) evidenceFailures.push("DUPLICATE_INPUT");
if (input.changedFiles > 0) evidenceFailures.push("CHANGED_INPUT");
if (missingDates.length > 0) evidenceFailures.push("MISSING_DATES");
if (observedOffsets.size > 1) evidenceFailures.push("MIXED_TIME_OFFSETS");
if (!inventory.aliasInventoryComplete) evidenceFailures.push("ALIAS_INVENTORY_INCOMPLETE");
if (!logCoverageVerified) evidenceFailures.push("LOG_COVERAGE_UNVERIFIED");

const report = {
  schemaVersion: 1,
  siteLabel: inventory.siteLabel,
  window: {
    from: requiredDates[0],
    through: options.through,
    requestedDays: options.days,
    observedDays: observedDates.size,
    missingDates,
    complete:
      input.malformedLines === 0 &&
      input.duplicateFiles === 0 &&
      input.changedFiles === 0 &&
      missingDates.length === 0 &&
      observedOffsets.size <= 1 &&
      logCoverageVerified
  },
  input,
  targets,
  evidence: {
    aliasInventoryComplete: inventory.aliasInventoryComplete,
    logCoverageVerified,
    replacementTraffic: {
      homeV2: targets.currentApiHomeV2.browserSuccessCount,
      playbackFlow:
        targets.currentApiPlayback.browserSuccessCount +
        targets.currentApiStream.browserSuccessCount +
        targets.currentReactPlayback.browserSuccessCount
    },
    failures: evidenceFailures
  },
  reviewStatus: evidenceFailures.length > 0 ? "INSUFFICIENT_EVIDENCE" : "MANUAL_REVIEW_REQUIRED",
  automatedRetirementAuthorized: false
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (input.malformedLines > 0 || input.duplicateFiles > 0 || input.changedFiles > 0 || observedOffsets.size > 1) process.exitCode = 1;
