import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const appScript = readFileSync(path.join(root, "template", "pingfangvideo", "js", "app.js"), "utf8");

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(String(key)) ? values.get(String(key)) : null;
    },
    setItem(key, value) {
      values.set(String(key), String(value));
    },
    removeItem(key) {
      values.delete(String(key));
    },
    clear() {
      values.clear();
    },
    entries() {
      return [...values.entries()];
    }
  };
}

function createClassList() {
  return {
    add() {},
    remove() {},
    toggle() {},
    contains() {
      return false;
    }
  };
}

function createElement() {
  return {
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    classList: createClassList(),
    appendChild() {},
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    getAttribute() {
      return "";
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    matches() {
      return false;
    },
    closest() {
      return null;
    }
  };
}

function createAppRuntime() {
  const pageAttributes = {
    "data-source-quality-vod-id": "42",
    "data-source-quality-sid": "1",
    "data-source-quality-nid": "3"
  };
  const playerPage = {
    getAttribute(name) {
      return pageAttributes[name] || "";
    }
  };
  const sessionStorage = createStorage();
  const localStorage = createStorage();
  const document = {
    cookie: "",
    hidden: false,
    body: createElement(),
    documentElement: createElement(),
    querySelector(selector) {
      return selector === ".player-page[data-source-quality-vod-id]" ? playerPage : null;
    },
    querySelectorAll() {
      return [];
    },
    getElementById() {
      return null;
    },
    createElement,
    addEventListener() {},
    removeEventListener() {}
  };
  const context = {
    URL,
    console,
    document,
    localStorage,
    sessionStorage,
    navigator: { userAgent: "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36" },
    location: {
      href: "https://ping2video.xyz/vodplay/42-1-3.html",
      origin: "https://ping2video.xyz",
      pathname: "/vodplay/42-1-3.html",
      search: "",
      hash: ""
    },
    history: { replaceState() {} },
    matchMedia() {
      return {
        matches: false,
        addEventListener() {},
        removeEventListener() {}
      };
    },
    addEventListener() {},
    removeEventListener() {},
    getComputedStyle() {
      return {
        getPropertyValue() {
          return "";
        }
      };
    },
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
    requestAnimationFrame() {
      return 1;
    },
    cancelAnimationFrame() {}
  };
  context.window = context;
  context.globalThis = context;
  context.parent = context;
  context.top = context;
  vm.runInNewContext(appScript, context, { filename: "app.js" });
  return { context, pageAttributes, sessionStorage };
}

const runtime = createAppRuntime();
const api = runtime.context.PingFangVideo;

assert.equal(typeof api.reportPlaybackQoe, "function");
assert.equal(typeof api.rankPlaybackSourcesByQoe, "function");

const firstRecord = api.reportPlaybackQoe({
  sessionId: "session-one",
  status: "playing",
  firstFrameMs: 920,
  bufferingCount: 2,
  bufferingMs: 480,
  playedMs: 30_000,
  bandwidthEstimate: 3_200_000,
  currentWidth: 1280,
  currentHeight: 720,
  sourceUrl: "https://cdn.example/video.m3u8?token=secret"
});
assert.equal(firstRecord.vodId, "42");
assert.equal(firstRecord.sid, "1");
assert.equal(firstRecord.firstFrameMs, 920);
assert.equal(firstRecord.currentHeight, 720);
assert.equal("sourceUrl" in firstRecord, false);
assert.doesNotMatch(JSON.stringify(runtime.sessionStorage.entries()), /cdn\.example|token=secret/);

runtime.pageAttributes["data-source-quality-sid"] = "2";
api.reportPlaybackQoe({
  sessionId: "session-two",
  status: "playing",
  firstFrameMs: 410,
  bufferingCount: 0,
  bufferingMs: 0,
  playedMs: 30_000,
  bandwidthEstimate: 7_000_000,
  currentWidth: 1920,
  currentHeight: 1080
});
const lineTwoKey = "pingfang_playback_qoe_v1_42_3_2";
const lineTwoRecord = JSON.parse(runtime.sessionStorage.getItem(lineTwoKey));
lineTwoRecord.switchAttempts = 1;
runtime.sessionStorage.setItem(lineTwoKey, JSON.stringify(lineTwoRecord));
runtime.sessionStorage.setItem(
  "pingfang_pending_playback_switch_v1",
  JSON.stringify({
    version: 1,
    vodId: "42",
    nid: "3",
    targetSid: "2",
    expiresAt: Date.now() + 60_000
  })
);
const switchedRecord = api.reportPlaybackQoe({ sessionId: "session-two", status: "playing", firstFrameMs: 410 });
assert.equal(switchedRecord.switchAttempts, 1);
assert.equal(switchedRecord.switchSuccesses, 1);
assert.equal(runtime.sessionStorage.getItem("pingfang_pending_playback_switch_v1"), null);

runtime.pageAttributes["data-source-quality-sid"] = "1";
api.reportPlaybackQoe({
  sessionId: "session-one",
  status: "failed",
  errorType: "hls_network_error"
});

const sources = [
  { sid: 1, available: true, quality_rank: 1, speed_kbps: 9000, latency_ms: 10 },
  { sid: 2, available: true, quality_rank: 2, speed_kbps: 3000, latency_ms: 80 },
  { sid: 3, available: false, quality_rank: 3, speed_kbps: 12000, latency_ms: 5 }
];
assert.deepEqual(
  api.rankPlaybackSourcesByQoe("42", "3", sources).map((source) => String(source.sid)),
  ["2", "1"],
  "Client playback QoE should rank available lines after the server has filtered broken lines"
);

const cleanRuntime = createAppRuntime();
assert.deepEqual(
  cleanRuntime.context.PingFangVideo.rankPlaybackSourcesByQoe("42", "3", sources).map((source) => String(source.sid)),
  ["1", "2"],
  "Server ordering should remain the fallback until this client has useful playback data"
);

const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
assert.match(packageJson.scripts.test, /tests\/playback-qoe\.test\.mjs/);

console.log("Playback QoE checks passed.");
