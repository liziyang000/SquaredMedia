import { afterEach, describe, expect, it } from "vitest";

import type { ContentEpisode } from "./api/content";
import type { SourceQualityData, SourceQualitySource } from "./api/sourceQuality";
import { reportPlaybackQoe } from "./playbackQoe";
import {
  consumeAlternatePlaybackResume,
  readSourceQualityPreference,
  selectAutomaticFallback,
  storeAlternatePlaybackResume,
  storeSourceQualityPreference
} from "./sourceQualityPreference";

function qualitySource(sid: number, overrides: Partial<SourceQualitySource> = {}): SourceQualitySource {
  return {
    sid,
    from: `线路 ${sid}`,
    nid: 1,
    episode_name: "测试文本",
    status: "available",
    available: true,
    http_code: 200,
    latency_ms: 200,
    speed_kbps: 4000,
    sample_count: 3,
    tested_width: 1920,
    tested_height: 1080,
    max_width: 1920,
    max_height: 1080,
    resolution_basis: "manifest",
    variant_bandwidth_kbps: 4500,
    variant_codecs: "avc1.640028",
    fallback_used: false,
    quality_rank: null,
    recommended: false,
    message: "检测完成",
    ...overrides
  };
}

function quality(sources: SourceQualitySource[], recommendedSid: number | null = null): SourceQualityData {
  return {
    vod_id: 7,
    nid: 1,
    checked_at: 1_785_280_000,
    cached: false,
    recommended_sid: recommendedSid,
    sources
  };
}

function episode(sourceId: string, id: string, no: number, name = "测试文本"): ContentEpisode {
  return { sourceId, id, no, name };
}

afterEach(() => {
  window.sessionStorage.clear();
});

describe("source quality preference", () => {
  it("stores only available sources in measured order", () => {
    window.sessionStorage.setItem("pingfang_automatic_line_switch_v1", JSON.stringify({ stale: true }));

    const stored = storeSourceQualityPreference(
      window.sessionStorage,
      7,
      1,
      quality(
        [
          qualitySource(1, { quality_rank: 2, speed_kbps: 5000 }),
          qualitySource(2, { quality_rank: 1, speed_kbps: 3000 }),
          qualitySource(3, { speed_kbps: 6000, latency_ms: 300 }),
          qualitySource(4, { status: "failed", available: false, quality_rank: 3 })
        ],
        1
      ),
      1000
    );

    expect(stored).toEqual({
      version: 1,
      vodId: "7",
      episodeNo: 1,
      recommendedSourceId: "2",
      rankedSourceIds: ["2", "1", "3"],
      expiresAt: 61_000
    });
    expect(readSourceQualityPreference(window.sessionStorage, 7, 1, 2000)).toEqual(stored);
    expect(window.sessionStorage.getItem("pingfang_automatic_line_switch_v1")).toBeNull();
  });

  it("uses recent playback QoE ahead of server quality when ranking fallbacks", () => {
    reportPlaybackQoe(
      window.sessionStorage,
      { vodId: 7, episodeNo: 1, sourceId: 2 },
      {
        sessionId: "failed-source",
        status: "failed",
        firstFrameMs: 0,
        bufferingCount: 0,
        bufferingMs: 0,
        playedMs: 0,
        bandwidthEstimate: 0,
        currentLevel: -1,
        currentWidth: 0,
        currentHeight: 0,
        errorType: "startup_timeout"
      },
      1000
    );
    reportPlaybackQoe(
      window.sessionStorage,
      { vodId: 7, episodeNo: 1, sourceId: 3 },
      {
        sessionId: "playing-source",
        status: "playing",
        firstFrameMs: 600,
        bufferingCount: 0,
        bufferingMs: 0,
        playedMs: 20_000,
        bandwidthEstimate: 4_000_000,
        currentLevel: 1,
        currentWidth: 1920,
        currentHeight: 1080
      },
      1000
    );

    const stored = storeSourceQualityPreference(
      window.sessionStorage,
      7,
      1,
      quality([qualitySource(2, { quality_rank: 1 }), qualitySource(3, { quality_rank: 2 })], 2),
      2000
    );

    expect(stored?.rankedSourceIds).toEqual(["3", "2"]);
    expect(stored?.recommendedSourceId).toBe("3");
  });

  it("falls back to the highest-ranked source and removes expired or invalid preferences", () => {
    const stored = storeSourceQualityPreference(
      window.sessionStorage,
      7,
      1,
      quality([qualitySource(1, { quality_rank: 2 }), qualitySource(2, { quality_rank: 1 })], 99),
      1000
    );
    expect(stored?.recommendedSourceId).toBe("2");
    expect(readSourceQualityPreference(window.sessionStorage, 7, 1, 61_000)).toBeNull();

    window.sessionStorage.setItem(
      "pingfang_source_quality_preference_v1_7_1",
      JSON.stringify({
        version: 1,
        vodId: "7",
        episodeNo: 1,
        recommendedSourceId: "9",
        rankedSourceIds: ["2"],
        expiresAt: 70_000
      })
    );
    expect(readSourceQualityPreference(window.sessionStorage, 7, 1, 2000)).toBeNull();
    expect(window.sessionStorage.getItem("pingfang_source_quality_preference_v1_7_1")).toBeNull();
  });

  it("uses ranked matching episodes once each before reporting that no fallback remains", () => {
    storeSourceQualityPreference(
      window.sessionStorage,
      7,
      1,
      quality([qualitySource(3, { quality_rank: 1 }), qualitySource(2, { quality_rank: 2 }), qualitySource(1, { quality_rank: 3 })]),
      1000
    );
    const activeEpisode = episode("1", "101", 1);
    const groups = [
      { sourceId: "1", episodes: [activeEpisode] },
      { sourceId: "2", episodes: [episode("2", "201", 1)] },
      { sourceId: "3", episodes: [episode("3", "301", 9, "  测试文本  ")] }
    ];

    expect(
      selectAutomaticFallback({
        storage: window.sessionStorage,
        vodId: "7",
        groups,
        activeSourceId: "1",
        activeEpisode,
        now: 2000
      })
    ).toEqual(groups[2]?.episodes[0]);
    expect(
      selectAutomaticFallback({
        storage: window.sessionStorage,
        vodId: "7",
        groups,
        activeSourceId: "1",
        activeEpisode,
        now: 3000
      })
    ).toEqual(groups[1]?.episodes[0]);
    expect(
      selectAutomaticFallback({
        storage: window.sessionStorage,
        vodId: "7",
        groups,
        activeSourceId: "1",
        activeEpisode,
        now: 4000
      })
    ).toBeNull();
  });

  it("returns no automatic fallback when no alternate group has the same episode", () => {
    const activeEpisode = episode("1", "101", 1);

    expect(
      selectAutomaticFallback({
        storage: window.sessionStorage,
        vodId: "7",
        groups: [
          { sourceId: "1", episodes: [activeEpisode] },
          { sourceId: "2", episodes: [episode("2", "202", 2, "其他测试文本")] }
        ],
        activeSourceId: "1",
        activeEpisode
      })
    ).toBeNull();
  });

  it("stores a safe alternate-line resume point and consumes it only once", () => {
    storeAlternatePlaybackResume(window.sessionStorage, "/watch/7/2/201", 12.34, 1000);

    expect(consumeAlternatePlaybackResume(window.sessionStorage, "/watch/7/2/201", 2000)).toBe(12.3);
    expect(consumeAlternatePlaybackResume(window.sessionStorage, "/watch/7/2/201", 2000)).toBe(0);

    storeAlternatePlaybackResume(window.sessionStorage, "/watch/7/2/201", 4.9, 1000);
    expect(consumeAlternatePlaybackResume(window.sessionStorage, "/watch/7/2/201", 2000)).toBe(0);

    storeAlternatePlaybackResume(window.sessionStorage, "//external.example/watch", 12, 1000);
    expect(consumeAlternatePlaybackResume(window.sessionStorage, "//external.example/watch", 2000)).toBe(0);
  });
});
