import { describe, expect, it, vi } from "vitest";

import { createSourceQualityApi } from "./sourceQuality";

const qualityData = {
  vod_id: 7,
  nid: 2,
  checked_at: 1_785_280_000,
  cached: false,
  recommended_sid: 3,
  sources: [
    {
      sid: 3,
      from: "备用线路",
      nid: 2,
      episode_name: "测试文本",
      status: "available",
      available: true,
      http_code: 200,
      latency_ms: 180,
      speed_kbps: 5600,
      sample_count: 3,
      tested_width: 1920,
      tested_height: 1080,
      max_width: 3840,
      max_height: 2160,
      resolution_basis: "manifest",
      variant_bandwidth_kbps: 6200,
      variant_codecs: "avc1.640028",
      fallback_used: true,
      quality_rank: 1,
      recommended: true,
      message: "检测完成"
    }
  ]
};

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    async json() {
      return body;
    }
  } as Response;
}

describe("createSourceQualityApi", () => {
  it("posts the selected video and episode and parses the source-quality contract", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse({ code: 1, msg: "检测完成", data: qualityData }));
    const api = createSourceQualityApi({ endpoint: "/index.php/pingfangdevice/sourceQuality", fetchImpl });

    const data = await api.inspect("7", "2");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0]!;
    const requestOptions = options!;
    expect(url).toBe("/index.php/pingfangdevice/sourceQuality");
    expect(requestOptions).toMatchObject({
      method: "POST",
      credentials: "same-origin"
    });
    expect(requestOptions.body).toBeInstanceOf(FormData);
    expect((requestOptions.body as FormData).get("vod_id")).toBe("7");
    expect((requestOptions.body as FormData).get("nid")).toBe("2");
    expect(data).toEqual(qualityData);
  });

  it("rejects invalid input, business failures and malformed quality data", async () => {
    const api = createSourceQualityApi({
      endpoint: "/index.php/pingfangdevice/sourceQuality",
      fetchImpl: async () => jsonResponse({ code: 1, data: qualityData })
    });
    await expect(api.inspect(0, 1)).rejects.toMatchObject({ kind: "validation" });
    await expect(api.inspect(1, 10_001)).rejects.toMatchObject({ kind: "validation" });

    const deniedApi = createSourceQualityApi({
      endpoint: "/index.php/pingfangdevice/sourceQuality",
      fetchImpl: async () => jsonResponse({ code: 503, msg: "线路检测暂不可用", data: null })
    });
    await expect(deniedApi.inspect(7, 2)).rejects.toMatchObject({
      kind: "business",
      code: 503,
      message: "线路检测暂不可用"
    });

    const invalidApi = createSourceQualityApi({
      endpoint: "/index.php/pingfangdevice/sourceQuality",
      fetchImpl: async () => jsonResponse({ code: 1, data: { ...qualityData, sources: [{ sid: 3, status: "available" }] } })
    });
    await expect(invalidApi.inspect(7, 2)).rejects.toMatchObject({ kind: "invalid-response" });

    const mismatchedApi = createSourceQualityApi({
      endpoint: "/index.php/pingfangdevice/sourceQuality",
      fetchImpl: async () => jsonResponse({ code: 1, data: { ...qualityData, vod_id: 8 } })
    });
    await expect(mismatchedApi.inspect(7, 2)).rejects.toMatchObject({
      kind: "invalid-response",
      message: "线路检测响应与当前影片或集数不匹配"
    });
  });
});
