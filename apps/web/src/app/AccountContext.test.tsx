import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountPage, DevicesPage, FavoritesPage } from "../screens/AccountPages";
import { TestRoutingProvider, useLocation } from "./routing";
import { AccountProvider, useAccount } from "./AccountContext";

function envelopeResponse(data: unknown, status = 200, message = "请求成功") {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return { code: status === 200 ? 1 : 1001, msg: message, data };
    }
  } as Response;
}

function sessionData(authenticated = true) {
  return {
    authenticated,
    user: authenticated ? { id: "7", name: "测试会员" } : null,
    csrfToken: "test-csrf-token"
  };
}

function actionFromRequest(input: RequestInfo | URL) {
  return new URL(String(input), "https://next.local").searchParams.get("action");
}

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

function SessionLocationProbe() {
  const account = useAccount();
  const location = useLocation();
  return (
    <output data-testid="session-location">
      {account.session.authenticated ? "authenticated" : "anonymous"}|{location.pathname}|{(location.state as { from?: string } | null)?.from ?? ""}
    </output>
  );
}

describe("AccountProvider session consistency", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("removes private account data and resets permission-scoped data when the session changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => envelopeResponse(sessionData(false)))
    );
    const queryClient = createQueryClient();
    const scopedQueries = [["home", "v2"], ["navigation"], ["content", { page: 1 }], ["content-detail", "7"], ["playback", "7", "1", "1"]] as const;
    scopedQueries.forEach((queryKey) => queryClient.setQueryData(queryKey, { stale: true }));
    queryClient.setQueryData(["account", "favorites"], ["old-favorite"]);
    queryClient.setQueryData(["comments", "7"], ["keep-comment"]);

    let invalidateAccountData: (() => Promise<void>) | undefined;
    function Consumer() {
      invalidateAccountData = useAccount().invalidateAccountData;
      return null;
    }

    render(
      <QueryClientProvider client={queryClient}>
        <AccountProvider>
          <Consumer />
        </AccountProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(invalidateAccountData).toBeTypeOf("function"));
    await act(async () => invalidateAccountData!());

    scopedQueries.forEach((queryKey) => expect(queryClient.getQueryData(queryKey)).toBeUndefined());
    expect(queryClient.getQueryState(["account", "favorites"])).toBeUndefined();
    expect(queryClient.getQueryData(["comments", "7"])).toEqual(["keep-comment"]);
  });

  it("adopts an anonymous session immediately after logout even when the follow-up refresh fails", async () => {
    let sessionRequests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const action = actionFromRequest(input);
        if (action === "session") {
          sessionRequests += 1;
          if (sessionRequests === 1) return envelopeResponse(sessionData());
          return envelopeResponse(null, 500, "会话刷新失败");
        }
        if (action === "logout") return envelopeResponse({ authenticated: false });
        throw new Error(`未处理的接口：${action}`);
      })
    );
    const queryClient = createQueryClient();
    queryClient.setQueryData(["account", "favorites"], ["private-favorite"]);

    render(
      <QueryClientProvider client={queryClient}>
        <TestRoutingProvider href="/account">
          <AccountProvider>
            <AccountPage />
            <SessionLocationProbe />
          </AccountProvider>
        </TestRoutingProvider>
      </QueryClientProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: "退出登录" }));

    await waitFor(() => expect(screen.getByTestId("session-location")).toHaveTextContent("anonymous|/login|"));
    await waitFor(() => expect(sessionRequests).toBe(2));
    expect(screen.getByTestId("session-location")).toHaveTextContent("anonymous|/login|");
    expect(queryClient.getQueryState(["account", "favorites"])).toBeUndefined();
  });

  it("turns a protected account request 401 into an anonymous session and preserves return-to", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const action = actionFromRequest(input);
        if (action === "session") return envelopeResponse(sessionData());
        if (action === "favorites") return envelopeResponse(null, 401, "登录状态已失效");
        throw new Error(`未处理的接口：${action}`);
      })
    );
    const queryClient = createQueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <TestRoutingProvider href="/account/favorites">
          <AccountProvider>
            <FavoritesPage />
            <SessionLocationProbe />
          </AccountProvider>
        </TestRoutingProvider>
      </QueryClientProvider>
    );

    await waitFor(() => expect(screen.getByTestId("session-location")).toHaveTextContent("anonymous|/login|/account/favorites"));
  });

  it("does not treat a login 401 as a global session-expiry event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const action = actionFromRequest(input);
        if (action === "session") return envelopeResponse(sessionData());
        if (action === "login") return envelopeResponse(null, 401, "用户名或密码错误");
        throw new Error(`未处理的接口：${action}`);
      })
    );
    const queryClient = createQueryClient();
    let account: ReturnType<typeof useAccount> | undefined;
    function Consumer() {
      account = useAccount();
      return <output>{account.session.authenticated ? "authenticated" : "anonymous"}</output>;
    }

    render(
      <QueryClientProvider client={queryClient}>
        <AccountProvider>
          <Consumer />
        </AccountProvider>
      </QueryClientProvider>
    );

    await screen.findByText("authenticated");
    await act(async () => {
      await expect(account!.api.login({ username: "wrong", password: "wrong" })).rejects.toMatchObject({ status: 401 });
    });
    expect(screen.getByText("authenticated")).toBeInTheDocument();
  });

  it("renders the complete device contract and only offers revocation for eligible sessions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const action = actionFromRequest(input);
        if (action === "session") return envelopeResponse(sessionData());
        if (action === "devices") {
          return envelopeResponse({
            maxDevices: 3,
            items: [
              {
                sessionId: "current",
                name: "当前电脑",
                browser: "Chrome",
                os: "macOS",
                loginAt: "2026-07-20 10:00:00",
                lastActiveAt: "2026-07-22 16:00:00",
                ipAddress: "127.0.0.1",
                userAgent: "Chrome Test",
                status: "在线",
                revokedAt: null,
                current: true
              },
              {
                sessionId: "revoked",
                name: "旧手机",
                browser: "Safari",
                os: "iOS",
                loginAt: "2026-07-01 10:00:00",
                lastActiveAt: "2026-07-02 10:00:00",
                ipAddress: "10.0.0.2",
                userAgent: "Mobile Safari Test",
                status: "已撤销",
                revokedAt: "2026-07-03 10:00:00",
                current: false
              },
              {
                sessionId: "eligible",
                name: "平板",
                browser: "Chrome",
                os: "Android",
                loginAt: "2026-07-10 10:00:00",
                lastActiveAt: "2026-07-11 10:00:00",
                ipAddress: "10.0.0.3",
                userAgent: "Chrome Android Test",
                status: "已过期",
                revokedAt: null,
                current: false
              }
            ]
          });
        }
        throw new Error(`未处理的接口：${action}`);
      })
    );

    render(
      <QueryClientProvider client={createQueryClient()}>
        <TestRoutingProvider href="/account/devices">
          <AccountProvider>
            <DevicesPage />
          </AccountProvider>
        </TestRoutingProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByText("当前账号最多允许 3 台设备同时登录")).toBeInTheDocument();
    expect(screen.getByText("IP：127.0.0.1")).toBeInTheDocument();
    expect(screen.getByText("客户端：Mobile Safari Test")).toBeInTheDocument();
    expect(screen.getByText("撤销时间：2026-07-03 10:00:00")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "撤销" })).toHaveLength(1);
  });
});
