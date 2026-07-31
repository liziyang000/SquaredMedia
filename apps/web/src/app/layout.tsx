import type { Metadata } from "next";
import type { PropsWithChildren } from "react";

import { AppProviders } from "./AppProviders";
import { AppShell } from "./AppShell";
import "../styles/index.css";

export const metadata: Metadata = {
  title: "平方影视",
  description: "平方影视内容与会员前台",
  icons: { icon: "/template/pingfangvideo/images/brand/favicon.ico" }
};

const themeBootstrapScript = `(function(){try{var theme=window.localStorage.getItem("pingfang_theme");if(theme==="blue-pink-purple"||theme==="poster-magazine"||theme==="dunhuang-caisson"||theme==="pixel-frog"){document.documentElement.setAttribute("data-theme",theme);}else{document.documentElement.removeAttribute("data-theme");}}catch(error){}})();`;

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
