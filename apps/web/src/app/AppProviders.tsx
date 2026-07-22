"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import type { PropsWithChildren } from "react";

import { ApiError } from "../api/http";
import { RoutingProvider } from "./routing";

export function shouldRetryQuery(failureCount: number, error: unknown) {
  if (error instanceof ApiError) {
    if (error.status >= 400 && error.status < 500) return false;
    if (["business", "validation", "configuration", "invalid-response", "aborted"].includes(error.kind)) return false;
  }
  return failureCount < 2;
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: shouldRetryQuery } }
      })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <RoutingProvider>{children}</RoutingProvider>
    </QueryClientProvider>
  );
}
