(function initPingfangPlayer(global) {
  "use strict";

  var PLAYER_VERSION = "1.0.0";
  var STARTUP_TIMEOUT_MS = 12000;
  var STALL_TIMEOUT_MS = 8000;
  var MEDIA_RECOVERY_COOLDOWN_MS = 5000;
  var MAX_MEDIA_RECOVERIES = 2;
  var HLS_CONFIG = Object.freeze({
    enableWorker: true,
    capLevelToPlayerSize: true,
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    backBufferLength: 30
  });

  function decodeSourceValue(value) {
    if (!value) return "";
    var source = String(value);
    if (/^(?:https?:)?\/\//i.test(source)) return source;

    try {
      return decodeURIComponent(source);
    } catch (error) {
      return source;
    }
  }

  function sourceFromSearch(search) {
    var marker = "?url=";
    var markerIndex = String(search || "").indexOf(marker);
    if (markerIndex === -1) return "";

    return decodeSourceValue(String(search).slice(markerIndex + marker.length));
  }

  function normalizeSource(value, baseHref) {
    if (typeof value !== "string" || !value.trim()) return "";

    try {
      var source = new URL(value.trim(), baseHref);
      if (source.protocol !== "http:" && source.protocol !== "https:") return "";
      return source.href;
    } catch (error) {
      return "";
    }
  }

  function parentMacPlayerSource() {
    try {
      var macPlayer = global.parent && global.parent.MacPlayer;
      return macPlayer && typeof macPlayer.PlayUrl === "string" ? macPlayer.PlayUrl : "";
    } catch (error) {
      return "";
    }
  }

  function resolveSourceUrl() {
    var location = global.location || {};
    var candidate = parentMacPlayerSource() || sourceFromSearch(location.search);
    return normalizeSource(decodeSourceValue(candidate), location.href || "https://localhost/");
  }

  function parentPlaybackPath() {
    try {
      return global.parent && global.parent.location ? global.parent.location.pathname : "";
    } catch (error) {
      return "";
    }
  }

  function playbackId(sourceUrl) {
    var parentPath = parentPlaybackPath();
    if (parentPath && parentPath !== "/") return "pingfang:" + parentPath;

    try {
      var source = new URL(sourceUrl);
      return "pingfang:" + source.origin + source.pathname;
    } catch (error) {
      return "pingfang:video";
    }
  }

  function sourceType(sourceUrl) {
    try {
      var pathname = new URL(sourceUrl).pathname.toLowerCase();
      return /\.(?:mp4|m4v|mov|webm|ogv|ogg)$/.test(pathname) ? "native" : "m3u8";
    } catch (error) {
      return "m3u8";
    }
  }

  function prefersNativeHls(video, userAgent, maxTouchPoints) {
    if (!video.canPlayType("application/vnd.apple.mpegurl")) return false;

    var agent = String(userAgent || "");
    var isAppleMobile = /(?:ipad|iphone|ipod)/i.test(agent) || (/macintosh/i.test(agent) && Number(maxTouchPoints) > 1);
    if (isAppleMobile) return true;

    return /safari/i.test(agent) && !/(?:android|chrome|chromium|crios|edg|opr)/i.test(agent);
  }

  var publicApi = Object.freeze({
    version: PLAYER_VERSION,
    hlsConfig: HLS_CONFIG,
    sourceFromSearch: sourceFromSearch,
    normalizeSource: normalizeSource,
    resolveSourceUrl: resolveSourceUrl,
    playbackId: playbackId,
    sourceType: sourceType,
    prefersNativeHls: prefersNativeHls
  });

  global.PingfangPlayer = publicApi;
  if (!global.document) return;

  function bootstrap() {
    var document = global.document;
    var status = document.getElementById("playerStatus");
    var statusMessage = document.getElementById("playerStatusMessage");
    var retryButton = document.querySelector('[data-player-action="retry"]');
    var linesButton = document.querySelector('[data-player-action="lines"]');
    var startupTimer = 0;
    var stallTimer = 0;
    var hasPlayed = false;
    var resumeChecked = false;

    function clearTimer(timer) {
      if (timer) global.clearTimeout(timer);
    }

    function clearPlaybackTimers() {
      clearTimer(startupTimer);
      clearTimer(stallTimer);
      startupTimer = 0;
      stallTimer = 0;
    }

    function showStatus(message) {
      if (!status || !statusMessage) return;
      updateLinesButton();
      statusMessage.textContent = message;
      status.hidden = false;
    }

    function hideStatus() {
      if (status) status.hidden = true;
    }

    function parentPlayerBridge() {
      try {
        return global.parent && global.parent.PingFangVideo;
      } catch (error) {
        return null;
      }
    }

    function hasAlternateLine() {
      var bridge = parentPlayerBridge();
      try {
        return Boolean(bridge && bridge.hasAlternatePlaybackLine && bridge.hasAlternatePlaybackLine());
      } catch (error) {
        return false;
      }
    }

    function updateLinesButton() {
      if (linesButton) {
        linesButton.textContent = hasAlternateLine() ? "切换备用线路" : "查看线路";
      }
    }

    function currentPlaybackTime() {
      var time = Number(art && art.video && art.video.currentTime);
      return Number.isFinite(time) && time > 0 ? time : 0;
    }

    function openLineSelector() {
      var bridge = parentPlayerBridge();
      try {
        if (bridge && bridge.switchToAlternatePlaybackLine && bridge.switchToAlternatePlaybackLine(currentPlaybackTime())) {
          return;
        }
      } catch (error) {}

      try {
        var lineList = global.parent.document.getElementById("episodeList");
        if (lineList) {
          lineList.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      } catch (error) {}

      showStatus("当前线路不可用，请返回播放页手动切换线路。");
    }

    updateLinesButton();

    if (retryButton) {
      retryButton.addEventListener("click", function retryPlayback() {
        global.location.reload();
      });
    }

    if (linesButton) {
      linesButton.addEventListener("click", openLineSelector);
    }

    var sourceUrl = resolveSourceUrl();
    if (!sourceUrl) {
      showStatus("播放地址无效，请切换线路后重试。");
      return;
    }

    if (typeof global.Artplayer !== "function") {
      showStatus("播放器核心加载失败，请刷新页面后重试。");
      return;
    }

    function addSourcePreconnect() {
      try {
        var sourceOrigin = new URL(sourceUrl).origin;
        if (!sourceOrigin || sourceOrigin === global.location.origin) return;

        var preconnect = document.createElement("link");
        preconnect.rel = "preconnect";
        preconnect.href = sourceOrigin;
        preconnect.crossOrigin = "anonymous";
        document.head.appendChild(preconnect);
      } catch (error) {}
    }

    function destroyHls(art) {
      if (!art.hls) return;
      art.hls.destroy();
      art.hls = null;
    }

    function playM3u8(video, url, art) {
      destroyHls(art);

      if (prefersNativeHls(video, global.navigator && global.navigator.userAgent, global.navigator && global.navigator.maxTouchPoints)) {
        video.src = url;
        return;
      }

      if (!global.Hls || !global.Hls.isSupported()) {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          return;
        }

        showStatus("当前浏览器不支持 HLS 播放，请更换浏览器或线路。");
        return;
      }

      var hls = new global.Hls(HLS_CONFIG);
      var lastMediaRecoveryAt = 0;
      var mediaRecoveryCount = 0;
      art.hls = hls;

      hls.on(global.Hls.Events.ERROR, function handleHlsError(event, data) {
        if (!data || !data.fatal) return;

        if (data.type === global.Hls.ErrorTypes.MEDIA_ERROR) {
          var now = Date.now();
          if (mediaRecoveryCount < MAX_MEDIA_RECOVERIES && now - lastMediaRecoveryAt >= MEDIA_RECOVERY_COOLDOWN_MS) {
            mediaRecoveryCount += 1;
            lastMediaRecoveryAt = now;
            art.notice.show = "正在恢复视频播放…";
            hls.recoverMediaError();
            return;
          }
        }

        clearPlaybackTimers();
        if (data.type === global.Hls.ErrorTypes.NETWORK_ERROR) {
          showStatus("视频线路连接失败，请重新加载或切换线路。");
        } else {
          showStatus("视频解码失败，请重新加载或切换线路。");
        }
      });

      hls.loadSource(url);
      hls.attachMedia(video);

      if (!art.pingfangHlsCleanupBound) {
        art.pingfangHlsCleanupBound = true;
        art.once("destroy", function destroyPlayerHls() {
          destroyHls(art);
        });
      }
    }

    addSourcePreconnect();
    global.Artplayer.FULLSCREEN_WEB_IN_BODY = false;

    var options = {
      id: playbackId(sourceUrl),
      container: "#artplayer",
      url: sourceUrl,
      theme: "#d4aa65",
      lang: "zh-cn",
      autoplay: true,
      loop: false,
      playbackRate: true,
      aspectRatio: true,
      setting: true,
      hotkey: true,
      pip: true,
      mutex: true,
      backdrop: true,
      fullscreen: true,
      fullscreenWeb: true,
      miniProgressBar: true,
      playsInline: true,
      lock: true,
      gesture: true,
      fastForward: true,
      autoPlayback: true,
      autoOrientation: true,
      airplay: true,
      moreVideoAttr: {
        preload: "auto"
      }
    };

    if (sourceType(sourceUrl) === "m3u8") {
      options.type = "m3u8";
      options.customType = {
        m3u8: playM3u8
      };
    }

    var art = new global.Artplayer(options);
    startupTimer = global.setTimeout(function showSlowStartup() {
      showStatus("视频加载较慢，可以重新加载或切换线路。");
    }, STARTUP_TIMEOUT_MS);

    function restoreAlternatePlaybackResume() {
      if (resumeChecked || !art.video) return;

      var duration = Number(art.video.duration);
      if (!Number.isFinite(duration) || duration <= 0) return;

      var bridge = parentPlayerBridge();
      if (!bridge || !bridge.consumeAlternatePlaybackResume) return;

      var time;
      try {
        time = Number(bridge.consumeAlternatePlaybackResume());
      } catch (error) {
        return;
      }
      resumeChecked = true;

      if (!Number.isFinite(time) || time < 5 || time >= duration - 8) return;
      try {
        art.video.currentTime = time;
        art.notice.show = "已恢复到换线前的播放位置";
      } catch (error) {}
    }

    function playbackReady() {
      restoreAlternatePlaybackResume();
      clearPlaybackTimers();
      hideStatus();
    }

    function scheduleStallWarning() {
      if (!hasPlayed || stallTimer) return;
      stallTimer = global.setTimeout(function showStallWarning() {
        showStatus("视频缓冲时间较长，可以重新加载或切换线路。");
      }, STALL_TIMEOUT_MS);
    }

    art.on("video:canplay", playbackReady);
    art.on("video:playing", function onPlaying() {
      hasPlayed = true;
      playbackReady();
    });
    art.on("video:timeupdate", function onTimeUpdate() {
      if (!art.video.paused && art.video.readyState >= 3) {
        hasPlayed = true;
        playbackReady();
      }
    });
    art.on("video:waiting", scheduleStallWarning);
    art.on("video:stalled", scheduleStallWarning);
    art.on("video:error", function onVideoError() {
      clearPlaybackTimers();
      showStatus("视频播放失败，请重新加载或切换线路。");
    });
    art.once("destroy", clearPlaybackTimers);

    global.PingfangPlayerInstance = art;
  }

  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})(typeof window === "undefined" ? globalThis : window);
