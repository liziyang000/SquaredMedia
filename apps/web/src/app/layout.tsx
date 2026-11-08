import type { Metadata } from "next";
import type { PropsWithChildren } from "react";
import { headers } from "next/headers";

import { AppProviders } from "./AppProviders";
import { AppShell } from "./AppShell";
import { loadPageBootstrap } from "../server/sessionBootstrap";
import { themeBootstrapScript } from "../themeBootstrap";
import "../styles/index.css";

export const metadata: Metadata = {
  title: "平方影视",
  description: "平方影视内容与会员前台",
  icons: { icon: "/template/pingfangvideo/images/brand/favicon.ico" }
};

export default async function RootLayout({ children }: PropsWithChildren) {
  const bootstrap = await loadPageBootstrap(new Headers(await headers()));
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <AppProviders bootstrap={bootstrap}>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
