import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultAccountRequirements } from "../api/account";
import { AccountProvider } from "../app/AccountContext";
import { TestRoutingProvider, useSearchParams } from "../app/routing";
import { Game2048Page, GameBlockrainPage, GameDrawguessPage, GameGomokuPage, GamesPage } from "./GamesPages";

function sessionResponse(authenticated: boolean) {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        code: 1,
        msg: "ok",
        data: {
          authenticated,
          csrfToken: "test-csrf-token",
          user: authenticated ? { id: "1", name: "测试会员" } : null,
          requirements: defaultAccountRequirements
        }
      };
    }
  } as Response;
}

function RouteRoom() {
  const [searchParams] = useSearchParams();
  return <output data-testid="route-room">{searchParams.get("room") || ""}</output>;
}

function renderPage(page: React.ReactNode, href: string, authenticated: boolean) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const fetchMock = vi.fn(async (_input: RequestInfo | URL) => sessionResponse(authenticated));
  vi.stubGlobal("fetch", fetchMock);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <TestRoutingProvider href={href}>
        <AccountProvider>
          {page}
          <RouteRoom />
        </AccountProvider>
      </TestRoutingProvider>
    </QueryClientProvider>
  );
  return { ...view, fetchMock };
}

describe("React game pages", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the four-card member hub after authentication", async () => {
    renderPage(<GamesPage />, "/games", true);

    expect(await screen.findByRole("heading", { name: "片刻放松，随时开局" })).toBeInTheDocument();
    for (const title of ["2048", "俄罗斯方块", "五子棋", "你画我猜"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.getAllByRole("link", { name: /开始游戏|创建对局|创建房间/ })).toHaveLength(4);
    expect(screen.queryByTitle(/游戏区域$/)).not.toBeInTheDocument();
  });

  it.each([
    ["2048", <Game2048Page />],
    ["俄罗斯方块", <GameBlockrainPage />],
    ["联机五子棋", <GameGomokuPage />],
    ["联机你画我猜", <GameDrawguessPage />]
  ])("does not mount the %s runtime or request a ticket for guests", async (_title, page) => {
    const { fetchMock } = renderPage(page, "/games/gomoku?room=ABC234", false);

    expect(await screen.findByRole("heading", { name: /登录后/ })).toBeInTheDocument();
    expect(screen.queryByTitle(/游戏区域$/)).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes("gameTicket"))).toBe(false);
  });

  it("loads the vendored 2048 runtime only inside the authenticated iframe", async () => {
    renderPage(<Game2048Page />, "/games/2048", true);

    const iframe = await screen.findByTitle("2048游戏区域");
    const srcDoc = iframe.getAttribute("srcdoc") || "";
    expect(srcDoc).toContain("/template/pingfangvideo/games/2048/js/game_manager.js");
    expect(srcDoc).toContain("/template/pingfangvideo/games/2048/js/application.js");
    expect(srcDoc).not.toMatch(/<script[^>]+src=["']https?:/);
    expect(iframe).toHaveAttribute("sandbox", expect.stringContaining("allow-scripts"));
  });

  it("loads jQuery, Blockrain and its local initializer in dependency order", async () => {
    renderPage(<GameBlockrainPage />, "/games/blockrain", true);

    const srcDoc = (await screen.findByTitle("俄罗斯方块游戏区域")).getAttribute("srcdoc") || "";
    const jquery = srcDoc.indexOf("/template/pingfangvideo/games/blockrain/jquery-1.11.1.min.js");
    const blockrain = srcDoc.indexOf("/template/pingfangvideo/games/blockrain/blockrain.jquery.min.js");
    const initializer = srcDoc.indexOf("/template/pingfangvideo/games/init.js");
    expect(jquery).toBeGreaterThan(0);
    expect(blockrain).toBeGreaterThan(jquery);
    expect(initializer).toBeGreaterThan(blockrain);
  });

  it("bridges a validated multiplayer room to the parent route without rebuilding the iframe", async () => {
    renderPage(<GameGomokuPage />, "/games/gomoku?room=abc234", true);

    const iframe = (await screen.findByTitle("联机五子棋游戏区域")) as HTMLIFrameElement;
    const srcDoc = iframe.getAttribute("srcdoc") || "";
    expect(srcDoc).toContain('data-game-room="ABC234"');
    expect(srcDoc).toContain('data-game-ticket-endpoint="/index.php/pingfangdevice/gameTicket"');
    expect(srcDoc).toContain('data-game-parent-bridge="true"');
    expect(srcDoc).toContain('data-game-invite-base="/games/gomoku"');
    expect(srcDoc).toContain("/react-runtime/multiplayer-games.js");

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          source: iframe.contentWindow,
          origin: window.location.origin,
          data: { type: "pingfang:multiplayer-room", game: "gomoku", room: "XYZ789" }
        })
      );
    });

    await waitFor(() => expect(screen.getByTestId("route-room")).toHaveTextContent("XYZ789"));
    expect(iframe.getAttribute("srcdoc")).toBe(srcDoc);
  });

  it("preserves a validated invitation room through the login return path", async () => {
    renderPage(<GameGomokuPage />, "/games/gomoku?room=abc234", false);

    const login = await screen.findByRole("link", { name: "前往登录" });
    expect(login).toHaveAttribute("href", "/login?from=%2Fgames%2Fgomoku%3Froom%3DABC234");
  });

  it("ignores room messages from any window other than the mounted game iframe", async () => {
    renderPage(<GameDrawguessPage />, "/games/drawguess?room=ABC234", true);

    await screen.findByTitle("联机你画我猜游戏区域");
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          source: window,
          origin: window.location.origin,
          data: { type: "pingfang:multiplayer-room", game: "drawguess", room: "XYZ789" }
        })
      );
    });
    expect(screen.getByTestId("route-room")).toHaveTextContent("ABC234");
  });

  it("removes the parent message listener when the game iframe unmounts", async () => {
    const removeListener = vi.spyOn(window, "removeEventListener");
    const view = renderPage(<Game2048Page />, "/games/2048", true);
    await screen.findByTitle("2048游戏区域");

    view.unmount();

    expect(removeListener).toHaveBeenCalledWith("message", expect.any(Function));
  });
});
