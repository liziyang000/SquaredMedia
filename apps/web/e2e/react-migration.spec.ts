import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function blockExternalResources(page: Page) {
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith("http://127.0.0.1:5173/index.php/pingfangdevice/sourceQuality")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          code: 1,
          msg: "ok",
          data: {
            vod_id: 1,
            nid: 1,
            checked_at: 1_785_280_000,
            cached: false,
            recommended_sid: 1,
            sources: [
              {
                sid: 1,
                from: "测试线路",
                nid: 1,
                episode_name: "正片",
                status: "available",
                available: true,
                http_code: 200,
                latency_ms: 120,
                speed_kbps: 5600,
                sample_count: 3,
                tested_width: 1920,
                tested_height: 1080,
                max_width: 1920,
                max_height: 1080,
                resolution_basis: "manifest",
                variant_bandwidth_kbps: 6200,
                variant_codecs: "avc1.640028",
                fallback_used: false,
                quality_rank: 1,
                recommended: true,
                message: "可用"
              }
            ]
          }
        })
      });
      return;
    }
    if (url.startsWith("http://127.0.0.1:5173") || url.startsWith("data:")) {
      await route.continue();
      return;
    }
    await route.abort("blockedbyclient");
  });
}

function observeBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("ERR_BLOCKED_BY_CLIENT")) errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function expectNoOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

test("old public URLs redirect once and retired outputs return HTTP 410", async ({ request }) => {
  for (const path of ["/index.php/vod/play/id/1/sid/2/nid/3.html", "/vodplay/1-2-3.html"]) {
    for (const method of ["GET", "HEAD"] as const) {
      const legacy = method === "GET" ? await request.get(path, { maxRedirects: 0 }) : await request.head(path, { maxRedirects: 0 });
      expect(legacy.status()).toBe(301);
      expect(new URL(legacy.headers().location, "http://127.0.0.1:5173").pathname).toBe("/watch/1/2/3");
    }
  }

  for (const [path, target] of [
    ["/index.php/label/games.html", "/games"],
    ["/index.php/label/game-2048.html", "/games/2048"],
    ["/index.php/label/game-blockrain.html", "/games/blockrain"],
    ["/index.php/label/game-gomoku.html?room=abc234", "/games/gomoku?room=ABC234"],
    ["/index.php/label/game-drawguess.html?room=XYZ789", "/games/drawguess?room=XYZ789"]
  ]) {
    const legacy = await request.get(path, { maxRedirects: 0 });
    expect(legacy.status()).toBe(301);
    const location = new URL(legacy.headers().location, "http://127.0.0.1:5173");
    expect(`${location.pathname}${location.search}`).toBe(target);
  }

  const malformedPlayback = await request.get("/vodplay/1-2-%2F%2Fevil%2Eexample.html", { maxRedirects: 0 });
  expect(malformedPlayback.status()).not.toBe(301);
  expect(malformedPlayback.headers().location).toBeUndefined();

  const legacyPlaybackPost = await request.post("/index.php/vod/play/id/1/sid/2/nid/3.html", { maxRedirects: 0 });
  expect(legacyPlaybackPost.status()).toBe(200);
  expect(legacyPlaybackPost.headers()["content-type"]).toContain("text/html");

  for (const path of ["/index.php/actor/detail/id/1.html", "/register", "/forgot-password", "/index.php/user/reg.html", "/index.php/user/findpass.html"]) {
    const retired = await request.get(path, { maxRedirects: 0 });
    expect(retired.status()).toBe(410);
    expect(await retired.text()).toBe("Gone");
  }
});

test("clean content routes refresh and anonymous history stays in the browser", async ({ page }) => {
  await blockExternalResources(page);
  const browserErrors = observeBrowserErrors(page);
  const routes = [
    ["/", "平方影视首页"],
    ["/videos", "影片库"],
    ["/category/42", "电影"],
    ["/search?wd=云端", "云端"],
    ["/vod/1", "云端回声"],
    ["/watch/1/1/101", "云端回声 - 正片"],
    ["/trial/1/1/101", "云端回声 - 正片"],
    ["/history", "本地时间轴"]
  ];

  for (const [path, heading] of routes) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    expect(page.url()).not.toContain("index.php");
  }

  await page.evaluate(() => {
    window.localStorage.setItem(
      "pingfang_history",
      JSON.stringify([
        {
          id: "1",
          name: "云端回声",
          url: "/watch/1/1/101",
          progress: "正片 · 已看到 10:00",
          positionSeconds: 600,
          durationSeconds: 1200,
          time: "2026-07-24T10:00:00Z"
        }
      ])
    );
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "继续观看" })).toBeVisible();
  await expect(page.locator(".home-continue-card").first()).toHaveAttribute("href", "/watch/1/1/101");
  await expect(page.getByRole("progressbar", { name: "云端回声观看进度 50%" })).toHaveAttribute("aria-valuenow", "50");
  await expect(page.getByText("剩余 10 分钟")).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test("catalog filters, playback completion and system routes keep their behavior", async ({ page }) => {
  await blockExternalResources(page);
  const browserErrors = observeBrowserErrors(page);

  await page.goto("/videos");
  const sortRow = page.locator(".filter-row").filter({ hasText: "排序" });
  await sortRow.getByRole("link", { name: "最热", exact: true }).click();
  await expect(page).toHaveURL(/\/videos\?sort=hot$/);
  await expect(page.getByText(/按最热排序/)).toBeVisible();

  await page.goto("/watch/2/1/201");
  await expect(page.getByRole("button", { name: "自动连播：开" })).toHaveAttribute("aria-pressed", "true");
  await page.locator(".player-shell video").dispatchEvent("ended");
  await expect(page).toHaveURL(/\/watch\/2\/1\/202$/);

  await page.goto("/status?title=安全跳转&to=https%3A%2F%2Fevil.example&delay=2");
  await expect(page.getByRole("heading", { name: "系统提示" })).toBeVisible();
  await expect(page.getByRole("link", { name: "立即前往" })).toHaveAttribute("href", "/");
  await page.getByRole("button", { name: "取消自动跳转" }).click();
  await expect(page.getByText(/秒后安全跳转/)).toHaveCount(0);

  const notFoundResponse = await page.goto("/this-route-does-not-exist");
  expect(notFoundResponse?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "页面不存在" })).toBeVisible();
  expect(browserErrors.filter((error) => !error.includes("status of 404"))).toEqual([]);
});

test("detail poster matches the desktop panel height without manual rating controls", async ({ page }) => {
  await blockExternalResources(page);
  const browserErrors = observeBrowserErrors(page);

  for (const width of [761, 920, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/vod/1");
    await expect(page.getByRole("heading", { name: "云端回声", exact: true })).toBeVisible();
    await expect(page.getByText(/检测完成：1\/1 条已检测线路可用；推荐 测试线路/)).toBeVisible();
    await expect(page.locator(".source-quality-result")).toContainText("推荐 · 可用");
    await expect(page.locator(".score-summary")).toContainText("评分8.8");
    await expect(page.locator(".detail-poster")).toHaveClass(/is-image-missing/);
    expect(await page.locator(".detail-poster").evaluate((element) => getComputedStyle(element).backgroundImage)).toContain("lazyload.png");
    await expect(page.getByText("我的评分", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "评分", exact: true })).toHaveCount(0);

    const poster = await page.locator(".detail-poster").boundingBox();
    const panel = await page.locator(".detail-panel").boundingBox();
    expect(poster).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(Math.abs((poster?.height ?? 0) - (panel?.height ?? 0))).toBeLessThanOrEqual(1);
    await expectNoOverflow(page);

    if (width === 920) {
      await page.locator(".detail-panel > *").evaluateAll((elements) => elements.forEach((element) => element.setAttribute("hidden", "")));
      const compactPoster = await page.locator(".detail-poster").boundingBox();
      const compactPanel = await page.locator(".detail-panel").boundingBox();
      expect(Math.abs((compactPoster?.height ?? 0) - (compactPanel?.height ?? 0))).toBeLessThanOrEqual(1);
    }
  }

  for (const width of [390, 760]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/vod/1");
    await expect(page.getByRole("heading", { name: "云端回声", exact: true })).toBeVisible();
    const poster = await page.locator(".detail-poster").boundingBox();
    expect(poster).not.toBeNull();
    expect(Math.abs((poster?.height ?? 0) / (poster?.width ?? 1) - 1.5)).toBeLessThanOrEqual(0.01);
    await expectNoOverflow(page);
  }

  expect(browserErrors).toEqual([]);
});

test("Pixel Frog persists and member games keep guest runtimes gated", async ({ page }) => {
  await blockExternalResources(page);
  const browserErrors = observeBrowserErrors(page);

  await page.goto("/");
  await page.getByRole("button", { name: "主题" }).click();
  await page.getByRole("button", { name: "像素蛙" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "pixel-frog");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "pixel-frog");

  await page.goto("/games/gomoku?room=ABC234");
  await expect(page.getByRole("heading", { name: "登录后才能联机对弈" })).toBeVisible();
  await expect(page.getByTitle("联机五子棋游戏区域")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "前往登录" })).toHaveAttribute("href", "/login?from=%2Fgames%2Fgomoku%3Froom%3DABC234");

  await page.goto("/login?from=%2Fgames%2F2048");
  await page.getByLabel("账号").fill("demo");
  await page.locator('input[name="password"]').fill("demo123");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/games\/2048$/);
  await expect(page.getByTitle("2048游戏区域")).toBeVisible();
  await expect(page.locator('iframe[data-game-runtime="2048"]')).toHaveAttribute("sandbox", /allow-scripts/);
  expect(browserErrors).toEqual([]);
});

test("account writes cover selection, deletion, comments, devices and logout", async ({ page }) => {
  await blockExternalResources(page);
  const browserErrors = observeBrowserErrors(page);

  await page.goto("/login");
  await page.getByLabel("账号").fill("demo");
  await page.locator('input[name="password"]').fill("demo123");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.goto("/vod/1");
  await page.getByRole("button", { name: "收藏", exact: true }).click();
  await expect(page.getByRole("button", { name: "已收藏", exact: true })).toBeDisabled();
  await page.goto("/account/favorites");
  await page.getByLabel("选择收藏记录 云端回声").check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除选中" }).click();
  await expect(page.getByText("还没有收藏", { exact: true })).toBeVisible();

  const historyResult = await page.evaluate(async () => {
    const session = await fetch("/react-api.php?action=session").then((response) => response.json());
    const response = await fetch("/react-api.php?action=history.save", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": session.data.csrfToken },
      body: JSON.stringify({
        vodId: "1",
        sourceId: "1",
        episodeId: "101",
        positionSeconds: 42,
        durationSeconds: 120,
        checkpointAtMs: Date.now()
      })
    });
    const playback = await fetch("/react-api.php?action=playback&vod_id=1&source_id=1&episode_id=101").then((result) => result.json());
    return { status: response.status, resumePositionSeconds: playback.data.resumePositionSeconds };
  });
  expect(historyResult).toEqual({ status: 200, resumePositionSeconds: 42 });
  await page.goto("/account/history");
  await page.getByLabel("选择播放记录 云端回声").check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除选中" }).click();
  await expect(page.getByText("暂无播放记录", { exact: true })).toBeVisible();

  await page.goto("/comments/1/1");
  await page.getByLabel("评论内容").fill("React E2E 评论");
  await page.getByRole("button", { name: "提交评论" }).click();
  await expect(page.getByText("React E2E 评论", { exact: true })).toBeVisible();

  await page.goto("/account/devices");
  const revoke = page.getByRole("button", { name: "撤销" });
  await expect(revoke).toHaveCount(1);
  const before = await page.locator(".device-card").count();
  page.once("dialog", (dialog) => dialog.accept());
  await revoke.click();
  await expect(page.locator(".device-card")).toHaveCount(before - 1);

  await page.goto("/account");
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?from=%2Faccount$/);
  expect(browserErrors).toEqual([]);
});

test("responsive boundaries keep navigation usable without horizontal overflow", async ({ page }) => {
  await blockExternalResources(page);
  const browserErrors = observeBrowserErrors(page);
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.setItem(
      "pingfang_history",
      JSON.stringify([
        {
          id: "1",
          name: "响应式续播记录",
          url: "/watch/1/1/101",
          progress: "正片 · 已看到 10:00",
          positionSeconds: 600,
          durationSeconds: 1200,
          time: "2026-07-24T10:00:00Z"
        }
      ])
    );
  });

  for (const width of [320, 390, 1100, 1180, 1181, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "平方影视首页" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "响应式续播记录观看进度 50%" })).toBeVisible();
    await expectNoOverflow(page);
    await page.goto("/videos");
    await expect(page.getByRole("heading", { name: "影片库" })).toBeVisible();
    await expectNoOverflow(page);

    if (width <= 390) {
      await page.getByRole("button", { name: "展开导航" }).click();
      await expect(page.getByRole("dialog", { name: "分类导航" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "展开导航" })).toHaveAttribute("aria-expanded", "false");
    }
  }

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/games");
    await expect(page.getByRole("heading", { name: "登录后开启游戏大厅" })).toBeVisible();
    await expectNoOverflow(page);
  }

  expect(browserErrors).toEqual([]);
});
