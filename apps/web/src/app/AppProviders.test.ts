import { describe, expect, it } from "vitest";

import { ApiError } from "../api/http";
import { shouldRetryQuery } from "./AppProviders";

describe("query retry policy", () => {
  it("does not retry business or client errors", () => {
    expect(shouldRetryQuery(0, new ApiError("会员权限不足", { kind: "business", status: 403 }))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError("影片不存在", { kind: "http", status: 404 }))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError("参数错误", { kind: "validation" }))).toBe(false);
  });

  it("limits transient failures to two retries", () => {
    const networkError = new ApiError("网络错误", { kind: "network" });
    expect(shouldRetryQuery(0, networkError)).toBe(true);
    expect(shouldRetryQuery(1, networkError)).toBe(true);
    expect(shouldRetryQuery(2, networkError)).toBe(false);
    expect(shouldRetryQuery(0, new ApiError("服务错误", { kind: "http", status: 503 }))).toBe(true);
  });
});
