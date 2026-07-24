import { describe, expect, it } from "vitest";

import * as apiExports from "./index";
import { ApiError, requestJson } from "./index";
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

describe("API public surface", () => {
  it("does not expose a parallel direct MacCMS client", () => {
    expect(apiExports).not.toHaveProperty("createMacCmsApi");
  });
});
