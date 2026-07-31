import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TestRoutingProvider } from "../app/routing";
import { SiteHeader } from "./SiteHeader";

function renderHeader() {
  return render(
    <TestRoutingProvider href="/">
      <SiteHeader siteName="平方影视" categories={[{ id: "42", name: "电影" }]} />
    </TestRoutingProvider>
  );
}

describe("SiteHeader themes", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.documentElement.classList.remove("theme-transitioning");
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(
        (query: string) =>
          ({
            matches: false,
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
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      })
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    cleanup();
    delete document.documentElement.dataset.theme;
    document.documentElement.classList.remove("theme-transitioning");
    document.querySelectorAll(".pixel-edge-particles").forEach((canvas) => canvas.remove());
    document.querySelector<HTMLScriptElement>("#pixel-theme-confetti-script")?.dispatchEvent(new Event("error"));
    document.querySelector("#pixel-theme-confetti-script")?.remove();
    delete (window as Window & { confetti?: unknown }).confetti;
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("offers, applies, and restores the Dunhuang caisson theme", async () => {
    const firstRender = renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    fireEvent.click(screen.getByRole("button", { name: "敦煌流光" }));

    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "dunhuang-caisson"));
    expect(localStorage.getItem("pingfang_theme")).toBe("dunhuang-caisson");

    firstRender.unmount();
    renderHeader();

    await waitFor(() => expect(screen.getAllByRole("button", { name: "敦煌流光", hidden: true })[0]).toHaveAttribute("aria-pressed", "true"));
    expect(document.documentElement).toHaveAttribute("data-theme", "dunhuang-caisson");
  });

  it("offers, applies, animates, and restores the Pixel Frog theme", async () => {
    const emitter = Object.assign(vi.fn(), { reset: vi.fn() });
    const create = vi.fn(() => emitter);
    (window as Window & { confetti?: { create: typeof create } }).confetti = { create };
    const firstRender = renderHeader();
    const pixelOptions = screen.getAllByRole("button", { name: "像素蛙", hidden: true });

    expect(pixelOptions).toHaveLength(2);
    pixelOptions.forEach((option) => expect(option).toHaveAttribute("data-theme-option", "pixel-frog"));
    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    fireEvent.click(screen.getByRole("button", { name: "像素蛙" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "pixel-frog");
    expect(document.documentElement).toHaveClass("theme-transitioning");
    expect(localStorage.getItem("pingfang_theme")).toBe("pixel-frog");
    expect(create).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".pixel-edge-particles")).toBeInTheDocument();

    firstRender.unmount();
    renderHeader();

    await waitFor(() => expect(screen.getAllByRole("button", { name: "像素蛙", hidden: true })[0]).toHaveAttribute("aria-pressed", "true"));
    expect(document.documentElement).toHaveAttribute("data-theme", "pixel-frog");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("loads the particle library only after Pixel Frog is selected", async () => {
    const emitter = Object.assign(vi.fn(), { reset: vi.fn() });
    const create = vi.fn(() => emitter);
    renderHeader();

    expect(document.querySelector("#pixel-theme-confetti-script")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    fireEvent.click(screen.getByRole("button", { name: "敦煌流光" }));
    expect(document.querySelector("#pixel-theme-confetti-script")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    fireEvent.click(screen.getByRole("button", { name: "像素蛙" }));

    const script = document.querySelector<HTMLScriptElement>("#pixel-theme-confetti-script");
    expect(script).toHaveAttribute("src", "/template/pingfangvideo/js/canvas-confetti.min.js?v=1.9.4");
    expect(create).not.toHaveBeenCalled();

    (window as Window & { confetti?: { create: typeof create } }).confetti = { create };
    fireEvent.load(script!);

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(document.querySelector(".pixel-edge-particles")).toBeInTheDocument();
  });

  it("retries the particle library after a load failure", async () => {
    const emitter = Object.assign(vi.fn(), { reset: vi.fn() });
    const create = vi.fn(() => emitter);
    renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    fireEvent.click(screen.getByRole("button", { name: "像素蛙" }));
    const failedScript = document.querySelector<HTMLScriptElement>("#pixel-theme-confetti-script");
    fireEvent.error(failedScript!);
    await waitFor(() => expect(failedScript).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    fireEvent.click(screen.getByRole("button", { name: "液态影院" }));
    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    fireEvent.click(screen.getByRole("button", { name: "像素蛙" }));

    const retryScript = document.querySelector<HTMLScriptElement>("#pixel-theme-confetti-script");
    expect(retryScript).toBeInTheDocument();
    expect(retryScript).not.toBe(failedScript);

    (window as Window & { confetti?: { create: typeof create } }).confetti = { create };
    fireEvent.load(retryScript!);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
  });

  it("launches only the latest Pixel Frog selection while the library is loading", async () => {
    const emitter = Object.assign(vi.fn(), { reset: vi.fn() });
    const create = vi.fn(() => emitter);
    renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    fireEvent.click(screen.getByRole("button", { name: "像素蛙" }));
    const script = document.querySelector<HTMLScriptElement>("#pixel-theme-confetti-script");

    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    fireEvent.click(screen.getByRole("button", { name: "液态影院" }));
    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    fireEvent.click(screen.getByRole("button", { name: "像素蛙" }));

    expect(document.querySelectorAll("#pixel-theme-confetti-script")).toHaveLength(1);
    (window as Window & { confetti?: { create: typeof create } }).confetti = { create };
    fireEvent.load(script!);

    await waitFor(() => expect(emitter).toHaveBeenCalledTimes(20));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not create particles when the header unmounts during loading", async () => {
    const emitter = Object.assign(vi.fn(), { reset: vi.fn() });
    const create = vi.fn(() => emitter);
    const view = renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    fireEvent.click(screen.getByRole("button", { name: "像素蛙" }));
    const script = document.querySelector<HTMLScriptElement>("#pixel-theme-confetti-script");
    view.unmount();

    (window as Window & { confetti?: { create: typeof create } }).confetti = { create };
    fireEvent.load(script!);

    await waitFor(() => expect(script).toHaveAttribute("data-loaded", "true"));
    expect(create).not.toHaveBeenCalled();
    expect(document.querySelector(".pixel-edge-particles")).not.toBeInTheDocument();
  });

  it("removes the default theme state and clears the transition after 560ms", () => {
    vi.useFakeTimers();
    const emitter = Object.assign(vi.fn(), { reset: vi.fn() });
    const create = vi.fn(() => emitter);
    (window as Window & { confetti?: { create: typeof create } }).confetti = { create };
    renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    fireEvent.click(screen.getByRole("button", { name: "像素蛙" }));
    vi.advanceTimersToNextFrame();
    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    fireEvent.click(screen.getByRole("button", { name: "液态影院" }));

    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(localStorage.getItem("pingfang_theme")).toBeNull();
    expect(emitter.reset).toHaveBeenCalled();
    expect(document.documentElement).toHaveClass("theme-transitioning");

    vi.advanceTimersByTime(559);
    expect(document.documentElement).toHaveClass("theme-transitioning");
    vi.advanceTimersByTime(1);
    expect(document.documentElement).not.toHaveClass("theme-transitioning");
  });

  it.each([
    ["prefers reduced motion", true, "visible"],
    ["the document is hidden", false, "hidden"]
  ])("does not launch Pixel Frog particles when %s", (_condition, reducedMotion, visibilityState) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: visibilityState });
    vi.stubGlobal(
      "matchMedia",
      vi.fn(
        (query: string) =>
          ({
            matches: reducedMotion && query === "(prefers-reduced-motion: reduce)",
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
    const create = vi.fn();
    (window as Window & { confetti?: { create: typeof create } }).confetti = { create };
    renderHeader();

    fireEvent.click(screen.getByRole("button", { name: "主题" }));
    fireEvent.click(screen.getByRole("button", { name: "像素蛙" }));

    expect(document.documentElement).toHaveAttribute("data-theme", "pixel-frog");
    expect(create).not.toHaveBeenCalled();
    expect(document.querySelector(".pixel-edge-particles")).not.toBeInTheDocument();
  });
});
