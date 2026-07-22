import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function blockExternalResources(page: Page) {
  await page.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith("http://127.0.0.1:5173") || url.startsWith("data:")) await route.continue();
    else await route.abort("blockedbyclient");
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
  const legacy = await request.get("/index.php/vod/play/id/1/sid/2/nid/3.html", { maxRedirects: 0 });
  expect(legacy.status()).toBe(301);
  expect(new URL(legacy.headers().location, "http://127.0.0.1:5173").pathname).toBe("/watch/1/2/3");

  for (const path of ["/index.php/actor/detail/id/1.html", "/register", "/forgot-password", "/index.php/user/reg.html", "/index.php/user/findpass.html"]) {
    const retired = await request.get(path, { maxRedirects: 0 });
    expect(retired.status()).toBe(410);
    expect(await retired.text()).toBe("Gone");
  }

  const write = await request.post("/index.php/vod/play/id/1/sid/2/nid/3.html", {
    data: {},
    maxRedirects: 0
  });
  expect([301, 410]).not.toContain(write.status());
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

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "继续观看" })).toBeVisible();
  await expect(page.locator(".home-continue-card").first()).toHaveAttribute("href", "/watch/1/1/101");
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

  const historyStatus = await page.evaluate(async () => {
    const session = await fetch("/react-api.php?action=session").then((response) => response.json());
    const response = await fetch("/react-api.php?action=history.save", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": session.data.csrfToken },
      body: JSON.stringify({ vodId: "1", sourceId: "1", episodeId: "101", positionSeconds: 42, durationSeconds: 120 })
    });
    return response.status;
  });
  expect(historyStatus).toBe(200);
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

  for (const width of [320, 390, 1100, 1180, 1181, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "平方影视首页" })).toBeVisible();
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

  expect(browserErrors).toEqual([]);
});
