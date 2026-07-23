import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountPage, LoginPage } from "../screens/AccountPages";
import { CatalogPage, CategoriesPage, RankingsPage, SearchPage } from "../screens/CatalogPages";
import { ContentChallengePage, DownloadsPage, PlayerPage, PlotPage, VodDetailPage } from "../screens/ContentPages";
import { HomePage } from "../screens/HomePage";
import { FeedbackPage, ReportPage } from "../screens/InteractionPages";
import { LocalHistoryPage } from "../screens/LocalHistoryPage";
import { NotFoundPage, StatusPage } from "../screens/MigrationPages";
import { homeFixtureResponse, homeV2FixtureResponse, navigationFixtureResponse } from "../test/homeFixture";
import { AppShell } from "./AppShell";
import { TestRoutingProvider } from "./routing";

const contentFixtureResponse = {
  siteName: homeFixtureResponse.siteName,
  todayUpdated: homeFixtureResponse.todayUpdated,
  contentYear: "2026",
  hotSearch: homeFixtureResponse.hotSearch,
  categories: [{ id: 42, name: "电影", total: homeFixtureResponse.videos.length }],
  categoryContext: { current: null, parent: null, children: [] },
  facets: {
    areas: Array.from(new Set(homeFixtureResponse.videos.map((video) => video.area))),
    years: Array.from(new Set(homeFixtureResponse.videos.map((video) => video.year))),
    langs: Array.from(new Set(homeFixtureResponse.videos.map((video) => video.lang))),
    classes: Array.from(new Set(homeFixtureResponse.videos.map((video) => video.class)))
  },
  videos: homeFixtureResponse.videos.map((video) => ({
    id: video.id,
    typeId: 42,
    typeName: "电影",
    title: video.title,
    remark: video.remark,
    actor: video.actor,
    director: video.director,
    year: video.year,
    area: video.area,
    class: video.class,
    lang: video.lang,
    letter: video.letter,
    hits: video.hits,
    score: video.score,
    updated: video.updated,
    poster: video.poster,
    backdrop: video.backdrop,
    duration: video.duration,
    version: video.version,
    summary: video.summary,
    episodes: [{ id: 101, no: 1, name: "正片", sourceId: 1 }],
    playSources: [{ id: 1, name: "高清线路", tip: "稳定", episodes: [{ id: 101, no: 1, name: "正片", sourceId: 1 }] }],
    scoreCount: 12,
    likes: 9,
    dislikes: 1
  })),
  total: homeFixtureResponse.videos.length,
  page: 1,
  pageSize: 24,
  totalPages: 1
};

const detailFixtureResponse = {
  siteName: contentFixtureResponse.siteName,
  video: contentFixtureResponse.videos[0],
  related: contentFixtureResponse.videos.slice(1, 7)
};

function jsonResponse(body: unknown, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    }
  } as Response;
}

function requestAction(input: RequestInfo | URL) {
  return new URL(String(input), "http://react.test").searchParams.get("action");
}

function requestParam(input: RequestInfo | URL, name: string) {
  return new URL(String(input), "http://react.test").searchParams.get(name);
}

async function apiFetch(input: RequestInfo | URL): Promise<Response> {
  switch (requestAction(input)) {
    case "home_v2":
      return jsonResponse({ code: 1, msg: "首页加载成功", data: homeV2FixtureResponse });
    case "navigation":
      return jsonResponse({ code: 1, msg: "导航加载成功", data: navigationFixtureResponse });
    case "content":
      return jsonResponse({
        code: 1,
        msg: "内容加载成功",
        data: {
          ...contentFixtureResponse,
          categoryContext:
            requestParam(input, "type_id") === "42"
              ? { current: { id: 42, name: "电影", parentId: null }, parent: null, children: [] }
              : contentFixtureResponse.categoryContext
        }
      });
    case "detail":
      return requestParam(input, "vod_id") === "1"
        ? jsonResponse({ code: 1, msg: "影片详情加载成功", data: detailFixtureResponse })
        : jsonResponse({ code: 404, msg: "影片不存在", data: null }, { ok: false, status: 404 });
    case "access":
      return jsonResponse({
        code: 1,
        msg: "访问状态加载成功",
        data: {
          siteName: "平方影视",
          video: { id: 1, title: "云端回声" },
          scope: "detail",
          state: "password",
          authorized: false,
          passwordRequired: true,
          message: "该内容需要密码验证",
          points: 0,
          tryseeMinutes: 0
        }
      });
    case "downloads":
      return jsonResponse({
        code: 1,
        msg: "下载列表加载成功",
        data: {
          siteName: "平方影视",
          video: { id: 1, title: "云端回声" },
          access: { state: "allowed", authorized: true, passwordRequired: false, message: "允许访问", points: 0 },
          sources: [
            {
              id: 1,
              name: "高清下载",
              tip: "推荐线路",
              items: [{ id: 101, name: "正片", href: "/index.php/vod/down/id/1/sid/1/nid/101.html" }]
            }
          ]
        }
      });
    case "plot":
      return jsonResponse({
        code: 1,
        msg: "分集剧情加载成功",
        data: {
          siteName: "平方影视",
          video: { id: 1, title: "云端回声", summary: "一段真实剧情简介" },
          items: [{ name: "正片", detail: "主角在云端重逢。" }]
        }
      });
    case "session":
      return jsonResponse({
        code: 1,
        msg: "会话加载成功",
        data: { authenticated: false, user: null, csrfToken: "test-csrf-token" }
      });
    case "playback":
      return jsonResponse({
        code: 1,
        msg: "播放信息加载成功",
        data: {
          siteName: "平方影视",
          vodId: 1,
          sourceId: 1,
          episodeId: 101,
          title: "云端回声",
          episodeName: "正片",
          poster: "https://example.com/poster.jpg",
          playSources: detailFixtureResponse.video.playSources,
          kind: "video",
          url: "https://media.example.com/video.mp4",
          mimeType: "video/mp4"
        }
      });
    case "feedback":
      return jsonResponse({ code: 1, msg: "留言已提交", data: { id: 11, status: "pending" } });
    case "report":
      return jsonResponse({ code: 1, msg: "报错已提交", data: { id: 12, status: "pending" } });
    case "reaction":
      return jsonResponse({ code: 1, msg: "互动状态已更新", data: { target: "vod", targetId: 1, value: "like", likes: 10, dislikes: 1 } });
    case "rating":
      return jsonResponse({ code: 1, msg: "评分已提交", data: { vodId: 1, score: 8, average: 8.5, count: 13 } });
    case "password.verify":
      return jsonResponse({ code: 1, msg: "密码验证成功", data: { vodId: 1, scope: "detail", authorized: true } });
    case "history.save":
      return jsonResponse({ code: 1, msg: "播放记录已保存", data: { saved: true } });
    default:
      throw new Error(`未覆盖的测试 API action：${requestAction(input) ?? "missing"}`);
  }
}

function routeForTest(path: string) {
  const { pathname } = new URL(path, "http://react.test");
  if (pathname === "/") return { element: <HomePage />, params: {} };
  if (pathname === "/videos") return { element: <CatalogPage />, params: {} };
  if (pathname === "/categories") return { element: <CategoriesPage />, params: {} };
  if (pathname === "/rankings/yearly") return { element: <RankingsPage />, params: {} };
  if (pathname === "/search") return { element: <SearchPage />, params: {} };
  if (pathname === "/history") return { element: <LocalHistoryPage />, params: {} };
  if (pathname === "/login") return { element: <LoginPage />, params: {} };
  if (pathname === "/account") return { element: <AccountPage />, params: {} };
  if (pathname === "/feedback") return { element: <FeedbackPage />, params: {} };
  if (pathname === "/report") return { element: <ReportPage />, params: {} };
  if (pathname === "/status") return { element: <StatusPage />, params: {} };

  const category = pathname.match(/^\/category\/([^/]+)$/);
  if (category) return { element: <CatalogPage />, params: { typeId: category[1] } };
  const detail = pathname.match(/^\/vod\/([^/]+)$/);
  if (detail) return { element: <VodDetailPage />, params: { vodId: detail[1] } };
  const download = pathname.match(/^\/vod\/([^/]+)\/download$/);
  if (download) return { element: <DownloadsPage />, params: { vodId: download[1] } };
  const plot = pathname.match(/^\/vod\/([^/]+)\/plot$/);
  if (plot) return { element: <PlotPage />, params: { vodId: plot[1] } };
  const unlock = pathname.match(/^\/vod\/([^/]+)\/unlock$/);
  if (unlock) return { element: <ContentChallengePage kind="detail" />, params: { vodId: unlock[1] } };
  const watch = pathname.match(/^\/watch\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (watch) {
    return {
      element: <PlayerPage />,
      params: { vodId: watch[1], sourceId: watch[2], episodeId: watch[3] }
    };
  }
  return { element: <NotFoundPage />, params: {} };
}

function renderRoutes(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  const route = routeForTest(path);

  return render(
    <QueryClientProvider client={queryClient}>
      <TestRoutingProvider href={path} params={route.params}>
        <AppShell>{route.element}</AppShell>
      </TestRoutingProvider>
    </QueryClientProvider>
  );
}

function expectMigratedPage(container: HTMLElement) {
  expect(container).not.toHaveTextContent("迁移占位页面");
  container.querySelectorAll("a").forEach((link) => {
    expect(link.getAttribute("href")).not.toContain("index.php");
  });
}

describe("React migration routes", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(apiFetch));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the migrated home page with clean React URLs", async () => {
    const { container } = renderRoutes("/");

    expect(await screen.findByRole("heading", { name: "平方影视首页" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "立即播放" })).toHaveAttribute("href", "/watch/1/1/1");
    expect(screen.getByRole("link", { name: "详情介绍" })).toHaveAttribute("href", "/vod/1");
    expect(screen.getByRole("link", { name: "电影银幕精选" })).toHaveAttribute("href", "/category/42");
    expect(screen.getByRole("link", { name: "查看更多" })).toHaveAttribute("href", "/rankings/yearly");
    expect(screen.getByRole("link", { name: "热播榜全站热度" })).toHaveAttribute("href", "/rankings/yearly");
    expect(screen.getByRole("link", { name: "登录" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("navigation", { name: "主导航" }).querySelector('a[href="/categories"]')).toHaveTextContent("视频");
    expect(container.querySelector('.mobile-drawer-links a[href="/categories"]')).toHaveTextContent("视频");
    const actions = vi.mocked(fetch).mock.calls.map(([input]) => requestAction(input));
    expect(actions.filter((action) => action === "home_v2")).toHaveLength(1);
    expect(actions).not.toContain("navigation");
    expectMigratedPage(container);
  });

  it("retries a transient session network failure before showing the account as anonymous", async () => {
    let sessionAttempts = 0;
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (requestAction(input) === "session") {
        sessionAttempts += 1;
        if (sessionAttempts === 1) throw new TypeError("temporary network failure");
        return jsonResponse({
          code: 1,
          msg: "会话加载成功",
          data: {
            authenticated: true,
            user: { id: 9, name: "测试会员" },
            csrfToken: "test-csrf-token"
          }
        });
      }
      return apiFetch(input);
    });

    renderRoutes("/");

    expect(await screen.findByRole("link", { name: "用户中心：测试会员" })).toHaveAttribute("href", "/account");
    expect(sessionAttempts).toBe(2);
  });

  it("uses the current browser history for the homepage continue rail", async () => {
    localStorage.setItem(
      "pingfang_history",
      JSON.stringify([{ id: "1", name: "云端回声", url: "/watch/1/1/101", progress: "已看到 8:20", time: "2026-07-21T10:00:00Z" }])
    );

    const { container } = renderRoutes("/");

    expect(await screen.findByRole("heading", { name: "继续观看" })).toBeInTheDocument();
    expect(container.querySelector(".home-continue-card")).toHaveAttribute("href", "/watch/1/1/101");
    expect(container.querySelector(".home-continue-poster")).toHaveClass("is-image-missing");
    expect(screen.getByRole("link", { name: "全部记录" })).toHaveAttribute("href", "/history");
  });

  it.each([
    ["/videos", "影片库"],
    ["/category/42", "电影"],
    ["/search?wd=云端回声", "云端回声"],
    ["/vod/1", "云端回声"]
  ])("renders migrated content route %s", async (path, heading) => {
    const { container } = renderRoutes(path);

    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    expect(container).toHaveTextContent("云端回声");
    expectMigratedPage(container);
  });

  it("renders the video category index at the top navigation target", async () => {
    const { container } = renderRoutes("/categories");

    expect(await screen.findByRole("heading", { level: 1, name: "视频分类" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "进入电影" })).toHaveAttribute("href", "/category/42");
    expectMigratedPage(container);
  });

  it("keeps anonymous feedback enabled when MacCMS does not require login", async () => {
    let submittedBody: Record<string, unknown> | undefined;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (requestAction(input) === "feedback") {
        submittedBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      }
      return apiFetch(input);
    });

    renderRoutes("/feedback");

    fireEvent.change(await screen.findByLabelText("内容"), { target: { value: "匿名留言" } });
    const submit = screen.getByRole("button", { name: "提交留言" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    expect(await screen.findByText("留言已提交，审核通过后显示。")).toBeInTheDocument();
    expect(submittedBody).toEqual({ content: "匿名留言" });
  });

  it("keeps the legacy direct report form usable without a video id", async () => {
    let submittedBody: Record<string, unknown> | undefined;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (requestAction(input) === "report") {
        submittedBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      }
      return apiFetch(input);
    });

    renderRoutes("/report");

    expect(await screen.findByLabelText("影片 ID（可选）")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("问题详情"), { target: { value: "旧地址直接报错" } });
    const submit = screen.getByRole("button", { name: "提交报错" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    expect(await screen.findByText("报错已提交，正在等待管理员审核。")).toBeInTheDocument();
    expect(submittedBody).toEqual({ reason: "无法播放", details: "旧地址直接报错" });
  });

  it("allows anonymous MacCMS rating and digg while keeping counts in sync", async () => {
    const { container } = renderRoutes("/vod/1");

    expect(await screen.findByRole("heading", { level: 1, name: "云端回声" })).toBeInTheDocument();
    expect(container.querySelector(".detail-actions > .primary-btn + .detail-favorite-action")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "下载" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "评论" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "评分" }));
    expect(await screen.findByText("评分已提交")).toBeInTheDocument();
    expect(screen.getByText("13 人评分")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "点赞 9" }));
    expect(await screen.findByRole("button", { name: "点赞 10" })).toBeInTheDocument();
  });

  it("requests the scoped paginated library without repeating the category entry cards", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (requestAction(input) === "content") {
        return jsonResponse({
          code: 1,
          msg: "内容加载成功",
          data: { ...contentFixtureResponse, page: 2, totalPages: 3 }
        });
      }
      return apiFetch(input);
    });

    const { container } = renderRoutes("/videos?page=2");

    expect(await screen.findByRole("heading", { level: 1, name: "影片库" })).toBeInTheDocument();
    const contentCall = vi.mocked(fetch).mock.calls.find(([input]) => requestAction(input) === "content")?.[0];
    expect(contentCall).toBeDefined();
    expect(requestParam(contentCall!, "scope")).toBe("library");
    expect(requestParam(contentCall!, "page")).toBe("2");
    expect(requestParam(contentCall!, "page_size")).toBe("24");
    expect(screen.queryByRole("link", { name: "进入电影" })).not.toBeInTheDocument();
    expect(container.querySelector(".category-tile")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下一页" })).toHaveAttribute("href", "/videos?page=3");
  });

  it("replaces the library root types with the selected category children", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (requestAction(input) === "content") {
        return jsonResponse({
          code: 1,
          msg: "内容加载成功",
          data: {
            ...contentFixtureResponse,
            categoryContext: {
              current: { id: 4201, name: "动作", parentId: 42 },
              parent: { id: 42, name: "电影", parentId: null },
              children: [
                { id: 4201, name: "动作", parentId: 42 },
                { id: 4202, name: "喜剧", parentId: 42 }
              ]
            }
          }
        });
      }
      return apiFetch(input);
    });

    const { container } = renderRoutes("/videos?typeId=4201&area=冰岛");

    expect(await screen.findByRole("heading", { level: 1, name: "影片库" })).toBeInTheDocument();
    const typeRow = Array.from(container.querySelectorAll(".filter-row")).find((row) => row.querySelector("strong")?.textContent === "类型");
    expect(typeRow?.querySelector(".is-active")).toHaveTextContent("动作");
    expect(typeRow?.querySelector('a[href*="typeId=42"]')).toHaveTextContent("全部");
    expect(typeRow?.querySelector('a[href*="typeId=4202"]')).toHaveTextContent("喜剧");
    expect(typeRow?.querySelector('a[href^="/category/"]')).not.toBeInTheDocument();
    const contentCall = vi.mocked(fetch).mock.calls.find(([input]) => requestAction(input) === "content")?.[0];
    expect(requestParam(contentCall!, "type_id")).toBe("4201");
    expect(requestParam(contentCall!, "scope")).toBe("library");
  });

  it("uses category context and native facets for a child category", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (requestAction(input) === "content") {
        return jsonResponse({
          code: 1,
          msg: "内容加载成功",
          data: {
            ...contentFixtureResponse,
            categoryContext: {
              current: { id: 4201, name: "动作", parentId: 42 },
              parent: { id: 42, name: "电影", parentId: null },
              children: [
                { id: 4201, name: "动作", parentId: 42 },
                { id: 4202, name: "喜剧", parentId: 42 }
              ]
            },
            facets: { areas: ["冰岛"], years: ["1999"], langs: ["冰岛语"], classes: ["冒险"] }
          }
        });
      }
      return apiFetch(input);
    });

    const { container } = renderRoutes("/category/4201?area=冰岛");

    expect(await screen.findByRole("heading", { level: 1, name: "动作" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "分类不存在" })).not.toBeInTheDocument();
    const typeRow = Array.from(container.querySelectorAll(".filter-row")).find((row) => row.querySelector("strong")?.textContent === "类型");
    expect(typeRow?.querySelector(".is-active")).toHaveTextContent("动作");
    expect(typeRow?.querySelector('a[href^="/category/42"]')).toHaveTextContent("全部");
    expect(typeRow?.querySelector('a[href^="/category/4202"]')).toHaveTextContent("喜剧");
    expect(screen.getByRole("link", { name: "冰岛" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "1999" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "冰岛语" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "中国大陆" })).not.toBeInTheDocument();
    const contentCall = vi.mocked(fetch).mock.calls.find(([input]) => requestAction(input) === "content")?.[0];
    expect(requestParam(contentCall!, "type_id")).toBe("4201");
    expect(requestParam(contentCall!, "scope")).toBeNull();
  });

  it("uses real child categories for the search type row", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (requestAction(input) === "content") {
        return jsonResponse({
          code: 1,
          msg: "内容加载成功",
          data: {
            ...contentFixtureResponse,
            categoryContext: {
              current: { id: 4201, name: "动作", parentId: 42 },
              parent: { id: 42, name: "电影", parentId: null },
              children: [
                { id: 4201, name: "动作", parentId: 42 },
                { id: 4202, name: "喜剧", parentId: 42 }
              ]
            }
          }
        });
      }
      return apiFetch(input);
    });

    const { container } = renderRoutes("/search?wd=云端回声&typeId=4201&class=悬疑");

    expect(await screen.findByRole("heading", { level: 2, name: "动作" })).toBeInTheDocument();
    const rows = Array.from(container.querySelectorAll(".search-filter-panel .filter-row"));
    const channelRow = rows.find((row) => row.querySelector("strong")?.textContent === "频道");
    const typeRow = rows.find((row) => row.querySelector("strong")?.textContent === "类型");
    expect(channelRow?.querySelector(".is-active")).toHaveTextContent("电影");
    expect(typeRow?.querySelector(".is-active")).toHaveTextContent("动作");
    expect(typeRow?.querySelector('a[href*="typeId=4202"]')).toHaveTextContent("喜剧");
    expect(rows.map((row) => row.querySelector("strong")?.textContent)).not.toContain("剧情");
    const contentCall = vi.mocked(fetch).mock.calls.find(([input]) => requestAction(input) === "content")?.[0];
    expect(requestParam(contentCall!, "type_id")).toBe("4201");
    expect(requestParam(contentCall!, "class")).toBeNull();
    expect(requestParam(contentCall!, "include_facets")).toBeNull();
  });

  it("requests and paginates the current-year ranking scope", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (requestAction(input) === "content") {
        return jsonResponse({
          code: 1,
          msg: "内容加载成功",
          data: { ...contentFixtureResponse, page: 2, totalPages: 3 }
        });
      }
      return apiFetch(input);
    });

    renderRoutes("/rankings/yearly?page=2");

    expect(await screen.findByRole("heading", { level: 1, name: "年度热度榜" })).toBeInTheDocument();
    const contentCall = vi.mocked(fetch).mock.calls.find(([input]) => requestAction(input) === "content")?.[0];
    expect(requestParam(contentCall!, "scope")).toBe("yearly");
    expect(requestParam(contentCall!, "year")).toBe(String(new Date().getFullYear()));
    expect(requestParam(contentCall!, "sort")).toBe("hot");
    expect(requestParam(contentCall!, "page")).toBe("2");
    expect(requestParam(contentCall!, "page_size")).toBe("24");
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下一页" })).toHaveAttribute("href", "/rankings/yearly?page=3");
  });

  it("loads an authorized player for the clean watch route", async () => {
    const { container } = renderRoutes("/watch/1/1/101");

    expect(await screen.findByRole("heading", { level: 1, name: "云端回声 - 正片" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "云端回声 正片 视频播放器" })).toBeInTheDocument();
    expect(container.querySelector("video source")).toHaveAttribute("src", "https://media.example.com/video.mp4");
    expectMigratedPage(container);
  });

  it("renders native download groups without exposing the raw stored URL", async () => {
    renderRoutes("/vod/1/download");

    expect(await screen.findByRole("heading", { level: 1, name: "云端回声" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "高清下载" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /正片/ })).toHaveAttribute("href", "/index.php/vod/down/id/1/sid/1/nid/101.html");
    expect(document.body.innerHTML).not.toContain("media.example.com/private");
  });

  it("renders the real MacCMS plot instead of placeholder episodes", async () => {
    renderRoutes("/vod/1/plot");

    expect(await screen.findByRole("heading", { level: 1, name: "云端回声" })).toBeInTheDocument();
    expect(screen.getByText("主角在云端重逢。")).toBeInTheDocument();
    expect(screen.queryByText(/剧情内容正在整理/)).not.toBeInTheDocument();
  });

  it.each([
    ["/vod/999/download", "downloads"],
    ["/vod/999/plot", "plot"]
  ])("renders a content 404 when %s is missing", async (path, action) => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (requestAction(input) === action) {
        return jsonResponse({ code: 404, msg: "影片不存在", data: null }, { ok: false, status: 404 });
      }
      return apiFetch(input);
    });

    renderRoutes(path);

    expect(await screen.findByRole("heading", { level: 1, name: "影片不存在" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("没有找到编号为 999 的影片");
  });

  it.each([
    ["/vod/1/download", "downloads", "download", "下载访问验证：云端回声", "下载密码"],
    ["/vod/1/plot", "plot", "detail", "详情访问验证：云端回声", "访问密码"]
  ])("renders the existing access state when %s is forbidden", async (path, action, scope, heading, passwordLabel) => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (requestAction(input) === action) {
        return jsonResponse({ code: 403, msg: "无访问权限", data: null }, { ok: false, status: 403 });
      }
      return apiFetch(input);
    });

    renderRoutes(path);

    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getByLabelText(passwordLabel)).toBeInTheDocument();
    const accessCall = vi.mocked(fetch).mock.calls.find(([input]) => requestAction(input) === "access")?.[0];
    expect(requestParam(accessCall!, "scope")).toBe(scope);
  });

  it("submits a content password through the protected API", async () => {
    let submittedBody: Record<string, unknown> | undefined;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (requestAction(input) === "password.verify") {
        submittedBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      }
      return apiFetch(input);
    });

    renderRoutes("/vod/1/unlock");

    fireEvent.change(await screen.findByLabelText("访问密码"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "提交验证" }));
    await waitFor(() => expect(submittedBody).toEqual({ vodId: "1", scope: "detail", password: "secret" }));
  });

  it("writes account history once when an authenticated iframe player starts", async () => {
    const historyBodies: Array<Record<string, unknown>> = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const action = requestAction(input);
      if (action === "session") {
        return jsonResponse({
          code: 1,
          msg: "会话加载成功",
          data: { authenticated: true, user: { id: 7, name: "测试会员" }, csrfToken: "test-csrf-token" }
        });
      }
      if (action === "playback") {
        return jsonResponse({
          code: 1,
          msg: "播放信息加载成功",
          data: {
            siteName: "平方影视",
            vodId: 1,
            sourceId: 1,
            episodeId: 101,
            title: "云端回声",
            episodeName: "正片",
            poster: "/poster.jpg",
            playSources: detailFixtureResponse.video.playSources,
            kind: "iframe",
            url: "/index.php/pingfangapi/player/id/1/sid/1/nid/101.html"
          }
        });
      }
      if (action === "history.save") {
        historyBodies.push(JSON.parse(String(init?.body || "{}")) as Record<string, unknown>);
      }
      return apiFetch(input);
    });

    renderRoutes("/watch/1/1/101");

    expect(await screen.findByTitle("云端回声 - 正片 播放器")).toHaveAttribute("src", "/index.php/pingfangapi/player/id/1/sid/1/nid/101.html");
    await waitFor(() => expect(historyBodies).toEqual([{ vodId: "1", sourceId: "1", episodeId: "101", positionSeconds: 0 }]));
    expect(screen.queryByText("播放记录已保存")).not.toBeInTheDocument();
  });

  it("renders sanitized anonymous browser history separately from account history", async () => {
    localStorage.setItem(
      "pingfang_history",
      JSON.stringify([
        {
          id: "1",
          name: "云端回声",
          url: "/index.php/vod/play/id/1/sid/1/nid/101.html",
          progress: "正片 · 已看到 12:08",
          time: "2026-07-21T10:30:00+08:00"
        },
        { id: "unsafe", name: "危险地址", url: "javascript:alert(1)" }
      ])
    );

    const { container } = renderRoutes("/history");

    expect(await screen.findByRole("heading", { level: 1, name: "本地时间轴" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /云端回声/ })).toHaveAttribute("href", "/watch/1/1/101");
    expect(screen.queryByText("危险地址")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看账号记录" })).toHaveAttribute("href", "/account/history");
    expect(container.querySelector(".timeline-card .record-poster")).toHaveClass("is-image-missing");
    expectMigratedPage(container);
  });

  it("renders a content 404 for an unknown video", async () => {
    const { container } = renderRoutes("/vod/999");

    expect(await screen.findByRole("heading", { level: 1, name: "影片不存在" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("没有找到编号为 999 的影片");
    expectMigratedPage(container);
  });

  it.each([
    ["/login", "欢迎回来"],
    ["/feedback", "留言反馈"]
  ])("renders migrated interaction route %s", async (path, heading) => {
    const { container } = renderRoutes(path);

    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    expectMigratedPage(container);
  });

  it("keeps only the existing-member login entry points", async () => {
    renderRoutes("/login");

    expect(await screen.findByRole("heading", { name: "欢迎回来" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "注册会员" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "忘记密码？" })).not.toBeInTheDocument();
  });

  it("matches the legacy login controls and fine-pointer glass highlight", async () => {
    let frameCallback: FrameRequestCallback | undefined;
    vi.stubGlobal(
      "matchMedia",
      vi.fn(
        (query: string) =>
          ({
            matches: query.includes("hover: hover"),
            media: query,
            onchange: null,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            addListener: vi.fn(),
            removeListener: vi.fn(),
            dispatchEvent: vi.fn(() => true)
          }) as MediaQueryList
      )
    );
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        frameCallback = callback;
        return 1;
      })
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (requestAction(input) === "session") {
        return jsonResponse({
          code: 1,
          msg: "会话加载成功",
          data: {
            authenticated: false,
            user: null,
            csrfToken: "test-csrf-token",
            requirements: {
              loginCaptcha: true,
              feedbackLogin: false,
              feedbackEnabled: true,
              feedbackAudit: false,
              feedbackCaptcha: false,
              commentLogin: false,
              commentEnabled: true,
              commentAudit: false,
              commentCaptcha: false,
              captchaUrl: "/index.php/verify/index"
            }
          }
        });
      }
      return apiFetch(input);
    });

    const { container } = renderRoutes("/login");

    expect(await screen.findByRole("heading", { name: "欢迎回来" })).toBeInTheDocument();
    const panel = container.querySelector(".react-login-panel");
    expect(panel?.querySelectorAll("svg.login-field-icon")).toHaveLength(3);
    expect(panel?.querySelector(".login-captcha-row")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("输入验证码")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "点击刷新验证码" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "换一张验证码" })).toHaveClass("login-captcha-refresh");

    const password = screen.getByPlaceholderText("登录密码");
    const passwordToggle = screen.getByRole("button", { name: "显示密码" });
    expect(passwordToggle.querySelector("svg")).toBeInTheDocument();
    fireEvent.click(passwordToggle);
    expect(password).toHaveAttribute("type", "text");
    expect(passwordToggle).toHaveAttribute("aria-pressed", "true");

    fireEvent.pointerMove(window, { clientX: 320, clientY: 240, pointerType: "mouse" });
    expect(panel).toHaveAttribute("data-login-pointer", "active");
    frameCallback?.(0);
    expect(panel?.querySelector<HTMLElement>(".login-glass-highlight")?.style.transform).toContain("translate3d");
    expect(screen.getByRole("button", { name: "登录" })).toHaveClass("login-submit");
  });

  it("renders the React 404 page for an unknown route", async () => {
    const { container } = renderRoutes("/not-a-real-page");

    expect(await screen.findByRole("heading", { level: 1, name: "页面不存在" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("请检查地址");
    expectMigratedPage(container);
  });

  it("ignores public status copy and rejects unsafe redirects", async () => {
    renderRoutes("/status?title=完成&message=已处理&to=https%3A%2F%2Fevil.example");

    expect(await screen.findByRole("heading", { level: 1, name: "系统提示" })).toBeInTheDocument();
    expect(screen.getByText("当前操作已完成。")).toBeInTheDocument();
    expect(screen.queryByText("完成")).not.toBeInTheDocument();
    expect(screen.queryByText("已处理")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "立即前往" })).toHaveAttribute("href", "/");
  });

  it("renders a retryable error when the home request fails", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (requestAction(input) === "home_v2") {
        return jsonResponse({ msg: "首页服务暂不可用" }, { ok: false, status: 503 });
      }
      return apiFetch(input);
    });

    renderRoutes("/");

    expect(await screen.findByRole("alert")).toHaveTextContent("首页服务暂不可用");
    expect(screen.getByRole("button", { name: "重新加载" })).toBeInTheDocument();
  });

  it("renders explicit empty states when the home feed has no videos", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      if (requestAction(input) === "home_v2") {
        return jsonResponse({
          code: 1,
          msg: "首页加载成功",
          data: { ...homeV2FixtureResponse, hero: [], ranking: [], latest: [], latestByCategory: [] }
        });
      }
      return apiFetch(input);
    });

    renderRoutes("/");

    expect(await screen.findByText("暂无热播内容")).toBeInTheDocument();
    expect(screen.getByText("本年度暂无上榜内容")).toBeInTheDocument();
    expect(screen.getAllByText("本年度暂无新上线内容").length).toBeGreaterThan(0);
  });

  it("opens and closes the mobile drawer with keyboard focus restored", async () => {
    renderRoutes("/");
    await screen.findByRole("heading", { name: "平方影视首页" });

    const toggle = screen.getByRole("button", { name: "展开导航" });
    fireEvent.click(toggle);

    expect(screen.getByRole("dialog", { name: "分类导航" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭菜单" })).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle).toHaveFocus();
    expect(screen.queryByRole("dialog", { name: "分类导航" })).not.toBeInTheDocument();
  });
});
