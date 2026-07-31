"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import type { ContentEpisode } from "../api/content";
import { sourceQualityApi } from "../api/sourceQuality";
import type { SourceQualityApi, SourceQualityData, SourceQualitySource } from "../api/sourceQuality";
import { storeSourceQualityPreference } from "../sourceQualityPreference";
import type { SourceQualityPreference } from "../sourceQualityPreference";

type SourceQualityGroup = {
  sourceId: string;
  name: string;
  tip: string;
  episodes: ContentEpisode[];
};

export type SourceQualityView = {
  episodeNo: number;
  status: "loading" | "ready" | "error";
  data?: SourceQualityData;
};

function formatSpeed(kbps: number | null) {
  if (!kbps) return "";
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(kbps >= 10_000 ? 1 : 2).replace(/\.?0+$/, "")} Mbit/s`;
  return `${Math.round(kbps)} kbit/s`;
}

function formatResolution(source: SourceQualitySource) {
  const tested = source.tested_width && source.tested_height ? `${source.tested_width}×${source.tested_height}` : "";
  const maximum = source.max_width && source.max_height ? `${source.max_width}×${source.max_height}` : "";
  if (!tested && !maximum) return "分辨率未知";
  const notes = [];
  if (source.resolution_basis === "manifest") notes.push("清单声明");
  if (source.fallback_used) notes.push("已回退");
  const note = notes.length > 0 ? `（${notes.join("，")}）` : "";
  if (tested && maximum && tested !== maximum) return `最高 ${maximum} · 本次 ${tested}${note}`;
  if (tested) return `${tested}${note}`;
  return `最高 ${maximum}${notes.length > 0 ? `（${notes.join("，")}，未测通）` : ""}`;
}

export function sourceQualityText(source: SourceQualitySource) {
  const labels = {
    available: "可用",
    slow: "可用但较慢",
    failed: "不可用",
    timeout: "检测超时",
    unsupported: "无法直测",
    missing: "缺少该集"
  } as const;
  const details = [
    formatResolution(source),
    source.variant_bandwidth_kbps ? `声明码率 ${formatSpeed(source.variant_bandwidth_kbps)}` : "",
    formatSpeed(source.speed_kbps),
    source.latency_ms ? `${source.latency_ms} ms` : "",
    source.sample_count > 0 ? `${source.sample_count} 次样本` : "",
    source.episode_name
  ].filter(Boolean);
  if (
    source.message &&
    ((["failed", "timeout", "unsupported", "missing"] as const).includes(source.status as "failed" | "timeout" | "unsupported" | "missing") ||
      source.message === "可用，但测速样本不足")
  ) {
    details.unshift(source.message);
  }
  return `${source.recommended ? "推荐 · " : ""}${labels[source.status]}${details.length > 0 ? ` · ${details.join(" · ")}` : ""}`;
}

function episodeOptions(groups: SourceQualityGroup[]) {
  const firstPopulatedGroup = groups.find((group) => group.episodes.length > 0);
  if (!firstPopulatedGroup) return [];
  return firstPopulatedGroup.episodes
    .slice()
    .sort((left, right) => left.no - right.no)
    .filter((episode, index, episodes) => episodes.findIndex((candidate) => candidate.no === episode.no) === index);
}

export function SourceQualityPanel({
  vodId,
  groups,
  api = sourceQualityApi,
  onViewChange,
  onRecommendation
}: {
  vodId: string;
  groups: SourceQualityGroup[];
  api?: SourceQualityApi;
  onViewChange: (view: SourceQualityView) => void;
  onRecommendation: (preference: SourceQualityPreference | null, episodeNo: number) => void;
}) {
  const options = useMemo(() => episodeOptions(groups), [groups]);
  const [episodeNo, setEpisodeNo] = useState(options[0]?.no ?? 0);
  const validVodId = /^[1-9][0-9]*$/.test(vodId);
  const query = useQuery({
    queryKey: ["source-quality", vodId, episodeNo],
    queryFn: () => api.inspect(vodId, episodeNo),
    enabled: validVodId && episodeNo > 0,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000
  });

  useEffect(() => {
    const firstEpisodeNo = options[0]?.no ?? 0;
    if (episodeNo === 0 || !options.some((episode) => episode.no === episodeNo)) setEpisodeNo(firstEpisodeNo);
  }, [episodeNo, options]);

  useEffect(() => {
    if (episodeNo < 1) return;
    if (query.isFetching) {
      onViewChange({ episodeNo, status: "loading" });
      return;
    }
    if (query.data) {
      const preference = storeSourceQualityPreference(window.sessionStorage, vodId, episodeNo, query.data);
      onViewChange({ episodeNo, status: "ready", data: query.data });
      onRecommendation(preference, episodeNo);
      return;
    }
    if (query.isError) {
      onViewChange({ episodeNo, status: "error" });
      onRecommendation(null, episodeNo);
    }
  }, [episodeNo, onRecommendation, onViewChange, query.data, query.isError, query.isFetching, vodId]);

  if (options.length === 0 || !validVodId) {
    return (
      <div className="source-quality-panel">
        <div className="source-quality-copy">
          <strong>播放线路测速</strong>
          <span>当前视频没有可检测的集数。</span>
        </div>
      </div>
    );
  }

  const selected = options.find((episode) => episode.no === episodeNo);
  const availableCount = query.data?.sources.filter((source) => source.available).length ?? 0;
  const recommended = query.data?.sources.find((source) => source.recommended);
  const summary = query.isFetching
    ? `正在检测 ${selected?.name ?? "所选集数"} 的各条线路，请稍候。`
    : query.isError
      ? query.error.message
      : query.data
        ? `检测完成：${availableCount}/${query.data.sources.length} 条已检测线路可用${recommended ? `；推荐 ${recommended.from}` : ""}${
            query.data.cached ? "（1 分钟内缓存结果）" : ""
          }。`
        : "即将自动检测；结果代表站点服务器到播放源的当前连接状况。";

  return (
    <div className="source-quality-panel">
      <div className="source-quality-copy">
        <strong>播放线路测速</strong>
        <span>页面会自动检测所选集数，并推荐当前可用且测速更优的播放线路。</span>
      </div>
      <div className="source-quality-controls">
        <label htmlFor="reactSourceQualityEpisode">测速集数</label>
        <select id="reactSourceQualityEpisode" value={episodeNo} onChange={(event) => setEpisodeNo(Number(event.target.value))}>
          {options.map((episode) => (
            <option key={episode.no} value={episode.no}>
              {episode.name}
            </option>
          ))}
        </select>
        <button className="ghost-btn" type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>
          {query.isFetching ? "检测中…" : "重新检测"}
        </button>
      </div>
      <p className="source-quality-summary" role={query.isError ? "alert" : "status"} aria-live="polite">
        {summary}
      </p>
    </div>
  );
}
