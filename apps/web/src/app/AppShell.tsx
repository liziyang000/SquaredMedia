"use client";

import { useQuery } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";

import { homeApi } from "../api";
import { SiteHeader } from "../components/SiteHeader";
import { AccountProvider, useAccount } from "./AccountContext";
import { useLocation } from "./routing";

function AppShellContent({ children }: PropsWithChildren) {
  const account = useAccount();
  const { pathname } = useLocation();
  const homeRoute = pathname === "/";
  const query = useQuery({
    queryKey: homeRoute ? ["home", "v2"] : ["navigation"],
    queryFn: () => (homeRoute ? homeApi.getHome() : homeApi.getNavigation()),
    staleTime: 300_000
  });

  return (
    <div className="react-app">
      <SiteHeader siteName={query.data?.siteName ?? "平方影视"} categories={query.data?.categories ?? []} userName={account.session.user?.name} />
      {children}
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
