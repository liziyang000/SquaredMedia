import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "../app/routing";

import type { HomeCategory } from "../api";

const themes = [
  { id: "default", label: "液态影院", swatch: "theme-option-swatch-default" },
  { id: "blue-pink-purple", label: "极光夜幕", swatch: "theme-option-swatch-aurora" },
  { id: "poster-magazine", label: "海报画廊", swatch: "theme-option-swatch-poster" }
] as const;

type ThemeId = (typeof themes)[number]["id"];

function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "default";
  try {
    const value = window.localStorage.getItem("pingfang_theme");
    return themes.some((theme) => theme.id === value) ? (value as ThemeId) : "default";
  } catch {
    return "default";
  }
}

function ThemeOptions({ theme, onChange }: { theme: ThemeId; onChange: (theme: ThemeId) => void }) {
  return themes.map((option) => (
    <button
      className={`theme-option${theme === option.id ? " is-active" : ""}`}
      key={option.id}
      type="button"
      aria-pressed={theme === option.id}
      onClick={() => onChange(option.id)}
    >
      <span className={`theme-option-swatch ${option.swatch}`} aria-hidden="true" />
      <span>{option.label}</span>
    </button>
  ));
}

export function SiteHeader({ siteName, categories, userName }: { siteName: string; categories: HomeCategory[]; userName?: string }) {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("default");
  const [themeHydrated, setThemeHydrated] = useState(false);
  const themeMenuId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const drawerToggleRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const themeSwitcherRef = useRef<HTMLDivElement>(null);
  const themeTriggerRef = useRef<HTMLButtonElement>(null);
  const homeIsCurrent = location.pathname === "/";
  const videosAreCurrent = ["/videos", "/categories", "/category/", "/search", "/vod/", "/watch/", "/trial/", "/rankings/"].some(
    (path) => location.pathname === path || location.pathname.startsWith(path)
  );

  useEffect(() => {
    setTheme(readStoredTheme());
    setThemeHydrated(true);
  }, []);

  useEffect(() => {
    if (!themeHydrated) return;
    document.documentElement.dataset.theme = theme;
    try {
      document.defaultView?.localStorage.setItem("pingfang_theme", theme);
    } catch {
      // The selected theme still applies when storage is unavailable.
    }
  }, [theme, themeHydrated]);

  useEffect(() => {
    document.body.classList.toggle("mobile-nav-open", drawerOpen);
    if (drawerOpen) drawerCloseRef.current?.focus();

    return () => document.body.classList.remove("mobile-nav-open");
  }, [drawerOpen]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Tab" && drawerOpen) {
        const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable?.[0];
        const last = focusable?.[focusable.length - 1];

        if (first && last && event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (first && last && !event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      if (event.key !== "Escape") return;
      if (themeMenuOpen) {
        setThemeMenuOpen(false);
        themeTriggerRef.current?.focus();
      }
      if (drawerOpen) {
        setDrawerOpen(false);
        drawerToggleRef.current?.focus();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [drawerOpen, themeMenuOpen]);

  useEffect(() => {
    if (!themeMenuOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!themeSwitcherRef.current?.contains(event.target as Node)) setThemeMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [themeMenuOpen]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    drawerToggleRef.current?.focus();
  };
  const chooseTheme = (nextTheme: ThemeId) => {
    setTheme(nextTheme);
    setThemeMenuOpen(false);
  };

  return (
    <>
      <header className="site-header">
        <div className="wrap header-inner">
          <Link className="brand" to="/" aria-label={siteName}>
            <span className="brand-emblem" aria-hidden="true" />
            <span className="brand-wordmark">
              <strong>{siteName}</strong>
              <small>STREAMING EDITION</small>
            </span>
          </Link>
          <button
            className="nav-toggle"
            ref={drawerToggleRef}
            type="button"
            aria-label="展开导航"
            aria-expanded={drawerOpen}
            aria-controls="reactMobileDrawer"
            onClick={() => setDrawerOpen(true)}
          >
            <span />
            <span />
            <span />
          </button>
          <nav className="site-nav" aria-label="主导航">
            <Link to="/" aria-current={homeIsCurrent ? "page" : undefined}>
              首页
            </Link>
            <Link to="/videos" aria-current={videosAreCurrent ? "page" : undefined}>
              视频
            </Link>
          </nav>
          <div className="header-search-wrap">
            <form className="header-search" action="/search" method="get" role="search">
              <label className="sr-only" htmlFor="reactGlobalSearch">
                站内搜索
              </label>
              <input id="reactGlobalSearch" type="search" name="wd" placeholder="搜索影片、演员或导演…" autoComplete="off" required />
              <button type="submit">搜索</button>
            </form>
          </div>
          <div className="theme-switcher" ref={themeSwitcherRef}>
            <button
              className="theme-switcher-trigger"
              ref={themeTriggerRef}
              type="button"
              aria-expanded={themeMenuOpen}
              aria-controls={themeMenuId}
              onClick={() => setThemeMenuOpen((open) => !open)}
            >
              主题
            </button>
            <div className="theme-switcher-menu" id={themeMenuId} hidden={!themeMenuOpen}>
              <ThemeOptions theme={theme} onChange={chooseTheme} />
            </div>
          </div>
          <div className="user-menu">
            <Link
              className={`user-avatar${userName ? "" : " user-avatar-guest"}`}
              to={userName ? "/account" : "/login"}
              aria-label={userName ? `用户中心：${userName}` : "登录"}
            >
              <span>{userName ? userName.slice(0, 1) : "登录"}</span>
            </Link>
          </div>
        </div>
      </header>

      <button
        className={`mobile-drawer-backdrop${drawerOpen ? " is-visible" : ""}`}
        type="button"
        hidden={!drawerOpen}
        aria-label="关闭导航"
        onClick={closeDrawer}
      />
      <aside
        className={`mobile-drawer${drawerOpen ? " is-open" : ""}`}
        id="reactMobileDrawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reactMobileDrawerTitle"
        aria-hidden={!drawerOpen}
        inert={!drawerOpen}
        hidden={!drawerOpen}
      >
        <div className="mobile-drawer-head">
          <strong id="reactMobileDrawerTitle">分类导航</strong>
          <button className="mobile-drawer-close" ref={drawerCloseRef} type="button" aria-label="关闭菜单" onClick={closeDrawer}>
            ×
          </button>
        </div>
        <form className="mobile-drawer-search" action="/search" method="get" role="search">
          <label className="sr-only" htmlFor="reactMobileSearch">
            站内搜索
          </label>
          <input id="reactMobileSearch" type="search" name="wd" placeholder="搜索影片、演员或导演…" autoComplete="off" required />
          <button type="submit">搜索</button>
        </form>
        <nav className="mobile-drawer-links" aria-label="移动端快捷导航">
          <Link to="/" aria-current={homeIsCurrent ? "page" : undefined} onClick={closeDrawer}>
            首页
          </Link>
          <Link to="/videos" aria-current={videosAreCurrent ? "page" : undefined} onClick={closeDrawer}>
            视频
          </Link>
        </nav>
        <div className="mobile-drawer-section mobile-drawer-account">
          <span>账号</span>
          <div className="mobile-drawer-user">
            <Link className="mobile-drawer-login" to={userName ? "/account" : "/login"} onClick={closeDrawer}>
              {userName || "登录"}
            </Link>
          </div>
        </div>
        <div className="mobile-drawer-section mobile-theme-section">
          <span>主题</span>
          <div className="theme-option-grid">
            <ThemeOptions theme={theme} onChange={chooseTheme} />
          </div>
        </div>
        <div className="mobile-drawer-section">
          <span>影片分类</span>
          <div className="mobile-drawer-cats">
            {categories.map((category) => (
              <Link key={category.id} to={`/category/${category.id}`} onClick={closeDrawer}>
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
