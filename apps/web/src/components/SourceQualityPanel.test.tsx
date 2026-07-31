import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SourceQualityApi, SourceQualityData, SourceQualitySource } from "../api/sourceQuality";
import { SourceQualityPanel } from "./SourceQualityPanel";

const groups = [
  {
    sourceId: "11",
    name: "线路 A",
    tip: "",
    episodes: [
      { id: "112", no: 2, name: "测试文本 2", sourceId: "11" },
      { id: "111", no: 1, name: "测试文本 1", sourceId: "11" }
    ]
  },
  {
    sourceId: "22",
    name: "线路 B",
    tip: "",
    episodes: [
      { id: "221", no: 1, name: "测试文本 1", sourceId: "22" },
      { id: "222", no: 2, name: "测试文本 2", sourceId: "22" }
    ]
  }
];

function qualitySource(sid: number, overrides: Partial<SourceQualitySource> = {}): SourceQualitySource {
  return {
    sid,
    from: sid === 11 ? "线路 A" : "线路 B",
    nid: 1,
    episode_name: "测试文本 1",
    status: "available",
    available: true,
    http_code: 200,
    latency_ms: 180,
    speed_kbps: 5200,
    sample_count: 3,
    tested_width: 1920,
    tested_height: 1080,
    max_width: 1920,
    max_height: 1080,
    resolution_basis: "manifest",
    variant_bandwidth_kbps: 5600,
    variant_codecs: "avc1.640028",
    fallback_used: false,
    quality_rank: null,
    recommended: false,
    message: "检测完成",
    ...overrides
  };
}

const qualityData: SourceQualityData = {
  vod_id: 42,
  nid: 1,
  checked_at: 1_785_280_000,
  cached: true,
  recommended_sid: 22,
  sources: [qualitySource(11, { status: "slow", quality_rank: 2, speed_kbps: 2400 }), qualitySource(22, { quality_rank: 1, recommended: true })]
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function renderPanel(api: SourceQualityApi) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onViewChange = vi.fn();
  const onRecommendation = vi.fn();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <SourceQualityPanel vodId="42" groups={groups} api={api} onViewChange={onViewChange} onRecommendation={onRecommendation} />
    </QueryClientProvider>
  );
  return { ...view, onViewChange, onRecommendation };
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("SourceQualityPanel", () => {
  it("automatically checks the first episode, publishes its recommendation and supports a fresh recheck", async () => {
    const initial = deferred<SourceQualityData>();
    const recheck = deferred<SourceQualityData>();
    const inspect = vi
      .fn()
      .mockImplementationOnce(() => initial.promise)
      .mockImplementationOnce(() => recheck.promise);
    const { onRecommendation, onViewChange } = renderPanel({ inspect });

    await waitFor(() => expect(inspect).toHaveBeenCalledWith("42", 1));
    expect(screen.getByRole("status")).toHaveTextContent("正在检测 测试文本 1 的各条线路");
    expect(screen.getByRole("button", { name: "检测中…" })).toBeDisabled();
    expect(onViewChange).toHaveBeenCalledWith({ episodeNo: 1, status: "loading" });

    await act(async () => initial.resolve(qualityData));

    expect(await screen.findByText("检测完成：2/2 条已检测线路可用；推荐 线路 B（1 分钟内缓存结果）。")).toBeInTheDocument();
    expect(onViewChange).toHaveBeenCalledWith({ episodeNo: 1, status: "ready", data: qualityData });
    expect(onRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        vodId: "42",
        episodeNo: 1,
        recommendedSourceId: "22",
        rankedSourceIds: ["22", "11"]
      }),
      1
    );

    fireEvent.click(screen.getByRole("button", { name: "重新检测" }));
    await waitFor(() => expect(inspect).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "检测中…" })).toBeDisabled();
    expect(onViewChange).toHaveBeenCalledWith({ episodeNo: 1, status: "loading" });

    const refreshed = { ...qualityData, cached: false, checked_at: qualityData.checked_at + 1 };
    await act(async () => recheck.resolve(refreshed));

    expect(await screen.findByText("检测完成：2/2 条已检测线路可用；推荐 线路 B。")).toBeInTheDocument();
    expect(onViewChange).toHaveBeenCalledWith({ episodeNo: 1, status: "ready", data: refreshed });
  });

  it("reports a failed automatic check and clears the recommendation", async () => {
    const response = deferred<SourceQualityData>();
    const inspect = vi.fn(() => response.promise);
    const { onRecommendation, onViewChange } = renderPanel({ inspect });

    await waitFor(() => expect(inspect).toHaveBeenCalledWith("42", 1));
    await act(async () => response.reject(new Error("线路检测失败")));

    expect(await screen.findByRole("alert")).toHaveTextContent("线路检测失败");
    expect(onViewChange).toHaveBeenCalledWith({ episodeNo: 1, status: "error" });
    expect(onRecommendation).toHaveBeenCalledWith(null, 1);
    expect(screen.getByRole("button", { name: "重新检测" })).toBeEnabled();
  });
});
