import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "../app/AppShell";
import { TestRoutingProvider } from "../app/routing";
import { QixiPage } from "./QixiPage";

describe("QixiPage", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the master particle rose in an immersive isolated frame", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL) =>
        ({
          ok: true,
          status: 200,
          async json() {
            return { code: 1, msg: "ok", data: { authenticated: false, user: null, csrfToken: "test-csrf-token" } };
          }
        }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <TestRoutingProvider href="/qixi">
          <AppShell>
            <QixiPage />
          </AppShell>
        </TestRoutingProvider>
      </QueryClientProvider>
    );

    const iframe = screen.getByTitle("七夕粒子玫瑰花束");
    const srcDoc = iframe.getAttribute("srcdoc") || "";
    expect(srcDoc).toContain('class="qixi-immersive"');
    expect(srcDoc).toContain("今晚，把银河");
    expect(srcDoc).toContain("window.PingFangQixiShareUrl = window.parent.location.href");
    expect(srcDoc).toContain("/template/pingfangvideo/js/qixi-particle-rose.js");
    expect(iframe).toHaveAttribute("sandbox", expect.stringContaining("allow-scripts"));
    expect(screen.queryByRole("navigation", { name: "主导航" })).not.toBeInTheDocument();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("action=session");
  });
});
