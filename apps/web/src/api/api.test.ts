import { describe, expect, it } from "vitest";

import { ApiError, createMacCmsApi, requestJson } from "./index";
import { requireApiEndpoint } from "./schemas";

function jsonResponse(body: unknown, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    }
  } as Response;
}

describe("requestJson", () => {
  it("applies the shared same-origin JSON request policy", async () => {
    let captured: { url: string; init?: RequestInit } | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      captured = { url: String(input), init };
      return jsonResponse({ code: 1, data: { ready: true } });
    };

    const payload = await requestJson<{ code: number; data: { ready: boolean } }>("/api/example", { fetchImpl });

    expect(payload).toEqual({ code: 1, data: { ready: true } });
    expect(captured?.url).toBe("/api/example");
    expect(captured?.init?.credentials).toBe("same-origin");
    expect(new Headers(captured?.init?.headers).get("Accept")).toBe("application/json");
    expect(new Headers(captured?.init?.headers).get("X-Requested-With")).toBe("XMLHttpRequest");
  });

  it("converts HTTP and invalid JSON responses into ApiError", async () => {
    await expect(
      requestJson("/api/unavailable", {
        fetchImpl: async () => jsonResponse({ msg: "服务暂不可用" }, { ok: false, status: 503 })
      })
    ).rejects.toMatchObject({ kind: "http", status: 503, message: "服务暂不可用" });

    await expect(
      requestJson("/api/session", {
        fetchImpl: async () => jsonResponse({ code: 401, msg: "登录状态已失效", data: null }, { ok: false, status: 401 })
      })
    ).rejects.toMatchObject({ kind: "business", status: 401, code: 401, message: "登录状态已失效" });

    await expect(
      requestJson("/api/not-json", {
        fetchImpl: async () =>
          ({
            ok: true,
            status: 200,
            async json() {
              throw new SyntaxError("Unexpected token");
            }
          }) as unknown as Response
      })
    ).rejects.toMatchObject({ kind: "invalid-response" });
  });

  it("aborts requests that exceed the configured timeout", async () => {
    const fetchImpl = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      })) as typeof fetch;

    await expect(requestJson("/api/slow", { timeoutMs: 10, fetchImpl })).rejects.toMatchObject({ kind: "timeout" });
  });
});

describe("requireApiEndpoint", () => {
  it("accepts only same-site relative API paths", () => {
    expect(requireApiEndpoint("/index.php/pingfangapi/index")).toBe("/index.php/pingfangapi/index");
    expect(() => requireApiEndpoint("https://api.example.com/index.php")).toThrowError(ApiError);
    expect(() => requireApiEndpoint("//api.example.com/index.php")).toThrowError(ApiError);
    expect(() => requireApiEndpoint("index.php/pingfangapi/index")).toThrowError(ApiError);
  });
});

describe("createMacCmsApi", () => {
  it("wraps the existing login, logout, filter and device requests", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.startsWith("/api/vod/filters")) {
        return jsonResponse({ code: 1, data: { filters: { area: [{ value: "大陆", total: 10 }] } } });
      }
      return jsonResponse({ code: "1", msg: "操作成功", data: { accepted: true } });
    };
    const api = createMacCmsApi({
      endpoints: {
        login: "/api/auth/login",
        logout: "/api/auth/logout",
        vodFilters: "/api/vod/filters",
        revokeDevice: "/api/account/devices/revoke"
      },
      csrfToken: "csrf-token",
      fetchImpl
    });

    const loginForm = new FormData();
    loginForm.append("user_name", "demo");

    await expect(api.login(loginForm)).resolves.toEqual({ message: "操作成功", data: { accepted: true } });
    await expect(api.logout()).resolves.toEqual({ message: "操作成功", data: { accepted: true } });
    await expect(api.getVodFilters({ type_id: 42, area: "大陆", empty: "" })).resolves.toEqual({ area: [{ value: "大陆", total: 10 }] });
    await expect(api.revokeDevice("session-1")).resolves.toEqual({ message: "操作成功", data: { accepted: true } });

    expect(calls[0]).toMatchObject({ url: "/api/auth/login", init: { method: "POST", body: loginForm } });
    expect(new Headers(calls[0]?.init?.headers).get("X-CSRF-Token")).toBe("csrf-token");
    expect(calls[1]).toMatchObject({ url: "/api/auth/logout", init: { method: "POST" } });
    expect(new Headers(calls[1]?.init?.headers).get("X-CSRF-Token")).toBe("csrf-token");
    expect(calls[2]).toMatchObject({ url: "/api/vod/filters?type_id=42&area=%E5%A4%A7%E9%99%86", init: { method: "GET" } });
    const revokeBody = calls[3]?.init?.body;
    expect(revokeBody).toBeInstanceOf(FormData);
    expect((revokeBody as FormData).get("session_id")).toBe("session-1");
    expect(new Headers(calls[3]?.init?.headers).get("X-CSRF-Token")).toBe("csrf-token");
  });

  it("rejects business errors, invalid DTOs and missing endpoint configuration", async () => {
    const api = createMacCmsApi({
      endpoints: { logout: "/api/auth/logout", vodFilters: "/api/vod/filters" },
      csrfToken: "csrf-token",
      fetchImpl: async (input) => {
        if (String(input).includes("filters")) return jsonResponse({ code: 1, data: { filters: { area: [{ value: 7 }] } } });
        return jsonResponse({ code: 1004, msg: "登录状态已失效" });
      }
    });

    await expect(api.logout()).rejects.toMatchObject({ kind: "business", code: 1004, message: "登录状态已失效" });
    await expect(api.getVodFilters()).rejects.toMatchObject({ kind: "invalid-response" });
    await expect(api.login(new FormData())).rejects.toBeInstanceOf(ApiError);
    await expect(api.login(new FormData())).rejects.toMatchObject({ kind: "configuration" });

    const missingCsrfApi = createMacCmsApi({
      endpoints: { logout: "/api/auth/logout" },
      fetchImpl: async () => jsonResponse({ code: 1, data: null })
    });
    await expect(missingCsrfApi.logout()).rejects.toMatchObject({ kind: "configuration", message: "缺少 CSRF Token" });
  });
});
