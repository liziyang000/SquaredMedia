import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultAccountRequirements } from "../api/account";
import { AccountProvider } from "../app/AccountContext";
import { TestRoutingProvider } from "../app/routing";
import { CommentsPage, FeedbackPage } from "./InteractionPages";

function envelopeResponse(data: unknown, message = "请求成功") {
  return {
    ok: true,
    status: 200,
    async json() {
      return { code: 1, msg: message, data };
    }
  } as Response;
}

function actionFromRequest(input: RequestInfo | URL) {
  return new URL(String(input), "https://next.local").searchParams.get("action");
}

function sessionData(requirements: Partial<typeof defaultAccountRequirements> = {}) {
  return {
    authenticated: false,
    user: null,
    csrfToken: "test-csrf-token",
    requirements: { ...defaultAccountRequirements, ...requirements }
  };
}

function renderPage(page: React.ReactNode, href: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TestRoutingProvider href={href} params={href.startsWith("/comments") ? { id: "7", mid: "1" } : {}}>
        <AccountProvider>{page}</AccountProvider>
      </TestRoutingProvider>
    </QueryClientProvider>
  );
}

describe("interaction switches and audit messages", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not render a feedback form when feedback is disabled", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (actionFromRequest(input) === "session") return envelopeResponse(sessionData({ feedbackEnabled: false }));
        throw new Error("关闭留言后不应请求提交接口");
      })
    );

    renderPage(<FeedbackPage />, "/feedback");

    expect(await screen.findByRole("heading", { name: "留言功能已关闭" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "提交留言" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("内容")).not.toBeInTheDocument();
  });

  it("does not request or render comments when comments are disabled", async () => {
    let commentsRequests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const action = actionFromRequest(input);
        if (action === "session") return envelopeResponse(sessionData({ commentEnabled: false }));
        if (action === "comments") {
          commentsRequests += 1;
          return envelopeResponse({ items: [] });
        }
        throw new Error(`未处理的接口：${action}`);
      })
    );

    renderPage(<CommentsPage />, "/comments/7");

    expect(await screen.findByRole("heading", { name: "评论功能已关闭" })).toBeInTheDocument();
    expect(commentsRequests).toBe(0);
    expect(screen.queryByLabelText("评论列表")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "提交评论" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("评论内容")).not.toBeInTheDocument();
  });

  it.each([
    ["pending", "留言已提交，审核通过后显示。"],
    ["published", "留言已发布。"]
  ])("uses the feedback submission status %s instead of a generic server message", async (status, expected) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const action = actionFromRequest(input);
        if (action === "session") return envelopeResponse(sessionData({ feedbackEnabled: true, feedbackAudit: true }));
        if (action === "feedback") return envelopeResponse({ id: 11, status }, "服务端通用提示");
        throw new Error(`未处理的接口：${action}`);
      })
    );

    renderPage(<FeedbackPage />, "/feedback");

    fireEvent.change(await screen.findByLabelText("内容"), { target: { value: "测试留言" } });
    expect(screen.getByText("后台已开启审核，提交后需管理员审核通过。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "提交留言" }));
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });

  it.each([
    ["pending", "评论已提交，审核通过后显示。"],
    ["published", "评论已发布。"]
  ])("uses the comment submission status %s instead of a generic server message", async (status, expected) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const action = actionFromRequest(input);
        if (action === "session") return envelopeResponse(sessionData({ commentEnabled: true, commentAudit: true }));
        if (action === "comments") return envelopeResponse({ items: [] });
        if (action === "comment") return envelopeResponse({ id: 13, status }, "服务端通用提示");
        throw new Error(`未处理的接口：${action}`);
      })
    );

    renderPage(<CommentsPage />, "/comments/7");

    fireEvent.change(await screen.findByLabelText("评论内容"), { target: { value: "测试评论" } });
    expect(screen.getByText("后台已开启审核，评论需管理员审核通过后显示。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "提交评论" }));
    expect(await screen.findByText(expected)).toBeInTheDocument();
  });
});
