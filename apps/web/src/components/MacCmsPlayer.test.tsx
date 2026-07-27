import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PlaybackDescriptor } from "../api/content";
import { MacCmsPlayer } from "./MacCmsPlayer";

type EventHandler = (...args: unknown[]) => unknown;

const playerMocks = vi.hoisted(() => ({
  artInstances: [] as Array<{
    destroyed: boolean;
    emit: (event: string, ...args: unknown[]) => void;
    hls: unknown;
    options: Record<string, unknown>;
    video: HTMLVideoElement;
  }>,
  hlsInstances: [] as Array<{
    config: Record<string, unknown>;
    destroyed: boolean;
    emit: (event: string, data: Record<string, unknown>) => void;
    media: HTMLVideoElement | null;
    recoveries: number;
    source: string;
  }>
}));

vi.mock("artplayer", () => {
  class FakeArtplayer {
    static FULLSCREEN_WEB_IN_BODY = true;

    destroyed = false;
    handlers = new Map<string, EventHandler[]>();
    hls: unknown = null;
    notice = { show: "" };
    options: Record<string, unknown>;
    video: HTMLVideoElement;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      const container = options.container as HTMLElement;
      this.video = document.createElement("video");
      container.append(this.video);
      playerMocks.artInstances.push(this);

      const type = String(options.type || "");
      const customType = options.customType as Record<string, ((video: HTMLVideoElement, url: string, art: FakeArtplayer) => void) | undefined>;
      customType?.[type]?.(this.video, String(options.url || ""), this);
    }

    on(event: string, handler: EventHandler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
      return this;
    }

    once(event: string, handler: EventHandler) {
      const onceHandler: EventHandler = (...args) => {
        this.off(event, onceHandler);
        return handler(...args);
      };
      return this.on(event, onceHandler);
    }

    off(event: string, handler: EventHandler) {
      this.handlers.set(
        event,
        (this.handlers.get(event) ?? []).filter((candidate) => candidate !== handler)
      );
      return this;
    }

    emit(event: string, ...args: unknown[]) {
      for (const handler of this.handlers.get(event) ?? []) handler(...args);
    }

    destroy() {
      this.destroyed = true;
      this.emit("destroy");
      this.video.remove();
    }
  }

  return { default: FakeArtplayer };
});

vi.mock("hls.js", () => {
  class FakeHls {
    static ErrorTypes = { MEDIA_ERROR: "mediaError", NETWORK_ERROR: "networkError" };
    static Events = { ERROR: "error" };

    static isSupported() {
      return true;
    }

    destroyed = false;
    handlers = new Map<string, EventHandler>();
    media: HTMLVideoElement | null = null;
    recoveries = 0;
    source = "";

    config: Record<string, unknown>;

    constructor(config: Record<string, unknown>) {
      this.config = config;
      playerMocks.hlsInstances.push(this);
    }

    on(event: string, handler: EventHandler) {
      this.handlers.set(event, handler);
    }

    emit(event: string, data: Record<string, unknown>) {
      this.handlers.get(event)?.(event, data);
    }

    loadSource(source: string) {
      this.source = source;
    }

    attachMedia(media: HTMLVideoElement) {
      this.media = media;
    }

    recoverMediaError() {
      this.recoveries += 1;
    }

    destroy() {
      this.destroyed = true;
    }
  }

  return { default: FakeHls };
});

const playback: PlaybackDescriptor = {
  siteName: "平方影视",
  vodId: "1",
  sourceId: "1",
  episodeId: "101",
  title: "云端回声",
  episodeName: "正片",
  poster: "/poster.jpg",
  playSources: [{ id: "1", name: "高清线路", tip: "", episodes: [{ id: "101", no: 1, name: "正片", sourceId: "1" }] }],
  kind: "hls",
  url: "/index.php/pingfangapi/stream/id/1/sid/1/nid/101.html",
  mimeType: "application/vnd.apple.mpegurl"
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  playerMocks.artInstances.length = 0;
  playerMocks.hlsInstances.length = 0;
});

describe("MacCmsPlayer", () => {
  it("mounts the MacCMS Artplayer/HLS flow directly without an iframe or the deferred pf-player prototype", async () => {
    const onCheckpoint = vi.fn();
    const onComplete = vi.fn();
    const view = render(<MacCmsPlayer playback={playback} onCheckpoint={onCheckpoint} onComplete={onComplete} />);

    await waitFor(() => expect(playerMocks.artInstances).toHaveLength(1));

    const art = playerMocks.artInstances[0]!;
    const hls = playerMocks.hlsInstances[0]!;
    expect(view.container.querySelector("iframe")).toBeNull();
    expect(view.container.querySelector(".pf-player")).toBeNull();
    expect(view.container.querySelector("video")).toBe(art.video);
    expect(art.options).toMatchObject({
      type: "m3u8",
      autoplay: true,
      autoPlayback: false,
      miniProgressBar: true,
      playbackRate: true
    });
    expect(hls.source).toBe(playback.url);
    expect(hls.media).toBe(art.video);
    expect(hls.config).toEqual({
      enableWorker: true,
      capLevelToPlayerSize: true,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      backBufferLength: 30
    });

    art.video.currentTime = 12;
    art.emit("video:pause");
    art.emit("video:ended");
    expect(onCheckpoint).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenCalledTimes(1);

    view.unmount();
    expect(art.destroyed).toBe(true);
    expect(hls.destroyed).toBe(true);
  });

  it("keeps the authorized HLS URL on the video element for Quark native takeover", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Mobile Safari/537.36 Quark/7.9.9.999");
    vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("");
    const nativeUrl = `/api/native-playback-stream/${"a".repeat(64)}`;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ url: nativeUrl }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    const view = render(<MacCmsPlayer playback={playback} onCheckpoint={vi.fn()} onComplete={vi.fn()} />);

    await waitFor(() => expect(playerMocks.artInstances).toHaveLength(1));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/native-playback-ticket",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ streamUrl: playback.url }),
        credentials: "same-origin"
      })
    );
    expect(playerMocks.hlsInstances).toHaveLength(0);
    expect(playerMocks.artInstances[0]!.video.getAttribute("src")).toBe(nativeUrl);
    view.unmount();
  });

  it("uses a server-issued playback ticket directly without wrapping it again", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 Quark/10.13.0 Mobile");
    vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const serverTicketUrl = `/index.php/pingfangapi/stream/id/1/sid/1/nid/101/ticket/${"b".repeat(64)}.html`;

    const view = render(<MacCmsPlayer playback={{ ...playback, url: serverTicketUrl }} onCheckpoint={vi.fn()} onComplete={vi.fn()} />);

    await waitFor(() => expect(playerMocks.artInstances).toHaveLength(1));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(playerMocks.hlsInstances).toHaveLength(0);
    expect(playerMocks.artInstances[0]!.video.getAttribute("src")).toBe(serverTicketUrl);
    view.unmount();
  });

  it("shows an explicit Quark authorization failure instead of starting with an unusable stream URL", async () => {
    vi.spyOn(window.navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 Quark/10.13.0 Mobile");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "播放授权已失效" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      })
    );

    const view = render(<MacCmsPlayer playback={playback} onCheckpoint={vi.fn()} onComplete={vi.fn()} />);

    expect(await view.findByRole("status")).toHaveTextContent("夸克播放授权失败");
    expect(playerMocks.artInstances).toHaveLength(0);
  });

  it("omits the optional Artplayer poster option when MacCMS has no poster", async () => {
    const view = render(<MacCmsPlayer playback={{ ...playback, poster: "" }} onCheckpoint={vi.fn()} onComplete={vi.fn()} />);

    await waitFor(() => expect(playerMocks.artInstances).toHaveLength(1));

    expect(playerMocks.artInstances[0]!.options).not.toHaveProperty("poster");
    view.unmount();
  });

  it("restores one explicit MacCMS cloud checkpoint after metadata is ready", async () => {
    const view = render(<MacCmsPlayer playback={playback} resumePositionSeconds={48} onCheckpoint={vi.fn()} onComplete={vi.fn()} />);

    await waitFor(() => expect(playerMocks.artInstances).toHaveLength(1));

    const art = playerMocks.artInstances[0]!;
    Object.defineProperty(art.video, "duration", { configurable: true, value: 120 });
    expect(art.options.autoPlayback).toBe(false);

    act(() => art.emit("video:loadedmetadata"));
    expect(art.video.currentTime).toBe(48);

    art.video.currentTime = 62;
    act(() => art.emit("video:canplay"));
    expect(art.video.currentTime).toBe(62);
    view.unmount();
  });

  it.each([30, 114])("does not resume at an ineligible %s-second checkpoint", async (resumePositionSeconds) => {
    const view = render(<MacCmsPlayer playback={playback} resumePositionSeconds={resumePositionSeconds} onCheckpoint={vi.fn()} onComplete={vi.fn()} />);

    await waitFor(() => expect(playerMocks.artInstances).toHaveLength(1));

    const art = playerMocks.artInstances[0]!;
    Object.defineProperty(art.video, "duration", { configurable: true, value: 120 });
    act(() => art.emit("video:loadedmetadata"));

    expect(art.video.currentTime).toBe(0);
    view.unmount();
  });

  it("keeps the latest page position when the player is reloaded", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const view = render(<MacCmsPlayer playback={playback} resumePositionSeconds={48} onCheckpoint={vi.fn()} onComplete={vi.fn()} />);

    await waitFor(() => expect(playerMocks.artInstances).toHaveLength(1));

    const firstArt = playerMocks.artInstances[0]!;
    Object.defineProperty(firstArt.video, "duration", { configurable: true, value: 120 });
    act(() => firstArt.emit("video:loadedmetadata"));
    expect(firstArt.video.currentTime).toBe(48);

    act(() => firstArt.emit("video:playing"));
    firstArt.video.currentTime = 20;
    act(() => firstArt.emit("video:timeupdate"));
    act(() => firstArt.emit("video:error"));
    const errorTimer = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 7_000)?.[0];
    act(() => errorTimer?.());
    fireEvent.click(view.getByRole("button", { name: "重新加载" }));

    await waitFor(() => expect(playerMocks.artInstances).toHaveLength(2));
    const retriedArt = playerMocks.artInstances[1]!;
    Object.defineProperty(retriedArt.video, "duration", { configurable: true, value: 120 });
    act(() => retriedArt.emit("video:loadedmetadata"));

    expect(retriedArt.video.currentTime).toBe(20);
    view.unmount();
  });

  it("checkpoints active playback every 20 seconds and when the page is hidden", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(10_000);
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const onCheckpoint = vi.fn();
    const view = render(<MacCmsPlayer playback={playback} onCheckpoint={onCheckpoint} onComplete={vi.fn()} />);

    await waitFor(() => expect(playerMocks.artInstances).toHaveLength(1));

    const art = playerMocks.artInstances[0]!;
    Object.defineProperty(art.video, "paused", { configurable: true, value: false });
    Object.defineProperty(art.video, "readyState", { configurable: true, value: 4 });
    art.video.currentTime = 12;
    act(() => art.emit("video:timeupdate"));
    expect(onCheckpoint).not.toHaveBeenCalled();

    now.mockReturnValue(29_999);
    act(() => art.emit("video:timeupdate"));
    expect(onCheckpoint).not.toHaveBeenCalled();

    now.mockReturnValue(30_000);
    act(() => art.emit("video:timeupdate"));
    expect(onCheckpoint).toHaveBeenCalledTimes(1);

    art.video.currentTime = 18;
    hidden.mockReturnValue(true);
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(onCheckpoint).toHaveBeenCalledTimes(2);

    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(onCheckpoint).toHaveBeenCalledTimes(3);

    art.video.currentTime = 0;
    act(() => art.emit("video:pause"));
    expect(onCheckpoint).toHaveBeenCalledTimes(4);
    expect(onCheckpoint.mock.calls.at(-1)?.[0]?.currentTime).toBe(0);
    view.unmount();
  });

  it("ends a trial only after media playback reaches the authorized limit", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const onCheckpoint = vi.fn();
    const view = render(<MacCmsPlayer playback={{ ...playback, maxPlaybackSeconds: 60 }} onCheckpoint={onCheckpoint} onComplete={vi.fn()} />);

    await waitFor(() => expect(playerMocks.artInstances).toHaveLength(1));

    const art = playerMocks.artInstances[0]!;
    const pause = vi.spyOn(art.video, "pause").mockImplementation(() => undefined);
    const wallClockTimer = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 60_000)?.[0];

    act(() => wallClockTimer?.());
    expect(pause).not.toHaveBeenCalled();
    expect(onCheckpoint).not.toHaveBeenCalled();
    expect(view.queryByText("试看已结束")).toBeNull();

    art.video.currentTime = 60;
    act(() => art.emit("video:timeupdate"));

    expect(pause).toHaveBeenCalledTimes(1);
    expect(onCheckpoint).toHaveBeenCalledWith(art.video);
    expect(view.getByRole("status")).toHaveTextContent("试看已结束");
  });

  it("keeps normal startup unobstructed until the slow-load timeout", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const view = render(<MacCmsPlayer playback={playback} onCheckpoint={vi.fn()} onComplete={vi.fn()} />);

    expect(view.queryByRole("status")).toBeNull();
    await waitFor(() => expect(playerMocks.artInstances).toHaveLength(1));
    expect(view.queryByRole("status")).toBeNull();

    const startupTimer = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 12_000)?.[0];
    expect(startupTimer).toBeTypeOf("function");
    act(() => startupTimer?.());

    expect(view.getByRole("status")).toHaveTextContent("视频加载较慢");
  });

  it("uses the structured MacCMS preload hint without loading the configured HTML page", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const view = render(
      <MacCmsPlayer
        playback={{ ...playback, playerHints: { startupHintAfterMs: 5000, bufferingHintEnabled: false } }}
        onCheckpoint={vi.fn()}
        onComplete={vi.fn()}
      />
    );

    await waitFor(() => expect(playerMocks.artInstances).toHaveLength(1));
    expect(view.queryByText("正在准备播放")).toBeNull();

    const hintTimer = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 5_000)?.[0];
    expect(hintTimer).toBeTypeOf("function");
    act(() => hintTimer?.());

    expect(view.getByText("正在准备播放")).toBeInTheDocument();
    expect(view.queryByRole("button", { name: "重新加载" })).toBeNull();
    expect(view.container.querySelector("iframe")).toBeNull();
    expect(view.container.textContent).not.toContain("prestrain.html");

    act(() => playerMocks.artInstances[0]!.emit("video:canplay"));
    expect(view.queryByText("正在准备播放")).toBeNull();
  });

  it("shows a debounced native buffering hint before the existing actionable timeout", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const view = render(
      <MacCmsPlayer
        playback={{ ...playback, playerHints: { startupHintAfterMs: null, bufferingHintEnabled: true } }}
        onCheckpoint={vi.fn()}
        onComplete={vi.fn()}
      />
    );
    await waitFor(() => expect(playerMocks.artInstances).toHaveLength(1));

    const art = playerMocks.artInstances[0]!;
    act(() => art.emit("video:playing"));
    act(() => art.emit("video:waiting"));
    expect(view.queryByText("正在续接画面")).toBeNull();

    const bufferingHintTimer = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 400)?.[0];
    expect(bufferingHintTimer).toBeTypeOf("function");
    act(() => bufferingHintTimer?.());
    expect(view.getByText("正在续接画面")).toBeInTheDocument();
    expect(view.queryByRole("button", { name: "重新加载" })).toBeNull();

    const stallTimer = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 8_000)?.[0];
    expect(stallTimer).toBeTypeOf("function");
    act(() => stallTimer?.());
    expect(view.getByRole("status")).toHaveTextContent("视频缓冲时间较长");
    expect(view.getByRole("button", { name: "重新加载" })).toBeInTheDocument();

    act(() => art.emit("video:playing"));
    expect(view.queryByRole("status")).toBeNull();
  });

  it("does not turn repeated fatal media errors during recovery into a blocking error", async () => {
    const view = render(<MacCmsPlayer playback={playback} onCheckpoint={vi.fn()} onComplete={vi.fn()} />);
    await waitFor(() => expect(playerMocks.hlsInstances).toHaveLength(1));

    const art = playerMocks.artInstances[0]!;
    const hls = playerMocks.hlsInstances[0]!;
    const error = { fatal: true, type: "mediaError" };

    act(() => hls.emit("error", error));
    expect(hls.recoveries).toBe(1);
    expect(view.queryByRole("status")).toBeNull();

    act(() => hls.emit("error", error));
    expect(hls.recoveries).toBe(1);
    expect(view.queryByRole("status")).toBeNull();

    act(() => art.emit("video:canplay"));
    act(() => hls.emit("error", error));
    expect(hls.recoveries).toBe(2);
    expect(view.queryByRole("status")).toBeNull();
  });

  it("shows a blocking error after consecutive media recovery attempts are exhausted", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(10_000);
    const view = render(<MacCmsPlayer playback={playback} onCheckpoint={vi.fn()} onComplete={vi.fn()} />);
    await waitFor(() => expect(playerMocks.hlsInstances).toHaveLength(1));

    const hls = playerMocks.hlsInstances[0]!;
    const error = { fatal: true, type: "mediaError" };

    act(() => hls.emit("error", error));
    now.mockReturnValue(15_000);
    act(() => hls.emit("error", error));
    now.mockReturnValue(20_000);
    act(() => hls.emit("error", error));

    expect(hls.recoveries).toBe(2);
    expect(view.getByRole("status")).toHaveTextContent("视频解码失败");
  });

  it("waits for Artplayer automatic reconnect before showing a video failure", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const view = render(<MacCmsPlayer playback={playback} onCheckpoint={vi.fn()} onComplete={vi.fn()} />);
    await waitFor(() => expect(playerMocks.artInstances).toHaveLength(1));

    const art = playerMocks.artInstances[0]!;
    act(() => art.emit("video:error"));
    expect(view.queryByRole("status")).toBeNull();

    const playerErrorTimer = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 7_000)?.[0];
    expect(playerErrorTimer).toBeTypeOf("function");
    act(() => playerErrorTimer?.());
    expect(view.getByRole("status")).toHaveTextContent("视频播放失败");

    act(() => art.emit("video:playing"));
    expect(view.queryByRole("status")).toBeNull();
  });
});
