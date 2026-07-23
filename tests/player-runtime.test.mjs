import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const playerHtml = readFileSync(path.join(root, "maccms-player", "static", "player", "artplayer.html"), "utf8");
const playerScript = readFileSync(path.join(root, "maccms-player", "static", "player", "artplayer", "pingfang-player-1.0.0.js"), "utf8");

assert.match(playerHtml, /artplayer-5\.4\.0\.min\.js/);
assert.match(playerHtml, /hls-1\.6\.16\.min\.js/);
assert.match(playerHtml, /pingfang-player-1\.0\.0\.js/);
assert.match(playerHtml, /pingfang-player-1\.0\.0\.css/);
assert.doesNotMatch(playerHtml, /<script[^>]+src=["']https?:/i, "Player engines should be served locally");
assert.doesNotMatch(playerHtml, /jquery|crypto-js|flv|danmuku|plugin-ads|api\.php/i, "Optional legacy features must stay out of the critical playback path");
assert.doesNotMatch(playerHtml, /name=["']referrer["']/i, "Third-party streams should keep the browser's default referrer policy");

function createRuntime({ alternateAvailable = false, resumeTime = 0, videoCurrentTime = 0, videoDuration = 180, lineList = null } = {}) {
  const status = { hidden: true };
  const statusMessage = { textContent: "" };
  const buttons = new Map();
  const links = [];
  const lineSwitches = [];
  const playerHandlers = new Map();
  const fakeVideo = {
    currentTime: videoCurrentTime,
    duration: videoDuration,
    paused: false,
    readyState: 4
  };
  const fakeArt = {
    hls: null,
    video: fakeVideo,
    notice: { show: "" },
    on(event, handler) {
      const handlers = playerHandlers.get(event) || [];
      handlers.push(handler);
      playerHandlers.set(event, handlers);
    },
    once(event, handler) {
      const onceHandler = (...args) => {
        this.off(event, onceHandler);
        handler(...args);
      };
      this.on(event, onceHandler);
    },
    off(event, handler) {
      playerHandlers.set(
        event,
        (playerHandlers.get(event) || []).filter((candidate) => candidate !== handler)
      );
    },
    emit(event, ...args) {
      for (const handler of [...(playerHandlers.get(event) || [])]) handler(...args);
    }
  };

  function FakeArtplayer(options) {
    FakeArtplayer.options = options;
    return fakeArt;
  }

  FakeArtplayer.version = "5.4.0";
  FakeArtplayer.FULLSCREEN_WEB_IN_BODY = true;

  class FakeHls {
    static Events = { ERROR: "error" };
    static ErrorTypes = { MEDIA_ERROR: "mediaError", NETWORK_ERROR: "networkError" };
    static instances = [];

    static isSupported() {
      return true;
    }

    constructor(config) {
      this.config = config;
      this.handlers = new Map();
      this.destroyed = false;
      this.recoveries = 0;
      FakeHls.instances.push(this);
    }

    on(event, handler) {
      this.handlers.set(event, handler);
    }

    emit(event, data) {
      this.handlers.get(event)?.(event, data);
    }

    loadSource(url) {
      this.source = url;
    }

    attachMedia(video) {
      this.video = video;
    }

    recoverMediaError() {
      this.recoveries += 1;
    }

    destroy() {
      this.destroyed = true;
    }
  }

  function button(action) {
    if (!buttons.has(action)) {
      buttons.set(action, {
        textContent: "",
        addEventListener(event, handler) {
          this[event] = handler;
        }
      });
    }
    return buttons.get(action);
  }

  let nextTimer = 1;
  const context = {
    URL,
    console,
    navigator: {
      userAgent: "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36"
    },
    location: {
      href: "https://ping2video.xyz/static/player/artplayer.html?url=https%3A%2F%2Fquery.example%2Fquery.m3u8",
      origin: "https://ping2video.xyz",
      search: "?url=https%3A%2F%2Fquery.example%2Fquery.m3u8",
      reload() {}
    },
    parent: {
      MacPlayer: {
        PlayUrl: "https://cdn.example/video/index.m3u8?token=a+b&expires=2"
      },
      PingFangVideo: {
        hasAlternatePlaybackLine() {
          return alternateAvailable;
        },
        switchToAlternatePlaybackLine(currentTime) {
          lineSwitches.push(currentTime);
          return alternateAvailable;
        },
        consumeAlternatePlaybackResume() {
          return resumeTime;
        }
      },
      location: {
        pathname: "/vodplay/42-1-3.html",
        href: "https://ping2video.xyz/vodplay/42-1-3.html"
      },
      document: {
        getElementById(id) {
          return id === "episodeList" ? lineList : null;
        }
      }
    },
    document: {
      readyState: "complete",
      head: {
        appendChild(node) {
          links.push(node);
        }
      },
      getElementById(id) {
        if (id === "playerStatus") return status;
        if (id === "playerStatusMessage") return statusMessage;
        return null;
      },
      querySelector(selector) {
        if (selector.includes('"retry"')) return button("retry");
        if (selector.includes('"lines"')) return button("lines");
        return null;
      },
      createElement() {
        return {};
      }
    },
    Artplayer: FakeArtplayer,
    Hls: FakeHls,
    setTimeout() {
      return nextTimer++;
    },
    clearTimeout() {}
  };

  context.window = context;
  context.globalThis = context;
  vm.runInNewContext(playerScript, context, { filename: "pingfang-player-1.0.0.js" });

  return {
    context,
    status,
    statusMessage,
    links,
    lineSwitches,
    fakeArt,
    fakeVideo,
    buttons,
    FakeArtplayer,
    FakeHls
  };
}

const runtime = createRuntime();
const api = runtime.context.PingfangPlayer;

const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
assert.match(packageJson.scripts.test, /tests\/player-runtime\.test\.mjs/);
assert.equal(api.version, "1.0.0");
assert.equal(
  api.sourceFromSearch("?url=https://cdn.example/video.m3u8?token=a+b&expires=2"),
  "https://cdn.example/video.m3u8?token=a+b&expires=2",
  "Unescaped source query parameters and plus signs should not be truncated"
);
assert.equal(
  api.sourceFromSearch("?url=https://cdn.example/video.m3u8?token=a%26b%23c&expires=2"),
  "https://cdn.example/video.m3u8?token=a%26b%23c&expires=2",
  "Escapes inside an already-raw signed URL should not be decoded again"
);
assert.equal(
  api.sourceFromSearch("?url=https%3A%2F%2Fcdn.example%2Fvideo.m3u8%3Ftoken%3Da%26expires%3D2"),
  "https://cdn.example/video.m3u8?token=a&expires=2",
  "Escaped source URLs should be decoded once"
);
assert.equal(api.normalizeSource("javascript:alert(1)", runtime.context.location.href), "");
assert.equal(api.normalizeSource("//cdn.example/video.m3u8", runtime.context.location.href), "https://cdn.example/video.m3u8");
assert.equal(api.resolveSourceUrl(), "https://cdn.example/video/index.m3u8?token=a+b&expires=2");
runtime.context.parent.MacPlayer.PlayUrl = "https%3A%2F%2Fcdn.example%2Fencoded.m3u8%3Ftoken%3Da%2526b";
assert.equal(api.resolveSourceUrl(), "https://cdn.example/encoded.m3u8?token=a%26b");
runtime.context.parent.MacPlayer.PlayUrl = "https://cdn.example/video/index.m3u8?token=a+b&expires=2";
assert.equal(api.playbackId("https://cdn.example/video/index.m3u8"), "pingfang:/vodplay/42-1-3.html");
assert.equal(api.sourceType("https://cdn.example/video.mp4?token=1"), "native");
assert.equal(api.sourceType("https://cdn.example/play?id=1"), "m3u8");
assert.equal(
  api.prefersNativeHls(
    {
      canPlayType() {
        return "maybe";
      }
    },
    "Mozilla/5.0 Version/18.5 Safari/605.1.15"
  ),
  true
);
assert.equal(
  api.prefersNativeHls(
    {
      canPlayType() {
        return "maybe";
      }
    },
    "Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36"
  ),
  false
);
assert.equal(
  api.prefersNativeHls(
    {
      canPlayType() {
        return "maybe";
      }
    },
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0.0.0 Mobile/15E148 Safari/604.1",
    5
  ),
  true
);
assert.equal(
  api.prefersNativeHls(
    {
      canPlayType() {
        return "maybe";
      }
    },
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.5 Safari/605.1.15",
    5
  ),
  true
);
assert.deepEqual(JSON.parse(JSON.stringify(api.hlsConfig)), {
  enableWorker: true,
  capLevelToPlayerSize: true,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  backBufferLength: 30
});

assert.equal(runtime.FakeArtplayer.FULLSCREEN_WEB_IN_BODY, false, "ArtPlayer 5.4 should retain the previous iframe web-fullscreen behavior");
assert.equal(runtime.FakeArtplayer.options.autoPlayback, true);
assert.equal(runtime.FakeArtplayer.options.moreVideoAttr.preload, "auto");
assert.equal(runtime.FakeArtplayer.options.type, "m3u8");
assert.equal(runtime.links[0].href, "https://cdn.example");

const video = {
  canPlayType() {
    return "";
  }
};
const playM3u8 = runtime.FakeArtplayer.options.customType.m3u8;
playM3u8(video, "https://cdn.example/first.m3u8", runtime.fakeArt);
const firstHls = runtime.FakeHls.instances[0];
assert.equal(firstHls.source, "https://cdn.example/first.m3u8");
assert.equal(firstHls.video, video);

playM3u8(video, "https://cdn.example/second.m3u8", runtime.fakeArt);
const secondHls = runtime.FakeHls.instances[1];
assert.equal(firstHls.destroyed, true, "Switching a URL should destroy the previous HLS instance");
assert.equal(runtime.fakeArt.hls, secondHls);

secondHls.emit(runtime.FakeHls.Events.ERROR, {
  fatal: true,
  type: runtime.FakeHls.ErrorTypes.MEDIA_ERROR
});
assert.equal(secondHls.recoveries, 1, "The first fatal media error should use bounded HLS recovery");

secondHls.emit(runtime.FakeHls.Events.ERROR, {
  fatal: true,
  type: runtime.FakeHls.ErrorTypes.NETWORK_ERROR
});
assert.equal(runtime.status.hidden, false);
assert.match(runtime.statusMessage.textContent, /线路连接失败/);

runtime.fakeArt.emit("destroy");
assert.equal(secondHls.destroyed, true, "Destroying ArtPlayer should destroy the active HLS instance");

const alternateRuntime = createRuntime({
  alternateAvailable: true,
  videoCurrentTime: 37.5
});
assert.equal(alternateRuntime.buttons.get("lines").textContent, "切换备用线路");
alternateRuntime.buttons.get("lines").click();
assert.deepEqual(alternateRuntime.lineSwitches, [37.5], "A manual line switch should carry the current playback position");

let fallbackScrolls = 0;
const fallbackRuntime = createRuntime({
  lineList: {
    scrollIntoView() {
      fallbackScrolls += 1;
    }
  }
});
assert.equal(fallbackRuntime.buttons.get("lines").textContent, "查看线路");
fallbackRuntime.buttons.get("lines").click();
assert.equal(fallbackScrolls, 1, "Missing same-episode alternatives should keep the episode-list fallback");

const resumeRuntime = createRuntime({
  resumeTime: 84.2,
  videoDuration: 180
});
resumeRuntime.fakeArt.emit("video:canplay");
assert.equal(resumeRuntime.fakeVideo.currentTime, 84.2, "A same-episode line switch should restore its session playback position");
assert.match(resumeRuntime.fakeArt.notice.show, /已恢复/);

const nearEndRuntime = createRuntime({
  resumeTime: 176,
  videoDuration: 180
});
nearEndRuntime.fakeArt.emit("video:canplay");
assert.equal(nearEndRuntime.fakeVideo.currentTime, 0, "A resume point near the end should not replay the episode ending");

console.log("Player runtime checks passed.");
