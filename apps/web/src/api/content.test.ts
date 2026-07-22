import { describe, expect, it } from "vitest";

import { createContentApi } from "./content";

const video = {
  id: 1,
  typeId: 42,
  typeName: "电影",
  title: "云端回声",
  remark: "高清",
  actor: "甲演员",
  director: "张导",
  year: "2026",
  area: "中国大陆",
  class: "科幻",
  lang: "国语",
  letter: "Y",
  hits: 100,
  score: 8,
  updated: "2026-01-01",
  poster: "/poster-1.jpg",
  backdrop: "/backdrop-1.jpg",
  duration: "120分钟",
  version: "4K",
  summary: "第一部影片",
  url: "https://example.com/leaked-top-level.mp4",
  episodes: [{ id: 101, no: 1, name: "正片", sourceId: 1, src: "https://example.com/leaked-episode.mp4" }],
  playSources: [
    {
      id: 1,
      name: "高清线路",
      tip: "稳定",
      episodes: [{ id: 101, no: 1, name: "正片", sourceId: 1, src: "https://example.com/leaked-source.mp4" }]
    }
  ],
  scoreCount: 18,
  likes: 12,
  dislikes: 2
};

const card = {
  id: 2,
  title: "午夜档案",
  remark: "高清",
  year: "2026",
  class: "悬疑",
  score: 7.9,
  poster: "/poster-2.jpg"
};

const contentResponse = {
  siteName: "平方影视",
  categories: [{ id: 42, name: "电影", total: 227313, internal: "drop-me" }],
  categoryContext: { current: null, parent: null, children: [] },
  facets: { areas: ["中国大陆"], years: ["2026"], langs: ["国语"], classes: ["科幻", "悬疑"] },
  videos: [
    {
      id: video.id,
      title: video.title,
      remark: video.remark,
      year: video.year,
      class: video.class,
      score: video.score,
      poster: video.poster,
      typeName: video.typeName,
      actor: video.actor,
      summary: video.summary
    }
  ],
  total: 227313,
  page: 2,
  totalPages: 9472
};

const detailResponse = {
  siteName: "平方影视",
  video,
  related: [card]
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

describe("createContentApi", () => {
  it("sends server-side pagination and filter parameters and parses totals", async () => {
    const calls: string[] = [];
    const api = createContentApi({
      endpoint: "/react-api.php?lang=zh",
      fetchImpl: async (input) => {
        calls.push(String(input));
        return jsonResponse({ code: 1, data: contentResponse });
      }
    });

    const content = await api.getContent({
      typeId: 42,
      area: "中国大陆",
      year: "2026",
      class: "科幻",
      lang: "国语",
      letter: "Y",
      sort: "hot",
      page: 2,
      pageSize: 24,
      keyword: "云端",
      scope: "library",
      includeCategoryTotals: true,
      includeFacets: true
    });

    const url = new URL(calls[0] ?? "", "https://react.test");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      action: "content",
      type_id: "42",
      area: "中国大陆",
      year: "2026",
      class: "科幻",
      lang: "国语",
      letter: "Y",
      sort: "hot",
      page: "2",
      page_size: "24",
      keyword: "云端",
      scope: "library",
      compact: "1",
      include_category_totals: "1",
      include_facets: "1"
    });
    expect(content).toMatchObject({ total: 227313, page: 2, totalPages: 9472 });
    expect(content.categories[0]).toEqual({ id: "42", name: "电影", total: 227313 });
    expect(Object.keys(content.videos[0] ?? {})).toEqual(["id", "title", "remark", "year", "class", "score", "poster", "typeName", "actor", "summary"]);
    expect(content.videos[0]).not.toHaveProperty("url");
    expect(content.videos[0]).not.toHaveProperty("episodes");
  });

  it("loads one detail independently from the paginated catalog", async () => {
    const calls: string[] = [];
    const api = createContentApi({
      endpoint: "/react-api.php",
      fetchImpl: async (input) => {
        calls.push(String(input));
        return jsonResponse({ code: 1, data: detailResponse });
      }
    });

    const detail = await api.getDetail(1);

    expect(calls).toEqual(["/react-api.php?action=detail&vod_id=1&compact=1"]);
    expect(detail.video.id).toBe("1");
    expect(Object.keys(detail.video)).toEqual([
      "id",
      "typeName",
      "title",
      "remark",
      "actor",
      "director",
      "year",
      "area",
      "class",
      "lang",
      "hits",
      "score",
      "updated",
      "poster",
      "backdrop",
      "duration",
      "summary",
      "episodes",
      "playSources",
      "scoreCount",
      "likes",
      "dislikes"
    ]);
    expect(detail.related.map((item) => item.id)).toEqual(["2"]);
    expect(Object.keys(detail.related[0] ?? {})).toEqual(["id", "title", "remark", "year", "class", "score", "poster"]);
    expect(JSON.stringify(detail)).not.toContain("leaked-episode.mp4");
    expect(JSON.stringify(detail)).not.toContain("leaked-source.mp4");
  });

  it("loads access state, downloads and plot through dedicated safe contracts", async () => {
    const calls: string[] = [];
    const api = createContentApi({
      endpoint: "/react-api.php",
      fetchImpl: async (input) => {
        const value = String(input);
        calls.push(value);
        const action = new URL(value, "https://react.test").searchParams.get("action");
        const dataByAction: Record<string, unknown> = {
          access: {
            siteName: "平方影视",
            video: { id: 1, title: "云端回声" },
            scope: "playback",
            state: "password",
            authorized: false,
            passwordRequired: true,
            message: "需要密码",
            points: 0,
            tryseeMinutes: 0
          },
          downloads: {
            siteName: "平方影视",
            video: { id: 1, title: "云端回声" },
            access: { state: "allowed", authorized: true, passwordRequired: false, message: "允许访问", points: 0 },
            sources: [{ id: 2, name: "网盘", tip: "客户端", items: [{ id: 3, name: "1080P", href: "/index.php/vod/down/id/1/sid/2/nid/3.html" }] }]
          },
          plot: {
            siteName: "平方影视",
            video: { id: 1, title: "云端回声", summary: "简介" },
            items: [{ name: "第一集", detail: "真实剧情" }]
          }
        };
        return jsonResponse({ code: 1, data: dataByAction[action || ""] });
      }
    });

    const access = await api.getAccess(1, "playback", 2, 3);
    const downloads = await api.getDownloads(1);
    const plot = await api.getPlot(1);

    expect(calls).toEqual([
      "/react-api.php?action=access&vod_id=1&scope=playback&source_id=2&episode_id=3",
      "/react-api.php?action=downloads&vod_id=1",
      "/react-api.php?action=plot&vod_id=1"
    ]);
    expect(access).toMatchObject({ state: "password", passwordRequired: true });
    expect(downloads.sources[0]?.items[0]).toEqual({ id: "3", name: "1080P", href: "/index.php/vod/down/id/1/sid/2/nid/3.html" });
    expect(plot.items).toEqual([{ name: "第一集", detail: "真实剧情" }]);
    expect(JSON.stringify(downloads)).not.toContain("vod_down_url");
  });

  it("keeps playback URLs isolated to the playback response", async () => {
    const calls: string[] = [];
    const api = createContentApi({
      endpoint: "/react-api.php",
      fetchImpl: async (input) => {
        calls.push(String(input));
        return jsonResponse({
          code: "1",
          data: {
            siteName: "平方影视",
            vodId: 1,
            sourceId: 1,
            episodeId: 101,
            title: "云端回声",
            episodeName: "正片",
            poster: "/poster-1.jpg",
            playSources: [{ id: 1, name: "高清线路", tip: "稳定", episodes: [{ id: 101, no: 1, name: "正片", sourceId: 1 }] }],
            kind: "video",
            url: "https://media.example.com/video.mp4",
            mimeType: "video/mp4",
            internalPath: "/srv/media/video.mp4"
          }
        });
      }
    });

    const playback = await api.getPlayback(1, 1, 101);

    expect(calls).toEqual(["/react-api.php?action=playback&vod_id=1&source_id=1&episode_id=101"]);
    expect(playback).toEqual({
      siteName: "平方影视",
      vodId: "1",
      sourceId: "1",
      episodeId: "101",
      title: "云端回声",
      episodeName: "正片",
      poster: "/poster-1.jpg",
      playSources: [{ id: "1", name: "高清线路", tip: "稳定", episodes: [{ id: "101", no: 1, name: "正片", sourceId: "1" }] }],
      kind: "video",
      url: "https://media.example.com/video.mp4",
      mimeType: "video/mp4"
    });
  });

  it("reports configuration, validation, business and DTO errors", async () => {
    await expect(createContentApi().getContent()).rejects.toMatchObject({ kind: "configuration" });

    const invalidApi = createContentApi({
      endpoint: "/react-api.php",
      fetchImpl: async () => jsonResponse({ code: 1, data: { videos: "invalid" } })
    });
    await expect(invalidApi.getContent()).rejects.toMatchObject({ kind: "invalid-response" });
    await expect(invalidApi.getContent({ pageSize: 101 })).rejects.toMatchObject({ kind: "validation" });
    await expect(invalidApi.getDetail("")).rejects.toMatchObject({ kind: "validation" });
    await expect(invalidApi.getPlayback("", 1, 1)).rejects.toMatchObject({ kind: "validation" });

    const deniedApi = createContentApi({
      endpoint: "/react-api.php",
      fetchImpl: async () => jsonResponse({ code: 403, msg: "当前内容不可播放", data: null })
    });
    await expect(deniedApi.getPlayback(1, 1, 1)).rejects.toMatchObject({ kind: "business", code: 403, message: "当前内容不可播放" });

    const externalIframeApi = createContentApi({
      endpoint: "/react-api.php",
      fetchImpl: async () =>
        jsonResponse({
          code: 1,
          data: {
            siteName: "平方影视",
            vodId: 1,
            sourceId: 1,
            episodeId: 1,
            title: "云端回声",
            episodeName: "正片",
            poster: "/poster.jpg",
            playSources: [{ id: 1, name: "高清线路", tip: "", episodes: [{ id: 1, no: 1, name: "正片", sourceId: 1 }] }],
            kind: "iframe",
            url: "https://untrusted.example/player"
          }
        })
    });
    await expect(externalIframeApi.getPlayback(1, 1, 1)).rejects.toMatchObject({ kind: "invalid-response" });
  });
});
