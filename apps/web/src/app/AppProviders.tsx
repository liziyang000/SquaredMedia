"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { PropsWithChildren } from "react";

import { ApiError } from "../api/http";
import type { PageBootstrap } from "../server/sessionBootstrap";
import { RoutingProvider } from "./routing";

export function shouldRetryQuery(failureCount: number, error: unknown) {
  if (error instanceof ApiError) {
    if (error.status >= 400 && error.status < 500) return false;
    if (["business", "validation", "configuration", "invalid-response", "aborted"].includes(error.kind)) return false;
  }
  return failureCount < 2;
}

export function AppProviders({ children, bootstrap }: PropsWithChildren<{ bootstrap?: PageBootstrap }>) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: shouldRetryQuery } }
    });
    if (bootstrap) {
      const options = { updatedAt: bootstrap.updatedAt };
      client.setQueryData(["account", "session"], bootstrap.session, options);
      if (bootstrap.home) client.setQueryData(["home", "v2"], bootstrap.home, options);
      if (bootstrap.navigation) client.setQueryData(["navigation"], bootstrap.navigation, options);
      if (bootstrap.content) client.setQueryData(["content", bootstrap.content.request], bootstrap.content.data, options);
      if (bootstrap.detail) client.setQueryData(["content-detail", bootstrap.detail.vodId], bootstrap.detail.data, options);
    }
    return client;
  });
  return (
    <QueryClientProvider client={queryClient}>
      <RoutingProvider>{children}</RoutingProvider>
    </QueryClientProvider>
  );
}
