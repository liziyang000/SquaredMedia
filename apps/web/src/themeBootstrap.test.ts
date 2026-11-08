import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { themeBootstrapScript } from "./themeBootstrap";

const originalLoader = window.pingfangLoadThemeStyles;
const start = () => new Function(themeBootstrapScript)();
const links = () => Array.from(document.querySelectorAll<HTMLLinkElement>('link[id^="pf-theme-"]'));

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  document.head.innerHTML = "";
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  window.pingfangLoadThemeStyles = originalLoader;
});

describe("theme styles before first paint", () => {
  it("requests no optional CSS for the default theme", async () => {
    start();
    await window.pingfangLoadThemeStyles("default");
    expect(links()).toHaveLength(0);
  });

  it("restores ink with a render-blocking stylesheet before the base CSS", async () => {
    document.head.innerHTML = '<link rel="stylesheet" data-precedence="next" href="/base.css">';
    localStorage.setItem("pingfang_theme", "ink-wash");
    start();
    expect(document.documentElement.dataset.theme).toBe("ink-wash");
    expect(links()).toHaveLength(1);
    const link = links()[0];
    expect(link.href).toContain("/template/pingfangvideo/css/ink-wash.css?v=");
    expect(link.getAttribute("blocking")).toBe("render");
    expect(document.head.firstElementChild).toBe(link);
    link.dispatchEvent(new Event("load"));
    await window.pingfangLoadThemeStyles("ink-wash");
  });

  it("shares pending theme styles and keeps foundation before overrides", async () => {
    start();
    const first = window.pingfangLoadThemeStyles("dunhuang-caisson");
    const second = window.pingfangLoadThemeStyles("pixel-frog");
    expect(links().map((link) => link.id)).toEqual(["pf-theme-themes-foundation", "pf-theme-themes"]);
    links().forEach((link) => link.dispatchEvent(new Event("load")));
    await Promise.all([first, second]);
    await window.pingfangLoadThemeStyles("poster-magazine");
    expect(links()).toHaveLength(2);
  });

  it("allows a new selection to retry a failed stylesheet", async () => {
    start();
    const failed = window.pingfangLoadThemeStyles("ink-wash");
    const rejection = expect(failed).rejects.toThrow("Theme stylesheet failed");
    links()[0].dispatchEvent(new Event("error"));
    await rejection;
    expect(links()).toHaveLength(0);
    const retry = window.pingfangLoadThemeStyles("ink-wash");
    links()[0].dispatchEvent(new Event("load"));
    await retry;
  });
});
