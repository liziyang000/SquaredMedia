"use client";

import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import type { CSSProperties, PropsWithChildren } from "react";

import { homeApi } from "../api";
import { PageStatus } from "../components/PagePrimitives";
import { SiteHeader } from "../components/SiteHeader";
import { AccountProvider, useAccount } from "./AccountContext";
import { SearchParamsProvider, useLocation } from "./routing";

function AppShellContent({ children }: PropsWithChildren) {
  const account = useAccount();
  const { pathname } = useLocation();
  const homeRoute = pathname === "/";
  const immersiveRoute = pathname === "/qixi";
  const query = useQuery({
    queryKey: homeRoute ? ["home", "v2"] : ["navigation"],
    queryFn: () => (homeRoute ? homeApi.getHome() : homeApi.getNavigation()),
    enabled: !immersiveRoute && !account.isPending,
    staleTime: 300_000
  });

  if (immersiveRoute) {
    return <div className="react-app react-app-immersive">{children}</div>;
  }

  const lazyloadImage = query.data?.ui?.lazyloadImage ?? "/template/pingfangvideo/images/brand/lazyload.png";

  return (
    <div className="react-app" style={{ "--react-lazyload-image": `url(${JSON.stringify(lazyloadImage)})` } as CSSProperties}>
      <SiteHeader siteName={query.data?.siteName ?? "平方影视"} categories={query.data?.categories ?? []} userName={account.session.user?.name} />
      {account.isPending ? (
        <PageStatus title="正在确认登录状态" description="正在读取本地会话…" />
      ) : (
        <Suspense fallback={null}>
          <SearchParamsProvider>{children}</SearchParamsProvider>
        </Suspense>
      )}
    </div>
  );
}

export function AppShell({ children }: PropsWithChildren) {
  return (
    <AccountProvider>
      <AppShellContent>{children}</AppShellContent>
    </AccountProvider>
  );
}
