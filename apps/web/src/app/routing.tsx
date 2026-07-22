"use client";

import NextLink from "next/link";
import { useParams as useNextParams, usePathname, useRouter, useSearchParams as useNextSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AnchorHTMLAttributes, PropsWithChildren } from "react";

type RouteParams = Record<string, string | undefined>;
type NavigationState = { from?: string };
type NavigateOptions = { replace?: boolean; state?: NavigationState };
type NavigateFunction = (to: string, options?: NavigateOptions) => void;

type RoutingContextValue = {
  pathname: string;
  params: RouteParams;
  searchParams: URLSearchParams;
  state: NavigationState | null;
  navigate: NavigateFunction;
  test: boolean;
};

const RoutingContext = createContext<RoutingContextValue | null>(null);
const localOrigin = "https://next.local";

function safeInternalPath(value: string | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  try {
    const url = new URL(value, localOrigin);
    if (url.origin !== localOrigin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function navigationTarget(to: string, state?: NavigationState) {
  const from = safeInternalPath(state?.from);
  if (!from) return to;

  const target = new URL(to, localOrigin);
  if (target.origin !== localOrigin) return to;
  target.searchParams.set("from", from);
  return `${target.pathname}${target.search}${target.hash}`;
}

function normalizedParams(params: ReturnType<typeof useNextParams>): RouteParams {
  return Object.fromEntries(Object.entries(params ?? {}).map(([name, value]) => [name, Array.isArray(value) ? value[0] : value]));
}

export function RoutingProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const params = useNextParams();
  const nextSearchParams = useNextSearchParams();
  const search = nextSearchParams?.toString() ?? "";
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const navigate = useCallback<NavigateFunction>(
    (to, options) => {
      const target = navigationTarget(to, options?.state);
      if (options?.replace) router.replace(target);
      else router.push(target);
    },
    [router]
  );
  const from = safeInternalPath(searchParams.get("from") ?? undefined);
  const value = useMemo<RoutingContextValue>(
    () => ({ pathname, params: normalizedParams(params), searchParams, state: from ? { from } : null, navigate, test: false }),
    [from, navigate, params, pathname, searchParams]
  );

  return <RoutingContext.Provider value={value}>{children}</RoutingContext.Provider>;
}

export function TestRoutingProvider({ children, href, params = {} }: PropsWithChildren<{ href: string; params?: RouteParams }>) {
  const [url, setUrl] = useState(() => new URL(href, localOrigin));
  const [state, setState] = useState<NavigationState | null>(null);
  const navigate = useCallback<NavigateFunction>((to, options) => {
    setUrl(new URL(navigationTarget(to, options?.state), localOrigin));
    setState(options?.state ?? null);
  }, []);
  const value = useMemo<RoutingContextValue>(
    () => ({ pathname: url.pathname, params, searchParams: new URLSearchParams(url.searchParams), state, navigate, test: true }),
    [navigate, params, state, url]
  );

  return <RoutingContext.Provider value={value}>{children}</RoutingContext.Provider>;
}

function useRoutingContext() {
  const context = useContext(RoutingContext);
  if (!context) throw new Error("路由组件必须在 RoutingProvider 内使用");
  return context;
}

export function Link({ to, ...props }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { to: string }) {
  const context = useRoutingContext();
  if (context.test) return <a {...props} href={to} />;
  return <NextLink {...props} href={to} />;
}

export function useNavigate() {
  return useRoutingContext().navigate;
}

export function useLocation() {
  const { pathname, state } = useRoutingContext();
  return { pathname, state };
}

export function useParams() {
  return useRoutingContext().params;
}

export function useSearchParams() {
  return [useRoutingContext().searchParams] as const;
}

export function Navigate({ to, replace, state }: { to: string; replace?: boolean; state?: NavigationState }) {
  const navigate = useNavigate();
  const from = state?.from;

  useEffect(() => {
    navigate(to, { replace, ...(from ? { state: { from } } : {}) });
  }, [from, navigate, replace, to]);

  return null;
}
