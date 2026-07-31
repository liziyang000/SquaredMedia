import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoutingProvider, SearchParamsProvider, TestRoutingProvider, useLocation, useNavigate, useParams, useSearchParams } from "./routing";

const nextNavigation = vi.hoisted(() => ({
  params: {} as Record<string, string | string[]>,
  pathname: "/",
  push: vi.fn(),
  replace: vi.fn(),
  searchParams: vi.fn(() => new URLSearchParams())
}));

vi.mock("next/navigation", () => ({
  useParams: () => nextNavigation.params,
  usePathname: () => nextNavigation.pathname,
  useRouter: () => ({ push: nextNavigation.push, replace: nextNavigation.replace }),
  useSearchParams: nextNavigation.searchParams
}));

function RouteSnapshot({ seen }: { seen?: string[] }) {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const params = useParams();
  const value = [location.pathname, params.vodId ?? "", searchParams.get("filter") ?? "", (location.state as { from?: string } | null)?.from ?? ""].join("|");
  seen?.push(value);
  return <output data-testid="route-snapshot">{value}</output>;
}

function RouteIdentity() {
  const location = useLocation();
  const params = useParams();
  return (
    <output data-testid="route-identity">
      {location.pathname}|{params.vodId ?? ""}
    </output>
  );
}

function NavigationProbe({ seen }: { seen?: string[] }) {
  const navigate = useNavigate();
  return (
    <>
      <RouteSnapshot seen={seen} />
      <button type="button" onClick={() => navigate("/login?filter=two", { replace: true, state: { from: "/account?page=2" } })}>
        更新查询参数
      </button>
    </>
  );
}

describe("RoutingProvider", () => {
  afterEach(cleanup);

  beforeEach(() => {
    nextNavigation.params = {};
    nextNavigation.pathname = "/";
    nextNavigation.push.mockReset();
    nextNavigation.replace.mockReset();
    nextNavigation.searchParams.mockReset();
    nextNavigation.searchParams.mockImplementation(() => new URLSearchParams(window.location.search));
    window.history.replaceState(null, "", "/");
  });

  it("根 RoutingProvider 不读取查询参数，避免扩大 CSR bailout 边界", () => {
    render(
      <RoutingProvider>
        <RouteIdentity />
      </RoutingProvider>
    );

    expect(screen.getByTestId("route-identity")).toHaveTextContent("/|");
    expect(nextNavigation.searchParams).not.toHaveBeenCalled();
  });

  it("由局部 SearchParamsProvider 原子提供查询参数与安全回跳地址", () => {
    nextNavigation.pathname = "/login";
    nextNavigation.params = { vodId: "7" };
    window.history.replaceState(null, "", "/login?filter=recent&from=%2Faccount%2Fdevices%3Ftab%3Dactive");

    const seen: string[] = [];
    render(
      <RoutingProvider>
        <SearchParamsProvider>
          <RouteSnapshot seen={seen} />
        </SearchParamsProvider>
      </RoutingProvider>
    );

    expect(screen.getByTestId("route-snapshot")).toHaveTextContent("/login|7|recent|/account/devices?tab=active");
    expect(seen[0]).toBe("/login|7|recent|/account/devices?tab=active");
    expect(nextNavigation.searchParams).toHaveBeenCalledOnce();
  });

  it("只在 Next 提交新查询参数后向消费者发布新快照", async () => {
    nextNavigation.pathname = "/login";
    window.history.replaceState(null, "", "/login?filter=one");
    nextNavigation.replace.mockImplementation((target: string) => {
      window.history.replaceState(null, "", target);
    });

    const seen: string[] = [];
    const view = render(
      <RoutingProvider>
        <SearchParamsProvider>
          <NavigationProbe seen={seen} />
        </SearchParamsProvider>
      </RoutingProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "更新查询参数" }));
    expect(screen.getByTestId("route-snapshot")).toHaveTextContent("/login||one|");
    const previousRenderCount = seen.length;
    view.rerender(
      <RoutingProvider>
        <SearchParamsProvider>
          <NavigationProbe seen={seen} />
        </SearchParamsProvider>
      </RoutingProvider>
    );

    await waitFor(() => expect(screen.getByTestId("route-snapshot")).toHaveTextContent("/login||two|/account?page=2"));
    expect(seen[previousRenderCount]).toBe("/login||two|/account?page=2");
    expect(nextNavigation.replace).toHaveBeenCalledWith("/login?filter=two&from=%2Faccount%3Fpage%3D2");
  });

  it("保留 TestRoutingProvider 的 query、params 与显式导航 state 语义", async () => {
    render(
      <TestRoutingProvider href="/login?filter=one" params={{ vodId: "7" }}>
        <NavigationProbe />
      </TestRoutingProvider>
    );

    expect(screen.getByTestId("route-snapshot")).toHaveTextContent("/login|7|one|");
    fireEvent.click(screen.getByRole("button", { name: "更新查询参数" }));

    await waitFor(() => expect(screen.getByTestId("route-snapshot")).toHaveTextContent("/login|7|two|/account?page=2"));
  });
});
