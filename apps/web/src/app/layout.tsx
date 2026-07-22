import type { Metadata } from "next";
import { Suspense } from "react";
import type { PropsWithChildren } from "react";

import { AppProviders } from "./AppProviders";
import { AppShell } from "./AppShell";
import "../styles/index.css";

export const metadata: Metadata = {
  title: "平方影视",
  description: "平方影视内容与会员前台",
  icons: { icon: "/template/pingfangvideo/images/brand/favicon.ico" }
};

function AppFallback() {
  return (
    <main className="home-status-shell" aria-live="polite">
      <section className="home-status-panel" role="status">
        <span className="brand-emblem" aria-hidden="true" />
        <p className="migration-kicker">SquaredMedia</p>
        <h1>正在加载页面</h1>
        <p>正在准备内容与会员会话…</p>
      </section>
    </main>
  );
}

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="zh-CN">
      <body>
        <Suspense fallback={<AppFallback />}>
          <AppProviders>
            <AppShell>{children}</AppShell>
          </AppProviders>
        </Suspense>
      </body>
    </html>
  );
}
