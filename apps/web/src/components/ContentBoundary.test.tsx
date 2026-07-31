import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ContentApi, ContentData } from "../api/content";
import { ContentBoundary } from "./ContentBoundary";

const content: ContentData = {
  siteName: "平方影视",
  categories: [],
  categoryContext: { current: null, parent: null, children: [] },
  facets: { areas: [], years: [], langs: [], classes: [] },
  videos: [],
  total: 0,
  page: 1,
  totalPages: 0
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("ContentBoundary", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows progress while data is pending, then renders the result immediately", async () => {
    const response = deferred<ContentData>();
    const api = {
      getContent: vi.fn(() => response.promise)
    } as unknown as ContentApi;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ContentBoundary api={api} request={{ includeFacets: true }}>
          {(data) => <div>已展示 {data.siteName}</div>}
        </ContentBoundary>
      </QueryClientProvider>
    );

    expect(screen.getByRole("status")).toHaveTextContent("正在加载内容");
    expect(container.querySelector(".loading-status-shell")).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector(".loading-status-orbit")).toBeInTheDocument();
    expect(screen.getByText("连接片库")).toBeInTheDocument();
    expect(screen.queryByText("已展示 平方影视")).not.toBeInTheDocument();

    response.resolve(content);

    expect(await screen.findByText("已展示 平方影视")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("内容加载完成");
    expect(container.querySelector(".loading-status-shell")).not.toBeInTheDocument();
  });

  it("does not insert a second ready state after content resolves", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(
        (query: string) =>
          ({
            matches: query.includes("no-preference"),
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

    const api = { getContent: vi.fn(async () => content) } as unknown as ContentApi;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ContentBoundary api={api}>{(data) => <div>已展示 {data.siteName}</div>}</ContentBoundary>
      </QueryClientProvider>
    );

    expect(await screen.findByText("已展示 平方影视")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("内容加载完成");
    expect(container.querySelector(".loading-status-panel.is-ready")).not.toBeInTheDocument();
  });
});
