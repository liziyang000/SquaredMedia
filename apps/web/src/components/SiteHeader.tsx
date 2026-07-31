import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "../app/routing";

import type { HomeCategory } from "../api";

const themes = [
  { id: "default", label: "液态影院", swatch: "theme-option-swatch-default" },
  { id: "blue-pink-purple", label: "极光夜幕", swatch: "theme-option-swatch-aurora" },
  { id: "poster-magazine", label: "海报画廊", swatch: "theme-option-swatch-poster" },
  { id: "dunhuang-caisson", label: "敦煌流光", swatch: "theme-option-swatch-dunhuang" },
  { id: "pixel-frog", label: "像素蛙", swatch: "theme-option-swatch-pixel" }
] as const;

type ThemeId = (typeof themes)[number]["id"];
type PixelConfettiEmitter = {
  (options: Record<string, unknown>): void;
  reset: () => void;
};
type PixelConfettiWindow = Window &
  typeof globalThis & {
    confetti?: {
      create: (canvas: HTMLCanvasElement, options: { resize: boolean; useWorker: boolean; disableForReducedMotion: boolean }) => PixelConfettiEmitter;
    };
  };

const THEME_STORAGE_KEY = "pingfang_theme";
const THEME_TRANSITION_MS = 560;
const PIXEL_CONFETTI_SCRIPT_ID = "pixel-theme-confetti-script";
const PIXEL_CONFETTI_SRC = "/template/pingfangvideo/js/canvas-confetti.min.js?v=1.9.4";
let pixelConfettiLoadPromise: Promise<boolean> | null = null;

function hasPixelConfetti() {
  return typeof (window as PixelConfettiWindow).confetti?.create === "function";
}

function loadPixelConfetti() {
  if (hasPixelConfetti()) return Promise.resolve(true);
  if (pixelConfettiLoadPromise) return pixelConfettiLoadPromise;

  pixelConfettiLoadPromise = new Promise<boolean>((resolve) => {
    let script = document.getElementById(PIXEL_CONFETTI_SCRIPT_ID) as HTMLScriptElement | null;
    if (script?.dataset.loaded === "true") {
      script.remove();
      script = null;
    }

    script ??= document.createElement("script");
    script.id = PIXEL_CONFETTI_SCRIPT_ID;
    script.src = PIXEL_CONFETTI_SRC;
    script.async = true;

    const finish = (loaded: boolean) => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
      if (loaded && hasPixelConfetti()) {
        script.dataset.loaded = "true";
        resolve(true);
      } else {
        script.remove();
        resolve(false);
      }
    };
    const handleLoad = () => finish(true);
    const handleError = () => finish(false);

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    if (!script.isConnected) document.head.appendChild(script);
  }).finally(() => {
    pixelConfettiLoadPromise = null;
  });

  return pixelConfettiLoadPromise;
}

function readStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "default";
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return themes.some((theme) => theme.id === value) ? (value as ThemeId) : "default";
  } catch {
    return "default";
  }
}

function applyThemeToDocument(theme: ThemeId) {
  if (theme === "default") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

function persistTheme(theme: ThemeId) {
  try {
    if (theme === "default") {
      window.localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
  } catch {
    // The selected theme still applies when storage is unavailable.
  }
}

function prefersReducedMotion() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ThemeOptions({ theme, onChange }: { theme: ThemeId; onChange: (theme: ThemeId) => void }) {
  return themes.map((option) => (
    <button
      className={`theme-option${theme === option.id ? " is-active" : ""}`}
      key={option.id}
      type="button"
      data-theme-option={option.id}
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
  const themeTransitionTimerRef = useRef<number | null>(null);
  const pixelParticleFrameRef = useRef<number | null>(null);
  const pixelParticleRevisionRef = useRef(0);
  const pixelParticleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pixelConfettiRef = useRef<PixelConfettiEmitter | null>(null);
  const homeIsCurrent = location.pathname === "/";
  const videosAreCurrent = ["/videos", "/categories", "/category/", "/search", "/vod/", "/watch/", "/trial/", "/rankings/"].some(
    (path) => location.pathname === path || location.pathname.startsWith(path)
  );
  const gamesAreCurrent = location.pathname === "/games" || location.pathname.startsWith("/games/");

  useEffect(() => {
    setTheme(readStoredTheme());
    setThemeHydrated(true);
  }, []);

  useEffect(() => {
    if (!themeHydrated) return;
    applyThemeToDocument(theme);
    persistTheme(theme);
  }, [theme, themeHydrated]);

  useEffect(
    () => () => {
      if (themeTransitionTimerRef.current !== null) window.clearTimeout(themeTransitionTimerRef.current);
      if (pixelParticleFrameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(pixelParticleFrameRef.current);
      }
      pixelParticleRevisionRef.current += 1;
      pixelConfettiRef.current?.reset();
      pixelParticleCanvasRef.current?.remove();
      document.documentElement.classList.remove("theme-transitioning");
    },
    []
  );

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
  const clearThemeTransition = () => {
    if (themeTransitionTimerRef.current !== null) {
      window.clearTimeout(themeTransitionTimerRef.current);
      themeTransitionTimerRef.current = null;
    }
    document.documentElement.classList.remove("theme-transitioning");
  };
  const scheduleThemeTransition = () => {
    clearThemeTransition();
    void document.documentElement.offsetWidth;
    document.documentElement.classList.add("theme-transitioning");
    themeTransitionTimerRef.current = window.setTimeout(clearThemeTransition, THEME_TRANSITION_MS);
  };
  const resetPixelThemeParticles = () => {
    if (pixelParticleFrameRef.current !== null && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(pixelParticleFrameRef.current);
      pixelParticleFrameRef.current = null;
    }
    pixelConfettiRef.current?.reset();
  };
  const getPixelThemeConfetti = () => {
    if (pixelConfettiRef.current) return pixelConfettiRef.current;
    const confetti = (window as PixelConfettiWindow).confetti;
    if (!document.body || !confetti || typeof confetti.create !== "function") return null;

    const canvas = document.createElement("canvas");
    canvas.className = "pixel-edge-particles";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);

    try {
      const emitter = confetti.create(canvas, {
        resize: true,
        useWorker: true,
        disableForReducedMotion: true
      });
      pixelParticleCanvasRef.current = canvas;
      pixelConfettiRef.current = emitter;
      return emitter;
    } catch {
      canvas.remove();
      return null;
    }
  };
  const launchPixelThemeParticles = () => {
    if (prefersReducedMotion() || document.visibilityState === "hidden") return;
    const emitter = getPixelThemeConfetti();
    if (!emitter) return;

    emitter.reset();
    const compact = window.innerWidth <= 760;
    const positions = compact ? [0.2, 0.5, 0.8] : [0.12, 0.31, 0.5, 0.69, 0.88];
    const particleCount = compact ? 2 : 3;
    positions.forEach((position, index) => {
      [
        { origin: { x: 0.005, y: position }, angle: 0 },
        { origin: { x: 0.995, y: position }, angle: 180 },
        { origin: { x: position, y: 0.005 }, angle: 270 },
        { origin: { x: position, y: 0.995 }, angle: 90 }
      ].forEach(({ origin, angle }) => {
        emitter({
          particleCount,
          angle,
          spread: 18,
          startVelocity: particleCount === 2 ? 14 : 20,
          decay: 0.91,
          gravity: 0,
          ticks: 48,
          colors: ["#b9e84a", "#fff0c6", "#6f8128", "#ff8a78"],
          shapes: ["square"],
          scalar: index % 2 === 0 ? 0.64 : 0.48,
          flat: true,
          origin
        });
      });
    });
  };
  const chooseTheme = (nextTheme: ThemeId) => {
    const particleRevision = ++pixelParticleRevisionRef.current;
    scheduleThemeTransition();
    resetPixelThemeParticles();
    applyThemeToDocument(nextTheme);
    persistTheme(nextTheme);
    setTheme(nextTheme);
    setThemeMenuOpen(false);
    if (nextTheme === "pixel-frog" && !prefersReducedMotion() && document.visibilityState !== "hidden") {
      const launch = () => {
        pixelParticleFrameRef.current = null;
        if (pixelParticleRevisionRef.current !== particleRevision || document.documentElement.dataset.theme !== "pixel-frog") return;
        if (hasPixelConfetti()) {
          launchPixelThemeParticles();
          return;
        }
        void loadPixelConfetti().then((loaded) => {
          if (
            loaded &&
            pixelParticleRevisionRef.current === particleRevision &&
            document.documentElement.dataset.theme === "pixel-frog" &&
            !prefersReducedMotion() &&
            document.visibilityState !== "hidden"
          ) {
            launchPixelThemeParticles();
          }
        });
      };
      if (typeof window.requestAnimationFrame === "function") {
        pixelParticleFrameRef.current = window.requestAnimationFrame(launch);
      } else {
        launch();
      }
    }
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
            <Link to="/categories" aria-current={videosAreCurrent ? "page" : undefined}>
              视频
            </Link>
            <Link to="/games" aria-current={gamesAreCurrent ? "page" : undefined}>
              游戏
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
          <Link to="/categories" aria-current={videosAreCurrent ? "page" : undefined} onClick={closeDrawer}>
            视频
          </Link>
          <Link to="/games" aria-current={gamesAreCurrent ? "page" : undefined} onClick={closeDrawer}>
            游戏
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
