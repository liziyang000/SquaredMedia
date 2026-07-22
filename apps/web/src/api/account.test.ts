import { describe, expect, it, vi } from "vitest";

import { createAccountApi } from "./account";

function jsonResponse(body: unknown, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    }
  } as Response;
}

function responseFor(action: string | null) {
  const dataByAction: Record<string, unknown> = {
    session: {
      authenticated: true,
      csrfToken: "csrf-from-session",
      user: { id: 7, name: "测试用户", avatar: "/avatar.png", role: "administrator" },
      requirements: {
        loginCaptcha: true,
        feedbackLogin: true,
        feedbackEnabled: true,
        feedbackAudit: true,
        feedbackCaptcha: true,
        commentLogin: false,
        commentEnabled: true,
        commentAudit: true,
        commentCaptcha: true,
        captchaUrl: "/index.php/verify/index.html"
      }
    },
    login: {
      authenticated: true,
      csrfToken: "csrf-after-login",
      user: { id: 7, name: "测试用户", role: "administrator" }
    },
    "password.verify": { vodId: 1, scope: "detail", authorized: true },
    logout: { authenticated: false },
    favorites: {
      items: [
        {
          recordIds: [21],
          vodId: 1,
          title: "云端回声",
          poster: "/poster.jpg",
          remark: "高清",
          createdAt: "2026-06-15",
          url: "https://media.example.com/private.mp4"
        }
      ]
    },
    favorite: { vodId: 1, favorited: true },
    "favorites.delete": { removed: 2 },
    history: {
      items: [
        {
          recordIds: [31, 32],
          vodId: 1,
          sourceId: 1,
          episodeId: 101,
          title: "云端回声",
          episodeName: "正片",
          poster: "/poster.jpg",
          progress: "已看到 48:02",
          watchedAt: "2026-06-15 18:20",
          src: "https://media.example.com/private.mp4"
        }
      ]
    },
    "history.save": { saved: true },
    "history.delete": { removed: 1 },
    devices: {
      maxDevices: 3,
      items: [
        {
          sessionId: "session-1",
          name: "MacBook Pro",
          browser: "Chrome",
          os: "macOS",
          loginAt: "2026-06-15 18:00",
          lastActiveAt: "2026-06-15 18:20",
          ipAddress: "127.0.0.1",
          userAgent: "Chrome on macOS",
          status: "在线",
          revokedAt: null,
          current: true,
          token: "secret"
        }
      ]
    },
    "device.revoke": { sessionId: "session-2", revoked: true },
    feedback: { id: 11, status: "pending" },
    report: { id: 12, status: "pending" },
    comment: { id: 13, status: "published" },
    comments: {
      items: [
        {
          id: 31,
          parentId: null,
          author: "测试用户",
          content: "很好看",
          createdAt: "2026-06-15 19:20",
          likes: 3,
          dislikes: 0,
          internalUserId: 7
        }
      ]
    },
    reaction: { target: "vod", targetId: 1, value: "like", likes: 9, dislikes: 1 },
    rating: { vodId: 1, score: 9, average: 8.6, count: 120 }
  };

  return { code: 1, msg: `${action} ok`, data: dataByAction[action || ""] };
}

describe("createAccountApi reads", () => {
  it("parses session, favorites, history and devices through response whitelists", async () => {
    const calls: string[] = [];
    const api = createAccountApi({
      endpoint: "/react-api.php?locale=zh",
      fetchImpl: async (input) => {
        const value = String(input);
        calls.push(value);
        const action = new URL(value, "http://react-api.local").searchParams.get("action");
        return jsonResponse(responseFor(action));
      }
    });

    const session = await api.getSession();
    const favorites = await api.getFavorites();
    const history = await api.getHistory(4);
    const devices = await api.getDevices();
    const comments = await api.getComments(1, 1);

    expect(calls).toEqual([
      "/react-api.php?locale=zh&action=session",
      "/react-api.php?locale=zh&action=favorites",
      "/react-api.php?locale=zh&action=history&limit=4",
      "/react-api.php?locale=zh&action=devices",
      "/react-api.php?locale=zh&action=comments&mid=1&content_id=1"
    ]);
    expect(session.user).toEqual({ id: "7", name: "测试用户" });
    expect(session.requirements).toEqual({
      loginCaptcha: true,
      feedbackLogin: true,
      feedbackEnabled: true,
      feedbackAudit: true,
      feedbackCaptcha: true,
      commentLogin: false,
      commentEnabled: true,
      commentAudit: true,
      commentCaptcha: true,
      captchaUrl: "/index.php/verify/index.html"
    });
    expect(favorites[0]).not.toHaveProperty("url");
    expect(history[0]).not.toHaveProperty("src");
    expect(devices.maxDevices).toBe(3);
    expect(devices.items[0]).not.toHaveProperty("token");
    expect(comments).toEqual([{ id: "31", parentId: null, author: "测试用户", content: "很好看", createdAt: "2026-06-15 19:20", likes: 3, dislikes: 0 }]);
  });

  it("reuses the CSRF token returned by session bootstrap", async () => {
    let favoriteHeaders = new Headers();
    const api = createAccountApi({
      endpoint: "/react-api.php",
      fetchImpl: async (input, init) => {
        const action = new URL(String(input), "http://react-api.local").searchParams.get("action");
        if (action === "favorite") favoriteHeaders = new Headers(init?.headers);
        return jsonResponse(responseFor(action));
      }
    });

    await api.getSession();
    await api.setFavorite({ vodId: 1, favorite: true });

    expect(favoriteHeaders.get("X-CSRF-Token")).toBe("csrf-from-session");
  });
});

describe("createAccountApi writes", () => {
  it("adds CSRF to every write and sends only validated fields", async () => {
    const calls: Array<{ action: string; init?: RequestInit; body: Record<string, unknown> }> = [];
    const csrfToken = vi.fn(() => "csrf-123");
    const api = createAccountApi({
      endpoint: "/react-api.php",
      csrfToken,
      fetchImpl: async (input, init) => {
        const action = new URL(String(input), "http://react-api.local").searchParams.get("action") || "";
        calls.push({ action, init, body: JSON.parse(String(init?.body || "{}")) as Record<string, unknown> });
        return jsonResponse(responseFor(action));
      }
    });
    const loginInput = { username: " demo ", password: "secret", captcha: "1234", admin: true };

    await api.login(loginInput);
    await api.verifyContentPassword({ vodId: 1, scope: "detail", password: "content-secret" });
    await api.logout();
    await api.setFavorite({ vodId: 1, favorite: true });
    await api.deleteFavorites({ recordIds: [21, 22] });
    await api.saveHistory({ vodId: 1, sourceId: 1, episodeId: 101, positionSeconds: 30, durationSeconds: 120 });
    await api.deleteHistory({ all: true });
    await api.revokeDevice("session-2");
    await api.submitFeedback({ name: "访客", content: "建议内容" });
    await api.submitReport({ vodId: 1, sourceId: 1, episodeId: 101, reason: "无法播放", details: "播放器无响应", captcha: "5678" });
    await api.submitComment({ mid: 1, vodId: 1, content: "很好看" });
    await api.setReaction({ target: "vod", targetId: 1, value: "like" });
    await api.submitRating({ vodId: 1, score: 9 });

    expect(calls.map((call) => call.action)).toEqual([
      "login",
      "password.verify",
      "logout",
      "favorite",
      "favorites.delete",
      "history.save",
      "history.delete",
      "device.revoke",
      "feedback",
      "report",
      "comment",
      "reaction",
      "rating"
    ]);
    calls.forEach(({ init }) => {
      const headers = new Headers(init?.headers);
      expect(init?.method).toBe("POST");
      expect(headers.get("X-CSRF-Token")).toBe("csrf-123");
      expect(headers.get("Content-Type")).toBe("application/json");
    });
    expect(csrfToken).toHaveBeenCalledTimes(calls.length);
    expect(calls[0]?.body).toEqual({ username: "demo", password: "secret", captcha: "1234" });
    expect(calls[0]?.body).not.toHaveProperty("admin");
    expect(calls[1]?.body).toEqual({ vodId: "1", scope: "detail", password: "content-secret" });
    expect(calls[4]?.body).toEqual({ recordIds: ["21", "22"] });
    expect(calls[5]?.body).toEqual({ vodId: "1", sourceId: "1", episodeId: "101", positionSeconds: 30, durationSeconds: 120 });
    expect(calls[6]?.body).toEqual({ all: true });
  });

  it("rejects missing configuration, missing CSRF, invalid input and business failures", async () => {
    await expect(createAccountApi().getSession()).rejects.toMatchObject({ kind: "configuration" });

    const fetchImpl = vi.fn(async () => jsonResponse(responseFor("logout")));
    const noCsrfApi = createAccountApi({ endpoint: "/react-api.php", fetchImpl });
    await expect(noCsrfApi.logout()).rejects.toMatchObject({ kind: "configuration", message: "缺少 CSRF Token" });
    expect(fetchImpl).not.toHaveBeenCalled();

    const invalidApi = createAccountApi({ endpoint: "/react-api.php", csrfToken: "csrf", fetchImpl });
    await expect(invalidApi.submitRating({ vodId: 1, score: 11 })).rejects.toMatchObject({ kind: "validation" });
    await expect(invalidApi.deleteFavorites({ recordIds: [] })).rejects.toMatchObject({ kind: "validation" });
    await expect(invalidApi.deleteFavorites({ all: true, recordIds: [21] })).rejects.toMatchObject({ kind: "validation" });
    await expect(invalidApi.revokeDevice(" ")).rejects.toMatchObject({ kind: "validation" });
    await expect(invalidApi.submitReport({ sourceId: 1, episodeId: 2, reason: "无法播放" })).rejects.toMatchObject({ kind: "validation" });
    expect(fetchImpl).not.toHaveBeenCalled();

    const deniedApi = createAccountApi({
      endpoint: "/react-api.php",
      csrfToken: "csrf",
      fetchImpl: async () => jsonResponse({ code: 401, msg: "登录状态已失效", data: null }, { ok: false, status: 401 })
    });
    await expect(deniedApi.setFavorite({ vodId: 1, favorite: true })).rejects.toMatchObject({
      kind: "business",
      status: 401,
      code: 401,
      message: "登录状态已失效"
    });
  });

  it("allows the legacy direct report form without a video id", async () => {
    let body: unknown;
    const api = createAccountApi({
      endpoint: "/react-api.php",
      csrfToken: "csrf",
      fetchImpl: async (_input, init) => {
        body = JSON.parse(String(init?.body || "{}"));
        return jsonResponse(responseFor("report"));
      }
    });

    await api.submitReport({ reason: "其他", details: "旧报错地址直接提交" });

    expect(body).toEqual({ reason: "其他", details: "旧报错地址直接提交" });
  });
});
