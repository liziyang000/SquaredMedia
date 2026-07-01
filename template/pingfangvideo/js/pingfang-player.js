(function () {
  var PLAYER_READY_ATTR = "data-pf-player-ready";
  var PROGRESS_PREFIX = "pf_player_progress_";
  var HLS_TYPES = ["application/vnd.apple.mpegurl", "application/x-mpegURL"];

  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
      return;
    }
    callback();
  }

  function normalizeUrl(value) {
    var raw = String(value || "").trim();
    if (!raw || /<|>|javascript:/i.test(raw)) return "";

    try {
      return new URL(raw, window.location.href).href;
    } catch (error) {
      return "";
    }
  }

  function getSourceKind(url) {
    var cleanUrl = String(url || "").split("#")[0].split("?")[0].toLowerCase();
    if (/\.m3u8$/i.test(cleanUrl)) return "hls";
    if (/\.mp4$/i.test(cleanUrl)) return "mp4";
    return "";
  }

  function getPreviewSource(shell) {
    var video = shell.querySelector("video");
    if (!video) return "";

    var source = video.querySelector("source[src]");
    return normalizeUrl((source && source.getAttribute("src")) || video.getAttribute("src"));
  }

  function getPlayerDataSource() {
    if (window.player_data && window.player_data.url) {
      return normalizeUrl(window.player_data.url);
    }

    if (window.MacPlayer && window.MacPlayer.PlayUrl) {
      return normalizeUrl(window.MacPlayer.PlayUrl);
    }

    return "";
  }

  function hashUrl(url) {
    var hash = 0;
    var input = String(url || "");
    for (var index = 0; index < input.length; index += 1) {
      hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
    }
    return Math.abs(hash).toString(36);
  }

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {}
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    var total = Math.floor(seconds);
    var hours = Math.floor(total / 3600);
    var minutes = Math.floor((total % 3600) / 60);
    var secs = total % 60;
    var prefix = hours > 0 ? hours + ":" + String(minutes).padStart(2, "0") : String(minutes);
    return prefix + ":" + String(secs).padStart(2, "0");
  }

  function createButton(className, label, text) {
    var button = document.createElement("button");
    button.className = className;
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.title = label;
    button.textContent = text;
    return button;
  }

  function createPlayerShell(sourceUrl) {
    var player = document.createElement("div");
    player.className = "pf-player";
    player.tabIndex = 0;
    player.setAttribute("data-pf-player", "");

    var video = document.createElement("video");
    video.className = "pf-player-media";
    video.preload = "metadata";
    video.playsInline = true;
    video.setAttribute("webkit-playsinline", "");
    video.setAttribute("x5-playsinline", "");

    var overlay = document.createElement("div");
    overlay.className = "pf-player-overlay";

    var status = document.createElement("div");
    status.className = "pf-player-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.textContent = "准备播放";

    var controls = document.createElement("div");
    controls.className = "pf-player-controls";

    var playButton = createButton("pf-player-button pf-player-play", "播放", "▶");
    var muteButton = createButton("pf-player-button pf-player-mute", "静音", "音");

    var time = document.createElement("span");
    time.className = "pf-player-time";
    time.textContent = "0:00 / 0:00";

    var progress = document.createElement("input");
    progress.className = "pf-player-progress";
    progress.type = "range";
    progress.min = "0";
    progress.max = "100";
    progress.step = "0.1";
    progress.value = "0";
    progress.setAttribute("aria-label", "播放进度");

    var volume = document.createElement("input");
    volume.className = "pf-player-volume";
    volume.type = "range";
    volume.min = "0";
    volume.max = "1";
    volume.step = "0.05";
    volume.value = "1";
    volume.setAttribute("aria-label", "音量");

    var speed = document.createElement("select");
    speed.className = "pf-player-speed";
    speed.setAttribute("aria-label", "播放速度");
    ["0.75", "1", "1.25", "1.5", "2"].forEach(function (rate) {
      var option = document.createElement("option");
      option.value = rate;
      option.textContent = rate === "1" ? "1x" : rate + "x";
      speed.appendChild(option);
    });
    speed.value = "1";

    var fullscreenButton = createButton("pf-player-button pf-player-fullscreen", "全屏", "⛶");

    controls.append(playButton, time, progress, muteButton, volume, speed, fullscreenButton);
    overlay.append(status, controls);
    player.append(video, overlay);

    return {
      player: player,
      video: video,
      status: status,
      playButton: playButton,
      muteButton: muteButton,
      time: time,
      progress: progress,
      volume: volume,
      speed: speed,
      fullscreenButton: fullscreenButton,
      sourceUrl: sourceUrl
    };
  }

  function canPlayNativeHls(video) {
    return HLS_TYPES.some(function (type) {
      return video.canPlayType(type);
    });
  }

  function restoreOriginalPlayer(shell, originalHtml, hls) {
    if (hls && typeof hls.destroy === "function") {
      hls.destroy();
    }
    shell.innerHTML = originalHtml;
    shell.removeAttribute(PLAYER_READY_ATTR);
  }

  function bindControls(ui, shell, originalHtml, hlsRef) {
    var video = ui.video;
    var progressKey = PROGRESS_PREFIX + hashUrl(ui.sourceUrl);
    var lastSavedSecond = 0;

    function updateStatus(message) {
      ui.status.textContent = message;
    }

    function updatePlayState() {
      var isPaused = video.paused || video.ended;
      ui.playButton.textContent = isPaused ? "▶" : "Ⅱ";
      ui.playButton.setAttribute("aria-label", isPaused ? "播放" : "暂停");
      ui.playButton.title = isPaused ? "播放" : "暂停";
      updateStatus(isPaused ? "已暂停" : "正在播放");
    }

    function updateMuteState() {
      ui.muteButton.textContent = video.muted || video.volume === 0 ? "静" : "音";
      ui.muteButton.setAttribute("aria-label", video.muted ? "取消静音" : "静音");
      ui.muteButton.title = video.muted ? "取消静音" : "静音";
      ui.volume.value = video.muted ? "0" : String(video.volume);
    }

    function updateTime() {
      var duration = Number.isFinite(video.duration) ? video.duration : 0;
      var current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
      ui.progress.max = duration > 0 ? String(duration) : "100";
      ui.progress.value = String(current);
      ui.time.textContent = formatTime(current) + " / " + formatTime(duration);

      if (current > 0 && Math.abs(current - lastSavedSecond) >= 5) {
        lastSavedSecond = current;
        storageSet(progressKey, String(Math.floor(current)));
      }
    }

    function togglePlay() {
      if (video.paused || video.ended) {
        video.play().catch(function () {
          updateStatus("点击播放按钮开始播放");
        });
        return;
      }
      video.pause();
    }

    function toggleFullscreen() {
      var target = ui.player;
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        }
        return;
      }

      if (target.requestFullscreen) {
        target.requestFullscreen();
      } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
      }
    }

    ui.playButton.addEventListener("click", togglePlay);
    ui.muteButton.addEventListener("click", function () {
      video.muted = !video.muted;
      updateMuteState();
    });
    ui.fullscreenButton.addEventListener("click", toggleFullscreen);
    ui.progress.addEventListener("input", function () {
      video.currentTime = Number(ui.progress.value) || 0;
      updateTime();
    });
    ui.volume.addEventListener("input", function () {
      video.volume = Number(ui.volume.value);
      video.muted = video.volume === 0;
      updateMuteState();
    });
    ui.speed.addEventListener("change", function () {
      video.playbackRate = Number(ui.speed.value) || 1;
    });

    video.addEventListener("loadedmetadata", function () {
      var saved = Number(storageGet(progressKey));
      if (saved > 10 && Number.isFinite(video.duration) && saved < video.duration - 10) {
        video.currentTime = saved;
        updateStatus("已恢复上次进度");
      }
      updateTime();
    });
    video.addEventListener("play", updatePlayState);
    video.addEventListener("pause", updatePlayState);
    video.addEventListener("ended", function () {
      storageSet(progressKey, "0");
      updatePlayState();
      updateStatus("播放结束");
    });
    video.addEventListener("timeupdate", updateTime);
    video.addEventListener("volumechange", updateMuteState);
    video.addEventListener("waiting", function () {
      updateStatus("缓冲中");
    });
    video.addEventListener("playing", function () {
      updateStatus("正在播放");
    });
    video.addEventListener("error", function () {
      restoreOriginalPlayer(shell, originalHtml, hlsRef.current);
    });

    ui.player.addEventListener("keydown", function (event) {
      var tag = event.target.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "BUTTON") return;

      if (event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        video.currentTime = Math.min(video.duration || video.currentTime + 10, video.currentTime + 10);
      } else if (event.key.toLowerCase() === "m") {
        video.muted = !video.muted;
      } else if (event.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
    });

    window.addEventListener("beforeunload", function () {
      if (video.currentTime > 0) {
        storageSet(progressKey, String(Math.floor(video.currentTime)));
      }
    });

    updatePlayState();
    updateMuteState();
  }

  function attachSource(ui, kind, shell, originalHtml, hlsRef) {
    var video = ui.video;

    if (kind === "mp4") {
      video.src = ui.sourceUrl;
      video.load();
      return true;
    }

    if (kind === "hls" && canPlayNativeHls(video)) {
      video.src = ui.sourceUrl;
      video.load();
      return true;
    }

    if (kind === "hls" && window.Hls && window.Hls.isSupported()) {
      var hls = new window.Hls({
        enableWorker: true
      });
      hlsRef.current = hls;
      hls.loadSource(ui.sourceUrl);
      hls.attachMedia(video);
      hls.on(window.Hls.Events.ERROR, function (event, data) {
        if (data && data.fatal) {
          restoreOriginalPlayer(shell, originalHtml, hls);
        }
      });
      return true;
    }

    return false;
  }

  function initPlayer(shell) {
    if (!shell || shell.getAttribute(PLAYER_READY_ATTR) === "true") return;

    var sourceUrl = getPlayerDataSource() || getPreviewSource(shell);
    var kind = getSourceKind(sourceUrl);
    if (!sourceUrl || !kind) return;

    shell.setAttribute(PLAYER_READY_ATTR, "true");
    var originalHtml = shell.innerHTML;
    var ui = createPlayerShell(sourceUrl);
    var hlsRef = { current: null };

    shell.innerHTML = "";
    shell.appendChild(ui.player);

    bindControls(ui, shell, originalHtml, hlsRef);

    if (!attachSource(ui, kind, shell, originalHtml, hlsRef)) {
      restoreOriginalPlayer(shell, originalHtml, hlsRef.current);
    }
  }

  ready(function () {
    window.setTimeout(function () {
      document.querySelectorAll(".player-shell").forEach(initPlayer);
    }, 0);
  });
})();
