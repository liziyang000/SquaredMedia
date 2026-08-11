(function initPingfangPlayer(global) {
  "use strict";

  var PLAYER_VERSION = "1.1.0";
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
    var autoSwitching = false;
    var qoeStartedAt = monotonicNow();
    var qoeSessionId = Date.now().toString(36) + "-" + Math.round(qoeStartedAt).toString(36);
    var qoeStatus = "starting";
    var qoeFirstFrameMs = 0;
    var qoeFirstFrameReported = false;
    var qoeBufferingCount = 0;
    var qoeBufferingMs = 0;
    var qoeBufferingStartedAt = null;
    var qoePlayedMs = 0;
    var qoeLastPlaybackPosition = null;
    var qoeLastReportAt = 0;
    var currentHlsLevel = -1;
    var currentVideoWidth = 0;
    var currentVideoHeight = 0;

    function monotonicNow() {
      try {
        if (global.performance && typeof global.performance.now === "function") return global.performance.now();
      } catch (error) {}
      return Date.now();
    }

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

    function tryAutomaticLineSwitch(message) {
      if (autoSwitching) return true;

      var bridge = parentPlayerBridge();
      try {
        if (bridge && bridge.autoSwitchToAlternatePlaybackLine && bridge.autoSwitchToAlternatePlaybackLine(currentPlaybackTime())) {
          autoSwitching = true;
          showStatus(message);
          return true;
        }
      } catch (error) {}
      return false;
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

    function activeBufferingMs() {
      return qoeBufferingStartedAt === null ? qoeBufferingMs : qoeBufferingMs + Math.max(0, monotonicNow() - qoeBufferingStartedAt);
    }

    function reportPlaybackQoe(statusName, errorType, hlsOverride) {
      if (statusName) qoeStatus = statusName;

      var playerVideo = art && art.video;
      var activeHls = hlsOverride || (art && art.hls);
      var bandwidthEstimate = Number(activeHls && activeHls.bandwidthEstimate);
      var videoWidth = currentVideoWidth || Number(playerVideo && playerVideo.videoWidth) || 0;
      var videoHeight = currentVideoHeight || Number(playerVideo && playerVideo.videoHeight) || 0;
      var payload = {
        version: 1,
        sessionId: qoeSessionId,
        status: qoeStatus,
        firstFrameMs: qoeFirstFrameMs,
        bufferingCount: qoeBufferingCount,
        bufferingMs: Math.round(activeBufferingMs()),
        playedMs: Math.round(qoePlayedMs),
        bandwidthEstimate: Number.isFinite(bandwidthEstimate) && bandwidthEstimate > 0 ? Math.round(bandwidthEstimate) : 0,
        currentLevel: currentHlsLevel,
        currentWidth: Math.round(videoWidth),
        currentHeight: Math.round(videoHeight),
        errorType: errorType || ""
      };
      qoeLastReportAt = monotonicNow();

      var bridge = parentPlayerBridge();
      try {
        if (bridge && typeof bridge.reportPlaybackQoe === "function") return bridge.reportPlaybackQoe(payload);
      } catch (error) {}
      return null;
    }

    function finishBuffering() {
      if (qoeBufferingStartedAt === null) return false;
      qoeBufferingMs += Math.max(0, monotonicNow() - qoeBufferingStartedAt);
      qoeBufferingStartedAt = null;
      return true;
    }

    function reportPlaying() {
      var firstFrame = !qoeFirstFrameReported;
      if (firstFrame) {
        qoeFirstFrameReported = true;
        qoeFirstFrameMs = Math.max(0, Math.round(monotonicNow() - qoeStartedAt));
      }
      var resumed = finishBuffering();
      if (firstFrame || resumed) {
        reportPlaybackQoe("playing");
      } else if (monotonicNow() - qoeLastReportAt >= 5000) {
        reportPlaybackQoe("playing");
      }
    }

    function recordPlaybackProgress() {
      var position = currentPlaybackTime();
      if (qoeLastPlaybackPosition !== null) {
        var progress = position - qoeLastPlaybackPosition;
        if (progress > 0 && progress <= 10) qoePlayedMs += progress * 1000;
      }
      qoeLastPlaybackPosition = position;
    }

    function startBuffering() {
      if (!hasPlayed || qoeBufferingStartedAt !== null) return;
      qoeBufferingCount += 1;
      qoeBufferingStartedAt = monotonicNow();
      reportPlaybackQoe("buffering");
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
      reportPlaybackQoe("failed", "invalid_source");
      showStatus("播放地址无效，请切换线路后重试。");
      return;
    }

    if (typeof global.Artplayer !== "function") {
      reportPlaybackQoe("failed", "player_core_missing");
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

    function hlsLevelLabel(level, index, levels) {
      var height = Math.round(Number(level && level.height) || 0);
      var bitrate = Math.round(Number(level && level.bitrate) || 0);
      if (height > 0) {
        var duplicateHeight =
          levels.filter(function (candidate) {
            return Math.round(Number(candidate && candidate.height) || 0) === height;
          }).length > 1;
        if (!duplicateHeight) return height + "p";
        return height + "p · " + (bitrate > 0 ? Math.round(bitrate / 1000) + " Kbps" : "档位 " + (index + 1));
      }
      if (bitrate > 0) return Math.round(bitrate / 1000) + " Kbps";
      return "档位 " + (index + 1);
    }

    function hlsQualitySelector(hls) {
      var levels = Array.isArray(hls.levels) ? hls.levels : [];
      var selector = [
        {
          html: "自动",
          level: -1,
          default: Boolean(hls.autoLevelEnabled)
        }
      ];
      levels
        .map(function (level, index) {
          return {
            html: hlsLevelLabel(level, index, levels),
            level: index,
            height: Number(level && level.height) || 0,
            bitrate: Number(level && level.bitrate) || 0,
            default: !hls.autoLevelEnabled && Number(hls.manualLevel) === index
          };
        })
        .sort(function (left, right) {
          return right.height - left.height || right.bitrate - left.bitrate || left.level - right.level;
        })
        .forEach(function (item) {
          selector.push(item);
        });
      return selector;
    }

    function hlsQualityTooltip(hls, activeLevel) {
      var levels = Array.isArray(hls.levels) ? hls.levels : [];
      var level = levels[activeLevel];
      var label = level ? hlsLevelLabel(level, activeLevel, levels) : "";
      if (hls.autoLevelEnabled) return label ? "自动（当前 " + label + "）" : "自动";
      return label || "清晰度";
    }

    function updateHlsQualitySetting(art, hls, activeLevel) {
      if (!art.setting || typeof art.setting.update !== "function" || !Array.isArray(hls.levels) || !hls.levels.length) return;
      art.setting.update({
        name: "pingfang-quality",
        html: "清晰度",
        tooltip: hlsQualityTooltip(hls, activeLevel),
        selector: hlsQualitySelector(hls),
        onSelect: function selectHlsQuality(item) {
          var level = Number(item && item.level);
          if (!Number.isInteger(level) || level < -1 || level >= hls.levels.length) return hlsQualityTooltip(hls, currentHlsLevel);
          hls.nextLevel = level;
          return level === -1 ? hlsQualityTooltip(hls, currentHlsLevel) : String(item.html || "清晰度");
        }
      });
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

        reportPlaybackQoe("failed", "hls_unsupported");
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
            reportPlaybackQoe("recovering", "hls_media_error", hls);
            art.notice.show = "正在恢复视频播放…";
            hls.recoverMediaError();
            return;
          }
        }

        reportPlaybackQoe("failed", data.type === global.Hls.ErrorTypes.NETWORK_ERROR ? "hls_network_error" : "hls_media_error", hls);
        clearPlaybackTimers();
        if (tryAutomaticLineSwitch("当前线路异常，正在自动切换…")) return;
        if (data.type === global.Hls.ErrorTypes.NETWORK_ERROR) {
          showStatus("视频线路连接失败，请重新加载或切换线路。");
        } else {
          showStatus("视频解码失败，请重新加载或切换线路。");
        }
      });

      hls.on(global.Hls.Events.MANIFEST_PARSED, function handleManifestParsed() {
        updateHlsQualitySetting(art, hls, currentHlsLevel);
      });

      hls.on(global.Hls.Events.LEVEL_SWITCHED, function handleLevelSwitched(event, data) {
        var levelIndex = Number(data && data.level);
        if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= hls.levels.length) return;
        var level = hls.levels[levelIndex] || {};
        currentHlsLevel = levelIndex;
        currentVideoWidth = Number(level.width) || 0;
        currentVideoHeight = Number(level.height) || 0;
        updateHlsQualitySetting(art, hls, currentHlsLevel);
        reportPlaybackQoe(qoeStatus, "", hls);
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
      reportPlaybackQoe("failed", "startup_timeout");
      if (tryAutomaticLineSwitch("当前线路启动超时，正在自动切换…")) return;
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
      startBuffering();
      stallTimer = global.setTimeout(function showStallWarning() {
        reportPlaybackQoe("failed", "stall_timeout");
        if (tryAutomaticLineSwitch("当前线路持续缓冲，正在自动切换…")) return;
        showStatus("视频缓冲时间较长，可以重新加载或切换线路。");
      }, STALL_TIMEOUT_MS);
    }

    art.on("video:canplay", playbackReady);
    art.on("video:playing", function onPlaying() {
      hasPlayed = true;
      reportPlaying();
      playbackReady();
    });
    art.on("video:timeupdate", function onTimeUpdate() {
      if (!art.video.paused && art.video.readyState >= 3) {
        hasPlayed = true;
        recordPlaybackProgress();
        reportPlaying();
        playbackReady();
      }
    });
    art.on("video:waiting", scheduleStallWarning);
    art.on("video:stalled", scheduleStallWarning);
    art.on("video:error", function onVideoError() {
      reportPlaybackQoe("failed", "video_error");
      clearPlaybackTimers();
      if (tryAutomaticLineSwitch("当前线路播放失败，正在自动切换…")) return;
      showStatus("视频播放失败，请重新加载或切换线路。");
    });
    art.once("destroy", function finishPlaybackQoe() {
      finishBuffering();
      reportPlaybackQoe(qoeStatus);
      clearPlaybackTimers();
    });

    global.PingfangPlayerInstance = art;
  }

  if (global.document.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})(typeof window === "undefined" ? globalThis : window);
