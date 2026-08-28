"use client";

import { useEffect, useRef, useState } from "react";

import type { PlaybackDescriptor } from "../api/content";
import { requestJson } from "../api/http";
import { reportPlaybackQoe } from "../playbackQoe";
import type { PlaybackQoeStatus } from "../playbackQoe";
import styles from "./MacCmsPlayer.module.css";

const STARTUP_TIMEOUT_MS = 12_000;
const STARTUP_HINT_GRACE_MS = 7_000;
const BUFFER_HINT_DELAY_MS = 400;
const STALL_TIMEOUT_MS = 8_000;
const PLAYER_ERROR_TIMEOUT_MS = 7_000;
const CHECKPOINT_INTERVAL_MS = 20_000;
const MEDIA_RECOVERY_COOLDOWN_MS = 5_000;
const MAX_MEDIA_RECOVERIES = 2;
const HLS_CONFIG = {
  enableWorker: true,
  capLevelToPlayerSize: true,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  backBufferLength: 30
} as const;
const NATIVE_PLAYBACK_URL_PATTERN = /^\/api\/native-playback-stream\/[a-f0-9]{64}$/;
const SERVER_TICKET_PATTERN = /\/ticket\/[a-f0-9]{64}\.html(?:$|[?#])/;

function isQuarkBrowser() {
  return /\bquark(?:\/|\s|$)/i.test(navigator.userAgent);
}

async function createNativePlaybackUrl(streamUrl: string) {
  const payload = await requestJson<unknown>("/api/native-playback-ticket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ streamUrl })
  });
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload) ||
    typeof (payload as { url?: unknown }).url !== "string" ||
    !NATIVE_PLAYBACK_URL_PATTERN.test((payload as { url: string }).url)
  ) {
    throw new Error("夸克播放授权响应无效");
  }
  return (payload as { url: string }).url;
}

function prefersNativeHls(video: HTMLVideoElement) {
  const userAgent = navigator.userAgent;
  if (isQuarkBrowser()) return true;
  if (!video.canPlayType("application/vnd.apple.mpegurl")) return false;

  const isAppleMobile = /(?:ipad|iphone|ipod)/i.test(userAgent) || (/macintosh/i.test(userAgent) && Number(navigator.maxTouchPoints) > 1);
  if (isAppleMobile) return true;

  return /safari/i.test(userAgent) && !/(?:android|chrome|chromium|crios|edg|opr)/i.test(userAgent);
}

type HlsQualityLevel = { width?: number; height?: number; bitrate?: number };
type HlsQualityItem = { html: string; level: number; height?: number; bitrate?: number; default?: boolean };
type HlsQualityRuntime = {
  levels: HlsQualityLevel[];
  autoLevelEnabled: boolean;
  manualLevel: number;
  nextLevel: number;
};

function hlsLevelLabel(level: HlsQualityLevel, index: number, levels: HlsQualityLevel[]) {
  const height = Math.round(Number(level.height) || 0);
  const bitrate = Math.round(Number(level.bitrate) || 0);
  if (height > 0) {
    const duplicateHeight = levels.filter((candidate) => Math.round(Number(candidate.height) || 0) === height).length > 1;
    if (!duplicateHeight) return `${height}p`;
    return `${height}p · ${bitrate > 0 ? `${Math.round(bitrate / 1000)} Kbps` : `档位 ${index + 1}`}`;
  }
  return bitrate > 0 ? `${Math.round(bitrate / 1000)} Kbps` : `档位 ${index + 1}`;
}

function hlsQualityTooltip(hls: HlsQualityRuntime, activeLevel: number) {
  const level = hls.levels[activeLevel];
  const label = level ? hlsLevelLabel(level, activeLevel, hls.levels) : "";
  if (hls.autoLevelEnabled) return label ? `自动（当前 ${label}）` : "自动";
  return label || "清晰度";
}

function updateHlsQualitySetting(art: import("artplayer").default, source: import("hls.js").default, activeLevel: number) {
  const hls = source as unknown as HlsQualityRuntime;
  const setting = (art as unknown as { setting?: { update?: (item: Record<string, unknown>) => void } }).setting;
  if (!setting?.update || !Array.isArray(hls.levels) || hls.levels.length === 0) return;
  const selector: HlsQualityItem[] = [{ html: "自动", level: -1, default: Boolean(hls.autoLevelEnabled) }];
  selector.push(
    ...hls.levels
      .map((level, index) => ({
        html: hlsLevelLabel(level, index, hls.levels),
        level: index,
        height: Number(level.height) || 0,
        bitrate: Number(level.bitrate) || 0,
        default: !hls.autoLevelEnabled && Number(hls.manualLevel) === index
      }))
      .sort((left, right) => right.height - left.height || right.bitrate - left.bitrate || left.level - right.level)
  );
  setting.update({
    name: "pingfang-quality",
    html: "清晰度",
    tooltip: hlsQualityTooltip(hls, activeLevel),
    selector,
    onSelect(item: HlsQualityItem) {
      const level = Number(item?.level);
      if (!Number.isInteger(level) || level < -1 || level >= hls.levels.length) return hlsQualityTooltip(hls, activeLevel);
      hls.nextLevel = level;
      return level === -1 ? hlsQualityTooltip(hls, activeLevel) : item.html || "清晰度";
    }
  });
}

function playbackEpisodeNo(playback: PlaybackDescriptor) {
  const source = playback.playSources.find((candidate) => candidate.id === playback.sourceId);
  const episode = source?.episodes.find((candidate) => candidate.id === playback.episodeId);
  return episode?.no ?? Number(playback.episodeId);
}

function monotonicNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

type MacCmsPlayerProps = {
  playback: PlaybackDescriptor;
  resumePositionSeconds?: number;
  transientResumePositionSeconds?: number;
  onCheckpoint: (element: HTMLVideoElement) => void;
  onComplete: () => void;
  onFallback?: (currentTime: number) => boolean;
};

export function MacCmsPlayer({ playback, resumePositionSeconds, transientResumePositionSeconds, onCheckpoint, onComplete, onFallback }: MacCmsPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const checkpointRef = useRef(onCheckpoint);
  const completeRef = useRef(onComplete);
  const fallbackRef = useRef(onFallback);
  const latestPositionRef = useRef(0);
  const hasLatestPositionRef = useRef(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const [hint, setHint] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    checkpointRef.current = onCheckpoint;
  }, [onCheckpoint]);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    fallbackRef.current = onFallback;
  }, [onFallback]);

  useEffect(() => {
    latestPositionRef.current = 0;
    hasLatestPositionRef.current = false;
  }, [playback.episodeId, playback.sourceId, playback.vodId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let startupHintTimer: ReturnType<typeof setTimeout> | undefined;
    let startupTimer: ReturnType<typeof setTimeout> | undefined;
    let bufferHintTimer: ReturnType<typeof setTimeout> | undefined;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    let playerErrorTimer: ReturnType<typeof setTimeout> | undefined;
    let hasPlayed = false;
    let blockingStatus = false;
    let trialEnded = false;
    let autoSwitching = false;
    let resumeApplied = false;
    let lastCheckpointAt = 0;
    let player: import("artplayer").default | undefined;
    let activeHls: import("hls.js").default | undefined;
    let resetHlsRecovery: (() => void) | undefined;
    const qoeContext = { vodId: playback.vodId, episodeNo: playbackEpisodeNo(playback), sourceId: playback.sourceId };
    const qoeStartedAt = monotonicNow();
    const qoeSessionId = `${Date.now().toString(36)}-${Math.round(qoeStartedAt).toString(36)}`;
    let qoeStatus: PlaybackQoeStatus = "starting";
    let qoeFirstFrameMs = 0;
    let qoeFirstFrameReported = false;
    let qoeBufferingCount = 0;
    let qoeBufferingMs = 0;
    let qoeBufferingStartedAt: number | null = null;
    let qoePlayedMs = 0;
    let qoeLastPlaybackPosition: number | null = null;
    let qoeLastReportAt = 0;
    let currentHlsLevel = -1;
    let currentVideoWidth = 0;
    let currentVideoHeight = 0;

    const clearPlaybackTimers = () => {
      if (startupHintTimer) clearTimeout(startupHintTimer);
      if (startupTimer) clearTimeout(startupTimer);
      if (bufferHintTimer) clearTimeout(bufferHintTimer);
      if (stallTimer) clearTimeout(stallTimer);
      if (playerErrorTimer) clearTimeout(playerErrorTimer);
      startupHintTimer = undefined;
      startupTimer = undefined;
      bufferHintTimer = undefined;
      stallTimer = undefined;
      playerErrorTimer = undefined;
    };
    const activeBufferingMs = () => (qoeBufferingStartedAt === null ? qoeBufferingMs : qoeBufferingMs + Math.max(0, monotonicNow() - qoeBufferingStartedAt));
    const storePlaybackQoe = (statusName: PlaybackQoeStatus = qoeStatus, qoeErrorType = "", hlsOverride?: import("hls.js").default) => {
      qoeStatus = statusName;
      const video = player?.video;
      const hls = hlsOverride ?? activeHls;
      const bandwidthEstimate = Number((hls as unknown as { bandwidthEstimate?: number } | undefined)?.bandwidthEstimate);
      reportPlaybackQoe(window.sessionStorage, qoeContext, {
        sessionId: qoeSessionId,
        status: qoeStatus,
        firstFrameMs: qoeFirstFrameMs,
        bufferingCount: qoeBufferingCount,
        bufferingMs: Math.round(activeBufferingMs()),
        playedMs: Math.round(qoePlayedMs),
        bandwidthEstimate: Number.isFinite(bandwidthEstimate) && bandwidthEstimate > 0 ? Math.round(bandwidthEstimate) : 0,
        currentLevel: currentHlsLevel,
        currentWidth: Math.round(currentVideoWidth || Number(video?.videoWidth) || 0),
        currentHeight: Math.round(currentVideoHeight || Number(video?.videoHeight) || 0),
        errorType: qoeErrorType
      });
      qoeLastReportAt = monotonicNow();
    };
    const finishBuffering = () => {
      if (qoeBufferingStartedAt === null) return false;
      qoeBufferingMs += Math.max(0, monotonicNow() - qoeBufferingStartedAt);
      qoeBufferingStartedAt = null;
      return true;
    };
    const reportPlaying = () => {
      const firstFrame = !qoeFirstFrameReported;
      if (firstFrame) {
        qoeFirstFrameReported = true;
        qoeFirstFrameMs = Math.max(0, Math.round(monotonicNow() - qoeStartedAt));
      }
      const resumed = finishBuffering();
      if (firstFrame || resumed || monotonicNow() - qoeLastReportAt >= 5000) storePlaybackQoe("playing");
    };
    const recordPlaybackProgress = () => {
      const position = Number(player?.video.currentTime);
      if (!Number.isFinite(position) || position < 0) return;
      if (qoeLastPlaybackPosition !== null) {
        const progress = position - qoeLastPlaybackPosition;
        if (progress > 0 && progress <= 10) qoePlayedMs += progress * 1000;
      }
      qoeLastPlaybackPosition = position;
    };
    const startBuffering = () => {
      if (!hasPlayed || qoeBufferingStartedAt !== null) return;
      qoeBufferingCount += 1;
      qoeBufferingStartedAt = monotonicNow();
      storePlaybackQoe("buffering");
    };
    const showHint = (message: string) => {
      if (!disposed && !blockingStatus) setHint(message);
    };
    const showStatus = (message: string) => {
      blockingStatus = true;
      if (!disposed) {
        setHint("");
        setStatus(message);
      }
    };
    const playbackReady = (recoveredHls = false) => {
      clearPlaybackTimers();
      if (recoveredHls) resetHlsRecovery?.();
      blockingStatus = false;
      if (!disposed && !trialEnded) {
        setHint("");
        setStatus("");
      }
    };
    const scheduleStallWarning = () => {
      if (!hasPlayed) return;
      startBuffering();
      if (playback.playerHints?.bufferingHintEnabled && !bufferHintTimer) {
        bufferHintTimer = setTimeout(() => showHint("正在续接画面"), BUFFER_HINT_DELAY_MS);
      }
      if (!stallTimer) {
        stallTimer = setTimeout(() => {
          storePlaybackQoe("failed", "stall_timeout");
          if (!tryAutomaticLineSwitch("当前线路持续缓冲，正在自动切换…")) {
            showStatus("视频缓冲时间较长，可以重新加载或切换线路。");
          }
        }, STALL_TIMEOUT_MS);
      }
    };
    const destroyHls = () => {
      activeHls?.destroy();
      activeHls = undefined;
      resetHlsRecovery = undefined;
      if (player) player.hls = null;
    };
    const endTrial = () => {
      if (trialEnded || !player) return;
      trialEnded = true;
      player.video.pause();
      checkpointRef.current(player.video);
      showStatus(`试看已结束，本次可试看 ${Math.ceil((playback.maxPlaybackSeconds ?? 0) / 60)} 分钟。`);
    };
    const enforceTrial = () => {
      const limit = playback.maxPlaybackSeconds;
      if (!limit || !player || player.video.currentTime < limit) return false;
      player.video.currentTime = Math.max(limit - 0.1, 0);
      endTrial();
      return true;
    };
    const checkpoint = (video: HTMLVideoElement) => {
      if (!Number.isFinite(video.currentTime) || video.currentTime < 0) return;
      if (video.currentTime === 0 && !hasPlayed && !hasLatestPositionRef.current) return;
      lastCheckpointAt = Date.now();
      latestPositionRef.current = video.currentTime;
      hasLatestPositionRef.current = true;
      checkpointRef.current(video);
    };
    const applyResumePosition = () => {
      if (resumeApplied || !player) return;
      const duration = player.video.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;

      resumeApplied = true;
      if (hasLatestPositionRef.current) {
        player.video.currentTime = Math.min(latestPositionRef.current, Math.max(duration - 1, 0));
        return;
      }

      const transientPosition = transientResumePositionSeconds ?? 0;
      if (Number.isFinite(transientPosition) && transientPosition >= 5 && transientPosition < duration * 0.95) {
        player.video.currentTime = Math.min(transientPosition, Math.max(duration - 1, 0));
        latestPositionRef.current = player.video.currentTime;
        hasLatestPositionRef.current = true;
        player.notice.show = "已从备用线路继续播放";
        return;
      }

      const cloudPosition = resumePositionSeconds ?? 0;
      if (!Number.isFinite(cloudPosition) || cloudPosition <= 30 || cloudPosition >= duration * 0.95) return;

      player.video.currentTime = Math.min(cloudPosition, Math.max(duration - 1, 0));
      latestPositionRef.current = player.video.currentTime;
      player.notice.show = "已从上次进度继续播放";
    };
    function tryAutomaticLineSwitch(message: string) {
      if (autoSwitching || trialEnded || !player || !fallbackRef.current) return false;
      const currentTime = Number.isFinite(player.video.currentTime) ? Math.max(player.video.currentTime, 0) : latestPositionRef.current;
      if (currentTime > 0) checkpoint(player.video);
      if (!fallbackRef.current(currentTime)) return false;
      autoSwitching = true;
      showStatus(message);
      return true;
    }
    const checkpointOnPageExit = () => {
      if (player) checkpoint(player.video);
    };
    const checkpointWhenHidden = () => {
      if (document.hidden) checkpointOnPageExit();
    };

    setHint("");
    setStatus("");
    document.addEventListener("visibilitychange", checkpointWhenHidden);
    window.addEventListener("pagehide", checkpointOnPageExit);

    const mount = async () => {
      let sourceUrl = playback.url;
      if (playback.kind === "hls" && isQuarkBrowser() && !SERVER_TICKET_PATTERN.test(sourceUrl)) {
        try {
          sourceUrl = await createNativePlaybackUrl(sourceUrl);
        } catch {
          showStatus("夸克播放授权失败，请重新加载或切换线路。");
          return;
        }
      }
      const [{ default: Artplayer }, { default: Hls }] = await Promise.all([import("artplayer"), import("hls.js")]);
      if (disposed || !containerRef.current) return;

      const playM3u8 = (video: HTMLVideoElement, url: string, art: import("artplayer").default) => {
        destroyHls();

        if (prefersNativeHls(video)) {
          video.src = url;
          return;
        }
        if (!Hls.isSupported()) {
          if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
            return;
          }
          storePlaybackQoe("failed", "hls_unsupported");
          showStatus("当前浏览器不支持 HLS 播放，请更换浏览器或线路。");
          return;
        }

        const hls = new Hls(HLS_CONFIG);
        let lastMediaRecoveryAt = 0;
        let mediaRecoveryCount = 0;
        resetHlsRecovery = () => {
          lastMediaRecoveryAt = 0;
          mediaRecoveryCount = 0;
        };
        activeHls = hls;
        art.hls = hls;
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            const now = Date.now();
            if (lastMediaRecoveryAt && now - lastMediaRecoveryAt < MEDIA_RECOVERY_COOLDOWN_MS) return;
            if (mediaRecoveryCount < MAX_MEDIA_RECOVERIES) {
              mediaRecoveryCount += 1;
              lastMediaRecoveryAt = now;
              storePlaybackQoe("recovering", "hls_media_error", hls);
              art.notice.show = "正在恢复视频播放…";
              hls.recoverMediaError();
              return;
            }
          }

          clearPlaybackTimers();
          storePlaybackQoe("failed", data.type === Hls.ErrorTypes.NETWORK_ERROR ? "hls_network_error" : "hls_media_error", hls);
          if (tryAutomaticLineSwitch("当前线路异常，正在自动切换…")) return;
          showStatus(data.type === Hls.ErrorTypes.NETWORK_ERROR ? "视频线路连接失败，请重新加载或切换线路。" : "视频解码失败，请重新加载或切换线路。");
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => updateHlsQualitySetting(art, hls, currentHlsLevel));
        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          const levelIndex = Number(data?.level);
          if (!Number.isInteger(levelIndex) || levelIndex < 0 || levelIndex >= hls.levels.length) return;
          const level = hls.levels[levelIndex];
          currentHlsLevel = levelIndex;
          currentVideoWidth = Number(level?.width) || 0;
          currentVideoHeight = Number(level?.height) || 0;
          updateHlsQualitySetting(art, hls, currentHlsLevel);
          storePlaybackQoe(qoeStatus, "", hls);
        });
        hls.loadSource(url);
        hls.attachMedia(video);
      };

      Artplayer.FULLSCREEN_WEB_IN_BODY = false;
      const art = new Artplayer({
        id: `pingfang:/watch/${playback.vodId}/${playback.sourceId}/${playback.episodeId}`,
        container: containerRef.current,
        url: sourceUrl,
        ...(playback.poster ? { poster: playback.poster } : {}),
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
        autoPlayback: false,
        autoOrientation: true,
        airplay: true,
        moreVideoAttr: {
          preload: "auto"
        },
        ...(playback.kind === "hls"
          ? {
              type: "m3u8",
              customType: {
                m3u8: playM3u8
              }
            }
          : {})
      });
      player = art;

      if (playback.playerHints?.startupHintAfterMs) {
        startupHintTimer = setTimeout(() => showHint("正在准备播放"), playback.playerHints.startupHintAfterMs);
      }
      const startupWarningAfterMs = playback.playerHints?.startupHintAfterMs
        ? Math.max(STARTUP_TIMEOUT_MS, playback.playerHints.startupHintAfterMs + STARTUP_HINT_GRACE_MS)
        : STARTUP_TIMEOUT_MS;
      startupTimer = setTimeout(() => {
        storePlaybackQoe("failed", "startup_timeout");
        if (!tryAutomaticLineSwitch("当前线路启动超时，正在自动切换…")) {
          showStatus("视频加载较慢，可以重新加载或切换线路。");
        }
      }, startupWarningAfterMs);
      art.on("video:loadedmetadata", applyResumePosition);
      art.on("video:canplay", () => {
        applyResumePosition();
        playbackReady(true);
      });
      art.on("video:playing", () => {
        if (!hasPlayed) lastCheckpointAt = Date.now();
        hasPlayed = true;
        reportPlaying();
        playbackReady(true);
      });
      art.on("video:timeupdate", () => {
        if (enforceTrial()) return;
        if (!art.video.paused && art.video.readyState >= 3) {
          if (!hasPlayed) lastCheckpointAt = Date.now();
          hasPlayed = true;
          recordPlaybackProgress();
          reportPlaying();
          playbackReady();
        }
        if (hasPlayed && Number.isFinite(art.video.currentTime) && art.video.currentTime >= 0) {
          latestPositionRef.current = art.video.currentTime;
          hasLatestPositionRef.current = true;
        }
        const now = Date.now();
        if (hasPlayed && art.video.currentTime > 0 && now - lastCheckpointAt >= CHECKPOINT_INTERVAL_MS) {
          lastCheckpointAt = now;
          checkpoint(art.video);
        }
      });
      art.on("video:seeking", enforceTrial);
      art.on("video:waiting", scheduleStallWarning);
      art.on("video:stalled", scheduleStallWarning);
      art.on("video:pause", () => {
        if (bufferHintTimer) clearTimeout(bufferHintTimer);
        if (stallTimer) clearTimeout(stallTimer);
        bufferHintTimer = undefined;
        stallTimer = undefined;
        if (!disposed) setHint("");
        if (!disposed && !trialEnded) checkpoint(art.video);
      });
      art.on("video:ended", () => {
        if (disposed) return;
        checkpoint(art.video);
        if (!trialEnded) completeRef.current();
      });
      art.on("video:error", () => {
        if (playerErrorTimer) return;
        clearPlaybackTimers();
        if (!disposed) setHint("");
        playerErrorTimer = setTimeout(() => {
          storePlaybackQoe("failed", "video_error");
          if (!tryAutomaticLineSwitch("当前线路播放失败，正在自动切换…")) {
            showStatus("视频播放失败，请重新加载或切换线路。");
          }
        }, PLAYER_ERROR_TIMEOUT_MS);
      });
      art.once("destroy", () => {
        finishBuffering();
        storePlaybackQoe(qoeStatus);
        destroyHls();
      });
    };

    void mount().catch(() => showStatus("播放器核心加载失败，请重新加载后重试。"));

    return () => {
      document.removeEventListener("visibilitychange", checkpointWhenHidden);
      window.removeEventListener("pagehide", checkpointOnPageExit);
      disposed = true;
      clearPlaybackTimers();
      if (player) checkpoint(player.video);
      player?.destroy();
      destroyHls();
      container.replaceChildren();
    };
  }, [
    playback.episodeId,
    playback.kind,
    playback.maxPlaybackSeconds,
    playback.playerHints?.bufferingHintEnabled,
    playback.playerHints?.startupHintAfterMs,
    playback.poster,
    playback.sourceId,
    playback.url,
    playback.vodId,
    resumePositionSeconds,
    transientResumePositionSeconds,
    retryVersion
  ]);

  return (
    <div className={styles.player} data-maccms-player aria-label={`${playback.title} - ${playback.episodeName} 播放器`}>
      <div ref={containerRef} className={styles.canvas} />
      {hint && !status && (
        <section className={styles.hint} role="status" aria-live="polite">
          <span className={styles.hintSpinner} aria-hidden="true" />
          <p>{hint}</p>
        </section>
      )}
      {status && (
        <section className={styles.status} role="status" aria-live="polite">
          <div className={styles.statusCard}>
            <p>{status}</p>
            <div className={styles.statusActions}>
              <button
                type="button"
                onClick={() => {
                  setStatus("");
                  setRetryVersion((version) => version + 1);
                }}
              >
                重新加载
              </button>
              <button
                type="button"
                onClick={() => {
                  if (fallbackRef.current?.(latestPositionRef.current)) {
                    setStatus("正在切换备用线路…");
                    return;
                  }
                  document.getElementById("episodeList")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {onFallback ? "切换备用线路" : "查看线路"}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
