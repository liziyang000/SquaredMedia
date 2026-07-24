"use client";

import { useEffect, useRef, useState } from "react";

import type { PlaybackDescriptor } from "../api/content";
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

function prefersNativeHls(video: HTMLVideoElement) {
  if (!video.canPlayType("application/vnd.apple.mpegurl")) return false;

  const userAgent = navigator.userAgent;
  const isAppleMobile = /(?:ipad|iphone|ipod)/i.test(userAgent) || (/macintosh/i.test(userAgent) && Number(navigator.maxTouchPoints) > 1);
  if (isAppleMobile) return true;

  return /safari/i.test(userAgent) && !/(?:android|chrome|chromium|crios|edg|opr)/i.test(userAgent);
}

type MacCmsPlayerProps = {
  playback: PlaybackDescriptor;
  resumePositionSeconds?: number;
  onCheckpoint: (element: HTMLVideoElement) => void;
  onComplete: () => void;
};

export function MacCmsPlayer({ playback, resumePositionSeconds, onCheckpoint, onComplete }: MacCmsPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const checkpointRef = useRef(onCheckpoint);
  const completeRef = useRef(onComplete);
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
    let resumeApplied = false;
    let lastCheckpointAt = 0;
    let player: import("artplayer").default | undefined;
    let activeHls: import("hls.js").default | undefined;
    let resetHlsRecovery: (() => void) | undefined;

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
      if (playback.playerHints?.bufferingHintEnabled && !bufferHintTimer) {
        bufferHintTimer = setTimeout(() => showHint("正在续接画面"), BUFFER_HINT_DELAY_MS);
      }
      if (!stallTimer) {
        stallTimer = setTimeout(() => showStatus("视频缓冲时间较长，可以重新加载或切换线路。"), STALL_TIMEOUT_MS);
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

      const cloudPosition = resumePositionSeconds ?? 0;
      if (!Number.isFinite(cloudPosition) || cloudPosition <= 30 || cloudPosition >= duration * 0.95) return;

      player.video.currentTime = Math.min(cloudPosition, Math.max(duration - 1, 0));
      latestPositionRef.current = player.video.currentTime;
      player.notice.show = "已从上次进度继续播放";
    };
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
              art.notice.show = "正在恢复视频播放…";
              hls.recoverMediaError();
              return;
            }
          }

          clearPlaybackTimers();
          showStatus(data.type === Hls.ErrorTypes.NETWORK_ERROR ? "视频线路连接失败，请重新加载或切换线路。" : "视频解码失败，请重新加载或切换线路。");
        });
        hls.loadSource(url);
        hls.attachMedia(video);
      };

      Artplayer.FULLSCREEN_WEB_IN_BODY = false;
      const art = new Artplayer({
        id: `pingfang:/watch/${playback.vodId}/${playback.sourceId}/${playback.episodeId}`,
        container: containerRef.current,
        url: playback.url,
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
      startupTimer = setTimeout(() => showStatus("视频加载较慢，可以重新加载或切换线路。"), startupWarningAfterMs);
      art.on("video:loadedmetadata", applyResumePosition);
      art.on("video:canplay", () => {
        applyResumePosition();
        playbackReady(true);
      });
      art.on("video:playing", () => {
        if (!hasPlayed) lastCheckpointAt = Date.now();
        hasPlayed = true;
        playbackReady(true);
      });
      art.on("video:timeupdate", () => {
        if (enforceTrial()) return;
        if (!art.video.paused && art.video.readyState >= 3) {
          if (!hasPlayed) lastCheckpointAt = Date.now();
          hasPlayed = true;
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
        playerErrorTimer = setTimeout(() => showStatus("视频播放失败，请重新加载或切换线路。"), PLAYER_ERROR_TIMEOUT_MS);
      });
      art.once("destroy", destroyHls);
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
              <button type="button" onClick={() => document.getElementById("episodeList")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                查看线路
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
