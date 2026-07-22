"use client";

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "../app/routing";

function safeStatusTarget(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  try {
    const url = new URL(value, "https://local.invalid");
    const allowed =
      /^\/(?:$|videos(?:\/|$)|categories(?:\/|$)|category\/|search(?:\/|$)|rankings\/|vod\/|watch\/|trial\/|login$|account(?:\/|$)|history$|feedback$|report$|comments\/|status$)/;
    return allowed.test(url.pathname) ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}

export function StatusPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const title = "系统提示";
  const message = "当前操作已完成。";
  const target = safeStatusTarget(params.get("to"));
  const delay = Math.min(Math.max(Number.parseInt(params.get("delay") || "0", 10) || 0, 0), 10);
  const [remaining, setRemaining] = useState(delay);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    document.title = `${title} · 平方影视`;
  }, [title]);

  useEffect(() => {
    if (cancelled || delay === 0) return;
    if (remaining === 0) {
      void navigate(target, { replace: true });
      return;
    }
    const timer = window.setTimeout(() => setRemaining((value) => Math.max(value - 1, 0)), 1000);
    return () => window.clearTimeout(timer);
  }, [cancelled, delay, navigate, remaining, target]);

  return (
    <main id="mainContent" tabIndex={-1}>
      <section className="wrap system-page">
        <div className="system-box" role="status">
          <span className="eyebrow">状态</span>
          <h1>{title}</h1>
          <p>{message}</p>
          {delay > 0 && !cancelled && <p aria-live="polite">将在 {remaining} 秒后安全跳转。</p>}
          <div className="detail-actions">
            <Link className="primary-btn" to={target}>
              立即前往
            </Link>
            {delay > 0 && !cancelled && (
              <button className="ghost-btn" type="button" onClick={() => setCancelled(true)}>
                取消自动跳转
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export function NotFoundPage() {
  useEffect(() => {
    document.title = "页面不存在 · 平方影视";
  }, []);

  return (
    <main id="mainContent" tabIndex={-1}>
      <section className="wrap system-page">
        <div className="system-box" role="alert">
          <span className="eyebrow">404</span>
          <h1 id="not-found-title">页面不存在</h1>
          <p>请检查地址，或返回影片库继续浏览。</p>
          <div className="detail-actions">
            <Link className="primary-btn" to="/videos">
              浏览影片库
            </Link>
            <Link className="ghost-btn" to="/">
              返回首页
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
