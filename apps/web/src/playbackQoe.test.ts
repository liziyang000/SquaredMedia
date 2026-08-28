import { afterEach, describe, expect, it } from "vitest";

import { comparePlaybackQoe, markPlaybackLineSwitch, readPlaybackQoe, reportPlaybackQoe } from "./playbackQoe";
import type { PlaybackQoePayload } from "./playbackQoe";

function payload(overrides: Partial<PlaybackQoePayload> = {}): PlaybackQoePayload {
  return {
    sessionId: "session-1",
    status: "playing",
    firstFrameMs: 700,
    bufferingCount: 0,
    bufferingMs: 0,
    playedMs: 20_000,
    bandwidthEstimate: 4_000_000,
    currentLevel: 1,
    currentWidth: 1920,
    currentHeight: 1080,
    ...overrides
  };
}

afterEach(() => {
  window.sessionStorage.clear();
});

describe("playback QoE", () => {
  it("keeps recent bounded metrics locally and expires them", () => {
    const record = reportPlaybackQoe(
      window.sessionStorage,
      { vodId: 7, episodeNo: 1, sourceId: 2 },
      payload({ sessionId: "unsafe session!", bandwidthEstimate: Number.MAX_SAFE_INTEGER, errorType: "HLS Network Error!" }),
      1000
    );

    expect(record).toMatchObject({
      sessionId: "unsafesession",
      bandwidthEstimate: 100_000_000_000,
      errorType: "hlsnetworkerror",
      expiresAt: 1_801_000
    });
    expect(readPlaybackQoe(window.sessionStorage, { vodId: 7, episodeNo: 1, sourceId: 2 }, 2000)).toEqual(record);
    expect(readPlaybackQoe(window.sessionStorage, { vodId: 7, episodeNo: 1, sourceId: 2 }, 1_801_000)).toBeNull();
  });

  it("ranks a playable low-buffer source ahead of failed or rebuffering sources", () => {
    reportPlaybackQoe(window.sessionStorage, { vodId: 7, episodeNo: 1, sourceId: 1 }, payload({ status: "failed", firstFrameMs: 0 }), 1000);
    reportPlaybackQoe(window.sessionStorage, { vodId: 7, episodeNo: 1, sourceId: 2 }, payload({ bufferingMs: 10_000, playedMs: 10_000 }), 1000);
    reportPlaybackQoe(window.sessionStorage, { vodId: 7, episodeNo: 1, sourceId: 3 }, payload({ bufferingMs: 1000, playedMs: 20_000 }), 1000);

    expect(comparePlaybackQoe(window.sessionStorage, 7, 1, 3, 1, 2000)).toBeLessThan(0);
    expect(comparePlaybackQoe(window.sessionStorage, 7, 1, 3, 2, 2000)).toBeLessThan(0);
  });

  it("records a successful automatic line switch after the target starts playing", () => {
    const context = { vodId: 7, episodeNo: 1, sourceId: 3 };
    markPlaybackLineSwitch(window.sessionStorage, context, 1000);

    expect(readPlaybackQoe(window.sessionStorage, context, 1100)).toMatchObject({ switchAttempts: 1, switchSuccesses: 0 });
    reportPlaybackQoe(window.sessionStorage, context, payload({ sessionId: "target-session" }), 1200);

    expect(readPlaybackQoe(window.sessionStorage, context, 1300)).toMatchObject({ switchAttempts: 1, switchSuccesses: 1, status: "playing" });
  });
});
